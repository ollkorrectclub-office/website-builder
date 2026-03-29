import { ExternalProviderExecutionError, ModelAdapterExecutionError } from "@/lib/model-adapters/errors";
import { resolveCapabilityAdapterConfig } from "@/lib/model-adapters/registry";
import type { ProjectModelAdapterConfigRecord, ResolvedCapabilityAdapterConfig } from "@/lib/model-adapters/types";
import { defaultPlannerServiceDependencies } from "@/lib/planner/default-service-boundary";
import { resolveEnvPlannerAdapterConfig } from "@/lib/planner/env-config";
import type { PlannerInput, PlannerService, PlannerServiceDependencies, PlannerServiceResult } from "@/lib/planner/types";

function defaultResolvedConfig(): ResolvedCapabilityAdapterConfig {
  return {
    capability: "planning",
    selection: "deterministic_internal",
    sourceType: "deterministic_internal",
    providerKey: null,
    providerLabel: null,
    endpointUrl: null,
    apiKeyEnvVar: null,
    modelName: null,
    externalReady: false,
    missingFields: [],
  };
}

function resolvePlannerAdapterConfig(config: ProjectModelAdapterConfigRecord | null) {
  if (config) {
    return resolveCapabilityAdapterConfig(config, "planning");
  }

  return resolveEnvPlannerAdapterConfig() ?? defaultResolvedConfig();
}

function logExternalPlannerFallback(input: {
  trigger: "project_create" | "project_rerun";
  providerKey: string | null;
  providerLabel: string | null;
  modelName: string | null;
  endpointUrl: string | null;
  classification: string | null;
  latencyMs: number | null;
  reason: string;
}) {
  console.warn("[planner-service] External planner failed, falling back to rule-based planning.", input);
}

class AdapterPlannerService implements PlannerService {
  private readonly dependencies: PlannerServiceDependencies;
  private readonly config: ProjectModelAdapterConfigRecord | null;

  constructor(dependencies: PlannerServiceDependencies, config: ProjectModelAdapterConfigRecord | null) {
    this.dependencies = dependencies;
    this.config = config;
  }

  private async execute(input: PlannerInput, trigger: "project_create" | "project_rerun"): Promise<PlannerServiceResult> {
    const resolved = resolvePlannerAdapterConfig(this.config);
    let fallbackReason: string | null = null;

    if (resolved.selection === "external_model") {
      if (!resolved.externalReady) {
        fallbackReason = `External planner config is incomplete: ${resolved.missingFields.join(", ")}.`;
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
          const execution = await externalAdapter.plan(input, trigger);

          return {
            result: execution.result,
            adapterExecution: {
              capability: "planning",
              requestedSelection: resolved.selection,
              executedSelection: "external_model",
              sourceType: "external_model",
              executionMode: "selected",
              requestedAdapterKey: "external_model_adapter_v1",
              executedAdapterKey: "external_model_adapter_v1",
              providerKey: resolved.providerKey,
              providerLabel: resolved.providerLabel,
              modelName: resolved.modelName,
              endpointUrl: resolved.endpointUrl,
              latencyMs: execution.execution.latencyMs,
              trace: execution.execution.trace,
              fallbackReason: null,
              summary: `Planner run executed through the external model adapter for ${resolved.modelName}.`,
              metadata: {
                trigger,
                providerMode: "responses_api",
              },
            },
          };
        } catch (error) {
          const providerError = error instanceof ExternalProviderExecutionError ? error : null;
          fallbackReason = providerError
            ? `[${providerError.classification}] ${providerError.message}`
            : error instanceof Error
              ? error.message
              : "External planner adapter failed.";
          if (providerError) {
            latencyMs = providerError.latencyMs;
            trace = providerError.trace;
          }
          logExternalPlannerFallback({
            trigger,
            providerKey: resolved.providerKey,
            providerLabel: resolved.providerLabel,
            modelName: resolved.modelName,
            endpointUrl: resolved.endpointUrl,
            classification: providerError?.classification ?? null,
            latencyMs,
            reason: fallbackReason,
          });

          const adapterExecution = {
            capability: "planning" as const,
            requestedSelection: resolved.selection,
            executedSelection: "deterministic_internal" as const,
            sourceType: "deterministic_internal" as const,
            executionMode: "fallback" as const,
            requestedAdapterKey: "external_model_adapter_v1",
            executedAdapterKey: this.dependencies.deterministicAdapter.source,
            providerKey: resolved.providerKey,
            providerLabel: resolved.providerLabel,
            modelName: resolved.modelName,
            endpointUrl: resolved.endpointUrl,
            latencyMs,
            trace,
            fallbackReason,
            summary: `Planner run fell back to ${this.dependencies.deterministicAdapter.source}: ${fallbackReason}`,
            metadata: {
              trigger,
              missingFields: resolved.missingFields,
              providerMode: "responses_api",
            },
          };

          try {
            const result = await this.dependencies.deterministicAdapter.plan(input, trigger);
            return {
              result,
              adapterExecution,
            };
          } catch (innerError) {
            throw new ModelAdapterExecutionError(
              innerError instanceof Error ? innerError.message : "Planner execution failed.",
              adapterExecution,
            );
          }
        }
      }
    }

    const adapterExecution = {
      capability: "planning" as const,
      requestedSelection: resolved.selection,
      executedSelection: "deterministic_internal" as const,
      sourceType: "deterministic_internal" as const,
      executionMode: fallbackReason ? ("fallback" as const) : ("selected" as const),
      requestedAdapterKey:
        resolved.selection === "external_model"
          ? "external_model_adapter_v1"
          : this.dependencies.deterministicAdapter.source,
      executedAdapterKey: this.dependencies.deterministicAdapter.source,
      providerKey: resolved.providerKey,
      providerLabel: resolved.providerLabel,
      modelName: resolved.modelName,
      endpointUrl: resolved.endpointUrl,
      latencyMs: null,
      trace: null,
      fallbackReason,
      summary: fallbackReason
        ? `Planner run fell back to ${this.dependencies.deterministicAdapter.source}: ${fallbackReason}`
        : `Planner run executed with ${this.dependencies.deterministicAdapter.source}.`,
      metadata: {
        trigger,
        missingFields: resolved.missingFields,
      },
    };

    try {
      const result = await this.dependencies.deterministicAdapter.plan(input, trigger);
      return {
        result,
        adapterExecution,
      };
    } catch (error) {
      throw new ModelAdapterExecutionError(
        error instanceof Error ? error.message : "Planner execution failed.",
        adapterExecution,
      );
    }
  }

  async generateInitialPlan(input: PlannerInput): Promise<PlannerServiceResult> {
    return this.execute(input, "project_create");
  }

  async rerunPlan(input: PlannerInput): Promise<PlannerServiceResult> {
    return this.execute(input, "project_rerun");
  }
}

export function getPlannerService(
  config: ProjectModelAdapterConfigRecord | null = null,
  overrides: Partial<PlannerServiceDependencies> = {},
): PlannerService {
  const defaults = defaultPlannerServiceDependencies();

  return new AdapterPlannerService(
    {
      deterministicAdapter: overrides.deterministicAdapter ?? defaults.deterministicAdapter,
      externalAdapterFactory: overrides.externalAdapterFactory ?? defaults.externalAdapterFactory,
    },
    config,
  );
}
