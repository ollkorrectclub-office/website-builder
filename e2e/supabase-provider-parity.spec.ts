import { expect, test, type Page } from "@playwright/test";

import {
  e2eGenerationModel,
  e2eLocale,
  e2ePatchModel,
  e2ePlanningModel,
  e2eProjectBasePath,
  e2eProjectSlug,
  e2eProviderStubBaseUrl,
  e2eWorkspaceSlug,
  isLiveProviderE2EMode,
  isSupabaseE2EMode,
} from "./support/env";
import { recordProofCheck, resetProofSummary } from "./support/proof-summary";
import {
  normalizeSupabaseProviderVerificationBaseline,
  saveSupabaseProviderVerificationConfig,
} from "./support/supabase";

const workspacePath = `/${e2eLocale}/app/workspaces`;
const projectBasePath = e2eProjectBasePath;
const ownerEmail = process.env.BESA_E2E_SUPABASE_OWNER_EMAIL ?? "";
const ownerPassword = process.env.BESA_E2E_SUPABASE_OWNER_PASSWORD ?? "";

function modelAdaptersPath() {
  return `${projectBasePath}/plan?proofTs=${Date.now()}#model-adapters`;
}

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
  await saveSupabaseProviderVerificationConfig({
    workspaceSlug: e2eWorkspaceSlug,
    projectSlug: e2eProjectSlug,
    externalEndpointUrl: e2eProviderStubBaseUrl,
    externalApiKeyEnvVar: apiKeyEnvVar,
    planningModel: e2ePlanningModel,
    generationModel: e2eGenerationModel,
    patchModel: e2ePatchModel,
  });
  await page.goto(modelAdaptersPath());
  await expect(page.getByTestId("model-adapter-api-key-env-var")).toHaveValue(apiKeyEnvVar);
}

async function verifyCapability(page: Page, capability: "planning" | "generation" | "patch_suggestion") {
  await page.goto(modelAdaptersPath());
  await page.getByTestId(`verify-provider-${capability}`).click();
  await page.waitForLoadState("networkidle");
}

async function expectFailure(
  page: Page,
  capability: "planning" | "generation" | "patch_suggestion",
  envVarName: string,
) {
  await expect(
    page.locator(`#model-adapter-${capability}`).getByText(`Environment variable ${envVarName} is not set.`).first(),
  ).toBeVisible();
}

async function expectPlanHistoryForCapability(
  page: Page,
  capability: "planning" | "generation",
  adapterKey: string,
) {
  await page.goto(modelAdaptersPath());
  await page.getByTestId("provider-run-history-filter-capability").selectOption(capability);
  await page.getByTestId("provider-run-history-filter-status").selectOption("all");
  await page.getByTestId("provider-run-history-filter-trigger").selectOption("provider_verification");
  await page.getByTestId("provider-run-history-filter-linked-entity").selectOption("unlinked");
  await expect(page.getByTestId("provider-run-history-item")).toHaveCount(2);
  await expect(page.getByTestId("provider-run-history-item").first()).toContainText("Attempt 2");
  await expect(page.getByTestId("provider-run-history-item").first()).toContainText(adapterKey);
}

async function expectCodeHistoryForPatchCapability(page: Page) {
  await page.goto(`${projectBasePath}/code`);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("code-provider-run-history-filter-status").selectOption("all");
  await page.getByTestId("code-provider-run-history-filter-trigger").selectOption("provider_verification");
  await page.getByTestId("code-provider-run-history-filter-linked-entity").selectOption("unlinked");
  await expect(page.getByTestId("code-provider-run-history-item")).toHaveCount(2);
  await expect(page.getByTestId("code-provider-run-history-item").first()).toContainText("Attempt 2");
  await expect(page.getByTestId("code-provider-run-history-item").first()).toContainText("external_patch_adapter_v1");
}

test.describe.serial("supabase provider parity", () => {
  test.skip(
    !isSupabaseE2EMode() || isLiveProviderE2EMode(),
    "This suite only runs in Supabase mode with the local provider stub path.",
  );

  test.beforeAll(async () => {
    await resetProofSummary();
    await normalizeSupabaseProviderVerificationBaseline({
      workspaceSlug: e2eWorkspaceSlug,
      projectSlug: e2eProjectSlug,
    });
  });

  test("verifies planning, generation, and patch provider failure/retry flows", async ({ page }) => {
    await login(page, modelAdaptersPath());

    await saveExternalProviderConfig(page, "MISSING_SUPABASE_PROVIDER_TOKEN");
    await verifyCapability(page, "planning");
    await expectFailure(page, "planning", "MISSING_SUPABASE_PROVIDER_TOKEN");

    await saveExternalProviderConfig(page, "OPENAI_API_KEY");
    await verifyCapability(page, "planning");

    await saveExternalProviderConfig(page, "MISSING_SUPABASE_PROVIDER_TOKEN");
    await verifyCapability(page, "generation");
    await expectFailure(page, "generation", "MISSING_SUPABASE_PROVIDER_TOKEN");

    await saveExternalProviderConfig(page, "OPENAI_API_KEY");
    await verifyCapability(page, "generation");

    await saveExternalProviderConfig(page, "MISSING_SUPABASE_PROVIDER_TOKEN");
    await verifyCapability(page, "patch_suggestion");
    await expectFailure(page, "patch_suggestion", "MISSING_SUPABASE_PROVIDER_TOKEN");

    await saveExternalProviderConfig(page, "OPENAI_API_KEY");
    await verifyCapability(page, "patch_suggestion");

    await expectPlanHistoryForCapability(page, "planning", "external_model_adapter_v1");
    await expectPlanHistoryForCapability(page, "generation", "external_codegen_adapter_v1");
    await expectCodeHistoryForPatchCapability(page);

    await recordProofCheck(
      "shapeCheck",
      "passed",
      "Supabase provider parity preserved the expected planner, generation, and patch verification history shape.",
    );
    await recordProofCheck(
      "fallbackCheck",
      "passed",
      "Supabase provider parity proved missing-env failure handling and successful retry paths across all three capabilities.",
    );
    await recordProofCheck(
      "nonDestructiveCheck",
      "not_applicable",
      "Provider verification parity checks adapter execution and history without mutating project content.",
    );
  });
});
