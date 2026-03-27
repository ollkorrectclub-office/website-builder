import {
  type CodePatchSuggestionInput,
  type CodePatchSuggestionService,
  type ExternalPatchSuggestionAdapterFactory,
  type CodePatchSuggestionServiceDependencies,
  type CodePatchSuggestionServiceResult,
} from "@/lib/builder/code-patch-types";
import { MockCodePatchSuggestionAdapter } from "@/lib/builder/code-patch-suggester";
import { ExternalPatchSuggestionAdapter } from "@/lib/builder/external-model-patch-suggester";
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

class DefaultExternalPatchSuggestionAdapterFactory implements ExternalPatchSuggestionAdapterFactory {
  create(config: ConstructorParameters<typeof ExternalPatchSuggestionAdapter>[0]) {
    return new ExternalPatchSuggestionAdapter(config);
  }
}

function defaultCodePatchSuggestionServiceDependencies(): CodePatchSuggestionServiceDependencies {
  return {
    deterministicAdapter: new MockCodePatchSuggestionAdapter(),
    externalAdapterFactory: new DefaultExternalPatchSuggestionAdapterFactory(),
  };
}

class AdapterCodePatchSuggestionService implements CodePatchSuggestionService {
  private readonly config: ProjectModelAdapterConfigRecord | null;
  private readonly dependencies: CodePatchSuggestionServiceDependencies;

  constructor(config: ProjectModelAdapterConfigRecord | null, dependencies: CodePatchSuggestionServiceDependencies) {
    this.config = config;
    this.dependencies = dependencies;
  }

  async generateSuggestion(input: CodePatchSuggestionInput): Promise<CodePatchSuggestionServiceResult> {
    const resolved = this.config ? resolveCapabilityAdapterConfig(this.config, "patch_suggestion") : defaultResolvedConfig();
    let fallbackReason: string | null = null;

    if (resolved.selection === "external_model") {
      if (!resolved.externalReady) {
        fallbackReason = `External patch config is incomplete: ${resolved.missingFields.join(", ")}.`;
      } else {
        let latencyMs: number | null = null;
        let trace = null;

        try {
          const externalAdapter = this.dependencies.externalAdapterFactory.create({
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
            executedAdapterKey: this.dependencies.deterministicAdapter.source,
            providerKey: resolved.providerKey,
            providerLabel: resolved.providerLabel,
            modelName: resolved.modelName,
            endpointUrl: resolved.endpointUrl,
            latencyMs,
            trace,
            fallbackReason,
            summary: `Patch suggestion fell back to ${this.dependencies.deterministicAdapter.source}: ${fallbackReason}`,
            metadata: {
              filePath: input.file.path,
              missingFields: resolved.missingFields,
              providerMode: "responses_api",
            },
          };

          try {
            const suggestion = await this.dependencies.deterministicAdapter.suggest(input);
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
      requestedAdapterKey:
        resolved.selection === "external_model" ? "external_patch_adapter_v1" : this.dependencies.deterministicAdapter.source,
      executedAdapterKey: this.dependencies.deterministicAdapter.source,
      providerKey: resolved.providerKey,
      providerLabel: resolved.providerLabel,
      modelName: resolved.modelName,
      endpointUrl: resolved.endpointUrl,
      latencyMs: null,
      trace: null,
      fallbackReason,
      summary: fallbackReason
        ? `Patch suggestion fell back to ${this.dependencies.deterministicAdapter.source}: ${fallbackReason}`
        : `Patch suggestion executed with ${this.dependencies.deterministicAdapter.source}.`,
      metadata: {
        filePath: input.file.path,
        missingFields: resolved.missingFields,
      },
    };

    try {
      const suggestion = await this.dependencies.deterministicAdapter.suggest(input);
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
}

export function getCodePatchSuggestionService(
  config: ProjectModelAdapterConfigRecord | null,
  overrides: Partial<CodePatchSuggestionServiceDependencies> = {},
): CodePatchSuggestionService {
  const defaults = defaultCodePatchSuggestionServiceDependencies();

  return new AdapterCodePatchSuggestionService(config, {
    deterministicAdapter: overrides.deterministicAdapter ?? defaults.deterministicAdapter,
    externalAdapterFactory: overrides.externalAdapterFactory ?? defaults.externalAdapterFactory,
  });
}

export async function generateCodePatchSuggestion(
  input: CodePatchSuggestionInput,
  config: ProjectModelAdapterConfigRecord | null,
): Promise<CodePatchSuggestionServiceResult> {
  return getCodePatchSuggestionService(config).generateSuggestion(input);
}
