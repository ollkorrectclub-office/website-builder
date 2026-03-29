import { expect, test } from "@playwright/test";

import { generateCodePatchSuggestion } from "@/lib/builder/code-patch-service";
import { ExternalProviderExecutionError } from "@/lib/model-adapters/errors";
import { requestOpenAICompatibleJson } from "@/lib/model-adapters/openai-compatible";
import { defaultProjectModelAdapterConfig } from "@/lib/model-adapters/registry";
import { getPlannerService } from "@/lib/planner/service";
import type { PlannerInput } from "@/lib/planner/types";

const originalFetch = global.fetch;
const originalEnv = {
  ENABLE_EXTERNAL_PLANNER: process.env.ENABLE_EXTERNAL_PLANNER,
  enableExternalPlanner: process.env.enableExternalPlanner,
  EXTERNAL_PLANNER_PROVIDER_KEY: process.env.EXTERNAL_PLANNER_PROVIDER_KEY,
  EXTERNAL_PLANNER_PROVIDER_LABEL: process.env.EXTERNAL_PLANNER_PROVIDER_LABEL,
  EXTERNAL_PLANNER_ENDPOINT_URL: process.env.EXTERNAL_PLANNER_ENDPOINT_URL,
  EXTERNAL_PLANNER_API_KEY_ENV_VAR: process.env.EXTERNAL_PLANNER_API_KEY_ENV_VAR,
  EXTERNAL_PLANNER_MODEL: process.env.EXTERNAL_PLANNER_MODEL,
  ENABLE_EXTERNAL_PATCH_SUGGESTION: process.env.ENABLE_EXTERNAL_PATCH_SUGGESTION,
  enableExternalPatchSuggestion: process.env.enableExternalPatchSuggestion,
  EXTERNAL_PATCH_PROVIDER_KEY: process.env.EXTERNAL_PATCH_PROVIDER_KEY,
  EXTERNAL_PATCH_PROVIDER_LABEL: process.env.EXTERNAL_PATCH_PROVIDER_LABEL,
  EXTERNAL_PATCH_ENDPOINT_URL: process.env.EXTERNAL_PATCH_ENDPOINT_URL,
  EXTERNAL_PATCH_API_KEY_ENV_VAR: process.env.EXTERNAL_PATCH_API_KEY_ENV_VAR,
  EXTERNAL_PATCH_MODEL: process.env.EXTERNAL_PATCH_MODEL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};

const samplePlannerInput: PlannerInput = {
  name: "Planner hardening proof",
  prompt: "Plan a bilingual clinic website with trust sections and strong booking prompts.",
  projectType: "marketing_site",
  targetUsers: "New patients, returning patients, family decision-makers",
  desiredPagesFeatures: ["Home", "Services", "Doctors", "Booking", "Contact"],
  designStyle: "Trust-forward editorial",
  primaryLocale: "en",
  supportedLocales: ["en", "sq"],
  country: "kosovo",
  businessCategory: "digital agency",
  capabilities: {
    auth: false,
    cms: true,
    payments: false,
    booking: true,
    ai: false,
    analytics: true,
  },
};

const samplePatchInput = {
  file: {
    path: "src/components/Hero.tsx",
    name: "Hero.tsx",
    kind: "component" as const,
    language: "tsx" as const,
  },
  currentContent: [
    "export function Hero() {",
    "  return <section data-testid=\"hero-root\">Hero section</section>;",
    "}",
  ].join("\n"),
  requestPrompt: "Add a safer CTA marker for this file only.",
};

function resetEnvironment() {
  global.fetch = originalFetch;

  for (const [key, value] of Object.entries(originalEnv)) {
    if (typeof value === "undefined") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function stubFetchWithJsonResponse(payload: Record<string, unknown>, status = 200, statusText = "OK") {
  global.fetch = async () =>
    new Response(JSON.stringify(payload), {
      status,
      statusText,
      headers: {
        "content-type": "application/json",
      },
    });
}

function stubFetchWithAbortAwareHang() {
  global.fetch = async (_input, init) =>
    await new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;

      if (signal && typeof signal.addEventListener === "function") {
        signal.addEventListener(
          "abort",
          () => {
            reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      }
    });
}

function configurePlannerEnv() {
  process.env.ENABLE_EXTERNAL_PLANNER = "true";
  process.env.EXTERNAL_PLANNER_PROVIDER_KEY = "openai_compatible";
  process.env.EXTERNAL_PLANNER_PROVIDER_LABEL = "OpenAI-compatible hardening stub";
  process.env.EXTERNAL_PLANNER_MODEL = "gpt-5.4-mini";
  process.env.EXTERNAL_PLANNER_API_KEY_ENV_VAR = "OPENAI_API_KEY";
  process.env.OPENAI_API_KEY = "phase68-local-openai-key";
}

function configurePatchEnv() {
  process.env.ENABLE_EXTERNAL_PATCH_SUGGESTION = "true";
  process.env.EXTERNAL_PATCH_PROVIDER_KEY = "openai_compatible";
  process.env.EXTERNAL_PATCH_PROVIDER_LABEL = "OpenAI-compatible hardening stub";
  process.env.EXTERNAL_PATCH_MODEL = "gpt-5.4-mini";
  process.env.EXTERNAL_PATCH_API_KEY_ENV_VAR = "OPENAI_API_KEY";
  process.env.OPENAI_API_KEY = "phase68-local-openai-key";
}

test.describe.serial("provider output hardening", () => {
  test.afterEach(() => {
    resetEnvironment();
  });

  test("classifies provider timeouts clearly", async () => {
    stubFetchWithAbortAwareHang();

    const execution = requestOpenAICompatibleJson<Record<string, unknown>>({
      endpointUrl: "https://example.invalid/v1/responses",
      apiKey: "phase68-local-openai-key",
      model: "gpt-5.4-mini",
      instructions: "Return valid JSON.",
      promptInput: "Planner hardening timeout proof.",
      schemaName: "timeout_proof",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["ok"],
        properties: {
          ok: { type: "boolean" },
        },
      },
      timeoutMs: 5,
    });

    await expect(execution).rejects.toMatchObject<Partial<ExternalProviderExecutionError>>({
      classification: "timeout",
    });
  });

  test("falls back safely when planner provider output is partial", async () => {
    configurePlannerEnv();
    stubFetchWithJsonResponse({
      id: "resp_phase68_planning_partial",
      status: "completed",
      output_text: JSON.stringify({
        summary: "Partial planner output",
        plan: {
          productSummary: "Clinic launch site",
          targetUsers: ["New patients"],
          pageMap: ["Home"],
          featureList: ["Booking CTA"],
          dataModels: [],
          authRoles: [],
          integrationsNeeded: [],
          designDirection: "",
        },
        signals: {
          requestedPageCount: 0,
          resolvedPageCount: 0,
          enabledCapabilities: [],
          notes: "",
        },
      }),
    });

    const result = await getPlannerService(null).generateInitialPlan(samplePlannerInput);

    expect(result.result.source).toBe("rules_planner_v1");
    expect(result.adapterExecution.executionMode).toBe("fallback");
    expect(result.adapterExecution.executedSelection).toBe("deterministic_internal");
    expect(result.adapterExecution.fallbackReason).toContain("[invalid_output]");
  });

  test("falls back safely when patch provider output is malformed", async () => {
    configurePatchEnv();
    stubFetchWithJsonResponse({
      id: "resp_phase68_patch_malformed",
      status: "completed",
      output_text: JSON.stringify({
        title: "Malformed diff payload",
        rationale: "This should be rejected safely.",
        changeSummary: "Returns a diff instead of one-file replacement content.",
        proposedContent: [
          "diff --git a/src/components/Hero.tsx b/src/components/Hero.tsx",
          "--- a/src/components/Hero.tsx",
          "+++ b/src/components/Hero.tsx",
          "@@",
        ].join("\n"),
        notes: "Malformed output proof.",
      }),
    });

    const result = await generateCodePatchSuggestion(
      samplePatchInput,
      defaultProjectModelAdapterConfig({
        workspaceId: "workspace_phase68_patch",
        projectId: "project_phase68_patch",
      }),
    );

    expect(result.suggestion.source).toBe("mock_assistant");
    expect(result.adapterExecution.executionMode).toBe("fallback");
    expect(result.adapterExecution.executedSelection).toBe("deterministic_internal");
    expect(result.adapterExecution.fallbackReason).toContain("[invalid_output]");
  });
});
