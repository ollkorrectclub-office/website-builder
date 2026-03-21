import { notFound } from "next/navigation";

import { CodeWorkspace } from "@/components/builder/code-workspace";
import {
  archiveCodePatchProposalAction,
  applyCodePatchProposalAction,
  completeCodeRefreshQueueAction,
  createCodePatchProposalAction,
  deferCodeRefreshQueueAction,
  refreshCodeScaffoldAction,
  rejectCodePatchProposalAction,
  restoreCodeFileRevisionAction,
  saveCodeFileDraftAction,
  saveCodeFileRevisionAction,
} from "@/lib/builder/code-actions";
import { getProjectCodeBundle } from "@/lib/builder/code-repository";
import {
  getRelevantBuilderRefreshQueueItem,
  listProjectBuilderRefreshQueue,
} from "@/lib/builder/refresh-queue-repository";
import { projectTabRoute } from "@/lib/builder/routes";
import { getProjectGenerationBundle } from "@/lib/generation/repository";
import { findLatestCompletedGenerationRun } from "@/lib/generation/runs";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { getProjectModelAdapterBundle } from "@/lib/model-adapters/repository";

export default async function ProjectCodePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; workspaceSlug: string; projectSlug: string }>;
  searchParams: Promise<{
    file?: string;
    compare?: string;
    proposal?: string;
    proposalCompare?: string;
    restoreRevision?: string;
    restoreScaffold?: string;
  }>;
}) {
  const { locale, workspaceSlug, projectSlug } = await params;
  const { file, compare, proposal, proposalCompare, restoreRevision, restoreScaffold } =
    await searchParams;
  const dictionary = getDictionary(locale);
  const [bundle, refreshQueue, generationBundle, modelAdapterBundle] = await Promise.all([
    getProjectCodeBundle(workspaceSlug, projectSlug),
    listProjectBuilderRefreshQueue(workspaceSlug, projectSlug),
    getProjectGenerationBundle(workspaceSlug, projectSlug),
    getProjectModelAdapterBundle(workspaceSlug, projectSlug),
  ]);

  if (!bundle || !modelAdapterBundle) {
    notFound();
  }

  const activeQueueItem = getRelevantBuilderRefreshQueueItem(refreshQueue, "code");
  const latestGenerationRun = generationBundle
    ? findLatestCompletedGenerationRun(generationBundle.runs)
    : null;
  const queueGenerationRun =
    activeQueueItem?.generationRunId && generationBundle
      ? generationBundle.runs.find((run) => run.id === activeQueueItem.generationRunId) ?? null
      : null;
  const replacementHref =
    activeQueueItem?.status === "stale" && latestGenerationRun
      ? `${projectTabRoute(locale, workspaceSlug, projectSlug, "plan")}?generationRun=${encodeURIComponent(
          latestGenerationRun.id,
        )}#generation-run-${latestGenerationRun.id}`
      : null;

  return (
    <CodeWorkspace
      locale={locale as Locale}
      dictionary={dictionary}
      bundle={bundle}
      selectedFilePath={file ?? null}
      selectedCompareRevisionId={compare ?? null}
      selectedProposalId={proposal ?? null}
      selectedProposalComparisonId={proposalCompare ?? null}
      selectedRestoreRevisionId={restoreRevision ?? null}
      selectedRestoreScaffold={restoreScaffold === "1"}
      activeQueueItem={activeQueueItem}
      modelAdapterRuns={modelAdapterBundle.runs}
      queueGenerationRun={queueGenerationRun}
      latestGenerationRun={latestGenerationRun}
      queueReplacementHref={replacementHref}
      saveDraftAction={saveCodeFileDraftAction.bind(null, locale, workspaceSlug, projectSlug)}
      saveRevisionAction={saveCodeFileRevisionAction.bind(null, locale, workspaceSlug, projectSlug)}
      restoreRevisionAction={restoreCodeFileRevisionAction.bind(null, locale, workspaceSlug, projectSlug)}
      createPatchProposalAction={createCodePatchProposalAction.bind(null, locale, workspaceSlug, projectSlug)}
      applyPatchProposalAction={applyCodePatchProposalAction.bind(null, locale, workspaceSlug, projectSlug)}
      rejectPatchProposalAction={rejectCodePatchProposalAction.bind(null, locale, workspaceSlug, projectSlug)}
      archivePatchProposalAction={archiveCodePatchProposalAction.bind(null, locale, workspaceSlug, projectSlug)}
      safeRefreshAction={refreshCodeScaffoldAction.bind(null, locale, workspaceSlug, projectSlug, "safe")}
      deferQueueAction={deferCodeRefreshQueueAction.bind(null, locale, workspaceSlug, projectSlug)}
      completeQueueAction={completeCodeRefreshQueueAction.bind(null, locale, workspaceSlug, projectSlug)}
    />
  );
}
