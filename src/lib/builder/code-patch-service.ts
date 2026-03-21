import { generateMockCodePatchSuggestion, type GeneratedCodePatchSuggestion } from "@/lib/builder/code-patch-suggester";
import { ExternalPatchSuggestionAdapter, type ExternalPatchSuggestionInput } from "@/lib/builder/external-model-patch-suggester";
import { ExternalProviderExecutionError, ModelAdapterExecutionError } from "@/lib/model-adapters/errors";
import { resolveCapabilityAdapterConfig } from "@/lib/model-adapters/registry";
import type {
  ModelAdapterExecutionRecord,
  ProjectModelAdapterConfigRecord,
} from "@/lib/model-adapters/types";

function defaultResolvedConfig() {
  return {
    capability: "patch_suggestion" as const,
    selection: "deterministic_internal" as const,
    sourceType: "deterministic_internal" as const,
    providerKey: null,
    providerLabel: null,
    endpointUrl: null,
    apiKeyEnvVar: null,
    modelName: null,
    externalReady: false,
    missingFields: [],
  };
}

export interface CodePatchSuggestionServiceResult {
  suggestion: GeneratedCodePatchSuggestion;
  adapterExecution: ModelAdapterExecutionRecord;
}

export async function generateCodePatchSuggestion(
  input: ExternalPatchSuggestionInput,
  config: ProjectModelAdapterConfigRecord | null,
): Promise<CodePatchSuggestionServiceResult> {
  const resolved = config ? resolveCapabilityAdapterConfig(config, "patch_suggestion") : defaultResolvedConfig();
  let fallbackReason: string | null = null;

  if (resolved.selection === "external_model") {
    if (!resolved.externalReady) {
      fallbackReason = `External patch config is incomplete: ${resolved.missingFields.join(", ")}.`;
    } else {
      let latencyMs: number | null = null;
      let trace = null;

      try {
        const externalAdapter = new ExternalPatchSuggestionAdapter({
          providerKey: resolved.providerKey ?? "custom_http",
          providerLabel: resolved.providerLabel ?? "External provider",
          modelName: resolved.modelName ?? "unknown-model",
          endpointUrl: resolved.endpointUrl,
          apiKeyEnvVar: resolved.apiKeyEnvVar ?? "",
        });
        const execution = await externalAdapter.suggest(input);

        return {
          suggestion: execution.suggestion,
          adapterExecution: {
            capability: "patch_suggestion",
            requestedSelection: resolved.selection,
            executedSelection: "external_model",
            sourceType: "external_model",
            executionMode: "selected",
            requestedAdapterKey: "external_patch_adapter_v1",
            executedAdapterKey: "external_patch_adapter_v1",
            providerKey: resolved.providerKey,
            providerLabel: resolved.providerLabel,
            modelName: resolved.modelName,
            endpointUrl: resolved.endpointUrl,
            latencyMs: execution.execution.latencyMs,
            trace: execution.execution.trace,
            fallbackReason: null,
            summary: `Patch suggestion executed through the external patch adapter for ${resolved.modelName}.`,
            metadata: {
              filePath: input.file.path,
              providerMode: "responses_api",
            },
          },
        };
      } catch (error) {
        fallbackReason = error instanceof Error ? error.message : "External patch adapter failed.";
        if (error instanceof ExternalProviderExecutionError) {
          latencyMs = error.latencyMs;
          trace = error.trace;
        }

        const adapterExecution = {
          capability: "patch_suggestion" as const,
          requestedSelection: resolved.selection,
          executedSelection: "deterministic_internal" as const,
          sourceType: "deterministic_internal" as const,
          executionMode: "fallback" as const,
          requestedAdapterKey: "external_patch_adapter_v1",
          executedAdapterKey: "mock_assistant",
          providerKey: resolved.providerKey,
          providerLabel: resolved.providerLabel,
          modelName: resolved.modelName,
          endpointUrl: resolved.endpointUrl,
          latencyMs,
          trace,
          fallbackReason,
          summary: `Patch suggestion fell back to mock_assistant: ${fallbackReason}`,
          metadata: {
            filePath: input.file.path,
            missingFields: resolved.missingFields,
            providerMode: "responses_api",
          },
        };

        try {
          const suggestion = generateMockCodePatchSuggestion(input);
          return {
            suggestion,
            adapterExecution,
          };
        } catch (innerError) {
          throw new ModelAdapterExecutionError(
            innerError instanceof Error ? innerError.message : "Patch suggestion execution failed.",
            adapterExecution,
          );
        }
      }
    }
  }

  const adapterExecution: ModelAdapterExecutionRecord = {
    capability: "patch_suggestion",
    requestedSelection: resolved.selection,
    executedSelection: "deterministic_internal",
    sourceType: "deterministic_internal",
    executionMode: fallbackReason ? "fallback" : "selected",
    requestedAdapterKey: resolved.selection === "external_model" ? "external_patch_adapter_v1" : "mock_assistant",
    executedAdapterKey: "mock_assistant",
    providerKey: resolved.providerKey,
    providerLabel: resolved.providerLabel,
    modelName: resolved.modelName,
    endpointUrl: resolved.endpointUrl,
    latencyMs: null,
    trace: null,
    fallbackReason,
    summary: fallbackReason
      ? `Patch suggestion fell back to mock_assistant: ${fallbackReason}`
      : "Patch suggestion executed with mock_assistant.",
    metadata: {
      filePath: input.file.path,
      missingFields: resolved.missingFields,
    },
  };

  try {
    const suggestion = generateMockCodePatchSuggestion(input);
    return {
      suggestion,
      adapterExecution,
    };
  } catch (error) {
    throw new ModelAdapterExecutionError(
      error instanceof Error ? error.message : "Patch suggestion execution failed.",
      adapterExecution,
    );
  }
}
