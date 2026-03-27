import {
  readApiKeyFromEnv,
  requestOpenAICompatibleJson,
  resolveOpenAICompatibleEndpoint,
} from "@/lib/model-adapters/openai-compatible";
import { ExternalProviderExecutionError } from "@/lib/model-adapters/errors";
import { ExternalAdapterNotReadyError } from "@/lib/model-adapters/registry";
import {
  type CodePatchSuggestionInput,
  type ExternalPatchSuggestionAdapterConfig,
  type ExternalPatchSuggestionExecutionAdapter,
  type ExternalPatchSuggestionExecutionDetails,
  type GeneratedCodePatchSuggestion,
} from "@/lib/builder/code-patch-types";
import { generateMockCodePatchSuggestion } from "@/lib/builder/code-patch-suggester";

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

function buildPatchInstructions() {
  return [
    "You are the patch suggestion model for a controlled single-file code review flow.",
    "Return JSON only and match the schema exactly.",
    "Propose changes for exactly one file: the file provided in the input.",
    "Do not mention or modify any other file, route, or module.",
    "Return the full replacement content for the same file path only.",
    "Keep the patch conservative, syntax-valid, and aligned to the request.",
    "Do not output markdown, code fences, or explanation outside the schema.",
  ].join(" ");
}

function buildPatchPrompt(input: CodePatchSuggestionInput, baseline: GeneratedCodePatchSuggestion) {
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

function mergePatchOutput(
  output: ExternalPatchStructuredOutput,
  baseline: GeneratedCodePatchSuggestion,
): GeneratedCodePatchSuggestion {
  const proposedContent = normalizeString(output.proposedContent) || baseline.proposedContent;

  if (!proposedContent) {
    throw new Error("Provider output did not include patch content.");
  }

  return {
    title: normalizeString(output.title) || baseline.title,
    rationale: normalizeString(output.rationale) || baseline.rationale,
    changeSummary: normalizeString(output.changeSummary) || baseline.changeSummary,
    proposedContent,
    source: "external_patch_adapter_v1",
  };
}

export class ExternalPatchSuggestionAdapter implements ExternalPatchSuggestionExecutionAdapter {
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
        instructions: buildPatchInstructions(),
        promptInput: buildPatchPrompt(input, baseline),
        schemaName: "builder_patch_suggestion_output",
        schema: patchSuggestionSchema(),
        metadata: {
          capability: "patch_suggestion",
          filePath: input.file.path,
        },
        traceLabels: {
          instructions: "Patch instructions",
          input: "Patch input",
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

    return {
      suggestion: mergePatchOutput(providerResponse.parsed, baseline),
      execution: {
        latencyMs: providerResponse.latencyMs,
        trace: providerResponse.trace,
      },
    };
  }
}
