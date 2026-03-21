import type {
  PlannerSource,
  ProjectBriefFields,
  StructuredPlan,
} from "@/lib/workspaces/types";
import type { ModelAdapterExecutionRecord } from "@/lib/model-adapters/types";

export type PlannerRunStatus = "completed" | "failed";
export type PlannerRunTrigger = "project_create" | "project_rerun";
export type PlannerArtifactType =
  | "normalized_brief"
  | "planning_signals"
  | "plan_payload";

export type PlannerInput = ProjectBriefFields;

export interface PlannerArtifactSpec {
  artifactType: PlannerArtifactType;
  label: string;
  payload: Record<string, unknown>;
}

export interface PlannerResult {
  plan: StructuredPlan;
  source: PlannerSource;
  summary: string;
  status: Extract<PlannerRunStatus, "completed">;
  artifacts: PlannerArtifactSpec[];
}

export interface PlannerFailureResult {
  source: PlannerSource;
  status: Extract<PlannerRunStatus, "failed">;
  summary: string;
  errorMessage: string;
  artifacts: PlannerArtifactSpec[];
}

export interface PlannerAdapter {
  readonly source: PlannerSource;
  plan(input: PlannerInput, trigger: PlannerRunTrigger): Promise<PlannerResult>;
}

export interface PlannerService {
  generateInitialPlan(input: PlannerInput): Promise<PlannerServiceResult>;
  rerunPlan(input: PlannerInput): Promise<PlannerServiceResult>;
}

export interface PlannerServiceResult {
  result: PlannerResult;
  adapterExecution: ModelAdapterExecutionRecord;
}

export interface PlannerRunRecord {
  id: string;
  projectId: string;
  workspaceId: string;
  briefId: string | null;
  briefUpdatedAt: string | null;
  source: PlannerSource;
  trigger: PlannerRunTrigger;
  status: PlannerRunStatus;
  summary: string;
  inputSnapshot: PlannerInput;
  outputPlan: StructuredPlan | null;
  generatedPlanRevisionId: string | null;
  generatedPlanRevisionNumber: number | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerArtifactRecord {
  id: string;
  plannerRunId: string;
  projectId: string;
  workspaceId: string;
  artifactType: PlannerArtifactType;
  label: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface PlannerRunPersistenceInput {
  workspaceId: string;
  projectId: string;
  briefId?: string | null;
  briefUpdatedAt?: string | null;
  source: PlannerSource;
  trigger: PlannerRunTrigger;
  status: PlannerRunStatus;
  summary: string;
  inputSnapshot: PlannerInput;
  outputPlan: StructuredPlan | null;
  generatedPlanRevisionId?: string | null;
  generatedPlanRevisionNumber?: number | null;
  errorMessage?: string | null;
  startedAt: string;
  completedAt?: string | null;
  artifacts: PlannerArtifactSpec[];
}

export interface ProjectPlannerBundle {
  runs: PlannerRunRecord[];
  artifacts: PlannerArtifactRecord[];
  latestRun: PlannerRunRecord | null;
  latestArtifacts: PlannerArtifactRecord[];
}
