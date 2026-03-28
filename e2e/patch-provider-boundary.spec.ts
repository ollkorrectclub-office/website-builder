import { expect, test } from "@playwright/test";

import { generateCodePatchSuggestion } from "@/lib/builder/code-patch-service";
import { defaultProjectModelAdapterConfig } from "@/lib/model-adapters/registry";
import { e2eProviderStubBaseUrl, isSupabaseE2EMode } from "./support/env";

const originalEnv = {
  ENABLE_EXTERNAL_PATCH_SUGGESTION: process.env.ENABLE_EXTERNAL_PATCH_SUGGESTION,
  enableExternalPatchSuggestion: process.env.enableExternalPatchSuggestion,
  EXTERNAL_PATCH_PROVIDER_KEY: process.env.EXTERNAL_PATCH_PROVIDER_KEY,
  EXTERNAL_PATCH_PROVIDER_LABEL: process.env.EXTERNAL_PATCH_PROVIDER_LABEL,
  EXTERNAL_PATCH_ENDPOINT_URL: process.env.EXTERNAL_PATCH_ENDPOINT_URL,
  EXTERNAL_PATCH_API_KEY_ENV_VAR: process.env.EXTERNAL_PATCH_API_KEY_ENV_VAR,
  EXTERNAL_PATCH_MODEL: process.env.EXTERNAL_PATCH_MODEL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};

const sampleInput = {
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
  requestPrompt: "Add a safer CTA marker and a tiny review note for this file only.",
};

function resetPatchProviderEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (typeof value === "undefined") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function buildDefaultConfig() {
  return defaultProjectModelAdapterConfig({
    workspaceId: "workspace_patch_boundary",
    projectId: "project_patch_boundary",
  });
}

function expectStablePatchShape(value: Awaited<ReturnType<typeof generateCodePatchSuggestion>>["suggestion"]) {
  expect(Object.keys(value).sort()).toEqual([
    "changeSummary",
    "proposedContent",
    "rationale",
    "source",
    "title",
  ]);
  expect(value.title.trim().length).toBeGreaterThan(0);
  expect(value.rationale.trim().length).toBeGreaterThan(0);
  expect(value.changeSummary.trim().length).toBeGreaterThan(0);
  expect(value.proposedContent.trim().length).toBeGreaterThan(0);
}

test.describe.serial("patch provider boundary", () => {
  test.skip(isSupabaseE2EMode(), "The patch provider boundary suite runs only in local fallback mode.");

  test.afterEach(() => {
    resetPatchProviderEnv();
  });

  test("keeps the default mock patch path unchanged when env activation is off", async () => {
    resetPatchProviderEnv();
    delete process.env.ENABLE_EXTERNAL_PATCH_SUGGESTION;
    delete process.env.enableExternalPatchSuggestion;

    const result = await generateCodePatchSuggestion(sampleInput, buildDefaultConfig());

    expectStablePatchShape(result.suggestion);
    expect(result.suggestion.source).toBe("mock_assistant");
    expect(result.adapterExecution.requestedSelection).toBe("deterministic_internal");
    expect(result.adapterExecution.executedSelection).toBe("deterministic_internal");
    expect(result.adapterExecution.sourceType).toBe("deterministic_internal");
    expect(result.adapterExecution.executionMode).toBe("selected");
    expect(result.adapterExecution.executedAdapterKey).toBe("mock_assistant");
  });

  test("uses the external patch adapter when env activation is enabled", async () => {
    resetPatchProviderEnv();
    process.env.ENABLE_EXTERNAL_PATCH_SUGGESTION = "true";
    process.env.EXTERNAL_PATCH_PROVIDER_KEY = "openai_compatible";
    process.env.EXTERNAL_PATCH_PROVIDER_LABEL = "OpenAI-compatible stub";
    process.env.EXTERNAL_PATCH_ENDPOINT_URL = e2eProviderStubBaseUrl;
    process.env.EXTERNAL_PATCH_API_KEY_ENV_VAR = "OPENAI_API_KEY";
    process.env.EXTERNAL_PATCH_MODEL = "gpt-5.4-mini";
    process.env.OPENAI_API_KEY = "phase65-local-openai-key";

    const result = await generateCodePatchSuggestion(sampleInput, buildDefaultConfig());

    expectStablePatchShape(result.suggestion);
    expect(result.suggestion.source).toBe("external_patch_adapter_v1");
    expect(result.suggestion.title).toBe("External provider patch suggestion");
    expect(result.adapterExecution.requestedSelection).toBe("external_model");
    expect(result.adapterExecution.executedSelection).toBe("external_model");
    expect(result.adapterExecution.sourceType).toBe("external_model");
    expect(result.adapterExecution.executionMode).toBe("selected");
    expect(result.adapterExecution.executedAdapterKey).toBe("external_patch_adapter_v1");
    expect(result.adapterExecution.modelName).toBe("gpt-5.4-mini");
    expect(result.adapterExecution.endpointUrl).toBe(e2eProviderStubBaseUrl);
  });

  test("falls back safely to the mock patch suggester when the external provider fails", async () => {
    resetPatchProviderEnv();
    process.env.enableExternalPatchSuggestion = "true";
    process.env.EXTERNAL_PATCH_PROVIDER_KEY = "openai_compatible";
    process.env.EXTERNAL_PATCH_PROVIDER_LABEL = "OpenAI-compatible broken endpoint";
    process.env.EXTERNAL_PATCH_ENDPOINT_URL = "http://127.0.0.1:3299/v1";
    process.env.EXTERNAL_PATCH_API_KEY_ENV_VAR = "OPENAI_API_KEY";
    process.env.EXTERNAL_PATCH_MODEL = "gpt-5.4-mini";
    process.env.OPENAI_API_KEY = "phase65-local-openai-key";

    const result = await generateCodePatchSuggestion(sampleInput, buildDefaultConfig());

    expectStablePatchShape(result.suggestion);
    expect(result.suggestion.source).toBe("mock_assistant");
    expect(result.adapterExecution.requestedSelection).toBe("external_model");
    expect(result.adapterExecution.executedSelection).toBe("deterministic_internal");
    expect(result.adapterExecution.sourceType).toBe("deterministic_internal");
    expect(result.adapterExecution.executionMode).toBe("fallback");
    expect(result.adapterExecution.requestedAdapterKey).toBe("external_patch_adapter_v1");
    expect(result.adapterExecution.executedAdapterKey).toBe("mock_assistant");
    expect(result.adapterExecution.fallbackReason).toBeTruthy();
  });
});
