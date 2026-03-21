import { notFound } from "next/navigation";

import { PlanReviewScreen } from "@/components/plan/plan-review-screen";
import { getProjectGenerationBundle } from "@/lib/generation/repository";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { getProjectModelAdapterBundle } from "@/lib/model-adapters/repository";
import { getProjectPlannerBundle } from "@/lib/planner/repository";
import { getProjectPlanPromotionBundle } from "@/lib/workspaces/plan-promotion";
import {
  approvePlanAction,
  markPlanNeedsChangesAction,
  queueGenerationOutputsAction,
  rerunGenerationAction,
  rerunPlannerAction,
  saveProjectModelAdapterConfigAction,
  saveProjectBriefAction,
  savePlanSectionAction,
  verifyExternalProviderCapabilityAction,
} from "@/lib/workspaces/actions";
import { getProjectPlanBundle } from "@/lib/workspaces/repository";

export default async function ProjectPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; workspaceSlug: string; projectSlug: string }>;
  searchParams: Promise<{
    plannerRun?: string;
    plannerCompare?: string;
    generationRun?: string;
    generationCompare?: string;
  }>;
}) {
  const { locale, workspaceSlug, projectSlug } = await params;
  const { plannerRun, plannerCompare, generationRun, generationCompare } = await searchParams;
  const dictionary = getDictionary(locale);
  const bundle = await getProjectPlanBundle(workspaceSlug, projectSlug);
  const plannerBundle = bundle
    ? await getProjectPlannerBundle(workspaceSlug, projectSlug)
    : null;
  const generationBundle = bundle
    ? await getProjectGenerationBundle(workspaceSlug, projectSlug)
    : null;
  const modelAdapterBundle = bundle
    ? await getProjectModelAdapterBundle(workspaceSlug, projectSlug)
    : null;
  const promotionBundle = bundle
    ? await getProjectPlanPromotionBundle(workspaceSlug, projectSlug)
    : null;

  if (!bundle || !plannerBundle || !generationBundle || !modelAdapterBundle || !promotionBundle) {
    notFound();
  }

  return (
    <PlanReviewScreen
      locale={locale as Locale}
      dictionary={dictionary}
      workspace={bundle.workspace}
      project={bundle.project}
      projectPermissions={bundle.projectPermissions}
      brief={bundle.brief}
      revisions={bundle.revisions}
      plannerBundle={plannerBundle}
      generationBundle={generationBundle}
      modelAdapterBundle={modelAdapterBundle}
      promotionBundle={promotionBundle}
      selectedPlannerRunId={typeof plannerRun === "string" ? plannerRun : null}
      selectedPlannerComparisonRunId={typeof plannerCompare === "string" ? plannerCompare : null}
      selectedGenerationRunId={typeof generationRun === "string" ? generationRun : null}
      selectedGenerationComparisonRunId={
        typeof generationCompare === "string" ? generationCompare : null
      }
      embedded
      sectionActions={{
        productSummary: savePlanSectionAction.bind(
          null,
          locale,
          workspaceSlug,
          projectSlug,
          "productSummary",
        ),
        targetUsers: savePlanSectionAction.bind(
          null,
          locale,
          workspaceSlug,
          projectSlug,
          "targetUsers",
        ),
        pageMap: savePlanSectionAction.bind(null, locale, workspaceSlug, projectSlug, "pageMap"),
        featureList: savePlanSectionAction.bind(
          null,
          locale,
          workspaceSlug,
          projectSlug,
          "featureList",
        ),
        dataModels: savePlanSectionAction.bind(
          null,
          locale,
          workspaceSlug,
          projectSlug,
          "dataModels",
        ),
        authRoles: savePlanSectionAction.bind(
          null,
          locale,
          workspaceSlug,
          projectSlug,
          "authRoles",
        ),
        integrationsNeeded: savePlanSectionAction.bind(
          null,
          locale,
          workspaceSlug,
          projectSlug,
          "integrationsNeeded",
        ),
        designDirection: savePlanSectionAction.bind(
          null,
          locale,
          workspaceSlug,
          projectSlug,
          "designDirection",
        ),
      }}
      saveBriefAction={saveProjectBriefAction.bind(null, locale, workspaceSlug, projectSlug)}
      saveModelAdapterConfigAction={saveProjectModelAdapterConfigAction.bind(null, locale, workspaceSlug, projectSlug)}
      verifyProviderAction={verifyExternalProviderCapabilityAction.bind(null, locale, workspaceSlug, projectSlug)}
      rerunPlannerAction={rerunPlannerAction.bind(null, locale, workspaceSlug, projectSlug)}
      rerunGenerationAction={rerunGenerationAction.bind(null, locale, workspaceSlug, projectSlug)}
      queueGenerationAction={queueGenerationOutputsAction.bind(null, locale, workspaceSlug, projectSlug)}
      approveAction={approvePlanAction.bind(null, locale, workspaceSlug, projectSlug)}
      needsChangesAction={markPlanNeedsChangesAction.bind(null, locale, workspaceSlug, projectSlug)}
    />
  );
}
