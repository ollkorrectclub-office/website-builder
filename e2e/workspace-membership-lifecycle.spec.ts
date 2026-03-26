import { expect, test, type Browser, type Page } from "@playwright/test";

import { e2eLocale, e2eProjectSlug, e2eWorkspaceSlug, isSupabaseE2EMode } from "./support/env";
import { expireWorkspaceInvitationInLocalStore, resetE2EStore } from "./support/store";

const workspaceManagePath = `/${e2eLocale}/app/workspaces/${e2eWorkspaceSlug}`;
const projectTimelinePath = `/${e2eLocale}/app/workspaces/${e2eWorkspaceSlug}/projects/${e2eProjectSlug}/timeline`;
const localOwner = { email: "arta@besa.studio", password: "phase1-demo" };

function inviteeIdentity() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    email: `phase52-${suffix}@besa-e2e.test`,
    fullName: "Phase 52 Invitee",
    password: "phase52-invitee-pass",
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

  test("supports reactivation, invite revoke/resend, invitation acceptance, owner transfer, and project-owner reassignment", async ({
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
    await expect(initialInvitationRow).toContainText(/Stored link|Link i ruajtur/i);
    await expect(initialInvitationRow).toContainText(/Attempt: #1|Tentativa: #1/i);
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
    await expect(resentInvitationRow).toContainText(/Attempt: #2|Tentativa: #2/i);
    await expect(resentInvitationRow.getByTestId(/workspace-invitation-history-/)).toContainText(
      /Attempt #1|Tentativa #1/i,
    );

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
    await expect(page.getByTestId("workspace-project-ownership-review-card")).toBeVisible();
    await expect(page.getByTestId("workspace-project-ownership-review-card")).toContainText(
      /Needs review|Kërkon review/i,
    );
    const projectOwnershipRow = page.getByTestId(/workspace-project-ownership-review-row-/).first();
    await projectOwnershipRow.getByTestId(/workspace-project-owner-target-/).selectOption(inviteeMembershipId);
    await projectOwnershipRow.getByTestId(/workspace-project-owner-confirmation-/).fill(e2eProjectSlug);
    await projectOwnershipRow.getByTestId(/workspace-project-owner-submit-/).click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("workspace-project-ownership-card")).toContainText(
      /Matches workspace owner|Përputhet me workspace owner/i,
    );
    await expect(page.getByTestId("workspace-project-ownership-review-card")).toContainText(
      /Aligned|I përafruar/i,
    );
    await expect(page.getByText(/reassigned .* to|reasign.* te/i).first()).toBeVisible();

    await inviteeSession.page.goto(workspaceManagePath);
    await expect(inviteeSession.page.getByTestId("workspace-owner-transfer-submit")).toBeEnabled();
    await expect(inviteeSession.page.getByTestId("workspace-project-ownership-card")).toContainText(
      /Matches workspace owner|Përputhet me workspace owner/i,
    );
    await expect(inviteeSession.page.getByTestId("workspace-project-ownership-review-card")).toContainText(
      /Aligned|I përafruar/i,
    );

    await page.goto(projectTimelinePath);
    const reassignmentEvent = page
      .locator('[data-testid="timeline-event-card"][data-event-kind="project_owner_reassigned"]')
      .first();
    await expect(reassignmentEvent).toBeVisible();
    await expect(reassignmentEvent).toContainText(invitee.fullName);
    await reassignmentEvent.getByTestId("timeline-open-context").click();
    await page.waitForURL(`**/${e2eProjectSlug}/plan`);

    await inviteeSession.context.close();
  });

  test("shows an explicit expired invitation state and keeps the record available for resend review", async ({
    page,
  }) => {
    const invitee = inviteeIdentity();

    await login(page, localOwner.email, localOwner.password);
    await page.goto(workspaceManagePath);

    await createInvitation(page, { email: invitee.email, role: "viewer" });
    await page.goto(workspaceManagePath);

    const invitationRow = await firstInvitationRow(page);
    const inviteHref = await getInvitationHref(invitationRow);

    await expireWorkspaceInvitationInLocalStore(invitee.email);

    await page.goto(workspaceManagePath);
    const expiredInvitationRow = await firstInvitationRow(page);
    await expect(expiredInvitationRow).toContainText(/Expired|Skaduar/i);
    await expect(expiredInvitationRow.getByTestId(/workspace-invitation-expired-/)).toContainText(
      /must be resent|duhet ridërguar/i,
    );

    await page.goto(inviteHref);
    await expect(page.getByTestId("workspace-invitation-expired-state")).toBeVisible();
    await expect(page.getByTestId("workspace-invitation-delivery-meta")).toContainText(
      /Stored link|Link i ruajtur/i,
    );
  });
});
