import { createCodeScaffold } from "@/lib/builder/code-scaffold";
import { buildCodeSyncRecords } from "@/lib/builder/code-guardrails";
import { generateCodePatchSuggestion } from "@/lib/builder/code-patch-service";
import {
  getActiveBuilderRefreshQueueItem,
  listProjectBuilderRefreshQueue,
} from "@/lib/builder/refresh-queue-repository";
import { getProjectVisualBundle, getProjectVisualBundleSnapshot } from "@/lib/builder/repository";
import { getProjectGenerationTargetBundle } from "@/lib/generation/repository";
import { ModelAdapterExecutionError } from "@/lib/model-adapters/errors";
import {
  getProjectModelAdapterConfigByIds,
  recordProjectModelAdapterRun,
} from "@/lib/model-adapters/repository";
import { withCapabilitySelectionOverride } from "@/lib/model-adapters/registry";
import type {
  ArchiveCodePatchProposalInput,
  ApplyCodePatchProposalInput,
  CodeWorkspaceStateRecord,
  CreateCodePatchProposalInput,
  GeneratedCodeScaffold,
  ProjectCodeBundle,
  ProjectCodeFileLinkRecord,
  ProjectCodeFileRecord,
  ProjectCodePatchProposalRecord,
  ProjectCodeFileRevisionRecord,
  ProjectVisualBundle,
  RejectCodePatchProposalInput,
  RestoreCodeFileRevisionInput,
  SaveCodeFileRevisionInput,
  UpdateCodeFileDraftInput,
} from "@/lib/builder/types";
import { isSupabaseConfigured } from "@/lib/env";
import type { ProjectGenerationTargetBundle } from "@/lib/generation/types";
import { readLocalStore, writeLocalStore } from "@/lib/workspaces/local-store";
import { createSupabaseServerClient } from "@/lib/workspaces/supabase";

function nowIso() {
  return new Date().toISOString();
}

function sortFiles(files: ProjectCodeFileRecord[]) {
  return [...files].sort((a, b) => a.orderIndex - b.orderIndex || a.path.localeCompare(b.path));
}

function sortFileRevisions(revisions: ProjectCodeFileRevisionRecord[]) {
  return [...revisions].sort((a, b) => b.revisionNumber - a.revisionNumber);
}

function sortFileLinks(links: ProjectCodeFileLinkRecord[]) {
  return [...links].sort((a, b) => {
    if (a.fileId !== b.fileId) {
      return a.fileId.localeCompare(b.fileId);
    }

    return a.targetLabel.localeCompare(b.targetLabel);
  });
}

function sortPatchProposals(proposals: ProjectCodePatchProposalRecord[]) {
  const statusRank: Record<ProjectCodePatchProposalRecord["status"], number> = {
    pending: 0,
    stale: 1,
    applied: 2,
    rejected: 3,
  };

  return [...proposals].sort((a, b) => {
    if (Boolean(a.archivedAt) !== Boolean(b.archivedAt)) {
      return a.archivedAt ? 1 : -1;
    }

    if (statusRank[a.status] !== statusRank[b.status]) {
      return statusRank[a.status] - statusRank[b.status];
    }

    return (b.archivedAt ?? b.createdAt).localeCompare(a.archivedAt ?? a.createdAt);
  });
}

type CodeRefreshMode = "metadata" | "safe" | "force";

interface CodeRecordSet {
  codeState: CodeWorkspaceStateRecord;
  files: ProjectCodeFileRecord[];
  fileRevisions: ProjectCodeFileRevisionRecord[];
  fileLinks: ProjectCodeFileLinkRecord[];
  patchProposals: ProjectCodePatchProposalRecord[];
}

interface PatchProposalInvalidation {
  fileId: string;
  note: string;
  timestamp: string;
  invalidatedByRevisionId?: string | null;
  invalidatedByRevisionNumber?: number | null;
}

function mapCodeStateRow(row: Record<string, unknown>): CodeWorkspaceStateRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    activeFilePath: String(row.active_file_path ?? ""),
    openFilePaths: Array.isArray(row.open_file_paths)
      ? row.open_file_paths.map((item) => String(item))
      : [],
    scaffoldSourceRevisionNumber: Number(row.scaffold_source_revision_number ?? 1),
    sourceVisualUpdatedAt: String(row.source_visual_updated_at),
    manualChanges: Boolean(row.manual_changes),
    lastGeneratedAt: String(row.last_generated_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapCodeFileRow(row: Record<string, unknown>): ProjectCodeFileRecord {
  return {
    id: String(row.id),
    codeStateId: String(row.code_state_id),
    projectId: String(row.project_id),
    path: String(row.path),
    directory: String(row.directory),
    name: String(row.name),
    extension: String(row.extension),
    kind: row.file_kind as ProjectCodeFileRecord["kind"],
    language: row.language as ProjectCodeFileRecord["language"],
    orderIndex: Number(row.order_index),
    ownership: row.ownership as ProjectCodeFileRecord["ownership"],
    editPolicy: row.edit_policy as ProjectCodeFileRecord["editPolicy"],
    content: String(row.content),
    currentRevisionId: String(row.current_revision_id ?? ""),
    currentRevisionNumber: Number(row.current_revision_number ?? 1),
    draftContent: row.draft_content ? String(row.draft_content) : null,
    draftUpdatedAt: row.draft_updated_at ? String(row.draft_updated_at) : null,
    draftBaseRevisionId: row.draft_base_revision_id ? String(row.draft_base_revision_id) : null,
    draftBaseRevisionNumber:
      typeof row.draft_base_revision_number === "number"
        ? row.draft_base_revision_number
        : row.draft_base_revision_number
          ? Number(row.draft_base_revision_number)
          : null,
    createdFromVisualPageId: row.created_from_visual_page_id
      ? String(row.created_from_visual_page_id)
      : null,
    createdFromSectionId: row.created_from_section_id
      ? String(row.created_from_section_id)
      : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapCodeFileRevisionRow(row: Record<string, unknown>): ProjectCodeFileRevisionRecord {
  return {
    id: String(row.id),
    fileId: String(row.file_id),
    projectId: String(row.project_id),
    revisionNumber: Number(row.revision_number ?? 1),
    kind: row.kind as ProjectCodeFileRevisionRecord["kind"],
    content: String(row.content),
    changeSummary: String(row.change_summary),
    authoredBy: row.authored_by as ProjectCodeFileRevisionRecord["authoredBy"],
    baseRevisionId: row.base_revision_id ? String(row.base_revision_id) : null,
    baseRevisionNumber:
      typeof row.base_revision_number === "number"
        ? row.base_revision_number
        : row.base_revision_number
          ? Number(row.base_revision_number)
          : null,
    sourceProposalId: row.source_proposal_id ? String(row.source_proposal_id) : null,
    sourceProposalTitle: row.source_proposal_title ? String(row.source_proposal_title) : null,
    restoreSource:
      row.restore_source === "revision" || row.restore_source === "scaffold"
        ? row.restore_source
        : null,
    restoredFromRevisionId: row.restored_from_revision_id
      ? String(row.restored_from_revision_id)
      : null,
    restoredFromRevisionNumber:
      typeof row.restored_from_revision_number === "number"
        ? row.restored_from_revision_number
        : row.restored_from_revision_number
          ? Number(row.restored_from_revision_number)
          : null,
    createdAt: String(row.created_at),
  };
}

function mapCodeFileLinkRow(row: Record<string, unknown>): ProjectCodeFileLinkRecord {
  return {
    id: String(row.id),
    fileId: String(row.file_id),
    projectId: String(row.project_id),
    visualStateId: String(row.visual_state_id),
    targetType: row.target_type as ProjectCodeFileLinkRecord["targetType"],
    role: row.role as ProjectCodeFileLinkRecord["role"],
    visualPageId: row.visual_page_id ? String(row.visual_page_id) : null,
    visualSectionId: row.visual_section_id ? String(row.visual_section_id) : null,
    targetLabel: String(row.target_label),
    createdAt: String(row.created_at),
  };
}

function mapCodePatchProposalRow(row: Record<string, unknown>): ProjectCodePatchProposalRecord {
  return {
    id: String(row.id),
    codeStateId: String(row.code_state_id),
    fileId: String(row.file_id),
    projectId: String(row.project_id),
    filePath: String(row.file_path),
    title: String(row.title),
    requestPrompt: String(row.request_prompt),
    rationale: String(row.rationale),
    changeSummary: String(row.change_summary),
    status: row.status as ProjectCodePatchProposalRecord["status"],
    source: row.source as ProjectCodePatchProposalRecord["source"],
    baseRevisionId: row.base_revision_id ? String(row.base_revision_id) : null,
    baseRevisionNumber:
      typeof row.base_revision_number === "number"
        ? row.base_revision_number
        : row.base_revision_number
          ? Number(row.base_revision_number)
          : null,
    baseContent: String(row.base_content),
    proposedContent: String(row.proposed_content),
    resolvedRevisionId: row.resolved_revision_id ? String(row.resolved_revision_id) : null,
    invalidatedByRevisionId: row.invalidated_by_revision_id ? String(row.invalidated_by_revision_id) : null,
    invalidatedByRevisionNumber:
      typeof row.invalidated_by_revision_number === "number"
        ? row.invalidated_by_revision_number
        : row.invalidated_by_revision_number
          ? Number(row.invalidated_by_revision_number)
          : null,
    resolutionNote: row.resolution_note ? String(row.resolution_note) : null,
    archivedAt: row.archived_at ? String(row.archived_at) : null,
    archiveReason: row.archive_reason ? String(row.archive_reason) : null,
    createdAt: String(row.created_at),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
  };
}

function mergeOpenFilePaths(codeState: CodeWorkspaceStateRecord, filePath: string) {
  return Array.from(new Set([filePath, ...codeState.openFilePaths])).slice(0, 6);
}

function visualBundleFromCodeBundle(bundle: ProjectCodeBundle): ProjectVisualBundle {
  return {
    workspace: bundle.workspace,
    project: bundle.project,
    latestRevision: bundle.latestRevision,
    currentUser: bundle.currentUser,
    membership: bundle.membership,
    workspacePermissions: bundle.workspacePermissions,
    projectPermissions: bundle.projectPermissions,
    revisions: bundle.revisions,
    sourceRevision: bundle.sourceRevision,
    visualState: bundle.visualState,
    visualPages: bundle.visualPages,
    visualSections: bundle.visualSections,
    syncState: bundle.visualSyncState,
  };
}

async function reconcileCodeStateSourceAfterRestore(input: {
  workspaceSlug: string;
  projectSlug: string;
  bundle: ProjectCodeBundle;
  codeState: CodeWorkspaceStateRecord;
  files: ProjectCodeFileRecord[];
  fileRevisions: ProjectCodeFileRevisionRecord[];
  fileLinks: ProjectCodeFileLinkRecord[];
  targetType: "scaffold" | "revision";
  targetRevisionNumber: number;
  targetFilePath: string;
}) {
  if (input.targetType !== "scaffold") {
    return input.codeState;
  }

  const visualBundle = visualBundleFromCodeBundle(input.bundle);
  const activeGenerationTarget = await getActiveCodeGenerationTarget(
    input.workspaceSlug,
    input.projectSlug,
  );
  const targetScaffold = activeGenerationTarget
    ? buildCodeScaffoldFromGenerationTarget(visualBundle, activeGenerationTarget, input.codeState)
    : null;
  const syncArtifacts = buildCodeSyncRecords(
    visualBundle,
    input.codeState,
    input.files,
    input.fileRevisions,
    input.fileLinks,
    targetScaffold
      ? {
          files: targetScaffold.files,
          fileLinks: targetScaffold.fileLinks,
        }
      : null,
  );

  if (syncArtifacts.syncState.staleFileCount > 0) {
    return input.codeState;
  }

  const targetCandidate =
    input.bundle.refreshCandidates.find((candidate) => candidate.path === input.targetFilePath) ?? null;

  return {
    ...input.codeState,
    scaffoldSourceRevisionNumber:
      targetScaffold?.codeState.scaffoldSourceRevisionNumber ?? input.targetRevisionNumber,
    sourceVisualUpdatedAt:
      targetScaffold?.codeState.sourceVisualUpdatedAt ??
      targetCandidate?.sourceVisualUpdatedAt ??
      input.codeState.sourceVisualUpdatedAt,
  };
}

function workingContentForFile(file: ProjectCodeFileRecord) {
  return file.draftContent ?? file.content;
}

function markPatchProposalsStale(
  proposals: ProjectCodePatchProposalRecord[],
  invalidations: PatchProposalInvalidation[],
): ProjectCodePatchProposalRecord[] {
  const invalidationMap = new Map(invalidations.map((entry) => [entry.fileId, entry]));

  return proposals.map((proposal) => {
    const invalidation = invalidationMap.get(proposal.fileId);

    if (!invalidation || proposal.status !== "pending") {
      return proposal;
    }

    return {
      ...proposal,
      status: "stale" as const,
      invalidatedByRevisionId: proposal.invalidatedByRevisionId ?? invalidation.invalidatedByRevisionId ?? null,
      invalidatedByRevisionNumber:
        proposal.invalidatedByRevisionNumber ?? invalidation.invalidatedByRevisionNumber ?? null,
      resolutionNote: proposal.resolutionNote ?? invalidation.note,
      resolvedAt: proposal.resolvedAt ?? invalidation.timestamp,
    };
  });
}

function buildInvalidationsFromFiles(
  files: ProjectCodeFileRecord[],
  fileIds: string[],
  note: string,
  timestamp: string,
) {
  const fileMap = new Map(files.map((file) => [file.id, file]));

  return fileIds.map((fileId) => {
    const file = fileMap.get(fileId) ?? null;

    return {
      fileId,
      note,
      timestamp,
      invalidatedByRevisionId: file?.currentRevisionId ?? null,
      invalidatedByRevisionNumber: file?.currentRevisionNumber ?? null,
    } satisfies PatchProposalInvalidation;
  });
}

function reconcilePatchProposals(
  files: ProjectCodeFileRecord[],
  proposals: ProjectCodePatchProposalRecord[],
  timestamp: string,
): ProjectCodePatchProposalRecord[] {
  const fileMap = new Map(files.map((file) => [file.id, file]));

  return proposals.map((proposal) => {
    if (proposal.status !== "pending") {
      return proposal;
    }

    const file = fileMap.get(proposal.fileId);

    if (
      file &&
      file.path === proposal.filePath &&
      file.content === proposal.proposedContent &&
      file.currentRevisionNumber > (proposal.baseRevisionNumber ?? 0)
    ) {
      return {
        ...proposal,
        status: "applied" as const,
        resolvedRevisionId: proposal.resolvedRevisionId ?? file.currentRevisionId,
        resolutionNote:
          proposal.resolutionNote ?? "Applied into the current file revision from a controlled patch proposal.",
        resolvedAt: proposal.resolvedAt ?? file.updatedAt,
        invalidatedByRevisionId: proposal.invalidatedByRevisionId ?? null,
        invalidatedByRevisionNumber: proposal.invalidatedByRevisionNumber ?? null,
      };
    }

    if (
      !file ||
      file.path !== proposal.filePath ||
      file.ownership !== "scaffold_owned" ||
      file.editPolicy !== "single_file_draft" ||
      workingContentForFile(file) !== proposal.baseContent ||
      file.currentRevisionId !== proposal.baseRevisionId
    ) {
      return {
        ...proposal,
        status: "stale" as const,
        invalidatedByRevisionId:
          proposal.invalidatedByRevisionId ??
          (file && file.currentRevisionId !== proposal.baseRevisionId ? file.currentRevisionId : null),
        invalidatedByRevisionNumber:
          proposal.invalidatedByRevisionNumber ??
          (file && file.currentRevisionId !== proposal.baseRevisionId ? file.currentRevisionNumber : null),
        resolutionNote:
          proposal.resolutionNote ??
          (file && file.currentRevisionId !== proposal.baseRevisionId
            ? "A newer file revision replaced the base for this patch proposal."
            : "The source file changed after this patch proposal was created."),
        resolvedAt: proposal.resolvedAt ?? file?.updatedAt ?? timestamp,
      };
    }

    return proposal;
  });
}

function hasCompleteCodeShape(
  files: ProjectCodeFileRecord[],
  fileRevisions: ProjectCodeFileRevisionRecord[],
  fileLinks: ProjectCodeFileLinkRecord[],
) {
  return (
    files.every((file) =>
      Boolean(file.currentRevisionId) &&
      Boolean(file.ownership) &&
      Boolean(file.editPolicy),
    ) &&
    fileRevisions.length >= files.length &&
    fileLinks.length > 0
  );
}

function buildLinkKey(link: Pick<
  ProjectCodeFileLinkRecord,
  "targetType" | "role" | "visualPageId" | "visualSectionId" | "targetLabel"
>) {
  return [
    link.targetType,
    link.role,
    link.visualPageId ?? "none",
    link.visualSectionId ?? "none",
    link.targetLabel,
  ].join("|");
}

function hasSavedUserChanges(
  file: ProjectCodeFileRecord,
  fileRevisions: ProjectCodeFileRevisionRecord[],
) {
  return (
    file.draftContent !== null ||
    fileRevisions.some((revision) => revision.fileId === file.id && revision.kind === "saved")
  );
}

function sameSet(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const leftSet = new Set(left);

  return right.every((value) => leftSet.has(value));
}

function generationTargetTimestamp(target: ProjectGenerationTargetBundle) {
  return target.run.completedAt ?? target.run.updatedAt ?? target.run.createdAt;
}

function buildCodeScaffoldFromGenerationTarget(
  visualBundle: ProjectVisualBundle,
  target: ProjectGenerationTargetBundle,
  existingState: CodeWorkspaceStateRecord | null,
): GeneratedCodeScaffold {
  const timestamp = generationTargetTimestamp(target);
  const codeStateId = existingState?.id ?? crypto.randomUUID();
  const files = target.codeFiles
    .slice()
    .sort((left, right) => left.orderIndex - right.orderIndex || left.path.localeCompare(right.path))
    .map<ProjectCodeFileRecord>((file) => ({
      id: file.id,
      codeStateId,
      projectId: visualBundle.project.id,
      path: file.path,
      directory: file.directory,
      name: file.name,
      extension: file.extension,
      kind: file.kind,
      language: file.language,
      orderIndex: file.orderIndex,
      ownership: file.ownership,
      editPolicy: file.editPolicy,
      content: file.content,
      currentRevisionId: `${file.id}-scaffold-rev-1`,
      currentRevisionNumber: 1,
      draftContent: null,
      draftUpdatedAt: null,
      draftBaseRevisionId: null,
      draftBaseRevisionNumber: null,
      createdFromVisualPageId: file.createdFromVisualPageId,
      createdFromSectionId: file.createdFromSectionId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
  const fileIdByPath = new Map(files.map((file) => [file.path, file.id]));
  const fileRevisions = files.map<ProjectCodeFileRevisionRecord>((file) => ({
    id: file.currentRevisionId,
    fileId: file.id,
    projectId: visualBundle.project.id,
    revisionNumber: 1,
    kind: "scaffold",
    content: file.content,
    changeSummary: `Generated scaffold target from revision ${target.run.sourcePlanRevisionNumber}.`,
    authoredBy: "system",
    baseRevisionId: null,
    baseRevisionNumber: null,
    sourceProposalId: null,
    sourceProposalTitle: null,
    restoreSource: null,
    restoredFromRevisionId: null,
    restoredFromRevisionNumber: null,
    createdAt: timestamp,
  }));
  const fileLinks = target.codeFileLinks
    .map<ProjectCodeFileLinkRecord | null>((link) => {
      const fileId = fileIdByPath.get(link.filePath) ?? null;

      if (!fileId) {
        return null;
      }

      return {
        id: crypto.randomUUID(),
        fileId,
        projectId: visualBundle.project.id,
        visualStateId: visualBundle.visualState.id,
        targetType: link.targetType,
        role: link.role,
        visualPageId: link.visualPageId,
        visualSectionId: link.visualSectionId,
        targetLabel: link.targetLabel,
        createdAt: timestamp,
      };
    })
    .filter((link): link is ProjectCodeFileLinkRecord => Boolean(link));

  const fallbackActiveFilePath = files[0]?.path ?? "";
  const activeFilePath =
    target.codeState.activeFilePath && files.some((file) => file.path === target.codeState.activeFilePath)
      ? target.codeState.activeFilePath
      : fallbackActiveFilePath;
  const openFilePaths = Array.from(
    new Set(
      [activeFilePath, ...target.codeState.openFilePaths].filter((path) =>
        files.some((file) => file.path === path),
      ),
    ),
  ).slice(0, 6);

  return {
    codeState: {
      id: codeStateId,
      projectId: visualBundle.project.id,
      activeFilePath,
      openFilePaths,
      scaffoldSourceRevisionNumber: target.run.sourcePlanRevisionNumber,
      sourceVisualUpdatedAt: timestamp,
      manualChanges: false,
      lastGeneratedAt: timestamp,
      createdAt: existingState?.createdAt ?? timestamp,
      updatedAt: timestamp,
    },
    files,
    fileRevisions,
    fileLinks,
  };
}

async function getActiveCodeGenerationTarget(
  workspaceSlug: string,
  projectSlug: string,
): Promise<ProjectGenerationTargetBundle | null> {
  const queueItems = await listProjectBuilderRefreshQueue(workspaceSlug, projectSlug);
  const activeQueueItem = getActiveBuilderRefreshQueueItem(queueItems, "code");

  if (!activeQueueItem?.generationRunId) {
    return null;
  }

  return getProjectGenerationTargetBundle(workspaceSlug, projectSlug, activeQueueItem.generationRunId);
}

function reconcileCodeScaffoldRecords(
  visualBundle: ProjectVisualBundle,
  existing: CodeRecordSet,
  mode: CodeRefreshMode,
  targetFilePaths: string[] | null = null,
  targetScaffold: GeneratedCodeScaffold | null = null,
): CodeRecordSet {
  const scaffold =
    targetScaffold ??
    createCodeScaffold({
      visualBundle,
      existingState: existing.codeState,
    });
  const timestamp = nowIso();
  const targetFilePathSet = targetFilePaths ? new Set(targetFilePaths) : null;
  const existingFileByPath = new Map(existing.files.map((file) => [file.path, file]));
  const existingLinksByFileId = new Map<string, ProjectCodeFileLinkRecord[]>();
  const nextFiles: ProjectCodeFileRecord[] = [];
  const nextRevisions = [...existing.fileRevisions];
  const nextLinks: ProjectCodeFileLinkRecord[] = [];
  const changedFileIds = new Set<string>();
  let metadataTouched = false;
  let contentTouched = false;

  for (const link of existing.fileLinks) {
    const current = existingLinksByFileId.get(link.fileId) ?? [];
    current.push(link);
    existingLinksByFileId.set(link.fileId, current);
  }

  for (const scaffoldFile of scaffold.files) {
    if (targetFilePathSet && !targetFilePathSet.has(scaffoldFile.path)) {
      continue;
    }

    const scaffoldLinks = scaffold.fileLinks.filter((link) => link.fileId === scaffoldFile.id);
    const existingFile = existingFileByPath.get(scaffoldFile.path);

    if (!existingFile) {
      nextFiles.push(scaffoldFile);
      nextRevisions.push(
        ...scaffold.fileRevisions.filter((revision) => revision.fileId === scaffoldFile.id),
      );
      nextLinks.push(...scaffoldLinks);
      changedFileIds.add(scaffoldFile.id);
      metadataTouched = true;
      contentTouched = true;
      continue;
    }

    const existingFileRevisions = existing.fileRevisions.filter(
      (revision) => revision.fileId === existingFile.id,
    );
    const existingLinks = existingLinksByFileId.get(existingFile.id) ?? [];
    const mappedLinks = scaffoldLinks.map((link) => {
      const nextKey = buildLinkKey(link);
      const previous = existingLinks.find((item) => buildLinkKey(item) === nextKey);

      return {
        ...link,
        id: previous?.id ?? crypto.randomUUID(),
        fileId: existingFile.id,
        createdAt: previous?.createdAt ?? link.createdAt,
      };
    });
    const currentLinkKeys = existingLinks.map((link) => buildLinkKey(link)).sort();
    const nextLinkKeys = mappedLinks.map((link) => buildLinkKey(link)).sort();
    const manualChanges = hasSavedUserChanges(existingFile, existingFileRevisions);
    const shouldSyncContent =
      scaffoldLinks.length > 0 &&
      (scaffoldFile.ownership === "visual_owned"
        ? mode !== "metadata"
        : mode === "force" || (mode === "safe" && !manualChanges));
    const contentChanged = existingFile.content !== scaffoldFile.content;

    let nextFile: ProjectCodeFileRecord = {
      ...existingFile,
      codeStateId: existing.codeState.id,
      projectId: visualBundle.project.id,
      directory: scaffoldFile.directory,
      name: scaffoldFile.name,
      extension: scaffoldFile.extension,
      kind: scaffoldFile.kind,
      language: scaffoldFile.language,
      orderIndex: scaffoldFile.orderIndex,
      ownership: scaffoldFile.ownership,
      editPolicy: scaffoldFile.editPolicy,
      createdFromVisualPageId: scaffoldFile.createdFromVisualPageId,
      createdFromSectionId: scaffoldFile.createdFromSectionId,
      updatedAt: existingFile.updatedAt,
    };

    if (
      nextFile.directory !== existingFile.directory ||
      nextFile.name !== existingFile.name ||
      nextFile.extension !== existingFile.extension ||
      nextFile.kind !== existingFile.kind ||
      nextFile.language !== existingFile.language ||
      nextFile.orderIndex !== existingFile.orderIndex ||
      nextFile.ownership !== existingFile.ownership ||
      nextFile.editPolicy !== existingFile.editPolicy ||
      nextFile.createdFromVisualPageId !== existingFile.createdFromVisualPageId ||
      nextFile.createdFromSectionId !== existingFile.createdFromSectionId ||
      !sameSet(currentLinkKeys, nextLinkKeys)
    ) {
      changedFileIds.add(existingFile.id);
      metadataTouched = true;
      nextFile = {
        ...nextFile,
        updatedAt: timestamp,
      };
    }

    if (shouldSyncContent && contentChanged) {
      const revisionId = crypto.randomUUID();
      const nextRevisionNumber = existingFile.currentRevisionNumber + 1;
      const changeSummary =
        scaffoldFile.ownership === "visual_owned"
          ? "Refreshed visual-managed file from the current visual state."
          : manualChanges
            ? "Regenerated scaffold-owned file from the current visual state after explicit confirmation."
            : "Refreshed scaffold-owned file from the current visual state.";

      nextRevisions.push({
        id: revisionId,
        fileId: existingFile.id,
        projectId: existingFile.projectId,
        revisionNumber: nextRevisionNumber,
        kind: "synced",
        content: scaffoldFile.content,
        changeSummary,
        authoredBy: "system",
        baseRevisionId: existingFile.currentRevisionId,
        baseRevisionNumber: existingFile.currentRevisionNumber,
        sourceProposalId: null,
        sourceProposalTitle: null,
        restoreSource: null,
        restoredFromRevisionId: null,
        restoredFromRevisionNumber: null,
        createdAt: timestamp,
      });
      nextFile = {
        ...nextFile,
        content: scaffoldFile.content,
        currentRevisionId: revisionId,
        currentRevisionNumber: nextRevisionNumber,
        draftContent: shouldSyncContent ? null : existingFile.draftContent,
        draftUpdatedAt: shouldSyncContent ? null : existingFile.draftUpdatedAt,
        draftBaseRevisionId: shouldSyncContent ? null : existingFile.draftBaseRevisionId,
        draftBaseRevisionNumber: shouldSyncContent ? null : existingFile.draftBaseRevisionNumber,
        updatedAt: timestamp,
      };
      changedFileIds.add(existingFile.id);
      metadataTouched = true;
      contentTouched = true;
    }

    nextFiles.push(nextFile);
    nextLinks.push(...mappedLinks);
  }

  for (const file of existing.files) {
    if (nextFiles.some((item) => item.id === file.id)) {
      continue;
    }

    nextFiles.push(file);
    nextLinks.push(...(existingLinksByFileId.get(file.id) ?? []));
  }

  const nextFilePaths = new Set(nextFiles.map((file) => file.path));
  const activeFilePath = nextFilePaths.has(existing.codeState.activeFilePath)
    ? existing.codeState.activeFilePath
    : scaffold.codeState.activeFilePath;
  const openFilePaths = Array.from(
    new Set(
      [activeFilePath, ...existing.codeState.openFilePaths].filter((filePath) =>
        nextFilePaths.has(filePath),
      ),
    ),
  ).slice(0, 6);
  const nextStateBase: CodeWorkspaceStateRecord = {
    ...existing.codeState,
    activeFilePath,
    openFilePaths,
    scaffoldSourceRevisionNumber: scaffold.codeState.scaffoldSourceRevisionNumber,
    sourceVisualUpdatedAt: scaffold.codeState.sourceVisualUpdatedAt,
    updatedAt: metadataTouched ? timestamp : existing.codeState.updatedAt,
    lastGeneratedAt:
      contentTouched && mode !== "metadata" ? timestamp : existing.codeState.lastGeneratedAt,
  };
  const syncArtifacts = buildCodeSyncRecords(
    visualBundle,
    nextStateBase,
    nextFiles,
    nextRevisions,
    nextLinks,
    {
      files: scaffold.files,
      fileLinks: scaffold.fileLinks,
    },
  );
  const nextPatchProposals = markPatchProposalsStale(
    existing.patchProposals,
    buildInvalidationsFromFiles(
      nextFiles,
      Array.from(changedFileIds),
      "The linked scaffold changed before this patch proposal was applied.",
      timestamp,
    ),
  );

  return {
    codeState: {
      ...nextStateBase,
      manualChanges: syncArtifacts.syncState.hasManualChanges,
    },
    files: nextFiles,
    fileRevisions: nextRevisions,
    fileLinks: nextLinks,
    patchProposals: nextPatchProposals,
  };
}

function ensureEditable(file: ProjectCodeFileRecord) {
  if (file.editPolicy !== "single_file_draft") {
    throw new Error("This file is visual-managed and locked in Code Workspace V1.");
  }
}

function ensureCurrentRevision(file: ProjectCodeFileRecord, expectedRevisionNumber: number) {
  if (file.currentRevisionNumber !== expectedRevisionNumber) {
    throw new Error("The file changed since this screen was loaded. Refresh before saving.");
  }
}

function buildCodeBundle(
  visualBundle: ProjectVisualBundle,
  codeState: CodeWorkspaceStateRecord,
  files: ProjectCodeFileRecord[],
  fileRevisions: ProjectCodeFileRevisionRecord[],
  fileLinks: ProjectCodeFileLinkRecord[],
  patchProposals: ProjectCodePatchProposalRecord[],
  targetScaffold: GeneratedCodeScaffold | null = null,
): ProjectCodeBundle {
  const codeFiles = sortFiles(files);
  const codeFileIdByPath = new Map(codeFiles.map((file) => [file.path, file.id]));
  const validOpenFiles = codeState.openFilePaths.filter((path) =>
    codeFiles.some((file) => file.path === path),
  );
  const reconciledPatchProposals = reconcilePatchProposals(codeFiles, patchProposals, nowIso());
  const syncArtifacts = buildCodeSyncRecords(
    visualBundle,
    {
      ...codeState,
      openFilePaths: validOpenFiles,
    },
    codeFiles,
    fileRevisions,
    fileLinks,
    targetScaffold
      ? {
          files: targetScaffold.files,
          fileLinks: targetScaffold.fileLinks,
        }
      : null,
  );
  const candidateSourceRevisionNumber =
    targetScaffold?.codeState.scaffoldSourceRevisionNumber ?? visualBundle.visualState.scaffoldSourceRevisionNumber;
  const candidateSourceVisualUpdatedAt =
    targetScaffold?.codeState.sourceVisualUpdatedAt ?? visualBundle.visualState.updatedAt;

  return {
    workspace: visualBundle.workspace,
    project: visualBundle.project,
    latestRevision: visualBundle.latestRevision,
    currentUser: visualBundle.currentUser,
    membership: visualBundle.membership,
    workspacePermissions: visualBundle.workspacePermissions,
    projectPermissions: visualBundle.projectPermissions,
    revisions: visualBundle.revisions,
    sourceRevision: visualBundle.sourceRevision,
    visualState: visualBundle.visualState,
    visualPages: visualBundle.visualPages,
    visualSections: visualBundle.visualSections,
    visualSyncState: visualBundle.syncState,
    codeState,
    files: codeFiles,
    fileRevisions: sortFileRevisions(fileRevisions),
    fileLinks: sortFileLinks(fileLinks),
    patchProposals: sortPatchProposals(reconciledPatchProposals),
    refreshCandidates: syncArtifacts.candidateFiles.map((file) => ({
      fileId: codeFileIdByPath.get(file.path) ?? file.id,
      path: file.path,
      content: file.content,
      sourceRevisionNumber: candidateSourceRevisionNumber,
      sourceVisualUpdatedAt: candidateSourceVisualUpdatedAt,
    })),
    fileSyncRecords: syncArtifacts.syncRecords,
    codeSyncState: syncArtifacts.syncState,
  };
}

function patchProposalNeedsPersistenceUpdate(
  left: ProjectCodePatchProposalRecord,
  right: ProjectCodePatchProposalRecord,
) {
  return (
    left.status !== right.status ||
    left.resolvedRevisionId !== right.resolvedRevisionId ||
    left.invalidatedByRevisionId !== right.invalidatedByRevisionId ||
    left.invalidatedByRevisionNumber !== right.invalidatedByRevisionNumber ||
    left.resolutionNote !== right.resolutionNote ||
    left.resolvedAt !== right.resolvedAt ||
    left.archivedAt !== right.archivedAt ||
    left.archiveReason !== right.archiveReason
  );
}

function reconcileLoadedPatchProposals(records: CodeRecordSet) {
  const reconciledPatchProposals = reconcilePatchProposals(
    records.files,
    records.patchProposals,
    nowIso(),
  );
  const previousProposalById = new Map(records.patchProposals.map((proposal) => [proposal.id, proposal]));

  const changed = reconciledPatchProposals.some((proposal) => {
    const previous = previousProposalById.get(proposal.id);
    return previous ? patchProposalNeedsPersistenceUpdate(previous, proposal) : true;
  });

  if (!changed) {
    return {
      changed: false,
      records,
    };
  }

  return {
    changed: true,
    records: {
      ...records,
      patchProposals: reconciledPatchProposals,
    },
  };
}

async function touchProjectLocal(projectId: string, timestamp: string) {
  const store = await readLocalStore();
  const index = store.projects.findIndex((project) => project.id === projectId);

  if (index === -1) {
    return;
  }

  store.projects[index] = {
    ...store.projects[index],
    updatedAt: timestamp,
  };

  await writeLocalStore(store);
}

async function getCodeRecordsLocal(projectId: string) {
  const store = await readLocalStore();
  const codeState = store.codeStates.find((state) => state.projectId === projectId) ?? null;

  if (!codeState) {
    return null;
  }

  return {
    codeState,
    files: store.projectFiles.filter((file) => file.projectId === projectId),
    fileRevisions: store.projectFileRevisions.filter((revision) => revision.projectId === projectId),
    fileLinks: store.projectFileLinks.filter((link) => link.projectId === projectId),
    patchProposals: store.projectPatchProposals.filter((proposal) => proposal.projectId === projectId),
  };
}

async function reconcileLoadedPatchProposalsLocal(records: CodeRecordSet) {
  const reconciled = reconcileLoadedPatchProposals(records);

  if (!reconciled.changed) {
    return records;
  }

  const store = await readLocalStore();
  store.projectPatchProposals = [
    ...store.projectPatchProposals.filter((proposal) => proposal.projectId !== records.codeState.projectId),
    ...reconciled.records.patchProposals,
  ];
  await writeLocalStore(store);

  return reconciled.records;
}

async function replaceCodeScaffoldLocal(
  visualBundle: ProjectVisualBundle,
  targetScaffold: GeneratedCodeScaffold | null = null,
) {
  const store = await readLocalStore();
  const existingState = store.codeStates.find((state) => state.projectId === visualBundle.project.id) ?? null;
  const scaffold =
    targetScaffold ??
    createCodeScaffold({
      visualBundle,
      existingState,
    });

  store.codeStates = [
    scaffold.codeState,
    ...store.codeStates.filter((state) => state.projectId !== visualBundle.project.id),
  ];
  store.projectFiles = [
    ...store.projectFiles.filter((file) => file.projectId !== visualBundle.project.id),
    ...scaffold.files,
  ];
  store.projectFileRevisions = [
    ...store.projectFileRevisions.filter((revision) => revision.projectId !== visualBundle.project.id),
    ...scaffold.fileRevisions,
  ];
  store.projectFileLinks = [
    ...store.projectFileLinks.filter((link) => link.projectId !== visualBundle.project.id),
    ...scaffold.fileLinks,
  ];
  store.projectPatchProposals = store.projectPatchProposals.filter(
    (proposal) => proposal.projectId !== visualBundle.project.id,
  );

  await writeLocalStore(store);

  return {
    ...scaffold,
    patchProposals: [],
  };
}

async function persistCodeRecordsLocal(records: CodeRecordSet) {
  const store = await readLocalStore();
  const previousFiles = store.projectFiles.filter((file) => file.projectId === records.codeState.projectId);
  const changedFileIds = previousFiles
    .filter((file) => {
      const nextFile = records.files.find((item) => item.id === file.id);

      if (!nextFile) {
        return true;
      }

      return (
        file.content !== nextFile.content ||
        file.draftContent !== nextFile.draftContent ||
        file.currentRevisionId !== nextFile.currentRevisionId ||
        file.currentRevisionNumber !== nextFile.currentRevisionNumber
      );
    })
    .map((file) => file.id);
  const nextPatchProposals = markPatchProposalsStale(
    records.patchProposals,
    buildInvalidationsFromFiles(
      records.files,
      changedFileIds,
      "The source file changed after this patch proposal was created.",
      records.codeState.updatedAt,
    ),
  );

  store.codeStates = [
    records.codeState,
    ...store.codeStates.filter((state) => state.projectId !== records.codeState.projectId),
  ];
  store.projectFiles = [
    ...store.projectFiles.filter((file) => file.projectId !== records.codeState.projectId),
    ...records.files,
  ];
  store.projectFileRevisions = [
    ...store.projectFileRevisions.filter((revision) => revision.projectId !== records.codeState.projectId),
    ...records.fileRevisions,
  ];
  store.projectFileLinks = [
    ...store.projectFileLinks.filter((link) => link.projectId !== records.codeState.projectId),
    ...records.fileLinks,
  ];
  store.projectPatchProposals = [
    ...store.projectPatchProposals.filter(
      (proposal) => proposal.projectId !== records.codeState.projectId,
    ),
    ...nextPatchProposals,
  ];

  await writeLocalStore(store);
}

async function refreshCodeScaffoldLocal(
  visualBundle: ProjectVisualBundle,
  mode: CodeRefreshMode,
  filePath: string | null = null,
  targetScaffold: GeneratedCodeScaffold | null = null,
) {
  const existing = await getCodeRecordsLocal(visualBundle.project.id);

  if (!existing) {
    return replaceCodeScaffoldLocal(visualBundle, targetScaffold);
  }

  const next = reconcileCodeScaffoldRecords(
    visualBundle,
    existing,
    mode,
    filePath ? [filePath] : null,
    targetScaffold,
  );
  await persistCodeRecordsLocal(next);
  await touchProjectLocal(visualBundle.project.id, next.codeState.updatedAt);

  return next;
}

async function updateCodeFileDraftLocal(input: UpdateCodeFileDraftInput) {
  const store = await readLocalStore();
  const fileIndex = store.projectFiles.findIndex((file) => file.id === input.fileId);
  const stateIndex = store.codeStates.findIndex((state) => state.id === input.codeStateId);

  if (fileIndex === -1 || stateIndex === -1) {
    throw new Error("Code file not found.");
  }

  const file = store.projectFiles[fileIndex];
  ensureEditable(file);
  ensureCurrentRevision(file, input.expectedRevisionNumber);

  const timestamp = nowIso();

  store.projectFiles[fileIndex] = {
    ...file,
    draftContent: input.content,
    draftUpdatedAt: timestamp,
    draftBaseRevisionId: file.currentRevisionId,
    draftBaseRevisionNumber: file.currentRevisionNumber,
    updatedAt: timestamp,
  };

  store.codeStates[stateIndex] = {
    ...store.codeStates[stateIndex],
    activeFilePath: input.filePath,
    openFilePaths: mergeOpenFilePaths(store.codeStates[stateIndex], input.filePath),
    manualChanges: true,
    updatedAt: timestamp,
  };
  store.projectPatchProposals = markPatchProposalsStale(
    store.projectPatchProposals,
    [
      {
        fileId: file.id,
        note: "The source file changed after this patch proposal was created.",
        timestamp,
      },
    ],
  );

  await writeLocalStore(store);
  await touchProjectLocal(file.projectId, timestamp);
}

async function saveCodeFileRevisionLocal(input: SaveCodeFileRevisionInput) {
  const store = await readLocalStore();
  const fileIndex = store.projectFiles.findIndex((file) => file.id === input.fileId);
  const stateIndex = store.codeStates.findIndex((state) => state.id === input.codeStateId);

  if (fileIndex === -1 || stateIndex === -1) {
    throw new Error("Code file not found.");
  }

  const file = store.projectFiles[fileIndex];
  ensureEditable(file);
  ensureCurrentRevision(file, input.expectedRevisionNumber);

  const timestamp = nowIso();
  const revisionId = crypto.randomUUID();
  const nextRevisionNumber = file.currentRevisionNumber + 1;
  const normalizedSummary = input.changeSummary.trim() || "Updated file in Code Workspace.";

  const revision: ProjectCodeFileRevisionRecord = {
    id: revisionId,
    fileId: file.id,
    projectId: file.projectId,
    revisionNumber: nextRevisionNumber,
    kind: "saved",
    content: input.content,
    changeSummary: normalizedSummary,
    authoredBy: "user",
    baseRevisionId: file.currentRevisionId,
    baseRevisionNumber: file.currentRevisionNumber,
    sourceProposalId: null,
    sourceProposalTitle: null,
    restoreSource: null,
    restoredFromRevisionId: null,
    restoredFromRevisionNumber: null,
    createdAt: timestamp,
  };

  store.projectFiles[fileIndex] = {
    ...file,
    content: input.content,
    currentRevisionId: revisionId,
    currentRevisionNumber: nextRevisionNumber,
    draftContent: null,
    draftUpdatedAt: null,
    draftBaseRevisionId: null,
    draftBaseRevisionNumber: null,
    updatedAt: timestamp,
  };
  store.projectFileRevisions = [revision, ...store.projectFileRevisions];
  store.codeStates[stateIndex] = {
    ...store.codeStates[stateIndex],
    activeFilePath: input.filePath,
    openFilePaths: mergeOpenFilePaths(store.codeStates[stateIndex], input.filePath),
    manualChanges: true,
    updatedAt: timestamp,
  };
  store.projectPatchProposals = markPatchProposalsStale(
    store.projectPatchProposals,
    [
      {
        fileId: file.id,
        note: "The source file changed after this patch proposal was created.",
        timestamp,
        invalidatedByRevisionId: revisionId,
        invalidatedByRevisionNumber: nextRevisionNumber,
      },
    ],
  );

  await writeLocalStore(store);
  await touchProjectLocal(file.projectId, timestamp);
}

async function getCodeRecordsSupabase(projectId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return null;
  }

  const { data: stateRow, error: stateError } = await client
    .from("project_code_states")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (stateError) {
    throw new Error(stateError.message);
  }

  if (!stateRow) {
    return null;
  }

  const [
    { data: files, error: filesError },
    { data: revisions, error: revisionsError },
    { data: links, error: linksError },
    { data: proposals, error: proposalsError },
  ] = await Promise.all([
    client
      .from("project_code_files")
      .select("*")
      .eq("project_id", projectId)
      .order("order_index", { ascending: true }),
    client
      .from("project_code_file_revisions")
      .select("*")
      .eq("project_id", projectId)
      .order("revision_number", { ascending: false }),
    client
      .from("project_code_file_links")
      .select("*")
      .eq("project_id", projectId),
    client
      .from("project_code_patch_proposals")
      .select("*")
      .eq("project_id", projectId),
  ]);

  if (filesError) {
    throw new Error(filesError.message);
  }

  if (revisionsError) {
    throw new Error(revisionsError.message);
  }

  if (linksError) {
    throw new Error(linksError.message);
  }

  if (proposalsError) {
    throw new Error(proposalsError.message);
  }

  return {
    codeState: mapCodeStateRow(stateRow as unknown as Record<string, unknown>),
    files: (files ?? []).map((row) => mapCodeFileRow(row as unknown as Record<string, unknown>)),
    fileRevisions: (revisions ?? []).map((row) =>
      mapCodeFileRevisionRow(row as unknown as Record<string, unknown>),
    ),
    fileLinks: (links ?? []).map((row) => mapCodeFileLinkRow(row as unknown as Record<string, unknown>)),
    patchProposals: (proposals ?? []).map((row) =>
      mapCodePatchProposalRow(row as unknown as Record<string, unknown>),
    ),
  };
}

async function reconcileLoadedPatchProposalsSupabase(records: CodeRecordSet) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const reconciled = reconcileLoadedPatchProposals(records);

  if (!reconciled.changed) {
    return records;
  }

  const previousProposalById = new Map(records.patchProposals.map((proposal) => [proposal.id, proposal]));
  const updates = reconciled.records.patchProposals.filter((proposal) =>
    patchProposalNeedsPersistenceUpdate(previousProposalById.get(proposal.id) ?? proposal, proposal),
  );

  await Promise.all(
    updates.map(async (proposal) => {
      const { error } = await client
        .from("project_code_patch_proposals")
        .update({
          status: proposal.status,
          resolved_revision_id: proposal.resolvedRevisionId,
          invalidated_by_revision_id: proposal.invalidatedByRevisionId,
          invalidated_by_revision_number: proposal.invalidatedByRevisionNumber,
          resolution_note: proposal.resolutionNote,
          resolved_at: proposal.resolvedAt,
        })
        .eq("id", proposal.id);

      if (error) {
        throw new Error(error.message);
      }
    }),
  );

  return reconciled.records;
}

async function replaceCodeScaffoldSupabase(
  visualBundle: ProjectVisualBundle,
  targetScaffold: GeneratedCodeScaffold | null = null,
) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const existing = await getCodeRecordsSupabase(visualBundle.project.id);
  const scaffold =
    targetScaffold ??
    createCodeScaffold({
      visualBundle,
      existingState: existing?.codeState ?? null,
    });

  if (existing?.codeState) {
    const { error: deleteLinksError } = await client
      .from("project_code_file_links")
      .delete()
      .eq("project_id", visualBundle.project.id);

    if (deleteLinksError) {
      throw new Error(deleteLinksError.message);
    }

    const { error: deleteFilesError } = await client
      .from("project_code_files")
      .delete()
      .eq("project_id", visualBundle.project.id);

    if (deleteFilesError) {
      throw new Error(deleteFilesError.message);
    }

    const { error: deleteProposalError } = await client
      .from("project_code_patch_proposals")
      .delete()
      .eq("project_id", visualBundle.project.id);

    if (deleteProposalError) {
      throw new Error(deleteProposalError.message);
    }

    const { error: updateStateError } = await client
      .from("project_code_states")
      .update({
        active_file_path: scaffold.codeState.activeFilePath,
        open_file_paths: scaffold.codeState.openFilePaths,
        scaffold_source_revision_number: scaffold.codeState.scaffoldSourceRevisionNumber,
        source_visual_updated_at: scaffold.codeState.sourceVisualUpdatedAt,
        manual_changes: scaffold.codeState.manualChanges,
        last_generated_at: scaffold.codeState.lastGeneratedAt,
        updated_at: scaffold.codeState.updatedAt,
      })
      .eq("id", scaffold.codeState.id);

    if (updateStateError) {
      throw new Error(updateStateError.message);
    }
  } else {
    const { error: createStateError } = await client
      .from("project_code_states")
      .insert({
        id: scaffold.codeState.id,
        project_id: scaffold.codeState.projectId,
        active_file_path: scaffold.codeState.activeFilePath,
        open_file_paths: scaffold.codeState.openFilePaths,
        scaffold_source_revision_number: scaffold.codeState.scaffoldSourceRevisionNumber,
        source_visual_updated_at: scaffold.codeState.sourceVisualUpdatedAt,
        manual_changes: scaffold.codeState.manualChanges,
        last_generated_at: scaffold.codeState.lastGeneratedAt,
        created_at: scaffold.codeState.createdAt,
        updated_at: scaffold.codeState.updatedAt,
      });

    if (createStateError) {
      throw new Error(createStateError.message);
    }
  }

  const { error: createFilesError } = await client.from("project_code_files").insert(
    scaffold.files.map((file) => ({
      id: file.id,
      code_state_id: file.codeStateId,
      project_id: file.projectId,
      path: file.path,
      directory: file.directory,
      name: file.name,
      extension: file.extension,
      file_kind: file.kind,
      language: file.language,
      order_index: file.orderIndex,
      ownership: file.ownership,
      edit_policy: file.editPolicy,
      content: file.content,
      current_revision_id: file.currentRevisionId,
      current_revision_number: file.currentRevisionNumber,
      draft_content: file.draftContent,
      draft_updated_at: file.draftUpdatedAt,
      draft_base_revision_id: file.draftBaseRevisionId,
      draft_base_revision_number: file.draftBaseRevisionNumber,
      created_from_visual_page_id: file.createdFromVisualPageId,
      created_from_section_id: file.createdFromSectionId,
      created_at: file.createdAt,
      updated_at: file.updatedAt,
    })),
  );

  if (createFilesError) {
    throw new Error(createFilesError.message);
  }

  const { error: createLinksError } = await client.from("project_code_file_links").insert(
    scaffold.fileLinks.map((link) => ({
      id: link.id,
      file_id: link.fileId,
      project_id: link.projectId,
      visual_state_id: link.visualStateId,
      target_type: link.targetType,
      role: link.role,
      visual_page_id: link.visualPageId,
      visual_section_id: link.visualSectionId,
      target_label: link.targetLabel,
      created_at: link.createdAt,
    })),
  );

  if (createLinksError) {
    throw new Error(createLinksError.message);
  }

  const { error: createRevisionsError } = await client.from("project_code_file_revisions").insert(
    scaffold.fileRevisions.map((revision) => ({
      id: revision.id,
      file_id: revision.fileId,
      project_id: revision.projectId,
      revision_number: revision.revisionNumber,
      kind: revision.kind,
      content: revision.content,
      change_summary: revision.changeSummary,
      authored_by: revision.authoredBy,
      base_revision_id: revision.baseRevisionId,
      base_revision_number: revision.baseRevisionNumber,
      source_proposal_id: revision.sourceProposalId,
      source_proposal_title: revision.sourceProposalTitle,
      restore_source: revision.restoreSource,
      restored_from_revision_id: revision.restoredFromRevisionId,
      restored_from_revision_number: revision.restoredFromRevisionNumber,
      created_at: revision.createdAt,
    })),
  );

  if (createRevisionsError) {
    throw new Error(createRevisionsError.message);
  }

  return {
    ...scaffold,
    patchProposals: [],
  };
}

async function persistCodeRecordsSupabase(records: CodeRecordSet) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const existing = await getCodeRecordsSupabase(records.codeState.projectId);
  const changedFileIds = (existing?.files ?? [])
    .filter((file) => {
      const nextFile = records.files.find((item) => item.id === file.id);

      if (!nextFile) {
        return true;
      }

      return (
        file.content !== nextFile.content ||
        file.draftContent !== nextFile.draftContent ||
        file.currentRevisionId !== nextFile.currentRevisionId ||
        file.currentRevisionNumber !== nextFile.currentRevisionNumber
      );
    })
    .map((file) => file.id);
  const nextPatchProposals = markPatchProposalsStale(
    records.patchProposals,
    buildInvalidationsFromFiles(
      records.files,
      changedFileIds,
      "The source file changed after this patch proposal was created.",
      records.codeState.updatedAt,
    ),
  );

  if (existing?.codeState) {
    const { error: deleteLinksError } = await client
      .from("project_code_file_links")
      .delete()
      .eq("project_id", records.codeState.projectId);

    if (deleteLinksError) {
      throw new Error(deleteLinksError.message);
    }

    const { error: deleteFilesError } = await client
      .from("project_code_files")
      .delete()
      .eq("project_id", records.codeState.projectId);

    if (deleteFilesError) {
      throw new Error(deleteFilesError.message);
    }

    const { error: deleteProposalError } = await client
      .from("project_code_patch_proposals")
      .delete()
      .eq("project_id", records.codeState.projectId);

    if (deleteProposalError) {
      throw new Error(deleteProposalError.message);
    }

    const { error: updateStateError } = await client
      .from("project_code_states")
      .update({
        active_file_path: records.codeState.activeFilePath,
        open_file_paths: records.codeState.openFilePaths,
        scaffold_source_revision_number: records.codeState.scaffoldSourceRevisionNumber,
        source_visual_updated_at: records.codeState.sourceVisualUpdatedAt,
        manual_changes: records.codeState.manualChanges,
        last_generated_at: records.codeState.lastGeneratedAt,
        updated_at: records.codeState.updatedAt,
      })
      .eq("id", records.codeState.id);

    if (updateStateError) {
      throw new Error(updateStateError.message);
    }
  } else {
    const { error: createStateError } = await client
      .from("project_code_states")
      .insert({
        id: records.codeState.id,
        project_id: records.codeState.projectId,
        active_file_path: records.codeState.activeFilePath,
        open_file_paths: records.codeState.openFilePaths,
        scaffold_source_revision_number: records.codeState.scaffoldSourceRevisionNumber,
        source_visual_updated_at: records.codeState.sourceVisualUpdatedAt,
        manual_changes: records.codeState.manualChanges,
        last_generated_at: records.codeState.lastGeneratedAt,
        created_at: records.codeState.createdAt,
        updated_at: records.codeState.updatedAt,
      });

    if (createStateError) {
      throw new Error(createStateError.message);
    }
  }

  const { error: createFilesError } = await client.from("project_code_files").insert(
    records.files.map((file) => ({
      id: file.id,
      code_state_id: file.codeStateId,
      project_id: file.projectId,
      path: file.path,
      directory: file.directory,
      name: file.name,
      extension: file.extension,
      file_kind: file.kind,
      language: file.language,
      order_index: file.orderIndex,
      ownership: file.ownership,
      edit_policy: file.editPolicy,
      content: file.content,
      current_revision_id: file.currentRevisionId,
      current_revision_number: file.currentRevisionNumber,
      draft_content: file.draftContent,
      draft_updated_at: file.draftUpdatedAt,
      draft_base_revision_id: file.draftBaseRevisionId,
      draft_base_revision_number: file.draftBaseRevisionNumber,
      created_from_visual_page_id: file.createdFromVisualPageId,
      created_from_section_id: file.createdFromSectionId,
      created_at: file.createdAt,
      updated_at: file.updatedAt,
    })),
  );

  if (createFilesError) {
    throw new Error(createFilesError.message);
  }

  const { error: createLinksError } = await client.from("project_code_file_links").insert(
    records.fileLinks.map((link) => ({
      id: link.id,
      file_id: link.fileId,
      project_id: link.projectId,
      visual_state_id: link.visualStateId,
      target_type: link.targetType,
      role: link.role,
      visual_page_id: link.visualPageId,
      visual_section_id: link.visualSectionId,
      target_label: link.targetLabel,
      created_at: link.createdAt,
    })),
  );

  if (createLinksError) {
    throw new Error(createLinksError.message);
  }

  const { error: createRevisionsError } = await client.from("project_code_file_revisions").insert(
    records.fileRevisions.map((revision) => ({
      id: revision.id,
      file_id: revision.fileId,
      project_id: revision.projectId,
      revision_number: revision.revisionNumber,
      kind: revision.kind,
      content: revision.content,
      change_summary: revision.changeSummary,
      authored_by: revision.authoredBy,
      base_revision_id: revision.baseRevisionId,
      base_revision_number: revision.baseRevisionNumber,
      source_proposal_id: revision.sourceProposalId,
      source_proposal_title: revision.sourceProposalTitle,
      restore_source: revision.restoreSource,
      restored_from_revision_id: revision.restoredFromRevisionId,
      restored_from_revision_number: revision.restoredFromRevisionNumber,
      created_at: revision.createdAt,
    })),
  );

  if (createRevisionsError) {
    throw new Error(createRevisionsError.message);
  }

  if (records.patchProposals.length > 0) {
    const { error: createProposalsError } = await client.from("project_code_patch_proposals").insert(
      nextPatchProposals.map((proposal) => ({
        id: proposal.id,
        code_state_id: proposal.codeStateId,
        file_id: proposal.fileId,
        project_id: proposal.projectId,
        file_path: proposal.filePath,
        title: proposal.title,
        request_prompt: proposal.requestPrompt,
        rationale: proposal.rationale,
        change_summary: proposal.changeSummary,
        status: proposal.status,
        source: proposal.source,
        base_revision_id: proposal.baseRevisionId,
        base_revision_number: proposal.baseRevisionNumber,
        base_content: proposal.baseContent,
        proposed_content: proposal.proposedContent,
        resolved_revision_id: proposal.resolvedRevisionId,
        invalidated_by_revision_id: proposal.invalidatedByRevisionId,
        invalidated_by_revision_number: proposal.invalidatedByRevisionNumber,
        resolution_note: proposal.resolutionNote,
        created_at: proposal.createdAt,
        resolved_at: proposal.resolvedAt,
      })),
    );

    if (createProposalsError) {
      throw new Error(createProposalsError.message);
    }
  }
}

async function refreshCodeScaffoldSupabase(
  visualBundle: ProjectVisualBundle,
  mode: CodeRefreshMode,
  filePath: string | null = null,
  targetScaffold: GeneratedCodeScaffold | null = null,
) {
  const existing = await getCodeRecordsSupabase(visualBundle.project.id);

  if (!existing) {
    return replaceCodeScaffoldSupabase(visualBundle, targetScaffold);
  }

  const next = reconcileCodeScaffoldRecords(
    visualBundle,
    existing,
    mode,
    filePath ? [filePath] : null,
    targetScaffold,
  );
  await persistCodeRecordsSupabase(next);

  const client = createSupabaseServerClient();

  if (client) {
    const { error: touchProjectError } = await client
      .from("projects")
      .update({ updated_at: next.codeState.updatedAt })
      .eq("id", visualBundle.project.id);

    if (touchProjectError) {
      throw new Error(touchProjectError.message);
    }
  }

  return next;
}

async function updateCodeFileDraftSupabase(input: UpdateCodeFileDraftInput) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data: fileRow, error: fileError } = await client
    .from("project_code_files")
    .select("*")
    .eq("id", input.fileId)
    .single();

  if (fileError) {
    throw new Error(fileError.message);
  }

  const file = mapCodeFileRow(fileRow as unknown as Record<string, unknown>);
  ensureEditable(file);
  ensureCurrentRevision(file, input.expectedRevisionNumber);

  const { data: stateRow, error: stateError } = await client
    .from("project_code_states")
    .select("*")
    .eq("id", input.codeStateId)
    .single();

  if (stateError) {
    throw new Error(stateError.message);
  }

  const codeState = mapCodeStateRow(stateRow as unknown as Record<string, unknown>);
  const timestamp = nowIso();

  const [
    { error: updateFileError },
    { error: updateStateError },
    { error: touchProjectError },
    { error: staleProposalError },
  ] = await Promise.all([
    client
      .from("project_code_files")
      .update({
        draft_content: input.content,
        draft_updated_at: timestamp,
        draft_base_revision_id: file.currentRevisionId,
        draft_base_revision_number: file.currentRevisionNumber,
        updated_at: timestamp,
      })
      .eq("id", input.fileId),
    client
      .from("project_code_states")
      .update({
        active_file_path: input.filePath,
        open_file_paths: mergeOpenFilePaths(codeState, input.filePath),
        manual_changes: true,
        updated_at: timestamp,
      })
      .eq("id", input.codeStateId),
    client
      .from("projects")
      .update({ updated_at: timestamp })
      .eq("id", file.projectId),
    client
      .from("project_code_patch_proposals")
      .update({
        status: "stale",
        invalidated_by_revision_id: null,
        invalidated_by_revision_number: null,
        resolution_note: "The source file changed after this patch proposal was created.",
        resolved_at: timestamp,
      })
      .eq("file_id", file.id)
      .eq("status", "pending"),
  ]);

  if (updateFileError) {
    throw new Error(updateFileError.message);
  }

  if (updateStateError) {
    throw new Error(updateStateError.message);
  }

  if (touchProjectError) {
    throw new Error(touchProjectError.message);
  }

  if (staleProposalError) {
    throw new Error(staleProposalError.message);
  }
}

async function saveCodeFileRevisionSupabase(input: SaveCodeFileRevisionInput) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const [{ data: fileRow, error: fileError }, { data: stateRow, error: stateError }] = await Promise.all([
    client.from("project_code_files").select("*").eq("id", input.fileId).single(),
    client.from("project_code_states").select("*").eq("id", input.codeStateId).single(),
  ]);

  if (fileError) {
    throw new Error(fileError.message);
  }

  if (stateError) {
    throw new Error(stateError.message);
  }

  const file = mapCodeFileRow(fileRow as unknown as Record<string, unknown>);
  const codeState = mapCodeStateRow(stateRow as unknown as Record<string, unknown>);
  ensureEditable(file);
  ensureCurrentRevision(file, input.expectedRevisionNumber);

  const timestamp = nowIso();
  const revisionId = crypto.randomUUID();
  const nextRevisionNumber = file.currentRevisionNumber + 1;
  const normalizedSummary = input.changeSummary.trim() || "Updated file in Code Workspace.";

  const [
    { error: createRevisionError },
    { error: updateFileError },
    { error: updateStateError },
    { error: touchProjectError },
    { error: staleProposalError },
  ] = await Promise.all([
    client.from("project_code_file_revisions").insert({
      id: revisionId,
      file_id: file.id,
      project_id: file.projectId,
      revision_number: nextRevisionNumber,
      kind: "saved",
      content: input.content,
      change_summary: normalizedSummary,
      authored_by: "user",
      base_revision_id: file.currentRevisionId,
      base_revision_number: file.currentRevisionNumber,
      source_proposal_id: null,
      source_proposal_title: null,
      restore_source: null,
      restored_from_revision_id: null,
      restored_from_revision_number: null,
      created_at: timestamp,
    }),
    client
      .from("project_code_files")
      .update({
        content: input.content,
        current_revision_id: revisionId,
        current_revision_number: nextRevisionNumber,
        draft_content: null,
        draft_updated_at: null,
        draft_base_revision_id: null,
        draft_base_revision_number: null,
        updated_at: timestamp,
      })
      .eq("id", input.fileId),
    client
      .from("project_code_states")
      .update({
        active_file_path: input.filePath,
        open_file_paths: mergeOpenFilePaths(codeState, input.filePath),
        manual_changes: true,
        updated_at: timestamp,
      })
      .eq("id", input.codeStateId),
    client
      .from("projects")
      .update({ updated_at: timestamp })
      .eq("id", file.projectId),
    client
      .from("project_code_patch_proposals")
      .update({
        status: "stale",
        invalidated_by_revision_id: revisionId,
        invalidated_by_revision_number: nextRevisionNumber,
        resolution_note: "The source file changed after this patch proposal was created.",
        resolved_at: timestamp,
      })
      .eq("file_id", file.id)
      .eq("status", "pending"),
  ]);

  if (createRevisionError) {
    throw new Error(createRevisionError.message);
  }

  if (updateFileError) {
    throw new Error(updateFileError.message);
  }

  if (updateStateError) {
    throw new Error(updateStateError.message);
  }

  if (touchProjectError) {
    throw new Error(touchProjectError.message);
  }

  if (staleProposalError) {
    throw new Error(staleProposalError.message);
  }
}

function ensurePatchPrompt(requestPrompt: string) {
  const normalized = requestPrompt.replace(/\s+/g, " ").trim();

  if (normalized.length < 8) {
    throw new Error("Add a more specific patch request before generating a proposal.");
  }

  return normalized;
}

function ensurePatchableFile(bundle: ProjectCodeBundle, filePath: string) {
  const file = bundle.files.find((entry) => entry.path === filePath);

  if (!file) {
    throw new Error("Code file not found.");
  }

  ensureEditable(file);

  const syncRecord = bundle.fileSyncRecords.find((record) => record.fileId === file.id) ?? null;

  if (syncRecord?.needsSync) {
    throw new Error("Refresh the scaffold for this file before requesting or applying a patch.");
  }

  return {
    file,
    syncRecord,
    workingContent: workingContentForFile(file),
  };
}

function resolvePatchProposal(
  bundle: ProjectCodeBundle,
  proposalId: string,
) {
  const proposal = bundle.patchProposals.find((entry) => entry.id === proposalId);

  if (!proposal) {
    throw new Error("Patch proposal not found.");
  }

  const file = bundle.files.find((entry) => entry.id === proposal.fileId);

  if (!file) {
    throw new Error("The target file for this patch proposal no longer exists.");
  }

  const syncRecord = bundle.fileSyncRecords.find((record) => record.fileId === file.id) ?? null;

  return {
    proposal,
    file,
    syncRecord,
    workingContent: workingContentForFile(file),
  };
}

function defaultArchiveReason(status: ProjectCodePatchProposalRecord["status"]) {
  if (status === "applied") {
    return "Archived after the applied proposal was reviewed and kept for audit history.";
  }

  if (status === "rejected") {
    return "Archived after the rejected proposal was reviewed and kept for audit history.";
  }

  return "Archived after the stale proposal was reviewed and kept for audit history.";
}

function resolveRestoreTarget(
  bundle: ProjectCodeBundle,
  input: Pick<RestoreCodeFileRevisionInput, "filePath" | "targetType" | "targetRevisionId">,
) {
  const file = bundle.files.find((entry) => entry.path === input.filePath);

  if (!file) {
    throw new Error("Code file not found.");
  }

  ensureEditable(file);

  if (input.targetType === "scaffold") {
    const refreshCandidate =
      bundle.refreshCandidates.find((candidate) => candidate.path === file.path) ?? null;

    if (!refreshCandidate) {
      throw new Error("No scaffold restore target is available for this file.");
    }

    return {
      file,
      targetType: "scaffold" as const,
      targetRevision: null,
      targetContent: refreshCandidate.content,
      targetLabel: "current scaffold",
      targetRevisionNumber: refreshCandidate.sourceRevisionNumber,
    };
  }

  const targetRevision = bundle.fileRevisions.find(
    (revision) => revision.fileId === file.id && revision.id === input.targetRevisionId,
  );

  if (!targetRevision) {
    throw new Error("The selected restore revision could not be found.");
  }

  return {
    file,
    targetType: "revision" as const,
    targetRevision,
    targetContent: targetRevision.content,
    targetLabel: `revision ${targetRevision.revisionNumber}`,
    targetRevisionNumber: targetRevision.revisionNumber,
  };
}

function ensureArchivableProposal(proposal: ProjectCodePatchProposalRecord) {
  if (proposal.status === "pending") {
    throw new Error("Pending proposals must be reviewed before they can be archived.");
  }

  if (proposal.archivedAt) {
    throw new Error("This proposal is already archived.");
  }
}

async function createCodePatchProposalLocal(
  bundle: ProjectCodeBundle,
  filePath: string,
  requestPrompt: string,
  requestedSelectionOverride: CreateCodePatchProposalInput["requestedSelectionOverride"],
  retryOfRunId: string | null,
) {
  const store = await readLocalStore();
  const { file, workingContent } = ensurePatchableFile(bundle, filePath);
  const normalizedPrompt = ensurePatchPrompt(requestPrompt);
  const adapterConfig = await getProjectModelAdapterConfigByIds(bundle.project.id, bundle.workspace.id);
  const effectiveAdapterConfig = requestedSelectionOverride
    ? withCapabilitySelectionOverride(adapterConfig, {
        workspaceId: bundle.workspace.id,
        projectId: bundle.project.id,
        capability: "patch_suggestion",
        selection: requestedSelectionOverride,
      })
    : adapterConfig;
  const timestamp = nowIso();
  let generated: Awaited<ReturnType<typeof generateCodePatchSuggestion>>;

  try {
    generated = await generateCodePatchSuggestion(
      {
        file,
        currentContent: workingContent,
        requestPrompt: normalizedPrompt,
      },
      effectiveAdapterConfig,
    );
  } catch (error) {
    if (error instanceof ModelAdapterExecutionError) {
      await recordProjectModelAdapterRun({
        workspaceId: bundle.workspace.id,
        projectId: bundle.project.id,
        status: "failed",
        trigger: "proposal_request",
        linkedEntityType: null,
        linkedEntityId: null,
        retryOfRunId,
        errorMessage: error.message,
        startedAt: timestamp,
        completedAt: timestamp,
        ...error.execution,
      }).catch(() => null);
    }

    throw error;
  }
  const proposal: ProjectCodePatchProposalRecord = {
    id: crypto.randomUUID(),
    codeStateId: bundle.codeState.id,
    fileId: file.id,
    projectId: file.projectId,
    filePath: file.path,
    title: generated.suggestion.title,
    requestPrompt: normalizedPrompt,
    rationale: generated.suggestion.rationale,
    changeSummary: generated.suggestion.changeSummary,
    status: "pending",
    source: generated.suggestion.source,
    baseRevisionId: file.currentRevisionId,
    baseRevisionNumber: file.currentRevisionNumber,
    baseContent: workingContent,
    proposedContent: generated.suggestion.proposedContent,
    resolvedRevisionId: null,
    invalidatedByRevisionId: null,
    invalidatedByRevisionNumber: null,
    resolutionNote: null,
    archivedAt: null,
    archiveReason: null,
    createdAt: timestamp,
    resolvedAt: null,
  };

  store.projectPatchProposals = [proposal, ...store.projectPatchProposals];
  await writeLocalStore(store);
  await touchProjectLocal(file.projectId, timestamp);
  await recordProjectModelAdapterRun({
    workspaceId: bundle.workspace.id,
    projectId: bundle.project.id,
    status: "completed",
    trigger: "proposal_request",
    linkedEntityType: "patch_proposal",
    linkedEntityId: proposal.id,
    retryOfRunId,
    startedAt: timestamp,
    completedAt: timestamp,
    ...generated.adapterExecution,
  }).catch(() => null);

  return proposal;
}

async function createCodePatchProposalSupabase(
  bundle: ProjectCodeBundle,
  filePath: string,
  requestPrompt: string,
  requestedSelectionOverride: CreateCodePatchProposalInput["requestedSelectionOverride"],
  retryOfRunId: string | null,
) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { file, workingContent } = ensurePatchableFile(bundle, filePath);
  const normalizedPrompt = ensurePatchPrompt(requestPrompt);
  const adapterConfig = await getProjectModelAdapterConfigByIds(bundle.project.id, bundle.workspace.id);
  const effectiveAdapterConfig = requestedSelectionOverride
    ? withCapabilitySelectionOverride(adapterConfig, {
        workspaceId: bundle.workspace.id,
        projectId: bundle.project.id,
        capability: "patch_suggestion",
        selection: requestedSelectionOverride,
      })
    : adapterConfig;
  const timestamp = nowIso();
  let generated: Awaited<ReturnType<typeof generateCodePatchSuggestion>>;

  try {
    generated = await generateCodePatchSuggestion(
      {
        file,
        currentContent: workingContent,
        requestPrompt: normalizedPrompt,
      },
      effectiveAdapterConfig,
    );
  } catch (error) {
    if (error instanceof ModelAdapterExecutionError) {
      await recordProjectModelAdapterRun({
        workspaceId: bundle.workspace.id,
        projectId: bundle.project.id,
        status: "failed",
        trigger: "proposal_request",
        linkedEntityType: null,
        linkedEntityId: null,
        retryOfRunId,
        errorMessage: error.message,
        startedAt: timestamp,
        completedAt: timestamp,
        ...error.execution,
      }).catch(() => null);
    }

    throw error;
  }
  const proposal: ProjectCodePatchProposalRecord = {
    id: crypto.randomUUID(),
    codeStateId: bundle.codeState.id,
    fileId: file.id,
    projectId: file.projectId,
    filePath: file.path,
    title: generated.suggestion.title,
    requestPrompt: normalizedPrompt,
    rationale: generated.suggestion.rationale,
    changeSummary: generated.suggestion.changeSummary,
    status: "pending",
    source: generated.suggestion.source,
    baseRevisionId: file.currentRevisionId,
    baseRevisionNumber: file.currentRevisionNumber,
    baseContent: workingContent,
    proposedContent: generated.suggestion.proposedContent,
    resolvedRevisionId: null,
    invalidatedByRevisionId: null,
    invalidatedByRevisionNumber: null,
    resolutionNote: null,
    archivedAt: null,
    archiveReason: null,
    createdAt: timestamp,
    resolvedAt: null,
  };

  const [{ error: createProposalError }, { error: touchProjectError }] = await Promise.all([
    client.from("project_code_patch_proposals").insert({
      id: proposal.id,
      code_state_id: proposal.codeStateId,
      file_id: proposal.fileId,
      project_id: proposal.projectId,
      file_path: proposal.filePath,
      title: proposal.title,
      request_prompt: proposal.requestPrompt,
      rationale: proposal.rationale,
      change_summary: proposal.changeSummary,
      status: proposal.status,
      source: proposal.source,
      base_revision_id: proposal.baseRevisionId,
      base_revision_number: proposal.baseRevisionNumber,
      base_content: proposal.baseContent,
      proposed_content: proposal.proposedContent,
      resolved_revision_id: proposal.resolvedRevisionId,
      invalidated_by_revision_id: proposal.invalidatedByRevisionId,
      invalidated_by_revision_number: proposal.invalidatedByRevisionNumber,
      resolution_note: proposal.resolutionNote,
      archived_at: proposal.archivedAt,
      archive_reason: proposal.archiveReason,
      created_at: proposal.createdAt,
      resolved_at: proposal.resolvedAt,
    }),
    client.from("projects").update({ updated_at: timestamp }).eq("id", file.projectId),
  ]);

  if (createProposalError) {
    throw new Error(createProposalError.message);
  }

  if (touchProjectError) {
    throw new Error(touchProjectError.message);
  }

  await recordProjectModelAdapterRun({
    workspaceId: bundle.workspace.id,
    projectId: bundle.project.id,
    status: "completed",
    trigger: "proposal_request",
    linkedEntityType: "patch_proposal",
    linkedEntityId: proposal.id,
    retryOfRunId,
    startedAt: timestamp,
    completedAt: timestamp,
    ...generated.adapterExecution,
  }).catch(() => null);

  return proposal;
}

async function applyCodePatchProposalLocal(bundle: ProjectCodeBundle, proposalId: string) {
  const store = await readLocalStore();
  const { proposal, file, syncRecord, workingContent } = resolvePatchProposal(bundle, proposalId);

  if (proposal.status !== "pending") {
    throw new Error("This patch proposal is no longer pending.");
  }

  if (syncRecord?.needsSync) {
    throw new Error("Refresh the scaffold before applying this patch proposal.");
  }

  if (workingContent !== proposal.baseContent || file.currentRevisionId !== proposal.baseRevisionId) {
    throw new Error("This patch proposal is stale. Refresh the file before applying it.");
  }

  const timestamp = nowIso();
  const revisionId = crypto.randomUUID();
  const nextRevisionNumber = file.currentRevisionNumber + 1;
  const revision: ProjectCodeFileRevisionRecord = {
    id: revisionId,
    fileId: file.id,
    projectId: file.projectId,
    revisionNumber: nextRevisionNumber,
    kind: "saved",
    content: proposal.proposedContent,
    changeSummary: proposal.changeSummary,
    authoredBy: "user",
    baseRevisionId: file.currentRevisionId,
    baseRevisionNumber: file.currentRevisionNumber,
    sourceProposalId: proposal.id,
    sourceProposalTitle: proposal.title,
    restoreSource: null,
    restoredFromRevisionId: null,
    restoredFromRevisionNumber: null,
    createdAt: timestamp,
  };

  store.projectFiles = store.projectFiles.map((entry) =>
    entry.id === file.id
      ? {
          ...entry,
          content: proposal.proposedContent,
          currentRevisionId: revisionId,
          currentRevisionNumber: nextRevisionNumber,
          draftContent: null,
          draftUpdatedAt: null,
          draftBaseRevisionId: null,
          draftBaseRevisionNumber: null,
          updatedAt: timestamp,
        }
      : entry,
  );
  store.projectFileRevisions = [revision, ...store.projectFileRevisions];
  store.codeStates = store.codeStates.map((state) =>
    state.id === bundle.codeState.id
      ? {
          ...state,
          activeFilePath: file.path,
          openFilePaths: mergeOpenFilePaths(state, file.path),
          manualChanges: true,
          updatedAt: timestamp,
        }
      : state,
  );
  store.projectPatchProposals = store.projectPatchProposals.map((entry) => {
    if (entry.id === proposal.id) {
      return {
        ...entry,
        status: "applied",
        resolvedRevisionId: revisionId,
        invalidatedByRevisionId: null,
        invalidatedByRevisionNumber: null,
        resolutionNote: "Applied from the controlled patch proposal review flow.",
        resolvedAt: timestamp,
      };
    }

    if (entry.fileId === file.id && entry.status === "pending") {
      return {
        ...entry,
        status: "stale",
        invalidatedByRevisionId: revisionId,
        invalidatedByRevisionNumber: nextRevisionNumber,
        resolutionNote: "A newer saved revision was created from another patch proposal.",
        resolvedAt: timestamp,
      };
    }

    return entry;
  });

  await writeLocalStore(store);
  await touchProjectLocal(file.projectId, timestamp);

  return proposal.id;
}

async function applyCodePatchProposalSupabase(bundle: ProjectCodeBundle, proposalId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { proposal, file, syncRecord, workingContent } = resolvePatchProposal(bundle, proposalId);

  if (proposal.status !== "pending") {
    throw new Error("This patch proposal is no longer pending.");
  }

  if (syncRecord?.needsSync) {
    throw new Error("Refresh the scaffold before applying this patch proposal.");
  }

  if (workingContent !== proposal.baseContent || file.currentRevisionId !== proposal.baseRevisionId) {
    throw new Error("This patch proposal is stale. Refresh the file before applying it.");
  }

  const timestamp = nowIso();
  const revisionId = crypto.randomUUID();
  const nextRevisionNumber = file.currentRevisionNumber + 1;
  const codeState = bundle.codeState;

  const [
    { error: createRevisionError },
    { error: updateFileError },
    { error: updateStateError },
    { error: applyProposalError },
    { error: staleSiblingError },
    { error: touchProjectError },
  ] = await Promise.all([
    client.from("project_code_file_revisions").insert({
      id: revisionId,
      file_id: file.id,
      project_id: file.projectId,
      revision_number: nextRevisionNumber,
      kind: "saved",
      content: proposal.proposedContent,
      change_summary: proposal.changeSummary,
      authored_by: "user",
      base_revision_id: file.currentRevisionId,
      base_revision_number: file.currentRevisionNumber,
      source_proposal_id: proposal.id,
      source_proposal_title: proposal.title,
      restore_source: null,
      restored_from_revision_id: null,
      restored_from_revision_number: null,
      created_at: timestamp,
    }),
    client
      .from("project_code_files")
      .update({
        content: proposal.proposedContent,
        current_revision_id: revisionId,
        current_revision_number: nextRevisionNumber,
        draft_content: null,
        draft_updated_at: null,
        draft_base_revision_id: null,
        draft_base_revision_number: null,
        updated_at: timestamp,
      })
      .eq("id", file.id),
    client
      .from("project_code_states")
      .update({
        active_file_path: file.path,
        open_file_paths: mergeOpenFilePaths(codeState, file.path),
        manual_changes: true,
        updated_at: timestamp,
      })
      .eq("id", codeState.id),
    client
      .from("project_code_patch_proposals")
      .update({
        status: "applied",
        resolved_revision_id: revisionId,
        invalidated_by_revision_id: null,
        invalidated_by_revision_number: null,
        resolution_note: "Applied from the controlled patch proposal review flow.",
        resolved_at: timestamp,
      })
      .eq("id", proposal.id),
    client
      .from("project_code_patch_proposals")
      .update({
        status: "stale",
        invalidated_by_revision_id: revisionId,
        invalidated_by_revision_number: nextRevisionNumber,
        resolution_note: "A newer saved revision was created from another patch proposal.",
        resolved_at: timestamp,
      })
      .eq("file_id", file.id)
      .eq("status", "pending")
      .neq("id", proposal.id),
    client.from("projects").update({ updated_at: timestamp }).eq("id", file.projectId),
  ]);

  if (createRevisionError) {
    throw new Error(createRevisionError.message);
  }

  if (updateFileError) {
    throw new Error(updateFileError.message);
  }

  if (updateStateError) {
    throw new Error(updateStateError.message);
  }

  if (applyProposalError) {
    throw new Error(applyProposalError.message);
  }

  if (staleSiblingError) {
    throw new Error(staleSiblingError.message);
  }

  if (touchProjectError) {
    throw new Error(touchProjectError.message);
  }

  return proposal.id;
}

async function rejectCodePatchProposalLocal(bundle: ProjectCodeBundle, proposalId: string, rejectionReason: string) {
  const store = await readLocalStore();
  const { proposal } = resolvePatchProposal(bundle, proposalId);

  if (proposal.status === "applied" || proposal.status === "rejected") {
    throw new Error("This patch proposal is already resolved.");
  }

  const timestamp = nowIso();
  const note = rejectionReason.trim() || "Rejected from the controlled patch proposal review flow.";

  store.projectPatchProposals = store.projectPatchProposals.map((entry) =>
    entry.id === proposal.id
      ? {
          ...entry,
          status: "rejected",
          resolutionNote: note,
          resolvedAt: timestamp,
        }
      : entry,
  );

  await writeLocalStore(store);
  await touchProjectLocal(proposal.projectId, timestamp);

  return proposal.id;
}

async function rejectCodePatchProposalSupabase(
  bundle: ProjectCodeBundle,
  proposalId: string,
  rejectionReason: string,
) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { proposal } = resolvePatchProposal(bundle, proposalId);

  if (proposal.status === "applied" || proposal.status === "rejected") {
    throw new Error("This patch proposal is already resolved.");
  }

  const timestamp = nowIso();
  const note = rejectionReason.trim() || "Rejected from the controlled patch proposal review flow.";
  const [{ error: rejectProposalError }, { error: touchProjectError }] = await Promise.all([
    client
      .from("project_code_patch_proposals")
      .update({
        status: "rejected",
        resolution_note: note,
        resolved_at: timestamp,
      })
      .eq("id", proposal.id),
    client.from("projects").update({ updated_at: timestamp }).eq("id", proposal.projectId),
  ]);

  if (rejectProposalError) {
    throw new Error(rejectProposalError.message);
  }

  if (touchProjectError) {
    throw new Error(touchProjectError.message);
  }

  return proposal.id;
}

async function restoreCodeFileRevisionLocal(
  bundle: ProjectCodeBundle,
  input: RestoreCodeFileRevisionInput,
) {
  const store = await readLocalStore();
  const { file, targetContent, targetRevision, targetRevisionNumber, targetType } =
    resolveRestoreTarget(bundle, input);

  ensureCurrentRevision(file, input.expectedRevisionNumber);

  if (
    file.content === targetContent ||
    (targetType === "revision" && targetRevision?.id === file.currentRevisionId)
  ) {
    throw new Error("The selected restore target already matches the current file revision.");
  }

  const stateIndex = store.codeStates.findIndex((state) => state.id === bundle.codeState.id);
  const fileIndex = store.projectFiles.findIndex((entry) => entry.id === file.id);

  if (stateIndex === -1 || fileIndex === -1) {
    throw new Error("Code file not found.");
  }

  const timestamp = nowIso();
  const revisionId = crypto.randomUUID();
  const nextRevisionNumber = file.currentRevisionNumber + 1;
  const changeSummary =
    targetType === "scaffold"
      ? `Restored file to the current scaffold from visual revision ${targetRevisionNumber}.`
      : `Restored file from revision ${targetRevisionNumber}.`;
  const proposalInvalidationNote =
    targetType === "scaffold"
      ? "The file was restored to the current scaffold before this patch proposal was applied."
      : "The file was restored to an earlier revision before this patch proposal was applied.";
  const revision: ProjectCodeFileRevisionRecord = {
    id: revisionId,
    fileId: file.id,
    projectId: file.projectId,
    revisionNumber: nextRevisionNumber,
    kind: "restored",
    content: targetContent,
    changeSummary,
    authoredBy: "user",
    baseRevisionId: file.currentRevisionId,
    baseRevisionNumber: file.currentRevisionNumber,
    sourceProposalId: null,
    sourceProposalTitle: null,
    restoreSource: targetType,
    restoredFromRevisionId: targetType === "revision" ? targetRevision?.id ?? null : null,
    restoredFromRevisionNumber: targetType === "revision" ? targetRevisionNumber : null,
    createdAt: timestamp,
  };

  store.projectFiles[fileIndex] = {
    ...store.projectFiles[fileIndex],
    content: targetContent,
    currentRevisionId: revisionId,
    currentRevisionNumber: nextRevisionNumber,
    draftContent: null,
    draftUpdatedAt: null,
    draftBaseRevisionId: null,
    draftBaseRevisionNumber: null,
    updatedAt: timestamp,
  };
  store.projectFileRevisions = [revision, ...store.projectFileRevisions];
  const nextCodeStateBase: CodeWorkspaceStateRecord = {
    ...store.codeStates[stateIndex],
    activeFilePath: file.path,
    openFilePaths: mergeOpenFilePaths(store.codeStates[stateIndex], file.path),
    manualChanges: true,
    updatedAt: timestamp,
  };
  store.codeStates[stateIndex] = await reconcileCodeStateSourceAfterRestore({
    workspaceSlug: input.workspaceSlug,
    projectSlug: input.projectSlug,
    bundle,
    codeState: nextCodeStateBase,
    files: store.projectFiles.filter((entry) => entry.projectId === file.projectId),
    fileRevisions: store.projectFileRevisions.filter((entry) => entry.projectId === file.projectId),
    fileLinks: store.projectFileLinks.filter((entry) => entry.projectId === file.projectId),
    targetType,
    targetRevisionNumber,
    targetFilePath: file.path,
  });
  store.projectPatchProposals = markPatchProposalsStale(
    store.projectPatchProposals,
    [
      {
        fileId: file.id,
        note: proposalInvalidationNote,
        timestamp,
        invalidatedByRevisionId: revisionId,
        invalidatedByRevisionNumber: nextRevisionNumber,
      },
    ],
  );

  await writeLocalStore(store);
  await touchProjectLocal(file.projectId, timestamp);

  return revision;
}

async function restoreCodeFileRevisionSupabase(
  bundle: ProjectCodeBundle,
  input: RestoreCodeFileRevisionInput,
) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { file, targetContent, targetRevision, targetRevisionNumber, targetType } =
    resolveRestoreTarget(bundle, input);

  ensureCurrentRevision(file, input.expectedRevisionNumber);

  if (
    file.content === targetContent ||
    (targetType === "revision" && targetRevision?.id === file.currentRevisionId)
  ) {
    throw new Error("The selected restore target already matches the current file revision.");
  }

  const timestamp = nowIso();
  const revisionId = crypto.randomUUID();
  const nextRevisionNumber = file.currentRevisionNumber + 1;
  const changeSummary =
    targetType === "scaffold"
      ? `Restored file to the current scaffold from visual revision ${targetRevisionNumber}.`
      : `Restored file from revision ${targetRevisionNumber}.`;
  const proposalInvalidationNote =
    targetType === "scaffold"
      ? "The file was restored to the current scaffold before this patch proposal was applied."
      : "The file was restored to an earlier revision before this patch proposal was applied.";
  const nextRevision: ProjectCodeFileRevisionRecord = {
    id: revisionId,
    fileId: file.id,
    projectId: file.projectId,
    revisionNumber: nextRevisionNumber,
    kind: "restored",
    content: targetContent,
    changeSummary,
    authoredBy: "user",
    baseRevisionId: file.currentRevisionId,
    baseRevisionNumber: file.currentRevisionNumber,
    sourceProposalId: null,
    sourceProposalTitle: null,
    restoreSource: targetType,
    restoredFromRevisionId: targetType === "revision" ? targetRevision?.id ?? null : null,
    restoredFromRevisionNumber: targetType === "revision" ? targetRevisionNumber : null,
    createdAt: timestamp,
  };
  const nextFile: ProjectCodeFileRecord = {
    ...file,
    content: targetContent,
    currentRevisionId: revisionId,
    currentRevisionNumber: nextRevisionNumber,
    draftContent: null,
    draftUpdatedAt: null,
    draftBaseRevisionId: null,
    draftBaseRevisionNumber: null,
    updatedAt: timestamp,
  };
  const nextCodeStateBase: CodeWorkspaceStateRecord = {
    ...bundle.codeState,
    activeFilePath: file.path,
    openFilePaths: mergeOpenFilePaths(bundle.codeState, file.path),
    manualChanges: true,
    updatedAt: timestamp,
  };
  const nextCodeState = await reconcileCodeStateSourceAfterRestore({
    workspaceSlug: bundle.workspace.slug,
    projectSlug: bundle.project.slug,
    bundle,
    codeState: nextCodeStateBase,
    files: bundle.files.map((entry) => (entry.id === file.id ? nextFile : entry)),
    fileRevisions: [nextRevision, ...bundle.fileRevisions],
    fileLinks: bundle.fileLinks,
    targetType,
    targetRevisionNumber,
    targetFilePath: file.path,
  });

  const [
    { error: createRevisionError },
    { error: updateFileError },
    { error: updateStateError },
    { error: staleProposalError },
    { error: touchProjectError },
  ] = await Promise.all([
    client.from("project_code_file_revisions").insert({
      id: revisionId,
      file_id: file.id,
      project_id: file.projectId,
      revision_number: nextRevisionNumber,
      kind: "restored",
      content: targetContent,
      change_summary: changeSummary,
      authored_by: "user",
      base_revision_id: file.currentRevisionId,
      base_revision_number: file.currentRevisionNumber,
      source_proposal_id: null,
      source_proposal_title: null,
      restore_source: targetType,
      restored_from_revision_id: targetType === "revision" ? targetRevision?.id ?? null : null,
      restored_from_revision_number: targetType === "revision" ? targetRevisionNumber : null,
      created_at: timestamp,
    }),
    client
      .from("project_code_files")
      .update({
        content: nextFile.content,
        current_revision_id: nextFile.currentRevisionId,
        current_revision_number: nextFile.currentRevisionNumber,
        draft_content: nextFile.draftContent,
        draft_updated_at: nextFile.draftUpdatedAt,
        draft_base_revision_id: nextFile.draftBaseRevisionId,
        draft_base_revision_number: nextFile.draftBaseRevisionNumber,
        updated_at: nextFile.updatedAt,
      })
      .eq("id", file.id),
    client
      .from("project_code_states")
      .update({
        active_file_path: nextCodeState.activeFilePath,
        open_file_paths: nextCodeState.openFilePaths,
        scaffold_source_revision_number: nextCodeState.scaffoldSourceRevisionNumber,
        source_visual_updated_at: nextCodeState.sourceVisualUpdatedAt,
        manual_changes: nextCodeState.manualChanges,
        updated_at: nextCodeState.updatedAt,
      })
      .eq("id", nextCodeState.id),
    client
      .from("project_code_patch_proposals")
      .update({
        status: "stale",
        invalidated_by_revision_id: revisionId,
        invalidated_by_revision_number: nextRevisionNumber,
        resolution_note: proposalInvalidationNote,
        resolved_at: timestamp,
      })
      .eq("file_id", file.id)
      .eq("status", "pending"),
    client.from("projects").update({ updated_at: timestamp }).eq("id", file.projectId),
  ]);

  if (createRevisionError) {
    throw new Error(createRevisionError.message);
  }

  if (updateFileError) {
    throw new Error(updateFileError.message);
  }

  if (updateStateError) {
    throw new Error(updateStateError.message);
  }

  if (staleProposalError) {
    throw new Error(staleProposalError.message);
  }

  if (touchProjectError) {
    throw new Error(touchProjectError.message);
  }
}

async function archiveCodePatchProposalLocal(
  bundle: ProjectCodeBundle,
  proposalId: string,
  archiveReason: string,
) {
  const store = await readLocalStore();
  const { proposal } = resolvePatchProposal(bundle, proposalId);
  ensureArchivableProposal(proposal);

  const timestamp = nowIso();
  const note = archiveReason.trim() || defaultArchiveReason(proposal.status);

  store.projectPatchProposals = store.projectPatchProposals.map((entry) =>
    entry.id === proposal.id
      ? {
          ...entry,
          archivedAt: timestamp,
          archiveReason: note,
        }
      : entry,
  );

  await writeLocalStore(store);
  await touchProjectLocal(proposal.projectId, timestamp);

  return proposal.id;
}

async function archiveCodePatchProposalSupabase(
  bundle: ProjectCodeBundle,
  proposalId: string,
  archiveReason: string,
) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { proposal } = resolvePatchProposal(bundle, proposalId);
  ensureArchivableProposal(proposal);

  const timestamp = nowIso();
  const note = archiveReason.trim() || defaultArchiveReason(proposal.status);
  const [{ error: archiveProposalError }, { error: touchProjectError }] = await Promise.all([
    client
      .from("project_code_patch_proposals")
      .update({
        archived_at: timestamp,
        archive_reason: note,
      })
      .eq("id", proposal.id),
    client.from("projects").update({ updated_at: timestamp }).eq("id", proposal.projectId),
  ]);

  if (archiveProposalError) {
    throw new Error(archiveProposalError.message);
  }

  if (touchProjectError) {
    throw new Error(touchProjectError.message);
  }

  return proposal.id;
}

async function ensureCodeRecords(visualBundle: ProjectVisualBundle) {
  if (isSupabaseConfigured()) {
    const existing = await getCodeRecordsSupabase(visualBundle.project.id);

    if (existing && existing.files.length > 0) {
      const reconciled = await reconcileLoadedPatchProposalsSupabase(existing);

      if (!hasCompleteCodeShape(reconciled.files, reconciled.fileRevisions, reconciled.fileLinks)) {
        return refreshCodeScaffoldSupabase(visualBundle, "metadata");
      }
      return reconciled;
    }

    return replaceCodeScaffoldSupabase(visualBundle);
  }

  const existing = await getCodeRecordsLocal(visualBundle.project.id);

  if (existing && existing.files.length > 0) {
    const reconciled = await reconcileLoadedPatchProposalsLocal(existing);

    if (!hasCompleteCodeShape(reconciled.files, reconciled.fileRevisions, reconciled.fileLinks)) {
      return refreshCodeScaffoldLocal(visualBundle, "metadata");
    }
    return reconciled;
  }

  return replaceCodeScaffoldLocal(visualBundle);
}

export async function getProjectCodeBundle(
  workspaceSlug: string,
  projectSlug: string,
): Promise<ProjectCodeBundle | null> {
  const visualBundle = await getProjectVisualBundle(workspaceSlug, projectSlug);

  if (!visualBundle) {
    return null;
  }

  const code = await ensureCodeRecords(visualBundle);
  const activeGenerationTarget = await getActiveCodeGenerationTarget(workspaceSlug, projectSlug);
  const targetScaffold = activeGenerationTarget
    ? buildCodeScaffoldFromGenerationTarget(visualBundle, activeGenerationTarget, code.codeState)
    : null;

  return buildCodeBundle(
    visualBundle,
    code.codeState,
    code.files,
    code.fileRevisions,
    code.fileLinks,
    code.patchProposals,
    targetScaffold,
  );
}

export async function getProjectCodeBundleSnapshot(
  workspaceSlug: string,
  projectSlug: string,
): Promise<ProjectCodeBundle | null> {
  const visualBundle = await getProjectVisualBundleSnapshot(workspaceSlug, projectSlug);

  if (!visualBundle) {
    return null;
  }

  const records = isSupabaseConfigured()
    ? await getCodeRecordsSupabase(visualBundle.project.id)
    : await getCodeRecordsLocal(visualBundle.project.id);

  if (!records || records.files.length === 0) {
    return null;
  }

  return buildCodeBundle(
    visualBundle,
    records.codeState,
    records.files,
    records.fileRevisions,
    records.fileLinks,
    records.patchProposals,
  );
}

export async function updateProjectCodeFileDraft(input: UpdateCodeFileDraftInput) {
  if (isSupabaseConfigured()) {
    return updateCodeFileDraftSupabase(input);
  }

  return updateCodeFileDraftLocal(input);
}

export async function saveProjectCodeFileRevision(input: SaveCodeFileRevisionInput) {
  if (isSupabaseConfigured()) {
    return saveCodeFileRevisionSupabase(input);
  }

  return saveCodeFileRevisionLocal(input);
}

export async function refreshProjectCodeScaffold(
  workspaceSlug: string,
  projectSlug: string,
  filePath: string,
  mode: Extract<CodeRefreshMode, "safe" | "force">,
) {
  const bundle = await getProjectCodeBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  const file = bundle.files.find((entry) => entry.path === filePath);

  if (!file) {
    throw new Error("Code file not found.");
  }

  const syncRecord = bundle.fileSyncRecords.find((record) => record.fileId === file.id) ?? null;

  if (!syncRecord?.needsSync) {
    return bundle;
  }

  if (mode === "safe" && !syncRecord.safeToRefresh) {
    throw new Error("This file requires explicit confirmation before refreshing from the scaffold.");
  }

  if (
    mode === "force" &&
    !syncRecord.requiresConfirmation &&
    !syncRecord.safeToRefresh
  ) {
    throw new Error("This file cannot be refreshed from the scaffold in the current state.");
  }

  const visualBundle = await getProjectVisualBundle(workspaceSlug, projectSlug);

  if (!visualBundle) {
    throw new Error("Project not found.");
  }

  const activeGenerationTarget = await getActiveCodeGenerationTarget(workspaceSlug, projectSlug);
  const targetScaffold = activeGenerationTarget
    ? buildCodeScaffoldFromGenerationTarget(visualBundle, activeGenerationTarget, bundle.codeState)
    : null;

  if (isSupabaseConfigured()) {
    return refreshCodeScaffoldSupabase(visualBundle, mode, filePath, targetScaffold);
  }

  return refreshCodeScaffoldLocal(visualBundle, mode, filePath, targetScaffold);
}

export async function createProjectCodePatchProposal(input: CreateCodePatchProposalInput) {
  const bundle = await getProjectCodeBundle(input.workspaceSlug, input.projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  if (isSupabaseConfigured()) {
    return createCodePatchProposalSupabase(
      bundle,
      input.filePath,
      input.requestPrompt,
      input.requestedSelectionOverride ?? null,
      input.retryOfRunId ?? null,
    );
  }

  return createCodePatchProposalLocal(
    bundle,
    input.filePath,
    input.requestPrompt,
    input.requestedSelectionOverride ?? null,
    input.retryOfRunId ?? null,
  );
}

export async function applyProjectCodePatchProposal(input: ApplyCodePatchProposalInput) {
  const bundle = await getProjectCodeBundle(input.workspaceSlug, input.projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  if (isSupabaseConfigured()) {
    return applyCodePatchProposalSupabase(bundle, input.proposalId);
  }

  return applyCodePatchProposalLocal(bundle, input.proposalId);
}

export async function rejectProjectCodePatchProposal(input: RejectCodePatchProposalInput) {
  const bundle = await getProjectCodeBundle(input.workspaceSlug, input.projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  if (isSupabaseConfigured()) {
    return rejectCodePatchProposalSupabase(bundle, input.proposalId, input.rejectionReason);
  }

  return rejectCodePatchProposalLocal(bundle, input.proposalId, input.rejectionReason);
}

export async function restoreProjectCodeFileRevision(input: RestoreCodeFileRevisionInput) {
  const bundle = await getProjectCodeBundle(input.workspaceSlug, input.projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  if (isSupabaseConfigured()) {
    return restoreCodeFileRevisionSupabase(bundle, input);
  }

  return restoreCodeFileRevisionLocal(bundle, input);
}

export async function archiveProjectCodePatchProposal(input: ArchiveCodePatchProposalInput) {
  const bundle = await getProjectCodeBundle(input.workspaceSlug, input.projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  if (isSupabaseConfigured()) {
    return archiveCodePatchProposalSupabase(bundle, input.proposalId, input.archiveReason);
  }

  return archiveCodePatchProposalLocal(bundle, input.proposalId, input.archiveReason);
}
