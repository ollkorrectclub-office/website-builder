import type {
  GeneratedCodeScaffold,
  GeneratedVisualScaffold,
  ProjectCodeFileLinkRecord,
  ProjectCodeFileRecord,
  VisualPageRecord,
  VisualSectionRecord,
  VisualThemeTokens,
} from "@/lib/builder/types";
import type {
  AuthenticatedUserRecord,
  ProjectPermissionsRecord,
  PlanRevisionRecord,
  StructuredPlan,
  WorkspaceRecord,
  ProjectRecord,
  WorkspaceMemberRecord,
  WorkspacePermissionsRecord,
} from "@/lib/workspaces/types";
import type { ModelAdapterExecutionRecord } from "@/lib/model-adapters/types";

export type GenerationSource =
  | "deterministic_generator_v1"
  | "external_codegen_adapter_v1";
export type GenerationRunStatus = "completed" | "failed";
export type GenerationRunTrigger = "plan_approved" | "manual_rerun";
export type GenerationArtifactType =
  | "visual_scaffold_target"
  | "code_scaffold_target"
  | "theme_token_target"
  | "route_page_target";

export interface GenerationRouteTargetRecord {
  pageKey: string;
  title: string;
  slug: string;
  routePath: string;
  sectionCount: number;
}

export interface GenerationCodeFileTargetRecord {
  id: string;
  path: string;
  directory: string;
  name: string;
  extension: string;
  kind: ProjectCodeFileRecord["kind"];
  language: ProjectCodeFileRecord["language"];
  orderIndex: number;
  ownership: ProjectCodeFileRecord["ownership"];
  editPolicy: ProjectCodeFileRecord["editPolicy"];
  createdFromVisualPageId: string | null;
  createdFromSectionId: string | null;
  lineCount: number;
  content: string;
}

export interface GenerationCodeFileLinkTargetRecord {
  filePath: string;
  targetType: ProjectCodeFileLinkRecord["targetType"];
  role: ProjectCodeFileLinkRecord["role"];
  visualPageId: string | null;
  visualSectionId: string | null;
  targetLabel: string;
}

export interface GenerationCodeStateTargetRecord {
  activeFilePath: string;
  openFilePaths: string[];
  scaffoldSourceRevisionNumber: number;
}

export interface GenerationVisualPageTargetRecord {
  id: string;
  pageKey: VisualPageRecord["pageKey"];
  title: VisualPageRecord["title"];
  slug: VisualPageRecord["slug"];
  orderIndex: VisualPageRecord["orderIndex"];
  contentPayload: VisualPageRecord["contentPayload"];
}

export interface GenerationVisualSectionTargetRecord {
  id: string;
  pageId: string;
  sectionKey: VisualSectionRecord["sectionKey"];
  sectionType: VisualSectionRecord["sectionType"];
  title: VisualSectionRecord["title"];
  label: VisualSectionRecord["label"];
  orderIndex: VisualSectionRecord["orderIndex"];
  isVisible: VisualSectionRecord["isVisible"];
  contentPayload: VisualSectionRecord["contentPayload"];
  createdFromPlan: VisualSectionRecord["createdFromPlan"];
}

export interface GenerationOutputSummary {
  visualPageCount: number;
  visualSectionCount: number;
  routeCount: number;
  codeFileCount: number;
  componentFileCount: number;
  themeTokenCount: number;
}

export interface GenerationArtifactSpec {
  artifactType: GenerationArtifactType;
  label: string;
  payload: Record<string, unknown>;
}

export interface GenerationInput {
  workspace: WorkspaceRecord;
  project: ProjectRecord;
  revisions: PlanRevisionRecord[];
  approvedRevision: PlanRevisionRecord;
  currentUser: AuthenticatedUserRecord;
  membership: WorkspaceMemberRecord;
  workspacePermissions: WorkspacePermissionsRecord;
  projectPermissions: ProjectPermissionsRecord;
}

export interface GenerationResult {
  source: GenerationSource;
  trigger: GenerationRunTrigger;
  status: Extract<GenerationRunStatus, "completed">;
  summary: string;
  sourcePlanRevisionId: string;
  sourcePlanRevisionNumber: number;
  sourcePlanSnapshot: StructuredPlan;
  outputSummary: GenerationOutputSummary;
  routeTargets: GenerationRouteTargetRecord[];
  themeTarget: VisualThemeTokens;
  visualTarget: GeneratedVisualScaffold;
  codeTarget: GeneratedCodeScaffold;
  artifacts: GenerationArtifactSpec[];
}

export interface GenerationFailureResult {
  source: GenerationSource;
  trigger: GenerationRunTrigger;
  status: Extract<GenerationRunStatus, "failed">;
  summary: string;
  sourcePlanRevisionId: string;
  sourcePlanRevisionNumber: number;
  sourcePlanSnapshot: StructuredPlan;
  outputSummary: GenerationOutputSummary | null;
  errorMessage: string;
  artifacts: GenerationArtifactSpec[];
}

export interface GenerationAdapter {
  readonly source: GenerationSource;
  generate(input: GenerationInput, trigger: GenerationRunTrigger): Promise<GenerationResult>;
}

export interface GenerationService {
  generateApprovedTargets(input: GenerationInput): Promise<GenerationServiceResult>;
  rerunApprovedTargets(input: GenerationInput): Promise<GenerationServiceResult>;
}

export interface GenerationServiceResult {
  result: GenerationResult;
  adapterExecution: ModelAdapterExecutionRecord;
}

export interface GenerationRunRecord {
  id: string;
  projectId: string;
  workspaceId: string;
  sourcePlanRevisionId: string;
  sourcePlanRevisionNumber: number;
  sourcePlanSnapshot: StructuredPlan;
  source: GenerationSource;
  trigger: GenerationRunTrigger;
  status: GenerationRunStatus;
  summary: string;
  outputSummary: GenerationOutputSummary | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationArtifactRecord {
  id: string;
  generationRunId: string;
  projectId: string;
  workspaceId: string;
  artifactType: GenerationArtifactType;
  label: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface GenerationRunPersistenceInput {
  workspaceId: string;
  projectId: string;
  sourcePlanRevisionId: string;
  sourcePlanRevisionNumber: number;
  sourcePlanSnapshot: StructuredPlan;
  source: GenerationSource;
  trigger: GenerationRunTrigger;
  status: GenerationRunStatus;
  summary: string;
  outputSummary: GenerationOutputSummary | null;
  errorMessage?: string | null;
  startedAt: string;
  completedAt?: string | null;
  artifacts: GenerationArtifactSpec[];
}

export interface ProjectGenerationBundle {
  runs: GenerationRunRecord[];
  artifacts: GenerationArtifactRecord[];
  latestRun: GenerationRunRecord | null;
  latestArtifacts: GenerationArtifactRecord[];
}

export interface ProjectGenerationTargetBundle {
  run: GenerationRunRecord;
  artifacts: GenerationArtifactRecord[];
  routeTargets: GenerationRouteTargetRecord[];
  themeTarget: VisualThemeTokens;
  visualPages: GenerationVisualPageTargetRecord[];
  visualSections: GenerationVisualSectionTargetRecord[];
  codeState: GenerationCodeStateTargetRecord;
  codeFiles: GenerationCodeFileTargetRecord[];
  codeFileLinks: GenerationCodeFileLinkTargetRecord[];
}
