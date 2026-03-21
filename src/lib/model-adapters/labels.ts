import type { Dictionary } from "@/lib/i18n/dictionaries";
import type {
  ExternalModelProviderKey,
  ModelAdapterCapability,
  ModelAdapterCapabilityHealthRecord,
  ModelAdapterExecutionMode,
  ModelAdapterRunRecord,
  ModelAdapterSelection,
  ModelAdapterSourceType,
} from "@/lib/model-adapters/types";

export function modelAdapterCapabilityLabel(dictionary: Dictionary, capability: ModelAdapterCapability) {
  return dictionary.plan.modelAdapters.capabilities[capability];
}

export function modelAdapterSelectionLabel(dictionary: Dictionary, selection: ModelAdapterSelection) {
  return dictionary.plan.modelAdapters.selections[selection];
}

export function modelAdapterSourceLabel(dictionary: Dictionary, sourceType: ModelAdapterSourceType) {
  return dictionary.plan.modelAdapters.sources[sourceType];
}

export function modelAdapterExecutionModeLabel(dictionary: Dictionary, mode: ModelAdapterExecutionMode) {
  return dictionary.plan.modelAdapters.executionModes[mode];
}

export function externalModelProviderLabel(dictionary: Dictionary, providerKey: ExternalModelProviderKey | null) {
  switch (providerKey) {
    case "openai_compatible":
      return dictionary.plan.modelAdapters.providers.openai_compatible;
    case "custom_http":
      return dictionary.plan.modelAdapters.providers.custom_http;
    default:
      return dictionary.plan.modelAdapters.notConfigured;
  }
}

export function modelAdapterOutcomeLabel(dictionary: Dictionary, run: ModelAdapterRunRecord) {
  if (run.status === "failed") {
    return dictionary.plan.modelAdapters.outcomes.failed;
  }

  if (run.requestedSelection === "external_model" && run.sourceType === "external_model") {
    return dictionary.plan.modelAdapters.outcomes.live;
  }

  if (run.requestedSelection === "external_model" && run.executionMode === "fallback") {
    return dictionary.plan.modelAdapters.outcomes.fallback;
  }

  return dictionary.plan.modelAdapters.outcomes.deterministic;
}

export function modelAdapterHealthStatusLabel(
  dictionary: Dictionary,
  status: ModelAdapterCapabilityHealthRecord["status"],
) {
  return dictionary.plan.modelAdapters.healthStatuses[status];
}
