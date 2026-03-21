import { expect, test, type Page } from "@playwright/test";

import {
  e2eLocale,
  e2eProjectBasePath,
  isSupabaseE2EMode,
} from "./support/env";
import { resetAdapterCompareStore } from "./support/store";

const workspacePath = `/${e2eLocale}/app/workspaces`;
const projectBasePath = e2eProjectBasePath;
const homeFilePath = "app/[locale]/page.tsx";

async function login(page: Page, nextPath = workspacePath) {
  await page.goto(`/${e2eLocale}/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByTestId("login-email").fill("arta@besa.studio");
  await page.getByTestId("login-password").fill("phase1-demo");
  await page.getByTestId("login-submit").click();
  await page.waitForURL(`**${nextPath}`);
}

async function followReviewLink(page: Page, testId: string) {
  const href = await page.getByTestId(testId).getAttribute("href");

  if (!href) {
    throw new Error(`Missing href for ${testId}.`);
  }

  await page.goto(href);
  await page.waitForLoadState("networkidle");
  return href;
}

test.describe.serial("adapter comparison flows", () => {
  test.skip(isSupabaseE2EMode(), "The adapter comparison suite runs only in local fallback mode.");

  test.beforeEach(async () => {
    await resetAdapterCompareStore();
  });

  test("supports explicit planner comparison pairing and review handoff", async ({ page }) => {
    await login(page, `${projectBasePath}/plan`);

    await expect(page.getByTestId("planner-run-compare").first()).toBeVisible();
    await page.getByTestId("planner-run-compare").first().click();
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/plannerCompare=/);
    const compareCard = page.getByTestId("planner-compare-card");
    await expect(compareCard).toBeVisible();
    await expect(compareCard).toContainText("Left side");
    await expect(compareCard).toContainText("Right side");
    await expect(compareCard).toContainText("External model");
    await expect(compareCard).toContainText("Deterministic internal");
    await expect(compareCard).toContainText("Plan changes");
    await expect(compareCard).toContainText("Brief changes");
    await expect(compareCard).toContainText("Signal changes");

    const reviewRightHref = await followReviewLink(page, "planner-compare-review-right");

    await expect(page).toHaveURL(/plannerRun=/);
    expect(reviewRightHref).not.toContain("plannerCompare=");
    expect(page.url()).not.toContain("plannerCompare=");
    await expect(page.getByTestId("planner-run-compare").first()).toBeVisible();
  });

  test("supports explicit generation comparison pairing and review handoff", async ({ page }) => {
    await login(page, `${projectBasePath}/plan`);

    await expect(page.getByTestId("generation-run-compare").first()).toBeVisible();
    await page.getByTestId("generation-run-compare").first().click();
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/generationCompare=/);
    const compareCard = page.getByTestId("generation-compare-card");
    await expect(compareCard).toBeVisible();
    await expect(compareCard).toContainText("Left side");
    await expect(compareCard).toContainText("Right side");
    await expect(compareCard).toContainText("External model");
    await expect(compareCard).toContainText("Deterministic internal");
    await expect(compareCard).toContainText("Route changes");
    await expect(compareCard).toContainText("Code target changes");

    const reviewRightHref = await followReviewLink(page, "generation-compare-review-right");

    await expect(page).toHaveURL(/generationRun=/);
    expect(reviewRightHref).not.toContain("generationCompare=");
    expect(page.url()).not.toContain("generationCompare=");
    await expect(page.getByTestId("generation-run-compare").first()).toBeVisible();
  });

  test("supports explicit patch comparison pairing and review handoff", async ({ page }) => {
    await login(
      page,
      `${projectBasePath}/code?file=${encodeURIComponent(homeFilePath)}&proposal=phase38-patch-external`,
    );

    await expect(page.getByTestId("patch-proposal-review-card")).toBeVisible();
    await expect(page.getByTestId("patch-proposal-compare")).toBeVisible();
    await page.getByTestId("patch-proposal-compare").click();
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/proposalCompare=/);
    const compareCard = page.getByTestId("patch-compare-card");
    await expect(compareCard).toBeVisible();
    await expect(compareCard).toContainText("External model");
    await expect(compareCard).toContainText("Deterministic internal");
    await expect(compareCard).toContainText("phase38 external patch marker");
    await expect(compareCard).toContainText("phase38 deterministic patch marker");

    const reviewRightHref = await followReviewLink(page, "patch-compare-review-right");

    await expect(page).toHaveURL(/proposal=phase38-patch-deterministic/);
    expect(reviewRightHref).not.toContain("proposalCompare=");
    expect(page.url()).not.toContain("proposalCompare=");
    await expect(page.getByTestId("patch-proposal-review-card")).toBeVisible();
    await expect(page.getByTestId("code-apply-proposal")).toBeVisible();
  });
});
