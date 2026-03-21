import Link from "next/link";

import { BuilderSyncGuardrailCard } from "@/components/builder/builder-sync-guardrail-card";
import { CodeDiffView } from "@/components/builder/code-diff-view";
import { CodePatchProposalHistory } from "@/components/builder/code-patch-proposal-history";
import { CodePatchProposalCompareCard } from "@/components/builder/code-patch-proposal-compare-card";
import { CodePatchRequestCard } from "@/components/builder/code-patch-request-card";
import { CodePatchProposalTraceCard } from "@/components/builder/code-patch-proposal-trace-card";
import { CodeRefreshQueueCard } from "@/components/builder/code-refresh-queue-card";
import { CodeRefreshRecoveryCard } from "@/components/builder/code-refresh-recovery-card";
import { CodeRestoreReviewCard } from "@/components/builder/code-restore-review-card";
import { CodeRevisionHistory } from "@/components/builder/code-revision-history";
import { ModelAdapterRunHistoryCard } from "@/components/model-adapters/model-adapter-run-history-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { codeFileKindLabels, codeFileOwnershipLabels } from "@/lib/builder/options";
import { projectTabRoute } from "@/lib/builder/routes";
import type {
  CodeFileSyncRecord,
  CodeWorkspaceTreeNode,
  ProjectBuilderRefreshQueueItemRecord,
  ProjectCodeBundle,
  ProjectCodeFileRecord,
  ProjectCodeFileRevisionRecord,
  ProjectCodePatchProposalRecord,
} from "@/lib/builder/types";
import type { GenerationRunRecord } from "@/lib/generation/types";
import { findPatchProposalComparison } from "@/lib/model-adapters/comparisons";
import type { ModelAdapterRunRecord } from "@/lib/model-adapters/types";
import { buildCodeDiff } from "@/lib/builder/code-diff";
import type { CodeDiffLine } from "@/lib/builder/code-diff";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";
import type { FormState } from "@/lib/workspaces/form-state";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

type CodeFileAction = (formData: FormData) => Promise<void>;
type PatchProposalAction = (state: FormState, formData: FormData) => Promise<FormState>;

function buildCodeHref(
  locale: Locale,
  workspaceSlug: string,
  projectSlug: string,
  filePath: string,
  options: {
    compareRevisionId?: string | null;
    proposalId?: string | null;
    proposalCompareId?: string | null;
    restoreRevisionId?: string | null;
    restoreScaffold?: boolean;
  } = {},
) {
  const url = new URL(projectTabRoute(locale, workspaceSlug, projectSlug, "code"), "https://builder.local");
  url.searchParams.set("file", filePath);

  if (options.compareRevisionId) {
    url.searchParams.set("compare", options.compareRevisionId);
  }

  if (options.proposalId) {
    url.searchParams.set("proposal", options.proposalId);
  }

  if (options.proposalCompareId) {
    url.searchParams.set("proposalCompare", options.proposalCompareId);
  }

  if (options.restoreRevisionId) {
    url.searchParams.set("restoreRevision", options.restoreRevisionId);
  }

  if (options.restoreScaffold) {
    url.searchParams.set("restoreScaffold", "1");
  }

  return `${url.pathname}${url.search}`;
}

function buildTree(files: ProjectCodeFileRecord[]): CodeWorkspaceTreeNode[] {
  const seenFolders = new Set<string>();
  const nodes: CodeWorkspaceTreeNode[] = [];

  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const segments = file.path.split("/");
    let currentPath = "";

    segments.slice(0, -1).forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;

      if (!seenFolders.has(currentPath)) {
        seenFolders.add(currentPath);
        nodes.push({
          path: currentPath,
          name: `${segment}/`,
          depth: index,
          kind: "folder",
        });
      }
    });

    nodes.push({
      path: file.path,
      name: file.name,
      depth: segments.length - 1,
      kind: "file",
      fileKind: file.kind,
    });
  }

  return nodes;
}

function resolveOpenFiles(bundle: ProjectCodeBundle, selectedFilePath: string | null) {
  const selectedFile =
    bundle.files.find((file) => file.path === selectedFilePath) ??
    bundle.files.find((file) => file.path === bundle.codeState.activeFilePath) ??
    bundle.files[0] ??
    null;
  const openFiles = Array.from(
    new Set(
      [selectedFile?.path, ...bundle.codeState.openFilePaths].filter((filePath): filePath is string =>
        bundle.files.some((file) => file.path === filePath),
      ),
    ),
  )
    .map((filePath) => bundle.files.find((file) => file.path === filePath))
    .filter((file): file is ProjectCodeFileRecord => Boolean(file));

  return {
    selectedFile,
    openFiles,
  };
}

function syncStatusLabel(dictionary: Dictionary, record: CodeFileSyncRecord) {
  if (record.status === "unlinked") {
    return dictionary.builder.guardrails.statusUnlinked;
  }

  if (record.status === "visual_managed") {
    return record.needsSync
      ? dictionary.builder.guardrails.statusVisualManagedStale
      : dictionary.builder.guardrails.statusVisualManaged;
  }

  if (record.status === "refresh_available") {
    return dictionary.builder.guardrails.statusRefreshAvailable;
  }

  if (record.status === "refresh_blocked") {
    return dictionary.builder.guardrails.statusRefreshBlocked;
  }

  return dictionary.builder.guardrails.statusCurrent;
}

function syncStatusCopy(dictionary: Dictionary, record: CodeFileSyncRecord) {
  if (record.status === "unlinked") {
    return dictionary.builder.guardrails.copyUnlinked;
  }

  if (record.status === "visual_managed") {
    return record.needsSync
      ? dictionary.builder.guardrails.copyVisualManagedStale
      : dictionary.builder.guardrails.copyVisualManaged;
  }

  if (record.status === "refresh_available") {
    return dictionary.builder.guardrails.copyRefreshAvailable;
  }

  if (record.status === "refresh_blocked") {
    return dictionary.builder.guardrails.copyRefreshBlocked;
  }

  return dictionary.builder.guardrails.copyCurrent;
}

function proposalStatusLabel(
  dictionary: Dictionary,
  proposal: ProjectCodePatchProposalRecord,
) {
  if (proposal.status === "pending") {
    return dictionary.builder.code.proposalPending;
  }

  if (proposal.status === "applied") {
    return dictionary.builder.code.proposalApplied;
  }

  if (proposal.status === "rejected") {
    return dictionary.builder.code.proposalRejected;
  }

  return dictionary.builder.code.proposalStale;
}

export function CodeWorkspace({
  locale,
  dictionary,
  bundle,
  selectedFilePath,
  selectedCompareRevisionId,
  selectedProposalId,
  selectedProposalComparisonId,
  selectedRestoreRevisionId,
  selectedRestoreScaffold,
  activeQueueItem,
  modelAdapterRuns,
  queueGenerationRun,
  latestGenerationRun,
  queueReplacementHref,
  saveDraftAction,
  saveRevisionAction,
  restoreRevisionAction,
  createPatchProposalAction,
  applyPatchProposalAction,
  rejectPatchProposalAction,
  archivePatchProposalAction,
  safeRefreshAction,
  deferQueueAction,
  completeQueueAction,
}: {
  locale: Locale;
  dictionary: Dictionary;
  bundle: ProjectCodeBundle;
  selectedFilePath: string | null;
  selectedCompareRevisionId: string | null;
  selectedProposalId: string | null;
  selectedProposalComparisonId: string | null;
  selectedRestoreRevisionId: string | null;
  selectedRestoreScaffold: boolean;
  activeQueueItem: ProjectBuilderRefreshQueueItemRecord | null;
  modelAdapterRuns: ModelAdapterRunRecord[];
  queueGenerationRun: GenerationRunRecord | null;
  latestGenerationRun: GenerationRunRecord | null;
  queueReplacementHref: string | null;
  saveDraftAction: CodeFileAction;
  saveRevisionAction: CodeFileAction;
  restoreRevisionAction: CodeFileAction;
  createPatchProposalAction: PatchProposalAction;
  applyPatchProposalAction: CodeFileAction;
  rejectPatchProposalAction: CodeFileAction;
  archivePatchProposalAction: CodeFileAction;
  safeRefreshAction: CodeFileAction;
  deferQueueAction: CodeFileAction;
  completeQueueAction: CodeFileAction;
}) {
  const tree = buildTree(bundle.files);
  const { selectedFile, openFiles } = resolveOpenFiles(bundle, selectedFilePath);

  if (!selectedFile) {
    return (
      <Card className="px-6 py-8">
        <p className="font-display text-2xl font-bold text-card-foreground">
          {dictionary.builder.code.emptyTitle}
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          {dictionary.builder.code.emptyCopy}
        </p>
        <div className="mt-6">
          <Link href={projectTabRoute(locale, bundle.workspace.slug, bundle.project.slug, "visual")} className={buttonStyles("secondary")}>
            {dictionary.builder.visual.title}
          </Link>
        </div>
      </Card>
    );
  }

  const visualPages = bundle.visualPages.length;
  const fileRevisions = bundle.fileRevisions.filter((revision) => revision.fileId === selectedFile.id);
  const fileLinks = bundle.fileLinks.filter((link) => link.fileId === selectedFile.id);
  const filePatchProposals = bundle.patchProposals.filter((proposal) => proposal.fileId === selectedFile.id);
  const patchAdapterRuns = modelAdapterRuns.filter((run) => run.linkedEntityType === "patch_proposal");
  const selectedSyncRecord =
    bundle.fileSyncRecords.find((record) => record.fileId === selectedFile.id) ?? null;
  const firstStaleSyncRecord = bundle.fileSyncRecords.find((record) => record.needsSync) ?? null;
  const firstStaleFile = firstStaleSyncRecord
    ? bundle.files.find((file) => file.id === firstStaleSyncRecord.fileId) ?? null
    : null;
  const selectedRefreshCandidate =
    bundle.refreshCandidates.find((candidate) => candidate.path === selectedFile.path) ?? null;
  const selectedProposal = selectedProposalId
    ? filePatchProposals.find((proposal) => proposal.id === selectedProposalId) ?? null
    : null;
  const selectedProposalAdapterRun =
    selectedProposal !== null
      ? patchAdapterRuns.find((run) => run.linkedEntityId === selectedProposal.id) ?? null
      : null;
  const patchComparison = findPatchProposalComparison({
    selectedProposal,
    explicitComparisonProposalId: selectedProposalComparisonId,
    proposals: filePatchProposals,
    adapterRuns: patchAdapterRuns,
  });
  const compareRevision = selectedCompareRevisionId
    ? fileRevisions.find((revision) => revision.id === selectedCompareRevisionId) ?? null
    : null;
  const currentRevision =
    fileRevisions.find((revision) => revision.id === selectedFile.currentRevisionId) ?? null;
  const selectedRestoreRevision = selectedRestoreRevisionId
    ? fileRevisions.find((revision) => revision.id === selectedRestoreRevisionId) ?? null
    : null;
  const previousRevision = fileRevisions.find((revision) => revision.id !== selectedFile.currentRevisionId) ?? null;
  const canReviewCode = bundle.projectPermissions.canReviewCode;
  const canRestoreCode = bundle.projectPermissions.canRestoreCode;
  const canManageProposals = bundle.projectPermissions.canManageProposals;
  const codePermissionCopy = dictionary.builder.code.permissionCopy;
  const workingContent = selectedFile.draftContent ?? selectedFile.content;
  const editable = selectedFile.editPolicy === "single_file_draft" && canReviewCode;
  const canRequestProposal = canManageProposals && editable && !selectedSyncRecord?.needsSync;
  const canApplyProposal =
    selectedProposal?.status === "pending" &&
    canManageProposals &&
    editable &&
    !selectedSyncRecord?.needsSync;
  const pendingProposalCount = bundle.patchProposals.filter((proposal) => proposal.status === "pending").length;
  const filePendingProposalCount = filePatchProposals.filter((proposal) => proposal.status === "pending").length;
  const fileStaleProposalCount = filePatchProposals.filter((proposal) => proposal.status === "stale").length;
  const guardrailTone = bundle.codeSyncState.staleFileCount > 0 ? "warning" : "current";
  const resolvedProposalRevision =
    selectedProposal?.resolvedRevisionId
      ? fileRevisions.find((revision) => revision.id === selectedProposal.resolvedRevisionId) ?? null
      : null;
  const canArchiveProposal =
    selectedProposal !== null &&
    selectedProposal.status !== "pending" &&
    !selectedProposal.archivedAt &&
    canManageProposals;
  const scaffoldRestoreHref = buildCodeHref(
    locale,
    bundle.workspace.slug,
    bundle.project.slug,
    selectedFile.path,
    { restoreScaffold: true },
  );
  const selectedRestoreTarget =
    selectedRestoreScaffold && selectedRefreshCandidate
      ? {
          type: "scaffold" as const,
          content: selectedRefreshCandidate.content,
          revision: null,
          revisionNumber: selectedRefreshCandidate.sourceRevisionNumber,
        }
      : selectedRestoreRevision
        ? {
            type: "revision" as const,
            content: selectedRestoreRevision.content,
            revision: selectedRestoreRevision,
            revisionNumber: selectedRestoreRevision.revisionNumber,
      }
      : null;
  const firstReviewHref = firstStaleFile
    ? buildCodeHref(
        locale,
        bundle.workspace.slug,
        bundle.project.slug,
        firstStaleFile.path,
        firstStaleFile.editPolicy === "single_file_draft"
          ? {
              restoreScaffold: true,
            }
          : {},
      )
    : null;
  const restoreTargetMatchesCurrent =
    selectedRestoreTarget !== null && selectedRestoreTarget.content === selectedFile.content;
  const queueReviewRecords = bundle.fileSyncRecords.filter((record) => record.linkCount > 0 || record.needsSync);
  const visualReadyForQueue =
    activeQueueItem !== null &&
    bundle.visualSyncState.sourceRevisionNumber >= activeQueueItem.targetPlanRevisionNumber;
  const reviewedFileCount =
    visualReadyForQueue
      ? queueReviewRecords.filter((record) => !record.needsSync).length
      : 0;
  const totalReviewFileCount =
    visualReadyForQueue
      ? queueReviewRecords.length
      : 0;
  const reviewProgressItems = visualReadyForQueue
    ? queueReviewRecords.map((record) => {
        const file = bundle.files.find((entry) => entry.id === record.fileId);

        if (!file) {
          return null;
        }

        let statusLabel = dictionary.builder.guardrails.statusCurrent;
        let summary = dictionary.builder.refreshQueue.fileCurrentCopy;
        let tone: "current" | "pending" | "blocked" = "current";

        if (record.status === "refresh_available") {
          statusLabel = dictionary.builder.refreshQueue.fileSafeRefresh;
          summary = dictionary.builder.refreshQueue.fileSafeRefreshCopy;
          tone = "pending";
        } else if (record.status === "refresh_blocked") {
          statusLabel = dictionary.builder.refreshQueue.fileNeedsConfirmation;
          summary = dictionary.builder.refreshQueue.fileNeedsConfirmationCopy;
          tone = "blocked";
        } else if (record.status === "visual_managed" && record.needsSync) {
          statusLabel = dictionary.builder.refreshQueue.fileVisualManaged;
          summary = dictionary.builder.refreshQueue.fileVisualManagedCopy;
          tone = "pending";
        }

        return {
          path: file.path,
          href: buildCodeHref(locale, bundle.workspace.slug, bundle.project.slug, file.path),
          statusLabel,
          summary,
          tone,
        };
      }).filter((item): item is {
        path: string;
        href: string;
        statusLabel: string;
        summary: string;
        tone: "current" | "pending" | "blocked";
      } => Boolean(item))
    : [];

  let diffTitle: string | null = null;
  let diffLines: CodeDiffLine[] = [];

  if (selectedRestoreTarget) {
    diffTitle =
      selectedRestoreTarget.type === "scaffold"
        ? dictionary.builder.code.restoreScaffoldDiffLabel
        : `${dictionary.builder.code.restoreDiffLabel}: ${dictionary.plan.revisionPrefix} ${selectedRestoreTarget.revisionNumber}`;
    diffLines = buildCodeDiff(selectedFile.content, selectedRestoreTarget.content);
  } else if (selectedProposal) {
    diffTitle = `${dictionary.builder.code.proposalDiffLabel}: ${selectedProposal.title}`;
    diffLines = buildCodeDiff(selectedProposal.baseContent, selectedProposal.proposedContent);
  } else if (selectedSyncRecord?.needsSync && selectedRefreshCandidate) {
    diffTitle = dictionary.builder.code.recoveryDiffLabel;
    diffLines = buildCodeDiff(selectedFile.content, selectedRefreshCandidate.content);
  } else if (selectedFile.draftContent !== null) {
    diffTitle = dictionary.builder.code.diffDraftLabel;
    diffLines = buildCodeDiff(selectedFile.content, selectedFile.draftContent);
  } else if (compareRevision && compareRevision.id !== selectedFile.currentRevisionId) {
    diffTitle = `${dictionary.builder.code.compareAgainst} ${dictionary.plan.revisionPrefix} ${compareRevision.revisionNumber}`;
    diffLines = buildCodeDiff(compareRevision.content, selectedFile.content);
  } else if (previousRevision) {
    diffTitle = dictionary.builder.code.diffLatestSaved;
    diffLines = buildCodeDiff(previousRevision.content, selectedFile.content);
  }

  return (
    <div className="space-y-6">
      <Card className="px-6 py-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.builder.code.title}
            </p>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {dictionary.builder.code.editingCopy}
            </p>
          </div>

          <Link href={projectTabRoute(locale, bundle.workspace.slug, bundle.project.slug, "visual")} className={buttonStyles("secondary")}>
            {dictionary.builder.visual.title}
          </Link>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-5">
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.builder.code.scaffoldSource}
            </p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">
              {dictionary.plan.revisionPrefix} {bundle.codeSyncState.sourceRevisionNumber}
            </p>
          </div>
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.builder.code.filesIndexed}
            </p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">
              {bundle.codeSyncState.fileCount}
            </p>
          </div>
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.builder.code.draftCount}
            </p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">
              {bundle.codeSyncState.draftCount}
            </p>
          </div>
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.builder.code.scaffoldState}
            </p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">
              {bundle.codeSyncState.needsRegeneration
                ? dictionary.builder.code.scaffoldOutdated
                : dictionary.builder.code.scaffoldCurrent}
            </p>
          </div>
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.builder.code.pendingProposals}
            </p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">
              {pendingProposalCount}
            </p>
          </div>
        </div>
      </Card>

      {activeQueueItem ? (
        <CodeRefreshQueueCard
          locale={locale}
          dictionary={dictionary}
          bundle={bundle}
          queueItem={activeQueueItem}
          queueGenerationRun={queueGenerationRun}
          latestGenerationRun={latestGenerationRun}
          replacementHref={queueReplacementHref}
          selectedFilePath={selectedFile.path}
          openVisualHref={projectTabRoute(locale, bundle.workspace.slug, bundle.project.slug, "visual")}
          firstReviewHref={firstReviewHref}
          reviewProgressItems={reviewProgressItems}
          reviewedFileCount={reviewedFileCount}
          totalReviewFileCount={totalReviewFileCount}
          deferAction={deferQueueAction}
          completeAction={completeQueueAction}
          canReview={canReviewCode}
          readOnlyCopy={codePermissionCopy}
        />
      ) : null}

      <BuilderSyncGuardrailCard
        title={dictionary.builder.guardrails.codeTitle}
        copy={
          bundle.codeSyncState.staleFileCount > 0
            ? dictionary.builder.guardrails.codeWarningCopy
            : dictionary.builder.guardrails.codeCurrentCopy
        }
        tone={guardrailTone}
        toneLabel={
          bundle.codeSyncState.staleFileCount > 0
            ? dictionary.builder.guardrails.warningBadge
            : dictionary.builder.guardrails.currentBadge
        }
        metrics={[
          {
            label: dictionary.builder.guardrails.linkedFiles,
            value: bundle.codeSyncState.linkedFileCount,
          },
          {
            label: dictionary.builder.guardrails.safeRefreshable,
            value: bundle.codeSyncState.safeRefreshableFileCount,
          },
          {
            label: dictionary.builder.guardrails.visualManaged,
            value: bundle.codeSyncState.visualManagedFileCount,
          },
          {
            label: dictionary.builder.guardrails.confirmationNeeded,
            value: bundle.codeSyncState.blockedFileCount,
          },
        ]}
      />

      {!canReviewCode ? (
        <Card className="px-5 py-5">
          <p className="text-sm leading-7 text-muted-foreground">{codePermissionCopy}</p>
        </Card>
      ) : null}

      {selectedSyncRecord && (selectedSyncRecord.needsSync || fileStaleProposalCount > 0) ? (
        <CodeRefreshRecoveryCard
          locale={locale}
          dictionary={dictionary}
          selectedFile={selectedFile}
          syncRecord={selectedSyncRecord}
          refreshCandidate={selectedRefreshCandidate}
          pendingProposalCount={filePendingProposalCount}
          staleProposalCount={fileStaleProposalCount}
          restoreReviewHref={scaffoldRestoreHref}
          safeRefreshAction={safeRefreshAction}
          canRestore={canRestoreCode}
          readOnlyCopy={codePermissionCopy}
        />
      ) : null}

      {editable && selectedRestoreTarget ? (
        <CodeRestoreReviewCard
          locale={locale}
          dictionary={dictionary}
          workspaceSlug={bundle.workspace.slug}
          projectSlug={bundle.project.slug}
          selectedFile={selectedFile}
          currentRevision={currentRevision}
          targetType={selectedRestoreTarget.type}
          targetRevision={selectedRestoreTarget.revision}
          targetRevisionNumber={selectedRestoreTarget.revisionNumber}
          targetContentMatchesCurrent={restoreTargetMatchesCurrent}
          restoreAction={restoreRevisionAction}
          canRestore={canRestoreCode}
          readOnlyCopy={codePermissionCopy}
        />
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[290px_minmax(0,1fr)_340px]">
        <Card className="px-5 py-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.builder.code.fileTree}
            </p>
            <Badge>{bundle.files.length}</Badge>
          </div>
          <div className="mt-4 space-y-1">
            {tree.map((node) => {
              if (node.kind === "folder") {
                return (
                  <div
                    key={node.path}
                    className="rounded-2xl px-3 py-2 text-sm font-semibold text-card-foreground"
                    style={{ marginLeft: `${node.depth * 12}px` }}
                  >
                    {node.name}
                  </div>
                );
              }

              const active = node.path === selectedFile.path;

              return (
                <Link
                  key={node.path}
                  href={buildCodeHref(locale, bundle.workspace.slug, bundle.project.slug, node.path)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm transition",
                    active
                      ? "border border-primary/35 bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
                  )}
                  style={{ marginLeft: `${node.depth * 12}px` }}
                >
                  <span>{node.name}</span>
                  {node.fileKind ? (
                    <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {codeFileKindLabels[node.fileKind][locale]}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden border-border/80">
            <div className="border-b border-border px-5 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {dictionary.builder.code.openFiles}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {openFiles.map((file) => {
                  const active = file.path === selectedFile.path;

                  return (
                    <Link
                      key={file.path}
                      href={buildCodeHref(locale, bundle.workspace.slug, bundle.project.slug, file.path)}
                      className={active ? buttonStyles("primary") : buttonStyles("secondary")}
                    >
                      {file.name}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="border-b border-border bg-background/60 px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-card-foreground">{selectedFile.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {selectedFile.path}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{codeFileKindLabels[selectedFile.kind][locale]}</Badge>
                  <Badge>{codeFileOwnershipLabels[selectedFile.ownership][locale]}</Badge>
                  <Badge>{selectedFile.language}</Badge>
                  {selectedFile.draftContent ? <Badge>{dictionary.builder.code.draftPresent}</Badge> : null}
                </div>
              </div>
            </div>

            {editable ? (
              <form className="space-y-4 bg-slate-950 px-5 py-5 text-slate-100">
                <input type="hidden" name="codeStateId" value={bundle.codeState.id} />
                <input type="hidden" name="fileId" value={selectedFile.id} />
                <input type="hidden" name="filePath" value={selectedFile.path} />
                <input type="hidden" name="expectedRevisionNumber" value={selectedFile.currentRevisionNumber} />

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div>
                    <label className="block">
                      <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        {dictionary.builder.code.editorTitle}
                      </span>
                      <textarea
                        name="content"
                        defaultValue={workingContent}
                        data-testid="code-editor-content"
                        className="mt-3 min-h-[420px] w-full rounded-[28px] border border-white/10 bg-slate-950 px-5 py-5 font-mono text-sm leading-7 text-slate-100 outline-none transition focus:border-sky-400/40"
                      />
                    </label>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        {dictionary.builder.code.changeSummary}
                      </p>
                      <input
                        name="changeSummary"
                        defaultValue=""
                        className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400/40"
                      />
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {dictionary.builder.code.changeSummaryHelper}
                      </p>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        {dictionary.builder.code.draftState}
                      </p>
                      <p className="mt-3 text-sm font-semibold text-slate-100">
                        {selectedFile.draftContent
                          ? dictionary.builder.code.draftPresent
                          : dictionary.builder.code.draftMissing}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {selectedFile.draftUpdatedAt
                          ? `${dictionary.builder.code.draftUpdated}: ${formatDateTimeLabel(selectedFile.draftUpdatedAt, locale)}`
                          : dictionary.builder.code.noDraftCopy}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button formAction={saveDraftAction} variant="secondary" data-testid="code-save-draft">
                        {dictionary.builder.code.saveDraft}
                      </Button>
                      <Button formAction={saveRevisionAction} data-testid="code-save-revision">
                        {dictionary.builder.code.saveRevision}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            ) : (
              <div className="space-y-4 bg-slate-950 px-0 py-0 text-slate-100">
                <div className="border-b border-white/10 px-5 py-4">
                  <p className="text-sm font-semibold text-white">{dictionary.builder.code.lockedTitle}</p>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
                    {canReviewCode ? dictionary.builder.code.lockedCopy : codePermissionCopy}
                  </p>
                </div>
                <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-0 border-b border-white/10 px-5 py-3 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <span>#</span>
                  <span>{dictionary.builder.code.activeFile}</span>
                </div>
                <div className="overflow-x-auto px-0 py-4">
                  {workingContent.split("\n").map((line, index) => (
                    <div
                      key={`${index + 1}-${line}`}
                      className="grid grid-cols-[64px_minmax(0,1fr)] gap-0 px-5 py-0.5 font-mono text-sm"
                    >
                      <span className="select-none pr-4 text-right text-slate-500">{index + 1}</span>
                      <span className="whitespace-pre text-slate-200">{line || " "}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {selectedProposal ? (
            <div className="space-y-4">
              <Card
                id={`proposal-${selectedProposal.id}`}
                className="px-5 py-5"
                data-testid="patch-proposal-review-card"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {dictionary.builder.code.patchReviewTitle}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-card-foreground">{selectedProposal.title}</p>
                      <Badge>{proposalStatusLabel(dictionary, selectedProposal)}</Badge>
                      {selectedProposal.archivedAt ? <Badge>{dictionary.builder.code.proposalArchived}</Badge> : null}
                    </div>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      {selectedProposal.rationale}
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4 text-sm leading-6 text-card-foreground">
                    {dictionary.plan.revisionPrefix} {selectedProposal.baseRevisionNumber ?? selectedFile.currentRevisionNumber}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {dictionary.builder.code.proposalBaseRevision}
                        </p>
                        <p className="mt-3 text-lg font-semibold text-card-foreground">
                          {selectedProposal.baseRevisionNumber ?? selectedFile.currentRevisionNumber}
                        </p>
                      </div>
                      <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {selectedProposal.status === "stale"
                            ? dictionary.builder.code.proposalInvalidatedRevision
                            : selectedProposal.status === "applied"
                              ? dictionary.builder.code.proposalResolvedRevision
                              : dictionary.builder.code.proposalCurrentRevision}
                        </p>
                        <p className="mt-3 text-lg font-semibold text-card-foreground">
                          {selectedProposal.status === "stale"
                            ? selectedProposal.invalidatedByRevisionNumber ?? selectedFile.currentRevisionNumber
                            : selectedProposal.status === "applied"
                              ? resolvedProposalRevision?.revisionNumber ?? selectedFile.currentRevisionNumber
                              : selectedFile.currentRevisionNumber}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {dictionary.builder.code.patchRequest}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-card-foreground">
                        {selectedProposal.requestPrompt}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {dictionary.builder.code.patchSummary}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-card-foreground">
                        {selectedProposal.changeSummary}
                      </p>
                    </div>
                    {selectedProposal.resolutionNote ? (
                      <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {dictionary.builder.code.patchResolution}
                        </p>
                        <p className="mt-3 text-sm leading-7 text-card-foreground">
                          {selectedProposal.resolutionNote}
                        </p>
                        {selectedProposal.resolvedAt ? (
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {formatDateTimeLabel(selectedProposal.resolvedAt, locale)}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {selectedProposal.status === "stale" ? (
                      <div className="rounded-[24px] border border-amber-500/30 bg-amber-500/10 px-4 py-4">
                        <p className="text-sm font-semibold text-card-foreground">
                          {dictionary.builder.code.proposalStale}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">
                          {dictionary.builder.code.proposalNeedsRefreshCopy}
                        </p>
                      </div>
                    ) : null}
                    {selectedProposal.archivedAt ? (
                      <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {dictionary.builder.code.proposalArchived}
                        </p>
                        <p className="mt-3 text-sm leading-7 text-card-foreground">
                          {selectedProposal.archiveReason ?? dictionary.builder.code.archiveProposalDefault}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {formatDateTimeLabel(selectedProposal.archivedAt, locale)}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {dictionary.builder.code.patchApplyState}
                      </p>
                      <p className="mt-3 text-sm font-semibold text-card-foreground">
                        {selectedProposal.archivedAt
                          ? dictionary.builder.code.proposalArchived
                          : canApplyProposal
                            ? dictionary.builder.code.patchSafeToApply
                            : selectedProposal.status === "stale"
                              ? dictionary.builder.code.proposalStale
                              : editable
                                ? dictionary.builder.code.patchUnsafeState
                                : dictionary.builder.code.patchLockedState}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {selectedProposal.archivedAt
                          ? selectedProposal.archiveReason ?? dictionary.builder.code.archiveProposalDefault
                          : selectedProposal.status === "stale"
                            ? dictionary.builder.code.proposalNeedsRefreshCopy
                            : selectedSyncRecord?.needsSync
                              ? dictionary.builder.code.patchUnsafeCopy
                              : editable
                                ? dictionary.builder.code.patchApplyCopy
                                : dictionary.builder.code.patchLockedCopy}
                      </p>
                    </div>

                    {selectedProposal.status === "pending" ? (
                      <>
                        <form action={applyPatchProposalAction}>
                          <input type="hidden" name="filePath" value={selectedFile.path} />
                          <input type="hidden" name="proposalId" value={selectedProposal.id} />
                          <Button disabled={!canApplyProposal} data-testid="code-apply-proposal">
                            {dictionary.builder.code.applyProposal}
                          </Button>
                        </form>
                        <form action={rejectPatchProposalAction} className="space-y-3">
                          <input type="hidden" name="filePath" value={selectedFile.path} />
                          <input type="hidden" name="proposalId" value={selectedProposal.id} />
                          <label className="block">
                            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              {dictionary.builder.code.rejectReason}
                            </span>
                            <input
                              name="rejectionReason"
                              placeholder={dictionary.builder.code.rejectReasonPlaceholder}
                              disabled={!canManageProposals}
                              className="mt-3 w-full rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm text-card-foreground outline-none transition focus:border-primary/40"
                            />
                          </label>
                          <Button variant="secondary" disabled={!canManageProposals} data-testid="code-reject-proposal">
                            {dictionary.builder.code.rejectProposal}
                          </Button>
                        </form>
                      </>
                    ) : null}
                    {canArchiveProposal ? (
                      <form action={archivePatchProposalAction} className="space-y-3">
                        <input type="hidden" name="filePath" value={selectedFile.path} />
                        <input type="hidden" name="proposalId" value={selectedProposal.id} />
                        <label className="block">
                          <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            {dictionary.builder.code.archiveReason}
                          </span>
                          <input
                            name="archiveReason"
                            placeholder={dictionary.builder.code.archiveReasonPlaceholder}
                            disabled={!canManageProposals}
                            className="mt-3 w-full rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm text-card-foreground outline-none transition focus:border-primary/40"
                          />
                        </label>
                        <Button
                          variant="secondary"
                          disabled={!canManageProposals}
                          data-testid="code-archive-proposal"
                        >
                          {dictionary.builder.code.archiveProposal}
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </Card>

              <CodePatchProposalTraceCard
                locale={locale}
                dictionary={dictionary}
                selectedProposal={selectedProposal}
                adapterRun={selectedProposalAdapterRun}
                createPatchProposalAction={createPatchProposalAction}
                canRetry={canRequestProposal}
                readOnlyCopy={codePermissionCopy}
              />

              <CodePatchProposalCompareCard
                locale={locale}
                dictionary={dictionary}
                workspaceSlug={bundle.workspace.slug}
                projectSlug={bundle.project.slug}
                filePath={selectedFile.path}
                selectedProposal={selectedProposal}
                selectedAdapterRun={patchComparison.selectedAdapterRun}
                comparisonProposal={patchComparison.comparisonProposal}
                comparisonAdapterRun={patchComparison.comparisonAdapterRun}
                selectedComparisonProposalId={selectedProposalComparisonId}
              />
            </div>
          ) : null}

          {diffTitle ? (
            <CodeDiffView dictionary={dictionary} title={diffTitle} lines={diffLines} />
          ) : (
            <Card className="px-5 py-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {dictionary.builder.code.noDiffTitle}
              </p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {dictionary.builder.code.noDiffCopy}
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <ModelAdapterRunHistoryCard
            locale={locale}
            dictionary={dictionary}
            title={dictionary.plan.modelAdapters.runHistory.title}
            copy={dictionary.plan.modelAdapters.runHistory.codeCopy}
            runs={modelAdapterRuns}
            allowedCapabilities={["patch_suggestion"]}
            defaultCapability="patch_suggestion"
            codeHrefBase={projectTabRoute(locale, bundle.workspace.slug, bundle.project.slug, "code")}
            testIdPrefix="code-provider-run-history"
          />

          <CodePatchRequestCard
            dictionary={dictionary}
            filePath={selectedFile.path}
            canManageProposals={canManageProposals}
            canRequestProposal={canRequestProposal}
            stateTitle={
              !canManageProposals
                ? dictionary.builder.code.patchLockedState
                : !editable
                  ? dictionary.builder.code.patchLockedState
                  : selectedSyncRecord?.needsSync
                    ? dictionary.builder.code.patchUnsafeState
                    : dictionary.builder.code.patchReadyState
            }
            stateCopy={
              !canManageProposals
                ? codePermissionCopy
                : !editable
                  ? canReviewCode
                    ? dictionary.builder.code.patchLockedCopy
                    : codePermissionCopy
                  : selectedSyncRecord?.needsSync
                    ? dictionary.builder.code.patchUnsafeCopy
                    : dictionary.builder.code.patchReadyCopy
            }
            action={createPatchProposalAction}
          />

          <CodePatchProposalHistory
            locale={locale}
            dictionary={dictionary}
            workspaceSlug={bundle.workspace.slug}
            projectSlug={bundle.project.slug}
            filePath={selectedFile.path}
            proposals={filePatchProposals}
            adapterRuns={patchAdapterRuns}
            selectedProposalId={selectedProposalId}
            selectedProposalComparisonId={selectedProposalComparisonId}
          />

          <Card className="px-5 py-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.builder.code.ownershipTitle}
            </p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                <p className="text-sm font-semibold text-card-foreground">
                  {codeFileOwnershipLabels[selectedFile.ownership][locale]}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {selectedFile.ownership === "visual_owned"
                    ? dictionary.builder.code.visualOwnedCopy
                    : dictionary.builder.code.scaffoldOwnedCopy}
                </p>
              </div>
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                <p className="text-sm font-semibold text-card-foreground">{dictionary.builder.code.editPolicyTitle}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {selectedFile.editPolicy === "locked"
                    ? dictionary.builder.code.lockedPolicy
                    : dictionary.builder.code.editablePolicy}
                </p>
              </div>
            </div>
          </Card>

          <Card className="px-5 py-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.builder.guardrails.syncStatusTitle}
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                <p className="text-sm font-semibold text-card-foreground">
                  {selectedSyncRecord
                    ? syncStatusLabel(dictionary, selectedSyncRecord)
                    : dictionary.builder.guardrails.statusUnlinked}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {selectedSyncRecord
                    ? syncStatusCopy(dictionary, selectedSyncRecord)
                    : dictionary.builder.guardrails.copyUnlinked}
                </p>
              </div>
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                <p className="text-sm font-semibold text-card-foreground">{dictionary.builder.code.sourceVisual}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {formatDateTimeLabel(bundle.visualState.updatedAt, locale)}
                </p>
              </div>
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                <p className="text-sm font-semibold text-card-foreground">{dictionary.builder.code.generatedAt}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {formatDateTimeLabel(bundle.codeState.lastGeneratedAt, locale)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="px-5 py-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.builder.guardrails.linkageTitle}
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                <p className="text-sm font-semibold text-card-foreground">
                  {dictionary.builder.guardrails.linkedPages}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {selectedSyncRecord?.linkedPageIds.length ?? 0}
                </p>
              </div>
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                <p className="text-sm font-semibold text-card-foreground">
                  {dictionary.builder.guardrails.linkedSections}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {selectedSyncRecord?.linkedSectionIds.length ?? 0}
                </p>
              </div>
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                <p className="text-sm font-semibold text-card-foreground">
                  {dictionary.builder.guardrails.linkedTargets}
                </p>
                {selectedSyncRecord && selectedSyncRecord.targetLabels.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedSyncRecord.targetLabels.map((label) => (
                      <Badge key={label}>{label}</Badge>
                    ))}
                  </div>
                ) : fileLinks.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {fileLinks.map((link) => (
                      <Badge key={link.id}>{link.targetLabel}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {dictionary.builder.guardrails.noLinkedTargets}
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="px-5 py-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.builder.code.ownershipRulesTitle}
            </p>
            <div className="mt-4 space-y-3">
              {dictionary.builder.code.ownershipRules.map((rule) => (
                <div key={rule} className="rounded-[24px] border border-border bg-background/70 px-4 py-4 text-sm leading-7 text-card-foreground">
                  {rule}
                </div>
              ))}
            </div>
          </Card>

          <Card className="px-5 py-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.builder.code.structureCoverage}
            </p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4 text-sm leading-6 text-card-foreground">
                {dictionary.builder.code.pageScaffolds}: {visualPages}
              </div>
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4 text-sm leading-6 text-card-foreground">
                {dictionary.builder.code.dataModels}: {bundle.project.structuredPlan.dataModels.length}
              </div>
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4 text-sm leading-6 text-card-foreground">
                {dictionary.builder.code.integrations}: {bundle.project.structuredPlan.integrationsNeeded.length}
              </div>
            </div>
          </Card>

          <CodeRevisionHistory
            locale={locale}
            dictionary={dictionary}
            workspaceSlug={bundle.workspace.slug}
            projectSlug={bundle.project.slug}
            filePath={selectedFile.path}
            revisions={fileRevisions}
            currentRevisionId={selectedFile.currentRevisionId}
            selectedCompareRevisionId={selectedCompareRevisionId}
            selectedRestoreRevisionId={selectedRestoreRevisionId}
            selectedRestoreScaffold={selectedRestoreScaffold}
            canRestoreScaffold={editable && canRestoreCode && selectedRefreshCandidate !== null}
            canRestoreRevision={canRestoreCode}
          />
        </div>
      </section>
    </div>
  );
}
