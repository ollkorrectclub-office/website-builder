import { expect, test, type Page } from "@playwright/test";

import {
  e2eLocale,
  e2eProjectBasePath,
  isSupabaseE2EMode,
} from "./support/env";
import { resetAdapterCompareStore } from "./support/store";

const workspacePath = `/${e2eLocale}/app/workspaces`;
const projectBasePath = e2eProjectBasePath;

async function login(page: Page, nextPath = `${projectBasePath}/plan#model-adapters`) {
  await page.goto(`/${e2eLocale}/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByTestId("login-email").fill("arta@besa.studio");
  await page.getByTestId("login-password").fill("phase1-demo");
  await page.getByTestId("login-submit").click();
  await page.waitForURL(new RegExp(`${projectBasePath}/(plan|code)`));
  await page.goto(nextPath);
  await page.waitForLoadState("networkidle");
}

test.describe.serial("provider operations surface", () => {
  test.skip(isSupabaseE2EMode(), "The provider operations suite runs only in local fallback mode.");

  test.beforeEach(async () => {
    await resetAdapterCompareStore();
  });

  test("links planner and generation history rows into exact plan review context", async ({ page }) => {
    await login(page);

    await page.getByTestId("provider-run-history-filter-capability").selectOption("planning");
    await page.getByTestId("provider-run-history-filter-status").selectOption("completed");
    await page.getByTestId("provider-run-history-filter-trigger").selectOption("project_rerun");
    await page.getByTestId("provider-run-history-filter-linked-entity").selectOption("planner_run");
    await expect(page.getByTestId("provider-run-history-item").first()).toBeVisible();

    await page.getByTestId("provider-run-history-open-review").first().click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/plannerRun=/);
    await expect(page.getByTestId("planner-run-compare").first()).toBeVisible();

    await page.goto(`${projectBasePath}/plan#model-adapters`);
    await page.getByTestId("provider-run-history-filter-capability").selectOption("generation");
    await page.getByTestId("provider-run-history-filter-status").selectOption("completed");
    await page.getByTestId("provider-run-history-filter-trigger").selectOption("generation_rerun");
    await page.getByTestId("provider-run-history-filter-linked-entity").selectOption("generation_run");
    await expect(page.getByTestId("provider-run-history-item").first()).toBeVisible();

    await page.getByTestId("provider-run-history-open-review").first().click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/generationRun=/);
    await expect(page.getByTestId("generation-run-compare").first()).toBeVisible();
  });

  test("links patch history rows into exact code proposal review context", async ({ page }) => {
    await login(page, `${projectBasePath}/code`);

    await page.getByTestId("code-provider-run-history-filter-capability").selectOption("patch_suggestion");
    await page.getByTestId("code-provider-run-history-filter-status").selectOption("completed");
    await page.getByTestId("code-provider-run-history-filter-trigger").selectOption("proposal_request");
    await page.getByTestId("code-provider-run-history-filter-linked-entity").selectOption("patch_proposal");
    await expect(page.getByTestId("code-provider-run-history-item").first()).toBeVisible();

    await page.getByTestId("code-provider-run-history-open-review").first().click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/proposal=/);
    await expect(page).toHaveURL(/file=/);
    await expect(page.getByTestId("patch-proposal-review-card")).toBeVisible();
  });
});
