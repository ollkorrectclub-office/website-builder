import { buildProjectGenerationTargetBundle } from "@/lib/generation/targets";
import type {
  GenerationArtifactRecord,
  GenerationCodeFileTargetRecord,
  GenerationRouteTargetRecord,
  GenerationRunRecord,
  GenerationVisualSectionTargetRecord,
} from "@/lib/generation/types";
import type {
  ModelAdapterCapability,
  ModelAdapterRunRecord,
} from "@/lib/model-adapters/types";
import { buildPlannerRunDelta } from "@/lib/planner/deltas";
import type { PlannerRunRecord } from "@/lib/planner/types";
import type { ProjectCodePatchProposalRecord, VisualThemeTokens } from "@/lib/builder/types";

function linkedAdapterRun(
  runs: ModelAdapterRunRecord[],
  capability: ModelAdapterCapability,
  linkedEntityType: ModelAdapterRunRecord["linkedEntityType"],
  linkedEntityId: string,
) {
  return (
    runs.find(
      (run) =>
        run.capability === capability &&
        run.linkedEntityType === linkedEntityType &&
        run.linkedEntityId === linkedEntityId,
    ) ?? null
  );
}

function plannerContextKey(run: PlannerRunRecord) {
  return JSON.stringify({
    briefId: run.briefId,
    briefUpdatedAt: run.briefUpdatedAt,
    inputSnapshot: run.inputSnapshot,
  });
}

function patchContextKey(proposal: ProjectCodePatchProposalRecord) {
  return JSON.stringify({
    filePath: proposal.filePath,
    requestPrompt: proposal.requestPrompt,
    baseRevisionId: proposal.baseRevisionId,
    baseRevisionNumber: proposal.baseRevisionNumber,
    baseContent: proposal.baseContent,
  });
}

function candidateScore(
  selectedAdapterRun: ModelAdapterRunRecord | null,
  candidateAdapterRun: ModelAdapterRunRecord | null,
) {
  if (!selectedAdapterRun || !candidateAdapterRun) {
    return 0;
  }

  let score = 0;

  if (candidateAdapterRun.sourceType !== selectedAdapterRun.sourceType) {
    score += 8;
  }

  if (candidateAdapterRun.requestedSelection !== selectedAdapterRun.requestedSelection) {
    score += 4;
  }

  if (candidateAdapterRun.executionMode !== selectedAdapterRun.executionMode) {
    score += 2;
  }

  if (candidateAdapterRun.executedAdapterKey !== selectedAdapterRun.executedAdapterKey) {
    score += 1;
  }

  return score;
}

function chooseComparisonCandidate<T extends { id: string; startedAt?: string; createdAt?: string }>(
  candidates: T[],
  resolveAdapterRun: (candidate: T) => ModelAdapterRunRecord | null,
  selectedAdapterRun: ModelAdapterRunRecord | null,
) {
  return [...candidates].sort((left, right) => {
    const rightScore = candidateScore(selectedAdapterRun, resolveAdapterRun(right));
    const leftScore = candidateScore(selectedAdapterRun, resolveAdapterRun(left));

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    const rightTime = right.startedAt ?? right.createdAt ?? "";
    const leftTime = left.startedAt ?? left.createdAt ?? "";
    return rightTime.localeCompare(leftTime);
  })[0] ?? null;
}

function chooseExplicitCandidate<T extends { id: string }>(
  candidates: T[],
  explicitCandidateId: string | null | undefined,
) {
  if (!explicitCandidateId) {
    return null;
  }

  return candidates.find((candidate) => candidate.id === explicitCandidateId) ?? null;
}

export function findPlannerComparison(input: {
  selectedRun: PlannerRunRecord | null;
  explicitComparisonRunId?: string | null;
  runs: PlannerRunRecord[];
  adapterRuns: ModelAdapterRunRecord[];
}) {
  const selectedRun = input.selectedRun;
  const selectedAdapterRun = selectedRun
    ? linkedAdapterRun(input.adapterRuns, "planning", "planner_run", selectedRun.id)
    : null;

  if (!selectedRun) {
    return {
      selectedAdapterRun,
      comparisonRun: null,
      comparisonAdapterRun: null,
      delta: buildPlannerRunDelta(null, null),
    };
  }

  const candidates = input.runs.filter(
    (run) => run.id !== selectedRun.id && plannerContextKey(run) === plannerContextKey(selectedRun),
  );
  const comparisonRun =
    chooseExplicitCandidate(candidates, input.explicitComparisonRunId) ??
    chooseComparisonCandidate(
      candidates,
      (candidate) => linkedAdapterRun(input.adapterRuns, "planning", "planner_run", candidate.id),
      selectedAdapterRun,
    );
  const comparisonAdapterRun = comparisonRun
    ? linkedAdapterRun(input.adapterRuns, "planning", "planner_run", comparisonRun.id)
    : null;

  return {
    selectedAdapterRun,
    comparisonRun,
    comparisonAdapterRun,
    pairingMode: comparisonRun
      ? comparisonRun.id === input.explicitComparisonRunId
        ? "explicit"
        : "automatic"
      : "none",
    delta: buildPlannerRunDelta(selectedRun, comparisonRun),
  };
}

function generationArtifactsForRun(
  artifacts: GenerationArtifactRecord[],
  runId: string,
) {
  return artifacts.filter((artifact) => artifact.generationRunId === runId);
}

export function findGenerationComparison(input: {
  selectedRun: GenerationRunRecord | null;
  explicitComparisonRunId?: string | null;
  runs: GenerationRunRecord[];
  adapterRuns: ModelAdapterRunRecord[];
}) {
  const selectedRun = input.selectedRun;
  const selectedAdapterRun = selectedRun
    ? linkedAdapterRun(input.adapterRuns, "generation", "generation_run", selectedRun.id)
    : null;

  if (!selectedRun) {
    return {
      selectedAdapterRun,
      comparisonRun: null,
      comparisonAdapterRun: null,
    };
  }

  const candidates = input.runs.filter(
    (run) =>
      run.id !== selectedRun.id &&
      run.sourcePlanRevisionId === selectedRun.sourcePlanRevisionId,
  );
  const comparisonRun =
    chooseExplicitCandidate(candidates, input.explicitComparisonRunId) ??
    chooseComparisonCandidate(
      candidates,
      (candidate) => linkedAdapterRun(input.adapterRuns, "generation", "generation_run", candidate.id),
      selectedAdapterRun,
    );
  const comparisonAdapterRun = comparisonRun
    ? linkedAdapterRun(input.adapterRuns, "generation", "generation_run", comparisonRun.id)
    : null;

  return {
    selectedAdapterRun,
    comparisonRun,
    comparisonAdapterRun,
    pairingMode: comparisonRun
      ? comparisonRun.id === input.explicitComparisonRunId
        ? "explicit"
        : "automatic"
      : "none",
  };
}

export function findPatchProposalComparison(input: {
  selectedProposal: ProjectCodePatchProposalRecord | null;
  explicitComparisonProposalId?: string | null;
  proposals: ProjectCodePatchProposalRecord[];
  adapterRuns: ModelAdapterRunRecord[];
}) {
  const selectedProposal = input.selectedProposal;
  const selectedAdapterRun = selectedProposal
    ? linkedAdapterRun(input.adapterRuns, "patch_suggestion", "patch_proposal", selectedProposal.id)
    : null;

  if (!selectedProposal) {
    return {
      selectedAdapterRun,
      comparisonProposal: null,
      comparisonAdapterRun: null,
    };
  }

  const candidates = input.proposals.filter(
    (proposal) =>
      proposal.id !== selectedProposal.id &&
      patchContextKey(proposal) === patchContextKey(selectedProposal),
  );
  const comparisonProposal =
    chooseExplicitCandidate(candidates, input.explicitComparisonProposalId) ??
    chooseComparisonCandidate(
      candidates,
      (candidate) => linkedAdapterRun(input.adapterRuns, "patch_suggestion", "patch_proposal", candidate.id),
      selectedAdapterRun,
    );
  const comparisonAdapterRun = comparisonProposal
    ? linkedAdapterRun(input.adapterRuns, "patch_suggestion", "patch_proposal", comparisonProposal.id)
    : null;

  return {
    selectedAdapterRun,
    comparisonProposal,
    comparisonAdapterRun,
    pairingMode: comparisonProposal
      ? comparisonProposal.id === input.explicitComparisonProposalId
        ? "explicit"
        : "automatic"
      : "none",
  };
}

export type ComparisonChangeType = "added" | "removed" | "changed";

export interface GenerationRouteComparisonRecord {
  routePath: string;
  pageKey: string;
  changeType: ComparisonChangeType;
  beforeTitle: string | null;
  afterTitle: string | null;
  beforeSectionCount: number | null;
  afterSectionCount: number | null;
}

export interface GenerationVisualPageComparisonRecord {
  pageKey: string;
  changeType: ComparisonChangeType;
  beforeTitle: string | null;
  afterTitle: string | null;
  beforeSlug: string | null;
  afterSlug: string | null;
  sectionAddedCount: number;
  sectionRemovedCount: number;
  sectionChangedCount: number;
}

export interface GenerationVisualSectionComparisonRecord {
  pageKey: string;
  pageTitle: string;
  sectionKey: string;
  changeType: ComparisonChangeType;
  beforeLabel: string | null;
  afterLabel: string | null;
  beforeType: string | null;
  afterType: string | null;
  contentChanged: boolean;
  visibilityChanged: boolean;
}

export interface GenerationCodeFileComparisonRecord {
  path: string;
  changeType: ComparisonChangeType;
  beforeLineCount: number | null;
  afterLineCount: number | null;
  beforeOwnership: string | null;
  afterOwnership: string | null;
  beforeEditPolicy: string | null;
  afterEditPolicy: string | null;
  contentChanged: boolean;
}

export interface GenerationThemeTokenComparisonRecord {
  tokenKey: keyof VisualThemeTokens;
  beforeValue: string | null;
  afterValue: string | null;
}

export interface GenerationOutputComparisonRecord {
  hasChanges: boolean;
  beforeRun: GenerationRunRecord | null;
  afterRun: GenerationRunRecord | null;
  beforeRouteCount: number;
  afterRouteCount: number;
  beforePageCount: number;
  afterPageCount: number;
  beforeSectionCount: number;
  afterSectionCount: number;
  beforeCodeFileCount: number;
  afterCodeFileCount: number;
  beforeThemeTokenCount: number;
  afterThemeTokenCount: number;
  routeChanges: GenerationRouteComparisonRecord[];
  pageChanges: GenerationVisualPageComparisonRecord[];
  sectionChanges: GenerationVisualSectionComparisonRecord[];
  codeFileChanges: GenerationCodeFileComparisonRecord[];
  themeTokenChanges: GenerationThemeTokenComparisonRecord[];
}

function routeMap(routes: GenerationRouteTargetRecord[]) {
  return new Map(routes.map((route) => [route.routePath, route]));
}

function compareContentPayload(
  beforePayload: Record<string, unknown>,
  afterPayload: Record<string, unknown>,
) {
  return JSON.stringify(beforePayload) !== JSON.stringify(afterPayload);
}

function sectionsByPage(sections: GenerationVisualSectionTargetRecord[]) {
  return sections.reduce<Record<string, GenerationVisualSectionTargetRecord[]>>((accumulator, section) => {
    accumulator[section.pageId] = [...(accumulator[section.pageId] ?? []), section];
    return accumulator;
  }, {});
}

function compareRouteTargets(
  beforeRoutes: GenerationRouteTargetRecord[],
  afterRoutes: GenerationRouteTargetRecord[],
) {
  const beforeByPath = routeMap(beforeRoutes);
  const afterByPath = routeMap(afterRoutes);
  const routePaths = Array.from(new Set([...beforeByPath.keys(), ...afterByPath.keys()])).sort();
  const changes: GenerationRouteComparisonRecord[] = [];

  for (const routePath of routePaths) {
    const beforeRoute = beforeByPath.get(routePath) ?? null;
    const afterRoute = afterByPath.get(routePath) ?? null;

    if (!beforeRoute && afterRoute) {
      changes.push({
        routePath,
        pageKey: afterRoute.pageKey,
        changeType: "added",
        beforeTitle: null,
        afterTitle: afterRoute.title,
        beforeSectionCount: null,
        afterSectionCount: afterRoute.sectionCount,
      });
      continue;
    }

    if (beforeRoute && !afterRoute) {
      changes.push({
        routePath,
        pageKey: beforeRoute.pageKey,
        changeType: "removed",
        beforeTitle: beforeRoute.title,
        afterTitle: null,
        beforeSectionCount: beforeRoute.sectionCount,
        afterSectionCount: null,
      });
      continue;
    }

    if (
      beforeRoute &&
      afterRoute &&
      (beforeRoute.pageKey !== afterRoute.pageKey ||
        beforeRoute.title !== afterRoute.title ||
        beforeRoute.sectionCount !== afterRoute.sectionCount)
    ) {
      changes.push({
        routePath,
        pageKey: afterRoute.pageKey,
        changeType: "changed",
        beforeTitle: beforeRoute.title,
        afterTitle: afterRoute.title,
        beforeSectionCount: beforeRoute.sectionCount,
        afterSectionCount: afterRoute.sectionCount,
      });
    }
  }

  return changes;
}

function compareVisualTargets(
  beforePages: Array<{ id: string; pageKey: string; title: string; slug: string }>,
  beforeSections: GenerationVisualSectionTargetRecord[],
  afterPages: Array<{ id: string; pageKey: string; title: string; slug: string }>,
  afterSections: GenerationVisualSectionTargetRecord[],
) {
  const beforePagesByKey = new Map(beforePages.map((page) => [page.pageKey, page]));
  const afterPagesByKey = new Map(afterPages.map((page) => [page.pageKey, page]));
  const beforeSectionsByPageId = sectionsByPage(beforeSections);
  const afterSectionsByPageId = sectionsByPage(afterSections);
  const allPageKeys = Array.from(
    new Set([...beforePagesByKey.keys(), ...afterPagesByKey.keys()]),
  ).sort();

  const pageChanges: GenerationVisualPageComparisonRecord[] = [];
  const sectionChanges: GenerationVisualSectionComparisonRecord[] = [];

  for (const pageKey of allPageKeys) {
    const beforePage = beforePagesByKey.get(pageKey) ?? null;
    const afterPage = afterPagesByKey.get(pageKey) ?? null;
    const beforePageSections = beforePage ? beforeSectionsByPageId[beforePage.id] ?? [] : [];
    const afterPageSections = afterPage ? afterSectionsByPageId[afterPage.id] ?? [] : [];

    if (!beforePage && afterPage) {
      pageChanges.push({
        pageKey,
        changeType: "added",
        beforeTitle: null,
        afterTitle: afterPage.title,
        beforeSlug: null,
        afterSlug: afterPage.slug,
        sectionAddedCount: afterPageSections.length,
        sectionRemovedCount: 0,
        sectionChangedCount: 0,
      });
      sectionChanges.push(
        ...afterPageSections.map((section) => ({
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
        sectionRemovedCount: beforePageSections.length,
        sectionChangedCount: 0,
      });
      sectionChanges.push(
        ...beforePageSections.map((section) => ({
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

    const beforeSectionsByKey = new Map(beforePageSections.map((section) => [section.sectionKey, section]));
    const afterSectionsByKey = new Map(afterPageSections.map((section) => [section.sectionKey, section]));
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

      const contentChanged = compareContentPayload(
        beforeSection.contentPayload as Record<string, unknown>,
        afterSection.contentPayload as Record<string, unknown>,
      );
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

  return { pageChanges, sectionChanges };
}

function compareCodeFiles(
  beforeFiles: GenerationCodeFileTargetRecord[],
  afterFiles: GenerationCodeFileTargetRecord[],
) {
  const beforeByPath = new Map(beforeFiles.map((file) => [file.path, file]));
  const afterByPath = new Map(afterFiles.map((file) => [file.path, file]));
  const paths = Array.from(new Set([...beforeByPath.keys(), ...afterByPath.keys()])).sort();
  const changes: GenerationCodeFileComparisonRecord[] = [];

  for (const path of paths) {
    const beforeFile = beforeByPath.get(path) ?? null;
    const afterFile = afterByPath.get(path) ?? null;

    if (!beforeFile && afterFile) {
      changes.push({
        path,
        changeType: "added",
        beforeLineCount: null,
        afterLineCount: afterFile.lineCount,
        beforeOwnership: null,
        afterOwnership: afterFile.ownership,
        beforeEditPolicy: null,
        afterEditPolicy: afterFile.editPolicy,
        contentChanged: false,
      });
      continue;
    }

    if (beforeFile && !afterFile) {
      changes.push({
        path,
        changeType: "removed",
        beforeLineCount: beforeFile.lineCount,
        afterLineCount: null,
        beforeOwnership: beforeFile.ownership,
        afterOwnership: null,
        beforeEditPolicy: beforeFile.editPolicy,
        afterEditPolicy: null,
        contentChanged: false,
      });
      continue;
    }

    if (
      beforeFile &&
      afterFile &&
      (beforeFile.lineCount !== afterFile.lineCount ||
        beforeFile.ownership !== afterFile.ownership ||
        beforeFile.editPolicy !== afterFile.editPolicy ||
        beforeFile.content !== afterFile.content)
    ) {
      changes.push({
        path,
        changeType: "changed",
        beforeLineCount: beforeFile.lineCount,
        afterLineCount: afterFile.lineCount,
        beforeOwnership: beforeFile.ownership,
        afterOwnership: afterFile.ownership,
        beforeEditPolicy: beforeFile.editPolicy,
        afterEditPolicy: afterFile.editPolicy,
        contentChanged: beforeFile.content !== afterFile.content,
      });
    }
  }

  return changes;
}

function compareThemeTokens(
  beforeTheme: VisualThemeTokens,
  afterTheme: VisualThemeTokens,
) {
  const tokenKeys = Array.from(
    new Set([
      ...Object.keys(beforeTheme),
      ...Object.keys(afterTheme),
    ]),
  ) as Array<keyof VisualThemeTokens>;

  return tokenKeys
    .map((tokenKey) => ({
      tokenKey,
      beforeValue: beforeTheme[tokenKey] ?? null,
      afterValue: afterTheme[tokenKey] ?? null,
    }))
    .filter((item) => item.beforeValue !== item.afterValue);
}

export function buildGenerationOutputComparison(input: {
  selectedRun: GenerationRunRecord | null;
  comparisonRun: GenerationRunRecord | null;
  artifacts: GenerationArtifactRecord[];
}): GenerationOutputComparisonRecord {
  if (!input.selectedRun || !input.comparisonRun) {
    return {
      hasChanges: false,
      beforeRun: input.comparisonRun,
      afterRun: input.selectedRun,
      beforeRouteCount: 0,
      afterRouteCount: 0,
      beforePageCount: 0,
      afterPageCount: 0,
      beforeSectionCount: 0,
      afterSectionCount: 0,
      beforeCodeFileCount: 0,
      afterCodeFileCount: 0,
      beforeThemeTokenCount: 0,
      afterThemeTokenCount: 0,
      routeChanges: [],
      pageChanges: [],
      sectionChanges: [],
      codeFileChanges: [],
      themeTokenChanges: [],
    };
  }

  const beforeBundle = buildProjectGenerationTargetBundle({
    run: input.comparisonRun,
    artifacts: generationArtifactsForRun(input.artifacts, input.comparisonRun.id),
  });
  const afterBundle = buildProjectGenerationTargetBundle({
    run: input.selectedRun,
    artifacts: generationArtifactsForRun(input.artifacts, input.selectedRun.id),
  });

  if (!beforeBundle || !afterBundle) {
    return {
      hasChanges: false,
      beforeRun: input.comparisonRun,
      afterRun: input.selectedRun,
      beforeRouteCount: 0,
      afterRouteCount: 0,
      beforePageCount: 0,
      afterPageCount: 0,
      beforeSectionCount: 0,
      afterSectionCount: 0,
      beforeCodeFileCount: 0,
      afterCodeFileCount: 0,
      beforeThemeTokenCount: 0,
      afterThemeTokenCount: 0,
      routeChanges: [],
      pageChanges: [],
      sectionChanges: [],
      codeFileChanges: [],
      themeTokenChanges: [],
    };
  }

  const routeChanges = compareRouteTargets(beforeBundle.routeTargets, afterBundle.routeTargets);
  const { pageChanges, sectionChanges } = compareVisualTargets(
    beforeBundle.visualPages,
    beforeBundle.visualSections,
    afterBundle.visualPages,
    afterBundle.visualSections,
  );
  const codeFileChanges = compareCodeFiles(beforeBundle.codeFiles, afterBundle.codeFiles);
  const themeTokenChanges = compareThemeTokens(beforeBundle.themeTarget, afterBundle.themeTarget);

  return {
    hasChanges:
      routeChanges.length > 0 ||
      pageChanges.length > 0 ||
      sectionChanges.length > 0 ||
      codeFileChanges.length > 0 ||
      themeTokenChanges.length > 0,
    beforeRun: input.comparisonRun,
    afterRun: input.selectedRun,
    beforeRouteCount: beforeBundle.routeTargets.length,
    afterRouteCount: afterBundle.routeTargets.length,
    beforePageCount: beforeBundle.visualPages.length,
    afterPageCount: afterBundle.visualPages.length,
    beforeSectionCount: beforeBundle.visualSections.length,
    afterSectionCount: afterBundle.visualSections.length,
    beforeCodeFileCount: beforeBundle.codeFiles.length,
    afterCodeFileCount: afterBundle.codeFiles.length,
    beforeThemeTokenCount: Object.keys(beforeBundle.themeTarget).length,
    afterThemeTokenCount: Object.keys(afterBundle.themeTarget).length,
    routeChanges,
    pageChanges,
    sectionChanges,
    codeFileChanges,
    themeTokenChanges,
  };
}
