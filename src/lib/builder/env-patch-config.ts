import { getOptionalEnv, isEnvFlagEnabled } from "@/lib/env";
import { externalModelProviderLabel, resolveCapabilityAdapterConfig } from "@/lib/model-adapters/registry";
import type {
  ExternalModelProviderKey,
  ProjectModelAdapterConfigRecord,
  ResolvedCapabilityAdapterConfig,
} from "@/lib/model-adapters/types";

function normalizeProviderKey(value: string | null): ExternalModelProviderKey {
  switch (value) {
    case "custom_http":
      return "custom_http";
    case "openai_compatible":
    default:
      return "openai_compatible";
  }
}

function buildEnvPatchSuggestionConfig(): ProjectModelAdapterConfigRecord {
  const providerKey = normalizeProviderKey(getOptionalEnv("EXTERNAL_PATCH_PROVIDER_KEY"));
  const timestamp = new Date().toISOString();

  return {
    id: "env_external_patch_config",
    workspaceId: "env_external_patch_workspace",
    projectId: "env_external_patch_project",
    planningSelection: "deterministic_internal",
    generationSelection: "deterministic_internal",
    patchSelection: "external_model",
    externalProviderKey: providerKey,
    externalProviderLabel:
      getOptionalEnv("EXTERNAL_PATCH_PROVIDER_LABEL") ?? `${externalModelProviderLabel(providerKey)} (env)`,
    externalEndpointUrl: getOptionalEnv("EXTERNAL_PATCH_ENDPOINT_URL"),
    externalApiKeyEnvVar: getOptionalEnv("EXTERNAL_PATCH_API_KEY_ENV_VAR") ?? "OPENAI_API_KEY",
    planningModel: null,
    generationModel: null,
    patchModel: getOptionalEnv("EXTERNAL_PATCH_MODEL"),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function resolveEnvPatchSuggestionAdapterConfig(): ResolvedCapabilityAdapterConfig | null {
  if (!isEnvFlagEnabled("ENABLE_EXTERNAL_PATCH_SUGGESTION", "enableExternalPatchSuggestion")) {
    return null;
  }

  return resolveCapabilityAdapterConfig(buildEnvPatchSuggestionConfig(), "patch_suggestion");
}
