import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  ProjectAuditTimelineEventRecord,
  ProjectBuilderRefreshQueueItemRecord,
  ProjectCodeFileLinkRecord,
  ProjectCodePatchProposalRecord,
  CodeWorkspaceStateRecord,
  ProjectCodeFileRevisionRecord,
  ProjectCodeFileRecord,
  VisualPageRecord,
  VisualSectionRecord,
  VisualStateRecord,
} from "@/lib/builder/types";
import type {
  GenerationArtifactRecord,
  GenerationRunRecord,
} from "@/lib/generation/types";
import type {
  DeployArtifactRecord,
  DeployExecutionRunRecord,
  DeployHandoffRunRecord,
  DeployReleaseRecord,
  DeployRunRecord,
  DeployTargetRecord,
} from "@/lib/deploy/types";
import type {
  ModelAdapterRunRecord,
  ProjectModelAdapterConfigRecord,
} from "@/lib/model-adapters/types";
import { defaultDeployTargetSettings, normalizeDeployTargetSettings } from "@/lib/deploy/settings";
import type { PlannerArtifactRecord, PlannerRunRecord } from "@/lib/planner/types";
import { buildPlannerArtifacts, plannerInputFromBrief } from "@/lib/planner/utils";
import { synthesizeProjectBrief } from "@/lib/workspaces/briefs";
import { buildWorkspaceInvitationExpiryIso } from "@/lib/workspaces/utils";
import {
  seededAuthSessions,
  seededCodeStates,
  seededPlannerArtifacts,
  seededPlannerRuns,
  seededProjectFileRevisions,
  seededProjectFiles,
  seededProjectAuditTimelineEvents,
  seededProjectBriefs,
  seededPlanRevisions,
  seededProjects,
  seededUsers,
  seededVisualPages,
  seededVisualSections,
  seededVisualStates,
  seededWorkspaceMembers,
  seededWorkspaceMemberEvents,
  seededWorkspaceInvitations,
  seededWorkspaces,
} from "@/lib/workspaces/seed";
import type {
  AuthSessionRecord,
  PlanRevisionRecord,
  PlannerSource,
  ProjectBriefRecord,
  ProjectRecord,
  StructuredPlan,
  UserProfileRecord,
  WorkspaceInvitationRecord,
  WorkspaceMemberEventRecord,
  WorkspaceMemberRecord,
  WorkspaceRecord,
} from "@/lib/workspaces/types";

export interface LocalStoreShape {
  users: UserProfileRecord[];
  authSessions: AuthSessionRecord[];
  workspaces: WorkspaceRecord[];
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceInvitations: WorkspaceInvitationRecord[];
  workspaceMemberEvents: WorkspaceMemberEventRecord[];
  projects: ProjectRecord[];
  projectBriefs: ProjectBriefRecord[];
  planRevisions: PlanRevisionRecord[];
  visualStates: VisualStateRecord[];
  visualPages: VisualPageRecord[];
  visualSections: VisualSectionRecord[];
  codeStates: CodeWorkspaceStateRecord[];
  projectFiles: ProjectCodeFileRecord[];
  projectFileRevisions: ProjectCodeFileRevisionRecord[];
  projectFileLinks: ProjectCodeFileLinkRecord[];
  projectPatchProposals: ProjectCodePatchProposalRecord[];
  projectAuditTimelineEvents: ProjectAuditTimelineEventRecord[];
  projectBuilderRefreshQueueItems: ProjectBuilderRefreshQueueItemRecord[];
  plannerRuns: PlannerRunRecord[];
  plannerArtifacts: PlannerArtifactRecord[];
  generationRuns: GenerationRunRecord[];
  generationArtifacts: GenerationArtifactRecord[];
  deployTargets: DeployTargetRecord[];
  deployRuns: DeployRunRecord[];
  deployArtifacts: DeployArtifactRecord[];
  deployReleases: DeployReleaseRecord[];
  deployHandoffRuns: DeployHandoffRunRecord[];
  deployExecutionRuns: DeployExecutionRunRecord[];
  modelAdapterConfigs: ProjectModelAdapterConfigRecord[];
  modelAdapterRuns: ModelAdapterRunRecord[];
}

const configuredDataFile = process.env.BESA_LOCAL_STORE_FILE?.trim();
const DATA_FILE = configuredDataFile
  ? path.resolve(process.cwd(), configuredDataFile)
  : path.join(process.cwd(), ".data", "phase2-store.json");
const DATA_DIR = path.dirname(DATA_FILE);

const defaultStore: LocalStoreShape = {
  users: seededUsers,
  authSessions: seededAuthSessions,
  workspaces: seededWorkspaces,
  workspaceMembers: seededWorkspaceMembers,
  workspaceInvitations: seededWorkspaceInvitations,
  workspaceMemberEvents: seededWorkspaceMemberEvents,
  projects: seededProjects,
  projectBriefs: seededProjectBriefs,
  planRevisions: seededPlanRevisions,
  visualStates: seededVisualStates,
  visualPages: seededVisualPages,
  visualSections: seededVisualSections,
  codeStates: seededCodeStates,
  projectFiles: seededProjectFiles,
  projectFileRevisions: seededProjectFileRevisions,
  projectFileLinks: [],
  projectPatchProposals: [],
  projectAuditTimelineEvents: seededProjectAuditTimelineEvents,
  projectBuilderRefreshQueueItems: [],
  plannerRuns: seededPlannerRuns,
  plannerArtifacts: seededPlannerArtifacts,
  generationRuns: [],
  generationArtifacts: [],
  deployTargets: [],
  deployRuns: [],
  deployArtifacts: [],
  deployReleases: [],
  deployHandoffRuns: [],
  deployExecutionRuns: [],
  modelAdapterConfigs: [],
  modelAdapterRuns: [],
};

async function ensureFile() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(DATA_FILE, "utf-8");
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(defaultStore, null, 2), "utf-8");
  }
}

async function readParsedStore() {
  const parse = async () => JSON.parse(await readFile(DATA_FILE, "utf-8")) as Partial<LocalStoreShape>;

  try {
    return await parse();
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
    return parse();
  }
}

function synthesizeInitialRevision(project: Record<string, unknown>) {
  const revisionId = `planrev_${String(project.id)}_1`;
  const createdAt = String(project.updatedAt ?? project.updated_at ?? project.createdAt ?? new Date().toISOString());
  const plannerSource = String(project.plannerSource ?? "rules_planner_v1") as PlannerSource;
  const structuredPlan = project.structuredPlan as StructuredPlan;

  const revision: PlanRevisionRecord = {
    id: revisionId,
    projectId: String(project.id),
    revisionNumber: 1,
    state: "generated",
    editedSection: "status",
    changeSummary: "Initial plan revision synthesized from legacy local project data.",
    plannerSource,
    plan: structuredPlan,
    createdAt,
  };

  const normalizedProject = {
    ...project,
    status:
      project.status === "plan_approved" || project.status === "plan_in_review" || project.status === "plan_ready"
        ? project.status
        : "plan_ready",
    currentPlanRevisionId: revisionId,
    currentPlanRevisionNumber: 1,
    planLastUpdatedAt: createdAt,
    plannerSource,
  } satisfies Record<string, unknown>;

  return {
    revision,
    project: normalizedProject,
  };
}

function emptyStructuredPlan() {
  return {
    productSummary: "",
    targetUsers: [],
    pageMap: [],
    featureList: [],
    dataModels: [],
    authRoles: [],
    integrationsNeeded: [],
    designDirection: "",
  };
}

function synthesizeInitialPlannerRun(
  project: ProjectRecord,
  brief: ProjectBriefRecord,
  revision: PlanRevisionRecord,
) {
  const runId = `planner-run-${project.id}-1`;
  const inputSnapshot = plannerInputFromBrief(brief);
  const artifacts = buildPlannerArtifacts(inputSnapshot, revision.plan, "project_create");

  const run: PlannerRunRecord = {
    id: runId,
    projectId: project.id,
    workspaceId: project.workspaceId,
    briefId: brief.id,
    briefUpdatedAt: brief.updatedAt,
    source: revision.plannerSource,
    trigger: "project_create",
    status: "completed",
    summary: revision.changeSummary,
    inputSnapshot,
    outputPlan: revision.plan,
    generatedPlanRevisionId: revision.id,
    generatedPlanRevisionNumber: revision.revisionNumber,
    errorMessage: null,
    startedAt: revision.createdAt,
    completedAt: revision.createdAt,
    createdAt: revision.createdAt,
    updatedAt: revision.createdAt,
  };

  const artifactRecords: PlannerArtifactRecord[] = artifacts.map((artifact, index) => ({
    id: `planner-artifact-${runId}-${index + 1}`,
    plannerRunId: runId,
    projectId: project.id,
    workspaceId: project.workspaceId,
    artifactType: artifact.artifactType,
    label: artifact.label,
    payload: artifact.payload,
    createdAt: revision.createdAt,
  }));

  return {
    run,
    artifactRecords,
  };
}

function normalizeLocalStore(store: Partial<LocalStoreShape>) {
  const normalizedUsers = Array.isArray(store.users)
    ? ((store.users as unknown as Array<Record<string, unknown>>)
        .filter((user) => typeof user.id === "string" && typeof user.email === "string")
        .map((user) => ({
          id: String(user.id),
          email: String(user.email).toLowerCase(),
          fullName: String(user.fullName ?? user.full_name ?? ""),
          companyName: String(user.companyName ?? user.company_name ?? ""),
          passwordHash: String(user.passwordHash ?? user.password_hash ?? ""),
          authProvider: "password",
          createdAt: String(user.createdAt ?? user.created_at ?? new Date().toISOString()),
          updatedAt: String(user.updatedAt ?? user.updated_at ?? new Date().toISOString()),
        })) as UserProfileRecord[])
    : seededUsers;
  const normalizedSessions = Array.isArray(store.authSessions)
    ? ((store.authSessions as unknown as Array<Record<string, unknown>>)
        .filter((session) => typeof session.userId === "string" && typeof session.sessionToken === "string")
        .map((session) => ({
          id: String(session.id),
          userId: String(session.userId ?? session.user_id),
          sessionToken: String(session.sessionToken ?? session.session_token),
          createdAt: String(session.createdAt ?? session.created_at ?? new Date().toISOString()),
          lastSeenAt: String(session.lastSeenAt ?? session.last_seen_at ?? new Date().toISOString()),
          expiresAt: String(session.expiresAt ?? session.expires_at ?? new Date().toISOString()),
        })) as AuthSessionRecord[])
    : seededAuthSessions;
  const normalizedWorkspaces = ((store.workspaces ?? seededWorkspaces) as unknown as Array<Record<string, unknown>>).map(
    (workspace) => ({
      ...(workspace as unknown as WorkspaceRecord),
      ownerUserId: String(workspace.ownerUserId ?? workspace.owner_user_id ?? seededUsers[0].id),
      createdByUserId: String(workspace.createdByUserId ?? workspace.created_by_user_id ?? seededUsers[0].id),
    }),
  ) as WorkspaceRecord[];
  const normalizedWorkspaceMembers = Array.isArray(store.workspaceMembers)
    ? ((store.workspaceMembers as unknown as Array<Record<string, unknown>>)
        .filter((member) => typeof member.workspaceId === "string" && typeof member.userId === "string")
        .map((member) => ({
          id: String(member.id),
          workspaceId: String(member.workspaceId ?? member.workspace_id),
          userId: String(member.userId ?? member.user_id),
          role: member.role as WorkspaceMemberRecord["role"],
          status:
            member.status === "deactivated"
              ? "deactivated"
              : member.status === "active"
                ? "active"
                : "active",
          createdAt: String(member.createdAt ?? member.created_at ?? new Date().toISOString()),
          updatedAt: String(member.updatedAt ?? member.updated_at ?? new Date().toISOString()),
        })) as WorkspaceMemberRecord[])
    : seededWorkspaceMembers;
  const normalizedWorkspaceInvitations = Array.isArray(store.workspaceInvitations)
    ? ((store.workspaceInvitations as unknown as Array<Record<string, unknown>>)
        .filter(
          (invitation) =>
            (typeof invitation.workspaceId === "string" || typeof invitation.workspace_id === "string") &&
            typeof (invitation.email ?? invitation.member_email) === "string",
        )
        .map((invitation) => ({
          id: String(invitation.id),
          workspaceId:
            typeof invitation.workspaceId === "string"
              ? invitation.workspaceId
              : typeof invitation.workspace_id === "string"
                ? invitation.workspace_id
                : "",
          invitedByUserId:
            typeof invitation.invitedByUserId === "string"
              ? invitation.invitedByUserId
              : typeof invitation.invited_by_user_id === "string"
                ? invitation.invited_by_user_id
                : null,
          inviteeUserId:
            typeof invitation.inviteeUserId === "string"
              ? invitation.inviteeUserId
              : typeof invitation.invitee_user_id === "string"
                ? invitation.invitee_user_id
                : null,
          email: String(invitation.email ?? invitation.member_email ?? "").toLowerCase(),
          role:
            (typeof invitation.role === "string"
              ? invitation.role
              : typeof invitation.invited_role === "string"
                ? invitation.invited_role
                : "viewer") as WorkspaceInvitationRecord["role"],
          status:
            invitation.status === "accepted" || invitation.status === "revoked"
              ? invitation.status
              : "pending",
          invitationToken:
            typeof invitation.invitationToken === "string"
              ? invitation.invitationToken
              : typeof invitation.invitation_token === "string"
                ? invitation.invitation_token
                : String(invitation.id),
          deliveryChannel:
            invitation.deliveryChannel === "stored_link" || invitation.delivery_channel === "stored_link"
              ? "stored_link"
              : "stored_link",
          deliveryAttemptNumber: Math.max(
            1,
            Number(
              invitation.deliveryAttemptNumber ??
                invitation.delivery_attempt_number ??
                1,
            ),
          ),
          resentFromInvitationId:
            typeof invitation.resentFromInvitationId === "string"
              ? invitation.resentFromInvitationId
              : typeof invitation.resent_from_invitation_id === "string"
                ? invitation.resent_from_invitation_id
                : null,
          lastSentAt:
            typeof invitation.lastSentAt === "string"
              ? invitation.lastSentAt
              : typeof invitation.last_sent_at === "string"
                ? invitation.last_sent_at
                : typeof invitation.createdAt === "string"
                  ? invitation.createdAt
                  : typeof invitation.created_at === "string"
                    ? invitation.created_at
                    : new Date().toISOString(),
          expiresAt:
            typeof invitation.expiresAt === "string"
              ? invitation.expiresAt
              : typeof invitation.expires_at === "string"
                ? invitation.expires_at
                : buildWorkspaceInvitationExpiryIso(
                    typeof invitation.lastSentAt === "string"
                      ? invitation.lastSentAt
                      : typeof invitation.last_sent_at === "string"
                        ? invitation.last_sent_at
                        : typeof invitation.createdAt === "string"
                          ? invitation.createdAt
                          : typeof invitation.created_at === "string"
                            ? invitation.created_at
                            : new Date().toISOString(),
                  ),
          acceptedByUserId:
            typeof invitation.acceptedByUserId === "string"
              ? invitation.acceptedByUserId
              : typeof invitation.accepted_by_user_id === "string"
                ? invitation.accepted_by_user_id
                : null,
          acceptedMembershipId:
            typeof invitation.acceptedMembershipId === "string"
              ? invitation.acceptedMembershipId
              : typeof invitation.accepted_membership_id === "string"
                ? invitation.accepted_membership_id
                : null,
          acceptedAt:
            typeof invitation.acceptedAt === "string"
              ? invitation.acceptedAt
              : typeof invitation.accepted_at === "string"
                ? invitation.accepted_at
                : null,
          revokedAt:
            typeof invitation.revokedAt === "string"
              ? invitation.revokedAt
              : typeof invitation.revoked_at === "string"
                ? invitation.revoked_at
                : null,
          createdAt:
            typeof invitation.createdAt === "string"
              ? invitation.createdAt
              : typeof invitation.created_at === "string"
                ? invitation.created_at
                : new Date().toISOString(),
          updatedAt:
            typeof invitation.updatedAt === "string"
              ? invitation.updatedAt
              : typeof invitation.updated_at === "string"
                ? invitation.updated_at
                : new Date().toISOString(),
        })) as WorkspaceInvitationRecord[])
    : seededWorkspaceInvitations;
  const normalizedWorkspaceMemberEvents = Array.isArray(store.workspaceMemberEvents)
    ? ((store.workspaceMemberEvents as unknown as Array<Record<string, unknown>>)
        .filter(
          (event) =>
            (typeof event.workspaceId === "string" || typeof event.workspace_id === "string") &&
            (typeof event.eventType === "string" || typeof event.event_type === "string"),
        )
        .map((event) => ({
          id: String(event.id),
          workspaceId:
            typeof event.workspaceId === "string"
              ? event.workspaceId
              : typeof event.workspace_id === "string"
                ? event.workspace_id
                : "",
          membershipId:
            typeof event.membershipId === "string"
              ? event.membershipId
              : typeof event.membership_id === "string"
                ? event.membership_id
                : null,
          invitationId:
            typeof event.invitationId === "string"
              ? event.invitationId
              : typeof event.invitation_id === "string"
                ? event.invitation_id
                : null,
          memberUserId:
            typeof event.memberUserId === "string"
              ? event.memberUserId
              : typeof event.member_user_id === "string"
                ? event.member_user_id
                : null,
          actorUserId:
            typeof event.actorUserId === "string"
              ? event.actorUserId
              : typeof event.actor_user_id === "string"
                ? event.actor_user_id
                : null,
          actorLabel:
            typeof event.actorLabel === "string"
              ? event.actorLabel
              : typeof event.actor_label === "string"
                ? event.actor_label
                : "workspace_operator",
          eventType:
            (typeof event.eventType === "string"
              ? event.eventType
              : typeof event.event_type === "string"
                ? event.event_type
                : "member_added") as WorkspaceMemberEventRecord["eventType"],
          memberEmail:
            typeof event.memberEmail === "string"
              ? event.memberEmail
              : typeof event.member_email === "string"
                ? event.member_email
                : "",
          memberName:
            typeof event.memberName === "string"
              ? event.memberName
              : typeof event.member_name === "string"
                ? event.member_name
                : "",
          previousRole:
            typeof event.previousRole === "string"
              ? (event.previousRole as WorkspaceMemberEventRecord["previousRole"])
              : typeof event.previous_role === "string"
                ? (event.previous_role as WorkspaceMemberEventRecord["previousRole"])
                : null,
          nextRole:
            (typeof event.nextRole === "string"
              ? event.nextRole
              : typeof event.next_role === "string"
                ? event.next_role
                : "viewer") as WorkspaceMemberEventRecord["nextRole"],
          summary: String(event.summary ?? ""),
          occurredAt:
            typeof event.occurredAt === "string"
              ? event.occurredAt
              : typeof event.occurred_at === "string"
                ? event.occurred_at
                : new Date().toISOString(),
        })) as WorkspaceMemberEventRecord[])
    : seededWorkspaceMemberEvents;
  const rawProjects = Array.isArray(store.projects)
    ? (store.projects as unknown as Array<Record<string, unknown>>)
    : [];
  const existingRevisions = ((store.planRevisions ?? []) as PlanRevisionRecord[]).map((revision) => ({
    ...revision,
    plan: revision.plan,
  }));
  const nextRevisions = [...existingRevisions];

  const normalizedProjects = rawProjects.map((project) => {
    if (
      typeof project.currentPlanRevisionId === "string" &&
      typeof project.currentPlanRevisionNumber === "number" &&
      typeof project.planLastUpdatedAt === "string"
    ) {
      return project as unknown as ProjectRecord;
    }

    const synthesized = synthesizeInitialRevision(project);

    if (!nextRevisions.find((revision) => revision.id === synthesized.revision.id)) {
      nextRevisions.push(synthesized.revision);
    }

    return {
      ...(synthesized.project as ProjectRecord),
      ownerUserId: String(project.ownerUserId ?? project.owner_user_id ?? seededUsers[0].id),
      createdByUserId: String(project.createdByUserId ?? project.created_by_user_id ?? seededUsers[0].id),
    } as ProjectRecord;
  });
  const normalizedProjectsWithOwnership = normalizedProjects.map((project) => ({
    ...project,
    ownerUserId: project.ownerUserId ?? seededUsers[0].id,
    createdByUserId: project.createdByUserId ?? seededUsers[0].id,
  }));
  const rawProjectBriefs = Array.isArray(store.projectBriefs)
    ? (store.projectBriefs as unknown as Array<Record<string, unknown>>)
    : [];
  const normalizedProjectBriefs = rawProjectBriefs.filter((brief) =>
    typeof brief.id === "string" &&
    typeof brief.projectId === "string" &&
    typeof brief.workspaceId === "string" &&
    typeof brief.name === "string",
  ).map((brief) => ({
    ...brief,
    prompt: typeof brief.prompt === "string" ? brief.prompt : "",
    desiredPagesFeatures:
      Array.isArray(brief.desiredPagesFeatures)
        ? brief.desiredPagesFeatures
        : Array.isArray(brief.desired_pages_features)
          ? brief.desired_pages_features
          : [],
    supportedLocales:
      Array.isArray(brief.supportedLocales)
        ? brief.supportedLocales
        : Array.isArray(brief.supported_locales)
          ? brief.supported_locales
          : ["sq"],
    capabilities:
      typeof brief.capabilities === "object" && brief.capabilities ? brief.capabilities : {},
    createdAt:
      typeof brief.createdAt === "string"
        ? brief.createdAt
        : typeof brief.created_at === "string"
          ? brief.created_at
          : new Date().toISOString(),
    updatedAt:
      typeof brief.updatedAt === "string"
        ? brief.updatedAt
        : typeof brief.updated_at === "string"
          ? brief.updated_at
          : new Date().toISOString(),
  })) as unknown as ProjectBriefRecord[];

  const rawProjectFiles = Array.isArray(store.projectFiles)
    ? (store.projectFiles as unknown as Array<Record<string, unknown>>)
    : [];
  const normalizedProjectFiles = rawProjectFiles.filter((file) =>
    typeof file.currentRevisionId === "string" &&
    typeof file.currentRevisionNumber === "number" &&
    typeof file.ownership === "string" &&
    typeof file.editPolicy === "string",
  ) as unknown as ProjectCodeFileRecord[];
  const rawProjectFileRevisions = Array.isArray(store.projectFileRevisions)
    ? (store.projectFileRevisions as unknown as Array<Record<string, unknown>>)
    : [];
  const normalizedProjectFileRevisions = rawProjectFileRevisions.filter((revision) =>
    typeof revision.fileId === "string" &&
    typeof revision.revisionNumber === "number" &&
    typeof revision.kind === "string",
  ).map((revision) => ({
    ...revision,
    sourceProposalId:
      typeof revision.sourceProposalId === "string"
        ? revision.sourceProposalId
        : typeof revision.source_proposal_id === "string"
          ? revision.source_proposal_id
          : null,
    sourceProposalTitle:
      typeof revision.sourceProposalTitle === "string"
        ? revision.sourceProposalTitle
        : typeof revision.source_proposal_title === "string"
          ? revision.source_proposal_title
          : null,
    restoreSource:
      typeof revision.restoreSource === "string"
        ? revision.restoreSource
        : typeof revision.restore_source === "string"
          ? revision.restore_source
          : null,
    restoredFromRevisionId:
      typeof revision.restoredFromRevisionId === "string"
        ? revision.restoredFromRevisionId
        : typeof revision.restored_from_revision_id === "string"
          ? revision.restored_from_revision_id
          : null,
    restoredFromRevisionNumber:
      typeof revision.restoredFromRevisionNumber === "number"
        ? revision.restoredFromRevisionNumber
        : typeof revision.restored_from_revision_number === "number"
          ? revision.restored_from_revision_number
          : null,
  })) as unknown as ProjectCodeFileRevisionRecord[];
  const rawProjectFileLinks = Array.isArray(store.projectFileLinks)
    ? (store.projectFileLinks as unknown as Array<Record<string, unknown>>)
    : [];
  const normalizedProjectFileLinks = rawProjectFileLinks.filter((link) =>
    typeof link.fileId === "string" &&
    typeof link.targetType === "string" &&
    typeof link.role === "string",
  ) as unknown as ProjectCodeFileLinkRecord[];
  const rawProjectPatchProposals = Array.isArray(store.projectPatchProposals)
    ? (store.projectPatchProposals as unknown as Array<Record<string, unknown>>)
    : [];
  const normalizedProjectPatchProposals = rawProjectPatchProposals.filter((proposal) =>
    typeof proposal.fileId === "string" &&
    typeof proposal.status === "string" &&
    typeof proposal.proposedContent === "string",
  ).map((proposal) => ({
    ...proposal,
    invalidatedByRevisionId:
      typeof proposal.invalidatedByRevisionId === "string"
        ? proposal.invalidatedByRevisionId
        : typeof proposal.invalidated_by_revision_id === "string"
          ? proposal.invalidated_by_revision_id
          : null,
    invalidatedByRevisionNumber:
      typeof proposal.invalidatedByRevisionNumber === "number"
        ? proposal.invalidatedByRevisionNumber
        : typeof proposal.invalidated_by_revision_number === "number"
          ? proposal.invalidated_by_revision_number
          : null,
    archivedAt:
      typeof proposal.archivedAt === "string"
        ? proposal.archivedAt
        : typeof proposal.archived_at === "string"
          ? proposal.archived_at
          : null,
    archiveReason:
      typeof proposal.archiveReason === "string"
        ? proposal.archiveReason
        : typeof proposal.archive_reason === "string"
          ? proposal.archive_reason
          : null,
  })) as unknown as ProjectCodePatchProposalRecord[];
  const rawProjectAuditTimelineEvents = Array.isArray(store.projectAuditTimelineEvents)
    ? (store.projectAuditTimelineEvents as unknown as Array<Record<string, unknown>>)
    : [];
  const normalizedProjectAuditTimelineEvents = rawProjectAuditTimelineEvents.filter((event) =>
    typeof event.id === "string" &&
    typeof event.projectId === "string" &&
    typeof event.workspaceId === "string" &&
    typeof event.source === "string" &&
    typeof event.kind === "string" &&
    typeof event.occurredAt === "string",
  ).map((event) => ({
    ...event,
    actorUserId:
      typeof event.actorUserId === "string"
        ? event.actorUserId
        : typeof event.actor_user_id === "string"
          ? event.actor_user_id
          : null,
    entityId:
      typeof event.entityId === "string"
        ? event.entityId
        : typeof event.entity_id === "string"
          ? event.entity_id
          : null,
    linkedTab:
      typeof event.linkedTab === "string"
        ? event.linkedTab
        : typeof event.linked_tab === "string"
          ? event.linked_tab
          : "plan",
    linkContext:
      typeof event.linkContext === "object" && event.linkContext
        ? event.linkContext
        : typeof event.link_context === "object" && event.link_context
          ? event.link_context
          : { tab: "plan" },
    metadata:
      typeof event.metadata === "object" && event.metadata
        ? event.metadata
        : typeof event.metadata_json === "object" && event.metadata_json
          ? event.metadata_json
          : {},
    createdAt:
      typeof event.createdAt === "string"
        ? event.createdAt
        : typeof event.created_at === "string"
          ? event.created_at
          : String(event.occurredAt),
  })) as unknown as ProjectAuditTimelineEventRecord[];
  const rawProjectBuilderRefreshQueueItems = Array.isArray(store.projectBuilderRefreshQueueItems)
    ? (store.projectBuilderRefreshQueueItems as unknown as Array<Record<string, unknown>>)
    : [];
  const normalizedProjectBuilderRefreshQueueItems = rawProjectBuilderRefreshQueueItems
    .filter((item) =>
      typeof item.id === "string" &&
      (typeof item.projectId === "string" || typeof item.project_id === "string") &&
      (typeof item.workspaceId === "string" || typeof item.workspace_id === "string") &&
      typeof item.surface === "string" &&
      typeof item.status === "string",
    )
    .map((item) => ({
      ...item,
      projectId:
        typeof item.projectId === "string"
          ? item.projectId
          : typeof item.project_id === "string"
            ? item.project_id
            : "",
      workspaceId:
        typeof item.workspaceId === "string"
          ? item.workspaceId
          : typeof item.workspace_id === "string"
            ? item.workspace_id
            : "",
      targetPlanRevisionId:
        typeof item.targetPlanRevisionId === "string"
          ? item.targetPlanRevisionId
          : typeof item.target_plan_revision_id === "string"
            ? item.target_plan_revision_id
            : null,
      generationRunId:
        typeof item.generationRunId === "string"
          ? item.generationRunId
          : typeof item.generation_run_id === "string"
            ? item.generation_run_id
            : null,
      targetPlanRevisionNumber:
        typeof item.targetPlanRevisionNumber === "number"
          ? item.targetPlanRevisionNumber
          : typeof item.target_plan_revision_number === "number"
            ? item.target_plan_revision_number
            : 1,
      pinnedPlanRevisionNumber:
        typeof item.pinnedPlanRevisionNumber === "number"
          ? item.pinnedPlanRevisionNumber
          : typeof item.pinned_plan_revision_number === "number"
            ? item.pinned_plan_revision_number
            : null,
      requiresManualReview:
        typeof item.requiresManualReview === "boolean"
          ? item.requiresManualReview
          : typeof item.requires_manual_review === "boolean"
            ? item.requires_manual_review
            : false,
      deferredAt:
        typeof item.deferredAt === "string"
          ? item.deferredAt
          : typeof item.deferred_at === "string"
            ? item.deferred_at
            : null,
      deferReason:
        typeof item.deferReason === "string"
          ? item.deferReason
          : typeof item.defer_reason === "string"
            ? item.defer_reason
            : null,
      staleAt:
        typeof item.staleAt === "string"
          ? item.staleAt
          : typeof item.stale_at === "string"
            ? item.stale_at
            : null,
      staleReason:
        typeof item.staleReason === "string"
          ? item.staleReason
          : typeof item.stale_reason === "string"
            ? item.stale_reason
            : null,
      supersededByGenerationRunId:
        typeof item.supersededByGenerationRunId === "string"
          ? item.supersededByGenerationRunId
          : typeof item.superseded_by_generation_run_id === "string"
            ? item.superseded_by_generation_run_id
            : null,
      supersededByPlanRevisionNumber:
        typeof item.supersededByPlanRevisionNumber === "number"
          ? item.supersededByPlanRevisionNumber
          : typeof item.superseded_by_plan_revision_number === "number"
            ? item.superseded_by_plan_revision_number
            : null,
      completedAt:
        typeof item.completedAt === "string"
          ? item.completedAt
          : typeof item.completed_at === "string"
            ? item.completed_at
            : null,
      createdAt:
        typeof item.createdAt === "string"
          ? item.createdAt
          : typeof item.created_at === "string"
            ? item.created_at
            : new Date().toISOString(),
      updatedAt:
        typeof item.updatedAt === "string"
          ? item.updatedAt
          : typeof item.updated_at === "string"
            ? item.updated_at
            : new Date().toISOString(),
    })) as unknown as ProjectBuilderRefreshQueueItemRecord[];
  const rawPlannerRuns = Array.isArray(store.plannerRuns)
    ? (store.plannerRuns as unknown as Array<Record<string, unknown>>)
    : [];
  const normalizedPlannerRuns = rawPlannerRuns.filter((run) =>
    typeof run.id === "string" &&
    typeof run.projectId === "string" &&
    typeof run.workspaceId === "string" &&
    typeof run.status === "string",
  ).map((run) => ({
    ...run,
    briefId:
      typeof run.briefId === "string"
        ? run.briefId
        : typeof run.brief_id === "string"
          ? run.brief_id
          : null,
    briefUpdatedAt:
      typeof run.briefUpdatedAt === "string"
        ? run.briefUpdatedAt
        : typeof run.brief_updated_at === "string"
          ? run.brief_updated_at
          : null,
    generatedPlanRevisionId:
      typeof run.generatedPlanRevisionId === "string"
        ? run.generatedPlanRevisionId
        : typeof run.generated_plan_revision_id === "string"
          ? run.generated_plan_revision_id
          : null,
    generatedPlanRevisionNumber:
      typeof run.generatedPlanRevisionNumber === "number"
        ? run.generatedPlanRevisionNumber
        : typeof run.generated_plan_revision_number === "number"
          ? run.generated_plan_revision_number
          : null,
    inputSnapshot:
      typeof run.inputSnapshot === "object" && run.inputSnapshot
        ? run.inputSnapshot
        : typeof run.input_snapshot === "object" && run.input_snapshot
          ? run.input_snapshot
          : {},
    outputPlan:
      typeof run.outputPlan === "object" && run.outputPlan
        ? run.outputPlan
        : typeof run.output_plan === "object" && run.output_plan
          ? run.output_plan
          : null,
    errorMessage:
      typeof run.errorMessage === "string"
        ? run.errorMessage
        : typeof run.error_message === "string"
          ? run.error_message
          : null,
    startedAt:
      typeof run.startedAt === "string"
        ? run.startedAt
        : typeof run.started_at === "string"
          ? run.started_at
          : new Date().toISOString(),
    completedAt:
      typeof run.completedAt === "string"
        ? run.completedAt
        : typeof run.completed_at === "string"
          ? run.completed_at
          : null,
    createdAt:
      typeof run.createdAt === "string"
        ? run.createdAt
        : typeof run.created_at === "string"
          ? run.created_at
          : new Date().toISOString(),
    updatedAt:
      typeof run.updatedAt === "string"
        ? run.updatedAt
        : typeof run.updated_at === "string"
          ? run.updated_at
          : new Date().toISOString(),
  })) as unknown as PlannerRunRecord[];
  const rawPlannerArtifacts = Array.isArray(store.plannerArtifacts)
    ? (store.plannerArtifacts as unknown as Array<Record<string, unknown>>)
    : [];
  const normalizedPlannerArtifacts = rawPlannerArtifacts.filter((artifact) =>
    typeof artifact.id === "string" &&
    typeof artifact.projectId === "string" &&
    typeof artifact.workspaceId === "string" &&
    typeof artifact.label === "string",
  ).map((artifact) => ({
    ...artifact,
    plannerRunId:
      typeof artifact.plannerRunId === "string"
        ? artifact.plannerRunId
        : typeof artifact.planner_run_id === "string"
          ? artifact.planner_run_id
          : "",
    artifactType:
      typeof artifact.artifactType === "string"
        ? artifact.artifactType
        : typeof artifact.artifact_type === "string"
          ? artifact.artifact_type
          : "plan_payload",
    createdAt:
      typeof artifact.createdAt === "string"
        ? artifact.createdAt
        : typeof artifact.created_at === "string"
          ? artifact.created_at
          : new Date().toISOString(),
  })) as unknown as PlannerArtifactRecord[];
  const nextPlannerRuns = [...normalizedPlannerRuns];
  const nextPlannerArtifacts = [...normalizedPlannerArtifacts];
  const rawGenerationRuns = Array.isArray(store.generationRuns)
    ? (store.generationRuns as unknown as Array<Record<string, unknown>>)
    : [];
  const normalizedGenerationRuns = rawGenerationRuns.filter((run) =>
    typeof run.id === "string" &&
    (typeof run.projectId === "string" || typeof run.project_id === "string") &&
    (typeof run.workspaceId === "string" || typeof run.workspace_id === "string") &&
    (typeof run.sourcePlanRevisionId === "string" || typeof run.source_plan_revision_id === "string") &&
    typeof run.status === "string",
  ).map((run) => ({
    ...run,
    projectId:
      typeof run.projectId === "string"
        ? run.projectId
        : typeof run.project_id === "string"
          ? run.project_id
          : "",
    workspaceId:
      typeof run.workspaceId === "string"
        ? run.workspaceId
        : typeof run.workspace_id === "string"
          ? run.workspace_id
          : "",
    sourcePlanRevisionId:
      typeof run.sourcePlanRevisionId === "string"
        ? run.sourcePlanRevisionId
        : typeof run.source_plan_revision_id === "string"
          ? run.source_plan_revision_id
          : "",
    sourcePlanRevisionNumber:
      typeof run.sourcePlanRevisionNumber === "number"
        ? run.sourcePlanRevisionNumber
        : typeof run.source_plan_revision_number === "number"
          ? run.source_plan_revision_number
          : 1,
    sourcePlanSnapshot:
      typeof run.sourcePlanSnapshot === "object" && run.sourcePlanSnapshot
        ? run.sourcePlanSnapshot
        : typeof run.source_plan_snapshot === "object" && run.source_plan_snapshot
          ? run.source_plan_snapshot
          : emptyStructuredPlan(),
    outputSummary:
      typeof run.outputSummary === "object" && run.outputSummary
        ? run.outputSummary
        : typeof run.output_summary === "object" && run.output_summary
          ? run.output_summary
          : null,
    errorMessage:
      typeof run.errorMessage === "string"
        ? run.errorMessage
        : typeof run.error_message === "string"
          ? run.error_message
          : null,
    startedAt:
      typeof run.startedAt === "string"
        ? run.startedAt
        : typeof run.started_at === "string"
          ? run.started_at
          : new Date().toISOString(),
    completedAt:
      typeof run.completedAt === "string"
        ? run.completedAt
        : typeof run.completed_at === "string"
          ? run.completed_at
          : null,
    createdAt:
      typeof run.createdAt === "string"
        ? run.createdAt
        : typeof run.created_at === "string"
          ? run.created_at
          : new Date().toISOString(),
    updatedAt:
      typeof run.updatedAt === "string"
        ? run.updatedAt
        : typeof run.updated_at === "string"
          ? run.updated_at
          : new Date().toISOString(),
  })) as unknown as GenerationRunRecord[];
  const rawGenerationArtifacts = Array.isArray(store.generationArtifacts)
    ? (store.generationArtifacts as unknown as Array<Record<string, unknown>>)
    : [];
  const normalizedGenerationArtifacts = rawGenerationArtifacts.filter((artifact) =>
    typeof artifact.id === "string" &&
    (typeof artifact.projectId === "string" || typeof artifact.project_id === "string") &&
    (typeof artifact.workspaceId === "string" || typeof artifact.workspace_id === "string") &&
    typeof artifact.label === "string",
  ).map((artifact) => ({
    ...artifact,
    projectId:
      typeof artifact.projectId === "string"
        ? artifact.projectId
        : typeof artifact.project_id === "string"
          ? artifact.project_id
          : "",
    workspaceId:
      typeof artifact.workspaceId === "string"
        ? artifact.workspaceId
        : typeof artifact.workspace_id === "string"
          ? artifact.workspace_id
          : "",
    generationRunId:
      typeof artifact.generationRunId === "string"
        ? artifact.generationRunId
        : typeof artifact.generation_run_id === "string"
          ? artifact.generation_run_id
          : "",
    artifactType:
      typeof artifact.artifactType === "string"
        ? artifact.artifactType
        : typeof artifact.artifact_type === "string"
          ? artifact.artifact_type
          : "route_page_target",
    createdAt:
      typeof artifact.createdAt === "string"
        ? artifact.createdAt
        : typeof artifact.created_at === "string"
          ? artifact.created_at
          : new Date().toISOString(),
  })) as unknown as GenerationArtifactRecord[];
  const rawDeployTargets = Array.isArray(store.deployTargets)
    ? (store.deployTargets as unknown as Array<Record<string, unknown>>)
    : [];
  const normalizedDeployTargets = rawDeployTargets.filter((target) =>
    typeof target.id === "string" &&
    (typeof target.projectId === "string" || typeof target.project_id === "string") &&
    (typeof target.workspaceId === "string" || typeof target.workspace_id === "string"),
  ).map((target) => ({
    ...target,
    name:
      typeof target.name === "string"
        ? target.name
        : "Project production snapshot",
    status:
      typeof target.status === "string"
        ? target.status
        : "idle",
    projectId:
      typeof target.projectId === "string"
        ? target.projectId
        : typeof target.project_id === "string"
          ? target.project_id
          : "",
    workspaceId:
      typeof target.workspaceId === "string"
        ? target.workspaceId
        : typeof target.workspace_id === "string"
          ? target.workspace_id
          : "",
    targetType:
      typeof target.targetType === "string"
        ? target.targetType
        : typeof target.target_type === "string"
          ? target.target_type
          : "internal_snapshot_v1",
    latestDeployRunId:
      typeof target.latestDeployRunId === "string"
        ? target.latestDeployRunId
        : typeof target.latest_deploy_run_id === "string"
          ? target.latest_deploy_run_id
          : null,
    latestDeployRunStatus:
      typeof target.latestDeployRunStatus === "string"
        ? target.latestDeployRunStatus
        : typeof target.latest_deploy_run_status === "string"
          ? target.latest_deploy_run_status
          : null,
    latestPlanRevisionId:
      typeof target.latestPlanRevisionId === "string"
        ? target.latestPlanRevisionId
        : typeof target.latest_plan_revision_id === "string"
          ? target.latest_plan_revision_id
          : null,
    latestPlanRevisionNumber:
      typeof target.latestPlanRevisionNumber === "number"
        ? target.latestPlanRevisionNumber
        : typeof target.latest_plan_revision_number === "number"
          ? target.latest_plan_revision_number
          : null,
    latestVisualRevisionNumber:
      typeof target.latestVisualRevisionNumber === "number"
        ? target.latestVisualRevisionNumber
        : typeof target.latest_visual_revision_number === "number"
          ? target.latest_visual_revision_number
          : null,
    latestCodeRevisionNumber:
      typeof target.latestCodeRevisionNumber === "number"
        ? target.latestCodeRevisionNumber
        : typeof target.latest_code_revision_number === "number"
          ? target.latest_code_revision_number
          : null,
    latestGenerationRunId:
      typeof target.latestGenerationRunId === "string"
        ? target.latestGenerationRunId
        : typeof target.latest_generation_run_id === "string"
          ? target.latest_generation_run_id
          : null,
    latestRuntimeSource:
      typeof target.latestRuntimeSource === "string"
        ? target.latestRuntimeSource
        : typeof target.latest_runtime_source === "string"
          ? target.latest_runtime_source
          : null,
    latestSummary:
      typeof target.latestSummary === "string"
        ? target.latestSummary
        : typeof target.latest_summary === "string"
          ? target.latest_summary
          : null,
    settings: normalizeDeployTargetSettings(
      typeof target.settings === "object" && target.settings
        ? target.settings
        : typeof target.settings_json === "object" && target.settings_json
          ? target.settings_json
          : defaultDeployTargetSettings(),
    ),
    latestReleaseId:
      typeof target.latestReleaseId === "string"
        ? target.latestReleaseId
        : typeof target.latest_release_id === "string"
          ? target.latest_release_id
          : null,
    latestReleaseName:
      typeof target.latestReleaseName === "string"
        ? target.latestReleaseName
        : typeof target.latest_release_name === "string"
          ? target.latest_release_name
          : null,
    latestReleaseNumber:
      typeof target.latestReleaseNumber === "number"
        ? target.latestReleaseNumber
        : typeof target.latest_release_number === "number"
          ? target.latest_release_number
          : null,
    latestExecutionRunId:
      typeof target.latestExecutionRunId === "string"
        ? target.latestExecutionRunId
        : typeof target.latest_execution_run_id === "string"
          ? target.latest_execution_run_id
          : null,
    latestExecutionRunStatus:
      typeof target.latestExecutionRunStatus === "string"
        ? target.latestExecutionRunStatus
        : typeof target.latest_execution_run_status === "string"
          ? target.latest_execution_run_status
          : null,
    hostedDeployment:
      typeof target.hostedDeployment === "object" && target.hostedDeployment
        ? target.hostedDeployment
        : typeof target.hosted_metadata_json === "object" && target.hosted_metadata_json
          ? target.hosted_metadata_json
          : null,
    createdAt:
      typeof target.createdAt === "string"
        ? target.createdAt
        : typeof target.created_at === "string"
          ? target.created_at
          : new Date().toISOString(),
    updatedAt:
      typeof target.updatedAt === "string"
        ? target.updatedAt
        : typeof target.updated_at === "string"
          ? target.updated_at
          : new Date().toISOString(),
  })) as unknown as DeployTargetRecord[];
  const rawDeployRuns = Array.isArray(store.deployRuns)
    ? (store.deployRuns as unknown as Array<Record<string, unknown>>)
    : [];
  const normalizedDeployRuns = rawDeployRuns.filter((run) =>
    typeof run.id === "string" &&
    (typeof run.projectId === "string" || typeof run.project_id === "string") &&
    (typeof run.workspaceId === "string" || typeof run.workspace_id === "string") &&
    (typeof run.deployTargetId === "string" || typeof run.deploy_target_id === "string"),
  ).map((run) => ({
    ...run,
    projectId:
      typeof run.projectId === "string"
        ? run.projectId
        : typeof run.project_id === "string"
          ? run.project_id
          : "",
    workspaceId:
      typeof run.workspaceId === "string"
        ? run.workspaceId
        : typeof run.workspace_id === "string"
          ? run.workspace_id
          : "",
    deployTargetId:
      typeof run.deployTargetId === "string"
        ? run.deployTargetId
        : typeof run.deploy_target_id === "string"
          ? run.deploy_target_id
          : "",
    sourcePlanRevisionId:
      typeof run.sourcePlanRevisionId === "string"
        ? run.sourcePlanRevisionId
        : typeof run.source_plan_revision_id === "string"
          ? run.source_plan_revision_id
          : "",
    sourcePlanRevisionNumber:
      typeof run.sourcePlanRevisionNumber === "number"
        ? run.sourcePlanRevisionNumber
        : typeof run.source_plan_revision_number === "number"
          ? run.source_plan_revision_number
          : 1,
    sourcePlanSnapshot:
      typeof run.sourcePlanSnapshot === "object" && run.sourcePlanSnapshot
        ? run.sourcePlanSnapshot
        : typeof run.source_plan_snapshot === "object" && run.source_plan_snapshot
          ? run.source_plan_snapshot
          : emptyStructuredPlan(),
    sourceVisualRevisionNumber:
      typeof run.sourceVisualRevisionNumber === "number"
        ? run.sourceVisualRevisionNumber
        : typeof run.source_visual_revision_number === "number"
          ? run.source_visual_revision_number
          : 1,
    sourceCodeRevisionNumber:
      typeof run.sourceCodeRevisionNumber === "number"
        ? run.sourceCodeRevisionNumber
        : typeof run.source_code_revision_number === "number"
          ? run.source_code_revision_number
          : 1,
    sourceGenerationRunId:
      typeof run.sourceGenerationRunId === "string"
        ? run.sourceGenerationRunId
        : typeof run.source_generation_run_id === "string"
          ? run.source_generation_run_id
          : null,
    runtimeSource:
      typeof run.runtimeSource === "string"
        ? run.runtimeSource
        : typeof run.runtime_source === "string"
          ? run.runtime_source
          : "visual_fallback",
    outputSummary:
      typeof run.outputSummary === "object" && run.outputSummary
        ? run.outputSummary
        : typeof run.output_summary === "object" && run.output_summary
          ? run.output_summary
          : null,
    errorMessage:
      typeof run.errorMessage === "string"
        ? run.errorMessage
        : typeof run.error_message === "string"
          ? run.error_message
          : null,
    startedAt:
      typeof run.startedAt === "string"
        ? run.startedAt
        : typeof run.started_at === "string"
          ? run.started_at
          : new Date().toISOString(),
    completedAt:
      typeof run.completedAt === "string"
        ? run.completedAt
        : typeof run.completed_at === "string"
          ? run.completed_at
          : null,
    createdAt:
      typeof run.createdAt === "string"
        ? run.createdAt
        : typeof run.created_at === "string"
          ? run.created_at
          : new Date().toISOString(),
    updatedAt:
      typeof run.updatedAt === "string"
        ? run.updatedAt
        : typeof run.updated_at === "string"
          ? run.updated_at
          : new Date().toISOString(),
  })) as unknown as DeployRunRecord[];
  const rawDeployArtifacts = Array.isArray(store.deployArtifacts)
    ? (store.deployArtifacts as unknown as Array<Record<string, unknown>>)
    : [];
  const normalizedDeployArtifacts = rawDeployArtifacts.filter((artifact) =>
    typeof artifact.id === "string" &&
    (typeof artifact.projectId === "string" || typeof artifact.project_id === "string") &&
    (typeof artifact.workspaceId === "string" || typeof artifact.workspace_id === "string") &&
    (typeof artifact.deployRunId === "string" || typeof artifact.deploy_run_id === "string"),
  ).map((artifact) => ({
    ...artifact,
    projectId:
      typeof artifact.projectId === "string"
        ? artifact.projectId
        : typeof artifact.project_id === "string"
          ? artifact.project_id
          : "",
    workspaceId:
      typeof artifact.workspaceId === "string"
        ? artifact.workspaceId
        : typeof artifact.workspace_id === "string"
          ? artifact.workspace_id
          : "",
    deployRunId:
      typeof artifact.deployRunId === "string"
        ? artifact.deployRunId
        : typeof artifact.deploy_run_id === "string"
          ? artifact.deploy_run_id
          : "",
    deployTargetId:
      typeof artifact.deployTargetId === "string"
        ? artifact.deployTargetId
        : typeof artifact.deploy_target_id === "string"
          ? artifact.deploy_target_id
          : "",
    artifactType:
      typeof artifact.artifactType === "string"
        ? artifact.artifactType
        : typeof artifact.artifact_type === "string"
          ? artifact.artifact_type
          : "deploy_snapshot_manifest",
    payload:
      typeof artifact.payload === "object" && artifact.payload
        ? artifact.payload
        : typeof artifact.payload_json === "object" && artifact.payload_json
          ? artifact.payload_json
          : {},
    createdAt:
      typeof artifact.createdAt === "string"
        ? artifact.createdAt
        : typeof artifact.created_at === "string"
          ? artifact.created_at
          : new Date().toISOString(),
  })) as unknown as DeployArtifactRecord[];
  const rawDeployReleases = Array.isArray(store.deployReleases)
    ? (store.deployReleases as unknown as Array<Record<string, unknown>>)
    : [];
  const normalizedDeployReleases = rawDeployReleases.filter((release) =>
    typeof release.id === "string" &&
    (typeof release.projectId === "string" || typeof release.project_id === "string") &&
    (typeof release.workspaceId === "string" || typeof release.workspace_id === "string") &&
    (typeof release.deployTargetId === "string" || typeof release.deploy_target_id === "string") &&
    (typeof release.deployRunId === "string" || typeof release.deploy_run_id === "string"),
  ).map((release) => ({
    ...release,
    projectId:
      typeof release.projectId === "string"
        ? release.projectId
        : typeof release.project_id === "string"
          ? release.project_id
          : "",
    workspaceId:
      typeof release.workspaceId === "string"
        ? release.workspaceId
        : typeof release.workspace_id === "string"
          ? release.workspace_id
          : "",
    deployTargetId:
      typeof release.deployTargetId === "string"
        ? release.deployTargetId
        : typeof release.deploy_target_id === "string"
          ? release.deploy_target_id
          : "",
    deployRunId:
      typeof release.deployRunId === "string"
        ? release.deployRunId
        : typeof release.deploy_run_id === "string"
          ? release.deploy_run_id
          : "",
    releaseNumber:
      typeof release.releaseNumber === "number"
        ? release.releaseNumber
        : typeof release.release_number === "number"
          ? release.release_number
          : 1,
    name:
      typeof release.name === "string"
        ? release.name
        : "Release 1",
    notes:
      typeof release.notes === "string"
        ? release.notes
        : "",
    status:
      typeof release.status === "string"
        ? release.status
        : "promoted",
    sourcePlanRevisionId:
      typeof release.sourcePlanRevisionId === "string"
        ? release.sourcePlanRevisionId
        : typeof release.source_plan_revision_id === "string"
          ? release.source_plan_revision_id
          : "",
    sourcePlanRevisionNumber:
      typeof release.sourcePlanRevisionNumber === "number"
        ? release.sourcePlanRevisionNumber
        : typeof release.source_plan_revision_number === "number"
          ? release.source_plan_revision_number
          : 1,
    sourceVisualRevisionNumber:
      typeof release.sourceVisualRevisionNumber === "number"
        ? release.sourceVisualRevisionNumber
        : typeof release.source_visual_revision_number === "number"
          ? release.source_visual_revision_number
          : 1,
    sourceCodeRevisionNumber:
      typeof release.sourceCodeRevisionNumber === "number"
        ? release.sourceCodeRevisionNumber
        : typeof release.source_code_revision_number === "number"
          ? release.source_code_revision_number
          : 1,
    sourceGenerationRunId:
      typeof release.sourceGenerationRunId === "string"
        ? release.sourceGenerationRunId
        : typeof release.source_generation_run_id === "string"
          ? release.source_generation_run_id
          : null,
    runtimeSource:
      typeof release.runtimeSource === "string"
        ? release.runtimeSource
        : typeof release.runtime_source === "string"
          ? release.runtime_source
          : "visual_fallback",
    promotedByUserId:
      typeof release.promotedByUserId === "string"
        ? release.promotedByUserId
        : typeof release.promoted_by_user_id === "string"
          ? release.promoted_by_user_id
          : null,
    handoffPayload:
      typeof release.handoffPayload === "object" && release.handoffPayload
        ? release.handoffPayload
        : typeof release.handoff_payload_json === "object" && release.handoff_payload_json
          ? release.handoff_payload_json
          : null,
    exportSnapshot:
      typeof release.exportSnapshot === "object" && release.exportSnapshot
        ? release.exportSnapshot
        : typeof release.export_snapshot_json === "object" && release.export_snapshot_json
          ? release.export_snapshot_json
          : null,
    exportFileName:
      typeof release.exportFileName === "string"
        ? release.exportFileName
        : typeof release.export_file_name === "string"
          ? release.export_file_name
          : null,
    handoffPreparedAt:
      typeof release.handoffPreparedAt === "string"
        ? release.handoffPreparedAt
        : typeof release.handoff_prepared_at === "string"
          ? release.handoff_prepared_at
          : null,
    exportedAt:
      typeof release.exportedAt === "string"
        ? release.exportedAt
        : typeof release.exported_at === "string"
          ? release.exported_at
          : null,
    latestExecutionRunId:
      typeof release.latestExecutionRunId === "string"
        ? release.latestExecutionRunId
        : typeof release.latest_execution_run_id === "string"
          ? release.latest_execution_run_id
          : null,
    latestExecutionStatus:
      typeof release.latestExecutionStatus === "string"
        ? release.latestExecutionStatus
        : typeof release.latest_execution_status === "string"
          ? release.latest_execution_status
          : null,
    hostedDeployment:
      typeof release.hostedDeployment === "object" && release.hostedDeployment
        ? release.hostedDeployment
        : typeof release.hosted_metadata_json === "object" && release.hosted_metadata_json
          ? release.hosted_metadata_json
          : null,
    createdAt:
      typeof release.createdAt === "string"
        ? release.createdAt
        : typeof release.created_at === "string"
          ? release.created_at
          : new Date().toISOString(),
    updatedAt:
      typeof release.updatedAt === "string"
        ? release.updatedAt
        : typeof release.updated_at === "string"
          ? release.updated_at
          : new Date().toISOString(),
  })) as unknown as DeployReleaseRecord[];
  const rawDeployHandoffRuns = Array.isArray(store.deployHandoffRuns)
    ? (store.deployHandoffRuns as unknown as Array<Record<string, unknown>>)
    : [];
  const normalizedDeployHandoffRuns = rawDeployHandoffRuns.filter((run) =>
    typeof run.id === "string" &&
    (typeof run.projectId === "string" || typeof run.project_id === "string") &&
    (typeof run.workspaceId === "string" || typeof run.workspace_id === "string") &&
    (typeof run.deployTargetId === "string" || typeof run.deploy_target_id === "string") &&
    (typeof run.releaseId === "string" || typeof run.release_id === "string"),
  ).map((run) => ({
    ...run,
    deployTargetId:
      typeof run.deployTargetId === "string"
        ? run.deployTargetId
        : typeof run.deploy_target_id === "string"
          ? run.deploy_target_id
          : "",
    deployRunId:
      typeof run.deployRunId === "string"
        ? run.deployRunId
        : typeof run.deploy_run_id === "string"
          ? run.deploy_run_id
          : "",
    releaseId:
      typeof run.releaseId === "string"
        ? run.releaseId
        : typeof run.release_id === "string"
          ? run.release_id
          : "",
    workspaceId:
      typeof run.workspaceId === "string"
        ? run.workspaceId
        : typeof run.workspace_id === "string"
          ? run.workspace_id
          : "",
    projectId:
      typeof run.projectId === "string"
        ? run.projectId
        : typeof run.project_id === "string"
          ? run.project_id
          : "",
    source:
      typeof run.source === "string"
        ? run.source
        : "hosting_adapter_simulator_v1",
    adapterPresetKey:
      typeof run.adapterPresetKey === "string"
        ? run.adapterPresetKey
        : typeof run.adapter_preset_key === "string"
          ? run.adapter_preset_key
          : "custom",
    adapterKey:
      typeof run.adapterKey === "string"
        ? run.adapterKey
        : typeof run.adapter_key === "string"
          ? run.adapter_key
          : "static_snapshot_v1",
    status:
      typeof run.status === "string"
        ? run.status
        : "blocked",
    summary:
      typeof run.summary === "string"
        ? run.summary
        : "",
    readinessSummary:
      typeof run.readinessSummary === "object" && run.readinessSummary
        ? run.readinessSummary
        : typeof run.readiness_summary_json === "object" && run.readiness_summary_json
          ? run.readiness_summary_json
          : {
              isReady: false,
              blockingCount: 1,
              warningCount: 0,
              checkedAt: new Date().toISOString(),
              checks: [],
            },
    logs:
      Array.isArray(run.logs)
        ? run.logs
        : Array.isArray(run.logs_json)
          ? run.logs_json
          : [],
    primaryDomain:
      typeof run.primaryDomain === "string"
        ? run.primaryDomain
        : typeof run.primary_domain === "string"
          ? run.primary_domain
          : "",
    environmentKey:
      typeof run.environmentKey === "string"
        ? run.environmentKey
        : typeof run.environment_key === "string"
          ? run.environment_key
          : "",
    exportFileName:
      typeof run.exportFileName === "string"
        ? run.exportFileName
        : typeof run.export_file_name === "string"
          ? run.export_file_name
          : null,
    startedAt:
      typeof run.startedAt === "string"
        ? run.startedAt
        : typeof run.started_at === "string"
          ? run.started_at
          : new Date().toISOString(),
    completedAt:
      typeof run.completedAt === "string"
        ? run.completedAt
        : typeof run.completed_at === "string"
          ? run.completed_at
          : null,
    createdAt:
      typeof run.createdAt === "string"
        ? run.createdAt
        : typeof run.created_at === "string"
          ? run.created_at
          : new Date().toISOString(),
    updatedAt:
      typeof run.updatedAt === "string"
        ? run.updatedAt
        : typeof run.updated_at === "string"
          ? run.updated_at
          : new Date().toISOString(),
  })) as unknown as DeployHandoffRunRecord[];
  const rawDeployExecutionRuns = Array.isArray(store.deployExecutionRuns)
    ? (store.deployExecutionRuns as unknown as Array<Record<string, unknown>>)
    : [];
  const normalizedDeployExecutionRuns = rawDeployExecutionRuns.filter((run) =>
    typeof run.id === "string" &&
    (typeof run.projectId === "string" || typeof run.project_id === "string") &&
    (typeof run.workspaceId === "string" || typeof run.workspace_id === "string") &&
    (typeof run.deployTargetId === "string" || typeof run.deploy_target_id === "string") &&
    (typeof run.releaseId === "string" || typeof run.release_id === "string"),
  ).map((run) => ({
    ...run,
    deployTargetId:
      typeof run.deployTargetId === "string"
        ? run.deployTargetId
        : typeof run.deploy_target_id === "string"
          ? run.deploy_target_id
          : "",
    deployRunId:
      typeof run.deployRunId === "string"
        ? run.deployRunId
        : typeof run.deploy_run_id === "string"
          ? run.deploy_run_id
          : "",
    releaseId:
      typeof run.releaseId === "string"
        ? run.releaseId
        : typeof run.release_id === "string"
          ? run.release_id
          : "",
    workspaceId:
      typeof run.workspaceId === "string"
        ? run.workspaceId
        : typeof run.workspace_id === "string"
          ? run.workspace_id
          : "",
    projectId:
      typeof run.projectId === "string"
        ? run.projectId
        : typeof run.project_id === "string"
          ? run.project_id
          : "",
    requestedAdapterPresetKey:
      typeof run.requestedAdapterPresetKey === "string"
        ? run.requestedAdapterPresetKey
        : typeof run.requested_adapter_preset_key === "string"
          ? run.requested_adapter_preset_key
          : "custom",
    requestedAdapterKey:
      typeof run.requestedAdapterKey === "string"
        ? run.requestedAdapterKey
        : typeof run.requested_adapter_key === "string"
          ? run.requested_adapter_key
          : "static_snapshot_v1",
    actualAdapterKey:
      typeof run.actualAdapterKey === "string"
        ? run.actualAdapterKey
        : typeof run.actual_adapter_key === "string"
          ? run.actual_adapter_key
          : "unsupported_hosting_adapter_v1",
    providerKey:
      typeof run.providerKey === "string"
        ? run.providerKey
        : typeof run.provider_key === "string"
          ? run.provider_key
          : null,
    providerLabel:
      typeof run.providerLabel === "string"
        ? run.providerLabel
        : typeof run.provider_label === "string"
          ? run.provider_label
          : null,
    status:
      typeof run.status === "string"
        ? run.status
        : "blocked",
    summary:
      typeof run.summary === "string"
        ? run.summary
        : "",
    readinessSummary:
      typeof run.readinessSummary === "object" && run.readinessSummary
        ? run.readinessSummary
        : typeof run.readiness_summary_json === "object" && run.readiness_summary_json
          ? run.readiness_summary_json
          : {
              isReady: false,
              blockingCount: 1,
              warningCount: 0,
              checkedAt: new Date().toISOString(),
              checks: [],
            },
    logs:
      Array.isArray(run.logs)
        ? run.logs
        : Array.isArray(run.logs_json)
          ? run.logs_json
          : [],
    statusTransitions:
      Array.isArray(run.statusTransitions)
        ? run.statusTransitions
        : Array.isArray(run.status_transitions_json)
          ? run.status_transitions_json
          : [],
    providerResponse:
      typeof run.providerResponse === "object" && run.providerResponse
        ? run.providerResponse
        : typeof run.provider_response_json === "object" && run.provider_response_json
          ? run.provider_response_json
          : null,
    latestProviderStatus:
      typeof run.latestProviderStatus === "string"
        ? run.latestProviderStatus
        : typeof run.latest_provider_status === "string"
          ? run.latest_provider_status
          : null,
    hostedUrl:
      typeof run.hostedUrl === "string"
        ? run.hostedUrl
        : typeof run.hosted_url === "string"
          ? run.hosted_url
          : null,
    hostedInspectionUrl:
      typeof run.hostedInspectionUrl === "string"
        ? run.hostedInspectionUrl
        : typeof run.hosted_inspection_url === "string"
          ? run.hosted_inspection_url
          : null,
    providerDeploymentId:
      typeof run.providerDeploymentId === "string"
        ? run.providerDeploymentId
        : typeof run.provider_deployment_id === "string"
          ? run.provider_deployment_id
          : null,
    primaryDomain:
      typeof run.primaryDomain === "string"
        ? run.primaryDomain
        : typeof run.primary_domain === "string"
          ? run.primary_domain
          : "",
    environmentKey:
      typeof run.environmentKey === "string"
        ? run.environmentKey
        : typeof run.environment_key === "string"
          ? run.environment_key
          : "",
    lastCheckedAt:
      typeof run.lastCheckedAt === "string"
        ? run.lastCheckedAt
        : typeof run.last_checked_at === "string"
          ? run.last_checked_at
          : null,
    retryOfExecutionRunId:
      typeof run.retryOfExecutionRunId === "string"
        ? run.retryOfExecutionRunId
        : typeof run.retry_of_execution_run_id === "string"
          ? run.retry_of_execution_run_id
          : null,
    attemptNumber:
      typeof run.attemptNumber === "number"
        ? run.attemptNumber
        : typeof run.attempt_number === "number"
          ? run.attempt_number
          : 1,
    errorMessage:
      typeof run.errorMessage === "string"
        ? run.errorMessage
        : typeof run.error_message === "string"
          ? run.error_message
          : null,
    startedAt:
      typeof run.startedAt === "string"
        ? run.startedAt
        : typeof run.started_at === "string"
          ? run.started_at
          : new Date().toISOString(),
    completedAt:
      typeof run.completedAt === "string"
        ? run.completedAt
        : typeof run.completed_at === "string"
          ? run.completed_at
          : null,
    createdAt:
      typeof run.createdAt === "string"
        ? run.createdAt
        : typeof run.created_at === "string"
          ? run.created_at
          : new Date().toISOString(),
    updatedAt:
      typeof run.updatedAt === "string"
        ? run.updatedAt
        : typeof run.updated_at === "string"
          ? run.updated_at
          : new Date().toISOString(),
  })) as unknown as DeployExecutionRunRecord[];
  const rawModelAdapterConfigs = Array.isArray(store.modelAdapterConfigs)
    ? (store.modelAdapterConfigs as unknown as Array<Record<string, unknown>>)
    : [];
  const normalizedModelAdapterConfigs = rawModelAdapterConfigs.filter((config) =>
    typeof config.id === "string" &&
    (typeof config.projectId === "string" || typeof config.project_id === "string") &&
    (typeof config.workspaceId === "string" || typeof config.workspace_id === "string"),
  ).map((config) => ({
    ...config,
    projectId:
      typeof config.projectId === "string"
        ? config.projectId
        : typeof config.project_id === "string"
          ? config.project_id
          : "",
    workspaceId:
      typeof config.workspaceId === "string"
        ? config.workspaceId
        : typeof config.workspace_id === "string"
          ? config.workspace_id
          : "",
    planningSelection:
      config.planningSelection === "external_model" || config.planning_selection === "external_model"
        ? "external_model"
        : "deterministic_internal",
    generationSelection:
      config.generationSelection === "external_model" || config.generation_selection === "external_model"
        ? "external_model"
        : "deterministic_internal",
    patchSelection:
      config.patchSelection === "external_model" || config.patch_selection === "external_model"
        ? "external_model"
        : "deterministic_internal",
    externalProviderKey:
      config.externalProviderKey === "openai_compatible" ||
      config.externalProviderKey === "custom_http"
        ? config.externalProviderKey
        : config.external_provider_key === "openai_compatible" ||
            config.external_provider_key === "custom_http"
          ? config.external_provider_key
          : null,
    externalProviderLabel:
      typeof config.externalProviderLabel === "string"
        ? config.externalProviderLabel
        : typeof config.external_provider_label === "string"
          ? config.external_provider_label
          : null,
    externalEndpointUrl:
      typeof config.externalEndpointUrl === "string"
        ? config.externalEndpointUrl
        : typeof config.external_endpoint_url === "string"
          ? config.external_endpoint_url
          : null,
    externalApiKeyEnvVar:
      typeof config.externalApiKeyEnvVar === "string"
        ? config.externalApiKeyEnvVar
        : typeof config.external_api_key_env_var === "string"
          ? config.external_api_key_env_var
          : null,
    planningModel:
      typeof config.planningModel === "string"
        ? config.planningModel
        : typeof config.planning_model === "string"
          ? config.planning_model
          : null,
    generationModel:
      typeof config.generationModel === "string"
        ? config.generationModel
        : typeof config.generation_model === "string"
          ? config.generation_model
          : null,
    patchModel:
      typeof config.patchModel === "string"
        ? config.patchModel
        : typeof config.patch_model === "string"
          ? config.patch_model
          : null,
    createdAt:
      typeof config.createdAt === "string"
        ? config.createdAt
        : typeof config.created_at === "string"
          ? config.created_at
          : new Date().toISOString(),
    updatedAt:
      typeof config.updatedAt === "string"
        ? config.updatedAt
        : typeof config.updated_at === "string"
          ? config.updated_at
          : new Date().toISOString(),
  })) as unknown as ProjectModelAdapterConfigRecord[];
  const rawModelAdapterRuns = Array.isArray(store.modelAdapterRuns)
    ? (store.modelAdapterRuns as unknown as Array<Record<string, unknown>>)
    : [];
  const normalizedModelAdapterRuns = rawModelAdapterRuns.filter((run) =>
    typeof run.id === "string" &&
    (typeof run.projectId === "string" || typeof run.project_id === "string") &&
    (typeof run.workspaceId === "string" || typeof run.workspace_id === "string") &&
    typeof run.capability === "string",
  ).map((run) => ({
    ...run,
    projectId:
      typeof run.projectId === "string"
        ? run.projectId
        : typeof run.project_id === "string"
          ? run.project_id
          : "",
    workspaceId:
      typeof run.workspaceId === "string"
        ? run.workspaceId
        : typeof run.workspace_id === "string"
          ? run.workspace_id
          : "",
    requestedSelection:
      run.requestedSelection === "external_model" || run.requested_selection === "external_model"
        ? "external_model"
        : "deterministic_internal",
    executedSelection:
      run.executedSelection === "external_model" || run.executed_selection === "external_model"
        ? "external_model"
        : "deterministic_internal",
    sourceType:
      run.sourceType === "external_model" || run.source_type === "external_model"
        ? "external_model"
        : "deterministic_internal",
    executionMode:
      run.executionMode === "fallback" || run.execution_mode === "fallback"
        ? "fallback"
        : "selected",
    requestedAdapterKey:
      typeof run.requestedAdapterKey === "string"
        ? run.requestedAdapterKey
        : typeof run.requested_adapter_key === "string"
          ? run.requested_adapter_key
          : "",
    executedAdapterKey:
      typeof run.executedAdapterKey === "string"
        ? run.executedAdapterKey
        : typeof run.executed_adapter_key === "string"
          ? run.executed_adapter_key
          : "",
    providerKey:
      run.providerKey === "openai_compatible" || run.providerKey === "custom_http"
        ? run.providerKey
        : run.provider_key === "openai_compatible" || run.provider_key === "custom_http"
          ? run.provider_key
          : null,
    providerLabel:
      typeof run.providerLabel === "string"
        ? run.providerLabel
        : typeof run.provider_label === "string"
          ? run.provider_label
          : null,
    modelName:
      typeof run.modelName === "string"
        ? run.modelName
        : typeof run.model_name === "string"
          ? run.model_name
          : null,
    endpointUrl:
      typeof run.endpointUrl === "string"
        ? run.endpointUrl
        : typeof run.endpoint_url === "string"
          ? run.endpoint_url
          : null,
    latencyMs:
      typeof run.latencyMs === "number"
        ? run.latencyMs
        : typeof run.latency_ms === "number"
          ? run.latency_ms
          : null,
    trace:
      typeof run.trace === "object" && run.trace
        ? run.trace
        : typeof run.trace_json === "object" && run.trace_json
          ? run.trace_json
          : null,
    fallbackReason:
      typeof run.fallbackReason === "string"
        ? run.fallbackReason
        : typeof run.fallback_reason === "string"
          ? run.fallback_reason
          : null,
    metadata:
      typeof run.metadata === "object" && run.metadata
        ? run.metadata
        : typeof run.metadata_json === "object" && run.metadata_json
          ? run.metadata_json
          : {},
    linkedEntityType:
      run.linkedEntityType === "planner_run" ||
      run.linkedEntityType === "generation_run" ||
      run.linkedEntityType === "patch_proposal"
        ? run.linkedEntityType
        : run.linked_entity_type === "planner_run" ||
            run.linked_entity_type === "generation_run" ||
            run.linked_entity_type === "patch_proposal"
          ? run.linked_entity_type
          : null,
    linkedEntityId:
      typeof run.linkedEntityId === "string"
        ? run.linkedEntityId
        : typeof run.linked_entity_id === "string"
          ? run.linked_entity_id
          : null,
    retryOfRunId:
      typeof run.retryOfRunId === "string"
        ? run.retryOfRunId
        : typeof run.retry_of_run_id === "string"
          ? run.retry_of_run_id
          : null,
    attemptNumber:
      typeof run.attemptNumber === "number"
        ? run.attemptNumber
        : typeof run.attempt_number === "number"
          ? run.attempt_number
          : 1,
    errorMessage:
      typeof run.errorMessage === "string"
        ? run.errorMessage
        : typeof run.error_message === "string"
          ? run.error_message
          : null,
    startedAt:
      typeof run.startedAt === "string"
        ? run.startedAt
        : typeof run.started_at === "string"
          ? run.started_at
          : new Date().toISOString(),
    completedAt:
      typeof run.completedAt === "string"
        ? run.completedAt
        : typeof run.completed_at === "string"
          ? run.completed_at
          : null,
    createdAt:
      typeof run.createdAt === "string"
        ? run.createdAt
        : typeof run.created_at === "string"
          ? run.created_at
          : new Date().toISOString(),
    updatedAt:
      typeof run.updatedAt === "string"
        ? run.updatedAt
        : typeof run.updated_at === "string"
          ? run.updated_at
          : new Date().toISOString(),
  })) as unknown as ModelAdapterRunRecord[];
  const nextProjectBriefs = [...normalizedProjectBriefs];

  normalizedProjects.forEach((project) => {
    if (!nextProjectBriefs.find((brief) => brief.projectId === project.id)) {
      nextProjectBriefs.push(synthesizeProjectBrief(project));
    }
  });

  normalizedProjects.forEach((project) => {
    const hasRun = nextPlannerRuns.some((run) => run.projectId === project.id);

    if (hasRun) {
      return;
    }

    const earliestRevision =
      nextRevisions
        .filter((revision) => revision.projectId === project.id)
        .sort((left, right) => left.revisionNumber - right.revisionNumber)[0] ?? null;

    if (!earliestRevision) {
      return;
    }

    const brief =
      nextProjectBriefs.find((item) => item.projectId === project.id) ??
      synthesizeProjectBrief(project);
    const synthesized = synthesizeInitialPlannerRun(project, brief, earliestRevision);
    nextPlannerRuns.push(synthesized.run);
    nextPlannerArtifacts.push(...synthesized.artifactRecords);
  });

  const nextNormalizedPlannerRuns = nextPlannerRuns.map((run) => {
    if (run.briefId && run.briefUpdatedAt) {
      return run;
    }

    const fallbackBrief = nextProjectBriefs.find((brief) => brief.projectId === run.projectId);

    if (!fallbackBrief) {
      return run;
    }

    return {
      ...run,
      briefId: run.briefId ?? fallbackBrief.id,
      briefUpdatedAt: run.briefUpdatedAt ?? fallbackBrief.updatedAt,
    };
  });

  return {
    users: normalizedUsers.length > 0 ? normalizedUsers : seededUsers,
    authSessions: normalizedSessions,
    workspaces: normalizedWorkspaces.length > 0 ? normalizedWorkspaces : seededWorkspaces,
    workspaceMembers:
      normalizedWorkspaceMembers.length > 0 ? normalizedWorkspaceMembers : seededWorkspaceMembers,
    workspaceInvitations:
      normalizedWorkspaceInvitations.length > 0 ? normalizedWorkspaceInvitations : seededWorkspaceInvitations,
    workspaceMemberEvents: normalizedWorkspaceMemberEvents,
    projects:
      normalizedProjectsWithOwnership.length > 0 ? normalizedProjectsWithOwnership : seededProjects,
    projectBriefs: nextProjectBriefs.length > 0 ? nextProjectBriefs : seededProjectBriefs,
    planRevisions: nextRevisions.length > 0 ? nextRevisions : seededPlanRevisions,
    visualStates: (store.visualStates ?? seededVisualStates) as VisualStateRecord[],
    visualPages: (store.visualPages ?? seededVisualPages) as VisualPageRecord[],
    visualSections: (store.visualSections ?? seededVisualSections) as VisualSectionRecord[],
    codeStates: (store.codeStates ?? seededCodeStates) as CodeWorkspaceStateRecord[],
    projectFiles: normalizedProjectFiles.length > 0 ? normalizedProjectFiles : seededProjectFiles,
    projectFileRevisions:
      normalizedProjectFileRevisions.length > 0
        ? normalizedProjectFileRevisions
        : seededProjectFileRevisions,
    projectFileLinks: normalizedProjectFileLinks,
    projectPatchProposals: normalizedProjectPatchProposals,
    projectAuditTimelineEvents: normalizedProjectAuditTimelineEvents,
    projectBuilderRefreshQueueItems: normalizedProjectBuilderRefreshQueueItems,
    plannerRuns:
      nextNormalizedPlannerRuns.length > 0 ? nextNormalizedPlannerRuns : seededPlannerRuns,
    plannerArtifacts:
      nextPlannerArtifacts.length > 0 ? nextPlannerArtifacts : seededPlannerArtifacts,
    generationRuns: normalizedGenerationRuns,
    generationArtifacts: normalizedGenerationArtifacts,
    deployTargets: normalizedDeployTargets,
    deployRuns: normalizedDeployRuns,
    deployArtifacts: normalizedDeployArtifacts,
    deployReleases: normalizedDeployReleases,
    deployHandoffRuns: normalizedDeployHandoffRuns,
    deployExecutionRuns: normalizedDeployExecutionRuns,
    modelAdapterConfigs: normalizedModelAdapterConfigs,
    modelAdapterRuns: normalizedModelAdapterRuns,
  } satisfies LocalStoreShape;
}

export async function readLocalStore() {
  await ensureFile();
  const parsed = await readParsedStore();
  const normalized = normalizeLocalStore(parsed);

  if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
    await writeLocalStore(normalized);
  }

  return normalized;
}

export async function writeLocalStore(store: LocalStoreShape) {
  await ensureFile();
  const tempFile = `${DATA_FILE}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, JSON.stringify(store, null, 2), "utf-8");
  await rename(tempFile, DATA_FILE);
}
