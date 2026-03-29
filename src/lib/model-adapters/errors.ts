import type {
  ModelAdapterExecutionRecord,
  ModelAdapterTraceRecord,
} from "@/lib/model-adapters/types";

export type ExternalProviderErrorClassification =
  | "config"
  | "timeout"
  | "http_error"
  | "transport_error"
  | "empty_output"
  | "invalid_json"
  | "invalid_output";

export class ModelAdapterExecutionError extends Error {
  readonly execution: ModelAdapterExecutionRecord;

  constructor(message: string, execution: ModelAdapterExecutionRecord) {
    super(message);
    this.name = "ModelAdapterExecutionError";
    this.execution = execution;
  }
}

export class ExternalProviderExecutionError extends Error {
  readonly latencyMs: number | null;
  readonly trace: ModelAdapterTraceRecord | null;
  readonly classification: ExternalProviderErrorClassification;
  readonly statusCode: number | null;
  readonly providerMessage: string | null;

  constructor(
    message: string,
    options?: {
      latencyMs?: number | null;
      trace?: ModelAdapterTraceRecord | null;
      classification?: ExternalProviderErrorClassification;
      statusCode?: number | null;
      providerMessage?: string | null;
    },
  ) {
    super(message);
    this.name = "ExternalProviderExecutionError";
    this.latencyMs = options?.latencyMs ?? null;
    this.trace = options?.trace ?? null;
    this.classification = options?.classification ?? "transport_error";
    this.statusCode = options?.statusCode ?? null;
    this.providerMessage = options?.providerMessage ?? null;
  }
}
