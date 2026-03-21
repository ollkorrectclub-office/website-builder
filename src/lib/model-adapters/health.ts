import { readApiKeyFromEnv } from "@/lib/model-adapters/openai-compatible";
import { resolveCapabilityAdapterConfig } from "@/lib/model-adapters/registry";
import type {
  ModelAdapterCapability,
  ModelAdapterCapabilityHealthRecord,
  ModelAdapterRunRecord,
  ProjectModelAdapterConfigRecord,
  ProjectModelAdapterBundle,
} from "@/lib/model-adapters/types";

export function isProviderVerificationRun(run: ModelAdapterRunRecord) {
  return run.trigger === "provider_verification" || run.metadata.runKind === "provider_verification";
}

export function latestOperationalRunByCapability(runs: ModelAdapterRunRecord[]) {
  return {
    planning: runs.find((run) => run.capability === "planning" && !isProviderVerificationRun(run)) ?? null,
    generation: runs.find((run) => run.capability === "generation" && !isProviderVerificationRun(run)) ?? null,
    patch_suggestion:
      runs.find((run) => run.capability === "patch_suggestion" && !isProviderVerificationRun(run)) ?? null,
  } satisfies ProjectModelAdapterBundle["latestRunByCapability"];
}

export function latestVerificationRunByCapability(runs: ModelAdapterRunRecord[]) {
  return {
    planning: runs.find((run) => run.capability === "planning" && isProviderVerificationRun(run)) ?? null,
    generation: runs.find((run) => run.capability === "generation" && isProviderVerificationRun(run)) ?? null,
    patch_suggestion:
      runs.find((run) => run.capability === "patch_suggestion" && isProviderVerificationRun(run)) ?? null,
  } satisfies ProjectModelAdapterBundle["latestVerificationRunByCapability"];
}

function configHasLiveApiKey(config: ProjectModelAdapterConfigRecord, capability: ModelAdapterCapability) {
  const resolved = resolveCapabilityAdapterConfig(config, capability);

  if (resolved.selection !== "external_model" || !resolved.apiKeyEnvVar) {
    return false;
  }

  try {
    readApiKeyFromEnv(resolved.apiKeyEnvVar);
    return true;
  } catch {
    return false;
  }
}

function healthSummary(input: {
  capability: ModelAdapterCapability;
  status: ModelAdapterCapabilityHealthRecord["status"];
  missingFields: string[];
  apiKeyEnvVar: string | null;
  latestVerificationRun: ModelAdapterRunRecord | null;
}) {
  switch (input.status) {
    case "deterministic_only":
      return "This capability is currently pinned to the deterministic internal adapter.";
    case "config_incomplete":
      return `External config is incomplete for ${input.capability}: ${input.missingFields.join(", ")}.`;
    case "env_missing":
      return input.apiKeyEnvVar
        ? `Environment variable ${input.apiKeyEnvVar} is not available for live provider execution.`
        : "The configured API key env var is missing for live provider execution.";
    case "ready_to_verify":
      return "External config is ready. Run a live provider check before trusting this path.";
    case "verified":
      return "The latest live provider verification succeeded for this capability.";
    case "verification_failed":
      return (
        input.latestVerificationRun?.errorMessage ||
        input.latestVerificationRun?.fallbackReason ||
        "The latest live provider verification failed for this capability."
      );
  }
}

function buildCapabilityHealth(
  config: ProjectModelAdapterConfigRecord,
  capability: ModelAdapterCapability,
  latestRun: ModelAdapterRunRecord | null,
  latestVerificationRun: ModelAdapterRunRecord | null,
): ModelAdapterCapabilityHealthRecord {
  const resolved = resolveCapabilityAdapterConfig(config, capability);

  if (resolved.selection !== "external_model") {
    return {
      capability,
      selection: resolved.selection,
      status: "deterministic_only",
      summary: healthSummary({
        capability,
        status: "deterministic_only",
        missingFields: [],
        apiKeyEnvVar: resolved.apiKeyEnvVar,
        latestVerificationRun,
      }),
      missingFields: [],
      apiKeyEnvVar: resolved.apiKeyEnvVar,
      providerKey: resolved.providerKey,
      providerLabel: resolved.providerLabel,
      modelName: resolved.modelName,
      latestRun,
      latestVerificationRun,
    };
  }

  if (resolved.missingFields.length > 0) {
    return {
      capability,
      selection: resolved.selection,
      status: "config_incomplete",
      summary: healthSummary({
        capability,
        status: "config_incomplete",
        missingFields: resolved.missingFields,
        apiKeyEnvVar: resolved.apiKeyEnvVar,
        latestVerificationRun,
      }),
      missingFields: resolved.missingFields,
      apiKeyEnvVar: resolved.apiKeyEnvVar,
      providerKey: resolved.providerKey,
      providerLabel: resolved.providerLabel,
      modelName: resolved.modelName,
      latestRun,
      latestVerificationRun,
    };
  }

  if (!configHasLiveApiKey(config, capability)) {
    return {
      capability,
      selection: resolved.selection,
      status: "env_missing",
      summary: healthSummary({
        capability,
        status: "env_missing",
        missingFields: resolved.missingFields,
        apiKeyEnvVar: resolved.apiKeyEnvVar,
        latestVerificationRun,
      }),
      missingFields: resolved.missingFields,
      apiKeyEnvVar: resolved.apiKeyEnvVar,
      providerKey: resolved.providerKey,
      providerLabel: resolved.providerLabel,
      modelName: resolved.modelName,
      latestRun,
      latestVerificationRun,
    };
  }

  const verificationIsFresh =
    latestVerificationRun !== null && latestVerificationRun.startedAt >= config.updatedAt;

  const status =
    verificationIsFresh && latestVerificationRun?.status === "completed"
      ? "verified"
      : verificationIsFresh && latestVerificationRun?.status === "failed"
        ? "verification_failed"
        : "ready_to_verify";

  return {
    capability,
    selection: resolved.selection,
    status,
    summary: healthSummary({
      capability,
      status,
      missingFields: resolved.missingFields,
      apiKeyEnvVar: resolved.apiKeyEnvVar,
      latestVerificationRun,
    }),
    missingFields: resolved.missingFields,
    apiKeyEnvVar: resolved.apiKeyEnvVar,
    providerKey: resolved.providerKey,
    providerLabel: resolved.providerLabel,
    modelName: resolved.modelName,
    latestRun,
    latestVerificationRun,
  };
}

export function buildModelAdapterHealthByCapability(
  config: ProjectModelAdapterConfigRecord,
  latestRunByCapability: ProjectModelAdapterBundle["latestRunByCapability"],
  latestVerificationRuns: ProjectModelAdapterBundle["latestVerificationRunByCapability"],
) {
  return {
    planning: buildCapabilityHealth(
      config,
      "planning",
      latestRunByCapability.planning,
      latestVerificationRuns.planning,
    ),
    generation: buildCapabilityHealth(
      config,
      "generation",
      latestRunByCapability.generation,
      latestVerificationRuns.generation,
    ),
    patch_suggestion: buildCapabilityHealth(
      config,
      "patch_suggestion",
      latestRunByCapability.patch_suggestion,
      latestVerificationRuns.patch_suggestion,
    ),
  } satisfies ProjectModelAdapterBundle["healthByCapability"];
}
