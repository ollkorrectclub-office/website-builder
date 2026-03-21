import type {
  BuilderRefreshQueueSummaryRecord,
  ProjectBuilderRefreshQueueItemRecord,
  ProjectVisualBundle,
  VisualThemeTokens,
  VisualRefreshDiffPageRecord,
  VisualRefreshDiffRecord,
  VisualRefreshDiffSectionRecord,
  VisualSectionContentPayload,
  VisualSectionRecord,
} from "@/lib/builder/types";
import type { ProjectGenerationTargetBundle } from "@/lib/generation/types";

function compareContentPayload(
  beforePayload: VisualSectionContentPayload,
  afterPayload: VisualSectionContentPayload,
) {
  return JSON.stringify(beforePayload) !== JSON.stringify(afterPayload);
}

function sortQueueItems(items: ProjectBuilderRefreshQueueItemRecord[]) {
  return [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function buildRefreshQueueSummary(
  items: ProjectBuilderRefreshQueueItemRecord[],
): BuilderRefreshQueueSummaryRecord {
  const pendingCount = items.filter((item) => item.status === "pending").length;
  const deferredCount = items.filter((item) => item.status === "deferred").length;
  const staleCount = items.filter((item) => item.status === "stale").length;
  const completedCount = items.filter((item) => item.status === "completed").length;

  return {
    pendingCount,
    deferredCount,
    staleCount,
    completedCount,
    activeItems: sortQueueItems(items).filter((item) => item.status !== "completed"),
  };
}

function sectionsByPage(
  sections: Array<
    Pick<
      VisualSectionRecord,
      "pageId" | "sectionKey" | "sectionType" | "label" | "title" | "isVisible" | "contentPayload" | "orderIndex"
    >
  >,
) {
  return sections.reduce<Record<string, typeof sections>>((accumulator, section) => {
    accumulator[section.pageId] = [...(accumulator[section.pageId] ?? []), section];
    return accumulator;
  }, {} as Record<string, typeof sections>);
}

export function buildVisualRefreshDiff(
  bundle: ProjectVisualBundle,
  target: Pick<ProjectGenerationTargetBundle, "run" | "themeTarget" | "visualPages" | "visualSections">,
): VisualRefreshDiffRecord {
  const currentPagesByKey = new Map(bundle.visualPages.map((page) => [page.pageKey, page]));
  const targetPagesByKey = new Map(target.visualPages.map((page) => [page.pageKey, page]));
  const currentSectionsByPageId = sectionsByPage(bundle.visualSections);
  const targetSectionsByPageId = sectionsByPage(target.visualSections);
  const allPageKeys = Array.from(new Set([...currentPagesByKey.keys(), ...targetPagesByKey.keys()])).sort();

  const pageChanges: VisualRefreshDiffPageRecord[] = [];
  const sectionChanges: VisualRefreshDiffSectionRecord[] = [];

  for (const pageKey of allPageKeys) {
    const beforePage = currentPagesByKey.get(pageKey) ?? null;
    const afterPage = targetPagesByKey.get(pageKey) ?? null;
    const beforeSections = beforePage ? currentSectionsByPageId[beforePage.id] ?? [] : [];
    const afterSections = afterPage ? targetSectionsByPageId[afterPage.id] ?? [] : [];

    if (!beforePage && afterPage) {
      pageChanges.push({
        pageKey,
        changeType: "added",
        beforeTitle: null,
        afterTitle: afterPage.title,
        beforeSlug: null,
        afterSlug: afterPage.slug,
        sectionAddedCount: afterSections.length,
        sectionRemovedCount: 0,
        sectionChangedCount: 0,
      });

      sectionChanges.push(
        ...afterSections.map((section) => ({
          pageKey,
          pageTitle: afterPage.title,
          sectionKey: section.sectionKey,
          changeType: "added" as const,
          beforeLabel: null,
          afterLabel: section.label,
          beforeType: null,
          afterType: section.sectionType,
          contentChanged: false,
          visibilityChanged: false,
        })),
      );
      continue;
    }

    if (beforePage && !afterPage) {
      pageChanges.push({
        pageKey,
        changeType: "removed",
        beforeTitle: beforePage.title,
        afterTitle: null,
        beforeSlug: beforePage.slug,
        afterSlug: null,
        sectionAddedCount: 0,
        sectionRemovedCount: beforeSections.length,
        sectionChangedCount: 0,
      });

      sectionChanges.push(
        ...beforeSections.map((section) => ({
          pageKey,
          pageTitle: beforePage.title,
          sectionKey: section.sectionKey,
          changeType: "removed" as const,
          beforeLabel: section.label,
          afterLabel: null,
          beforeType: section.sectionType,
          afterType: null,
          contentChanged: false,
          visibilityChanged: false,
        })),
      );
      continue;
    }

    if (!beforePage || !afterPage) {
      continue;
    }

    const beforeSectionsByKey = new Map(beforeSections.map((section) => [section.sectionKey, section]));
    const afterSectionsByKey = new Map(afterSections.map((section) => [section.sectionKey, section]));
    const allSectionKeys = Array.from(
      new Set([...beforeSectionsByKey.keys(), ...afterSectionsByKey.keys()]),
    ).sort();

    let sectionAddedCount = 0;
    let sectionRemovedCount = 0;
    let sectionChangedCount = 0;

    for (const sectionKey of allSectionKeys) {
      const beforeSection = beforeSectionsByKey.get(sectionKey) ?? null;
      const afterSection = afterSectionsByKey.get(sectionKey) ?? null;

      if (!beforeSection && afterSection) {
        sectionAddedCount += 1;
        sectionChanges.push({
          pageKey,
          pageTitle: afterPage.title,
          sectionKey,
          changeType: "added",
          beforeLabel: null,
          afterLabel: afterSection.label,
          beforeType: null,
          afterType: afterSection.sectionType,
          contentChanged: false,
          visibilityChanged: false,
        });
        continue;
      }

      if (beforeSection && !afterSection) {
        sectionRemovedCount += 1;
        sectionChanges.push({
          pageKey,
          pageTitle: beforePage.title,
          sectionKey,
          changeType: "removed",
          beforeLabel: beforeSection.label,
          afterLabel: null,
          beforeType: beforeSection.sectionType,
          afterType: null,
          contentChanged: false,
          visibilityChanged: false,
        });
        continue;
      }

      if (!beforeSection || !afterSection) {
        continue;
      }

      const contentChanged = compareContentPayload(beforeSection.contentPayload, afterSection.contentPayload);
      const visibilityChanged = beforeSection.isVisible !== afterSection.isVisible;
      const metadataChanged =
        beforeSection.label !== afterSection.label ||
        beforeSection.title !== afterSection.title ||
        beforeSection.sectionType !== afterSection.sectionType;

      if (contentChanged || visibilityChanged || metadataChanged) {
        sectionChangedCount += 1;
        sectionChanges.push({
          pageKey,
          pageTitle: afterPage.title,
          sectionKey,
          changeType: "changed",
          beforeLabel: beforeSection.label,
          afterLabel: afterSection.label,
          beforeType: beforeSection.sectionType,
          afterType: afterSection.sectionType,
          contentChanged,
          visibilityChanged,
        });
      }
    }

    if (
      beforePage.title !== afterPage.title ||
      beforePage.slug !== afterPage.slug ||
      sectionAddedCount > 0 ||
      sectionRemovedCount > 0 ||
      sectionChangedCount > 0
    ) {
      pageChanges.push({
        pageKey,
        changeType: "changed",
        beforeTitle: beforePage.title,
        afterTitle: afterPage.title,
        beforeSlug: beforePage.slug,
        afterSlug: afterPage.slug,
        sectionAddedCount,
        sectionRemovedCount,
        sectionChangedCount,
      });
    }
  }

  const themeTokenKeys = Object.keys(bundle.visualState.themeTokens) as Array<keyof VisualThemeTokens>;
  const themeTokenChanges = themeTokenKeys
    .map((tokenKey) => ({
      tokenKey,
      beforeValue: bundle.visualState.themeTokens[tokenKey],
      afterValue: target.themeTarget[tokenKey],
    }))
    .filter((change) => change.beforeValue !== change.afterValue);

  return {
    currentRevisionNumber: bundle.syncState.sourceRevisionNumber,
    targetRevisionNumber: target.run.sourcePlanRevisionNumber,
    currentPageCount: bundle.visualPages.length,
    targetPageCount: target.visualPages.length,
    currentSectionCount: bundle.visualSections.length,
    targetSectionCount: target.visualSections.length,
    addedPageCount: pageChanges.filter((change) => change.changeType === "added").length,
    removedPageCount: pageChanges.filter((change) => change.changeType === "removed").length,
    changedPageCount: pageChanges.filter((change) => change.changeType === "changed").length,
    addedSectionCount: sectionChanges.filter((change) => change.changeType === "added").length,
    removedSectionCount: sectionChanges.filter((change) => change.changeType === "removed").length,
    changedSectionCount: sectionChanges.filter((change) => change.changeType === "changed").length,
    changedThemeTokenCount: themeTokenChanges.length,
    themeTokenChanges,
    pageChanges,
    sectionChanges,
  };
}
