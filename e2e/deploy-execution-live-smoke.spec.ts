import { expect, test, type Page } from "@playwright/test";

import {
  e2eLocale,
  e2eProjectBasePath,
  isLiveDeployE2EMode,
  isSupabaseE2EMode,
} from "./support/env";
import { resetDeployExecutionSmokeStore } from "./support/store";

const projectBasePath = e2eProjectBasePath;

async function login(page: Page, nextPath = `${projectBasePath}/deploy`) {
  await page.goto(`/${e2eLocale}/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByTestId("login-email").fill("arta@besa.studio");
  await page.getByTestId("login-password").fill("phase1-demo");
  await page.getByTestId("login-submit").click();
  await page.waitForURL(new RegExp(`${projectBasePath}/deploy`));
  await page.goto(`${projectBasePath}/deploy`);
  await page.waitForLoadState("networkidle");
}

test.describe.serial("live deploy execution smoke verification", () => {
  test.skip(
    isSupabaseE2EMode() || !isLiveDeployE2EMode(),
    "The live deploy execution smoke suite runs only when BESA_E2E_DEPLOY_MODE=live is enabled.",
  );

  test.beforeEach(async () => {
    await resetDeployExecutionSmokeStore();
  });

  test("executes one real hosting run from the selected exported release", async ({ page }) => {
    await login(page);

    await expect(page.getByTestId("deploy-run-execution")).toBeEnabled();
    await page.getByTestId("deploy-run-execution").click();
    await page.waitForLoadState("networkidle");

    const historyItems = page.getByTestId("deploy-execution-history-item");
    await expect(historyItems.first()).toBeVisible();

    if (!/executionRun=/.test(page.url())) {
      const href = await historyItems.first().getAttribute("href");

      if (!href) {
        throw new Error("The latest deploy execution history item did not expose a linked review href.");
      }

      await page.goto(href);
      await page.waitForLoadState("networkidle");
    }

    await expect(page).toHaveURL(/executionRun=/);
    await expect(page.getByText(/Vercel/i).first()).toBeVisible();
    await expect(page.getByText(/BUILDING|READY/i).first()).toBeVisible();

    const isRecheckEnabled = await page.getByTestId("deploy-recheck-execution").isEnabled();

    if (isRecheckEnabled) {
      await page.getByTestId("deploy-recheck-execution").click();
      await page.waitForLoadState("networkidle");
    }

    await expect(page.getByTestId("deploy-recheck-execution")).toBeVisible();
  });
});
