import { expect, test, type Page } from "@playwright/test";

import {
  e2eLocale,
  e2eProjectBasePath,
  isLiveProviderE2EMode,
  isSupabaseE2EMode,
} from "./support/env";
import { resetProviderVerificationStore } from "./support/store";

const projectBasePath = e2eProjectBasePath;

async function login(page: Page, nextPath = `${projectBasePath}/plan#model-adapters`) {
  await page.goto(`/${e2eLocale}/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByTestId("login-email").fill("arta@besa.studio");
  await page.getByTestId("login-password").fill("phase1-demo");
  await page.getByTestId("login-submit").click();
  await page.waitForURL(new RegExp(`${projectBasePath}/plan`));
  await page.goto(`${projectBasePath}/plan#model-adapters`);
  await page.waitForLoadState("networkidle");
}

async function saveApiKeyEnvVar(page: Page, value: string) {
  await page.goto(`${projectBasePath}/plan#model-adapters`);
  await page.getByTestId("model-adapter-api-key-env-var").fill(value);
  await page.getByTestId("model-adapter-save").click();
  await page.waitForLoadState("networkidle");
}

async function verifyCapability(page: Page, capability: "planning" | "generation" | "patch_suggestion") {
  await page.goto(`${projectBasePath}/plan#model-adapters`);
  await page.getByTestId(`verify-provider-${capability}`).click();
  await page.waitForLoadState("networkidle");
}

async function expectPlanHistoryRows(page: Page, capability: "planning" | "generation", status: "all" | "failed") {
  await page.goto(`${projectBasePath}/plan#model-adapters`);
  await page.getByTestId("provider-run-history-filter-capability").selectOption(capability);
  await page.getByTestId("provider-run-history-filter-status").selectOption(status);
  await page.getByTestId("provider-run-history-filter-trigger").selectOption("provider_verification");
  await page.getByTestId("provider-run-history-filter-linked-entity").selectOption("unlinked");
  await expect(page.getByTestId("provider-run-history-card")).toBeVisible();
}

test.describe.serial("live provider verification flows", () => {
  test.skip(
    isSupabaseE2EMode() || isLiveProviderE2EMode(),
    "The committed provider verification suite runs only in local stub mode.",
  );

  test.beforeEach(async () => {
    await resetProviderVerificationStore();
  });

  test("verifies planning live, records failure, and retries successfully", async ({ page }) => {
    await login(page);

    await saveApiKeyEnvVar(page, "MISSING_PHASE42_TOKEN");
    await verifyCapability(page, "planning");
    await expect(
      page.getByText("Environment variable MISSING_PHASE42_TOKEN is not set.").first(),
    ).toBeVisible();

    await expectPlanHistoryRows(page, "planning", "all");
    await expect(page.getByTestId("provider-run-history-item")).toHaveCount(1);
    await expect(page.getByTestId("provider-run-history-item").first()).toContainText("Failed");
    await expect(page.getByTestId("provider-run-history-item").first()).toContainText("openai_compatible");

    await saveApiKeyEnvVar(page, "OPENAI_API_KEY");
    await verifyCapability(page, "planning");

    await expectPlanHistoryRows(page, "planning", "all");
    await expect(page.getByTestId("provider-run-history-item")).toHaveCount(2);
    await expect(page.getByTestId("provider-run-history-item").first()).toContainText("Selected path");
    await expect(page.getByTestId("provider-run-history-item").first()).toContainText("external_model_adapter_v1");
    await expect(page.getByTestId("provider-run-history-item").first()).toContainText("Attempt 2");

    await page.getByTestId("provider-run-history-filter-status").selectOption("failed");
    await expect(page.getByTestId("provider-run-history-item")).toHaveCount(1);
    await expect(page.getByTestId("provider-run-history-item").first()).toContainText("MISSING_PHASE42_TOKEN");
  });

  test("verifies generation live, records failure, and retries successfully", async ({ page }) => {
    await login(page);

    await saveApiKeyEnvVar(page, "MISSING_PHASE42_TOKEN");
    await verifyCapability(page, "generation");
    await expect(
      page.getByText("Environment variable MISSING_PHASE42_TOKEN is not set.").first(),
    ).toBeVisible();

    await expectPlanHistoryRows(page, "generation", "all");
    await expect(page.getByTestId("provider-run-history-item")).toHaveCount(1);
    await expect(page.getByTestId("provider-run-history-item").first()).toContainText("Failed");

    await saveApiKeyEnvVar(page, "OPENAI_API_KEY");
    await verifyCapability(page, "generation");

    await expectPlanHistoryRows(page, "generation", "all");
    await expect(page.getByTestId("provider-run-history-item")).toHaveCount(2);
    await expect(page.getByTestId("provider-run-history-item").first()).toContainText("external_codegen_adapter_v1");
    await expect(page.getByTestId("provider-run-history-item").first()).toContainText("Attempt 2");
    await expect(page.getByText("Live verified").first()).toBeVisible();
  });

  test("verifies patch live, records failure, retries successfully, and surfaces history in Code", async ({
    page,
  }) => {
    await login(page);

    await saveApiKeyEnvVar(page, "MISSING_PHASE42_TOKEN");
    await verifyCapability(page, "patch_suggestion");
    await expect(
      page.getByText("Environment variable MISSING_PHASE42_TOKEN is not set.").first(),
    ).toBeVisible();

    await saveApiKeyEnvVar(page, "OPENAI_API_KEY");
    await verifyCapability(page, "patch_suggestion");

    await page.goto(`${projectBasePath}/code`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("code-provider-run-history-card")).toBeVisible();
    await page.getByTestId("code-provider-run-history-filter-trigger").selectOption("provider_verification");
    await page.getByTestId("code-provider-run-history-filter-linked-entity").selectOption("unlinked");
    await page.getByTestId("code-provider-run-history-filter-status").selectOption("all");
    await expect(page.getByTestId("code-provider-run-history-item").first()).toContainText("Patch suggestions");
    await expect(page.getByTestId("code-provider-run-history-item").first()).toContainText("external_patch_adapter_v1");
    await expect(page.getByTestId("code-provider-run-history-item").first()).toContainText("Attempt 2");

    await page.getByTestId("code-provider-run-history-filter-status").selectOption("failed");
    await expect(page.getByTestId("code-provider-run-history-item").first()).toContainText("MISSING_PHASE42_TOKEN");
  });
});
