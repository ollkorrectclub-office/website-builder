export type ModelAdapterCapability = "planning" | "generation" | "patch_suggestion";
export type ModelAdapterSelection = "deterministic_internal" | "external_model";
export type ModelAdapterSourceType = "deterministic_internal" | "external_model";
export type ModelAdapterExecutionMode = "selected" | "fallback";
export type ModelAdapterRunStatus = "completed" | "failed";
export type ExternalModelProviderKey = "openai_compatible" | "custom_http";
export type ModelAdapterTraceFormat = "text" | "json";
export type ModelAdapterHealthStatus =
  | "deterministic_only"
  | "config_incomplete"
  | "env_missing"
  | "ready_to_verify"
  | "verified"
  | "verification_failed";

export interface ModelAdapterTracePreviewRecord {
  label: string;
  format: ModelAdapterTraceFormat;
  preview: string;
  charCount: number;
  truncated: boolean;
}

export interface ModelAdapterUsageRecord {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface ModelAdapterTraceRecord {
  prompt: ModelAdapterTracePreviewRecord | null;
  input: ModelAdapterTracePreviewRecord | null;
  output: ModelAdapterTracePreviewRecord | null;
  error: ModelAdapterTracePreviewRecord | null;
  responseId: string | null;
  finishReason: string | null;
  responseStatus: string | null;
  usage: ModelAdapterUsageRecord | null;
}

export interface ProjectModelAdapterConfigRecord {
  id: string;
  workspaceId: string;
  projectId: string;
  planningSelection: ModelAdapterSelection;
  generationSelection: ModelAdapterSelection;
  patchSelection: ModelAdapterSelection;
  externalProviderKey: ExternalModelProviderKey | null;
  externalProviderLabel: string | null;
  externalEndpointUrl: string | null;
  externalApiKeyEnvVar: string | null;
  planningModel: string | null;
  generationModel: string | null;
  patchModel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveProjectModelAdapterConfigInput {
  workspaceId: string;
  projectId: string;
  planningSelection: ModelAdapterSelection;
  generationSelection: ModelAdapterSelection;
  patchSelection: ModelAdapterSelection;
  externalProviderKey: ExternalModelProviderKey | null;
  externalProviderLabel: string | null;
  externalEndpointUrl: string | null;
  externalApiKeyEnvVar: string | null;
  planningModel: string | null;
  generationModel: string | null;
  patchModel: string | null;
}

export interface ResolvedCapabilityAdapterConfig {
  capability: ModelAdapterCapability;
  selection: ModelAdapterSelection;
  sourceType: ModelAdapterSourceType;
  providerKey: ExternalModelProviderKey | null;
  providerLabel: string | null;
  endpointUrl: string | null;
  apiKeyEnvVar: string | null;
  modelName: string | null;
  externalReady: boolean;
  missingFields: string[];
}

export interface ModelAdapterExecutionRecord {
  capability: ModelAdapterCapability;
  requestedSelection: ModelAdapterSelection;
  executedSelection: ModelAdapterSelection;
  sourceType: ModelAdapterSourceType;
  executionMode: ModelAdapterExecutionMode;
  requestedAdapterKey: string;
  executedAdapterKey: string;
  providerKey: ExternalModelProviderKey | null;
  providerLabel: string | null;
  modelName: string | null;
  endpointUrl: string | null;
  latencyMs: number | null;
  trace: ModelAdapterTraceRecord | null;
  fallbackReason: string | null;
  summary: string;
  metadata: Record<string, unknown>;
}

export interface ModelAdapterRunRecord extends ModelAdapterExecutionRecord {
  id: string;
  workspaceId: string;
  projectId: string;
  status: ModelAdapterRunStatus;
  trigger: string;
  linkedEntityType: "planner_run" | "generation_run" | "patch_proposal" | null;
  linkedEntityId: string | null;
  retryOfRunId: string | null;
  attemptNumber: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModelAdapterRunPersistenceInput extends ModelAdapterExecutionRecord {
  id?: string;
  workspaceId: string;
  projectId: string;
  status: ModelAdapterRunStatus;
  trigger: string;
  linkedEntityType: "planner_run" | "generation_run" | "patch_proposal" | null;
  linkedEntityId: string | null;
  retryOfRunId?: string | null;
  attemptNumber?: number;
  errorMessage?: string | null;
  startedAt: string;
  completedAt?: string | null;
}

export interface ModelAdapterCapabilityHealthRecord {
  capability: ModelAdapterCapability;
  selection: ModelAdapterSelection;
  status: ModelAdapterHealthStatus;
  summary: string;
  missingFields: string[];
  apiKeyEnvVar: string | null;
  providerKey: ExternalModelProviderKey | null;
  providerLabel: string | null;
  modelName: string | null;
  latestRun: ModelAdapterRunRecord | null;
  latestVerificationRun: ModelAdapterRunRecord | null;
}

export interface ProjectModelAdapterBundle {
  config: ProjectModelAdapterConfigRecord;
  runs: ModelAdapterRunRecord[];
  latestRunByCapability: Record<ModelAdapterCapability, ModelAdapterRunRecord | null>;
  latestVerificationRunByCapability: Record<ModelAdapterCapability, ModelAdapterRunRecord | null>;
  healthByCapability: Record<ModelAdapterCapability, ModelAdapterCapabilityHealthRecord>;
}
