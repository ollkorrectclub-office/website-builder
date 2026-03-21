import { ExternalProviderExecutionError } from "@/lib/model-adapters/errors";
import type {
  ModelAdapterTracePreviewRecord,
  ModelAdapterTraceRecord,
  ModelAdapterUsageRecord,
} from "@/lib/model-adapters/types";

const DEFAULT_OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const TRACE_LIMITS = {
  prompt: 1800,
  input: 2200,
  output: 2200,
  error: 900,
} as const;

export function isValidEnvVarName(value: string | null | undefined) {
  return typeof value === "string" && /^[A-Z][A-Z0-9_]*$/.test(value.trim());
}

export function resolveOpenAICompatibleEndpoint(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return DEFAULT_OPENAI_RESPONSES_ENDPOINT;
  }

  if (trimmed.endsWith("/responses")) {
    return trimmed;
  }

  return `${trimmed.replace(/\/+$/, "")}/responses`;
}

export function readApiKeyFromEnv(envVarName: string) {
  if (!isValidEnvVarName(envVarName)) {
    throw new Error(`Configured API key env var "${envVarName}" is invalid.`);
  }

  const value = process.env[envVarName];

  if (!value || value.trim().length === 0) {
    throw new Error(`Environment variable ${envVarName} is not set.`);
  }

  return value.trim();
}

function buildTracePreview(
  label: string,
  value: string,
  format: ModelAdapterTracePreviewRecord["format"],
  limit: number,
): ModelAdapterTracePreviewRecord {
  const normalized = value.trim();
  const charCount = normalized.length;

  return {
    label,
    format,
    preview: charCount > limit ? `${normalized.slice(0, limit)}…` : normalized,
    charCount,
    truncated: charCount > limit,
  };
}

export function buildTextTracePreview(
  label: string,
  value: string | null | undefined,
  limit: number = TRACE_LIMITS.output,
): ModelAdapterTracePreviewRecord | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  return buildTracePreview(label, value, "text", limit);
}

export function buildJsonTracePreview(
  label: string,
  value: unknown,
  limit: number = TRACE_LIMITS.input,
): ModelAdapterTracePreviewRecord | null {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  const serialized = JSON.stringify(value, null, 2);
  return buildTracePreview(label, serialized, "json", limit);
}

function textFromContentNode(node: unknown): string[] {
  if (!node || typeof node !== "object") {
    return [];
  }

  const record = node as Record<string, unknown>;
  const directText =
    typeof record.text === "string"
      ? record.text
      : typeof record.output_text === "string"
        ? record.output_text
        : null;
  const nested =
    Array.isArray(record.content)
      ? record.content.flatMap((item) => textFromContentNode(item))
      : [];

  return [directText, ...nested].filter((value): value is string => Boolean(value && value.trim().length > 0));
}

export function extractResponsesOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string" && payload.output_text.trim().length > 0) {
    return payload.output_text;
  }

  const outputItems = Array.isArray(payload.output) ? payload.output : [];
  const collected = outputItems.flatMap((item) => textFromContentNode(item));

  if (collected.length > 0) {
    return collected.join("\n").trim();
  }

  const textValue =
    typeof payload.text === "string"
      ? payload.text
      : typeof payload.response === "string"
        ? payload.response
        : null;

  return textValue?.trim() || "";
}

function normalizeUsage(payload: Record<string, unknown>): ModelAdapterUsageRecord | null {
  const usage =
    payload.usage && typeof payload.usage === "object"
      ? (payload.usage as Record<string, unknown>)
      : null;

  if (!usage) {
    return null;
  }

  const inputTokens =
    typeof usage.input_tokens === "number"
      ? usage.input_tokens
      : typeof usage.prompt_tokens === "number"
        ? usage.prompt_tokens
        : null;
  const outputTokens =
    typeof usage.output_tokens === "number"
      ? usage.output_tokens
      : typeof usage.completion_tokens === "number"
        ? usage.completion_tokens
        : null;
  const totalTokens = typeof usage.total_tokens === "number" ? usage.total_tokens : null;

  if (inputTokens === null && outputTokens === null && totalTokens === null) {
    return null;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

export interface OpenAICompatibleJsonResponseResult<T> {
  parsed: T;
  trace: ModelAdapterTraceRecord;
  latencyMs: number;
  rawText: string;
  responseJson: Record<string, unknown>;
}

export async function requestOpenAICompatibleJson<T>(input: {
  endpointUrl: string;
  apiKey: string;
  model: string;
  instructions: string;
  promptInput: string;
  schemaName: string;
  schema: Record<string, unknown>;
  metadata?: Record<string, string>;
  traceLabels?: {
    instructions?: string;
    input?: string;
    output?: string;
    error?: string;
  };
}): Promise<OpenAICompatibleJsonResponseResult<T>> {
  const startedAt = Date.now();
  const instructionLabel = input.traceLabels?.instructions ?? "Planner instructions";
  const promptInputLabel = input.traceLabels?.input ?? "Planner input";
  const outputLabel = input.traceLabels?.output ?? "Provider output";
  const errorLabel = input.traceLabels?.error ?? "Provider error";
  const requestBody = {
    model: input.model,
    instructions: input.instructions,
    input: input.promptInput,
    text: {
      format: {
        type: "json_schema",
        name: input.schemaName,
        strict: true,
        schema: input.schema,
      },
    },
    metadata: input.metadata ?? {},
  };

  let responseText = "";
  let responseJson: Record<string, unknown> | null = null;

  try {
    const response = await fetch(input.endpointUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      cache: "no-store",
    });

    responseText = await response.text();

    try {
      responseJson = responseText.trim().length > 0 ? (JSON.parse(responseText) as Record<string, unknown>) : {};
    } catch {
      responseJson = {
        raw: responseText,
      };
    }

    const latencyMs = Date.now() - startedAt;
    const rawOutputText = extractResponsesOutputText(responseJson ?? {});
    const trace: ModelAdapterTraceRecord = {
      prompt: buildTextTracePreview(instructionLabel, input.instructions, TRACE_LIMITS.prompt),
      input: buildTextTracePreview(promptInputLabel, input.promptInput, TRACE_LIMITS.input),
      output: buildTextTracePreview(outputLabel, rawOutputText, TRACE_LIMITS.output),
      error: response.ok
        ? null
        : buildTextTracePreview(
            errorLabel,
            typeof responseJson?.error === "object" && responseJson?.error
              ? JSON.stringify(responseJson.error, null, 2)
              : response.statusText || responseText || "Provider request failed.",
            TRACE_LIMITS.error,
          ),
      responseId: typeof responseJson?.id === "string" ? responseJson.id : null,
      finishReason:
        typeof responseJson?.status === "string"
          ? responseJson.status
          : typeof responseJson?.finish_reason === "string"
            ? responseJson.finish_reason
            : null,
      responseStatus: typeof responseJson?.status === "string" ? responseJson.status : String(response.status),
      usage: normalizeUsage(responseJson ?? {}),
    };

    if (!response.ok) {
      throw new ExternalProviderExecutionError(
        `Provider request failed with ${response.status} ${response.statusText}.`,
        { latencyMs, trace },
      );
    }

    if (!rawOutputText) {
      throw new ExternalProviderExecutionError("Provider response did not include any output text.", {
        latencyMs,
        trace,
      });
    }

    let parsed: T;

    try {
      parsed = JSON.parse(rawOutputText) as T;
    } catch {
      throw new ExternalProviderExecutionError("Provider output was not valid JSON.", {
        latencyMs,
        trace,
      });
    }

    return {
      parsed,
      trace,
      latencyMs,
      rawText: rawOutputText,
      responseJson: responseJson ?? {},
    };
  } catch (error) {
    if (error instanceof ExternalProviderExecutionError) {
      throw error;
    }

    const latencyMs = Date.now() - startedAt;
    const trace: ModelAdapterTraceRecord = {
      prompt: buildTextTracePreview(instructionLabel, input.instructions, TRACE_LIMITS.prompt),
      input: buildTextTracePreview(promptInputLabel, input.promptInput, TRACE_LIMITS.input),
      output: buildTextTracePreview(
        outputLabel,
        extractResponsesOutputText(responseJson ?? {}),
        TRACE_LIMITS.output,
      ),
      error: buildTextTracePreview(
        errorLabel,
        error instanceof Error ? error.message : "Provider request failed.",
        TRACE_LIMITS.error,
      ),
      responseId: typeof responseJson?.id === "string" ? responseJson.id : null,
      finishReason: typeof responseJson?.status === "string" ? responseJson.status : null,
      responseStatus: typeof responseJson?.status === "string" ? responseJson.status : null,
      usage: normalizeUsage(responseJson ?? {}),
    };

    throw new ExternalProviderExecutionError(
      error instanceof Error ? error.message : "Provider request failed.",
      { latencyMs, trace },
    );
  }
}
