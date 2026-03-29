import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

import { getPlannerService } from "@/lib/planner/service";
import type { PlannerInput } from "@/lib/planner/types";

import { e2eLocale, e2eWorkspaceSlug, isLiveProviderE2EMode, isSupabaseE2EMode } from "./support/env";
import { recordProofCheck, resetProofSummary } from "./support/proof-summary";
import { runtimeE2EStoreFile, resetE2EStore } from "./support/store";

const workspaceProjectsPath = `/${e2eLocale}/app/workspaces/${e2eWorkspaceSlug}/projects`;

interface StoredPlannerRun {
  id: string;
  projectId: string;
  source: string;
  status: string;
  outputPlan: {
    productSummary: string;
    targetUsers: string[];
    pageMap: string[];
    featureList: string[];
    dataModels: Array<{ name: string; description: string }>;
    authRoles: string[];
    integrationsNeeded: string[];
    designDirection: string;
  } | null;
}

interface StoredPlannerArtifact {
  plannerRunId: string;
  artifactType: string;
  payload: Record<string, unknown>;
}

interface StoredModelAdapterRun {
  linkedEntityId: string | null;
  capability: string;
  requestedSelection: string;
  executedSelection: string;
  executionMode: string;
  requestedAdapterKey: string;
  executedAdapterKey: string;
  fallbackReason: string | null;
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

function plannerApiKeyEnvVar() {
  return (process.env.EXTERNAL_PLANNER_API_KEY_ENV_VAR ?? "OPENAI_API_KEY").trim();
}

async function login(page: Page, nextPath = `${workspaceProjectsPath}/new`) {
  await page.goto(`/${e2eLocale}/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByTestId("login-email").fill("arta@besa.studio");
  await page.getByTestId("login-password").fill("phase1-demo");
  await page.getByTestId("login-submit").click();
  await page.waitForURL(new RegExp(`${workspaceProjectsPath}/new`));
}

async function readPlannerProofStore() {
  return JSON.parse(await readFile(runtimeE2EStoreFile, "utf8")) as {
    plannerRuns?: StoredPlannerRun[];
    plannerArtifacts?: StoredPlannerArtifact[];
    modelAdapterRuns?: StoredModelAdapterRun[];
  };
}

function expectNonEmptyStringList(value: unknown) {
  expect(Array.isArray(value)).toBeTruthy();
  expect((value as unknown[]).length).toBeGreaterThan(0);
  expect((value as unknown[]).every((item) => typeof item === "string" && item.trim().length > 0)).toBeTruthy();
}

function expectStableObjectKeys(
  value: Record<string, unknown>,
  requiredKeys: string[],
  optionalKeys: string[] = [],
) {
  const keys = Object.keys(value).sort();
  const allowedKeys = [...requiredKeys, ...optionalKeys].sort();

  expect(keys).toEqual(expect.arrayContaining([...requiredKeys].sort()));
  expect(keys.every((key) => allowedKeys.includes(key))).toBeTruthy();
}

function samplePlannerInput(): PlannerInput {
  return {
    name: "Phase 67 Fallback Proof",
    prompt: "Plan a clinic website with booking prompts and trust sections.",
    projectType: "marketing_site",
    targetUsers: "New patients, returning patients",
    desiredPagesFeatures: ["Home", "Services", "Doctors", "Booking", "Contact"],
    designStyle: "Trust-first editorial",
    primaryLocale: "en",
    supportedLocales: ["en", "sq"],
    country: "kosovo",
    businessCategory: "Digital agency",
    capabilities: {
      auth: false,
      cms: true,
      payments: false,
      booking: true,
      ai: false,
      analytics: true,
    },
  };
}

test.describe.serial("live planner provider proof", () => {
  test.skip(
    isSupabaseE2EMode() || !isLiveProviderE2EMode(),
    "The live planner provider proof runs only in local fallback mode with the live provider enabled.",
  );

  test.beforeAll(async () => {
    await resetProofSummary();
  });

  test.beforeEach(async () => {
    await resetE2EStore();
  });

  test("creates one real hosted-provider planner run and preserves the structured planner contract", async ({
    page,
  }) => {
    test.slow();

    const apiKeyEnvVar = plannerApiKeyEnvVar();
    test.skip(
      !process.env[apiKeyEnvVar],
      `External planner verification requires ${apiKeyEnvVar} to be available in the environment.`,
    );

    const projectName = `Planner Live Proof ${Date.now()}`;
    const projectSlug = slugify(projectName);
    const projectPlanPath = `${workspaceProjectsPath}/${projectSlug}/plan`;

    await login(page);
    await page.locator('input[name="name"]').fill(projectName);
    await page.locator('textarea[name="prompt"]').fill(
      "Build a bilingual clinic site with clear service navigation, trust sections, and appointment conversion prompts.",
    );
    await page.locator('textarea[name="targetUsers"]').fill(
      "New patients, returning patients, and family decision-makers",
    );
    await page.locator('textarea[name="desiredPagesFeatures"]').fill(
      "Home, Services, Doctors, Booking, Contact, Testimonials",
    );
    await page.getByRole("button", { name: /save project/i }).click();

    try {
      await page.waitForURL(/\/projects\/[^/]+\/plan(?:\?|$)/, { timeout: 20_000 });
    } catch {
      await expect(page.getByText("NEXT_REDIRECT")).toBeVisible();
      await page.goto(projectPlanPath);
    }

    await page.waitForLoadState("networkidle");

    await expect(page.getByText("External model adapter v1").first()).toBeVisible();
    await expect(page.getByText("Normalized brief").first()).toBeVisible();
    await expect(page.getByText("Planning signals").first()).toBeVisible();
    await expect(page.getByText("Structured plan payload").first()).toBeVisible();

    await page.getByTestId("provider-run-history-filter-capability").selectOption("planning");
    await page.getByTestId("provider-run-history-filter-status").selectOption("completed");
    await page.getByTestId("provider-run-history-filter-trigger").selectOption("project_create");
    await page.getByTestId("provider-run-history-filter-linked-entity").selectOption("planner_run");

    const historyItem = page.getByTestId("provider-run-history-item").first();
    await expect(historyItem).toContainText("External model");
    await expect(historyItem).toContainText("external_model_adapter_v1");

    const store = await readPlannerProofStore();
    const latestRun = (store.plannerRuns ?? []).find((run) => run.source === "external_model_adapter_v1");

    expect(latestRun).toBeTruthy();
    expect(latestRun?.status).toBe("completed");
    expect(latestRun?.outputPlan).toBeTruthy();

    const plan = latestRun?.outputPlan;
    expect(plan?.productSummary.trim().length).toBeGreaterThan(0);
    expectNonEmptyStringList(plan?.targetUsers);
    expectNonEmptyStringList(plan?.pageMap);
    expectNonEmptyStringList(plan?.featureList);
    expect(Array.isArray(plan?.dataModels)).toBeTruthy();
    expect(plan?.dataModels.length ?? 0).toBeGreaterThan(0);
    expect(
      (plan?.dataModels ?? []).every(
        (item) => item.name.trim().length > 0 && item.description.trim().length > 0,
      ),
    ).toBeTruthy();
    expectNonEmptyStringList(plan?.authRoles);
    expectNonEmptyStringList(plan?.integrationsNeeded);
    expect(plan?.designDirection.trim().length).toBeGreaterThan(0);

    const artifacts = (store.plannerArtifacts ?? []).filter(
      (artifact) => artifact.plannerRunId === latestRun?.id,
    );
    const artifactTypes = artifacts.map((artifact) => artifact.artifactType);

    expect(artifactTypes).toEqual(
      expect.arrayContaining(["normalized_brief", "planning_signals", "plan_payload"]),
    );

    const normalizedBrief = artifacts.find((artifact) => artifact.artifactType === "normalized_brief");
    const planningSignals = artifacts.find((artifact) => artifact.artifactType === "planning_signals");
    const structuredPayload = artifacts.find((artifact) => artifact.artifactType === "plan_payload");

    expect(normalizedBrief?.payload).toBeTruthy();
    expectStableObjectKeys(normalizedBrief?.payload ?? {}, [
      "businessCategory",
      "capabilities",
      "country",
      "desiredPagesFeatures",
      "designStyle",
      "name",
      "primaryLocale",
      "projectType",
      "prompt",
      "supportedLocales",
      "targetUsers",
    ]);
    expect(typeof normalizedBrief?.payload?.name).toBe("string");
    expect(typeof normalizedBrief?.payload?.projectType).toBe("string");
    expect(Array.isArray(normalizedBrief?.payload?.targetUsers)).toBeTruthy();
    expect(Array.isArray(normalizedBrief?.payload?.desiredPagesFeatures)).toBeTruthy();
    expect(Array.isArray(normalizedBrief?.payload?.supportedLocales)).toBeTruthy();
    expect(typeof normalizedBrief?.payload?.capabilities).toBe("object");
    expect(planningSignals?.payload).toBeTruthy();
    expectStableObjectKeys(
      planningSignals?.payload ?? {},
      [
      "enabledCapabilities",
      "featureCount",
      "localeMode",
      "marketScope",
      "requestedPageCount",
      "resolvedPageCount",
      "trigger",
      ],
      ["providerModel", "providerNotes"],
    );
    expect(typeof planningSignals?.payload?.requestedPageCount).toBe("number");
    expect(typeof planningSignals?.payload?.resolvedPageCount).toBe("number");
    expect(Array.isArray(planningSignals?.payload?.enabledCapabilities)).toBeTruthy();
    expect(structuredPayload?.payload).toBeTruthy();
    expectStableObjectKeys(structuredPayload?.payload ?? {}, [
      "authRoles",
      "dataModels",
      "designDirection",
      "featureList",
      "integrationsNeeded",
      "pageMap",
      "productSummary",
      "targetUsers",
    ]);
    expect(structuredPayload?.payload).toMatchObject(plan ?? {});

    const latestAdapterRun = (store.modelAdapterRuns ?? []).find(
      (run) => run.capability === "planning" && run.linkedEntityId === latestRun?.id,
    );

    expect(latestAdapterRun).toBeTruthy();
    expect(latestAdapterRun?.requestedSelection).toBe("external_model");
    expect(latestAdapterRun?.executedSelection).toBe("external_model");
    expect(latestAdapterRun?.executionMode).toBe("selected");
    expect(latestAdapterRun?.requestedAdapterKey).toBe("external_model_adapter_v1");
    expect(latestAdapterRun?.executedAdapterKey).toBe("external_model_adapter_v1");

    await recordProofCheck(
      "shapeCheck",
      "passed",
      "Hosted planner run preserved external_model_adapter_v1 plus normalized_brief, planning_signals, and plan_payload guardrail keys.",
    );
    await recordProofCheck(
      "nonDestructiveCheck",
      "not_applicable",
      "Planner proof validates stored planner artifacts only and does not exercise file mutation or proposal application.",
    );
  });

  test("falls back safely to the rule-based planner when the hosted provider is unavailable", async () => {
    const trackedKeys = [
      "ENABLE_EXTERNAL_PLANNER",
      "enableExternalPlanner",
      "EXTERNAL_PLANNER_MODEL",
      "EXTERNAL_PLANNER_PROVIDER_KEY",
      "EXTERNAL_PLANNER_PROVIDER_LABEL",
      "EXTERNAL_PLANNER_ENDPOINT_URL",
      "EXTERNAL_PLANNER_API_KEY_ENV_VAR",
      "MISSING_PHASE67_PLANNER_TOKEN",
    ] as const;
    const originalEnv = new Map<string, string | undefined>(
      trackedKeys.map((key) => [key, process.env[key]]),
    );

    process.env.ENABLE_EXTERNAL_PLANNER = "true";
    process.env.enableExternalPlanner = "true";
    process.env.EXTERNAL_PLANNER_MODEL = process.env.EXTERNAL_PLANNER_MODEL || "gpt-5.4-mini";
    process.env.EXTERNAL_PLANNER_PROVIDER_KEY = "openai_compatible";
    process.env.EXTERNAL_PLANNER_PROVIDER_LABEL = "OpenAI-compatible live";
    delete process.env.EXTERNAL_PLANNER_ENDPOINT_URL;
    process.env.EXTERNAL_PLANNER_API_KEY_ENV_VAR = "MISSING_PHASE67_PLANNER_TOKEN";
    delete process.env.MISSING_PHASE67_PLANNER_TOKEN;

    try {
      const plannerService = getPlannerService(null);
      const execution = await plannerService.generateInitialPlan(samplePlannerInput());

      expect(execution.result.source).toBe("rules_planner_v1");
      expect(execution.adapterExecution.requestedSelection).toBe("external_model");
      expect(execution.adapterExecution.executedSelection).toBe("deterministic_internal");
      expect(execution.adapterExecution.executionMode).toBe("fallback");
      expect(execution.adapterExecution.requestedAdapterKey).toBe("external_model_adapter_v1");
      expect(execution.adapterExecution.executedAdapterKey).toBe("rules_planner_v1");
      expect(execution.adapterExecution.fallbackReason).toContain(
        "Environment variable MISSING_PHASE67_PLANNER_TOKEN is not set.",
      );

      await recordProofCheck(
        "fallbackCheck",
        "passed",
        "Hosted planner proof still falls back safely to rules_planner_v1 when the configured planner API-key env var is missing.",
      );
    } finally {
      for (const [key, value] of originalEnv.entries()) {
        if (typeof value === "undefined") {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});
