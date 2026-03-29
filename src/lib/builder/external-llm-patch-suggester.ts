import { generateMockCodePatchSuggestion } from "@/lib/builder/code-patch-suggester";
import {
  type CodePatchSuggestionInput,
  type ExternalPatchSuggestionAdapterConfig,
  type ExternalPatchSuggestionExecutionAdapter,
  type ExternalPatchSuggestionExecutionDetails,
  type GeneratedCodePatchSuggestion,
} from "@/lib/builder/code-patch-types";
import { ExternalProviderExecutionError } from "@/lib/model-adapters/errors";
import { ExternalAdapterNotReadyError } from "@/lib/model-adapters/registry";
import {
  readApiKeyFromEnv,
  requestOpenAICompatibleJson,
  resolveOpenAICompatibleEndpoint,
} from "@/lib/model-adapters/openai-compatible";

interface ExternalPatchStructuredOutput {
  title: string;
  rationale: string;
  changeSummary: string;
  proposedContent: string;
  notes: string;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function countLines(value: string) {
  return value.split("\n").length;
}

function patchSuggestionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "rationale", "changeSummary", "proposedContent", "notes"],
    properties: {
      title: { type: "string" },
      rationale: { type: "string" },
      changeSummary: { type: "string" },
      proposedContent: { type: "string" },
      notes: { type: "string" },
    },
  } as const;
}

function buildPatchPromptTemplate() {
  return [
    "You are the patch suggestion model for a controlled single-file code review flow.",
    "Return JSON only and match the provided schema exactly.",
    "Propose changes for exactly one file: the file provided in the input.",
    "Do not mention, patch, or depend on any other file, route, or module.",
    "Return the full replacement content for the same file path only.",
    "proposedContent must be the complete final file contents, not a diff, patch hunk, checklist, or commentary.",
    "title must be a short review-ready label.",
    "rationale must be plain text, safe, and limited to the requested file only.",
    "changeSummary must be plain text and describe the concrete file change in one short sentence.",
    "Keep the patch conservative, syntax-valid, and aligned to the request.",
    "Do not output markdown, code fences, unified diff hunks, or explanation outside the schema.",
  ].join(" ");
}

const PATCH_PROVIDER_TIMEOUT_MS = 90_000;

function buildPatchPromptInput(input: CodePatchSuggestionInput, baseline: GeneratedCodePatchSuggestion) {
  return [
    "Patch request JSON:",
    JSON.stringify(
      {
        file: input.file,
        requestPrompt: input.requestPrompt,
        currentLineCount: countLines(input.currentContent),
      },
      null,
      2,
    ),
    "Current file content:",
    input.currentContent,
    "Baseline safe patch suggestion JSON:",
    JSON.stringify(
      {
        title: baseline.title,
        rationale: baseline.rationale,
        changeSummary: baseline.changeSummary,
        proposedContent: baseline.proposedContent,
      },
      null,
      2,
    ),
  ].join("\n\n");
}

function unwrapFencedCodeBlock(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:[\w-]+)?\n([\s\S]*?)\n```$/);
  return match ? match[1] : value;
}

function looksLikeMultiFileOrDiffPayload(value: string) {
  const trimmed = value.trimStart();

  return (
    trimmed.startsWith("diff --git") ||
    trimmed.startsWith("@@") ||
    (/^--- .+\n\+\+\+ /m.test(trimmed) && trimmed.includes("\n@@")) ||
    /(?:^|\n)diff --git /m.test(trimmed)
  );
}

function looksLikeFileHeaderPayload(value: string) {
  return /(?:^|\n)(?:file|path)\s*:/i.test(value);
}

function validateShortTextField(fieldName: string, value: unknown) {
  if (typeof value !== "string") {
    throw new Error(`Provider output did not include ${fieldName}.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`Provider output did not include ${fieldName}.`);
  }

  if (normalized.includes("```") || looksLikeMultiFileOrDiffPayload(normalized)) {
    throw new Error(`Provider output included invalid ${fieldName}.`);
  }

  return normalized;
}

function validateReplacementContent(value: unknown, currentContent: string) {
  if (typeof value !== "string") {
    throw new Error("Provider output did not include patch content.");
  }

  const normalized = unwrapFencedCodeBlock(value.replace(/\r\n/g, "\n"));

  if (normalized.trim().length === 0) {
    throw new Error("Provider output did not include patch content.");
  }

  if (looksLikeMultiFileOrDiffPayload(normalized)) {
    throw new Error("Provider output must return full replacement content for one file, not a diff.");
  }

  if (looksLikeFileHeaderPayload(normalized)) {
    throw new Error("Provider output must return replacement content only, without file headers.");
  }

  if (normalized.trim() === currentContent.trim()) {
    throw new Error("Provider output did not propose any effective file change.");
  }

  return normalized;
}

function transformProviderOutputToPatchSuggestion(
  output: ExternalPatchStructuredOutput,
  input: CodePatchSuggestionInput,
): GeneratedCodePatchSuggestion {
  return {
    title: validateShortTextField("a patch title", output.title),
    rationale: validateShortTextField("a patch rationale", output.rationale),
    changeSummary: validateShortTextField("a patch change summary", output.changeSummary),
    proposedContent: validateReplacementContent(output.proposedContent, input.currentContent),
    source: "external_patch_adapter_v1",
  };
}

export class ExternalLLMPatchSuggestionAdapter implements ExternalPatchSuggestionExecutionAdapter {
  readonly source = "external_patch_adapter_v1" as const;
  readonly config: ExternalPatchSuggestionAdapterConfig;

  constructor(config: ExternalPatchSuggestionAdapterConfig) {
    this.config = config;
  }

  async suggest(
    input: CodePatchSuggestionInput,
  ): Promise<{ suggestion: GeneratedCodePatchSuggestion; execution: ExternalPatchSuggestionExecutionDetails }> {
    if (this.config.providerKey !== "openai_compatible") {
      throw new ExternalAdapterNotReadyError(
        `External patch adapter for ${this.config.providerLabel} is not wired beyond OpenAI-compatible patch suggestions yet.`,
      );
    }

    let apiKey: string;

    try {
      apiKey = readApiKeyFromEnv(this.config.apiKeyEnvVar);
    } catch (error) {
      throw new ExternalAdapterNotReadyError(
        error instanceof Error ? error.message : "Patch suggestion API key is not configured.",
      );
    }

    const endpointUrl = resolveOpenAICompatibleEndpoint(this.config.endpointUrl);
    const baseline = generateMockCodePatchSuggestion(input);

    let providerResponse;

    try {
      providerResponse = await requestOpenAICompatibleJson<ExternalPatchStructuredOutput>({
        endpointUrl,
        apiKey,
        model: this.config.modelName,
        instructions: buildPatchPromptTemplate(),
        promptInput: buildPatchPromptInput(input, baseline),
        schemaName: "builder_patch_suggestion_output",
        schema: patchSuggestionSchema(),
        timeoutMs: PATCH_PROVIDER_TIMEOUT_MS,
        metadata: {
          capability: "patch_suggestion",
          filePath: input.file.path,
        },
        traceLabels: {
          instructions: "Patch prompt template",
          input: "Patch prompt input",
          output: "Patch output",
          error: "Patch error",
        },
      });
    } catch (error) {
      if (error instanceof ExternalProviderExecutionError) {
        throw error;
      }

      throw new ExternalProviderExecutionError(
        error instanceof Error ? error.message : "External patch suggestion request failed.",
      );
    }

    try {
      return {
        suggestion: transformProviderOutputToPatchSuggestion(providerResponse.parsed, input),
        execution: {
          latencyMs: providerResponse.latencyMs,
          trace: providerResponse.trace,
        },
      };
    } catch (error) {
      if (error instanceof ExternalProviderExecutionError) {
        throw error;
      }

      throw new ExternalProviderExecutionError(
        error instanceof Error ? error.message : "External patch output was invalid.",
        {
          latencyMs: providerResponse.latencyMs,
          trace: providerResponse.trace,
          classification: "invalid_output",
        },
      );
    }
  }
}
