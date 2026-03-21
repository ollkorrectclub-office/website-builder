import type {
  PlannerArtifactSpec,
  PlannerInput,
  PlannerRunTrigger,
} from "@/lib/planner/types";
import type { ProjectBriefRecord, ProjectRecord, StructuredPlan } from "@/lib/workspaces/types";

function normalizeList(items: string[]) {
  return items
    .map((item) => item.trim())
    .filter(Boolean);
}

export function plannerInputFromProject(project: ProjectRecord): PlannerInput {
  return {
    name: project.name,
    prompt: project.prompt,
    projectType: project.projectType,
    targetUsers: project.targetUsers,
    desiredPagesFeatures: project.desiredPagesFeatures,
    designStyle: project.designStyle,
    primaryLocale: project.primaryLocale,
    supportedLocales: project.supportedLocales,
    country: project.country,
    businessCategory: project.businessCategory,
    capabilities: project.capabilities,
  };
}

export function plannerInputFromBrief(brief: ProjectBriefRecord): PlannerInput {
  return {
    name: brief.name,
    prompt: brief.prompt,
    projectType: brief.projectType,
    targetUsers: brief.targetUsers,
    desiredPagesFeatures: brief.desiredPagesFeatures,
    designStyle: brief.designStyle,
    primaryLocale: brief.primaryLocale,
    supportedLocales: brief.supportedLocales,
    country: brief.country,
    businessCategory: brief.businessCategory,
    capabilities: brief.capabilities,
  };
}

export function buildPlannerArtifacts(
  input: PlannerInput,
  plan: StructuredPlan,
  trigger: PlannerRunTrigger,
): PlannerArtifactSpec[] {
  const normalizedPages = normalizeList(input.desiredPagesFeatures);
  const normalizedTargetUsers = input.targetUsers
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const enabledCapabilities = Object.entries(input.capabilities)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);

  return [
    {
      artifactType: "normalized_brief",
      label: "Normalized brief",
      payload: {
        name: input.name,
        prompt: input.prompt.trim(),
        projectType: input.projectType,
        targetUsers: normalizedTargetUsers,
        desiredPagesFeatures: normalizedPages,
        designStyle: input.designStyle,
        primaryLocale: input.primaryLocale,
        supportedLocales: input.supportedLocales,
        country: input.country,
        businessCategory: input.businessCategory,
        capabilities: input.capabilities,
      },
    },
    {
      artifactType: "planning_signals",
      label: "Planning signals",
      payload: {
        trigger,
        requestedPageCount: normalizedPages.length,
        resolvedPageCount: plan.pageMap.length,
        enabledCapabilities,
        localeMode: input.supportedLocales.join(", "),
        marketScope: input.country,
        featureCount: plan.featureList.length,
      },
    },
    {
      artifactType: "plan_payload",
      label: "Structured plan payload",
      payload: {
        productSummary: plan.productSummary,
        targetUsers: plan.targetUsers,
        pageMap: plan.pageMap,
        featureList: plan.featureList,
        dataModels: plan.dataModels,
        authRoles: plan.authRoles,
        integrationsNeeded: plan.integrationsNeeded,
        designDirection: plan.designDirection,
      },
    },
  ];
}
