import { requestOpenAICompatibleJson, resolveOpenAICompatibleEndpoint, readApiKeyFromEnv } from "@/lib/model-adapters/openai-compatible";
import { ExternalProviderExecutionError } from "@/lib/model-adapters/errors";
import { ExternalAdapterNotReadyError } from "@/lib/model-adapters/registry";
import { buildPlannerArtifacts } from "@/lib/planner/utils";
import type {
  PlannerExternalAdapter,
  PlannerExternalAdapterConfig,
  PlannerExternalExecutionDetails,
  PlannerInput,
  PlannerResult,
  PlannerRunTrigger,
} from "@/lib/planner/types";
import type { StructuredPlan, StructuredPlanDataModel } from "@/lib/workspaces/types";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => normalizeString(item)).filter(Boolean))];
}

function normalizeDataModels(value: unknown): StructuredPlanDataModel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

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
    .filter((item): item is StructuredPlanDataModel => {
      if (!item) {
        return false;
      }

      const key = item.name.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function validateStructuredPlanPayload(value: unknown): StructuredPlan {
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

function validatePlanningSignals(
  value: unknown,
  input: PlannerInput,
  plan: StructuredPlan,
) {
  if (!value || typeof value !== "object") {
    throw new Error("Provider output did not include a valid planning signals object.");
  }

  const record = value as Record<string, unknown>;
  const enabledCapabilities = Object.entries(input.capabilities)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);
  const requestedPageCount =
    typeof record.requestedPageCount === "number" ? record.requestedPageCount : Number.NaN;
  const resolvedPageCount =
    typeof record.resolvedPageCount === "number" ? record.resolvedPageCount : Number.NaN;
  const providerCapabilities = normalizeStringList(record.enabledCapabilities);
  const notes = normalizeString(record.notes);

  if (!Number.isInteger(requestedPageCount) || requestedPageCount < 1) {
    throw new Error("Provider output did not include a valid requested page count.");
  }

  if (!Number.isInteger(resolvedPageCount) || resolvedPageCount !== plan.pageMap.length) {
    throw new Error("Provider output did not include a valid resolved page count.");
  }

  if (
    providerCapabilities.length === 0 ||
    providerCapabilities.some((value) => !enabledCapabilities.includes(value))
  ) {
    throw new Error("Provider output included invalid enabled capabilities.");
  }

  if (!notes) {
    throw new Error("Provider output did not include provider notes for planning signals.");
  }

  return {
    requestedPageCount,
    resolvedPageCount,
    enabledCapabilities: providerCapabilities,
    notes,
  };
}

function matchesStructuredPlan(left: Record<string, unknown>, plan: StructuredPlan) {
  return (
    left.productSummary === plan.productSummary &&
    JSON.stringify(left.targetUsers) === JSON.stringify(plan.targetUsers) &&
    JSON.stringify(left.pageMap) === JSON.stringify(plan.pageMap) &&
    JSON.stringify(left.featureList) === JSON.stringify(plan.featureList) &&
    JSON.stringify(left.dataModels) === JSON.stringify(plan.dataModels) &&
    JSON.stringify(left.authRoles) === JSON.stringify(plan.authRoles) &&
    JSON.stringify(left.integrationsNeeded) === JSON.stringify(plan.integrationsNeeded) &&
    left.designDirection === plan.designDirection
  );
}

function validatePlannerArtifacts(
  input: PlannerInput,
  plan: StructuredPlan,
  artifacts: PlannerResult["artifacts"],
) {
  const normalizedBrief = artifacts.find((artifact) => artifact.artifactType === "normalized_brief");
  const planningSignals = artifacts.find((artifact) => artifact.artifactType === "planning_signals");
  const planPayload = artifacts.find((artifact) => artifact.artifactType === "plan_payload");

  if (!normalizedBrief || !planningSignals || !planPayload) {
    throw new Error("Planner artifacts did not include the required normalized_brief, planning_signals, and plan_payload records.");
  }

  if (normalizedBrief.payload.name !== input.name || normalizedBrief.payload.projectType !== input.projectType) {
    throw new Error("Normalized brief artifact did not preserve the expected project brief fields.");
  }

  if (
    typeof planningSignals.payload.requestedPageCount !== "number" ||
    typeof planningSignals.payload.resolvedPageCount !== "number" ||
    !Array.isArray(planningSignals.payload.enabledCapabilities)
  ) {
    throw new Error("Planning signals artifact did not preserve the expected signal fields.");
  }

  if (planningSignals.payload.resolvedPageCount !== plan.pageMap.length) {
    throw new Error("Planning signals artifact did not stay aligned with the final plan.");
  }

  if (!matchesStructuredPlan(planPayload.payload, plan)) {
    throw new Error("Plan payload artifact did not match the validated structured plan.");
  }
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

function buildPlannerPromptTemplate() {
  return [
    "You are the planning model for a structured website and app builder.",
    "Return JSON only and match the provided schema exactly.",
    "Use only the project brief. Make careful but conservative inferences when details are missing.",
    "Produce output that is immediately safe to store as downstream normalized_brief, planning_signals, and plan_payload artifacts.",
    "Every required string must be non-empty, concise, and product-appropriate.",
    "Every list must contain unique non-empty items only.",
    "Keep page names short and product-facing.",
    "Keep feature, auth role, and integration lists concrete and implementation-friendly.",
    "signals.requestedPageCount must reflect the requested page/feature scope from the brief.",
    "signals.resolvedPageCount must exactly match the final number of plan.pageMap entries.",
    "signals.enabledCapabilities must contain only enabled capability keys from the brief.",
    "signals.notes must explain the main planning tradeoff in one short sentence.",
    "Do not include markdown, code fences, or explanation outside the schema.",
  ].join(" ");
}

function buildPlannerPromptInput(input: PlannerInput, trigger: PlannerRunTrigger) {
  const enabledCapabilities = Object.entries(input.capabilities)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);

  return [
    `Planner trigger: ${trigger}`,
    `Enabled capability keys: ${enabledCapabilities.join(", ") || "none"}`,
    `Requested page/feature hints count: ${input.desiredPagesFeatures.length}`,
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

function transformProviderOutputToPlannerResult(
  input: PlannerInput,
  trigger: PlannerRunTrigger,
  config: PlannerExternalAdapterConfig,
  providerOutput: ExternalPlannerStructuredOutput,
): PlannerResult {
  const plan = validateStructuredPlanPayload(providerOutput.plan);
  const signals = validatePlanningSignals(providerOutput.signals, input, plan);
  const enabledCapabilities = Object.entries(input.capabilities)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);
  const summary =
    normalizeString(providerOutput.summary) ||
    planningSummary(input.name, trigger, plan.pageMap.length, enabledCapabilities.length);
  const result: PlannerResult = {
    plan,
    source: "external_model_adapter_v1",
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
              providerModel: config.modelName,
            },
          }
        : artifact,
    ),
  };

  validatePlannerArtifacts(input, plan, result.artifacts);

  return result;
}

const PLANNER_PROVIDER_TIMEOUT_MS = 90_000;

export class ExternalLLMPlannerAdapter implements PlannerExternalAdapter {
  readonly source = "external_model_adapter_v1" as const;
  private readonly config: PlannerExternalAdapterConfig;

  constructor(config: PlannerExternalAdapterConfig) {
    this.config = config;
  }

  async plan(
    input: PlannerInput,
    trigger: PlannerRunTrigger,
  ): Promise<{ result: PlannerResult; execution: PlannerExternalExecutionDetails }> {
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
        instructions: buildPlannerPromptTemplate(),
        promptInput: buildPlannerPromptInput(input, trigger),
        schemaName: "builder_planner_output",
        schema: plannerSchema(),
        metadata: {
          capability: "planning",
          trigger,
        },
        timeoutMs: PLANNER_PROVIDER_TIMEOUT_MS,
        traceLabels: {
          instructions: "Planner prompt template",
          input: "Planner brief payload",
          output: "Planner provider JSON output",
          error: "Planner provider error",
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

    try {
      return {
        result: transformProviderOutputToPlannerResult(input, trigger, this.config, providerResponse.parsed),
        execution: {
          latencyMs: providerResponse.latencyMs,
          trace: providerResponse.trace,
        },
      };
    } catch (error) {
      throw new ExternalProviderExecutionError(
        error instanceof Error ? error.message : "External planning output was invalid.",
        {
          latencyMs: providerResponse.latencyMs,
          trace: providerResponse.trace,
          classification: "invalid_output",
        },
      );
    }
  }
}
