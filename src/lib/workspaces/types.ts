import type { Locale } from "@/lib/i18n/locales";

export type Country = "kosovo" | "albania";
export type ProjectStartingMode = "prompt" | "wizard";
export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";
export type WorkspaceMemberStatus = "active" | "deactivated";
export type WorkspaceInvitationStatus = "pending" | "accepted" | "revoked";
export type ProjectStatus =
  | "draft"
  | "intake_submitted"
  | "plan_ready"
  | "plan_in_review"
  | "plan_approved"
  | "archived";
export type ProjectType =
  | "website"
  | "dashboard"
  | "marketplace"
  | "crm"
  | "booking_app"
  | "internal_tool"
  | "ecommerce"
  | "ai_assistant";
export type PlanSectionKey =
  | "productSummary"
  | "targetUsers"
  | "pageMap"
  | "featureList"
  | "dataModels"
  | "authRoles"
  | "integrationsNeeded"
  | "designDirection";
export type PlanRevisionState = "generated" | "draft_saved" | "needs_changes" | "approved";
export type PlannerSource =
  | "mock_planner"
  | "rules_planner_v1"
  | "external_model_adapter_v1";
export type AuthProvider = "password";

export interface UserProfileRecord {
  id: string;
  email: string;
  fullName: string;
  companyName: string;
  passwordHash: string;
  authProvider: AuthProvider;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  sessionToken: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export interface AuthenticatedUserRecord {
  id: string;
  email: string;
  fullName: string;
  companyName: string;
}

export interface WorkspaceMemberRecord {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  status: WorkspaceMemberStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMemberDirectoryEntryRecord {
  membershipId: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  status: WorkspaceMemberStatus;
  email: string;
  fullName: string;
  companyName: string;
  joinedAt: string;
  updatedAt: string;
}

export interface WorkspaceInvitationRecord {
  id: string;
  workspaceId: string;
  invitedByUserId: string | null;
  inviteeUserId: string | null;
  email: string;
  role: WorkspaceRole;
  status: WorkspaceInvitationStatus;
  invitationToken: string;
  acceptedByUserId: string | null;
  acceptedMembershipId: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type WorkspaceMemberEventType =
  | "member_added"
  | "member_role_changed"
  | "invitation_created"
  | "invitation_accepted"
  | "invitation_revoked"
  | "invitation_resent"
  | "member_deactivated"
  | "member_reactivated"
  | "owner_transferred";

export interface WorkspaceMemberEventRecord {
  id: string;
  workspaceId: string;
  membershipId: string | null;
  invitationId: string | null;
  memberUserId: string | null;
  actorUserId: string | null;
  actorLabel: string;
  eventType: WorkspaceMemberEventType;
  memberEmail: string;
  memberName: string;
  previousRole: WorkspaceRole | null;
  nextRole: WorkspaceRole;
  summary: string;
  occurredAt: string;
}

export interface WorkspacePermissionsRecord {
  canView: boolean;
  canCreateProject: boolean;
  canManageWorkspace: boolean;
}

export interface WorkspaceProjectOwnershipVisibilityRecord {
  projectId: string;
  projectSlug: string;
  projectName: string;
  projectOwnerUserId: string;
  projectOwnerName: string;
  projectOwnerEmail: string;
  projectOwnerWorkspaceRole: WorkspaceRole | null;
  projectOwnerMembershipStatus: WorkspaceMemberStatus | null;
  isWorkspaceOwner: boolean;
}

export interface ProjectPermissionsRecord {
  canView: boolean;
  canEditBrief: boolean;
  canRerunPlanner: boolean;
  canSavePlanDraft: boolean;
  canApprovePlan: boolean;
  canQueueGeneration: boolean;
  canIntakeVisual: boolean;
  canReviewCode: boolean;
  canManageProposals: boolean;
  canRestoreCode: boolean;
  canPublishDeploy: boolean;
  canViewTimeline: boolean;
}

export interface ProjectCapabilities {
  auth: boolean;
  payments: boolean;
  cms: boolean;
  fileUpload: boolean;
  aiChat: boolean;
  calendar: boolean;
  analytics: boolean;
}

export interface ProjectBriefFields {
  name: string;
  prompt: string;
  projectType: ProjectType;
  targetUsers: string;
  desiredPagesFeatures: string[];
  designStyle: string;
  primaryLocale: Locale;
  supportedLocales: Locale[];
  country: Country;
  businessCategory: string;
  capabilities: ProjectCapabilities;
}

export interface StructuredPlanDataModel {
  name: string;
  description: string;
}

export interface StructuredPlan {
  productSummary: string;
  targetUsers: string[];
  pageMap: string[];
  featureList: string[];
  dataModels: StructuredPlanDataModel[];
  authRoles: string[];
  integrationsNeeded: string[];
  designDirection: string;
}

export interface PlanRevisionRecord {
  id: string;
  projectId: string;
  revisionNumber: number;
  state: PlanRevisionState;
  editedSection: PlanSectionKey | "status";
  changeSummary: string;
  plannerSource: PlannerSource;
  plan: StructuredPlan;
  createdAt: string;
}

export interface WorkspaceRecord {
  id: string;
  slug: string;
  name: string;
  ownerUserId: string;
  createdByUserId: string;
  businessCategory: string;
  country: Country;
  defaultLocale: Locale;
  supportedLocales: Locale[];
  companyName: string;
  intentNotes: string;
  onboardingPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRecord {
  id: string;
  workspaceId: string;
  slug: string;
  name: string;
  ownerUserId: string;
  createdByUserId: string;
  startingMode: ProjectStartingMode;
  status: ProjectStatus;
  projectType: ProjectType;
  prompt: string;
  targetUsers: string;
  desiredPagesFeatures: string[];
  designStyle: string;
  primaryLocale: Locale;
  supportedLocales: Locale[];
  country: Country;
  businessCategory: string;
  capabilities: ProjectCapabilities;
  intakePayload: Record<string, unknown>;
  structuredPlan: StructuredPlan;
  currentPlanRevisionId: string;
  currentPlanRevisionNumber: number;
  planLastUpdatedAt: string;
  plannerSource: PlannerSource;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectBriefRecord extends ProjectBriefFields {
  id: string;
  projectId: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceWithProjects extends WorkspaceRecord {
  projects: ProjectRecord[];
  currentUser: AuthenticatedUserRecord;
  membership: WorkspaceMemberRecord;
  permissions: WorkspacePermissionsRecord;
}

export interface WorkspaceMemberManagementBundle {
  workspace: WorkspaceRecord;
  currentUser: AuthenticatedUserRecord;
  membership: WorkspaceMemberRecord;
  permissions: WorkspacePermissionsRecord;
  members: WorkspaceMemberDirectoryEntryRecord[];
  invitations: WorkspaceInvitationRecord[];
  events: WorkspaceMemberEventRecord[];
  projectOwnerships: WorkspaceProjectOwnershipVisibilityRecord[];
}

export interface WorkspaceInvitationAcceptanceBundle {
  workspace: WorkspaceRecord;
  invitation: WorkspaceInvitationRecord;
  existingUser: AuthenticatedUserRecord | null;
  currentUser: AuthenticatedUserRecord | null;
}

export interface ProjectPlanBundle {
  workspace: WorkspaceRecord;
  project: ProjectRecord;
  brief: ProjectBriefRecord;
  revisions: PlanRevisionRecord[];
  currentUser: AuthenticatedUserRecord;
  membership: WorkspaceMemberRecord;
  workspacePermissions: WorkspacePermissionsRecord;
  projectPermissions: ProjectPermissionsRecord;
}

export interface CreateWorkspaceInput {
  name: string;
  companyName: string;
  businessCategory: string;
  country: Country;
  defaultLocale: Locale;
  supportedLocales: Locale[];
  intentNotes: string;
  ownerUserId: string;
  createdByUserId: string;
}

export interface CreateProjectInput extends ProjectBriefFields {
  workspaceId: string;
  ownerUserId: string;
  createdByUserId: string;
  startingMode: ProjectStartingMode;
  intakePayload: Record<string, unknown>;
  structuredPlan: StructuredPlan;
  plannerSource: PlannerSource;
}

export interface CreatePlanRevisionInput {
  projectId: string;
  state: PlanRevisionState;
  editedSection: PlanSectionKey | "status";
  changeSummary: string;
  plannerSource: PlannerSource;
  plan: StructuredPlan;
  nextProjectStatus: ProjectStatus;
}

export interface UpdateProjectBriefInput {
  workspaceId: string;
  projectId: string;
  brief: ProjectBriefFields;
}

export interface PersistenceSummary {
  mode: "supabase" | "local";
  configured: boolean;
}
