import { expect, test, type Page } from "@playwright/test";

import {
  e2eGenerationModel,
  e2eLocale,
  e2ePatchModel,
  e2ePlanningModel,
  e2eProjectBasePath,
  e2eProviderStubBaseUrl,
  isLiveProviderE2EMode,
  isSupabaseE2EMode,
} from "./support/env";

const workspacePath = `/${e2eLocale}/app/workspaces`;
const projectBasePath = e2eProjectBasePath;
const ownerEmail = process.env.BESA_E2E_SUPABASE_OWNER_EMAIL ?? "";
const ownerPassword = process.env.BESA_E2E_SUPABASE_OWNER_PASSWORD ?? "";

async function login(page: Page, nextPath = `${projectBasePath}/plan#model-adapters`) {
  await page.goto(`/${e2eLocale}/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByTestId("login-email").fill(ownerEmail);
  await page.getByTestId("login-password").fill(ownerPassword);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(new RegExp(`${projectBasePath}/plan`));
  await page.goto(nextPath);
  await page.waitForLoadState("networkidle");
}

async function saveExternalProviderConfig(page: Page, apiKeyEnvVar: string) {
  await page.goto(`${projectBasePath}/plan#model-adapters`);
  await page.getByTestId("model-adapter-selection-planning").selectOption("external_model");
  await page.getByTestId("model-adapter-selection-generation").selectOption("external_model");
  await page.getByTestId("model-adapter-selection-patch_suggestion").selectOption("external_model");
  await page.getByTestId("model-adapter-provider-key").selectOption("openai_compatible");
  await page.getByTestId("model-adapter-endpoint").fill(e2eProviderStubBaseUrl);
  await page.getByTestId("model-adapter-api-key-env-var").fill(apiKeyEnvVar);
  await page.getByTestId("model-adapter-model-planning").fill(e2ePlanningModel);
  await page.getByTestId("model-adapter-model-generation").fill(e2eGenerationModel);
  await page.getByTestId("model-adapter-model-patch_suggestion").fill(e2ePatchModel);
  await page.getByTestId("model-adapter-save").click();
  await page.waitForLoadState("networkidle");
}

async function verifyCapability(page: Page, capability: "planning" | "generation" | "patch_suggestion") {
  await page.goto(`${projectBasePath}/plan#model-adapters`);
  await page.getByTestId(`verify-provider-${capability}`).click();
  await page.waitForLoadState("networkidle");
}

async function expectFailure(page: Page, envVarName: string) {
  await expect(page.getByText(`Environment variable ${envVarName} is not set.`).first()).toBeVisible();
}

test.describe.serial("supabase provider parity", () => {
  test.skip(
    !isSupabaseE2EMode() || isLiveProviderE2EMode(),
    "This suite only runs in Supabase mode with the local provider stub path.",
  );

  test("verifies planning, generation, and patch provider failure/retry flows", async ({ page }) => {
    await login(page);

    await saveExternalProviderConfig(page, "MISSING_SUPABASE_PROVIDER_TOKEN");
    await verifyCapability(page, "planning");
    await expectFailure(page, "MISSING_SUPABASE_PROVIDER_TOKEN");

    await saveExternalProviderConfig(page, "OPENAI_API_KEY");
    await verifyCapability(page, "planning");

    await saveExternalProviderConfig(page, "MISSING_SUPABASE_PROVIDER_TOKEN");
    await verifyCapability(page, "generation");
    await expectFailure(page, "MISSING_SUPABASE_PROVIDER_TOKEN");

    await saveExternalProviderConfig(page, "OPENAI_API_KEY");
    await verifyCapability(page, "generation");

    await saveExternalProviderConfig(page, "MISSING_SUPABASE_PROVIDER_TOKEN");
    await verifyCapability(page, "patch_suggestion");
    await expectFailure(page, "MISSING_SUPABASE_PROVIDER_TOKEN");

    await saveExternalProviderConfig(page, "OPENAI_API_KEY");
    await verifyCapability(page, "patch_suggestion");

    await page.goto(`${projectBasePath}/plan#model-adapters`);
    await page.getByTestId("provider-run-history-filter-capability").selectOption("planning");
    await page.getByTestId("provider-run-history-filter-status").selectOption("all");
    await page.getByTestId("provider-run-history-filter-trigger").selectOption("provider_verification");
    await page.getByTestId("provider-run-history-filter-linked-entity").selectOption("unlinked");
    await expect(page.getByTestId("provider-run-history-item").first()).toContainText("Attempt 2");
    await expect(page.getByTestId("provider-run-history-item").first()).toContainText("external_model_adapter_v1");

    await page.getByTestId("provider-run-history-filter-capability").selectOption("generation");
    await expect(page.getByTestId("provider-run-history-item").first()).toContainText("Attempt 2");
    await expect(page.getByTestId("provider-run-history-item").first()).toContainText("external_codegen_adapter_v1");

    await page.goto(`${projectBasePath}/code`);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("code-provider-run-history-filter-status").selectOption("all");
    await page.getByTestId("code-provider-run-history-filter-trigger").selectOption("provider_verification");
    await page.getByTestId("code-provider-run-history-filter-linked-entity").selectOption("unlinked");
    await expect(page.getByTestId("code-provider-run-history-item").first()).toContainText("Attempt 2");
    await expect(page.getByTestId("code-provider-run-history-item").first()).toContainText("external_patch_adapter_v1");
  });
});
