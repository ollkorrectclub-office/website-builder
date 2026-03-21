import type {
  ModelAdapterExecutionRecord,
  ModelAdapterTraceRecord,
} from "@/lib/model-adapters/types";

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

  constructor(message: string, options?: { latencyMs?: number | null; trace?: ModelAdapterTraceRecord | null }) {
    super(message);
    this.name = "ExternalProviderExecutionError";
    this.latencyMs = options?.latencyMs ?? null;
    this.trace = options?.trace ?? null;
  }
}
