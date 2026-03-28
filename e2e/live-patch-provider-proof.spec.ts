import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

import { runtimeE2EStoreFile, resetE2EStore } from "./support/store";
import {
  e2eLocale,
  e2eProjectBasePath,
  isLiveProviderE2EMode,
  isSupabaseE2EMode,
} from "./support/env";

const projectBasePath = e2eProjectBasePath;

interface StoredPatchProposal {
  id: string;
  filePath: string;
  requestPrompt: string;
  title: string;
  rationale: string;
  changeSummary: string;
  source: string;
  status: string;
  baseContent: string;
  proposedContent: string;
  createdAt: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildCodeReviewHref(filePath: string, proposalId: string) {
  const params = new URLSearchParams();
  params.set("file", filePath);
  params.set("proposal", proposalId);
  return `${projectBasePath}/code?${params.toString()}`;
}

function looksLikeDiffPayload(value: string) {
  const trimmed = value.trimStart();

  return (
    trimmed.startsWith("diff --git") ||
    trimmed.startsWith("@@") ||
    /(?:^|\n)diff --git /m.test(trimmed) ||
    (/^--- .+\n\+\+\+ /m.test(trimmed) && trimmed.includes("\n@@"))
  );
}

async function login(page: Page, nextPath = `${projectBasePath}/code`) {
  await page.goto(`/${e2eLocale}/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByTestId("login-email").fill("arta@besa.studio");
  await page.getByTestId("login-password").fill("phase1-demo");
  await page.getByTestId("login-submit").click();
  await page.waitForURL(new RegExp(`${projectBasePath}/code`));
  await page.goto(nextPath);
  await page.waitForLoadState("networkidle");
}

async function waitForProposalRecord(requestPrompt: string, filePath: string): Promise<StoredPatchProposal> {
  const timeoutAt = Date.now() + 60_000;

  while (Date.now() < timeoutAt) {
    const store = JSON.parse(await readFile(runtimeE2EStoreFile, "utf8")) as {
      projectPatchProposals?: StoredPatchProposal[];
    };
    const matches = (store.projectPatchProposals ?? [])
      .filter((proposal) => proposal.requestPrompt === requestPrompt && proposal.filePath === filePath)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    if (matches.length > 0) {
      return matches[0];
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for a stored patch proposal for ${filePath}.`);
}

test.describe.serial("live patch provider proof", () => {
  test.skip(
    isSupabaseE2EMode() || !isLiveProviderE2EMode(),
    "The live patch provider proof runs only in local fallback mode with the live provider enabled.",
  );

  test.beforeEach(async () => {
    await resetE2EStore();
  });

  test("creates one real hosted-provider patch proposal and preserves the one-file proposal contract", async ({
    page,
  }) => {
    test.slow();

    await login(page);

    const prompt = `Live provider patch proof ${Date.now()}`;
    const filePath = await page.locator('input[name="filePath"]').inputValue();
    const requestPromptField = page.locator('textarea[name="requestPrompt"]');

    await requestPromptField.fill(prompt);
    await requestPromptField.evaluate((element) => {
      const form = element.closest("form");

      if (!(form instanceof HTMLFormElement)) {
        throw new Error("Patch request form not found.");
      }

      form.requestSubmit();
    });

    const storedProposal = await waitForProposalRecord(prompt, filePath);

    expect(storedProposal.source).toBe("external_patch_adapter_v1");
    expect(storedProposal.status).toBe("pending");
    expect(storedProposal.title.trim().length).toBeGreaterThan(0);
    expect(storedProposal.rationale.trim().length).toBeGreaterThan(0);
    expect(storedProposal.changeSummary.trim().length).toBeGreaterThan(0);
    expect(storedProposal.proposedContent.trim().length).toBeGreaterThan(0);
    expect(storedProposal.filePath).toBe(filePath);
    expect(storedProposal.baseContent).not.toBe(storedProposal.proposedContent);
    expect(looksLikeDiffPayload(storedProposal.proposedContent)).toBeFalsy();

    await page.goto(buildCodeReviewHref(filePath, storedProposal.id));
    await page.waitForLoadState("networkidle");

    const reviewCard = page.getByTestId("patch-proposal-review-card");
    await expect(reviewCard).toBeVisible();
    await expect(reviewCard).toContainText(storedProposal.title);
    await expect(reviewCard).toContainText(storedProposal.rationale);
    await expect(reviewCard).toContainText(storedProposal.changeSummary);
    await expect(reviewCard).toContainText(prompt);

    await page.getByTestId("code-provider-run-history-filter-capability").selectOption("patch_suggestion");
    await page.getByTestId("code-provider-run-history-filter-status").selectOption("completed");
    await page.getByTestId("code-provider-run-history-filter-trigger").selectOption("proposal_request");
    await page.getByTestId("code-provider-run-history-filter-linked-entity").selectOption("patch_proposal");

    const historyItem = page.getByTestId("code-provider-run-history-item").first();
    await expect(historyItem).toContainText("External model");
    await expect(historyItem).toContainText("external_patch_adapter_v1");
    await expect(historyItem).toContainText(filePath);
  });
});
