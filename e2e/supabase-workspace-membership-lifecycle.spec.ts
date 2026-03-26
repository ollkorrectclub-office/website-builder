import { expect, test, type Browser, type Page } from "@playwright/test";

import { e2eLocale, e2eProjectSlug, e2eWorkspaceSlug, isSupabaseE2EMode } from "./support/env";
import { normalizeSupabaseWorkspaceMembershipBaseline } from "./support/supabase";

const workspaceManagePath = `/${e2eLocale}/app/workspaces/${e2eWorkspaceSlug}`;
const projectTimelinePath = `/${e2eLocale}/app/workspaces/${e2eWorkspaceSlug}/projects/${e2eProjectSlug}/timeline`;
const ownerEmail = process.env.BESA_E2E_SUPABASE_OWNER_EMAIL ?? "";
const ownerPassword = process.env.BESA_E2E_SUPABASE_OWNER_PASSWORD ?? "";

function inviteeIdentity() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    email: `phase54-supabase-${suffix}@besa-e2e.test`,
    fullName: "Phase 54 Supabase Invitee",
    password: "phase54-supabase-pass",
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

async function invitationRow(page: Page, email: string) {
  const emailLocator = page.getByText(email, { exact: true }).first();
  await expect(emailLocator).toBeVisible();

  const row = page
    .locator('[data-testid^="workspace-invitation-row-"]')
    .filter({ has: emailLocator })
    .first();
  await expect(row).toBeVisible();
  return row;
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

async function projectOwnershipReviewRow(page: Page) {
  const row = page
    .locator('[data-testid^="workspace-project-ownership-review-row-"]')
    .filter({
      has: page.locator(`a[href$="/projects/${e2eProjectSlug}"]`),
    })
    .first();
  await expect(row).toBeVisible();
  return row;
}

async function projectOwnershipVisibilityRow(page: Page, projectName: string) {
  const row = page
    .locator('[data-testid^="workspace-project-ownership-row-"]')
    .filter({ hasText: projectName })
    .first();
  await expect(row).toBeVisible();
  return row;
}

async function projectOwnershipHistoryRow(page: Page) {
  const row = page
    .locator('[data-testid^="workspace-project-ownership-history-row-"]')
    .filter({
      has: page.locator(`a[href$="/projects/${e2eProjectSlug}"]`),
    })
    .first();
  await expect(row).toBeVisible();
  return row;
}

test.describe.serial("supabase workspace membership lifecycle", () => {
  test.skip(!isSupabaseE2EMode(), "This suite only runs when Supabase E2E mode is enabled.");

  test("accepts an invitation, transfers workspace ownership, and supports reversible project-owner reassignment with visible audit history", async ({
    browser,
    page,
  }) => {
    const invitee = inviteeIdentity();
    const baseline = await normalizeSupabaseWorkspaceMembershipBaseline({
      ownerEmail,
      workspaceSlug: e2eWorkspaceSlug,
      projectSlug: e2eProjectSlug,
    });

    await login(page, ownerEmail, ownerPassword);
    await page.goto(workspaceManagePath);

    await createInvitation(page, { email: invitee.email, role: "viewer" });
    await page.goto(workspaceManagePath);

    const createdInvitationRow = await invitationRow(page, invitee.email);
    await expect(createdInvitationRow).toContainText(/Stored link|Link i ruajtur/i);
    const inviteHref = await createdInvitationRow
      .locator('[data-testid^="workspace-invitation-link-"]')
      .getAttribute("href");

    if (!inviteHref) {
      throw new Error("The Supabase invitation row did not expose a link.");
    }

    const inviteeSession = await acceptInvitation(browser, inviteHref, invitee);

    await page.goto(workspaceManagePath);
    const inviteeRow = await memberRow(page, invitee.email);
    const inviteeMembershipTestId = await inviteeRow.getAttribute("data-testid");

    if (!inviteeMembershipTestId) {
      throw new Error("The accepted Supabase member row did not expose a data-testid.");
    }

    const inviteeMembershipId = inviteeMembershipTestId.replace("workspace-member-row-", "");

    await expect(page.getByTestId("workspace-owner-transfer-target")).toBeEnabled();
    await page.getByTestId("workspace-owner-transfer-target").selectOption(inviteeMembershipId);
    await page.getByTestId("workspace-owner-transfer-confirmation").fill(e2eWorkspaceSlug);
    await page.getByTestId("workspace-owner-transfer-submit").click();
    await page.waitForLoadState("networkidle");

    const targetProjectVisibilityRow = await projectOwnershipVisibilityRow(page, baseline.projectName);
    await expect(targetProjectVisibilityRow).toContainText(/Different from workspace owner|Ndryshe nga workspace owner/i);

    const targetProjectReviewRow = await projectOwnershipReviewRow(page);
    await expect(targetProjectReviewRow).toContainText(/Needs review|Kërkon review/i);
    await targetProjectReviewRow.getByTestId(/workspace-project-owner-target-/).selectOption(inviteeMembershipId);
    await targetProjectReviewRow.getByTestId(/workspace-project-owner-confirmation-/).fill(e2eProjectSlug);
    await targetProjectReviewRow.getByTestId(/workspace-project-owner-submit-/).click();
    await page.waitForLoadState("networkidle");

    await expect(await projectOwnershipVisibilityRow(page, baseline.projectName)).toContainText(
      /Matches workspace owner|Përputhet me workspace owner/i,
    );
    await expect(await projectOwnershipReviewRow(page)).toContainText(/Aligned|I përafruar/i);
    await expect(page.getByTestId("workspace-project-ownership-history-card")).toContainText(
      /Current assignment|Reasignimi aktual/i,
    );

    const latestHistoryRow = await projectOwnershipHistoryRow(page);
    await latestHistoryRow
      .getByTestId(/workspace-project-ownership-history-reassign-back-confirmation-/)
      .fill(e2eProjectSlug);
    await latestHistoryRow.getByTestId(/workspace-project-ownership-history-reassign-back-submit-/).click();
    await page.waitForLoadState("networkidle");

    await expect(await projectOwnershipVisibilityRow(page, baseline.projectName)).toContainText(
      /Different from workspace owner|Ndryshe nga workspace owner/i,
    );
    await expect(await projectOwnershipReviewRow(page)).toContainText(/Needs review|Kërkon review/i);
    await expect(page.getByTestId("workspace-project-ownership-history-card")).toContainText(
      /Reassigned back|Kthyer mbrapa/i,
    );
    await expect(await projectOwnershipHistoryRow(page)).toContainText(
      /Current assignment|Reasignimi aktual/i,
    );

    await inviteeSession.page.goto(workspaceManagePath);
    await expect(inviteeSession.page.getByTestId("workspace-owner-transfer-submit")).toBeEnabled();
    await expect(await projectOwnershipVisibilityRow(inviteeSession.page, baseline.projectName)).toContainText(
      /Different from workspace owner|Ndryshe nga workspace owner/i,
    );
    await expect(await projectOwnershipReviewRow(inviteeSession.page)).toContainText(/Needs review|Kërkon review/i);

    await page.goto(projectTimelinePath);
    const reassignmentEvent = page
      .locator('[data-testid="timeline-event-card"][data-event-kind="project_owner_reassigned"]')
      .first();
    await expect(reassignmentEvent).toBeVisible();
    await expect(reassignmentEvent).toContainText(
      new RegExp(baseline.ownerFullName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    );
    await reassignmentEvent.getByTestId("timeline-open-context").click();
    await page.waitForURL(`**/${e2eProjectSlug}/plan`);

    await inviteeSession.context.close();
  });
});
