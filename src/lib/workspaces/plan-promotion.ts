import { getProjectCodeBundleSnapshot } from "@/lib/builder/code-repository";
import { listProjectBuilderRefreshQueue } from "@/lib/builder/refresh-queue-repository";
import { getProjectVisualBundleSnapshot } from "@/lib/builder/repository";
import type {
  BuilderImpactSurfaceRecord,
  BuilderPromotionQueueDraft,
  PlanCandidateComparisonRecord,
  PlanCandidateDiffRecord,
  ProjectBuilderRefreshQueueItemRecord,
  ProjectPlanPromotionBundle,
} from "@/lib/builder/types";
import { serializeDataModels } from "@/lib/planner/plan-sections";
import { getProjectPlanBundle } from "@/lib/workspaces/repository";
import type {
  PlanRevisionRecord,
  PlanSectionKey,
  StructuredPlan,
} from "@/lib/workspaces/types";

const PLAN_SECTION_KEYS: PlanSectionKey[] = [
  "productSummary",
  "targetUsers",
  "pageMap",
  "featureList",
  "dataModels",
  "authRoles",
  "integrationsNeeded",
  "designDirection",
];

function normalizeList(items: string[]) {
  return items.map((item) => item.trim()).filter(Boolean);
}

function planSectionAsText(plan: StructuredPlan, key: PlanSectionKey) {
  switch (key) {
    case "productSummary":
      return plan.productSummary.trim();
    case "designDirection":
      return plan.designDirection.trim();
    default:
      return "";
  }
}

function planSectionAsList(plan: StructuredPlan, key: PlanSectionKey) {
  switch (key) {
    case "targetUsers":
      return normalizeList(plan.targetUsers);
    case "pageMap":
      return normalizeList(plan.pageMap);
    case "featureList":
      return normalizeList(plan.featureList);
    case "dataModels":
      return normalizeList(serializeDataModels(plan.dataModels).split("\n"));
    case "authRoles":
      return normalizeList(plan.authRoles);
    case "integrationsNeeded":
      return normalizeList(plan.integrationsNeeded);
    default:
      return [];
  }
}

function buildTextDiff(
  key: PlanSectionKey,
  beforeText: string | null,
  afterText: string,
): PlanCandidateDiffRecord | null {
  if ((beforeText ?? "").trim() === afterText.trim()) {
    return null;
  }

  return {
    key,
    kind: "text",
    beforeText,
    afterText,
    beforeItems: [],
    afterItems: [],
    addedItems: [],
    removedItems: [],
  };
}

function buildListDiff(
  key: PlanSectionKey,
  beforeItems: string[],
  afterItems: string[],
): PlanCandidateDiffRecord | null {
  const normalizedBefore = normalizeList(beforeItems);
  const normalizedAfter = normalizeList(afterItems);

  if (normalizedBefore.join("\n") === normalizedAfter.join("\n")) {
    return null;
  }

  return {
    key,
    kind: "list",
    beforeText: null,
    afterText: null,
    beforeItems: normalizedBefore,
    afterItems: normalizedAfter,
    addedItems: normalizedAfter.filter((item) => !normalizedBefore.includes(item)),
    removedItems: normalizedBefore.filter((item) => !normalizedAfter.includes(item)),
  };
}

function firstPendingQueueItem(
  queue: ProjectBuilderRefreshQueueItemRecord[],
  surface: "visual" | "code",
) {
  return queue.find((item) => item.surface === surface && item.status === "pending") ?? null;
}

function buildSurfaceState(input: {
  surface: BuilderImpactSurfaceRecord["surface"];
  exists: boolean;
  pinnedRevisionNumber: number | null;
  approvedRevisionNumber: number | null;
  latestCandidateRevisionNumber: number | null;
  targetRevisionNumber: number | null;
  hasManualChanges: boolean;
  requiresManualReview: boolean;
  pendingQueueItem: ProjectBuilderRefreshQueueItemRecord | null;
}): BuilderImpactSurfaceRecord {
  const needsRefreshAfterPromotion =
    input.targetRevisionNumber !== null &&
    (!input.exists || (input.pinnedRevisionNumber ?? 0) < input.targetRevisionNumber);
  const status = !input.exists
    ? "not_initialized"
    : input.pendingQueueItem
      ? input.pendingQueueItem.requiresManualReview
        ? "refresh_blocked"
        : "refresh_pending"
      : needsRefreshAfterPromotion && input.requiresManualReview
        ? "refresh_blocked"
        : needsRefreshAfterPromotion
          ? "refresh_pending"
          : "current";

  return {
    surface: input.surface,
    status,
    exists: input.exists,
    pinnedRevisionNumber: input.pinnedRevisionNumber,
    approvedRevisionNumber: input.approvedRevisionNumber,
    latestCandidateRevisionNumber: input.latestCandidateRevisionNumber,
    targetRevisionNumber: input.targetRevisionNumber,
    hasManualChanges: input.hasManualChanges,
    requiresManualReview: input.requiresManualReview,
    needsRefreshAfterPromotion,
    pendingQueueItemId: input.pendingQueueItem?.id ?? null,
  };
}

export function getApprovedAndCandidateRevisions(revisions: PlanRevisionRecord[]) {
  const sorted = [...revisions].sort((left, right) => right.revisionNumber - left.revisionNumber);
  const latestRevision = sorted[0] ?? null;
  const approvedRevision = sorted.find((revision) => revision.state === "approved") ?? null;
  const candidateRevision =
    latestRevision && (!approvedRevision || latestRevision.id !== approvedRevision.id)
      ? latestRevision
      : null;

  return {
    latestRevision,
    approvedRevision,
    candidateRevision,
  };
}

export function buildPlanCandidateComparison(
  approvedRevision: PlanRevisionRecord | null,
  candidateRevision: PlanRevisionRecord | null,
): PlanCandidateComparisonRecord | null {
  if (!candidateRevision) {
    return null;
  }

  const changedSections = PLAN_SECTION_KEYS.flatMap((key) => {
    if (key === "productSummary" || key === "designDirection") {
      const diff = buildTextDiff(
        key,
        approvedRevision ? planSectionAsText(approvedRevision.plan, key) : null,
        planSectionAsText(candidateRevision.plan, key),
      );

      return diff ? [diff] : [];
    }

    const diff = buildListDiff(
      key,
      approvedRevision ? planSectionAsList(approvedRevision.plan, key) : [],
      planSectionAsList(candidateRevision.plan, key),
    );

    return diff ? [diff] : [];
  });

  return {
    approvedRevision,
    candidateRevision,
    changedSections,
  };
}

export function buildPromotionQueueDrafts(input: {
  targetPlanRevisionId: string | null;
  targetPlanRevisionNumber: number;
  visualSurface: BuilderImpactSurfaceRecord;
  codeSurface: BuilderImpactSurfaceRecord;
}): BuilderPromotionQueueDraft[] {
  const drafts: BuilderPromotionQueueDraft[] = [];

  if (input.visualSurface.needsRefreshAfterPromotion) {
    drafts.push({
      surface: "visual",
      targetPlanRevisionId: input.targetPlanRevisionId,
      targetPlanRevisionNumber: input.targetPlanRevisionNumber,
      pinnedPlanRevisionNumber: input.visualSurface.pinnedRevisionNumber,
      requiresManualReview: input.visualSurface.requiresManualReview,
      summary:
        input.visualSurface.exists
          ? `Refresh the visual scaffold from revision ${input.visualSurface.pinnedRevisionNumber ?? "none"} to revision ${input.targetPlanRevisionNumber}.`
          : `Create the initial visual scaffold from approved revision ${input.targetPlanRevisionNumber}.`,
    });
  }

  if (input.codeSurface.needsRefreshAfterPromotion) {
    drafts.push({
      surface: "code",
      targetPlanRevisionId: input.targetPlanRevisionId,
      targetPlanRevisionNumber: input.targetPlanRevisionNumber,
      pinnedPlanRevisionNumber: input.codeSurface.pinnedRevisionNumber,
      requiresManualReview: input.codeSurface.requiresManualReview,
      summary:
        input.codeSurface.exists
          ? `Refresh the code scaffold from revision ${input.codeSurface.pinnedRevisionNumber ?? "none"} to revision ${input.targetPlanRevisionNumber}.`
          : `Create the initial code scaffold from approved revision ${input.targetPlanRevisionNumber}.`,
    });
  }

  return drafts;
}

export async function getProjectPlanPromotionBundle(
  workspaceSlug: string,
  projectSlug: string,
): Promise<ProjectPlanPromotionBundle | null> {
  const planBundle = await getProjectPlanBundle(workspaceSlug, projectSlug);

  if (!planBundle) {
    return null;
  }

  const { latestRevision, approvedRevision, candidateRevision } = getApprovedAndCandidateRevisions(
    planBundle.revisions,
  );

  if (!latestRevision) {
    return null;
  }

  const [visualSnapshot, codeSnapshot, refreshQueue] = await Promise.all([
    getProjectVisualBundleSnapshot(workspaceSlug, projectSlug),
    getProjectCodeBundleSnapshot(workspaceSlug, projectSlug),
    listProjectBuilderRefreshQueue(workspaceSlug, projectSlug),
  ]);
  const promotionTargetRevisionNumber = candidateRevision
    ? latestRevision.revisionNumber + 1
    : approvedRevision?.revisionNumber ?? latestRevision.revisionNumber;
  const pendingVisualQueue = firstPendingQueueItem(refreshQueue, "visual");
  const pendingCodeQueue = firstPendingQueueItem(refreshQueue, "code");

  const visualSurface = buildSurfaceState({
    surface: "visual",
    exists: Boolean(visualSnapshot),
    pinnedRevisionNumber: visualSnapshot?.syncState.sourceRevisionNumber ?? null,
    approvedRevisionNumber: approvedRevision?.revisionNumber ?? null,
    latestCandidateRevisionNumber: candidateRevision?.revisionNumber ?? null,
    targetRevisionNumber: promotionTargetRevisionNumber,
    hasManualChanges: visualSnapshot?.syncState.hasManualChanges ?? false,
    requiresManualReview: visualSnapshot?.syncState.hasManualChanges ?? false,
    pendingQueueItem: pendingVisualQueue,
  });
  const codeSurface = buildSurfaceState({
    surface: "code",
    exists: Boolean(codeSnapshot),
    pinnedRevisionNumber: codeSnapshot?.codeSyncState.sourceRevisionNumber ?? null,
    approvedRevisionNumber: approvedRevision?.revisionNumber ?? null,
    latestCandidateRevisionNumber: candidateRevision?.revisionNumber ?? null,
    targetRevisionNumber: promotionTargetRevisionNumber,
    hasManualChanges: codeSnapshot?.codeSyncState.hasManualChanges ?? false,
    requiresManualReview:
      codeSnapshot?.codeSyncState.requiresConfirmedRefresh ??
      codeSnapshot?.codeSyncState.hasManualChanges ??
      false,
    pendingQueueItem: pendingCodeQueue,
  });
  const previewSurface = buildSurfaceState({
    surface: "preview",
    exists: Boolean(visualSnapshot),
    pinnedRevisionNumber: visualSnapshot?.syncState.sourceRevisionNumber ?? null,
    approvedRevisionNumber: approvedRevision?.revisionNumber ?? null,
    latestCandidateRevisionNumber: candidateRevision?.revisionNumber ?? null,
    targetRevisionNumber: promotionTargetRevisionNumber,
    hasManualChanges: false,
    requiresManualReview: false,
    pendingQueueItem: null,
  });
  const promotionQueueDrafts = candidateRevision
    ? buildPromotionQueueDrafts({
        targetPlanRevisionId: null,
        targetPlanRevisionNumber: promotionTargetRevisionNumber,
        visualSurface,
        codeSurface,
      })
    : [];

  return {
    workspace: planBundle.workspace,
    project: planBundle.project,
    latestRevision,
    currentUser: planBundle.currentUser,
    membership: planBundle.membership,
    workspacePermissions: planBundle.workspacePermissions,
    projectPermissions: planBundle.projectPermissions,
    revisions: planBundle.revisions,
    approvedRevision,
    candidateRevision,
    comparison: buildPlanCandidateComparison(approvedRevision, candidateRevision),
    visualSurface,
    codeSurface,
    previewSurface,
    pendingRefreshQueue: refreshQueue,
    promotionQueueDrafts,
  };
}
