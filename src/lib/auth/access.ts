import type {
  AuthenticatedUserRecord,
  ProjectPermissionsRecord,
  ProjectRecord,
  WorkspaceMemberRecord,
  WorkspacePermissionsRecord,
  WorkspaceRecord,
  WorkspaceRole,
} from "@/lib/workspaces/types";

export class AccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export function workspaceRoleLabel(role: WorkspaceRole) {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "editor":
      return "Editor";
    case "viewer":
      return "Viewer";
  }
}

export function buildWorkspacePermissions(role: WorkspaceRole): WorkspacePermissionsRecord {
  return {
    canView: true,
    canCreateProject: role === "owner" || role === "admin" || role === "editor",
    canManageWorkspace: role === "owner" || role === "admin",
  };
}

export function buildProjectPermissions(input: {
  membership: WorkspaceMemberRecord;
  project: ProjectRecord;
  user: AuthenticatedUserRecord;
}): ProjectPermissionsRecord {
  const isWorkspaceOwner = input.membership.role === "owner";
  const isWorkspaceAdmin = input.membership.role === "admin";
  const isEditor = input.membership.role === "editor";
  const isViewer = input.membership.role === "viewer";
  const isProjectOwner = input.project.ownerUserId === input.user.id;
  const canOperate = isWorkspaceOwner || isWorkspaceAdmin || isEditor || isProjectOwner;

  return {
    canView: !isViewer || isViewer,
    canEditBrief: canOperate,
    canRerunPlanner: canOperate,
    canSavePlanDraft: canOperate,
    canApprovePlan: isWorkspaceOwner || isWorkspaceAdmin || isProjectOwner,
    canQueueGeneration: canOperate,
    canIntakeVisual: canOperate,
    canReviewCode: canOperate,
    canManageProposals: canOperate,
    canRestoreCode: canOperate,
    canPublishDeploy: isWorkspaceOwner || isWorkspaceAdmin || isProjectOwner,
    canViewTimeline: true,
  };
}

export function assertWorkspacePermission(
  permissions: WorkspacePermissionsRecord,
  permission: keyof WorkspacePermissionsRecord,
  message: string,
) {
  if (!permissions[permission]) {
    throw new AccessDeniedError(message);
  }
}

export function assertProjectPermission(
  permissions: ProjectPermissionsRecord,
  permission: keyof ProjectPermissionsRecord,
  message: string,
) {
  if (!permissions[permission]) {
    throw new AccessDeniedError(message);
  }
}

export function canViewWorkspace(workspace: WorkspaceRecord, membership: WorkspaceMemberRecord | null) {
  return Boolean(workspace && membership && membership.status === "active");
}
