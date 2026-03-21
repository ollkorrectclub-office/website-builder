import { notFound } from "next/navigation";

import { VisualBuilderWorkspace } from "@/components/builder/visual-builder-workspace";
import {
  acceptVisualRefreshQueueAction,
  deferVisualRefreshQueueAction,
  moveVisualSectionAction,
  regenerateVisualScaffoldAction,
  updateVisualSectionAction,
  updateVisualThemeTokensAction,
} from "@/lib/builder/actions";
import { getProjectCodeBundle } from "@/lib/builder/code-repository";
import { buildVisualRefreshDiff } from "@/lib/builder/refresh-queue-review";
import {
  getActiveBuilderRefreshQueueItem,
  getRelevantBuilderRefreshQueueItem,
  listProjectBuilderRefreshQueue,
} from "@/lib/builder/refresh-queue-repository";
import { projectTabRoute } from "@/lib/builder/routes";
import { getProjectGenerationBundle, getProjectGenerationTargetBundle } from "@/lib/generation/repository";
import { findLatestCompletedGenerationRun } from "@/lib/generation/runs";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getProjectVisualBundle } from "@/lib/builder/repository";
import type { Locale } from "@/lib/i18n/locales";

export default async function ProjectVisualPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; workspaceSlug: string; projectSlug: string }>;
  searchParams: Promise<{ page?: string; section?: string }>;
}) {
  const { locale, workspaceSlug, projectSlug } = await params;
  const { page, section } = await searchParams;
  const dictionary = getDictionary(locale);
  const [bundle, codeBundle, refreshQueue, generationBundle] = await Promise.all([
    getProjectVisualBundle(workspaceSlug, projectSlug),
    getProjectCodeBundle(workspaceSlug, projectSlug),
    listProjectBuilderRefreshQueue(workspaceSlug, projectSlug),
    getProjectGenerationBundle(workspaceSlug, projectSlug),
  ]);

  if (!bundle) {
    notFound();
  }

  const selectedPageId =
    bundle.visualPages.find((item) => item.id === page)?.id ?? bundle.visualPages[0]?.id ?? "";
  const pageSections = bundle.visualSections.filter((item) => item.pageId === selectedPageId);
  const selectedSectionId =
    pageSections.find((item) => item.id === section)?.id ?? pageSections[0]?.id ?? null;
  const activeQueueItem = getActiveBuilderRefreshQueueItem(refreshQueue, "visual");
  const relevantQueueItem = getRelevantBuilderRefreshQueueItem(refreshQueue, "visual");
  const latestGenerationRun = generationBundle
    ? findLatestCompletedGenerationRun(generationBundle.runs)
    : null;
  const queueGenerationRun =
    relevantQueueItem?.generationRunId && generationBundle
      ? generationBundle.runs.find((run) => run.id === relevantQueueItem.generationRunId) ?? null
      : null;
  const generationTarget =
    activeQueueItem?.generationRunId
      ? await getProjectGenerationTargetBundle(workspaceSlug, projectSlug, activeQueueItem.generationRunId)
      : null;
  const queueDiff =
    activeQueueItem && generationTarget
      ? buildVisualRefreshDiff(bundle, generationTarget)
      : null;
  const replacementHref =
    relevantQueueItem?.status === "stale" && latestGenerationRun
      ? `${projectTabRoute(locale, workspaceSlug, projectSlug, "plan")}?generationRun=${encodeURIComponent(
          latestGenerationRun.id,
        )}#generation-run-${latestGenerationRun.id}`
      : null;

  return (
    <VisualBuilderWorkspace
      locale={locale as Locale}
      dictionary={dictionary}
      bundle={bundle}
      selectedPageId={selectedPageId}
      selectedSectionId={selectedSectionId}
      updateSectionAction={updateVisualSectionAction.bind(null, locale, workspaceSlug, projectSlug)}
      moveUpAction={moveVisualSectionAction.bind(null, locale, workspaceSlug, projectSlug, "up")}
      moveDownAction={moveVisualSectionAction.bind(null, locale, workspaceSlug, projectSlug, "down")}
      updateThemeTokensAction={updateVisualThemeTokensAction.bind(null, locale, workspaceSlug, projectSlug)}
      regenerateAction={regenerateVisualScaffoldAction.bind(null, locale, workspaceSlug, projectSlug)}
      acceptQueueAction={acceptVisualRefreshQueueAction.bind(null, locale, workspaceSlug, projectSlug)}
      deferQueueAction={deferVisualRefreshQueueAction.bind(null, locale, workspaceSlug, projectSlug)}
      activeQueueItem={relevantQueueItem}
      queueGenerationRun={queueGenerationRun}
      latestGenerationRun={latestGenerationRun}
      queueReplacementHref={replacementHref}
      queueDiff={queueDiff}
      codeSyncState={codeBundle?.codeSyncState ?? null}
    />
  );
}
