import type { BuilderContextRecord, BuilderRefreshSurface, ProjectCodeBundle, ProjectVisualBundle } from "@/lib/builder/types";
import type { RuntimePreviewBundle, RuntimePreviewSource } from "@/lib/builder/runtime-preview";
import type { ProjectGenerationBundle } from "@/lib/generation/types";
import type { PlanRevisionRecord, StructuredPlan } from "@/lib/workspaces/types";

export type DeployTargetType = "internal_snapshot_v1";
export type DeployTargetStatus = "idle" | "snapshot_ready" | "failed";
export type DeployRunStatus = "completed" | "failed";
export type DeployRunTrigger = "publish_requested";
export type DeploySource = "deterministic_deployer_v1";
export type DeployAdapterKey =
  | "static_snapshot_v1"
  | "vercel_deploy_api_v1"
  | "netlify_bundle_handoff_v1"
  | "container_release_handoff_v1";
export type DeployAdapterPresetKey =
  | "custom"
  | "vercel_nextjs"
  | "netlify_static"
  | "container_node";
export type DeployReleaseStatus = "promoted" | "handoff_ready" | "exported";
export type DeployReadinessCheckScope = "target" | "handoff" | "export" | "execution";
export type DeployReadinessCheckSeverity = "pass" | "warning" | "blocking";
export type DeployHandoffRunStatus = "blocked" | "completed" | "failed";
export type DeployHandoffSimulationSource = "hosting_adapter_simulator_v1";
export type DeployExecutionRunStatus = "blocked" | "submitted" | "ready" | "failed";
export type DeployExecutionSource = "vercel_deploy_api_v1" | "unsupported_hosting_adapter_v1";
export type DeployExecutionProviderKey = "vercel";
export type DeployHandoffLogLevel = "info" | "warning" | "error";
export type DeployExecutionLogLevel = DeployHandoffLogLevel;
export type DeployArtifactType =
  | "deploy_snapshot_manifest"
  | "deploy_route_bundle"
  | "deploy_theme_bundle"
  | "deploy_output_package";
export type DeployTargetValidationField =
  | "primaryDomain"
  | "environmentKey"
  | "outputDirectory"
  | "installCommand"
  | "buildCommand"
  | "startCommand"
  | "nodeVersion"
  | "envContract"
  | "adapterConfig";
export type DeployTargetValidationIssueKind =
  | "required"
  | "invalid_domain"
  | "invalid_slug"
  | "invalid_command"
  | "duplicate_key"
  | "invalid_env_key"
  | "missing_description"
  | "missing_required_env";

export interface DeployEnvContractVariableRecord {
  key: string;
  required: boolean;
  description: string;
}

export interface DeployAdapterConfigRecord {
  key: string;
  value: string;
}

export interface DeployTargetSettingsRecord {
  adapterPresetKey: DeployAdapterPresetKey;
  adapterKey: DeployAdapterKey;
  environmentKey: string;
  primaryDomain: string;
  outputDirectory: string;
  installCommand: string;
  buildCommand: string;
  startCommand: string;
  nodeVersion: string;
  envContract: DeployEnvContractVariableRecord[];
  adapterConfig: DeployAdapterConfigRecord[];
}

export interface DeployTargetValidationIssueRecord {
  field: DeployTargetValidationField;
  kind: DeployTargetValidationIssueKind;
  key?: string | null;
}

export interface DeployTargetValidationResult {
  isValid: boolean;
  issues: DeployTargetValidationIssueRecord[];
}

export interface DeployReleaseReadinessCheckRecord {
  id: string;
  scope: DeployReadinessCheckScope;
  severity: DeployReadinessCheckSeverity;
  title: string;
  detail: string;
}

export interface DeployReleaseReadinessResult {
  isReady: boolean;
  blockingCount: number;
  warningCount: number;
  checkedAt: string;
  checks: DeployReleaseReadinessCheckRecord[];
}

export interface DeployHandoffLogRecord {
  id: string;
  level: DeployHandoffLogLevel;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DeployExecutionTraceRecord {
  requestId: string | null;
  deploymentId: string | null;
  deploymentUrl: string | null;
  deploymentInspectorUrl: string | null;
  providerStatus: string | null;
  httpStatus: number | null;
  metadata: Record<string, unknown>;
}

export interface DeployExecutionLogRecord {
  id: string;
  level: DeployExecutionLogLevel;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DeployExecutionStatusTransitionRecord {
  id: string;
  fromStatus: DeployExecutionRunStatus | null;
  toStatus: DeployExecutionRunStatus;
  fromProviderStatus: string | null;
  toProviderStatus: string | null;
  summary: string;
  createdAt: string;
}

export interface HostedDeploymentRecord {
  providerKey: DeployExecutionProviderKey;
  providerLabel: string;
  requestedAdapterPresetKey: DeployAdapterPresetKey;
  actualAdapterKey: DeployExecutionSource;
  deployRunId: string;
  releaseId: string;
  executionRunId: string;
  providerDeploymentId: string | null;
  hostedUrl: string | null;
  hostedInspectionUrl: string | null;
  primaryDomain: string;
  environmentKey: string;
  providerStatus: string | null;
  readyAt: string;
  updatedAt: string;
}

export interface DeployThemeVariableRecord {
  tokenKey: string;
  cssVariable: string;
  value: string;
}

export interface DeployRouteSectionRecord {
  id: string;
  sectionKey: string;
  title: string;
  label: string;
  sectionType: string;
  isVisible: boolean;
}

export interface DeployRouteSnapshotRecord {
  pageId: string;
  pageKey: string;
  title: string;
  slug: string;
  browserPath: string;
  routeFilePath: string | null;
  layoutFilePath: string | null;
  contentFilePath: string | null;
  sectionCount: number;
  visibleSectionCount: number;
  hiddenSectionCount: number;
  sections: DeployRouteSectionRecord[];
}

export interface DeployOutputFileRecord {
  path: string;
  kind: string;
  language: string;
  ownership: string;
  revisionNumber: number;
  bytes: number;
  content: string;
}

export interface DeployOutputSummary {
  routeCount: number;
  pageCount: number;
  sectionCount: number;
  fileCount: number;
  themeTokenCount: number;
  surfacesBehindApproved: BuilderRefreshSurface[];
}

export interface DeployArtifactSpec {
  artifactType: DeployArtifactType;
  label: string;
  payload: Record<string, unknown>;
}

export interface DeployInput {
  context: BuilderContextRecord;
  revisions: PlanRevisionRecord[];
  approvedRevision: PlanRevisionRecord;
  visualBundle: ProjectVisualBundle;
  codeBundle: ProjectCodeBundle;
  generationBundle: ProjectGenerationBundle | null;
  runtimeBundle: RuntimePreviewBundle;
}

export interface DeployResult {
  source: DeploySource;
  trigger: DeployRunTrigger;
  status: Extract<DeployRunStatus, "completed">;
  summary: string;
  sourcePlanRevisionId: string;
  sourcePlanRevisionNumber: number;
  sourcePlanSnapshot: StructuredPlan;
  sourceVisualRevisionNumber: number;
  sourceCodeRevisionNumber: number;
  sourceGenerationRunId: string | null;
  runtimeSource: RuntimePreviewSource;
  outputSummary: DeployOutputSummary;
  artifacts: DeployArtifactSpec[];
}

export interface DeployFailureResult {
  source: DeploySource;
  trigger: DeployRunTrigger;
  status: Extract<DeployRunStatus, "failed">;
  summary: string;
  sourcePlanRevisionId: string;
  sourcePlanRevisionNumber: number;
  sourcePlanSnapshot: StructuredPlan;
  sourceVisualRevisionNumber: number;
  sourceCodeRevisionNumber: number;
  sourceGenerationRunId: string | null;
  runtimeSource: RuntimePreviewSource;
  outputSummary: DeployOutputSummary | null;
  errorMessage: string;
  artifacts: DeployArtifactSpec[];
}

export interface DeployAdapter {
  readonly source: DeploySource;
  deploy(input: DeployInput, trigger: DeployRunTrigger): Promise<DeployResult>;
}

export interface DeployService {
  createDeploySnapshot(input: DeployInput): Promise<DeployResult>;
}

export interface DeployTargetRecord {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  targetType: DeployTargetType;
  status: DeployTargetStatus;
  settings: DeployTargetSettingsRecord;
  latestDeployRunId: string | null;
  latestDeployRunStatus: DeployRunStatus | null;
  latestPlanRevisionId: string | null;
  latestPlanRevisionNumber: number | null;
  latestVisualRevisionNumber: number | null;
  latestCodeRevisionNumber: number | null;
  latestGenerationRunId: string | null;
  latestRuntimeSource: RuntimePreviewSource | null;
  latestSummary: string | null;
  latestReleaseId: string | null;
  latestReleaseName: string | null;
  latestReleaseNumber: number | null;
  latestExecutionRunId: string | null;
  latestExecutionRunStatus: DeployExecutionRunStatus | null;
  hostedDeployment: HostedDeploymentRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeployRunRecord {
  id: string;
  deployTargetId: string;
  projectId: string;
  workspaceId: string;
  sourcePlanRevisionId: string;
  sourcePlanRevisionNumber: number;
  sourcePlanSnapshot: StructuredPlan;
  sourceVisualRevisionNumber: number;
  sourceCodeRevisionNumber: number;
  sourceGenerationRunId: string | null;
  runtimeSource: RuntimePreviewSource;
  source: DeploySource;
  trigger: DeployRunTrigger;
  status: DeployRunStatus;
  summary: string;
  outputSummary: DeployOutputSummary | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeployArtifactRecord {
  id: string;
  deployRunId: string;
  deployTargetId: string;
  projectId: string;
  workspaceId: string;
  artifactType: DeployArtifactType;
  label: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface DeployReleaseHandoffPayloadRecord {
  adapterPresetKey: DeployAdapterPresetKey;
  adapterKey: DeployAdapterKey;
  environmentKey: string;
  primaryDomain: string;
  outputDirectory: string;
  nodeVersion: string;
  commands: {
    install: string;
    build: string;
    start: string;
  };
  envContract: DeployEnvContractVariableRecord[];
  adapterConfig: DeployAdapterConfigRecord[];
  release: {
    id: string;
    name: string;
    releaseNumber: number;
    status: DeployReleaseStatus;
  };
  deployRun: {
    id: string;
    status: DeployRunStatus;
    summary: string;
    sourcePlanRevisionNumber: number;
    sourceVisualRevisionNumber: number;
    sourceCodeRevisionNumber: number;
    sourceGenerationRunId: string | null;
    runtimeSource: RuntimePreviewSource;
  };
  artifactSummary: {
    artifactCount: number;
    routeCount: number;
    fileCount: number;
    themeTokenCount: number;
    artifactTypes: DeployArtifactType[];
  };
  artifactReferences: Array<{
    artifactType: DeployArtifactType;
    label: string;
  }>;
  preparedAt: string;
}

export interface DeployReleaseExportSnapshotRecord {
  schemaVersion: "release-export-v1";
  generatedAt: string;
  deployTarget: {
    id: string;
    name: string;
    targetType: DeployTargetType;
    settings: DeployTargetSettingsRecord;
  };
  release: {
    id: string;
    name: string;
    notes: string;
    releaseNumber: number;
    status: DeployReleaseStatus;
    sourcePlanRevisionNumber: number;
    sourceVisualRevisionNumber: number;
    sourceCodeRevisionNumber: number;
    sourceGenerationRunId: string | null;
    runtimeSource: RuntimePreviewSource;
  };
  deployRun: {
    id: string;
    summary: string;
    status: DeployRunStatus;
    startedAt: string;
    completedAt: string | null;
    outputSummary: DeployOutputSummary | null;
  };
  handoff: DeployReleaseHandoffPayloadRecord;
  artifacts: Array<{
    artifactType: DeployArtifactType;
    label: string;
    payload: Record<string, unknown>;
  }>;
}

export interface DeployReleaseRecord {
  id: string;
  deployTargetId: string;
  deployRunId: string;
  workspaceId: string;
  projectId: string;
  releaseNumber: number;
  name: string;
  notes: string;
  status: DeployReleaseStatus;
  sourcePlanRevisionId: string;
  sourcePlanRevisionNumber: number;
  sourceVisualRevisionNumber: number;
  sourceCodeRevisionNumber: number;
  sourceGenerationRunId: string | null;
  runtimeSource: RuntimePreviewSource;
  promotedByUserId: string | null;
  handoffPayload: DeployReleaseHandoffPayloadRecord | null;
  exportSnapshot: DeployReleaseExportSnapshotRecord | null;
  exportFileName: string | null;
  handoffPreparedAt: string | null;
  exportedAt: string | null;
  latestExecutionRunId: string | null;
  latestExecutionStatus: DeployExecutionRunStatus | null;
  hostedDeployment: HostedDeploymentRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeployHandoffRunRecord {
  id: string;
  deployTargetId: string;
  deployRunId: string;
  releaseId: string;
  workspaceId: string;
  projectId: string;
  source: DeployHandoffSimulationSource;
  adapterPresetKey: DeployAdapterPresetKey;
  adapterKey: DeployAdapterKey;
  status: DeployHandoffRunStatus;
  summary: string;
  readinessSummary: DeployReleaseReadinessResult;
  logs: DeployHandoffLogRecord[];
  primaryDomain: string;
  environmentKey: string;
  exportFileName: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeployExecutionRunRecord {
  id: string;
  deployTargetId: string;
  deployRunId: string;
  releaseId: string;
  workspaceId: string;
  projectId: string;
  requestedAdapterPresetKey: DeployAdapterPresetKey;
  requestedAdapterKey: DeployAdapterKey;
  actualAdapterKey: DeployExecutionSource;
  providerKey: DeployExecutionProviderKey | null;
  providerLabel: string | null;
  status: DeployExecutionRunStatus;
  summary: string;
  readinessSummary: DeployReleaseReadinessResult;
  logs: DeployExecutionLogRecord[];
  statusTransitions: DeployExecutionStatusTransitionRecord[];
  providerResponse: DeployExecutionTraceRecord | null;
  latestProviderStatus: string | null;
  hostedUrl: string | null;
  hostedInspectionUrl: string | null;
  providerDeploymentId: string | null;
  primaryDomain: string;
  environmentKey: string;
  lastCheckedAt: string | null;
  retryOfExecutionRunId: string | null;
  attemptNumber: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeployRunPersistenceInput {
  deployTargetId: string;
  workspaceId: string;
  projectId: string;
  sourcePlanRevisionId: string;
  sourcePlanRevisionNumber: number;
  sourcePlanSnapshot: StructuredPlan;
  sourceVisualRevisionNumber: number;
  sourceCodeRevisionNumber: number;
  sourceGenerationRunId: string | null;
  runtimeSource: RuntimePreviewSource;
  source: DeploySource;
  trigger: DeployRunTrigger;
  status: DeployRunStatus;
  summary: string;
  outputSummary: DeployOutputSummary | null;
  errorMessage?: string | null;
  startedAt: string;
  completedAt?: string | null;
  artifacts: DeployArtifactSpec[];
}

export interface UpdateDeployTargetSettingsInput {
  targetId: string;
  settings: DeployTargetSettingsRecord;
}

export interface ApplyDeployTargetPresetInput {
  targetId: string;
  presetKey: Exclude<DeployAdapterPresetKey, "custom">;
}

export interface PromoteDeployReleaseInput {
  deployTargetId: string;
  deployRunId: string;
  workspaceId: string;
  projectId: string;
  name: string;
  notes: string;
  promotedByUserId: string | null;
}

export interface PrepareDeployReleaseHandoffInput {
  releaseId: string;
}

export interface ExportDeployReleaseInput {
  releaseId: string;
}

export interface ExecuteDeployReleaseHandoffSimulationInput {
  releaseId: string;
}

export interface ExecuteDeployReleaseInput {
  releaseId: string;
}

export interface RecheckDeployExecutionRunInput {
  executionRunId: string;
}

export interface RetryDeployExecutionRunInput {
  executionRunId: string;
}

export interface DeployReleaseExportResult {
  release: DeployReleaseRecord;
  content: string;
  fileName: string;
}

export interface ProjectDeployAcceptedStateRecord {
  approvedPlanRevisionId: string | null;
  approvedPlanRevisionNumber: number | null;
  visualRevisionNumber: number | null;
  codeRevisionNumber: number | null;
  runtimeSource: RuntimePreviewSource | "unavailable";
  generationRunId: string | null;
  routeCount: number;
  pageCount: number;
  sectionCount: number;
  fileCount: number;
  themeTokenCount: number;
  pendingQueueCount: number;
  deferredQueueCount: number;
  staleQueueCount: number;
  completedQueueCount: number;
  surfacesBehindApproved: BuilderRefreshSurface[];
  readyToPublish: boolean;
}

export interface ProjectDeployBundle extends BuilderContextRecord {
  revisions: PlanRevisionRecord[];
  target: DeployTargetRecord;
  runs: DeployRunRecord[];
  artifacts: DeployArtifactRecord[];
  releases: DeployReleaseRecord[];
  handoffRuns: DeployHandoffRunRecord[];
  executionRuns: DeployExecutionRunRecord[];
  latestRun: DeployRunRecord | null;
  latestArtifacts: DeployArtifactRecord[];
  latestRelease: DeployReleaseRecord | null;
  latestHandoffRun: DeployHandoffRunRecord | null;
  latestExecutionRun: DeployExecutionRunRecord | null;
  acceptedState: ProjectDeployAcceptedStateRecord;
}
