import type {
  ExternalModelProviderKey,
  ModelAdapterCapability,
  ModelAdapterSelection,
  ProjectModelAdapterConfigRecord,
  ResolvedCapabilityAdapterConfig,
} from "@/lib/model-adapters/types";

export class ExternalAdapterNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExternalAdapterNotReadyError";
  }
}

export function listExternalModelProviders() {
  return [
    { key: "openai_compatible" as const, label: "OpenAI-compatible" },
    { key: "custom_http" as const, label: "Custom HTTP" },
  ];
}

export function externalModelProviderLabel(providerKey: ExternalModelProviderKey | null) {
  switch (providerKey) {
    case "openai_compatible":
      return "OpenAI-compatible";
    case "custom_http":
      return "Custom HTTP";
    default:
      return "Not configured";
  }
}

export function defaultProjectModelAdapterConfig(input: {
  workspaceId: string;
  projectId: string;
}): ProjectModelAdapterConfigRecord {
  const timestamp = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    planningSelection: "deterministic_internal",
    generationSelection: "deterministic_internal",
    patchSelection: "deterministic_internal",
    externalProviderKey: null,
    externalProviderLabel: null,
    externalEndpointUrl: null,
    externalApiKeyEnvVar: null,
    planningModel: null,
    generationModel: null,
    patchModel: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function withCapabilitySelectionOverride(
  config: ProjectModelAdapterConfigRecord | null,
  input: {
    workspaceId: string;
    projectId: string;
    capability: ModelAdapterCapability;
    selection: ModelAdapterSelection;
  },
): ProjectModelAdapterConfigRecord {
  const base = config ?? defaultProjectModelAdapterConfig({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
  });

  return {
    ...base,
    planningSelection:
      input.capability === "planning" ? input.selection : base.planningSelection,
    generationSelection:
      input.capability === "generation" ? input.selection : base.generationSelection,
    patchSelection:
      input.capability === "patch_suggestion" ? input.selection : base.patchSelection,
    updatedAt: new Date().toISOString(),
  };
}

function modelNameForCapability(
  config: Pick<ProjectModelAdapterConfigRecord, "planningModel" | "generationModel" | "patchModel">,
  capability: ModelAdapterCapability,
) {
  switch (capability) {
    case "planning":
      return config.planningModel;
    case "generation":
      return config.generationModel;
    case "patch_suggestion":
      return config.patchModel;
  }
}

function selectionForCapability(
  config: Pick<ProjectModelAdapterConfigRecord, "planningSelection" | "generationSelection" | "patchSelection">,
  capability: ModelAdapterCapability,
) {
  switch (capability) {
    case "planning":
      return config.planningSelection;
    case "generation":
      return config.generationSelection;
    case "patch_suggestion":
      return config.patchSelection;
  }
}

export function resolveCapabilityAdapterConfig(
  config: ProjectModelAdapterConfigRecord,
  capability: ModelAdapterCapability,
): ResolvedCapabilityAdapterConfig {
  const selection = selectionForCapability(config, capability);
  const modelName = modelNameForCapability(config, capability)?.trim() || null;
  const endpointRequired = config.externalProviderKey !== "openai_compatible";
  const missingFields =
    selection === "external_model"
      ? [
          !config.externalProviderKey ? "provider" : null,
          endpointRequired && !config.externalEndpointUrl?.trim() ? "endpoint" : null,
          !config.externalApiKeyEnvVar?.trim() ? "api_key_env_var" : null,
          !modelName ? "model" : null,
        ].filter((value): value is string => Boolean(value))
      : [];

  return {
    capability,
    selection,
    sourceType: selection === "external_model" ? "external_model" : "deterministic_internal",
    providerKey: config.externalProviderKey,
    providerLabel: config.externalProviderLabel?.trim() || externalModelProviderLabel(config.externalProviderKey),
    endpointUrl: config.externalEndpointUrl?.trim() || null,
    apiKeyEnvVar: config.externalApiKeyEnvVar?.trim() || null,
    modelName,
    externalReady: selection === "external_model" ? missingFields.length === 0 : false,
    missingFields,
  };
}
