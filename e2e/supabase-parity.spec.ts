import { expect, test, type Page } from "@playwright/test";

import {
  e2eLocale,
  e2eProjectBasePath,
  isSupabaseE2EMode,
} from "./support/env";

const workspacePath = `/${e2eLocale}/app/workspaces`;
const projectBasePath = e2eProjectBasePath;

const ownerEmail = process.env.BESA_E2E_SUPABASE_OWNER_EMAIL ?? "";
const ownerPassword = process.env.BESA_E2E_SUPABASE_OWNER_PASSWORD ?? "";

async function login(page: Page, nextPath = workspacePath) {
  await page.goto(`/${e2eLocale}/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByTestId("login-email").fill(ownerEmail);
  await page.getByTestId("login-password").fill(ownerPassword);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(`**${nextPath}`);
}

test.describe.serial("supabase parity", () => {
  test.skip(!isSupabaseE2EMode(), "This suite only runs when Supabase E2E mode is enabled.");

  test("redirects to login and loads the critical authenticated routes", async ({ page }) => {
    await page.goto(workspacePath);
    await expect(page).toHaveURL(new RegExp(`/${e2eLocale}/login\\?next=`));

    await login(page);

    await page.goto(`${projectBasePath}/plan`);
    await expect(page.getByTestId("planner-rerun-submit")).toBeVisible();

    await page.goto(`${projectBasePath}/visual`);
    await expect(page.getByText(/visual/i).first()).toBeVisible();

    await page.goto(`${projectBasePath}/code`);
    await expect(page.getByText(/code workspace|code/i).first()).toBeVisible();

    await page.goto(`${projectBasePath}/preview`);
    await expect(page.getByTestId("preview-route-navigation")).toBeVisible();
    await expect(page.getByTestId("preview-runtime-source")).toBeVisible();

    await page.goto(`${projectBasePath}/deploy`);
    await expect(page.getByTestId("deploy-create-snapshot")).toBeVisible();
  });
});
