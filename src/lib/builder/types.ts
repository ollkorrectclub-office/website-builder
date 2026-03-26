import type { Locale } from "@/lib/i18n/locales";
import type {
  AuthenticatedUserRecord,
  PlanRevisionRecord,
  PlanSectionKey,
  ProjectPermissionsRecord,
  ProjectRecord,
  WorkspaceMemberRecord,
  WorkspacePermissionsRecord,
  WorkspaceRecord,
} from "@/lib/workspaces/types";

export type BuilderTabKey = "plan" | "visual" | "code" | "preview";
export type PreviewDevice = "desktop" | "tablet" | "mobile";
export type AuditTimelineSource = "plan" | "visual" | "code" | "preview" | "deploy";
export type AuditTimelineFilterSource = "all" | AuditTimelineSource;
export type BuilderRefreshSurface = "visual" | "code";
export type BuilderImpactSurface = BuilderRefreshSurface | "preview";
export type BuilderRefreshQueueStatus = "pending" | "deferred" | "stale" | "completed";
export type BuilderRefreshQueueReason = "plan_promotion" | "generation_run";
export type BuilderImpactSurfaceStatus =
  | "not_initialized"
  | "current"
  | "refresh_pending"
  | "refresh_blocked";
export type PlanCandidateDiffKind = "text" | "list";
export type VisualSectionType =
  | "hero"
  | "features"
  | "testimonials"
  | "pricing"
  | "faq"
  | "contact"
  | "navbar"
  | "footer"
  | "custom_generic";

export interface BuilderContextRecord {
  workspace: WorkspaceRecord;
  project: ProjectRecord;
  latestRevision: PlanRevisionRecord;
  currentUser: AuthenticatedUserRecord;
  membership: WorkspaceMemberRecord;
  workspacePermissions: WorkspacePermissionsRecord;
  projectPermissions: ProjectPermissionsRecord;
}

export interface BuilderTabItem {
  key: BuilderTabKey;
  href: string;
  label: string;
  description: string;
}

export interface VisualThemeTokens {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  headingFontLabel: string;
  radiusScale: string;
  spacingScale: string;
}

export interface VisualStateRecord {
  id: string;
  projectId: string;
  activePageId: string;
  themeTokens: VisualThemeTokens;
  scaffoldSourceRevisionNumber: number;
  manualChanges: boolean;
  lastScaffoldAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface VisualPageRecord {
  id: string;
  visualStateId: string;
  projectId: string;
  pageKey: string;
  title: string;
  slug: string;
  orderIndex: number;
  contentPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface VisualSectionContentPayload {
  eyebrow?: string;
  body?: string;
  items?: string[];
  ctaLabel?: string;
}

export interface VisualSectionRecord {
  id: string;
  visualStateId: string;
  projectId: string;
  pageId: string;
  sectionKey: string;
  sectionType: VisualSectionType;
  title: string;
  label: string;
  orderIndex: number;
  isVisible: boolean;
  contentPayload: VisualSectionContentPayload;
  createdFromPlan: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VisualSyncState {
  sourceRevisionNumber: number;
  sourceRevisionState: PlanRevisionRecord["state"];
  latestRevisionNumber: number;
  approvedRevisionNumber: number | null;
  hasManualChanges: boolean;
  needsRegeneration: boolean;
}

export interface ProjectVisualBundle extends BuilderContextRecord {
  revisions: PlanRevisionRecord[];
  visualState: VisualStateRecord;
  visualPages: VisualPageRecord[];
  visualSections: VisualSectionRecord[];
  syncState: VisualSyncState;
  sourceRevision: PlanRevisionRecord;
}

export interface CreateVisualScaffoldInput {
  project: ProjectRecord;
  revisions: PlanRevisionRecord[];
  existingState?: VisualStateRecord | null;
  existingTokens?: VisualThemeTokens | null;
  preferredRevisionNumber?: number | null;
}

export interface GeneratedVisualScaffold {
  visualState: VisualStateRecord;
  visualPages: VisualPageRecord[];
  visualSections: VisualSectionRecord[];
  sourceRevision: PlanRevisionRecord;
}

export interface UpdateVisualSectionInput {
  visualStateId: string;
  sectionId: string;
  title: string;
  label: string;
  body: string;
  items: string[];
  isVisible: boolean;
}

export interface MoveVisualSectionInput {
  visualStateId: string;
  sectionId: string;
  direction: "up" | "down";
}

export interface UpdateVisualThemeTokensInput {
  visualStateId: string;
  tokens: VisualThemeTokens;
}

export type CodeFileKind =
  | "route"
  | "component"
  | "config"
  | "style"
  | "data"
  | "integration";
export type CodeFileLanguage = "tsx" | "ts" | "css" | "json";
export type CodeFileOwnership = "visual_owned" | "scaffold_owned";
export type CodeFileEditPolicy = "locked" | "single_file_draft";
export type CodeFileRevisionKind = "scaffold" | "saved" | "synced" | "restored";
export type CodeFileLinkTargetType = "global" | "page" | "section";
export type CodeFileLinkRole =
  | "layout_shell"
  | "route_page"
  | "section_renderer"
  | "section_component"
  | "project_content"
  | "theme_tokens"
  | "theme_styles";
export type CodeFileSyncStatus =
  | "unlinked"
  | "current"
  | "visual_managed"
  | "refresh_available"
  | "refresh_blocked";
export type CodePatchProposalStatus = "pending" | "applied" | "rejected" | "stale";
export type CodePatchProposalSource =
  | "mock_assistant"
  | "external_patch_adapter_v1";
export type CodeRestoreTargetType = "revision" | "scaffold";
export type AuditTimelineEventKind =
  | "planner_run"
  | "generation_run"
  | "refresh_queue_created"
  | "brief_updated"
  | "plan_revision"
  | "plan_candidate_promoted"
  | "refresh_queue_deferred"
  | "refresh_queue_stale"
  | "refresh_queue_completed"
  | "visual_scaffold"
  | "visual_section_updated"
  | "visual_section_reordered"
  | "visual_theme_updated"
  | "code_revision"
  | "code_restore"
  | "code_refresh"
  | "proposal_applied"
  | "proposal_rejected"
  | "proposal_stale"
  | "proposal_archived"
  | "deploy_run"
  | "deploy_target_updated"
  | "deploy_release_promoted"
  | "deploy_release_handoff_prepared"
  | "deploy_release_exported"
  | "deploy_handoff_run"
  | "deploy_execution_run"
  | "deploy_execution_rechecked"
  | "deploy_execution_retried"
  | "adapter_config_updated"
  | "model_adapter_run"
  | "project_owner_reassigned"
  | "preview_state";
export type AuditTimelineActorType = "system" | "user" | "assistant" | "runtime";

export interface CodeWorkspaceStateRecord {
  id: string;
  projectId: string;
  activeFilePath: string;
  openFilePaths: string[];
  scaffoldSourceRevisionNumber: number;
  sourceVisualUpdatedAt: string;
  manualChanges: boolean;
  lastGeneratedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCodeFileRecord {
  id: string;
  codeStateId: string;
  projectId: string;
  path: string;
  directory: string;
  name: string;
  extension: string;
  kind: CodeFileKind;
  language: CodeFileLanguage;
  orderIndex: number;
  ownership: CodeFileOwnership;
  editPolicy: CodeFileEditPolicy;
  content: string;
  currentRevisionId: string;
  currentRevisionNumber: number;
  draftContent: string | null;
  draftUpdatedAt: string | null;
  draftBaseRevisionId: string | null;
  draftBaseRevisionNumber: number | null;
  createdFromVisualPageId: string | null;
  createdFromSectionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCodeFileRevisionRecord {
  id: string;
  fileId: string;
  projectId: string;
  revisionNumber: number;
  kind: CodeFileRevisionKind;
  content: string;
  changeSummary: string;
  authoredBy: "system" | "user";
  baseRevisionId: string | null;
  baseRevisionNumber: number | null;
  sourceProposalId: string | null;
  sourceProposalTitle: string | null;
  restoreSource: CodeRestoreTargetType | null;
  restoredFromRevisionId: string | null;
  restoredFromRevisionNumber: number | null;
  createdAt: string;
}

export interface ProjectCodeFileLinkRecord {
  id: string;
  fileId: string;
  projectId: string;
  visualStateId: string;
  targetType: CodeFileLinkTargetType;
  role: CodeFileLinkRole;
  visualPageId: string | null;
  visualSectionId: string | null;
  targetLabel: string;
  createdAt: string;
}

export interface ProjectCodePatchProposalRecord {
  id: string;
  codeStateId: string;
  fileId: string;
  projectId: string;
  filePath: string;
  title: string;
  requestPrompt: string;
  rationale: string;
  changeSummary: string;
  status: CodePatchProposalStatus;
  source: CodePatchProposalSource;
  baseRevisionId: string | null;
  baseRevisionNumber: number | null;
  baseContent: string;
  proposedContent: string;
  resolvedRevisionId: string | null;
  invalidatedByRevisionId: string | null;
  invalidatedByRevisionNumber: number | null;
  resolutionNote: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CodeRefreshCandidateRecord {
  fileId: string;
  path: string;
  content: string;
  sourceRevisionNumber: number;
  sourceVisualUpdatedAt: string;
}

export interface CodeFileSyncRecord {
  fileId: string;
  path: string;
  status: CodeFileSyncStatus;
  needsSync: boolean;
  safeToRefresh: boolean;
  requiresConfirmation: boolean;
  hasManualChanges: boolean;
  linkCount: number;
  linkedPageIds: string[];
  linkedSectionIds: string[];
  targetLabels: string[];
}

export interface CodeWorkspaceTreeNode {
  path: string;
  name: string;
  depth: number;
  kind: "folder" | "file";
  fileKind?: CodeFileKind;
}

export interface CodeSyncState {
  sourceRevisionNumber: number;
  sourceVisualUpdatedAt: string;
  hasManualChanges: boolean;
  needsRegeneration: boolean;
  fileCount: number;
  openFileCount: number;
  draftCount: number;
  linkedFileCount: number;
  staleFileCount: number;
  safeRefreshableFileCount: number;
  visualManagedFileCount: number;
  blockedFileCount: number;
  canSafeRefresh: boolean;
  requiresConfirmedRefresh: boolean;
}

export interface ProjectBuilderRefreshQueueItemRecord {
  id: string;
  workspaceId: string;
  projectId: string;
  generationRunId: string | null;
  surface: BuilderRefreshSurface;
  status: BuilderRefreshQueueStatus;
  reason: BuilderRefreshQueueReason;
  targetPlanRevisionId: string | null;
  targetPlanRevisionNumber: number;
  pinnedPlanRevisionNumber: number | null;
  requiresManualReview: boolean;
  summary: string;
  createdAt: string;
  updatedAt: string;
  deferredAt: string | null;
  deferReason: string | null;
  staleAt: string | null;
  staleReason: string | null;
  supersededByGenerationRunId: string | null;
  supersededByPlanRevisionNumber: number | null;
  completedAt: string | null;
}

export interface BuilderRefreshQueueSummaryRecord {
  pendingCount: number;
  deferredCount: number;
  staleCount: number;
  completedCount: number;
  activeItems: ProjectBuilderRefreshQueueItemRecord[];
}

export interface CreateProjectBuilderRefreshQueueItemInput {
  workspaceId: string;
  projectId: string;
  generationRunId?: string | null;
  surface: BuilderRefreshSurface;
  reason: BuilderRefreshQueueReason;
  targetPlanRevisionId: string | null;
  targetPlanRevisionNumber: number;
  pinnedPlanRevisionNumber: number | null;
  requiresManualReview: boolean;
  summary: string;
}

export interface BuilderImpactSurfaceRecord {
  surface: BuilderImpactSurface;
  status: BuilderImpactSurfaceStatus;
  exists: boolean;
  pinnedRevisionNumber: number | null;
  approvedRevisionNumber: number | null;
  latestCandidateRevisionNumber: number | null;
  targetRevisionNumber: number | null;
  hasManualChanges: boolean;
  requiresManualReview: boolean;
  needsRefreshAfterPromotion: boolean;
  pendingQueueItemId: string | null;
}

export interface BuilderPromotionQueueDraft {
  surface: BuilderRefreshSurface;
  targetPlanRevisionId: string | null;
  targetPlanRevisionNumber: number;
  pinnedPlanRevisionNumber: number | null;
  requiresManualReview: boolean;
  summary: string;
}

export interface PlanCandidateDiffRecord {
  key: PlanSectionKey;
  kind: PlanCandidateDiffKind;
  beforeText: string | null;
  afterText: string | null;
  beforeItems: string[];
  afterItems: string[];
  addedItems: string[];
  removedItems: string[];
}

export interface PlanCandidateComparisonRecord {
  approvedRevision: PlanRevisionRecord | null;
  candidateRevision: PlanRevisionRecord;
  changedSections: PlanCandidateDiffRecord[];
}

export interface ProjectPlanPromotionBundle extends BuilderContextRecord {
  revisions: PlanRevisionRecord[];
  approvedRevision: PlanRevisionRecord | null;
  candidateRevision: PlanRevisionRecord | null;
  comparison: PlanCandidateComparisonRecord | null;
  visualSurface: BuilderImpactSurfaceRecord;
  codeSurface: BuilderImpactSurfaceRecord;
  previewSurface: BuilderImpactSurfaceRecord;
  pendingRefreshQueue: ProjectBuilderRefreshQueueItemRecord[];
  promotionQueueDrafts: BuilderPromotionQueueDraft[];
}

export type VisualRefreshDiffChangeType = "added" | "removed" | "changed";

export interface VisualRefreshDiffPageRecord {
  pageKey: string;
  changeType: VisualRefreshDiffChangeType;
  beforeTitle: string | null;
  afterTitle: string | null;
  beforeSlug: string | null;
  afterSlug: string | null;
  sectionAddedCount: number;
  sectionRemovedCount: number;
  sectionChangedCount: number;
}

export interface VisualRefreshDiffSectionRecord {
  pageKey: string;
  pageTitle: string;
  sectionKey: string;
  changeType: VisualRefreshDiffChangeType;
  beforeLabel: string | null;
  afterLabel: string | null;
  beforeType: VisualSectionType | null;
  afterType: VisualSectionType | null;
  contentChanged: boolean;
  visibilityChanged: boolean;
}

export interface VisualRefreshDiffTokenRecord {
  tokenKey: keyof VisualThemeTokens;
  beforeValue: string;
  afterValue: string;
}

export interface VisualRefreshDiffRecord {
  currentRevisionNumber: number;
  targetRevisionNumber: number;
  currentPageCount: number;
  targetPageCount: number;
  currentSectionCount: number;
  targetSectionCount: number;
  addedPageCount: number;
  removedPageCount: number;
  changedPageCount: number;
  addedSectionCount: number;
  removedSectionCount: number;
  changedSectionCount: number;
  changedThemeTokenCount: number;
  themeTokenChanges: VisualRefreshDiffTokenRecord[];
  pageChanges: VisualRefreshDiffPageRecord[];
  sectionChanges: VisualRefreshDiffSectionRecord[];
}

export interface ProjectCodeBundle extends BuilderContextRecord {
  revisions: PlanRevisionRecord[];
  sourceRevision: PlanRevisionRecord;
  visualState: VisualStateRecord;
  visualPages: VisualPageRecord[];
  visualSections: VisualSectionRecord[];
  visualSyncState: VisualSyncState;
  codeState: CodeWorkspaceStateRecord;
  files: ProjectCodeFileRecord[];
  fileRevisions: ProjectCodeFileRevisionRecord[];
  fileLinks: ProjectCodeFileLinkRecord[];
  patchProposals: ProjectCodePatchProposalRecord[];
  refreshCandidates: CodeRefreshCandidateRecord[];
  fileSyncRecords: CodeFileSyncRecord[];
  codeSyncState: CodeSyncState;
}

export interface ProjectAuditTimelineLinkContext {
  tab: BuilderTabKey;
  plannerRunId?: string | null;
  generationRunId?: string | null;
  deployRunId?: string | null;
  releaseId?: string | null;
  handoffRunId?: string | null;
  executionRunId?: string | null;
  artifactType?: string | null;
  briefId?: string | null;
  filePath?: string;
  compareRevisionId?: string | null;
  compareRevisionNumber?: number | null;
  proposalId?: string | null;
  planRevisionId?: string | null;
  planRevisionNumber?: number | null;
  visualPageId?: string | null;
  visualSectionId?: string | null;
  previewPageId?: string | null;
  previewRoutePath?: string | null;
  previewDevice?: PreviewDevice | null;
  previewExpanded?: boolean | null;
}

export interface ProjectAuditTimelineEventRecord {
  id: string;
  projectId: string;
  workspaceId: string;
  source: AuditTimelineSource;
  kind: AuditTimelineEventKind;
  title: string;
  summary: string;
  actorType: AuditTimelineActorType;
  actorUserId: string | null;
  actorLabel: string;
  entityType: string;
  entityId: string | null;
  linkedTab: BuilderTabKey;
  linkContext: ProjectAuditTimelineLinkContext;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

export interface CreateProjectAuditTimelineEventInput {
  id?: string;
  projectId: string;
  workspaceId: string;
  source: AuditTimelineSource;
  kind: AuditTimelineEventKind;
  title: string;
  summary: string;
  actorType: AuditTimelineActorType;
  actorUserId?: string | null;
  actorLabel: string;
  entityType: string;
  entityId?: string | null;
  linkedTab: BuilderTabKey;
  linkContext: ProjectAuditTimelineLinkContext;
  metadata?: Record<string, unknown>;
  occurredAt: string;
  createdAt?: string;
}

export interface ProjectAuditTimelineBundle extends BuilderContextRecord {
  events: ProjectAuditTimelineEventRecord[];
  counts: Record<AuditTimelineSource, number>;
  selectedSource: AuditTimelineFilterSource;
}

export interface CreateCodeScaffoldInput {
  visualBundle: ProjectVisualBundle;
  existingState?: CodeWorkspaceStateRecord | null;
}

export interface GeneratedCodeScaffold {
  codeState: CodeWorkspaceStateRecord;
  files: ProjectCodeFileRecord[];
  fileRevisions: ProjectCodeFileRevisionRecord[];
  fileLinks: ProjectCodeFileLinkRecord[];
}

export interface UpdateCodeFileDraftInput {
  codeStateId: string;
  fileId: string;
  filePath: string;
  content: string;
  expectedRevisionNumber: number;
}

export interface SaveCodeFileRevisionInput {
  codeStateId: string;
  fileId: string;
  filePath: string;
  content: string;
  changeSummary: string;
  expectedRevisionNumber: number;
}

export interface CreateCodePatchProposalInput {
  workspaceSlug: string;
  projectSlug: string;
  filePath: string;
  requestPrompt: string;
  requestedSelectionOverride?: "deterministic_internal" | "external_model" | null;
  retryOfRunId?: string | null;
}

export interface ApplyCodePatchProposalInput {
  workspaceSlug: string;
  projectSlug: string;
  proposalId: string;
}

export interface RejectCodePatchProposalInput {
  workspaceSlug: string;
  projectSlug: string;
  proposalId: string;
  rejectionReason: string;
}

export interface RestoreCodeFileRevisionInput {
  workspaceSlug: string;
  projectSlug: string;
  filePath: string;
  expectedRevisionNumber: number;
  targetType: CodeRestoreTargetType;
  targetRevisionId?: string | null;
}

export interface ArchiveCodePatchProposalInput {
  workspaceSlug: string;
  projectSlug: string;
  proposalId: string;
  archiveReason: string;
}

export type BuilderDictionary = Record<
  Locale,
  {
    tabs: Record<BuilderTabKey, { label: string; description: string }>;
  }
>;
