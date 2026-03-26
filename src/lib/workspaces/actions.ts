"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { hashPassword } from "@/lib/auth/password";
import {
  assertProjectPermission,
  assertWorkspacePermission,
  workspaceRoleLabel,
} from "@/lib/auth/access";
import { requireAuthenticatedUserOrRedirect } from "@/lib/auth/actions";
import {
  acceptWorkspaceInvitation,
  appendWorkspaceMemberEvent,
  createPasswordUser,
  createWorkspaceInvitation,
  createWorkspaceMembership,
  deactivateWorkspaceMembership,
  findUserByEmail,
  getWorkspaceMembership,
  listWorkspaceMembers,
  reactivateWorkspaceMembership,
  revokeWorkspaceInvitation,
  signInUserWithPassword,
  updateWorkspaceMembershipRole,
} from "@/lib/auth/repository";
import { appendProjectAuditEvent } from "@/lib/builder/audit-repository";
import { enqueueProjectBuilderRefreshQueue } from "@/lib/builder/refresh-queue-repository";
import { projectBaseRoute, projectTabRoute, projectTimelineRoute } from "@/lib/builder/routes";
import type {
  BuilderImpactSurfaceRecord,
  BuilderRefreshSurface,
} from "@/lib/builder/types";
import {
  getProjectGenerationBundle,
  recordProjectGenerationRun,
} from "@/lib/generation/repository";
import { findLatestCompletedGenerationRun } from "@/lib/generation/runs";
import { getGenerationService } from "@/lib/generation/service";
import { ModelAdapterExecutionError } from "@/lib/model-adapters/errors";
import { isValidEnvVarName } from "@/lib/model-adapters/openai-compatible";
import {
  getProjectModelAdapterConfigByIds,
  recordProjectModelAdapterRun,
  saveProjectModelAdapterConfig,
} from "@/lib/model-adapters/repository";
import {
  buildProviderVerificationFailureExecution,
  verifyExternalProviderCapability,
} from "@/lib/model-adapters/verification";
import { withCapabilitySelectionOverride } from "@/lib/model-adapters/registry";
import type { ModelAdapterCapability } from "@/lib/model-adapters/types";
import { recordProjectPlannerRun } from "@/lib/planner/repository";
import { applyPlanSectionUpdate } from "@/lib/planner/plan-sections";
import { getPlannerService } from "@/lib/planner/service";
import type { PlannerInput, PlannerResult } from "@/lib/planner/types";
import { plannerInputFromBrief } from "@/lib/planner/utils";
import type { FormState } from "@/lib/workspaces/form-state";
import {
  getApprovedAndCandidateRevisions,
  getProjectPlanPromotionBundle,
} from "@/lib/workspaces/plan-promotion";
import {
  createPlanRevision,
  createProject,
  createWorkspace,
  getWorkspaceInvitationAcceptanceBundle,
  getWorkspaceMemberManagementBundle,
  getProjectPlanBundle,
  getWorkspaceWithProjects,
  updateWorkspaceOwner,
  updateProjectBrief,
} from "@/lib/workspaces/repository";
import { getWorkspaceInvitationDisplayStatus } from "@/lib/workspaces/utils";
import type {
  Country,
  CreateProjectInput,
  CreateWorkspaceInput,
  PlanSectionKey,
  ProjectBriefFields,
  ProjectCapabilities,
  ProjectRecord,
  ProjectType,
  WorkspaceRole,
} from "@/lib/workspaces/types";

function permissionError(message: string): FormState {
  return {
    status: "error",
    message,
  };
}

function successState(message: string): FormState {
  return {
    status: "success",
    message,
  };
}

function localized(locale: string, sq: string, en: string) {
  return locale === "sq" ? sq : en;
}

function rethrowRedirectError(error: unknown) {
  if (isRedirectError(error)) {
    throw error;
  }
}

function parseSupportedLocales(formData: FormData): Array<"sq" | "en"> {
  const locales = formData
    .getAll("supportedLocales")
    .map((value) => String(value))
    .filter((value): value is "sq" | "en" => value === "sq" || value === "en");

  return locales.length > 0 ? locales : ["sq"];
}

function normalizeSupportedLocales(primaryLocale: "sq" | "en", supportedLocales: Array<"sq" | "en">) {
  const unique = Array.from(new Set([primaryLocale, ...supportedLocales]));
  return unique.length > 0 ? unique : [primaryLocale];
}

function parseDesiredPages(formData: FormData) {
  return String(formData.get("desiredPagesFeatures") ?? "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCapabilities(formData: FormData): ProjectCapabilities {
  return {
    auth: formData.get("needsAuth") === "on",
    payments: formData.get("needsPayments") === "on",
    cms: formData.get("needsCms") === "on",
    fileUpload: formData.get("needsFileUpload") === "on",
    aiChat: formData.get("needsAiChat") === "on",
    calendar: formData.get("needsCalendar") === "on",
    analytics: formData.get("needsAnalytics") === "on",
  };
}

function parseProjectBriefFields(
  formData: FormData,
  defaults: {
    defaultLocale: "sq" | "en";
    country: Country;
    businessCategory: string;
  },
): ProjectBriefFields {
  const primaryLocale = String(formData.get("primaryLocale") ?? defaults.defaultLocale) === "en" ? "en" : "sq";
  const supportedLocales = normalizeSupportedLocales(primaryLocale, parseSupportedLocales(formData));

  return {
    name: String(formData.get("name") ?? "").trim(),
    prompt: String(formData.get("prompt") ?? "").trim(),
    projectType: String(formData.get("projectType") ?? "website") as ProjectType,
    targetUsers: String(formData.get("targetUsers") ?? "").trim(),
    desiredPagesFeatures: parseDesiredPages(formData),
    designStyle: String(formData.get("designStyle") ?? "premium-minimal").trim(),
    primaryLocale,
    supportedLocales,
    country: String(formData.get("country") ?? defaults.country) as Country,
    businessCategory: String(formData.get("businessCategory") ?? defaults.businessCategory).trim(),
    capabilities: parseCapabilities(formData),
  };
}

function planRoute(locale: string, workspaceSlug: string, projectSlug: string) {
  return projectTabRoute(locale, workspaceSlug, projectSlug, "plan");
}

function workspaceRoute(locale: string, workspaceSlug: string) {
  return `/${locale}/app/workspaces/${workspaceSlug}`;
}

function revalidatePlanReviewRoutes(locale: string, workspaceSlug: string, projectSlug: string) {
  revalidatePath(projectBaseRoute(locale, workspaceSlug, projectSlug), "layout");
  revalidatePath(planRoute(locale, workspaceSlug, projectSlug));
  revalidatePath(projectTimelineRoute(locale, workspaceSlug, projectSlug));
}

function revalidatePlanAndQueueRoutes(locale: string, workspaceSlug: string, projectSlug: string) {
  revalidatePlanReviewRoutes(locale, workspaceSlug, projectSlug);
  revalidatePath(projectTabRoute(locale, workspaceSlug, projectSlug, "visual"));
  revalidatePath(projectTabRoute(locale, workspaceSlug, projectSlug, "code"));
}

function revalidateWorkspaceManagementRoutes(locale: string, workspaceSlug: string) {
  revalidatePath(`/${locale}/app/workspaces`);
  revalidatePath(workspaceRoute(locale, workspaceSlug));
  revalidatePath(workspaceRoute(locale, workspaceSlug), "layout");
}

function buildGenerationQueueSummary(input: {
  surface: "visual" | "code";
  targetRevisionNumber: number;
  outputSummary: {
    visualPageCount: number;
    visualSectionCount: number;
    codeFileCount: number;
    routeCount: number;
  } | null;
  requiresManualReview: boolean;
}) {
  const baseSummary =
    input.surface === "visual"
      ? `Generation target prepared for revision ${input.targetRevisionNumber}: ${input.outputSummary?.visualPageCount ?? 0} pages and ${input.outputSummary?.visualSectionCount ?? 0} sections are ready for Visual intake.`
      : `Generation target prepared for revision ${input.targetRevisionNumber}: ${input.outputSummary?.codeFileCount ?? 0} files across ${input.outputSummary?.routeCount ?? 0} routes are ready for Code review.`;

  return input.requiresManualReview ? `${baseSummary} Manual review is required.` : baseSummary;
}

function parseQueueMode(value: FormDataEntryValue | null): BuilderRefreshSurface[] {
  switch (String(value ?? "")) {
    case "visual":
      return ["visual"];
    case "code":
      return ["code"];
    case "both":
      return ["visual", "code"];
    default:
      return [];
  }
}

function parseAdapterSelection(value: FormDataEntryValue | null) {
  return String(value ?? "") === "external_model" ? "external_model" : "deterministic_internal";
}

function parseRequestedAdapterSelection(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();

  if (normalized === "external_model" || normalized === "deterministic_internal") {
    return normalized;
  }

  return null;
}

function parseRetryOfRunId(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function parseModelAdapterCapability(value: FormDataEntryValue | null): ModelAdapterCapability | null {
  const normalized = String(value ?? "").trim();

  if (
    normalized === "planning" ||
    normalized === "generation" ||
    normalized === "patch_suggestion"
  ) {
    return normalized;
  }

  return null;
}

function parseWorkspaceRole(value: FormDataEntryValue | null): WorkspaceRole | null {
  const normalized = String(value ?? "");

  return normalized === "owner" ||
    normalized === "admin" ||
    normalized === "editor" ||
    normalized === "viewer"
    ? normalized
    : null;
}

function suggestedMemberNameFromEmail(email: string) {
  const prefix = email.split("@")[0] ?? "";

  return prefix
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function appendWorkspaceLifecycleEvent(input: {
  workspaceId: string;
  membershipId?: string | null;
  invitationId?: string | null;
  memberUserId?: string | null;
  actorUserId?: string | null;
  actorLabel: string;
  eventType:
    | "member_added"
    | "member_role_changed"
    | "invitation_created"
    | "invitation_accepted"
    | "invitation_revoked"
    | "invitation_resent"
    | "member_deactivated"
    | "member_reactivated"
    | "owner_transferred";
  memberEmail: string;
  memberName: string;
  previousRole: WorkspaceRole | null;
  nextRole: WorkspaceRole;
  summary: string;
  occurredAt?: string;
}) {
  await appendWorkspaceMemberEvent({
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    membershipId: input.membershipId ?? null,
    invitationId: input.invitationId ?? null,
    memberUserId: input.memberUserId ?? null,
    actorUserId: input.actorUserId ?? null,
    actorLabel: input.actorLabel,
    eventType: input.eventType,
    memberEmail: input.memberEmail,
    memberName: input.memberName,
    previousRole: input.previousRole,
    nextRole: input.nextRole,
    summary: input.summary,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  });
}

function buildProjectOwnershipTransferNote(input: {
  projects: Array<Pick<ProjectRecord, "ownerUserId">>;
  nextWorkspaceOwnerUserId: string;
  previousWorkspaceOwnerUserId: string;
  locale: string;
}) {
  const ownedByNextWorkspaceOwner = input.projects.filter(
    (project) => project.ownerUserId === input.nextWorkspaceOwnerUserId,
  ).length;
  const ownedByPreviousWorkspaceOwner = input.projects.filter(
    (project) => project.ownerUserId === input.previousWorkspaceOwnerUserId,
  ).length;
  const ownedByOtherMembers =
    input.projects.length - ownedByNextWorkspaceOwner - ownedByPreviousWorkspaceOwner;

  if (input.projects.length === 0) {
    return localized(
      input.locale,
      "Ky workspace nuk ka projekte aktive për rishikim të ownership-it.",
      "This workspace has no active projects to review for ownership visibility.",
    );
  }

  return localized(
    input.locale,
    `Project ownership mbetet i ndarë nga workspace ownership: ${ownedByNextWorkspaceOwner} projekt(e) te owner-i i ri, ${ownedByPreviousWorkspaceOwner} te owner-i i mëparshëm dhe ${ownedByOtherMembers} te anëtarë të tjerë. Rishiko kartelën e ownership alignment më poshtë nëse do të përgatisësh reasignime manuale.`,
    `Project ownership stays separate from workspace ownership: ${ownedByNextWorkspaceOwner} project(s) owned by the new workspace owner, ${ownedByPreviousWorkspaceOwner} by the previous owner, and ${ownedByOtherMembers} by other members. Review the ownership alignment card below if you want to prepare manual reassignment.`,
  );
}

async function appendPlanRevisionAudit(input: {
  workspaceId: string;
  projectId: string;
  revision: {
    id: string;
    revisionNumber: number;
    state: "generated" | "draft_saved" | "needs_changes" | "approved";
    editedSection: string;
    plannerSource: string;
    changeSummary: string;
    createdAt: string;
  };
}) {
  if (input.revision.state === "generated") {
    return;
  }

  await appendProjectAuditEvent({
    id: `audit-plan-revision-${input.revision.id}`,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    source: "plan",
    kind: "plan_revision",
    title: `Plan revision ${input.revision.revisionNumber} ${input.revision.state}`,
    summary: input.revision.changeSummary,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "plan_revision",
    entityId: input.revision.id,
    linkedTab: "plan",
    linkContext: {
      tab: "plan",
      planRevisionId: input.revision.id,
      planRevisionNumber: input.revision.revisionNumber,
    },
    metadata: {
      state: input.revision.state,
      editedSection: input.revision.editedSection,
      plannerSource: input.revision.plannerSource,
    },
    occurredAt: input.revision.createdAt,
  });
}

function generationQueueDraftForSurface(input: {
  surface: BuilderRefreshSurface;
  targetPlanRevisionId: string;
  targetPlanRevisionNumber: number;
  surfaceState: BuilderImpactSurfaceRecord;
}) {
  const needsRefresh =
    !input.surfaceState.exists ||
    (input.surfaceState.pinnedRevisionNumber ?? 0) < input.targetPlanRevisionNumber;

  if (!needsRefresh) {
    return null;
  }

  return {
    surface: input.surface,
    targetPlanRevisionId: input.targetPlanRevisionId,
    targetPlanRevisionNumber: input.targetPlanRevisionNumber,
    pinnedPlanRevisionNumber: input.surfaceState.pinnedRevisionNumber,
    requiresManualReview: input.surfaceState.requiresManualReview,
  };
}

export async function createWorkspaceAction(
  locale: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentUser = await requireAuthenticatedUserOrRedirect(locale, `/${locale}/app/workspaces/new`);
  const name = String(formData.get("name") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const businessCategory = String(formData.get("businessCategory") ?? "").trim();
  const country = String(formData.get("country") ?? "kosovo") as Country;
  const defaultLocale = String(formData.get("defaultLocale") ?? "sq");
  const intentNotes = String(formData.get("intentNotes") ?? "").trim();
  const supportedLocales = parseSupportedLocales(formData);

  if (!name || !companyName || !businessCategory) {
    return {
      status: "error",
      message: "Please complete the required workspace fields before continuing.",
    };
  }

  const workspaceInput: CreateWorkspaceInput = {
    name,
    companyName,
    businessCategory,
    country,
    defaultLocale: defaultLocale === "en" ? "en" : "sq",
    supportedLocales,
    intentNotes,
    ownerUserId: currentUser.id,
    createdByUserId: currentUser.id,
  };

  try {
    const workspace = await createWorkspace(workspaceInput);
    redirect(`/${locale}/app/workspaces/${workspace.slug}`);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Workspace creation failed.",
    };
  }
}

export async function addWorkspaceMemberAction(
  locale: string,
  workspaceSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuthenticatedUserOrRedirect(locale, workspaceRoute(locale, workspaceSlug));
  const workspace = await getWorkspaceMemberManagementBundle(workspaceSlug);

  if (!workspace) {
    return {
      status: "error",
      message: localized(locale, "Workspace-i nuk u gjet.", "Workspace not found."),
    };
  }

  try {
    assertWorkspacePermission(
      workspace.permissions,
      "canManageWorkspace",
      localized(
        locale,
        "Nuk ke leje për të menaxhuar anëtarët e këtij workspace-i.",
        "You do not have permission to manage members in this workspace.",
      ),
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : localized(locale, "Qasja u refuzua.", "Access denied."));
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = parseWorkspaceRole(formData.get("role"));

  if (!email || !role) {
    return {
      status: "error",
      message: localized(
        locale,
        "Shkruaj email-in dhe zgjedh rolin për anëtarin e ri.",
        "Enter the member email and choose a role.",
      ),
    };
  }

  if (role === "owner") {
    return {
      status: "error",
      message: localized(
        locale,
        "Roli Owner nuk caktohet nga kjo formë.",
        "The Owner role cannot be assigned from this form.",
      ),
    };
  }

  try {
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      const existingMembership = await getWorkspaceMembership(workspace.workspace.id, existingUser.id);

      if (existingMembership) {
        return {
          status: "error",
          message: localized(
            locale,
            existingMembership.status === "deactivated"
              ? "Ky përdorues është i çaktivizuar në këtë workspace. Përdor reaktivizimin në listën e anëtarëve."
              : "Ky përdorues është tashmë anëtar aktiv i workspace-it.",
            existingMembership.status === "deactivated"
              ? "This user is deactivated in this workspace. Use the member reactivation control instead."
              : "This user is already an active member of the workspace.",
          ),
        };
      }
    }

    const existingInvitation = workspace.invitations.find(
      (invitation) => invitation.email === email && invitation.status === "pending",
    );

    if (existingInvitation) {
      const displayStatus = getWorkspaceInvitationDisplayStatus(existingInvitation);
      return {
        status: "error",
        message: localized(
          locale,
          displayStatus === "expired"
            ? "Ekziston tashmë një ftesë e skaduar për këtë email. Përdor ridërgimin nga lista e ftesave që historia e link-ut të ruhet."
            : "Ekziston tashmë një ftesë aktive për këtë email.",
          displayStatus === "expired"
            ? "There is already an expired invitation for this email. Use resend from the invitation list so the delivery history stays intact."
            : "There is already an active invitation for this email.",
        ),
      };
    }

    const invitation = await createWorkspaceInvitation({
      workspaceId: workspace.workspace.id,
      invitedByUserId: workspace.currentUser.id,
      email,
      role,
      deliveryAttemptNumber: 1,
      resentFromInvitationId: null,
    });

    await appendWorkspaceLifecycleEvent({
      workspaceId: workspace.workspace.id,
      invitationId: invitation.id,
      memberUserId: existingUser?.id ?? null,
      actorUserId: workspace.currentUser.id,
      actorLabel: workspace.currentUser.fullName,
      eventType: "invitation_created",
      memberEmail: invitation.email,
      memberName: existingUser?.fullName || suggestedMemberNameFromEmail(invitation.email) || invitation.email,
      previousRole: null,
      nextRole: role,
      summary: `${workspace.currentUser.fullName} invited ${invitation.email} as ${workspaceRoleLabel(role)}.`,
    });

    revalidateWorkspaceManagementRoutes(locale, workspaceSlug);

    return successState(
      localized(
        locale,
        `Ftesa për ${invitation.email} u krijua si ${workspaceRoleLabel(role)}.`,
        `An invitation for ${invitation.email} was created as ${workspaceRoleLabel(role)}.`,
      ),
    );
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : localized(locale, "Krijimi i ftesës dështoi.", "Creating the invitation failed."),
    };
  }
}

export async function revokeWorkspaceInvitationAction(
  locale: string,
  workspaceSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuthenticatedUserOrRedirect(locale, workspaceRoute(locale, workspaceSlug));
  const workspace = await getWorkspaceMemberManagementBundle(workspaceSlug);

  if (!workspace) {
    return {
      status: "error",
      message: localized(locale, "Workspace-i nuk u gjet.", "Workspace not found."),
    };
  }

  try {
    assertWorkspacePermission(
      workspace.permissions,
      "canManageWorkspace",
      localized(
        locale,
        "Nuk ke leje për të revokuar ftesa në këtë workspace.",
        "You do not have permission to revoke invitations in this workspace.",
      ),
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : localized(locale, "Qasja u refuzua.", "Access denied."));
  }

  const invitationId = String(formData.get("invitationId") ?? "").trim();

  if (!invitationId) {
    return {
      status: "error",
      message: localized(locale, "Zgjidh ftesën që do të revokosh.", "Choose an invitation to revoke."),
    };
  }

  const invitation = workspace.invitations.find((entry) => entry.id === invitationId) ?? null;

  if (!invitation) {
    return {
      status: "error",
      message: localized(locale, "Ftesa nuk u gjet.", "Invitation not found."),
    };
  }

  if (invitation.status !== "pending") {
    return successState(
      localized(locale, "Ftesa nuk është më aktive.", "This invitation is no longer active."),
    );
  }

  try {
    const revokedInvitation = await revokeWorkspaceInvitation({
      invitationId: invitation.id,
    });

    await appendWorkspaceLifecycleEvent({
      workspaceId: workspace.workspace.id,
      invitationId: revokedInvitation.id,
      memberUserId: revokedInvitation.inviteeUserId,
      actorUserId: workspace.currentUser.id,
      actorLabel: workspace.currentUser.fullName,
      eventType: "invitation_revoked",
      memberEmail: revokedInvitation.email,
      memberName: suggestedMemberNameFromEmail(revokedInvitation.email) || revokedInvitation.email,
      previousRole: revokedInvitation.role,
      nextRole: revokedInvitation.role,
      summary: `${workspace.currentUser.fullName} revoked the workspace invitation for ${revokedInvitation.email}.`,
    });

    revalidateWorkspaceManagementRoutes(locale, workspaceSlug);

    return successState(
      localized(
        locale,
        `Ftesa për ${revokedInvitation.email} u revokua.`,
        `The invitation for ${revokedInvitation.email} was revoked.`,
      ),
    );
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : localized(locale, "Revokimi i ftesës dështoi.", "Revoking the invitation failed."),
    };
  }
}

export async function resendWorkspaceInvitationAction(
  locale: string,
  workspaceSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuthenticatedUserOrRedirect(locale, workspaceRoute(locale, workspaceSlug));
  const workspace = await getWorkspaceMemberManagementBundle(workspaceSlug);

  if (!workspace) {
    return {
      status: "error",
      message: localized(locale, "Workspace-i nuk u gjet.", "Workspace not found."),
    };
  }

  try {
    assertWorkspacePermission(
      workspace.permissions,
      "canManageWorkspace",
      localized(
        locale,
        "Nuk ke leje për të ridërguar ftesa në këtë workspace.",
        "You do not have permission to resend invitations in this workspace.",
      ),
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : localized(locale, "Qasja u refuzua.", "Access denied."));
  }

  const invitationId = String(formData.get("invitationId") ?? "").trim();

  if (!invitationId) {
    return {
      status: "error",
      message: localized(locale, "Zgjidh ftesën që do të ridërgosh.", "Choose an invitation to resend."),
    };
  }

  const invitation = workspace.invitations.find((entry) => entry.id === invitationId) ?? null;

  if (!invitation) {
    return {
      status: "error",
      message: localized(locale, "Ftesa nuk u gjet.", "Invitation not found."),
    };
  }

  if (invitation.status === "accepted") {
    return {
      status: "error",
      message: localized(
        locale,
        "Ftesat e pranuara nuk ridërgohen. Anëtari është tashmë në workspace.",
        "Accepted invitations are not resent. The member is already in the workspace.",
      ),
    };
  }

  try {
    const existingUser = await findUserByEmail(invitation.email);

    if (existingUser) {
      const existingMembership = await getWorkspaceMembership(workspace.workspace.id, existingUser.id);

      if (existingMembership?.status === "active") {
        return {
          status: "error",
          message: localized(
            locale,
            "Ky përdorues është tashmë anëtar aktiv i workspace-it.",
            "This user is already an active member of the workspace.",
          ),
        };
      }

      if (existingMembership?.status === "deactivated") {
        return {
          status: "error",
          message: localized(
            locale,
            "Ky përdorues është i çaktivizuar. Përdor reaktivizimin në vend të ridërgimit të ftesës.",
            "This user is currently deactivated. Use member reactivation instead of resending the invitation.",
          ),
        };
      }
    }

    if (invitation.status === "pending") {
      await revokeWorkspaceInvitation({
        invitationId: invitation.id,
      });

      await appendWorkspaceLifecycleEvent({
        workspaceId: workspace.workspace.id,
        invitationId: invitation.id,
        memberUserId: invitation.inviteeUserId,
        actorUserId: workspace.currentUser.id,
        actorLabel: workspace.currentUser.fullName,
        eventType: "invitation_revoked",
        memberEmail: invitation.email,
        memberName: suggestedMemberNameFromEmail(invitation.email) || invitation.email,
        previousRole: invitation.role,
        nextRole: invitation.role,
        summary: `${workspace.currentUser.fullName} revoked the previous invitation for ${invitation.email} before resending it.`,
      });
    }

    const resentInvitation = await createWorkspaceInvitation({
      workspaceId: workspace.workspace.id,
      invitedByUserId: workspace.currentUser.id,
      email: invitation.email,
      role: invitation.role,
      deliveryAttemptNumber: invitation.deliveryAttemptNumber + 1,
      resentFromInvitationId: invitation.id,
    });

    await appendWorkspaceLifecycleEvent({
      workspaceId: workspace.workspace.id,
      invitationId: resentInvitation.id,
      memberUserId: existingUser?.id ?? null,
      actorUserId: workspace.currentUser.id,
      actorLabel: workspace.currentUser.fullName,
      eventType: "invitation_resent",
      memberEmail: resentInvitation.email,
      memberName: existingUser?.fullName || suggestedMemberNameFromEmail(resentInvitation.email) || resentInvitation.email,
      previousRole: invitation.role,
      nextRole: resentInvitation.role,
      summary: `${workspace.currentUser.fullName} resent the workspace invitation for ${resentInvitation.email} as ${workspaceRoleLabel(resentInvitation.role)}.`,
    });

    revalidateWorkspaceManagementRoutes(locale, workspaceSlug);

    return successState(
      localized(
        locale,
        `Ftesa për ${resentInvitation.email} u ridërgua me link të ri.`,
        `The invitation for ${resentInvitation.email} was resent with a fresh link.`,
      ),
    );
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : localized(locale, "Ridërgimi i ftesës dështoi.", "Resending the invitation failed."),
    };
  }
}

export async function updateWorkspaceMemberRoleAction(
  locale: string,
  workspaceSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuthenticatedUserOrRedirect(locale, workspaceRoute(locale, workspaceSlug));
  const workspace = await getWorkspaceWithProjects(workspaceSlug);

  if (!workspace) {
    return {
      status: "error",
      message: localized(locale, "Workspace-i nuk u gjet.", "Workspace not found."),
    };
  }

  try {
    assertWorkspacePermission(
      workspace.permissions,
      "canManageWorkspace",
      localized(
        locale,
        "Nuk ke leje për të ndryshuar rolet e anëtarëve në këtë workspace.",
        "You do not have permission to change member roles in this workspace.",
      ),
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : localized(locale, "Qasja u refuzua.", "Access denied."));
  }

  const membershipId = String(formData.get("membershipId") ?? "").trim();
  const nextRole = parseWorkspaceRole(formData.get("role"));

  if (!membershipId || !nextRole) {
    return {
      status: "error",
      message: localized(locale, "Zgjidh anëtarin dhe rolin e ri.", "Choose the member and the new role."),
    };
  }

  if (nextRole === "owner") {
    return {
      status: "error",
      message: localized(
        locale,
        "Roli Owner nuk menaxhohet nga kjo pamje.",
        "The Owner role is not managed from this screen.",
      ),
    };
  }

  try {
    const members = await listWorkspaceMembers(workspace.id);
    const targetMember = members.find((member) => member.membershipId === membershipId) ?? null;

    if (!targetMember) {
      return {
        status: "error",
        message: localized(locale, "Anëtari nuk u gjet.", "Member not found."),
      };
    }

    if (targetMember.role === "owner") {
      return {
        status: "error",
        message: localized(
          locale,
          "Roli Owner nuk mund të ndryshohet nga kjo pamje.",
          "The Owner role cannot be changed from this screen.",
        ),
      };
    }

    if (targetMember.status !== "active") {
      return {
        status: "error",
        message: localized(
          locale,
          "Anëtarët e çaktivizuar nuk mund të ndryshohen nga kjo pamje.",
          "Deactivated members cannot be updated from this screen.",
        ),
      };
    }

    if (targetMember.role === nextRole) {
      return successState(
        localized(locale, "Roli mbeti i pandryshuar.", "The member role stayed unchanged."),
      );
    }

    const updatedMembership = await updateWorkspaceMembershipRole({
      workspaceId: workspace.id,
      membershipId,
      role: nextRole,
    });

    await appendWorkspaceLifecycleEvent({
      workspaceId: workspace.id,
      membershipId: updatedMembership.id,
      memberUserId: targetMember.userId,
      actorUserId: workspace.currentUser.id,
      actorLabel: workspace.currentUser.fullName,
      eventType: "member_role_changed",
      memberEmail: targetMember.email,
      memberName: targetMember.fullName,
      previousRole: targetMember.role,
      nextRole,
      summary: `${workspace.currentUser.fullName} changed ${targetMember.fullName} from ${workspaceRoleLabel(targetMember.role)} to ${workspaceRoleLabel(nextRole)}.`,
    });

    revalidateWorkspaceManagementRoutes(locale, workspaceSlug);

    return successState(
      localized(
        locale,
        `Roli i ${targetMember.fullName} u ndryshua në ${workspaceRoleLabel(nextRole)}.`,
        `${targetMember.fullName} is now a ${workspaceRoleLabel(nextRole)}.`,
      ),
    );
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : localized(locale, "Ndryshimi i rolit dështoi.", "Updating the role failed."),
    };
  }
}

export async function deactivateWorkspaceMemberAction(
  locale: string,
  workspaceSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuthenticatedUserOrRedirect(locale, workspaceRoute(locale, workspaceSlug));
  const workspace = await getWorkspaceMemberManagementBundle(workspaceSlug);

  if (!workspace) {
    return {
      status: "error",
      message: localized(locale, "Workspace-i nuk u gjet.", "Workspace not found."),
    };
  }

  try {
    assertWorkspacePermission(
      workspace.permissions,
      "canManageWorkspace",
      localized(
        locale,
        "Nuk ke leje për të çaktivizuar anëtarë në këtë workspace.",
        "You do not have permission to deactivate members in this workspace.",
      ),
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : localized(locale, "Qasja u refuzua.", "Access denied."));
  }

  const membershipId = String(formData.get("membershipId") ?? "").trim();

  if (!membershipId) {
    return {
      status: "error",
      message: localized(locale, "Zgjidh anëtarin që do të çaktivizosh.", "Choose a member to deactivate."),
    };
  }

  const targetMember = workspace.members.find((member) => member.membershipId === membershipId) ?? null;

  if (!targetMember) {
    return {
      status: "error",
      message: localized(locale, "Anëtari nuk u gjet.", "Member not found."),
    };
  }

  if (targetMember.role === "owner") {
    return {
      status: "error",
      message: localized(
        locale,
        "Owner-i duhet të transferohet para çaktivizimit.",
        "The owner must be transferred before deactivation.",
      ),
    };
  }

  if (targetMember.userId === workspace.currentUser.id) {
    return {
      status: "error",
      message: localized(
        locale,
        "Nuk mund ta çaktivizosh veten nga kjo pamje.",
        "You cannot deactivate yourself from this screen.",
      ),
    };
  }

  if (targetMember.status !== "active") {
    return successState(localized(locale, "Anëtari është tashmë i çaktivizuar.", "The member is already deactivated."));
  }

  try {
    const updatedMembership = await deactivateWorkspaceMembership({
      workspaceId: workspace.workspace.id,
      membershipId: targetMember.membershipId,
    });

    await appendWorkspaceLifecycleEvent({
      workspaceId: workspace.workspace.id,
      membershipId: updatedMembership.id,
      memberUserId: targetMember.userId,
      actorUserId: workspace.currentUser.id,
      actorLabel: workspace.currentUser.fullName,
      eventType: "member_deactivated",
      memberEmail: targetMember.email,
      memberName: targetMember.fullName,
      previousRole: targetMember.role,
      nextRole: targetMember.role,
      summary: `${workspace.currentUser.fullName} deactivated ${targetMember.fullName}.`,
    });

    revalidateWorkspaceManagementRoutes(locale, workspaceSlug);

    return successState(
      localized(
        locale,
        `${targetMember.fullName} u çaktivizua dhe historia e qasjes u ruajt.`,
        `${targetMember.fullName} was deactivated and their access history was preserved.`,
      ),
    );
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : localized(locale, "Çaktivizimi i anëtarit dështoi.", "Deactivating the member failed."),
    };
  }
}

export async function reactivateWorkspaceMemberAction(
  locale: string,
  workspaceSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuthenticatedUserOrRedirect(locale, workspaceRoute(locale, workspaceSlug));
  const workspace = await getWorkspaceMemberManagementBundle(workspaceSlug);

  if (!workspace) {
    return {
      status: "error",
      message: localized(locale, "Workspace-i nuk u gjet.", "Workspace not found."),
    };
  }

  try {
    assertWorkspacePermission(
      workspace.permissions,
      "canManageWorkspace",
      localized(
        locale,
        "Nuk ke leje për të riaktivizuar anëtarë në këtë workspace.",
        "You do not have permission to reactivate members in this workspace.",
      ),
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : localized(locale, "Qasja u refuzua.", "Access denied."));
  }

  const membershipId = String(formData.get("membershipId") ?? "").trim();

  if (!membershipId) {
    return {
      status: "error",
      message: localized(locale, "Zgjidh anëtarin që do të riaktivizosh.", "Choose a member to reactivate."),
    };
  }

  const targetMember = workspace.members.find((member) => member.membershipId === membershipId) ?? null;

  if (!targetMember) {
    return {
      status: "error",
      message: localized(locale, "Anëtari nuk u gjet.", "Member not found."),
    };
  }

  if (targetMember.status === "active") {
    return successState(
      localized(locale, "Anëtari është tashmë aktiv.", "The member is already active."),
    );
  }

  try {
    const updatedMembership = await reactivateWorkspaceMembership({
      workspaceId: workspace.workspace.id,
      membershipId: targetMember.membershipId,
    });

    await appendWorkspaceLifecycleEvent({
      workspaceId: workspace.workspace.id,
      membershipId: updatedMembership.id,
      memberUserId: targetMember.userId,
      actorUserId: workspace.currentUser.id,
      actorLabel: workspace.currentUser.fullName,
      eventType: "member_reactivated",
      memberEmail: targetMember.email,
      memberName: targetMember.fullName,
      previousRole: targetMember.role,
      nextRole: targetMember.role,
      summary: `${workspace.currentUser.fullName} reactivated ${targetMember.fullName}.`,
    });

    revalidateWorkspaceManagementRoutes(locale, workspaceSlug);

    return successState(
      localized(
        locale,
        `${targetMember.fullName} u riaktivizua dhe qasja u rikthye.`,
        `${targetMember.fullName} was reactivated and access was restored.`,
      ),
    );
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : localized(locale, "Riaktivizimi i anëtarit dështoi.", "Reactivating the member failed."),
    };
  }
}

export async function transferWorkspaceOwnershipAction(
  locale: string,
  workspaceSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuthenticatedUserOrRedirect(locale, workspaceRoute(locale, workspaceSlug));
  const workspace = await getWorkspaceMemberManagementBundle(workspaceSlug);

  if (!workspace) {
    return {
      status: "error",
      message: localized(locale, "Workspace-i nuk u gjet.", "Workspace not found."),
    };
  }

  if (workspace.membership.role !== "owner") {
    return permissionError(
      localized(
        locale,
        "Vetëm owner-i aktual mund ta transferojë ownership-in e workspace-it.",
        "Only the current owner can transfer workspace ownership.",
      ),
    );
  }

  const targetMembershipId = String(formData.get("targetMembershipId") ?? "").trim();
  const confirmation = String(formData.get("confirmation") ?? "").trim();

  if (!targetMembershipId || confirmation !== workspace.workspace.slug) {
    return {
      status: "error",
      message: localized(
        locale,
        "Zgjidh anëtarin e ri owner dhe shkruaj slug-un e workspace-it për konfirmim.",
        "Choose the new owner and enter the workspace slug to confirm.",
      ),
    };
  }

  const currentOwner = workspace.members.find((member) => member.userId === workspace.currentUser.id) ?? null;
  const targetMember = workspace.members.find((member) => member.membershipId === targetMembershipId) ?? null;

  if (!currentOwner || currentOwner.role !== "owner") {
    return {
      status: "error",
      message: localized(locale, "Owner-i aktual nuk u gjet.", "The current owner was not found."),
    };
  }

  if (!targetMember || targetMember.status !== "active" || targetMember.role === "owner") {
    return {
      status: "error",
      message: localized(
        locale,
        "Zgjidh një anëtar aktiv që nuk është tashmë owner.",
        "Choose an active member who is not already the owner.",
      ),
    };
  }

  try {
    await updateWorkspaceMembershipRole({
      workspaceId: workspace.workspace.id,
      membershipId: targetMember.membershipId,
      role: "owner",
    });

    await updateWorkspaceOwner({
      workspaceId: workspace.workspace.id,
      ownerUserId: targetMember.userId,
    });

    await updateWorkspaceMembershipRole({
      workspaceId: workspace.workspace.id,
      membershipId: currentOwner.membershipId,
      role: "admin",
    });

    await appendWorkspaceLifecycleEvent({
      workspaceId: workspace.workspace.id,
      membershipId: targetMember.membershipId,
      memberUserId: targetMember.userId,
      actorUserId: workspace.currentUser.id,
      actorLabel: workspace.currentUser.fullName,
      eventType: "owner_transferred",
      memberEmail: targetMember.email,
      memberName: targetMember.fullName,
      previousRole: targetMember.role,
      nextRole: "owner",
      summary: `${workspace.currentUser.fullName} transferred workspace ownership to ${targetMember.fullName}.`,
    });

    await appendWorkspaceLifecycleEvent({
      workspaceId: workspace.workspace.id,
      membershipId: currentOwner.membershipId,
      memberUserId: currentOwner.userId,
      actorUserId: workspace.currentUser.id,
      actorLabel: workspace.currentUser.fullName,
      eventType: "member_role_changed",
      memberEmail: workspace.currentUser.email,
      memberName: workspace.currentUser.fullName,
      previousRole: "owner",
      nextRole: "admin",
      summary: `${workspace.currentUser.fullName} became Admin after transferring ownership.`,
    });

    revalidateWorkspaceManagementRoutes(locale, workspaceSlug);

    return successState(
      localized(
        locale,
        `Ownership-i u transferua te ${targetMember.fullName}. Owner-i i mëparshëm tani është Admin. ${buildProjectOwnershipTransferNote({
          projects: workspace.projectOwnerships.map((entry) => ({
            ownerUserId: entry.projectOwnerUserId,
          })),
          nextWorkspaceOwnerUserId: targetMember.userId,
          previousWorkspaceOwnerUserId: currentOwner.userId,
          locale,
        })}`,
        `Ownership was transferred to ${targetMember.fullName}. The previous owner is now an Admin. ${buildProjectOwnershipTransferNote({
          projects: workspace.projectOwnerships.map((entry) => ({
            ownerUserId: entry.projectOwnerUserId,
          })),
          nextWorkspaceOwnerUserId: targetMember.userId,
          previousWorkspaceOwnerUserId: currentOwner.userId,
          locale,
        })}`,
      ),
    );
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : localized(locale, "Transferimi i ownership-it dështoi.", "Ownership transfer failed."),
    };
  }
}

export async function acceptWorkspaceInvitationAction(
  locale: string,
  invitationToken: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const invitationBundle = await getWorkspaceInvitationAcceptanceBundle(invitationToken);

  if (!invitationBundle) {
    return {
      status: "error",
      message: localized(locale, "Ftesa nuk u gjet.", "Invitation not found."),
    };
  }

  const { invitation, workspace } = invitationBundle;
  const invitationDisplayStatus = getWorkspaceInvitationDisplayStatus(invitation);

  if (invitationDisplayStatus !== "pending") {
    return {
      status: "error",
      message: localized(
        locale,
        invitationDisplayStatus === "expired"
          ? "Kjo ftesë ka skaduar. Kërko nga owner-i ose admin-i i workspace-it të të dërgojë një link të ri."
          : "Kjo ftesë nuk është më aktive për pranim.",
        invitationDisplayStatus === "expired"
          ? "This invitation has expired. Ask the workspace owner or an admin to send you a fresh link."
          : "This invitation is no longer active for acceptance.",
      ),
    };
  }

  let user = invitationBundle.currentUser;
  const password = String(formData.get("password") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();

  try {
    if (!user) {
      if (invitationBundle.existingUser) {
        return {
          status: "error",
          message: localized(
            locale,
            "Ky email ka tashmë llogari. Kyqu me atë llogari për ta pranuar ftesën.",
            "This email already has an account. Sign in with that account to accept the invitation.",
          ),
        };
      }

      if (!fullName || password.length < 8) {
        return {
          status: "error",
          message: localized(
            locale,
            "Shto emrin e plotë dhe një fjalëkalim me të paktën 8 karaktere për ta aktivizuar ftesën.",
            "Add your full name and a password with at least 8 characters to activate the invitation.",
          ),
        };
      }

      await createPasswordUser({
        email: invitation.email,
        fullName,
        companyName: workspace.companyName,
        passwordHash: await hashPassword(password),
      });

      const session = await signInUserWithPassword(invitation.email, password);
      user = session.user;
    }

    if (user.email !== invitation.email) {
      return {
        status: "error",
        message: localized(
          locale,
          "Kyqu me email-in e ftuar për ta pranuar këtë ftesë.",
          "Sign in with the invited email to accept this invitation.",
        ),
      };
    }

    const existingMembership = await getWorkspaceMembership(workspace.id, user.id);

    if (existingMembership?.status === "active") {
      return {
        status: "error",
        message: localized(
          locale,
          "Ky përdorues është tashmë anëtar aktiv i workspace-it.",
          "This user is already an active member of the workspace.",
        ),
      };
    }

    const membership =
      existingMembership?.status === "deactivated"
        ? await reactivateWorkspaceMembership({
            workspaceId: workspace.id,
            membershipId: existingMembership.id,
          })
        : await createWorkspaceMembership({
            workspaceId: workspace.id,
            userId: user.id,
            role: invitation.role,
          });

    if (existingMembership?.status === "deactivated") {
      await appendWorkspaceLifecycleEvent({
        workspaceId: workspace.id,
        membershipId: membership.id,
        invitationId: invitation.id,
        memberUserId: user.id,
        actorUserId: user.id,
        actorLabel: user.fullName,
        eventType: "member_reactivated",
        memberEmail: user.email,
        memberName: user.fullName,
        previousRole: existingMembership.role,
        nextRole: existingMembership.role,
        summary: `${user.fullName} reactivated their workspace membership while accepting an invitation.`,
      });
    }

    await acceptWorkspaceInvitation({
      invitationId: invitation.id,
      inviteeUserId: user.id,
      acceptedByUserId: user.id,
      acceptedMembershipId: membership.id,
    });

    await appendWorkspaceLifecycleEvent({
      workspaceId: workspace.id,
      membershipId: membership.id,
      invitationId: invitation.id,
      memberUserId: user.id,
      actorUserId: user.id,
      actorLabel: user.fullName,
      eventType: "invitation_accepted",
      memberEmail: user.email,
      memberName: user.fullName,
      previousRole: null,
      nextRole: invitation.role,
      summary: `${user.fullName} accepted a workspace invitation as ${workspaceRoleLabel(invitation.role)}.`,
    });

    revalidateWorkspaceManagementRoutes(locale, workspace.slug);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : localized(locale, "Pranimi i ftesës dështoi.", "Accepting the invitation failed."),
    };
  }

  redirect(workspaceRoute(locale, workspace.slug));
}

export async function createProjectAction(
  locale: string,
  workspaceSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentUser = await requireAuthenticatedUserOrRedirect(
    locale,
    `/${locale}/app/workspaces/${workspaceSlug}/projects/new`,
  );
  const workspace = await getWorkspaceWithProjects(workspaceSlug);

  if (!workspace) {
    return {
      status: "error",
      message: "Workspace not found.",
    };
  }

  try {
    assertWorkspacePermission(
      workspace.permissions,
      "canCreateProject",
      "You do not have permission to create projects in this workspace.",
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : "Access denied.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const startingMode = String(formData.get("startingMode") ?? "prompt") as CreateProjectInput["startingMode"];
  const brief = parseProjectBriefFields(formData, {
    defaultLocale: workspace.defaultLocale,
    country: workspace.country,
    businessCategory: workspace.businessCategory,
  });

  if (!name || !brief.targetUsers || !brief.businessCategory) {
    return {
      status: "error",
      message: "Please complete the required project fields before creating the project.",
    };
  }

  const planner = getPlannerService(null);
  const plannerStartedAt = new Date().toISOString();
  const plannerInput: PlannerInput = brief;
  let plannerExecution: Awaited<ReturnType<typeof planner.generateInitialPlan>>;

  try {
    plannerExecution = await planner.generateInitialPlan(plannerInput);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to generate the initial plan.",
    };
  }

  try {
    const project = await createProject({
      workspaceId: workspace.id,
      ownerUserId: currentUser.id,
      createdByUserId: currentUser.id,
      name: brief.name,
      startingMode,
      projectType: brief.projectType,
      prompt: brief.prompt,
      targetUsers: brief.targetUsers,
      desiredPagesFeatures: brief.desiredPagesFeatures,
      designStyle: brief.designStyle,
      primaryLocale: brief.primaryLocale,
      supportedLocales: brief.supportedLocales,
      country: brief.country,
      businessCategory: brief.businessCategory,
      capabilities: brief.capabilities,
      intakePayload: {
        createdFrom: startingMode,
      },
      structuredPlan: plannerExecution.result.plan,
      plannerSource: plannerExecution.result.source,
    });
    const createdBundle = await getProjectPlanBundle(workspace.slug, project.slug);

    if (!createdBundle) {
      throw new Error("Project was created, but the planner context could not be reloaded.");
    }

    const plannerRun = await recordProjectPlannerRun({
      workspaceId: workspace.id,
      projectId: project.id,
      briefId: createdBundle.brief.id,
      briefUpdatedAt: createdBundle.brief.updatedAt,
      source: plannerExecution.result.source,
      trigger: "project_create",
      status: plannerExecution.result.status,
      summary: plannerExecution.result.summary,
      inputSnapshot: plannerInput,
      outputPlan: plannerExecution.result.plan,
      generatedPlanRevisionId: project.currentPlanRevisionId,
      generatedPlanRevisionNumber: project.currentPlanRevisionNumber,
      startedAt: plannerStartedAt,
      completedAt: new Date().toISOString(),
      artifacts: plannerExecution.result.artifacts,
    });
    await recordProjectModelAdapterRun({
      workspaceId: workspace.id,
      projectId: project.id,
      status: "completed",
      trigger: "project_create",
      linkedEntityType: "planner_run",
      linkedEntityId: plannerRun.run.id,
      startedAt: plannerStartedAt,
      completedAt: new Date().toISOString(),
      ...plannerExecution.adapterExecution,
    }).catch(() => null);

    redirect(projectBaseRoute(locale, workspace.slug, project.slug));
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Project creation failed.",
    };
  }
}

export async function rerunPlannerAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const bundle = await getProjectPlanBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    return {
      status: "error",
      message: "Project plan not found.",
    };
  }

  try {
    assertProjectPermission(
      bundle.projectPermissions,
      "canRerunPlanner",
      "You do not have permission to rerun the planner for this project.",
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : "Access denied.");
  }

  const adapterSelectionOverride = parseRequestedAdapterSelection(formData.get("requestedSelection"));
  const retryOfRunId = parseRetryOfRunId(formData.get("retryOfRunId"));
  const adapterConfig = await getProjectModelAdapterConfigByIds(bundle.project.id, bundle.workspace.id);
  const effectiveAdapterConfig = adapterSelectionOverride
    ? withCapabilitySelectionOverride(adapterConfig, {
        workspaceId: bundle.workspace.id,
        projectId: bundle.project.id,
        capability: "planning",
        selection: adapterSelectionOverride,
      })
    : adapterConfig;
  const planner = getPlannerService(effectiveAdapterConfig);
  const plannerStartedAt = new Date().toISOString();
  const inputSnapshot = plannerInputFromBrief(bundle.brief);
  let plannerExecution: Awaited<ReturnType<typeof planner.rerunPlan>>;

  try {
    plannerExecution = await planner.rerunPlan(inputSnapshot);
  } catch (error) {
    const plannerError = error instanceof ModelAdapterExecutionError ? error : null;
    let failedPlannerRunId: string | null = null;
    try {
      const failedRun = await recordProjectPlannerRun({
        workspaceId: bundle.workspace.id,
        projectId: bundle.project.id,
        briefId: bundle.brief.id,
        briefUpdatedAt: bundle.brief.updatedAt,
        source: plannerError ? "rules_planner_v1" : bundle.project.plannerSource,
        trigger: "project_rerun",
        status: "failed",
        summary: `Planner rerun failed for ${bundle.project.name}.`,
        inputSnapshot,
        outputPlan: null,
        generatedPlanRevisionId: null,
        generatedPlanRevisionNumber: null,
        errorMessage: error instanceof Error ? error.message : "Planner rerun failed.",
        startedAt: plannerStartedAt,
        completedAt: new Date().toISOString(),
        artifacts: [],
      });
      failedPlannerRunId = failedRun.run.id;
    } catch {}
    if (plannerError) {
      await recordProjectModelAdapterRun({
        workspaceId: bundle.workspace.id,
        projectId: bundle.project.id,
        status: "failed",
        trigger: "project_rerun",
      linkedEntityType: "planner_run",
      linkedEntityId: failedPlannerRunId,
      retryOfRunId,
      errorMessage: plannerError.message,
      startedAt: plannerStartedAt,
        completedAt: new Date().toISOString(),
        ...plannerError.execution,
      }).catch(() => null);
    }

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Planner rerun failed.",
    };
  }

  try {
    const { revision } = await createPlanRevision({
      projectId: bundle.project.id,
      state: "generated",
      editedSection: "status",
      changeSummary:
        plannerExecution.result.summary ||
        "Planner rerun created a fresh plan draft from the current project brief.",
      plannerSource: plannerExecution.result.source,
      plan: plannerExecution.result.plan,
      nextProjectStatus: "plan_ready",
    });

    const plannerRun = await recordProjectPlannerRun({
      workspaceId: bundle.workspace.id,
      projectId: bundle.project.id,
      briefId: bundle.brief.id,
      briefUpdatedAt: bundle.brief.updatedAt,
      source: plannerExecution.result.source,
      trigger: "project_rerun",
      status: plannerExecution.result.status,
      summary: plannerExecution.result.summary,
      inputSnapshot,
      outputPlan: plannerExecution.result.plan,
      generatedPlanRevisionId: revision.id,
      generatedPlanRevisionNumber: revision.revisionNumber,
      startedAt: plannerStartedAt,
      completedAt: new Date().toISOString(),
      artifacts: plannerExecution.result.artifacts,
    });
    await recordProjectModelAdapterRun({
      workspaceId: bundle.workspace.id,
      projectId: bundle.project.id,
      status: "completed",
      trigger: "project_rerun",
      linkedEntityType: "planner_run",
      linkedEntityId: plannerRun.run.id,
      retryOfRunId,
      startedAt: plannerStartedAt,
      completedAt: new Date().toISOString(),
      ...plannerExecution.adapterExecution,
    });

    revalidatePlanReviewRoutes(locale, workspaceSlug, projectSlug);
    redirect(`${planRoute(locale, workspaceSlug, projectSlug)}?plannerRun=${encodeURIComponent(plannerRun.run.id)}#planner-run-${plannerRun.run.id}`);
  } catch (error) {
    rethrowRedirectError(error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save the planner rerun.",
    };
  }
}

export async function rerunGenerationAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const bundle = await getProjectPlanBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    return {
      status: "error",
      message: "Generation review context could not be loaded.",
    };
  }

  try {
    assertProjectPermission(
      bundle.projectPermissions,
      "canQueueGeneration",
      "You do not have permission to rerun generation for this project.",
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : "Access denied.");
  }

  const adapterSelectionOverride = parseRequestedAdapterSelection(formData.get("requestedSelection"));
  const retryOfRunId = parseRetryOfRunId(formData.get("retryOfRunId"));
  const { approvedRevision } = getApprovedAndCandidateRevisions(bundle.revisions);

  if (!approvedRevision) {
    return {
      status: "error",
      message: "Approve a plan revision before rerunning generation outputs.",
    };
  }

  const adapterConfig = await getProjectModelAdapterConfigByIds(bundle.project.id, bundle.workspace.id);
  const effectiveAdapterConfig = adapterSelectionOverride
    ? withCapabilitySelectionOverride(adapterConfig, {
        workspaceId: bundle.workspace.id,
        projectId: bundle.project.id,
        capability: "generation",
        selection: adapterSelectionOverride,
      })
    : adapterConfig;
  const generationService = getGenerationService(effectiveAdapterConfig);
  const generationStartedAt = new Date().toISOString();

  let generationRunResult:
    | Awaited<ReturnType<typeof recordProjectGenerationRun>>
    | null = null;

  try {
    const generationExecution = await generationService.rerunApprovedTargets({
      workspace: bundle.workspace,
      project: bundle.project,
      revisions: bundle.revisions,
      approvedRevision,
      currentUser: bundle.currentUser,
      membership: bundle.membership,
      workspacePermissions: bundle.workspacePermissions,
      projectPermissions: bundle.projectPermissions,
    });

    generationRunResult = await recordProjectGenerationRun({
      workspaceId: bundle.workspace.id,
      projectId: bundle.project.id,
      sourcePlanRevisionId: generationExecution.result.sourcePlanRevisionId,
      sourcePlanRevisionNumber: generationExecution.result.sourcePlanRevisionNumber,
      sourcePlanSnapshot: generationExecution.result.sourcePlanSnapshot,
      source: generationExecution.result.source,
      trigger: generationExecution.result.trigger,
      status: generationExecution.result.status,
      summary: generationExecution.result.summary,
      outputSummary: generationExecution.result.outputSummary,
      startedAt: generationStartedAt,
      completedAt: new Date().toISOString(),
      artifacts: generationExecution.result.artifacts,
    });
    await recordProjectModelAdapterRun({
      workspaceId: bundle.workspace.id,
      projectId: bundle.project.id,
      status: "completed",
      trigger: "generation_rerun",
      linkedEntityType: "generation_run",
      linkedEntityId: generationRunResult.run.id,
      retryOfRunId,
      startedAt: generationStartedAt,
      completedAt: new Date().toISOString(),
      ...generationExecution.adapterExecution,
    });

    revalidatePlanReviewRoutes(locale, workspaceSlug, projectSlug);
    redirect(
      `${planRoute(locale, workspaceSlug, projectSlug)}?generationRun=${encodeURIComponent(
        generationRunResult.run.id,
      )}#generation-run-${generationRunResult.run.id}`,
    );
  } catch (error) {
    rethrowRedirectError(error);
    const generationExecutionError = error instanceof ModelAdapterExecutionError ? error : null;
    let failedRunId: string | null = null;

    try {
      const failedRun = await recordProjectGenerationRun({
        workspaceId: bundle.workspace.id,
        projectId: bundle.project.id,
        sourcePlanRevisionId: approvedRevision.id,
        sourcePlanRevisionNumber: approvedRevision.revisionNumber,
        sourcePlanSnapshot: approvedRevision.plan,
        source: "deterministic_generator_v1",
        trigger: "manual_rerun",
        status: "failed",
        summary: `Generation rerun failed for approved revision ${approvedRevision.revisionNumber}.`,
        outputSummary: null,
        errorMessage: error instanceof Error ? error.message : "Generation rerun failed.",
        startedAt: generationStartedAt,
        completedAt: new Date().toISOString(),
        artifacts: [],
      });
      failedRunId = failedRun.run.id;
    } catch {}

    if (generationExecutionError) {
      await recordProjectModelAdapterRun({
        workspaceId: bundle.workspace.id,
        projectId: bundle.project.id,
        status: "failed",
        trigger: "generation_rerun",
        linkedEntityType: "generation_run",
        linkedEntityId: failedRunId,
        retryOfRunId,
        errorMessage: generationExecutionError.message,
        startedAt: generationStartedAt,
        completedAt: new Date().toISOString(),
        ...generationExecutionError.execution,
      }).catch(() => null);
    }

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Generation rerun failed.",
    };
  }
}

export async function saveProjectBriefAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const bundle = await getProjectPlanBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    return {
      status: "error",
      message: "Project brief not found.",
    };
  }

  try {
    assertProjectPermission(
      bundle.projectPermissions,
      "canEditBrief",
      "You do not have permission to edit this project brief.",
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : "Access denied.");
  }

  const brief = parseProjectBriefFields(formData, {
    defaultLocale: bundle.workspace.defaultLocale,
    country: bundle.workspace.country,
    businessCategory: bundle.workspace.businessCategory,
  });

  if (!brief.name || !brief.targetUsers || !brief.businessCategory) {
    return {
      status: "error",
      message: "Please complete the required brief fields before saving.",
    };
  }

  try {
    const updatedBrief = await updateProjectBrief({
      workspaceId: bundle.workspace.id,
      projectId: bundle.project.id,
      brief,
    });

    await appendProjectAuditEvent({
      projectId: bundle.project.id,
      workspaceId: bundle.workspace.id,
      source: "plan",
      kind: "brief_updated",
      title: "Project brief updated",
      summary: `The planner brief was updated independently of the current plan revision for ${bundle.project.name}.`,
      actorType: "user",
      actorLabel: "workspace_editor",
      entityType: "project_brief",
      entityId: updatedBrief.id,
      linkedTab: "plan",
      linkContext: {
        tab: "plan",
        briefId: updatedBrief.id,
      },
      metadata: {
        briefUpdatedAt: updatedBrief.updatedAt,
        briefName: updatedBrief.name,
        currentPlanRevisionNumber: bundle.project.currentPlanRevisionNumber,
      },
      occurredAt: updatedBrief.updatedAt,
    });

    revalidatePlanReviewRoutes(locale, workspaceSlug, projectSlug);
    redirect(`${planRoute(locale, workspaceSlug, projectSlug)}#brief-editor`);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save the project brief.",
    };
  }
}

export async function saveProjectModelAdapterConfigAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const bundle = await getProjectPlanBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    return {
      status: "error",
      message: "Project adapter settings were not found.",
    };
  }

  try {
    assertProjectPermission(
      bundle.projectPermissions,
      "canRerunPlanner",
      "You do not have permission to configure model adapters for this project.",
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : "Access denied.");
  }

  try {
    const externalApiKeyEnvVar = String(formData.get("externalApiKeyEnvVar") ?? "").trim() || null;

    if (externalApiKeyEnvVar && !isValidEnvVarName(externalApiKeyEnvVar)) {
      return {
        status: "error",
        message: "API key env var names must use uppercase letters, numbers, and underscores only.",
      };
    }

    await saveProjectModelAdapterConfig({
      workspaceId: bundle.workspace.id,
      projectId: bundle.project.id,
      planningSelection: parseAdapterSelection(formData.get("planningSelection")),
      generationSelection: parseAdapterSelection(formData.get("generationSelection")),
      patchSelection: parseAdapterSelection(formData.get("patchSelection")),
      externalProviderKey:
        formData.get("externalProviderKey") === "openai_compatible" ||
        formData.get("externalProviderKey") === "custom_http"
          ? (String(formData.get("externalProviderKey")) as "openai_compatible" | "custom_http")
          : null,
      externalProviderLabel: String(formData.get("externalProviderLabel") ?? "").trim() || null,
      externalEndpointUrl: String(formData.get("externalEndpointUrl") ?? "").trim() || null,
      externalApiKeyEnvVar,
      planningModel: String(formData.get("planningModel") ?? "").trim() || null,
      generationModel: String(formData.get("generationModel") ?? "").trim() || null,
      patchModel: String(formData.get("patchModel") ?? "").trim() || null,
    });
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save adapter settings.",
    };
  }

  revalidatePlanReviewRoutes(locale, workspaceSlug, projectSlug);
  redirect(`${planRoute(locale, workspaceSlug, projectSlug)}#model-adapters`);
}

export async function verifyExternalProviderCapabilityAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const bundle = await getProjectPlanBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    return {
      status: "error",
      message: "Project adapter settings were not found.",
    };
  }

  try {
    assertProjectPermission(
      bundle.projectPermissions,
      "canRerunPlanner",
      "You do not have permission to verify external provider settings for this project.",
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : "Access denied.");
  }

  const capability = parseModelAdapterCapability(formData.get("capability"));

  if (!capability) {
    return {
      status: "error",
      message: "Choose a capability to verify.",
    };
  }

  const retryOfRunId = parseRetryOfRunId(formData.get("retryOfRunId"));
  const config = await getProjectModelAdapterConfigByIds(bundle.project.id, bundle.workspace.id);
  const startedAt = new Date().toISOString();

  try {
    const execution = await verifyExternalProviderCapability(config, capability);

    await recordProjectModelAdapterRun({
      workspaceId: bundle.workspace.id,
      projectId: bundle.project.id,
      status: "completed",
      trigger: "provider_verification",
      linkedEntityType: null,
      linkedEntityId: null,
      retryOfRunId,
      startedAt,
      completedAt: new Date().toISOString(),
      ...execution,
    });
  } catch (error) {
    const adapterError = error instanceof ModelAdapterExecutionError ? error : null;
    const errorMessage =
      error instanceof Error ? error.message : "Live provider verification failed.";
    const failedExecution =
      adapterError?.execution ??
      buildProviderVerificationFailureExecution(config, capability, errorMessage);

    await recordProjectModelAdapterRun({
      workspaceId: bundle.workspace.id,
      projectId: bundle.project.id,
      status: "failed",
      trigger: "provider_verification",
      linkedEntityType: null,
      linkedEntityId: null,
      retryOfRunId,
      errorMessage,
      startedAt,
      completedAt: new Date().toISOString(),
      ...failedExecution,
    }).catch(() => null);

    revalidatePlanReviewRoutes(locale, workspaceSlug, projectSlug);

    return {
      status: "error",
      message: errorMessage,
    };
  }

  revalidatePlanReviewRoutes(locale, workspaceSlug, projectSlug);
  redirect(`${planRoute(locale, workspaceSlug, projectSlug)}#model-adapters`);
}

export async function savePlanSectionAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  sectionKey: PlanSectionKey,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const bundle = await getProjectPlanBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    return {
      status: "error",
      message: "Project plan not found.",
    };
  }

  try {
    assertProjectPermission(
      bundle.projectPermissions,
      "canSavePlanDraft",
      "You do not have permission to edit this plan draft.",
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : "Access denied.");
  }

  const nextPlan = applyPlanSectionUpdate(bundle.project.structuredPlan, sectionKey, formData);
  const changeSummary =
    String(formData.get("changeSummary") ?? "").trim() || `Updated ${sectionKey} in Plan Mode.`;

  try {
    const { revision } = await createPlanRevision({
      projectId: bundle.project.id,
      state: "draft_saved",
      editedSection: sectionKey,
      changeSummary,
      plannerSource: bundle.project.plannerSource,
      plan: nextPlan,
      nextProjectStatus: "plan_in_review",
    });
    await appendPlanRevisionAudit({
      workspaceId: bundle.workspace.id,
      projectId: bundle.project.id,
      revision,
    });

    revalidatePlanReviewRoutes(locale, workspaceSlug, projectSlug);
    redirect(planRoute(locale, workspaceSlug, projectSlug));
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save the plan section.",
    };
  }
}

export async function markPlanNeedsChangesAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const bundle = await getProjectPlanBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    return {
      status: "error",
      message: "Project plan not found.",
    };
  }

  try {
    assertProjectPermission(
      bundle.projectPermissions,
      "canApprovePlan",
      "You do not have permission to mark this plan for changes.",
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : "Access denied.");
  }

  const note =
    String(formData.get("reviewNote") ?? "").trim() || "Plan marked as needs changes during review.";

  try {
    const { revision } = await createPlanRevision({
      projectId: bundle.project.id,
      state: "needs_changes",
      editedSection: "status",
      changeSummary: note,
      plannerSource: bundle.project.plannerSource,
      plan: bundle.project.structuredPlan,
      nextProjectStatus: "plan_in_review",
    });
    await appendPlanRevisionAudit({
      workspaceId: bundle.workspace.id,
      projectId: bundle.project.id,
      revision,
    });

    revalidatePlanReviewRoutes(locale, workspaceSlug, projectSlug);
    redirect(planRoute(locale, workspaceSlug, projectSlug));
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to mark the plan for changes.",
    };
  }
}

export async function approvePlanAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const bundle = await getProjectPlanBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    return {
      status: "error",
      message: "Project plan not found.",
    };
  }

  try {
    assertProjectPermission(
      bundle.projectPermissions,
      "canApprovePlan",
      "You do not have permission to approve or promote this plan candidate.",
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : "Access denied.");
  }

  const note =
    String(formData.get("reviewNote") ?? "").trim() || "Plan candidate promoted and approved in Plan Mode review.";
  const expectedCandidateRevisionId = String(formData.get("candidateRevisionId") ?? "").trim();
  const expectedCandidateRevisionNumber = Number(formData.get("candidateRevisionNumber") ?? 0);
  const { candidateRevision, approvedRevision } = getApprovedAndCandidateRevisions(bundle.revisions);

  if (!candidateRevision) {
    return {
      status: "error",
      message: "There is no newer plan candidate to promote right now.",
    };
  }

  if (
    expectedCandidateRevisionId !== candidateRevision.id ||
    expectedCandidateRevisionNumber !== candidateRevision.revisionNumber
  ) {
    return {
      status: "error",
      message: "The plan candidate changed while you were reviewing it. Refresh and try again.",
    };
  }

  try {
    const { revision } = await createPlanRevision({
      projectId: bundle.project.id,
      state: "approved",
      editedSection: "status",
      changeSummary: note,
      plannerSource: bundle.project.plannerSource,
      plan: candidateRevision.plan,
      nextProjectStatus: "plan_approved",
    });
    await appendPlanRevisionAudit({
      workspaceId: bundle.workspace.id,
      projectId: bundle.project.id,
      revision,
    });
    const updatedBundle = await getProjectPlanBundle(workspaceSlug, projectSlug);

    if (!updatedBundle) {
      throw new Error("The promoted plan could not be reloaded.");
    }

    const approvedRevisionForGeneration =
      updatedBundle.revisions.find((item) => item.id === revision.id) ?? revision;
    const adapterConfig = await getProjectModelAdapterConfigByIds(updatedBundle.project.id, updatedBundle.workspace.id);
    const generationService = getGenerationService(adapterConfig);
    const generationStartedAt = new Date().toISOString();

    let generationRunResult:
      | Awaited<ReturnType<typeof recordProjectGenerationRun>>
      | null = null;
    let generationErrorMessage: string | null = null;

    try {
      const generationExecution = await generationService.generateApprovedTargets({
        workspace: updatedBundle.workspace,
        project: updatedBundle.project,
        revisions: updatedBundle.revisions,
        approvedRevision: approvedRevisionForGeneration,
        currentUser: updatedBundle.currentUser,
        membership: updatedBundle.membership,
        workspacePermissions: updatedBundle.workspacePermissions,
        projectPermissions: updatedBundle.projectPermissions,
      });

      generationRunResult = await recordProjectGenerationRun({
        workspaceId: updatedBundle.workspace.id,
        projectId: updatedBundle.project.id,
        sourcePlanRevisionId: generationExecution.result.sourcePlanRevisionId,
        sourcePlanRevisionNumber: generationExecution.result.sourcePlanRevisionNumber,
        sourcePlanSnapshot: generationExecution.result.sourcePlanSnapshot,
        source: generationExecution.result.source,
        trigger: generationExecution.result.trigger,
        status: generationExecution.result.status,
        summary: generationExecution.result.summary,
        outputSummary: generationExecution.result.outputSummary,
        startedAt: generationStartedAt,
        completedAt: new Date().toISOString(),
        artifacts: generationExecution.result.artifacts,
      });
      await recordProjectModelAdapterRun({
        workspaceId: updatedBundle.workspace.id,
        projectId: updatedBundle.project.id,
        status: "completed",
        trigger: "plan_approved",
        linkedEntityType: "generation_run",
        linkedEntityId: generationRunResult.run.id,
        startedAt: generationStartedAt,
        completedAt: new Date().toISOString(),
        ...generationExecution.adapterExecution,
      });
    } catch (error) {
      generationErrorMessage =
        error instanceof Error ? error.message : "Generation pipeline failed.";
      const generationExecutionError = error instanceof ModelAdapterExecutionError ? error : null;

      generationRunResult = await recordProjectGenerationRun({
        workspaceId: updatedBundle.workspace.id,
        projectId: updatedBundle.project.id,
        sourcePlanRevisionId: approvedRevisionForGeneration.id,
        sourcePlanRevisionNumber: approvedRevisionForGeneration.revisionNumber,
        sourcePlanSnapshot: approvedRevisionForGeneration.plan,
        source: "deterministic_generator_v1",
        trigger: "plan_approved",
        status: "failed",
        summary: `Generation failed for approved revision ${approvedRevisionForGeneration.revisionNumber}.`,
        outputSummary: null,
        errorMessage: generationErrorMessage,
        startedAt: generationStartedAt,
        completedAt: new Date().toISOString(),
        artifacts: [],
      });
      if (generationExecutionError) {
        await recordProjectModelAdapterRun({
          workspaceId: updatedBundle.workspace.id,
          projectId: updatedBundle.project.id,
          status: "failed",
          trigger: "plan_approved",
          linkedEntityType: "generation_run",
          linkedEntityId: generationRunResult.run.id,
          errorMessage: generationExecutionError.message,
          startedAt: generationStartedAt,
          completedAt: new Date().toISOString(),
          ...generationExecutionError.execution,
        }).catch(() => null);
      }
    }

    await appendProjectAuditEvent({
      projectId: bundle.project.id,
      workspaceId: bundle.workspace.id,
      source: "plan",
      kind: "plan_candidate_promoted",
      title: `Plan candidate promoted to revision ${revision.revisionNumber}`,
      summary:
        generationRunResult?.run.status === "failed"
          ? `Candidate revision ${candidateRevision.revisionNumber} was approved, but generation failed before reviewable builder targets could be prepared.`
          : `Candidate revision ${candidateRevision.revisionNumber} was approved. Generated builder targets are ready for review before any Visual or Code queue is created.`,
      actorType: "user",
      actorLabel: "workspace_editor",
      entityType: "plan_revision",
      entityId: revision.id,
      linkedTab: "plan",
      linkContext: {
        tab: "plan",
        planRevisionId: revision.id,
        planRevisionNumber: revision.revisionNumber,
      },
      metadata: {
        candidateRevisionId: candidateRevision.id,
        candidateRevisionNumber: candidateRevision.revisionNumber,
        previousApprovedRevisionId: approvedRevision?.id ?? null,
        previousApprovedRevisionNumber: approvedRevision?.revisionNumber ?? null,
        promotedRevisionId: revision.id,
        promotedRevisionNumber: revision.revisionNumber,
        generationRunId: generationRunResult?.run.id ?? null,
        generationStatus: generationRunResult?.run.status ?? "failed",
        generationArtifactCount: generationRunResult?.artifacts.length ?? 0,
        generationErrorMessage,
        queuedSurfaces: [],
      },
      occurredAt: revision.createdAt,
    });

    const generationQuery = generationRunResult?.run.id
      ? `?generationRun=${encodeURIComponent(generationRunResult.run.id)}#generation-run-${generationRunResult.run.id}`
      : "";

    revalidatePlanReviewRoutes(locale, workspaceSlug, projectSlug);
    redirect(`${planRoute(locale, workspaceSlug, projectSlug)}${generationQuery}`);
  } catch (error) {
    rethrowRedirectError(error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to approve the plan.",
    };
  }
}

export async function queueGenerationOutputsAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const generationRunId = String(formData.get("generationRunId") ?? "").trim();
  const selectedSurfaces = parseQueueMode(formData.get("queueMode"));

  if (!generationRunId) {
    return {
      status: "error",
      message: "Select a generation run before creating queue work.",
    };
  }

  if (selectedSurfaces.length === 0) {
    return {
      status: "error",
      message: "Choose Visual, Code, or both before creating queue work.",
    };
  }

  const [planBundle, generationBundle, promotionBundle] = await Promise.all([
    getProjectPlanBundle(workspaceSlug, projectSlug),
    getProjectGenerationBundle(workspaceSlug, projectSlug),
    getProjectPlanPromotionBundle(workspaceSlug, projectSlug),
  ]);

  if (!planBundle || !generationBundle || !promotionBundle) {
    return {
      status: "error",
      message: "Generation review context could not be loaded.",
    };
  }

  try {
    assertProjectPermission(
      planBundle.projectPermissions,
      "canQueueGeneration",
      "You do not have permission to queue generated outputs for this project.",
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : "Access denied.");
  }

  const { approvedRevision } = getApprovedAndCandidateRevisions(planBundle.revisions);
  const selectedRun = generationBundle.runs.find((run) => run.id === generationRunId) ?? null;
  const latestApprovedRun = approvedRevision
    ? findLatestCompletedGenerationRun(generationBundle.runs, approvedRevision.revisionNumber)
    : null;

  if (!selectedRun) {
    return {
      status: "error",
      message: "The selected generation run could not be found.",
    };
  }

  if (selectedRun.status !== "completed") {
    return {
      status: "error",
      message: "Only completed generation runs can be queued into Visual or Code.",
    };
  }

  if (!approvedRevision || approvedRevision.revisionNumber !== selectedRun.sourcePlanRevisionNumber) {
    return {
      status: "error",
      message: "This generation run is no longer aligned with the current approved plan revision.",
    };
  }

  if (!latestApprovedRun || latestApprovedRun.id !== selectedRun.id) {
    return {
      status: "error",
      message:
        "This generation run has been superseded by a newer approved output. Re-queue from the latest generation run instead.",
    };
  }

  const activeQueueItems = promotionBundle.pendingRefreshQueue.filter(
    (item) => item.status === "pending" || item.status === "deferred",
  );
  const surfaceStates = {
    visual: promotionBundle.visualSurface,
    code: promotionBundle.codeSurface,
  } satisfies Record<BuilderRefreshSurface, BuilderImpactSurfaceRecord>;

  const blockedSurface = selectedSurfaces.find((surface) =>
    activeQueueItems.some((item) => item.surface === surface),
  );

  if (blockedSurface) {
    return {
      status: "error",
      message:
        blockedSurface === "visual"
          ? "Visual already has active queue work. Resolve or defer that item before creating another."
          : "Code already has active queue work. Resolve or defer that item before creating another.",
    };
  }

  const queueDrafts = selectedSurfaces
    .map((surface) =>
      generationQueueDraftForSurface({
        surface,
        targetPlanRevisionId: selectedRun.sourcePlanRevisionId,
        targetPlanRevisionNumber: selectedRun.sourcePlanRevisionNumber,
        surfaceState: surfaceStates[surface],
      }),
    )
    .filter((draft): draft is NonNullable<typeof draft> => draft !== null);

  if (queueDrafts.length !== selectedSurfaces.length) {
    return {
      status: "error",
      message:
        "One or more selected surfaces no longer need queue work. Refresh the review state and try again.",
    };
  }

  if (queueDrafts.length === 0) {
    return {
      status: "error",
      message:
        "The selected surfaces are already pinned to this approved revision. There is no new queue work to create.",
    };
  }

  try {
    const queuedItems = await enqueueProjectBuilderRefreshQueue(
      queueDrafts.map((draft) => ({
        workspaceId: planBundle.workspace.id,
        projectId: planBundle.project.id,
        generationRunId: selectedRun.id,
        surface: draft.surface,
        reason: "generation_run",
        targetPlanRevisionId: draft.targetPlanRevisionId,
        targetPlanRevisionNumber: draft.targetPlanRevisionNumber,
        pinnedPlanRevisionNumber: draft.pinnedPlanRevisionNumber,
        requiresManualReview: draft.requiresManualReview,
        summary: buildGenerationQueueSummary({
          surface: draft.surface,
          targetRevisionNumber: draft.targetPlanRevisionNumber,
          outputSummary: selectedRun.outputSummary
            ? {
                visualPageCount: selectedRun.outputSummary.visualPageCount,
                visualSectionCount: selectedRun.outputSummary.visualSectionCount,
                codeFileCount: selectedRun.outputSummary.codeFileCount,
                routeCount: selectedRun.outputSummary.routeCount,
              }
            : null,
          requiresManualReview: draft.requiresManualReview,
        }),
      })),
    );

    await appendProjectAuditEvent({
      projectId: planBundle.project.id,
      workspaceId: planBundle.workspace.id,
      source: "plan",
      kind: "refresh_queue_created",
      title: `Refresh queue created from generation run ${selectedRun.sourcePlanRevisionNumber}`,
      summary: `Queue work was created for ${queuedItems.map((item) => item.surface).join(", ")} from generation run ${selectedRun.id}.`,
      actorType: "user",
      actorLabel: "workspace_editor",
      entityType: "generation_run",
      entityId: selectedRun.id,
      linkedTab: "plan",
      linkContext: {
        tab: "plan",
        generationRunId: selectedRun.id,
        planRevisionId: selectedRun.sourcePlanRevisionId,
        planRevisionNumber: selectedRun.sourcePlanRevisionNumber,
      },
      metadata: {
        generationRunId: selectedRun.id,
        sourcePlanRevisionId: selectedRun.sourcePlanRevisionId,
        sourcePlanRevisionNumber: selectedRun.sourcePlanRevisionNumber,
        queuedSurfaces: queuedItems.map((item) => item.surface),
        queueItemIds: queuedItems.map((item) => item.id),
        queueMode: String(formData.get("queueMode") ?? ""),
      },
      occurredAt: new Date().toISOString(),
    });

    revalidatePlanAndQueueRoutes(locale, workspaceSlug, projectSlug);
    redirect(
      `${planRoute(locale, workspaceSlug, projectSlug)}?generationRun=${encodeURIComponent(selectedRun.id)}#generation-run-${selectedRun.id}`,
    );
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to create refresh queue work from this generation run.",
    };
  }
}
