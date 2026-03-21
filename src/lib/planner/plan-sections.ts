import type {
  PlanSectionKey,
  StructuredPlan,
  StructuredPlanDataModel,
} from "@/lib/workspaces/types";

export const planSectionKeys: PlanSectionKey[] = [
  "productSummary",
  "targetUsers",
  "pageMap",
  "featureList",
  "dataModels",
  "authRoles",
  "integrationsNeeded",
  "designDirection",
];

function splitLines(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializeDataModels(dataModels: StructuredPlanDataModel[]) {
  return dataModels.map((item) => `${item.name}: ${item.description}`).join("\n");
}

function parseDataModels(value: string) {
  return splitLines(value).map((line) => {
    const [namePart, ...descriptionParts] = line.split(":");
    const name = namePart?.trim() || "Entity";
    const description = descriptionParts.join(":").trim() || "Describe this model.";

    return {
      name,
      description,
    };
  });
}

export function applyPlanSectionUpdate(
  currentPlan: StructuredPlan,
  sectionKey: PlanSectionKey,
  formData: FormData,
) {
  switch (sectionKey) {
    case "productSummary":
      return {
        ...currentPlan,
        productSummary: String(formData.get("productSummary") ?? "").trim(),
      };
    case "targetUsers":
      return {
        ...currentPlan,
        targetUsers: splitLines(String(formData.get("targetUsers") ?? "")),
      };
    case "pageMap":
      return {
        ...currentPlan,
        pageMap: splitLines(String(formData.get("pageMap") ?? "")),
      };
    case "featureList":
      return {
        ...currentPlan,
        featureList: splitLines(String(formData.get("featureList") ?? "")),
      };
    case "dataModels":
      return {
        ...currentPlan,
        dataModels: parseDataModels(String(formData.get("dataModels") ?? "")),
      };
    case "authRoles":
      return {
        ...currentPlan,
        authRoles: splitLines(String(formData.get("authRoles") ?? "")),
      };
    case "integrationsNeeded":
      return {
        ...currentPlan,
        integrationsNeeded: splitLines(String(formData.get("integrationsNeeded") ?? "")),
      };
    case "designDirection":
      return {
        ...currentPlan,
        designDirection: String(formData.get("designDirection") ?? "").trim(),
      };
  }
}
