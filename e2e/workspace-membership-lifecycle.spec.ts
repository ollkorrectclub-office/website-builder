import { expect, test, type Browser, type Page } from "@playwright/test";

import { e2eLocale, e2eWorkspaceSlug, isSupabaseE2EMode } from "./support/env";
import { resetE2EStore } from "./support/store";

const workspaceManagePath = `/${e2eLocale}/app/workspaces/${e2eWorkspaceSlug}`;
const localOwner = { email: "arta@besa.studio", password: "phase1-demo" };

function inviteeIdentity() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    email: `phase51-${suffix}@besa-e2e.test`,
    fullName: "Phase 51 Invitee",
    password: "phase51-invitee-pass",
  };
}

async function login(page: Page, email: string, password: string, nextPath = workspaceManagePath) {
  await page.goto(`/${e2eLocale}/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(`**${nextPath}`);
}

async function createInvitation(page: Page, input: { email: string; role: "viewer" | "editor" | "admin" }) {
  const form = page.getByTestId("workspace-invitation-create-form");
  await form.locator('input[name="email"]').fill(input.email);
  await form.locator('select[name="role"]').selectOption(input.role);
  await page.getByTestId("workspace-invitation-create-submit").click();
  await page.waitForLoadState("networkidle");
}

async function firstInvitationRow(page: Page) {
  const row = page.locator('[data-testid^="workspace-invitation-row-"]').first();
  await expect(row).toBeVisible();
  return row;
}

async function getInvitationHref(row: Awaited<ReturnType<typeof firstInvitationRow>>) {
  const href = await row.locator('[data-testid^="workspace-invitation-link-"]').getAttribute("href");

  if (!href) {
    throw new Error("The invitation row did not expose a link.");
  }

  return href;
}

async function memberRow(page: Page, memberLabel: string) {
  const row = page
    .locator('[data-testid^="workspace-member-row-"]')
    .filter({ hasText: memberLabel })
    .first();
  await expect(row).toBeVisible();
  return row;
}

async function acceptInvitation(
  browser: Browser,
  inviteHref: string,
  invitee: { email: string; fullName: string; password: string },
) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(inviteHref);
  await page.getByTestId("workspace-invitation-accept-form").locator('input[name="fullName"]').fill(invitee.fullName);
  await page.getByTestId("workspace-invitation-accept-form").locator('input[name="password"]').fill(invitee.password);
  await page.getByTestId("workspace-invitation-accept-submit").click();
  await page.waitForURL(`**${workspaceManagePath}`);

  return { context, page };
}

test.describe.serial("workspace membership lifecycle", () => {
  test.skip(isSupabaseE2EMode(), "The local workspace lifecycle suite runs only in local fallback mode.");

  test.beforeEach(async () => {
    await resetE2EStore();
  });

  test("supports reactivation, invite revoke/resend, invitation acceptance, and owner transfer post-checks", async ({
    browser,
    page,
  }) => {
    const invitee = inviteeIdentity();

    await login(page, localOwner.email, localOwner.password);
    await page.goto(workspaceManagePath);

    const editorRow = await memberRow(page, "Leon Gashi");
    await editorRow.locator('[data-testid^="workspace-member-deactivate-"]').click();
    await page.waitForLoadState("networkidle");
    await page.goto(workspaceManagePath);
    await expect(await memberRow(page, "Leon Gashi")).toContainText(/Deactivated/i);

    await (await memberRow(page, "Leon Gashi")).locator('[data-testid^="workspace-member-reactivate-"]').click();
    await page.waitForLoadState("networkidle");
    await page.goto(workspaceManagePath);
    await expect(await memberRow(page, "Leon Gashi")).toContainText(/Active/i);

    await createInvitation(page, { email: invitee.email, role: "viewer" });
    await page.goto(workspaceManagePath);

    const initialInvitationRow = await firstInvitationRow(page);
    await expect(initialInvitationRow).toContainText(invitee.email);
    await initialInvitationRow.locator('[data-testid^="workspace-invitation-revoke-"]').click();
    await page.waitForLoadState("networkidle");
    await page.goto(workspaceManagePath);

    const revokedInvitationRow = await firstInvitationRow(page);
    await expect(revokedInvitationRow).toContainText(/Revoked/i);
    await revokedInvitationRow.locator('[data-testid^="workspace-invitation-resend-"]').click();
    await page.waitForLoadState("networkidle");
    await page.goto(workspaceManagePath);

    const resentInvitationRow = await firstInvitationRow(page);
    await expect(resentInvitationRow).toContainText(invitee.email);
    await expect(resentInvitationRow).toContainText(/Pending/i);

    const inviteHref = await getInvitationHref(resentInvitationRow);
    const inviteeSession = await acceptInvitation(browser, inviteHref, invitee);

    await page.goto(workspaceManagePath);
    const inviteeRow = await memberRow(page, invitee.email);
    await expect(inviteeRow).toContainText(/Active/i);
    const inviteeMembershipTestId = await inviteeRow.getAttribute("data-testid");

    if (!inviteeMembershipTestId) {
      throw new Error("Invitee membership row did not expose a data-testid.");
    }

    const inviteeMembershipId = inviteeMembershipTestId.replace("workspace-member-row-", "");

    await page.getByTestId("workspace-owner-transfer-target").selectOption(inviteeMembershipId);
    await page.getByTestId("workspace-owner-transfer-confirmation").fill(e2eWorkspaceSlug);
    await page.getByTestId("workspace-owner-transfer-submit").click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("workspace-project-ownership-card")).toBeVisible();
    await expect(page.getByTestId("workspace-project-ownership-card")).toContainText(
      /does not move automatically|nuk lëviz automatikisht/i,
    );
    await expect(page.getByTestId("workspace-project-ownership-card")).toContainText(
      /Different from workspace owner|Ndryshe nga workspace owner/i,
    );

    await inviteeSession.page.goto(workspaceManagePath);
    await expect(inviteeSession.page.getByTestId("workspace-owner-transfer-submit")).toBeEnabled();
    await expect(inviteeSession.page.getByTestId("workspace-project-ownership-card")).toContainText(
      /Different from workspace owner|Ndryshe nga workspace owner/i,
    );

    await inviteeSession.context.close();
  });
});
