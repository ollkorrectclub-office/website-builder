import { expect, test, type Page } from "@playwright/test";

import { e2eLocale, e2eProjectBasePath, isSupabaseE2EMode } from "./support/env";
import { resetDeployExecutionStore } from "./support/store";

const workspacePath = `/${e2eLocale}/app/workspaces`;
const projectBasePath = e2eProjectBasePath;

async function login(page: Page, nextPath = workspacePath) {
  await page.goto(`/${e2eLocale}/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByTestId("login-email").fill("arta@besa.studio");
  await page.getByTestId("login-password").fill("phase1-demo");
  await page.getByTestId("login-submit").click();
  await page.waitForURL(`**${nextPath}`);
  await page.waitForLoadState("networkidle");
}

async function openDeploy(page: Page) {
  await page.goto(`${projectBasePath}/deploy`);
  await page.waitForLoadState("networkidle");
}

async function openDeployTimeline(page: Page) {
  await page.goto(`${projectBasePath}/timeline?source=deploy`);
  await page.waitForLoadState("networkidle");
}

async function openFilteredExecutionRun(
  page: Page,
  status: "submitted" | "ready",
) {
  await openDeploy(page);
  await page.getByTestId("deploy-execution-history-filter-status").selectOption(status);
  await page.waitForTimeout(200);

  const row = page.getByTestId("deploy-execution-history-item").first();
  await expect(row).toBeVisible();
  const href = await row.getAttribute("href");

  if (!href) {
    throw new Error(`Deploy execution history row for ${status} did not expose an href.`);
  }

  await page.goto(href);
  await page.waitForLoadState("networkidle");

  return {
    href,
    executionRunId: new URL(href, "http://127.0.0.1").searchParams.get("executionRun"),
  };
}

test.describe.serial("deploy execution reliability", () => {
  test.skip(
    isSupabaseE2EMode(),
    "The deploy execution fixture suite runs only in local fallback mode.",
  );

  test.beforeEach(async () => {
    await resetDeployExecutionStore();
  });

  test("renders execution history, filters runs, and shows hosted metadata for ready runs", async ({
    page,
  }) => {
    await login(page, `${projectBasePath}/deploy`);
    await openDeploy(page);

    const historyItems = page.getByTestId("deploy-execution-history-item");
    await expect(historyItems).toHaveCount(2);

    await page.getByTestId("deploy-execution-history-filter-status").selectOption("submitted");
    await page.waitForTimeout(200);
    await expect(historyItems).toHaveCount(1);
    await expect(historyItems.first()).toContainText("BUILDING");

    await page.getByTestId("deploy-execution-history-filter-status").selectOption("ready");
    await page.waitForTimeout(200);
    await expect(historyItems).toHaveCount(1);
    await expect(historyItems.first()).toContainText("READY");

    await openFilteredExecutionRun(page, "ready");
    await expect(page.getByText("dpl_phase34_attempt2").first()).toBeVisible();
    await expect(page.getByText("https://phase34-ready.vercel.app").first()).toBeVisible();
    await expect(page.getByTestId("deploy-execution-hosted-link")).toBeVisible();
    await expect(page.getByTestId("deploy-execution-inspector-link")).toBeVisible();
    await expect(page.getByText("production-eu").first()).toBeVisible();
    await expect(page.getByTestId("deploy-recheck-execution")).toBeDisabled();
    await expect(page.getByTestId("deploy-retry-execution")).toBeDisabled();
  });

  test("explicitly rechecks submitted execution runs", async ({ page }) => {
    await login(page, `${projectBasePath}/deploy`);
    const selectedRun = await openFilteredExecutionRun(page, "submitted");

    await expect(page.getByText("dpl_phase34_attempt1").first()).toBeVisible();
    await expect(page.getByText("BUILDING").first()).toBeVisible();
    await expect(page.getByTestId("deploy-recheck-execution")).toBeEnabled();
    await expect(page.getByTestId("deploy-retry-execution")).toBeEnabled();

    await page.getByTestId("deploy-recheck-execution").click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("READY").first()).toBeVisible();
    await expect(page.getByText("https://phase34-attempt1-ready.vercel.app").first()).toBeVisible();
    await expect(page.getByTestId("deploy-execution-inspector-link")).toBeVisible();
    await expect(page.getByTestId("deploy-recheck-execution")).toBeDisabled();
    await expect(page.getByTestId("deploy-retry-execution")).toBeDisabled();

    await openDeployTimeline(page);
    const recheckedCard = page
      .locator('[data-testid="timeline-event-card"][data-event-kind="deploy_execution_rechecked"]')
      .first();
    await expect(recheckedCard).toContainText("Hosting execution rechecked for dpl_phase34_attempt1");
    await expect(recheckedCard.getByTestId("timeline-open-context")).toHaveAttribute(
      "href",
      new RegExp(`executionRun=${selectedRun.executionRunId}`),
    );
  });

  test("explicitly retries submitted execution runs and preserves history", async ({ page }) => {
    await login(page, `${projectBasePath}/deploy`);
    await openFilteredExecutionRun(page, "submitted");

    await page.getByTestId("deploy-retry-execution").click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("dpl_phase45_retry_1").first()).toBeVisible();
    await expect(page.getByText("https://dpl_phase45_retry_1.vercel.app").first()).toBeVisible();
    await expect(page.getByText("BUILDING").first()).toBeVisible();
    await expect(page.getByText("3").first()).toBeVisible();
    const latestHistoryHref = await page.getByTestId("deploy-execution-history-item").first().getAttribute("href");
    const executionRunId = latestHistoryHref
      ? new URL(latestHistoryHref, "http://127.0.0.1").searchParams.get("executionRun")
      : null;

    await openDeploy(page);
    await expect(page.getByTestId("deploy-execution-history-item")).toHaveCount(3);
    await page.getByTestId("deploy-execution-history-filter-status").selectOption("submitted");
    await page.waitForTimeout(200);
    await expect(page.getByTestId("deploy-execution-history-item")).toHaveCount(2);

    await openDeployTimeline(page);
    const retriedCard = page
      .locator('[data-testid="timeline-event-card"][data-event-kind="deploy_execution_retried"]')
      .first();
    await expect(retriedCard).toContainText("Hosting execution retried for phase34-demo.besastudio.test");
    await expect(retriedCard.getByTestId("timeline-open-context")).toHaveAttribute(
      "href",
      new RegExp(`executionRun=${executionRunId}`),
    );
  });
});
