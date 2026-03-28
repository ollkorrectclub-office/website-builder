import { expect, test, type Page } from "@playwright/test";

import { e2eLocale, e2eWorkspaceSlug, isSupabaseE2EMode } from "./support/env";
import { resetE2EStore } from "./support/store";

const workspaceProjectsPath = `/${e2eLocale}/app/workspaces/${e2eWorkspaceSlug}/projects`;

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

function isExternalPlannerEnabled() {
  const value = process.env.ENABLE_EXTERNAL_PLANNER ?? process.env.enableExternalPlanner ?? "";
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function plannerApiKeyEnvVar() {
  return (process.env.EXTERNAL_PLANNER_API_KEY_ENV_VAR ?? "OPENAI_API_KEY").trim();
}

function plannerSourceExpectation() {
  if (isExternalPlannerEnabled()) {
    return {
      plannerSourceLabel: "External model adapter v1",
      adapterSourceLabel: "External model",
      adapterKey: "external_model_adapter_v1",
    };
  }

  return {
    plannerSourceLabel: "Rules planner v1",
    adapterSourceLabel: "Deterministic internal",
    adapterKey: "rules_planner_v1",
  };
}

async function login(page: Page, nextPath = `${workspaceProjectsPath}/new`) {
  await page.goto(`/${e2eLocale}/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByTestId("login-email").fill("arta@besa.studio");
  await page.getByTestId("login-password").fill("phase1-demo");
  await page.getByTestId("login-submit").click();
  await page.waitForURL(new RegExp(`${workspaceProjectsPath}/new`));
}

test.describe.serial("planner provider boundary", () => {
  test.skip(isSupabaseE2EMode(), "The planner provider boundary suite runs only in local fallback mode.");

  test.beforeEach(async () => {
    await resetE2EStore();
  });

  test("keeps planner output structure stable while switching planner execution mode", async ({ page }) => {
    test.slow();

    if (isExternalPlannerEnabled()) {
      const apiKeyEnvVar = plannerApiKeyEnvVar();
      test.skip(
        !process.env[apiKeyEnvVar],
        `External planner verification requires ${apiKeyEnvVar} to be available in the environment.`,
      );
    }

    const expected = plannerSourceExpectation();
    const projectName = `Planner Boundary ${Date.now()}`;
    const projectSlug = slugify(projectName);
    const projectPlanPath = `${workspaceProjectsPath}/${projectSlug}/plan`;

    await login(page);
    await page.locator('input[name="name"]').fill(projectName);
    await page.locator('textarea[name="prompt"]').fill(
      "Build a bilingual clinic website with strong trust sections, appointment prompts, and clear service navigation.",
    );
    await page.locator('textarea[name="targetUsers"]').fill(
      "New patients, returning patients, family decision-makers",
    );
    await page.locator('textarea[name="desiredPagesFeatures"]').fill(
      "Home, Services, Doctors, Booking, Contact, Trust blocks",
    );
    await page.getByRole("button", { name: /save project/i }).click();

    try {
      await page.waitForURL(/\/projects\/[^/]+\/plan(?:\?|$)/, { timeout: 10_000 });
    } catch {
      await expect(page.getByText("NEXT_REDIRECT")).toBeVisible();
      await page.goto(projectPlanPath);
    }

    await page.waitForLoadState("networkidle");

    await expect(page.getByText(expected.plannerSourceLabel).first()).toBeVisible();
    await expect(page.getByText("Normalized brief").first()).toBeVisible();
    await expect(page.getByText("Planning signals").first()).toBeVisible();
    await expect(page.getByText("Structured plan payload").first()).toBeVisible();

    await page.getByTestId("provider-run-history-filter-capability").selectOption("planning");
    await page.getByTestId("provider-run-history-filter-status").selectOption("completed");
    await page.getByTestId("provider-run-history-filter-trigger").selectOption("project_create");
    await page.getByTestId("provider-run-history-filter-linked-entity").selectOption("planner_run");

    const historyItem = page.getByTestId("provider-run-history-item").first();
    await expect(historyItem).toContainText(expected.adapterSourceLabel);
    await expect(historyItem).toContainText(expected.adapterKey);
  });
});
