import { requestOpenAICompatibleJson, resolveOpenAICompatibleEndpoint, readApiKeyFromEnv } from "@/lib/model-adapters/openai-compatible";
import { ExternalProviderExecutionError } from "@/lib/model-adapters/errors";
import { ExternalAdapterNotReadyError } from "@/lib/model-adapters/registry";
import type { ModelAdapterTraceRecord } from "@/lib/model-adapters/types";
import { buildPlannerArtifacts } from "@/lib/planner/utils";
import type { PlannerInput, PlannerResult, PlannerRunTrigger } from "@/lib/planner/types";
import type { StructuredPlan, StructuredPlanDataModel } from "@/lib/workspaces/types";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

function normalizeDataModels(value: unknown): StructuredPlanDataModel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const name = normalizeString(record.name);
      const description = normalizeString(record.description);

      if (!name || !description) {
        return null;
      }

      return {
        name,
        description,
      } satisfies StructuredPlanDataModel;
    })
    .filter((item): item is StructuredPlanDataModel => item !== null);
}

function ensureStructuredPlan(value: unknown): StructuredPlan {
  if (!value || typeof value !== "object") {
    throw new Error("Provider output did not include a valid plan object.");
  }

  const record = value as Record<string, unknown>;
  const plan: StructuredPlan = {
    productSummary: normalizeString(record.productSummary),
    targetUsers: normalizeStringList(record.targetUsers),
    pageMap: normalizeStringList(record.pageMap),
    featureList: normalizeStringList(record.featureList),
    dataModels: normalizeDataModels(record.dataModels),
    authRoles: normalizeStringList(record.authRoles),
    integrationsNeeded: normalizeStringList(record.integrationsNeeded),
    designDirection: normalizeString(record.designDirection),
  };

  if (
    !plan.productSummary ||
    plan.targetUsers.length === 0 ||
    plan.pageMap.length === 0 ||
    plan.featureList.length === 0 ||
    plan.dataModels.length === 0 ||
    plan.authRoles.length === 0 ||
    plan.integrationsNeeded.length === 0 ||
    !plan.designDirection
  ) {
    throw new Error("Provider output did not satisfy the required structured plan fields.");
  }

  return plan;
}

function planningSummary(name: string, trigger: PlannerRunTrigger, pageCount: number, capabilityCount: number) {
  const modeLabel = trigger === "project_create" ? "initial" : "rerun";
  return `Completed ${modeLabel} planner pass for ${name} with ${pageCount} resolved pages and ${capabilityCount} capability signals via external model planning.`;
}

function plannerSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["summary", "plan", "signals"],
    properties: {
      summary: {
        type: "string",
      },
      plan: {
        type: "object",
        additionalProperties: false,
        required: [
          "productSummary",
          "targetUsers",
          "pageMap",
          "featureList",
          "dataModels",
          "authRoles",
          "integrationsNeeded",
          "designDirection",
        ],
        properties: {
          productSummary: { type: "string" },
          targetUsers: {
            type: "array",
            items: { type: "string" },
          },
          pageMap: {
            type: "array",
            items: { type: "string" },
          },
          featureList: {
            type: "array",
            items: { type: "string" },
          },
          dataModels: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "description"],
              properties: {
                name: { type: "string" },
                description: { type: "string" },
              },
            },
          },
          authRoles: {
            type: "array",
            items: { type: "string" },
          },
          integrationsNeeded: {
            type: "array",
            items: { type: "string" },
          },
          designDirection: { type: "string" },
        },
      },
      signals: {
        type: "object",
        additionalProperties: false,
        required: ["requestedPageCount", "resolvedPageCount", "enabledCapabilities", "notes"],
        properties: {
          requestedPageCount: { type: "integer" },
          resolvedPageCount: { type: "integer" },
          enabledCapabilities: {
            type: "array",
            items: { type: "string" },
          },
          notes: { type: "string" },
        },
      },
    },
  } as const;
}

function buildPlannerInstructions() {
  return [
    "You are the planning model for a structured website and app builder.",
    "Return JSON only and match the provided schema exactly.",
    "Use only the project brief. Make careful but conservative inferences when details are missing.",
    "Keep page names short and product-facing.",
    "Keep feature, auth role, and integration lists concrete and implementation-friendly.",
    "Do not include markdown, code fences, or explanation outside the schema.",
  ].join(" ");
}

function buildPlannerInputPrompt(input: PlannerInput, trigger: PlannerRunTrigger) {
  return [
    `Planner trigger: ${trigger}`,
    "Project brief JSON:",
    JSON.stringify(
      {
        name: input.name,
        prompt: input.prompt,
        projectType: input.projectType,
        targetUsers: input.targetUsers,
        desiredPagesFeatures: input.desiredPagesFeatures,
        designStyle: input.designStyle,
        primaryLocale: input.primaryLocale,
        supportedLocales: input.supportedLocales,
        country: input.country,
        businessCategory: input.businessCategory,
        capabilities: input.capabilities,
      },
      null,
      2,
    ),
  ].join("\n\n");
}

interface ExternalPlannerStructuredOutput {
  summary: string;
  plan: StructuredPlan;
  signals: {
    requestedPageCount: number;
    resolvedPageCount: number;
    enabledCapabilities: string[];
    notes: string;
  };
}

export interface ExternalPlannerExecutionDetails {
  latencyMs: number;
  trace: ModelAdapterTraceRecord;
}

export class ExternalModelPlannerAdapter {
  readonly source = "external_model_adapter_v1" as const;
  private readonly config: {
    providerKey: "openai_compatible" | "custom_http";
    providerLabel: string;
    modelName: string;
    endpointUrl: string | null;
    apiKeyEnvVar: string;
  };

  constructor(config: {
    providerKey: "openai_compatible" | "custom_http";
    providerLabel: string;
    modelName: string;
    endpointUrl: string | null;
    apiKeyEnvVar: string;
  }) {
    this.config = config;
  }

  async plan(
    input: PlannerInput,
    trigger: PlannerRunTrigger,
  ): Promise<{ result: PlannerResult; execution: ExternalPlannerExecutionDetails }> {
    if (this.config.providerKey !== "openai_compatible") {
      throw new ExternalAdapterNotReadyError(
        `External planner adapter for ${this.config.providerLabel} is not wired beyond OpenAI-compatible planning yet.`,
      );
    }

    let apiKey: string;

    try {
      apiKey = readApiKeyFromEnv(this.config.apiKeyEnvVar);
    } catch (error) {
      throw new ExternalAdapterNotReadyError(
        error instanceof Error ? error.message : "Planning API key is not configured.",
      );
    }

    const endpointUrl = resolveOpenAICompatibleEndpoint(this.config.endpointUrl);

    let providerResponse;

    try {
      providerResponse = await requestOpenAICompatibleJson<ExternalPlannerStructuredOutput>({
        endpointUrl,
        apiKey,
        model: this.config.modelName,
        instructions: buildPlannerInstructions(),
        promptInput: buildPlannerInputPrompt(input, trigger),
        schemaName: "builder_planner_output",
        schema: plannerSchema(),
        metadata: {
          capability: "planning",
          trigger,
        },
      });
    } catch (error) {
      if (error instanceof ExternalProviderExecutionError) {
        throw error;
      }

      throw new ExternalProviderExecutionError(
        error instanceof Error ? error.message : "External planning request failed.",
      );
    }

    const plan = ensureStructuredPlan(providerResponse.parsed.plan);
    const enabledCapabilities = Object.entries(input.capabilities)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key);

    const summary =
      normalizeString(providerResponse.parsed.summary) ||
      planningSummary(input.name, trigger, plan.pageMap.length, enabledCapabilities.length);
    const signals = providerResponse.parsed.signals;

    return {
      result: {
        plan,
        source: this.source,
        summary,
        status: "completed",
        artifacts: buildPlannerArtifacts(input, plan, trigger).map((artifact) =>
          artifact.artifactType === "planning_signals"
            ? {
                ...artifact,
                payload: {
                  ...artifact.payload,
                  requestedPageCount:
                    typeof signals?.requestedPageCount === "number"
                      ? signals.requestedPageCount
                      : artifact.payload.requestedPageCount,
                  resolvedPageCount:
                    typeof signals?.resolvedPageCount === "number"
                      ? signals.resolvedPageCount
                      : artifact.payload.resolvedPageCount,
                  enabledCapabilities:
                    Array.isArray(signals?.enabledCapabilities) &&
                    signals.enabledCapabilities.every((value) => typeof value === "string")
                      ? signals.enabledCapabilities
                      : artifact.payload.enabledCapabilities,
                  providerNotes: normalizeString(signals?.notes),
                  providerModel: this.config.modelName,
                },
              }
            : artifact,
        ),
      },
      execution: {
        latencyMs: providerResponse.latencyMs,
        trace: providerResponse.trace,
      },
    };
  }
}
