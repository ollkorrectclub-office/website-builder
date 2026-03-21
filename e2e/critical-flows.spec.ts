import { expect, test, type Page } from "@playwright/test";

import {
  e2eLocale,
  e2eProjectBasePath,
  isSupabaseE2EMode,
} from "./support/env";
import { resetE2EStore } from "./support/store";

const workspacePath = `/${e2eLocale}/app/workspaces`;
const projectBasePath = e2eProjectBasePath;

async function openCodeQueueHome(page: Page) {
  await page.goto(`${projectBasePath}/code`);
  await page.waitForLoadState("networkidle");
}

async function waitForCodeRestoreReviewPage(page: Page) {
  await page.waitForURL(/restoreScaffold=1/);
  await page.waitForLoadState("networkidle");
}

async function login(page: Page, nextPath = workspacePath) {
  await page.goto(`/${e2eLocale}/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByTestId("login-email").fill("arta@besa.studio");
  await page.getByTestId("login-password").fill("phase1-demo");
  await page.getByTestId("login-submit").click();
  await page.waitForURL(`**${nextPath}`);
}

async function consumeCodeQueue(page: Page) {
  await openCodeQueueHome(page);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (await page.getByTestId("code-queue-complete").count()) {
      await page.getByTestId("code-queue-complete").click();
      await page.waitForLoadState("networkidle");
      return;
    }

    if (await page.getByTestId("code-restore-submit").count()) {
      await page.getByTestId("code-restore-confirm").check();
      await page.getByTestId("code-restore-submit").click({ force: true });
      await page.waitForLoadState("networkidle");
      await openCodeQueueHome(page);
      continue;
    }

    if (await page.getByTestId("code-safe-refresh").count()) {
      await page.getByTestId("code-safe-refresh").click();
      await page.waitForLoadState("networkidle");
      await openCodeQueueHome(page);
      continue;
    }

    if (await page.getByTestId("code-review-restore").count()) {
      const restoreHref = await page.getByTestId("code-review-restore").getAttribute("href");

      if (!restoreHref) {
        throw new Error("Code restore review link did not expose an href.");
      }

      await page.goto(restoreHref);
      await waitForCodeRestoreReviewPage(page);
      continue;
    }

    if (await page.getByTestId("code-queue-start-review").count()) {
      const reviewHref = await page.getByTestId("code-queue-start-review").getAttribute("href");

      if (!reviewHref) {
        throw new Error("Code queue review link did not expose an href.");
      }

      await page.goto(reviewHref);
      await waitForCodeRestoreReviewPage(page);
      continue;
    }

    await openCodeQueueHome(page);
  }

  throw new Error("Code queue review did not complete within the expected number of iterations.");
}

test.describe.serial("critical platform flows", () => {
  test.skip(isSupabaseE2EMode(), "The local critical-flow suite runs only in local fallback mode.");

  test.beforeEach(async () => {
    await resetE2EStore();
  });

  test("redirects unauthenticated users and completes owner login", async ({ page }) => {
    await page.goto(workspacePath);
    await expect(page).toHaveURL(new RegExp(`/${e2eLocale}/login\\?next=`));
    await expect(page.getByTestId("login-submit")).toBeVisible();

    await page.getByTestId("login-email").fill("arta@besa.studio");
    await page.getByTestId("login-password").fill("phase1-demo");
    await page.getByTestId("login-submit").click();

    await expect(page).toHaveURL(new RegExp(`/${e2eLocale}/app/workspaces$`));
    await expect(page.getByText("Besa Studio").first()).toBeVisible();
  });

  test("runs planner review, consumes queues, verifies preview runtime routes, and completes deploy release simulation", async ({
    page,
  }) => {
    await login(page);

    await page.goto(`${projectBasePath}/plan`);
    await expect(page.locator("#candidate-promotion").getByText("Rev 5")).toBeVisible();
    await page.getByTestId("planner-rerun-submit").click();
    await page.waitForLoadState("networkidle");
    await page.goto(`${projectBasePath}/plan#candidate-promotion`);
    await expect(page.locator("#candidate-promotion").getByText("Rev 6")).toBeVisible();

    await page.getByTestId("candidate-promote-submit").click();
    await page.waitForLoadState("networkidle");
    await page.goto(`${projectBasePath}/plan`);
    await expect(page.getByTestId("generation-queue-both")).toBeVisible();
    await page.getByTestId("generation-queue-both").click();
    await page.waitForLoadState("networkidle");

    await page.goto(`${projectBasePath}/visual`);
    await expect(page.getByTestId("visual-queue-accept")).toBeVisible();
    await page.getByTestId("visual-queue-accept").click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("visual-queue-accept")).toHaveCount(0);

    await consumeCodeQueue(page);
    await expect(page.getByTestId("code-queue-complete")).toHaveCount(0);

    await page.goto(`${projectBasePath}/preview`);
    await expect(page.getByTestId("preview-route-navigation")).toBeVisible();
    await expect(page.getByTestId("preview-runtime-source")).toContainText(
      "From accepted generation target",
    );
    await page
      .getByTestId("preview-route-navigation")
      .getByRole("link")
      .filter({ hasText: /services/i })
      .first()
      .click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/route=%2Fen%2Fservices/);

    await page.goto(`${projectBasePath}/deploy`);
    await expect(page.getByTestId("deploy-create-snapshot")).toBeEnabled();
    await page.getByTestId("deploy-create-snapshot").click();
    await page.waitForLoadState("networkidle");
    await page.goto(`${projectBasePath}/deploy`);
    await expect(page.getByTestId("deploy-release-name")).toBeVisible();

    await page.getByTestId("deploy-release-name").fill("Phase 32 Release");
    await expect(page.getByRole("button", { name: /promote release/i })).toBeVisible();
    await page.getByRole("button", { name: /promote release/i }).click({ force: true });
    await page.waitForLoadState("networkidle");
    await page.goto(`${projectBasePath}/deploy`);
    await expect(page.getByText("Phase 32 Release").first()).toBeVisible();

    await page.getByLabel(/primary domain/i).fill("release.demo.besastudio.test");
    await page.getByRole("button", { name: /save deploy target settings/i }).click();
    await page.waitForLoadState("networkidle");
    await page.goto(`${projectBasePath}/deploy`);

    await expect(page.getByTestId("deploy-prepare-handoff")).toBeVisible();
    await page.getByTestId("deploy-prepare-handoff").click();
    await page.waitForLoadState("networkidle");
    await page.goto(`${projectBasePath}/deploy`);

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("deploy-export-release").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain("handoff.json");

    await page.goto(`${projectBasePath}/deploy`);
    await expect(page.getByTestId("deploy-run-simulation")).toBeEnabled();
    await page.getByTestId("deploy-run-simulation").click();
    await page.waitForLoadState("networkidle");
    await page.goto(`${projectBasePath}/deploy`);
    await expect(page.getByTestId("deploy-handoff-history-item").first()).toBeVisible();
    await expect(page.getByTestId("deploy-handoff-logs")).toBeVisible();
    await expect(page.getByTestId("deploy-handoff-log-item").first()).toBeVisible();
  });
});
