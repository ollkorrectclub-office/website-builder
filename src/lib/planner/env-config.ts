import { getOptionalEnv, isEnvFlagEnabled } from "@/lib/env";
import { externalModelProviderLabel, resolveCapabilityAdapterConfig } from "@/lib/model-adapters/registry";
import type { ExternalModelProviderKey, ProjectModelAdapterConfigRecord, ResolvedCapabilityAdapterConfig } from "@/lib/model-adapters/types";

function normalizeProviderKey(value: string | null): ExternalModelProviderKey {
  switch (value) {
    case "custom_http":
      return "custom_http";
    case "openai_compatible":
    default:
      return "openai_compatible";
  }
}

function buildEnvPlannerConfig(): ProjectModelAdapterConfigRecord {
  const providerKey = normalizeProviderKey(getOptionalEnv("EXTERNAL_PLANNER_PROVIDER_KEY"));
  const timestamp = new Date().toISOString();

  return {
    id: "env_external_planner_config",
    workspaceId: "env_external_planner_workspace",
    projectId: "env_external_planner_project",
    planningSelection: "external_model",
    generationSelection: "deterministic_internal",
    patchSelection: "deterministic_internal",
    externalProviderKey: providerKey,
    externalProviderLabel:
      getOptionalEnv("EXTERNAL_PLANNER_PROVIDER_LABEL") ?? `${externalModelProviderLabel(providerKey)} (env)`,
    externalEndpointUrl: getOptionalEnv("EXTERNAL_PLANNER_ENDPOINT_URL"),
    externalApiKeyEnvVar: getOptionalEnv("EXTERNAL_PLANNER_API_KEY_ENV_VAR") ?? "OPENAI_API_KEY",
    planningModel: getOptionalEnv("EXTERNAL_PLANNER_MODEL"),
    generationModel: null,
    patchModel: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function resolveEnvPlannerAdapterConfig(): ResolvedCapabilityAdapterConfig | null {
  if (!isEnvFlagEnabled("ENABLE_EXTERNAL_PLANNER", "enableExternalPlanner")) {
    return null;
  }

  return resolveCapabilityAdapterConfig(buildEnvPlannerConfig(), "planning");
}
