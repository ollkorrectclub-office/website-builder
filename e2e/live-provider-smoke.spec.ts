import { expect, test, type Page } from "@playwright/test";

import {
  e2eLocale,
  e2eProjectBasePath,
  isLiveProviderE2EMode,
  isSupabaseE2EMode,
} from "./support/env";
import { recordProofCheck, resetProofSummary } from "./support/proof-summary";
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

test.describe.serial("live provider smoke verification", () => {
  test.skip(
    isSupabaseE2EMode() || !isLiveProviderE2EMode(),
    "The live provider smoke suite runs only when BESA_E2E_PROVIDER_MODE=live is enabled.",
  );

  test.beforeAll(async () => {
    await resetProofSummary();
  });

  test.beforeEach(async () => {
    await resetProviderVerificationStore();
  });

  test("verifies planning, generation, and patch capabilities against the configured live provider", async ({
    page,
  }) => {
    await login(page);

    await page.getByTestId("verify-provider-planning").click();
    await page.waitForLoadState("networkidle");
    await page.goto(`${projectBasePath}/plan#model-adapters`);
    await page.getByTestId("verify-provider-generation").click();
    await page.waitForLoadState("networkidle");
    await page.goto(`${projectBasePath}/plan#model-adapters`);
    await page.getByTestId("verify-provider-patch_suggestion").click();
    await page.waitForLoadState("networkidle");

    await page.goto(`${projectBasePath}/plan#model-adapters`);
    await page.getByTestId("provider-run-history-filter-status").selectOption("all");
    await expect(page.getByTestId("provider-run-history-item")).toHaveCount(3);
    await expect(page.getByText("Live verified").first()).toBeVisible();

    await page.goto(`${projectBasePath}/code`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("code-provider-run-history-item").first()).toBeVisible();

    await recordProofCheck(
      "shapeCheck",
      "passed",
      "Live provider smoke recorded completed planning, generation, and patch verification runs in history.",
    );
    await recordProofCheck(
      "fallbackCheck",
      "not_applicable",
      "The live provider smoke workflow verifies the hosted success path only.",
    );
    await recordProofCheck(
      "nonDestructiveCheck",
      "not_applicable",
      "Provider verification checks capability health and does not mutate project content.",
    );
  });
});
