import { createCodeScaffold } from "@/lib/builder/code-scaffold";
import type {
  CodeFileSyncRecord,
  CodeSyncState,
  CodeWorkspaceStateRecord,
  GeneratedCodeScaffold,
  ProjectCodeBundle,
  ProjectCodeFileLinkRecord,
  ProjectCodeFileRecord,
  ProjectCodeFileRevisionRecord,
  ProjectVisualBundle,
} from "@/lib/builder/types";

function sortByPath<T extends { path: string }>(items: T[]) {
  return [...items].sort((a, b) => a.path.localeCompare(b.path));
}

function candidateContentByPath(visualBundle: ProjectVisualBundle, codeState: CodeWorkspaceStateRecord) {
  const scaffold = createCodeScaffold({
    visualBundle,
    existingState: codeState,
  });

  return {
    files: sortByPath(scaffold.files),
    fileMap: new Map(scaffold.files.map((file) => [file.path, file])),
    linkMap: new Map(
      scaffold.files.map((file) => [
        file.path,
        scaffold.fileLinks.filter((link) => link.fileId === file.id),
      ]),
    ),
  };
}

function explicitCandidateContent(
  scaffold: Pick<GeneratedCodeScaffold, "files" | "fileLinks">,
) {
  return {
    files: sortByPath(scaffold.files),
    fileMap: new Map(scaffold.files.map((file) => [file.path, file])),
    linkMap: new Map(
      scaffold.files.map((file) => [
        file.path,
        scaffold.fileLinks.filter((link) => link.fileId === file.id),
      ]),
    ),
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function hasSavedManualCodeChanges(
  file: ProjectCodeFileRecord,
  fileRevisions: ProjectCodeFileRevisionRecord[],
) {
  return (
    file.draftContent !== null ||
    fileRevisions.some((revision) => revision.fileId === file.id && revision.kind === "saved")
  );
}

export function buildCodeSyncRecords(
  visualBundle: ProjectVisualBundle,
  codeState: CodeWorkspaceStateRecord,
  files: ProjectCodeFileRecord[],
  fileRevisions: ProjectCodeFileRevisionRecord[],
  fileLinks: ProjectCodeFileLinkRecord[],
  targetScaffold?: Pick<GeneratedCodeScaffold, "files" | "fileLinks"> | null,
) {
  const candidate =
    targetScaffold
      ? explicitCandidateContent(targetScaffold)
      : candidateContentByPath(visualBundle, codeState);

  const records: CodeFileSyncRecord[] = files.map((file) => {
    const links = fileLinks.filter((link) => link.fileId === file.id);
    const targetLabels = unique(links.map((link) => link.targetLabel));
    const linkedPageIds = unique(links.map((link) => link.visualPageId ?? ""));
    const linkedSectionIds = unique(links.map((link) => link.visualSectionId ?? ""));
    const candidateFile = candidate.fileMap.get(file.path) ?? null;
    const hasManualChanges = hasSavedManualCodeChanges(file, fileRevisions);
    const needsSync =
      links.length > 0 && candidateFile !== null ? candidateFile.content !== file.content : false;

    if (links.length === 0 || !candidateFile) {
      return {
        fileId: file.id,
        path: file.path,
        status: "unlinked",
        needsSync: false,
        safeToRefresh: false,
        requiresConfirmation: false,
        hasManualChanges,
        linkCount: 0,
        linkedPageIds,
        linkedSectionIds,
        targetLabels,
      } satisfies CodeFileSyncRecord;
    }

    if (!needsSync) {
      return {
        fileId: file.id,
        path: file.path,
        status: file.ownership === "visual_owned" ? "visual_managed" : "current",
        needsSync: false,
        safeToRefresh: false,
        requiresConfirmation: false,
        hasManualChanges,
        linkCount: links.length,
        linkedPageIds,
        linkedSectionIds,
        targetLabels,
      } satisfies CodeFileSyncRecord;
    }

    if (file.ownership === "visual_owned") {
      return {
        fileId: file.id,
        path: file.path,
        status: "visual_managed",
        needsSync: true,
        safeToRefresh: true,
        requiresConfirmation: false,
        hasManualChanges: false,
        linkCount: links.length,
        linkedPageIds,
        linkedSectionIds,
        targetLabels,
      } satisfies CodeFileSyncRecord;
    }

    return {
      fileId: file.id,
      path: file.path,
      status: hasManualChanges ? "refresh_blocked" : "refresh_available",
      needsSync: true,
      safeToRefresh: !hasManualChanges,
      requiresConfirmation: hasManualChanges,
      hasManualChanges,
      linkCount: links.length,
      linkedPageIds,
      linkedSectionIds,
      targetLabels,
    } satisfies CodeFileSyncRecord;
  });

  const staleRecords = records.filter((record) => record.needsSync);

  return {
    candidateFiles: candidate.files,
    candidateFileMap: candidate.fileMap,
    candidateLinkMap: candidate.linkMap,
    syncRecords: sortByPath(records),
    syncState: {
      sourceRevisionNumber: codeState.scaffoldSourceRevisionNumber,
      sourceVisualUpdatedAt: codeState.sourceVisualUpdatedAt,
      hasManualChanges: files.some((file) => hasSavedManualCodeChanges(file, fileRevisions)),
      needsRegeneration: staleRecords.length > 0,
      fileCount: files.length,
      openFileCount: codeState.openFilePaths.filter((path) => files.some((file) => file.path === path)).length,
      draftCount: files.filter((file) => Boolean(file.draftContent)).length,
      linkedFileCount: records.filter((record) => record.linkCount > 0).length,
      staleFileCount: staleRecords.length,
      safeRefreshableFileCount: records.filter(
        (record) => record.status === "refresh_available",
      ).length,
      visualManagedFileCount: records.filter(
        (record) => record.status === "visual_managed" && record.needsSync,
      ).length,
      blockedFileCount: records.filter(
        (record) => record.status === "refresh_blocked",
      ).length,
      canSafeRefresh: records.some((record) => record.safeToRefresh),
      requiresConfirmedRefresh: records.some((record) => record.requiresConfirmation),
    } satisfies CodeSyncState,
  };
}

export function getCodeFileSyncRecord(
  bundle: Pick<ProjectCodeBundle, "fileSyncRecords">,
  fileId: string,
) {
  return bundle.fileSyncRecords.find((record) => record.fileId === fileId) ?? null;
}
