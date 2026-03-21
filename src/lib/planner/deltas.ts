import type { PlannerRunRecord } from "@/lib/planner/types";

export type PlannerRunDeltaLabelKey =
  | "name"
  | "prompt"
  | "projectType"
  | "designStyle"
  | "primaryLocale"
  | "country"
  | "businessCategory"
  | "targetUsers"
  | "desiredPagesFeatures"
  | "supportedLocales"
  | "capabilities"
  | "productSummary"
  | "designDirection"
  | "planTargetUsers"
  | "pageMap"
  | "featureList"
  | "authRoles"
  | "integrationsNeeded"
  | "dataModels"
  | "resolvedPageCount"
  | "featureCount";

export interface PlannerRunValueDelta {
  labelKey: PlannerRunDeltaLabelKey;
  previousValue: string;
  currentValue: string;
}

export interface PlannerRunListDelta {
  labelKey: PlannerRunDeltaLabelKey;
  added: string[];
  removed: string[];
}

export interface PlannerRunDelta {
  comparisonRun: PlannerRunRecord | null;
  briefFieldChanges: PlannerRunValueDelta[];
  briefListChanges: PlannerRunListDelta[];
  planFieldChanges: PlannerRunValueDelta[];
  planListChanges: PlannerRunListDelta[];
  signalChanges: PlannerRunValueDelta[];
  hasChanges: boolean;
}

function normalizeList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function normalizeTargetUsers(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCapabilities(value: object) {
  return Object.entries(value as Record<string, boolean>)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);
}

function addValueChange(
  bucket: PlannerRunValueDelta[],
  labelKey: PlannerRunDeltaLabelKey,
  previousValue: string | number,
  currentValue: string | number,
) {
  const previous = String(previousValue).trim();
  const current = String(currentValue).trim();

  if (previous !== current) {
    bucket.push({
      labelKey,
      previousValue: previous || "None",
      currentValue: current || "None",
    });
  }
}

function addListChange(
  bucket: PlannerRunListDelta[],
  labelKey: PlannerRunDeltaLabelKey,
  previousValues: string[],
  currentValues: string[],
) {
  const previous = normalizeList(previousValues);
  const current = normalizeList(currentValues);
  const previousSet = new Set(previous);
  const currentSet = new Set(current);
  const added = current.filter((value) => !previousSet.has(value));
  const removed = previous.filter((value) => !currentSet.has(value));

  if (added.length > 0 || removed.length > 0) {
    bucket.push({ labelKey, added, removed });
  }
}

export function buildPlannerRunDelta(
  selectedRun: PlannerRunRecord | null,
  comparisonRun: PlannerRunRecord | null,
): PlannerRunDelta {
  if (!selectedRun || !comparisonRun) {
    return {
      comparisonRun,
      briefFieldChanges: [],
      briefListChanges: [],
      planFieldChanges: [],
      planListChanges: [],
      signalChanges: [],
      hasChanges: false,
    };
  }

  const briefFieldChanges: PlannerRunValueDelta[] = [];
  const briefListChanges: PlannerRunListDelta[] = [];
  const planFieldChanges: PlannerRunValueDelta[] = [];
  const planListChanges: PlannerRunListDelta[] = [];
  const signalChanges: PlannerRunValueDelta[] = [];

  addValueChange(briefFieldChanges, "name", comparisonRun.inputSnapshot.name, selectedRun.inputSnapshot.name);
  addValueChange(briefFieldChanges, "prompt", comparisonRun.inputSnapshot.prompt, selectedRun.inputSnapshot.prompt);
  addValueChange(briefFieldChanges, "projectType", comparisonRun.inputSnapshot.projectType, selectedRun.inputSnapshot.projectType);
  addValueChange(briefFieldChanges, "designStyle", comparisonRun.inputSnapshot.designStyle, selectedRun.inputSnapshot.designStyle);
  addValueChange(briefFieldChanges, "primaryLocale", comparisonRun.inputSnapshot.primaryLocale, selectedRun.inputSnapshot.primaryLocale);
  addValueChange(briefFieldChanges, "country", comparisonRun.inputSnapshot.country, selectedRun.inputSnapshot.country);
  addValueChange(
    briefFieldChanges,
    "businessCategory",
    comparisonRun.inputSnapshot.businessCategory,
    selectedRun.inputSnapshot.businessCategory,
  );

  addListChange(
    briefListChanges,
    "targetUsers",
    normalizeTargetUsers(comparisonRun.inputSnapshot.targetUsers),
    normalizeTargetUsers(selectedRun.inputSnapshot.targetUsers),
  );
  addListChange(
    briefListChanges,
    "desiredPagesFeatures",
    comparisonRun.inputSnapshot.desiredPagesFeatures,
    selectedRun.inputSnapshot.desiredPagesFeatures,
  );
  addListChange(
    briefListChanges,
    "supportedLocales",
    comparisonRun.inputSnapshot.supportedLocales,
    selectedRun.inputSnapshot.supportedLocales,
  );
  addListChange(
    briefListChanges,
    "capabilities",
    normalizeCapabilities(comparisonRun.inputSnapshot.capabilities),
    normalizeCapabilities(selectedRun.inputSnapshot.capabilities),
  );

  if (comparisonRun.outputPlan && selectedRun.outputPlan) {
    addValueChange(
      planFieldChanges,
      "productSummary",
      comparisonRun.outputPlan.productSummary,
      selectedRun.outputPlan.productSummary,
    );
    addValueChange(
      planFieldChanges,
      "designDirection",
      comparisonRun.outputPlan.designDirection,
      selectedRun.outputPlan.designDirection,
    );
    addListChange(
      planListChanges,
      "planTargetUsers",
      comparisonRun.outputPlan.targetUsers,
      selectedRun.outputPlan.targetUsers,
    );
    addListChange(
      planListChanges,
      "pageMap",
      comparisonRun.outputPlan.pageMap,
      selectedRun.outputPlan.pageMap,
    );
    addListChange(
      planListChanges,
      "featureList",
      comparisonRun.outputPlan.featureList,
      selectedRun.outputPlan.featureList,
    );
    addListChange(
      planListChanges,
      "authRoles",
      comparisonRun.outputPlan.authRoles,
      selectedRun.outputPlan.authRoles,
    );
    addListChange(
      planListChanges,
      "integrationsNeeded",
      comparisonRun.outputPlan.integrationsNeeded,
      selectedRun.outputPlan.integrationsNeeded,
    );
    addListChange(
      planListChanges,
      "dataModels",
      comparisonRun.outputPlan.dataModels.map((item) => `${item.name}: ${item.description}`),
      selectedRun.outputPlan.dataModels.map((item) => `${item.name}: ${item.description}`),
    );

    addValueChange(
      signalChanges,
      "resolvedPageCount",
      comparisonRun.outputPlan.pageMap.length,
      selectedRun.outputPlan.pageMap.length,
    );
    addValueChange(
      signalChanges,
      "featureCount",
      comparisonRun.outputPlan.featureList.length,
      selectedRun.outputPlan.featureList.length,
    );
  }

  return {
    comparisonRun,
    briefFieldChanges,
    briefListChanges,
    planFieldChanges,
    planListChanges,
    signalChanges,
    hasChanges:
      briefFieldChanges.length > 0 ||
      briefListChanges.length > 0 ||
      planFieldChanges.length > 0 ||
      planListChanges.length > 0 ||
      signalChanges.length > 0,
  };
}
