import { randomBytes } from "node:crypto";

import { isSupabaseConfigured } from "@/lib/env";
import { verifyPassword } from "@/lib/auth/password";
import { buildSessionExpiryIso, clearSessionCookie, readSessionToken, writeSessionCookie } from "@/lib/auth/session";
import { readLocalStore, writeLocalStore } from "@/lib/workspaces/local-store";
import { createSupabaseServerClient } from "@/lib/workspaces/supabase";
import type {
  AuthSessionRecord,
  AuthenticatedUserRecord,
  UserProfileRecord,
  WorkspaceMemberDirectoryEntryRecord,
  WorkspaceMemberEventRecord,
  WorkspaceMemberRecord,
  WorkspaceInvitationRecord,
  WorkspaceRole,
} from "@/lib/workspaces/types";

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toAuthenticatedUser(user: UserProfileRecord): AuthenticatedUserRecord {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    companyName: user.companyName,
  };
}

function mapProfileRow(row: Record<string, unknown>): UserProfileRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    fullName: String(row.full_name),
    companyName: String(row.company_name ?? ""),
    passwordHash: String(row.password_hash),
    authProvider: "password",
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapSessionRow(row: Record<string, unknown>): AuthSessionRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    sessionToken: String(row.session_token),
    createdAt: String(row.created_at),
    lastSeenAt: String(row.last_seen_at),
    expiresAt: String(row.expires_at),
  };
}

function mapWorkspaceMemberRow(row: Record<string, unknown>): WorkspaceMemberRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    userId: String(row.user_id),
    role: row.role as WorkspaceRole,
    status: row.status === "deactivated" ? "deactivated" : "active",
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapWorkspaceInvitationRow(row: Record<string, unknown>): WorkspaceInvitationRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    invitedByUserId: row.invited_by_user_id ? String(row.invited_by_user_id) : null,
    inviteeUserId: row.invitee_user_id ? String(row.invitee_user_id) : null,
    email: normalizeEmail(String(row.email)),
    role: row.role as WorkspaceRole,
    status: row.status as WorkspaceInvitationRecord["status"],
    invitationToken: String(row.invitation_token),
    acceptedByUserId: row.accepted_by_user_id ? String(row.accepted_by_user_id) : null,
    acceptedMembershipId: row.accepted_membership_id ? String(row.accepted_membership_id) : null,
    acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapWorkspaceMemberEventRow(row: Record<string, unknown>): WorkspaceMemberEventRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    membershipId: row.membership_id ? String(row.membership_id) : null,
    invitationId: row.invitation_id ? String(row.invitation_id) : null,
    memberUserId: row.member_user_id ? String(row.member_user_id) : null,
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    actorLabel: String(row.actor_label),
    eventType: row.event_type as WorkspaceMemberEventRecord["eventType"],
    memberEmail: String(row.member_email),
    memberName: String(row.member_name),
    previousRole: row.previous_role ? (row.previous_role as WorkspaceRole) : null,
    nextRole: row.next_role as WorkspaceRole,
    summary: String(row.summary),
    occurredAt: String(row.occurred_at),
  };
}

function roleWeight(role: WorkspaceRole) {
  switch (role) {
    case "owner":
      return 0;
    case "admin":
      return 1;
    case "editor":
      return 2;
    case "viewer":
      return 3;
  }
}

function memberStatusWeight(status: WorkspaceMemberRecord["status"]) {
  return status === "active" ? 0 : 1;
}

function buildWorkspaceMemberDirectoryEntry(
  membership: WorkspaceMemberRecord,
  user: Pick<UserProfileRecord, "id" | "email" | "fullName" | "companyName">,
): WorkspaceMemberDirectoryEntryRecord {
  return {
    membershipId: membership.id,
    workspaceId: membership.workspaceId,
    userId: membership.userId,
    role: membership.role,
    status: membership.status,
    email: user.email,
    fullName: user.fullName,
    companyName: user.companyName,
    joinedAt: membership.createdAt,
    updatedAt: membership.updatedAt,
  };
}

async function findUserByEmailLocal(email: string) {
  const store = await readLocalStore();
  return store.users.find((user) => user.email === normalizeEmail(email)) ?? null;
}

async function createUserLocal(input: {
  email: string;
  fullName: string;
  companyName: string;
  passwordHash: string;
}) {
  const store = await readLocalStore();
  const normalizedEmail = normalizeEmail(input.email);

  if (store.users.some((user) => user.email === normalizedEmail)) {
    throw new Error("An account with this email already exists.");
  }

  const timestamp = nowIso();
  const user: UserProfileRecord = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    fullName: input.fullName,
    companyName: input.companyName,
    passwordHash: input.passwordHash,
    authProvider: "password",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.users.unshift(user);
  await writeLocalStore(store);
  return user;
}

async function createSessionLocal(userId: string) {
  const store = await readLocalStore();
  const timestamp = nowIso();
  const session: AuthSessionRecord = {
    id: crypto.randomUUID(),
    userId,
    sessionToken: randomBytes(32).toString("hex"),
    createdAt: timestamp,
    lastSeenAt: timestamp,
    expiresAt: buildSessionExpiryIso(),
  };

  store.authSessions = store.authSessions.filter((entry) => entry.userId !== userId);
  store.authSessions.unshift(session);
  await writeLocalStore(store);
  return session;
}

async function getSessionUserLocal(sessionToken: string) {
  const store = await readLocalStore();
  const session = store.authSessions.find((entry) => entry.sessionToken === sessionToken) ?? null;

  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  const user = store.users.find((entry) => entry.id === session.userId) ?? null;

  if (!user) {
    return null;
  }

  return {
    session,
    user,
  };
}

async function deleteSessionLocal(sessionToken: string) {
  const store = await readLocalStore();
  store.authSessions = store.authSessions.filter((entry) => entry.sessionToken !== sessionToken);
  await writeLocalStore(store);
}

async function listWorkspaceMembershipsForUserLocal(userId: string) {
  const store = await readLocalStore();
  return store.workspaceMembers.filter((entry) => entry.userId === userId && entry.status === "active");
}

async function listWorkspaceMembersLocal(workspaceId: string) {
  const store = await readLocalStore();
  const usersById = new Map(store.users.map((user) => [user.id, user]));

  return store.workspaceMembers
    .filter((entry) => entry.workspaceId === workspaceId)
    .map((membership) => {
      const user = usersById.get(membership.userId);

      if (!user) {
        return null;
      }

      return buildWorkspaceMemberDirectoryEntry(membership, user);
    })
    .filter((entry): entry is WorkspaceMemberDirectoryEntryRecord => Boolean(entry))
    .sort((left, right) => {
      const statusDelta = memberStatusWeight(left.status) - memberStatusWeight(right.status);

      if (statusDelta !== 0) {
        return statusDelta;
      }

      const roleDelta = roleWeight(left.role) - roleWeight(right.role);

      if (roleDelta !== 0) {
        return roleDelta;
      }

      return left.fullName.localeCompare(right.fullName) || left.email.localeCompare(right.email);
    });
}

async function getWorkspaceMembershipLocal(workspaceId: string, userId: string) {
  const memberships = await listWorkspaceMembershipsForUserLocal(userId);
  return memberships.find((entry) => entry.workspaceId === workspaceId) ?? null;
}

async function createWorkspaceMembershipLocal(input: {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}) {
  const store = await readLocalStore();
  const existing = store.workspaceMembers.find(
    (entry) => entry.workspaceId === input.workspaceId && entry.userId === input.userId,
  );

  if (existing) {
    existing.role = input.role;
    existing.status = "active";
    existing.updatedAt = nowIso();
    await writeLocalStore(store);
    return existing;
  }

  const timestamp = nowIso();
  const membership: WorkspaceMemberRecord = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    userId: input.userId,
    role: input.role,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.workspaceMembers.unshift(membership);
  await writeLocalStore(store);
  return membership;
}

async function updateWorkspaceMembershipRoleLocal(input: {
  workspaceId: string;
  membershipId: string;
  role: WorkspaceRole;
}) {
  const store = await readLocalStore();
  const membership = store.workspaceMembers.find(
    (entry) => entry.workspaceId === input.workspaceId && entry.id === input.membershipId,
  );

  if (!membership) {
    throw new Error("Workspace membership not found.");
  }

  membership.role = input.role;
  membership.updatedAt = nowIso();
  await writeLocalStore(store);
  return membership;
}

async function deactivateWorkspaceMembershipLocal(input: {
  workspaceId: string;
  membershipId: string;
}) {
  const store = await readLocalStore();
  const membership = store.workspaceMembers.find(
    (entry) => entry.workspaceId === input.workspaceId && entry.id === input.membershipId,
  );

  if (!membership) {
    throw new Error("Workspace membership not found.");
  }

  membership.status = "deactivated";
  membership.updatedAt = nowIso();
  await writeLocalStore(store);
  return membership;
}

async function listWorkspaceInvitationsLocal(workspaceId: string) {
  const store = await readLocalStore();

  return store.workspaceInvitations
    .filter((entry) => entry.workspaceId === workspaceId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function getWorkspaceInvitationByTokenLocal(invitationToken: string) {
  const store = await readLocalStore();
  return store.workspaceInvitations.find((entry) => entry.invitationToken === invitationToken) ?? null;
}

async function createWorkspaceInvitationLocal(input: {
  workspaceId: string;
  invitedByUserId: string | null;
  email: string;
  role: WorkspaceRole;
}) {
  const store = await readLocalStore();
  const timestamp = nowIso();
  const invitation: WorkspaceInvitationRecord = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    invitedByUserId: input.invitedByUserId,
    inviteeUserId: null,
    email: normalizeEmail(input.email),
    role: input.role,
    status: "pending",
    invitationToken: randomBytes(24).toString("hex"),
    acceptedByUserId: null,
    acceptedMembershipId: null,
    acceptedAt: null,
    revokedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.workspaceInvitations.unshift(invitation);
  await writeLocalStore(store);
  return invitation;
}

async function acceptWorkspaceInvitationLocal(input: {
  invitationId: string;
  inviteeUserId: string;
  acceptedByUserId: string;
  acceptedMembershipId: string;
}) {
  const store = await readLocalStore();
  const invitation = store.workspaceInvitations.find((entry) => entry.id === input.invitationId);

  if (!invitation) {
    throw new Error("Workspace invitation not found.");
  }

  const timestamp = nowIso();
  invitation.inviteeUserId = input.inviteeUserId;
  invitation.acceptedByUserId = input.acceptedByUserId;
  invitation.acceptedMembershipId = input.acceptedMembershipId;
  invitation.acceptedAt = timestamp;
  invitation.status = "accepted";
  invitation.updatedAt = timestamp;
  await writeLocalStore(store);
  return invitation;
}

async function listWorkspaceMemberEventsLocal(workspaceId: string) {
  const store = await readLocalStore();

  return store.workspaceMemberEvents
    .filter((event) => event.workspaceId === workspaceId)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

async function appendWorkspaceMemberEventLocal(event: WorkspaceMemberEventRecord) {
  const store = await readLocalStore();
  store.workspaceMemberEvents.unshift(event);
  await writeLocalStore(store);
}

async function findUserByEmailSupabase(email: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("email", normalizeEmail(email))
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapProfileRow(data as Record<string, unknown>) : null;
}

async function createUserSupabase(input: {
  email: string;
  fullName: string;
  companyName: string;
  passwordHash: string;
}) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await client
    .from("profiles")
    .insert({
      email: normalizeEmail(input.email),
      full_name: input.fullName,
      company_name: input.companyName,
      password_hash: input.passwordHash,
      auth_provider: "password",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapProfileRow(data as Record<string, unknown>);
}

async function createSessionSupabase(userId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const timestamp = nowIso();
  const { data, error } = await client
    .from("platform_sessions")
    .insert({
      user_id: userId,
      session_token: randomBytes(32).toString("hex"),
      created_at: timestamp,
      last_seen_at: timestamp,
      expires_at: buildSessionExpiryIso(),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapSessionRow(data as Record<string, unknown>);
}

async function getSessionUserSupabase(sessionToken: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("platform_sessions")
    .select("*, profiles(*)")
    .eq("session_token", sessionToken)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const session = mapSessionRow(data as Record<string, unknown>);

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  const userRows = (data as { profiles?: Record<string, unknown> | null }).profiles;

  if (!userRows) {
    return null;
  }

  return {
    session,
    user: mapProfileRow(userRows),
  };
}

async function deleteSessionSupabase(sessionToken: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return;
  }

  const { error } = await client.from("platform_sessions").delete().eq("session_token", sessionToken);

  if (error) {
    throw new Error(error.message);
  }
}

async function listWorkspaceMembershipsForUserSupabase(userId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("workspace_members")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapWorkspaceMemberRow(row as Record<string, unknown>));
}

async function findWorkspaceMembershipSupabase(workspaceId: string, userId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapWorkspaceMemberRow(data as Record<string, unknown>) : null;
}

async function listWorkspaceMembersSupabase(workspaceId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("workspace_members")
    .select("*, profiles(*)")
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => {
      const membership = mapWorkspaceMemberRow(row as Record<string, unknown>);
      const profile = (row as { profiles?: Record<string, unknown> | null }).profiles;

      if (!profile) {
        return null;
      }

      return buildWorkspaceMemberDirectoryEntry(membership, mapProfileRow(profile));
    })
    .filter((entry): entry is WorkspaceMemberDirectoryEntryRecord => Boolean(entry))
    .sort((left, right) => {
      const statusDelta = memberStatusWeight(left.status) - memberStatusWeight(right.status);

      if (statusDelta !== 0) {
        return statusDelta;
      }

      const roleDelta = roleWeight(left.role) - roleWeight(right.role);

      if (roleDelta !== 0) {
        return roleDelta;
      }

      return left.fullName.localeCompare(right.fullName) || left.email.localeCompare(right.email);
    });
}

async function getWorkspaceMembershipSupabase(workspaceId: string, userId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapWorkspaceMemberRow(data as Record<string, unknown>) : null;
}

async function createWorkspaceMembershipSupabase(input: {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const existing = await findWorkspaceMembershipSupabase(input.workspaceId, input.userId);

  if (existing) {
    const { data: updated, error: updateError } = await client
      .from("workspace_members")
      .update({
        role: input.role,
        status: "active",
        updated_at: nowIso(),
      })
      .eq("workspace_id", input.workspaceId)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return mapWorkspaceMemberRow(updated as Record<string, unknown>);
  }

  const { data, error } = await client
    .from("workspace_members")
    .insert({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      role: input.role,
      status: "active",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapWorkspaceMemberRow(data as Record<string, unknown>);
}

async function updateWorkspaceMembershipRoleSupabase(input: {
  workspaceId: string;
  membershipId: string;
  role: WorkspaceRole;
}) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await client
    .from("workspace_members")
    .update({
      role: input.role,
      updated_at: nowIso(),
    })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.membershipId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Workspace membership not found.");
  }

  return mapWorkspaceMemberRow(data as Record<string, unknown>);
}

async function deactivateWorkspaceMembershipSupabase(input: {
  workspaceId: string;
  membershipId: string;
}) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await client
    .from("workspace_members")
    .update({
      status: "deactivated",
      updated_at: nowIso(),
    })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.membershipId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Workspace membership not found.");
  }

  return mapWorkspaceMemberRow(data as Record<string, unknown>);
}

async function listWorkspaceInvitationsSupabase(workspaceId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("workspace_invitations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapWorkspaceInvitationRow(row as Record<string, unknown>));
}

async function getWorkspaceInvitationByTokenSupabase(invitationToken: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("workspace_invitations")
    .select("*")
    .eq("invitation_token", invitationToken)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapWorkspaceInvitationRow(data as Record<string, unknown>) : null;
}

async function createWorkspaceInvitationSupabase(input: {
  workspaceId: string;
  invitedByUserId: string | null;
  email: string;
  role: WorkspaceRole;
}) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await client
    .from("workspace_invitations")
    .insert({
      workspace_id: input.workspaceId,
      invited_by_user_id: input.invitedByUserId,
      email: normalizeEmail(input.email),
      role: input.role,
      status: "pending",
      invitation_token: randomBytes(24).toString("hex"),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapWorkspaceInvitationRow(data as Record<string, unknown>);
}

async function acceptWorkspaceInvitationSupabase(input: {
  invitationId: string;
  inviteeUserId: string;
  acceptedByUserId: string;
  acceptedMembershipId: string;
}) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await client
    .from("workspace_invitations")
    .update({
      invitee_user_id: input.inviteeUserId,
      accepted_by_user_id: input.acceptedByUserId,
      accepted_membership_id: input.acceptedMembershipId,
      accepted_at: nowIso(),
      status: "accepted",
      updated_at: nowIso(),
    })
    .eq("id", input.invitationId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapWorkspaceInvitationRow(data as Record<string, unknown>);
}

async function listWorkspaceMemberEventsSupabase(workspaceId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("workspace_member_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("occurred_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapWorkspaceMemberEventRow(row as Record<string, unknown>));
}

async function appendWorkspaceMemberEventSupabase(event: WorkspaceMemberEventRecord) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await client.from("workspace_member_events").insert({
    id: event.id,
    workspace_id: event.workspaceId,
    membership_id: event.membershipId,
    invitation_id: event.invitationId,
    member_user_id: event.memberUserId,
    actor_user_id: event.actorUserId,
    actor_label: event.actorLabel,
    event_type: event.eventType,
    member_email: event.memberEmail,
    member_name: event.memberName,
    previous_role: event.previousRole,
    next_role: event.nextRole,
    summary: event.summary,
    occurred_at: event.occurredAt,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function createPasswordUser(input: {
  email: string;
  fullName: string;
  companyName: string;
  passwordHash: string;
}) {
  if (isSupabaseConfigured()) {
    return createUserSupabase(input);
  }

  return createUserLocal(input);
}

export async function findUserByEmail(email: string) {
  if (isSupabaseConfigured()) {
    return findUserByEmailSupabase(email);
  }

  return findUserByEmailLocal(email);
}

export async function signInUserWithPassword(email: string, password: string) {
  const user = isSupabaseConfigured()
    ? await findUserByEmailSupabase(email)
    : await findUserByEmailLocal(email);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new Error("The email or password is incorrect.");
  }

  const session = isSupabaseConfigured()
    ? await createSessionSupabase(user.id)
    : await createSessionLocal(user.id);

  await writeSessionCookie(session.sessionToken, session.expiresAt);
  return {
    user: toAuthenticatedUser(user),
    session,
  };
}

export async function signOutCurrentUser() {
  const sessionToken = await readSessionToken();

  if (sessionToken) {
    if (isSupabaseConfigured()) {
      await deleteSessionSupabase(sessionToken);
    } else {
      await deleteSessionLocal(sessionToken);
    }
  }

  await clearSessionCookie();
}

export async function getCurrentAuthenticatedUser() {
  const sessionToken = await readSessionToken();

  if (!sessionToken) {
    return null;
  }

  const result = isSupabaseConfigured()
    ? await getSessionUserSupabase(sessionToken)
    : await getSessionUserLocal(sessionToken);

  if (!result) {
    await clearSessionCookie();
    return null;
  }

  return {
    user: toAuthenticatedUser(result.user),
    session: result.session,
  };
}

export async function listWorkspaceMembershipsForUser(userId: string) {
  if (isSupabaseConfigured()) {
    return listWorkspaceMembershipsForUserSupabase(userId);
  }

  return listWorkspaceMembershipsForUserLocal(userId);
}

export async function listWorkspaceMembers(workspaceId: string) {
  if (isSupabaseConfigured()) {
    return listWorkspaceMembersSupabase(workspaceId);
  }

  return listWorkspaceMembersLocal(workspaceId);
}

export async function getWorkspaceMembership(workspaceId: string, userId: string) {
  if (isSupabaseConfigured()) {
    return getWorkspaceMembershipSupabase(workspaceId, userId);
  }

  return getWorkspaceMembershipLocal(workspaceId, userId);
}

export async function createWorkspaceMembership(input: {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}) {
  if (isSupabaseConfigured()) {
    return createWorkspaceMembershipSupabase(input);
  }

  return createWorkspaceMembershipLocal(input);
}

export async function updateWorkspaceMembershipRole(input: {
  workspaceId: string;
  membershipId: string;
  role: WorkspaceRole;
}) {
  if (isSupabaseConfigured()) {
    return updateWorkspaceMembershipRoleSupabase(input);
  }

  return updateWorkspaceMembershipRoleLocal(input);
}

export async function deactivateWorkspaceMembership(input: {
  workspaceId: string;
  membershipId: string;
}) {
  if (isSupabaseConfigured()) {
    return deactivateWorkspaceMembershipSupabase(input);
  }

  return deactivateWorkspaceMembershipLocal(input);
}

export async function listWorkspaceInvitations(workspaceId: string) {
  if (isSupabaseConfigured()) {
    return listWorkspaceInvitationsSupabase(workspaceId);
  }

  return listWorkspaceInvitationsLocal(workspaceId);
}

export async function getWorkspaceInvitationByToken(invitationToken: string) {
  if (isSupabaseConfigured()) {
    return getWorkspaceInvitationByTokenSupabase(invitationToken);
  }

  return getWorkspaceInvitationByTokenLocal(invitationToken);
}

export async function createWorkspaceInvitation(input: {
  workspaceId: string;
  invitedByUserId: string | null;
  email: string;
  role: WorkspaceRole;
}) {
  if (isSupabaseConfigured()) {
    return createWorkspaceInvitationSupabase(input);
  }

  return createWorkspaceInvitationLocal(input);
}

export async function acceptWorkspaceInvitation(input: {
  invitationId: string;
  inviteeUserId: string;
  acceptedByUserId: string;
  acceptedMembershipId: string;
}) {
  if (isSupabaseConfigured()) {
    return acceptWorkspaceInvitationSupabase(input);
  }

  return acceptWorkspaceInvitationLocal(input);
}

export async function listWorkspaceMemberEvents(workspaceId: string) {
  if (isSupabaseConfigured()) {
    return listWorkspaceMemberEventsSupabase(workspaceId);
  }

  return listWorkspaceMemberEventsLocal(workspaceId);
}

export async function appendWorkspaceMemberEvent(event: WorkspaceMemberEventRecord) {
  if (isSupabaseConfigured()) {
    return appendWorkspaceMemberEventSupabase(event);
  }

  return appendWorkspaceMemberEventLocal(event);
}
