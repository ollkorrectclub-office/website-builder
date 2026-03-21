import { expect, test, type Page } from "@playwright/test";

import {
  e2eLocale,
  e2eProjectBasePath,
  isSupabaseE2EMode,
} from "./support/env";
import { resetE2EStore } from "./support/store";

const workspacePath = `/${e2eLocale}/app/workspaces`;
const projectBasePath = e2eProjectBasePath;
const editableCodeFilePath = `${projectBasePath}/code?file=${encodeURIComponent("app/[locale]/page.tsx")}`;

const localUsers = {
  owner: { email: "arta@besa.studio", password: "phase1-demo" },
  admin: { email: "nora@besa.studio", password: "phase1-demo" },
  editor: { email: "leon@besa.studio", password: "phase1-demo" },
  viewer: { email: "sara@besa.studio", password: "phase1-demo" },
} as const;

async function loginAs(page: Page, role: keyof typeof localUsers, nextPath = workspacePath) {
  const user = localUsers[role];

  await page.goto(`/${e2eLocale}/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByTestId("login-email").fill(user.email);
  await page.getByTestId("login-password").fill(user.password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(`**${nextPath}`);
}

async function requestSubmitByTestId(page: Page, testId: string) {
  await page.evaluate((submitTestId) => {
    const trigger = document.querySelector(`[data-testid="${submitTestId}"]`);

    if (!(trigger instanceof HTMLElement)) {
      throw new Error(`Missing trigger for ${submitTestId}.`);
    }

    const form = trigger.closest("form");

    if (!(form instanceof HTMLFormElement)) {
      throw new Error(`Missing form for ${submitTestId}.`);
    }

    form.requestSubmit();
  }, testId);
}

test.describe.serial("permission matrix", () => {
  test.skip(isSupabaseE2EMode(), "The permission matrix suite runs only in local fallback mode.");

  test.beforeEach(async () => {
    await resetE2EStore();
  });

  test("viewer stays read-only and protected mutations fail safely", async ({ page }) => {
    await loginAs(page, "viewer", `${projectBasePath}/plan`);

    await expect(page.getByTestId("brief-name")).toBeDisabled();
    await expect(page.getByTestId("planner-rerun-submit")).toBeDisabled();
    await expect(page.getByTestId("candidate-promote-submit")).toBeDisabled();

    await requestSubmitByTestId(page, "planner-rerun-submit");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("You do not have permission to rerun the planner for this project.")).toBeVisible();

    await page.goto(`${projectBasePath}/visual`);
    await expect(page.getByTestId("visual-regenerate")).toBeDisabled();
    await expect(page.getByTestId("visual-section-label")).toBeDisabled();
    await expect(page.getByText(/Viewer access stays read-only/i).first()).toBeVisible();

    await page.goto(editableCodeFilePath);
    await expect(page.getByTestId("code-editor-content")).toHaveCount(0);
    await expect(page.getByTestId("code-generate-proposal")).toBeDisabled();
    await expect(page.getByText(/Viewer access stays read-only/i).first()).toBeVisible();

    await page.goto(`${projectBasePath}/preview`);
    await expect(page.getByTestId("preview-route-navigation")).toBeVisible();
    await expect(page.getByTestId("preview-runtime-source")).toBeVisible();

    await page.goto(`${projectBasePath}/deploy`);
    await expect(page.getByTestId("deploy-create-snapshot")).toBeDisabled();
    await requestSubmitByTestId(page, "deploy-create-snapshot");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText("You do not have permission to publish or create deploy snapshots for this project."),
    ).toBeVisible();
  });

  test("editor can work in Plan, Visual, and Code but cannot approve plans or publish deploys", async ({
    page,
  }) => {
    await loginAs(page, "editor", `${projectBasePath}/plan`);

    await expect(page.getByTestId("brief-name")).toBeEnabled();
    await expect(page.getByTestId("planner-rerun-submit")).toBeEnabled();
    await expect(page.getByTestId("candidate-promote-submit")).toBeDisabled();

    await requestSubmitByTestId(page, "candidate-promote-submit");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText("You do not have permission to approve or promote this plan candidate."),
    ).toBeVisible();

    await page.goto(`${projectBasePath}/visual`);
    await expect(page.getByTestId("visual-regenerate")).toBeEnabled();
    await expect(page.getByTestId("visual-section-label")).toBeEnabled();

    await page.goto(editableCodeFilePath);
    await expect(page.getByTestId("code-editor-content")).toBeVisible();
    await expect(page.getByTestId("code-save-draft")).toBeEnabled();
    await expect(page.getByTestId("code-save-revision")).toBeEnabled();
    await expect(page.getByTestId("code-generate-proposal")).toBeVisible();

    await page.goto(`${projectBasePath}/deploy`);
    await expect(page.getByTestId("deploy-create-snapshot")).toBeDisabled();
    await requestSubmitByTestId(page, "deploy-create-snapshot");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText("You do not have permission to publish or create deploy snapshots for this project."),
    ).toBeVisible();
  });

  test("admin can approve plan candidates and access deploy publish controls", async ({ page }) => {
    await loginAs(page, "admin", `${projectBasePath}/plan`);

    await expect(page.getByTestId("planner-rerun-submit")).toBeEnabled();
    await expect(page.getByTestId("candidate-promote-submit")).toBeEnabled();

    await page.goto(`${projectBasePath}/deploy`);
    await expect(page.getByTestId("deploy-create-snapshot")).toBeEnabled();
  });
});
