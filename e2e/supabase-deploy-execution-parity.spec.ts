import { expect, test, type Page } from "@playwright/test";

import {
  e2eLocale,
  e2eProjectBasePath,
  e2eSupabaseDeployProjectBasePath,
  isSupabaseE2EMode,
} from "./support/env";

const projectBasePath = e2eSupabaseDeployProjectBasePath || e2eProjectBasePath;
const ownerEmail = process.env.BESA_E2E_SUPABASE_OWNER_EMAIL ?? "";
const ownerPassword = process.env.BESA_E2E_SUPABASE_OWNER_PASSWORD ?? "";
const deployStubBaseUrl = `http://127.0.0.1:${process.env.BESA_E2E_DEPLOY_STUB_PORT ?? "4022"}`;
const deployExecutionRecheckedPattern =
  e2eLocale === "sq" ? /Hosting execution u rikontrollua/i : /Hosting execution rechecked/i;
const deployExecutionRetriedPattern =
  e2eLocale === "sq" ? /Hosting execution u riprovua/i : /Hosting execution retried/i;

function serializeDeployStubConfig() {
  return [
    "provider|vercel",
    "framework|nextjs-app-router",
    "outputMode|build-output-api",
    `apiBaseUrl|${deployStubBaseUrl}`,
    "tokenEnvVar|VERCEL_TOKEN",
    "projectName|supabase-deploy-e2e",
    "deploymentTarget|preview",
  ].join("\n");
}

async function login(page: Page, nextPath = `${projectBasePath}/deploy`) {
  await page.goto(`/${e2eLocale}/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByTestId("login-email").fill(ownerEmail);
  await page.getByTestId("login-password").fill(ownerPassword);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(new RegExp(`${projectBasePath}/deploy`));
  await page.goto(`${projectBasePath}/deploy`);
  await page.waitForLoadState("networkidle");
}

async function configureDeployStub(page: Page) {
  await page.goto(`${projectBasePath}/deploy#target-settings`);
  await page.getByTestId("deploy-target-settings-primary-domain").fill("supabase.deploy.besastudio.test");
  await page
    .getByTestId("deploy-target-settings-adapter-config")
    .fill(serializeDeployStubConfig());
  await page.getByTestId("deploy-target-settings-save").click();
  await page.waitForLoadState("networkidle");
  await page.goto(`${projectBasePath}/deploy`);
  await page.waitForLoadState("networkidle");
}

async function openDeployTimeline(page: Page) {
  await page.goto(`${projectBasePath}/timeline?source=deploy`);
  await page.waitForLoadState("networkidle");
}

function isExecutionContextUrl(url: URL, executionRunId: string) {
  return (
    url.pathname === `${projectBasePath}/deploy` &&
    url.searchParams.get("executionRun") === executionRunId &&
    url.searchParams.has("deployRun") &&
    url.searchParams.has("release")
  );
}

test.describe.serial("supabase deploy execution parity", () => {
  test.skip(!isSupabaseE2EMode(), "This suite only runs when Supabase deploy parity mode is enabled.");

  test("verifies deploy execution, recheck, retry, and timeline outcomes against Supabase-backed state", async ({
    page,
  }) => {
    await login(page);
    await configureDeployStub(page);

    await expect(page.getByTestId("deploy-run-execution")).toBeEnabled();
    await page.getByTestId("deploy-run-execution").click();
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/executionRun=/);
    await expect(page.getByText("BUILDING").first()).toBeVisible();
    const initialExecutionRunId = new URL(page.url()).searchParams.get("executionRun");
    expect(initialExecutionRunId).not.toBeNull();

    await openDeployTimeline(page);
    const executionCard = page
      .locator(
        `[data-testid="timeline-event-card"][data-event-kind="deploy_execution_run"][data-entity-id="${initialExecutionRunId}"]`,
      )
      .first();
    await expect(executionCard).toContainText(/Hosting execution/i);
    await expect(executionCard.getByTestId("timeline-open-context")).toHaveAttribute(
      "href",
      new RegExp(`executionRun=${initialExecutionRunId}`),
    );

    await page.goto(`${projectBasePath}/deploy?executionRun=${encodeURIComponent(initialExecutionRunId ?? "")}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("deploy-recheck-execution")).toBeEnabled();
    await Promise.all([
      page.waitForURL((url) => isExecutionContextUrl(url, initialExecutionRunId ?? "")),
      page.getByTestId("deploy-recheck-execution").click(),
    ]);
    await page.waitForLoadState("networkidle");

    await openDeployTimeline(page);
    const recheckedCard = page
      .locator(
        `[data-testid="timeline-event-card"][data-event-kind="deploy_execution_rechecked"][data-entity-id="${initialExecutionRunId}"]`,
      )
      .first();
    await expect(recheckedCard).toContainText(deployExecutionRecheckedPattern);
    await expect(recheckedCard.getByTestId("timeline-open-context")).toHaveAttribute(
      "href",
      new RegExp(`executionRun=${initialExecutionRunId}`),
    );

    await page.goto(`${projectBasePath}/deploy`);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("deploy-run-execution").click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("deploy-retry-execution")).toBeEnabled();
    await Promise.all([
      page.waitForURL(
        (url) =>
          url.pathname === `${projectBasePath}/deploy` &&
          url.searchParams.get("executionRun") !== initialExecutionRunId &&
          url.searchParams.has("deployRun") &&
          url.searchParams.has("release"),
      ),
      page.getByTestId("deploy-retry-execution").click(),
    ]);
    await page.waitForLoadState("networkidle");

    const retriedExecutionRunId = new URL(page.url()).searchParams.get("executionRun");
    expect(retriedExecutionRunId).not.toBeNull();
    await expect(page.getByText("BUILDING").first()).toBeVisible();

    await openDeployTimeline(page);
    const retriedCard = page
      .locator(
        `[data-testid="timeline-event-card"][data-event-kind="deploy_execution_retried"][data-entity-id="${retriedExecutionRunId}"]`,
      )
      .first();
    await expect(retriedCard).toContainText(deployExecutionRetriedPattern);
    await expect(retriedCard.getByTestId("timeline-open-context")).toHaveAttribute(
      "href",
      new RegExp(`executionRun=${retriedExecutionRunId}`),
    );
  });
});
