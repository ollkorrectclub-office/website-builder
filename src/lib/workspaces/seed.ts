import type {
  ProjectAuditTimelineEventRecord,
  CodeWorkspaceStateRecord,
  ProjectCodeFileRevisionRecord,
  ProjectCodeFileRecord,
  VisualPageRecord,
  VisualSectionRecord,
  VisualStateRecord,
} from "@/lib/builder/types";
import type { PlannerArtifactRecord, PlannerRunRecord } from "@/lib/planner/types";
import { buildMockStructuredPlan } from "@/lib/workspaces/mock-plan";
import { synthesizeProjectBrief } from "@/lib/workspaces/briefs";
import type {
  AuthSessionRecord,
  PlanRevisionRecord,
  PlannerSource,
  UserProfileRecord,
  ProjectCapabilities,
  ProjectBriefRecord,
  ProjectRecord,
  ProjectType,
  WorkspaceInvitationRecord,
  WorkspaceMemberEventRecord,
  WorkspaceMemberRecord,
  WorkspaceRecord,
} from "@/lib/workspaces/types";
import { hashPasswordSync } from "@/lib/auth/password";

function capabilities(overrides: Partial<ProjectCapabilities> = {}): ProjectCapabilities {
  return {
    auth: false,
    payments: false,
    cms: false,
    fileUpload: false,
    aiChat: false,
    calendar: false,
    analytics: true,
    ...overrides,
  };
}

const seededOwnerUser: UserProfileRecord = {
  id: "user_local_arta",
  email: "arta@besa.studio",
  fullName: "Arta Kelmendi",
  companyName: "Besa Studio",
  passwordHash: hashPasswordSync("phase1-demo"),
  authProvider: "password",
  createdAt: "2026-03-10T10:00:00.000Z",
  updatedAt: "2026-03-10T10:00:00.000Z",
};

const seededAdminUser: UserProfileRecord = {
  id: "user_local_nora",
  email: "nora@besa.studio",
  fullName: "Nora Krasniqi",
  companyName: "Besa Studio",
  passwordHash: hashPasswordSync("phase1-demo"),
  authProvider: "password",
  createdAt: "2026-03-10T10:00:00.000Z",
  updatedAt: "2026-03-10T10:00:00.000Z",
};

const seededEditorUser: UserProfileRecord = {
  id: "user_local_leon",
  email: "leon@besa.studio",
  fullName: "Leon Gashi",
  companyName: "Besa Studio",
  passwordHash: hashPasswordSync("phase1-demo"),
  authProvider: "password",
  createdAt: "2026-03-10T10:00:00.000Z",
  updatedAt: "2026-03-10T10:00:00.000Z",
};

const seededViewerUser: UserProfileRecord = {
  id: "user_local_sara",
  email: "sara@besa.studio",
  fullName: "Sara Bytyqi",
  companyName: "Besa Studio",
  passwordHash: hashPasswordSync("phase1-demo"),
  authProvider: "password",
  createdAt: "2026-03-10T10:00:00.000Z",
  updatedAt: "2026-03-10T10:00:00.000Z",
};

const seededWorkspace: WorkspaceRecord = {
  id: "ws_local_besa",
  slug: "besa-studio",
  name: "Besa Studio",
  ownerUserId: seededOwnerUser.id,
  createdByUserId: seededOwnerUser.id,
  businessCategory: "Digital studio",
  country: "kosovo",
  defaultLocale: "sq",
  supportedLocales: ["sq", "en"],
  companyName: "Besa Studio",
  intentNotes: "Local dev seed workspace for Kosovo and Albania onboarding and project flows.",
  onboardingPayload: {
    source: "local-seed",
  },
  createdAt: "2026-03-10T10:10:00.000Z",
  updatedAt: "2026-03-10T10:10:00.000Z",
};

function seededProject(input: {
  id: string;
  slug: string;
  name: string;
  projectType: ProjectType;
  prompt: string;
  plannerSource?: PlannerSource;
}) {
  const plannerSource = input.plannerSource ?? "rules_planner_v1";
  const structuredPlan = buildMockStructuredPlan({
    name: input.name,
    prompt: input.prompt,
    projectType: input.projectType,
    targetUsers: "Clinic managers, local patients, private healthcare buyers",
    desiredPagesFeatures: ["Home", "Services", "Pricing", "Contact form"],
    designStyle: "premium-minimal",
    supportedLocales: ["sq", "en"],
    country: "kosovo",
    businessCategory: "Healthcare",
    capabilities: capabilities({ auth: true, calendar: true }),
  });

  const revision: PlanRevisionRecord = {
    id: `planrev_${input.id}_1`,
    projectId: input.id,
    revisionNumber: 1,
    state: "generated",
    editedSection: "status",
    changeSummary: "Initial planner output created during project intake.",
    plannerSource,
    plan: structuredPlan,
    createdAt: "2026-03-10T10:20:00.000Z",
  };

  const project: ProjectRecord = {
    id: input.id,
    workspaceId: seededWorkspace.id,
    slug: input.slug,
    name: input.name,
    ownerUserId: seededOwnerUser.id,
    createdByUserId: seededOwnerUser.id,
    startingMode: "prompt",
    status: "plan_ready",
    projectType: input.projectType,
    prompt: input.prompt,
    targetUsers: "Clinic managers, local patients, private healthcare buyers",
    desiredPagesFeatures: ["Home", "Services", "Pricing", "Contact form"],
    designStyle: "premium-minimal",
    primaryLocale: "sq",
    supportedLocales: ["sq", "en"],
    country: "kosovo",
    businessCategory: "Healthcare",
    capabilities: capabilities({ auth: true, calendar: true }),
    intakePayload: {
      source: "local-seed",
    },
    structuredPlan,
    currentPlanRevisionId: revision.id,
    currentPlanRevisionNumber: revision.revisionNumber,
    planLastUpdatedAt: revision.createdAt,
    plannerSource,
    createdAt: "2026-03-10T10:20:00.000Z",
    updatedAt: "2026-03-10T10:20:00.000Z",
  };

  return {
    project,
    revision,
  };
}

const seededDentalProject = seededProject({
  id: "proj_local_denta",
  slug: "denta-plus-tirana",
  name: "Denta Plus Tirana",
  projectType: "website",
  prompt: "Premium bilingual dental clinic site with treatment pages, trust blocks, and consultation booking.",
});

export const seededWorkspaces = [seededWorkspace];
export const seededProjects = [seededDentalProject.project];
export const seededUsers = [seededOwnerUser, seededAdminUser, seededEditorUser, seededViewerUser];
export const seededAuthSessions: AuthSessionRecord[] = [];
export const seededWorkspaceMembers: WorkspaceMemberRecord[] = [
  {
    id: "wm_local_owner",
    workspaceId: seededWorkspace.id,
    userId: seededOwnerUser.id,
    role: "owner",
    status: "active",
    createdAt: "2026-03-10T10:05:00.000Z",
    updatedAt: "2026-03-10T10:05:00.000Z",
  },
  {
    id: "wm_local_admin",
    workspaceId: seededWorkspace.id,
    userId: seededAdminUser.id,
    role: "admin",
    status: "active",
    createdAt: "2026-03-10T10:05:00.000Z",
    updatedAt: "2026-03-10T10:05:00.000Z",
  },
  {
    id: "wm_local_editor",
    workspaceId: seededWorkspace.id,
    userId: seededEditorUser.id,
    role: "editor",
    status: "active",
    createdAt: "2026-03-10T10:05:00.000Z",
    updatedAt: "2026-03-10T10:05:00.000Z",
  },
  {
    id: "wm_local_viewer",
    workspaceId: seededWorkspace.id,
    userId: seededViewerUser.id,
    role: "viewer",
    status: "active",
    createdAt: "2026-03-10T10:05:00.000Z",
    updatedAt: "2026-03-10T10:05:00.000Z",
  },
];
export const seededWorkspaceInvitations: WorkspaceInvitationRecord[] = [];
export const seededWorkspaceMemberEvents: WorkspaceMemberEventRecord[] = [];
export const seededProjectBriefs: ProjectBriefRecord[] = [
  synthesizeProjectBrief(seededDentalProject.project, {
    id: `brief_${seededDentalProject.project.id}_1`,
    createdAt: seededDentalProject.project.createdAt,
    updatedAt: seededDentalProject.project.updatedAt,
  }),
];
export const seededPlanRevisions = [seededDentalProject.revision];
export const seededVisualStates: VisualStateRecord[] = [];
export const seededVisualPages: VisualPageRecord[] = [];
export const seededVisualSections: VisualSectionRecord[] = [];
export const seededCodeStates: CodeWorkspaceStateRecord[] = [];
export const seededProjectFiles: ProjectCodeFileRecord[] = [];
export const seededProjectFileRevisions: ProjectCodeFileRevisionRecord[] = [];
export const seededProjectAuditTimelineEvents: ProjectAuditTimelineEventRecord[] = [];
export const seededPlannerRuns: PlannerRunRecord[] = [];
export const seededPlannerArtifacts: PlannerArtifactRecord[] = [];
