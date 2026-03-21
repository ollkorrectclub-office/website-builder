import { ExternalProviderExecutionError, ModelAdapterExecutionError } from "@/lib/model-adapters/errors";
import { resolveCapabilityAdapterConfig } from "@/lib/model-adapters/registry";
import type { ProjectModelAdapterConfigRecord } from "@/lib/model-adapters/types";
import { DeterministicGenerationAdapter } from "@/lib/generation/deterministic-generator";
import { ExternalCodegenAdapter } from "@/lib/generation/external-model-generator";
import type { GenerationInput, GenerationService, GenerationServiceResult } from "@/lib/generation/types";

class AdapterGenerationService implements GenerationService {
  private readonly adapter = new DeterministicGenerationAdapter();
  private readonly config: ProjectModelAdapterConfigRecord | null;

  constructor(config: ProjectModelAdapterConfigRecord | null) {
    this.config = config;
  }

  private async execute(
    input: GenerationInput,
    trigger: "plan_approved" | "manual_rerun",
  ): Promise<GenerationServiceResult> {
    const resolved = this.config
      ? resolveCapabilityAdapterConfig(this.config, "generation")
      : {
          capability: "generation" as const,
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
    let fallbackReason: string | null = null;

    if (resolved.selection === "external_model") {
      if (!resolved.externalReady) {
        fallbackReason = `External codegen config is incomplete: ${resolved.missingFields.join(", ")}.`;
      } else {
        let latencyMs: number | null = null;
        let trace = null;

        try {
          const externalAdapter = new ExternalCodegenAdapter({
            providerKey: resolved.providerKey ?? "custom_http",
            providerLabel: resolved.providerLabel ?? "External provider",
            modelName: resolved.modelName ?? "unknown-model",
            endpointUrl: resolved.endpointUrl,
            apiKeyEnvVar: resolved.apiKeyEnvVar ?? "",
          });
          const execution = await externalAdapter.generate(input, trigger);

          return {
            result: execution.result,
            adapterExecution: {
              capability: "generation",
              requestedSelection: resolved.selection,
              executedSelection: "external_model",
              sourceType: "external_model",
              executionMode: "selected",
              requestedAdapterKey: "external_codegen_adapter_v1",
              executedAdapterKey: "external_codegen_adapter_v1",
              providerKey: resolved.providerKey,
              providerLabel: resolved.providerLabel,
              modelName: resolved.modelName,
              endpointUrl: resolved.endpointUrl,
              latencyMs: execution.execution.latencyMs,
              trace: execution.execution.trace,
              fallbackReason: null,
              summary: `Generation run executed through the external codegen adapter for ${resolved.modelName}.`,
              metadata: {
                trigger,
                providerMode: "responses_api",
              },
            },
          };
        } catch (error) {
          fallbackReason = error instanceof Error ? error.message : "External codegen adapter failed.";
          if (error instanceof ExternalProviderExecutionError) {
            latencyMs = error.latencyMs;
            trace = error.trace;
          }

          const adapterExecution = {
            capability: "generation" as const,
            requestedSelection: resolved.selection,
            executedSelection: "deterministic_internal" as const,
            sourceType: "deterministic_internal" as const,
            executionMode: "fallback" as const,
            requestedAdapterKey: "external_codegen_adapter_v1",
            executedAdapterKey: this.adapter.source,
            providerKey: resolved.providerKey,
            providerLabel: resolved.providerLabel,
            modelName: resolved.modelName,
            endpointUrl: resolved.endpointUrl,
            latencyMs,
            trace,
            fallbackReason,
            summary: `Generation run fell back to ${this.adapter.source}: ${fallbackReason}`,
            metadata: {
              trigger,
              missingFields: resolved.missingFields,
              providerMode: "responses_api",
            },
          };

          try {
            const result = await this.adapter.generate(input, trigger);
            return {
              result,
              adapterExecution,
            };
          } catch (innerError) {
            throw new ModelAdapterExecutionError(
              innerError instanceof Error ? innerError.message : "Generation execution failed.",
              adapterExecution,
            );
          }
        }
      }
    }

    const adapterExecution = {
      capability: "generation" as const,
      requestedSelection: resolved.selection,
      executedSelection: "deterministic_internal" as const,
      sourceType: "deterministic_internal" as const,
      executionMode: fallbackReason ? ("fallback" as const) : ("selected" as const),
      requestedAdapterKey:
        resolved.selection === "external_model" ? "external_codegen_adapter_v1" : this.adapter.source,
      executedAdapterKey: this.adapter.source,
      providerKey: resolved.providerKey,
      providerLabel: resolved.providerLabel,
      modelName: resolved.modelName,
      endpointUrl: resolved.endpointUrl,
      latencyMs: null,
      trace: null,
      fallbackReason,
      summary: fallbackReason
        ? `Generation run fell back to ${this.adapter.source}: ${fallbackReason}`
        : `Generation run executed with ${this.adapter.source}.`,
      metadata: {
        trigger,
        missingFields: resolved.missingFields,
      },
    };

    try {
      const result = await this.adapter.generate(input, trigger);
      return {
        result,
        adapterExecution,
      };
    } catch (error) {
      throw new ModelAdapterExecutionError(
        error instanceof Error ? error.message : "Generation execution failed.",
        adapterExecution,
      );
    }
  }

  async generateApprovedTargets(input: GenerationInput): Promise<GenerationServiceResult> {
    return this.execute(input, "plan_approved");
  }

  async rerunApprovedTargets(input: GenerationInput): Promise<GenerationServiceResult> {
    return this.execute(input, "manual_rerun");
  }
}

export function getGenerationService(config: ProjectModelAdapterConfigRecord | null = null): GenerationService {
  return new AdapterGenerationService(config);
}
