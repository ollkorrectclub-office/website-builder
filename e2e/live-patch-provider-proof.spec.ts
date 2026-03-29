import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

import { generateCodePatchSuggestion } from "@/lib/builder/code-patch-service";
import { defaultProjectModelAdapterConfig } from "@/lib/model-adapters/registry";

import { recordProofCheck, resetProofSummary } from "./support/proof-summary";
import { runtimeE2EStoreFile, resetE2EStore } from "./support/store";
import {
  e2eLocale,
  e2eProjectBasePath,
  isLiveProviderE2EMode,
  isSupabaseE2EMode,
} from "./support/env";

const projectBasePath = e2eProjectBasePath;
const proofFilePath = "next.config.ts";

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

const patchFallbackSampleInput = {
  file: {
    path: "src/components/Hero.tsx",
    name: "Hero.tsx",
    kind: "component" as const,
    language: "tsx" as const,
  },
  currentContent: [
    "export function Hero() {",
    "  return <section data-testid=\"hero-root\">Hero section</section>;",
    "}",
  ].join("\n"),
  requestPrompt: "Add a safer CTA marker and a tiny review note for this file only.",
};

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

function expectStableObjectKeys(
  value: Record<string, unknown>,
  requiredKeys: string[],
  optionalKeys: string[] = [],
) {
  const keys = Object.keys(value).sort();
  const allowedKeys = [...requiredKeys, ...optionalKeys].sort();

  expect(keys).toEqual(expect.arrayContaining([...requiredKeys].sort()));
  expect(keys.every((key) => allowedKeys.includes(key))).toBeTruthy();
}

function buildDefaultPatchConfig() {
  return defaultProjectModelAdapterConfig({
    workspaceId: "workspace_patch_live_proof",
    projectId: "project_patch_live_proof",
  });
}

async function login(
  page: Page,
  nextPath = `${projectBasePath}/code?file=${encodeURIComponent(proofFilePath)}`,
) {
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

  test.beforeAll(async () => {
    await resetProofSummary();
  });

  test.beforeEach(async () => {
    await resetE2EStore();
  });

  test("creates one real hosted-provider patch proposal and preserves the one-file proposal contract", async ({
    page,
  }) => {
    test.slow();

    await login(page);

    const prompt = `Live provider patch proof ${Date.now()}`;
    const requestPromptField = page.locator('textarea[name="requestPrompt"]');
    const patchRequestForm = requestPromptField.locator("xpath=ancestor::form[1]");
    const externalSubmitButton = patchRequestForm.getByTestId("code-generate-proposal-external");
    const filePath = await patchRequestForm.locator('input[name="filePath"]').inputValue();

    expect(filePath).toBe(proofFilePath);
    await expect(externalSubmitButton).toBeEnabled();
    await requestPromptField.fill(prompt);
    await externalSubmitButton.click();

    const storedProposal = await waitForProposalRecord(prompt, filePath);

    expectStableObjectKeys(
      storedProposal,
      [
        "baseContent",
        "changeSummary",
        "createdAt",
        "filePath",
        "id",
        "proposedContent",
        "rationale",
        "requestPrompt",
        "source",
        "status",
        "title",
      ],
      [
        "archiveReason",
        "archivedAt",
        "baseRevisionId",
        "baseRevisionNumber",
        "codeStateId",
        "fileId",
        "invalidatedByRevisionId",
        "invalidatedByRevisionNumber",
        "projectId",
        "resolutionNote",
        "resolvedAt",
        "resolvedRevisionId",
      ],
    );
    expect(storedProposal.source).toBe("external_patch_adapter_v1");
    expect(storedProposal.status).toBe("pending");
    expect(storedProposal.title.trim().length).toBeGreaterThan(0);
    expect(storedProposal.rationale.trim().length).toBeGreaterThan(0);
    expect(storedProposal.changeSummary.trim().length).toBeGreaterThan(0);
    expect(storedProposal.proposedContent.trim().length).toBeGreaterThan(0);
    expect(storedProposal.filePath).toBe(filePath);
    expect(storedProposal.requestPrompt).toBe(prompt);
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

    await recordProofCheck(
      "shapeCheck",
      "passed",
      "Hosted patch proof preserved external_patch_adapter_v1 plus one-file proposal keys and non-diff proposedContent.",
    );
    await recordProofCheck(
      "nonDestructiveCheck",
      "passed",
      "Hosted patch proof kept the proposal in pending review state and did not apply file changes.",
    );
  });

  test("falls back safely to the mock patch suggester when the hosted provider is unavailable", async () => {
    const trackedKeys = [
      "ENABLE_EXTERNAL_PATCH_SUGGESTION",
      "enableExternalPatchSuggestion",
      "EXTERNAL_PATCH_MODEL",
      "EXTERNAL_PATCH_PROVIDER_KEY",
      "EXTERNAL_PATCH_PROVIDER_LABEL",
      "EXTERNAL_PATCH_ENDPOINT_URL",
      "EXTERNAL_PATCH_API_KEY_ENV_VAR",
      "MISSING_PHASE70_PATCH_TOKEN",
    ] as const;
    const originalEnv = new Map<string, string | undefined>(
      trackedKeys.map((key) => [key, process.env[key]]),
    );

    process.env.ENABLE_EXTERNAL_PATCH_SUGGESTION = "true";
    process.env.enableExternalPatchSuggestion = "true";
    process.env.EXTERNAL_PATCH_MODEL = process.env.EXTERNAL_PATCH_MODEL || "gpt-5.4-mini";
    process.env.EXTERNAL_PATCH_PROVIDER_KEY = "openai_compatible";
    process.env.EXTERNAL_PATCH_PROVIDER_LABEL = "OpenAI-compatible live";
    delete process.env.EXTERNAL_PATCH_ENDPOINT_URL;
    process.env.EXTERNAL_PATCH_API_KEY_ENV_VAR = "MISSING_PHASE70_PATCH_TOKEN";
    delete process.env.MISSING_PHASE70_PATCH_TOKEN;

    try {
      const result = await generateCodePatchSuggestion(patchFallbackSampleInput, buildDefaultPatchConfig());

      expect(result.suggestion.source).toBe("mock_assistant");
      expect(result.adapterExecution.requestedSelection).toBe("external_model");
      expect(result.adapterExecution.executedSelection).toBe("deterministic_internal");
      expect(result.adapterExecution.executionMode).toBe("fallback");
      expect(result.adapterExecution.requestedAdapterKey).toBe("external_patch_adapter_v1");
      expect(result.adapterExecution.executedAdapterKey).toBe("mock_assistant");
      expect(result.adapterExecution.fallbackReason).toContain(
        "Environment variable MISSING_PHASE70_PATCH_TOKEN is not set.",
      );

      await recordProofCheck(
        "fallbackCheck",
        "passed",
        "Hosted patch proof still falls back safely to mock_assistant when the configured patch API-key env var is missing.",
      );
    } finally {
      for (const [key, value] of originalEnv.entries()) {
        if (typeof value === "undefined") {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});
