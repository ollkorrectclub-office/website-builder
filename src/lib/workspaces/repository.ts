import { isSupabaseConfigured } from "@/lib/env";
import {
  buildProjectPermissions,
  buildWorkspacePermissions,
  canViewWorkspace,
} from "@/lib/auth/access";
import {
  createWorkspaceMembership,
  findUserByEmail,
  getCurrentAuthenticatedUser,
  getWorkspaceInvitationByToken,
  getWorkspaceMembership,
  listWorkspaceMemberEvents,
  listWorkspaceMembers,
  listWorkspaceMembershipsForUser,
  listWorkspaceInvitations,
} from "@/lib/auth/repository";
import { synthesizeProjectBrief } from "@/lib/workspaces/briefs";
import { readLocalStore, writeLocalStore } from "@/lib/workspaces/local-store";
import { createSupabaseServerClient } from "@/lib/workspaces/supabase";
import { slugify } from "@/lib/workspaces/utils";
import type {
  CreatePlanRevisionInput,
  CreateProjectInput,
  CreateWorkspaceInput,
  PersistenceSummary,
  PlanRevisionRecord,
  PlannerSource,
  AuthenticatedUserRecord,
  ProjectBriefRecord,
  ProjectPlanBundle,
  ProjectRecord,
  StructuredPlan,
  WorkspaceInvitationAcceptanceBundle,
  WorkspaceMemberRecord,
  WorkspaceMemberManagementBundle,
  WorkspacePermissionsRecord,
  WorkspaceProjectOwnershipVisibilityRecord,
  UpdateProjectBriefInput,
  WorkspaceRecord,
  WorkspaceWithProjects,
} from "@/lib/workspaces/types";

function nowIso() {
  return new Date().toISOString();
}

function uniqueSlug(base: string, existing: string[]) {
  const normalized = slugify(base) || "workspace";
  let candidate = normalized;
  let index = 2;

  while (existing.includes(candidate)) {
    candidate = `${normalized}-${index}`;
    index += 1;
  }

  return candidate;
}

async function resolveCurrentUser() {
  const current = await getCurrentAuthenticatedUser();
  return current?.user ?? null;
}

async function resolveWorkspaceAccess(workspace: WorkspaceRecord): Promise<{
  currentUser: AuthenticatedUserRecord;
  membership: WorkspaceMemberRecord;
  permissions: WorkspacePermissionsRecord;
} | null> {
  const currentUser = await resolveCurrentUser();

  if (!currentUser) {
    return null;
  }

  const membership = await getWorkspaceMembership(workspace.id, currentUser.id);

  if (!canViewWorkspace(workspace, membership)) {
    return null;
  }

  return {
    currentUser,
    membership: membership as WorkspaceMemberRecord,
    permissions: buildWorkspacePermissions((membership as WorkspaceMemberRecord).role),
  };
}

function buildProjectAccess(input: {
  currentUser: AuthenticatedUserRecord;
  membership: WorkspaceMemberRecord;
  project: ProjectRecord;
}) {
  return buildProjectPermissions({
    membership: input.membership,
    project: input.project,
    user: input.currentUser,
  });
}

function mapWorkspaceRow(row: Record<string, unknown>, onboarding?: Record<string, unknown>): WorkspaceRecord {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    ownerUserId: String(row.owner_user_id ?? row.created_by_user_id ?? ""),
    createdByUserId: String(row.created_by_user_id ?? row.owner_user_id ?? ""),
    businessCategory: String(row.business_category),
    country: row.country as WorkspaceRecord["country"],
    defaultLocale: row.default_locale as WorkspaceRecord["defaultLocale"],
    supportedLocales: (row.supported_locales as WorkspaceRecord["supportedLocales"]) ?? ["sq"],
    companyName: onboarding?.company_name ? String(onboarding.company_name) : String(row.name),
    intentNotes: onboarding?.intent_notes ? String(onboarding.intent_notes) : "",
    onboardingPayload: (onboarding?.onboarding_payload as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function synthesizePlanFields(row: Record<string, unknown>, latestRevision?: PlanRevisionRecord) {
  const plannerSource = (row.planner_source as PlannerSource) ?? latestRevision?.plannerSource ?? "rules_planner_v1";
  const currentPlanRevisionId =
    (row.current_plan_revision_id as string | null) ?? latestRevision?.id ?? `planrev_${String(row.id)}_1`;
  const currentPlanRevisionNumber =
    Number(row.current_plan_revision_number ?? latestRevision?.revisionNumber ?? 1) || 1;
  const planLastUpdatedAt =
    String(row.plan_last_updated_at ?? latestRevision?.createdAt ?? row.updated_at ?? row.created_at);

  return {
    plannerSource,
    currentPlanRevisionId,
    currentPlanRevisionNumber,
    planLastUpdatedAt,
  };
}

function mapProjectRow(row: Record<string, unknown>, latestRevision?: PlanRevisionRecord): ProjectRecord {
  const capabilities = (row.capabilities as ProjectRecord["capabilities"]) ?? {
    auth: false,
    payments: false,
    cms: false,
    fileUpload: false,
    aiChat: false,
    calendar: false,
    analytics: false,
  };

  const intakePayload = (row.intake_payload as Record<string, unknown>) ?? {};
  const structuredPlan = (row.structured_plan as StructuredPlan) ?? latestRevision?.plan;
  const supportedLocales =
    ((intakePayload.supportedLocales as ProjectRecord["supportedLocales"]) ?? [row.primary_locale]) as ProjectRecord["supportedLocales"];
  const synthesized = synthesizePlanFields(row, latestRevision);

  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    slug: String(row.slug),
    name: String(row.name),
    ownerUserId: String(row.owner_user_id ?? row.created_by_user_id ?? ""),
    createdByUserId: String(row.created_by_user_id ?? row.owner_user_id ?? ""),
    startingMode: row.starting_mode as ProjectRecord["startingMode"],
    status: (row.status as ProjectRecord["status"]) ?? "plan_ready",
    projectType: row.project_type as ProjectRecord["projectType"],
    prompt: row.prompt ? String(row.prompt) : "",
    targetUsers: String(row.target_users),
    desiredPagesFeatures: (row.desired_pages_features as string[]) ?? [],
    designStyle: String(row.design_style),
    primaryLocale: row.primary_locale as ProjectRecord["primaryLocale"],
    supportedLocales,
    country: row.country as ProjectRecord["country"],
    businessCategory: String(row.business_category),
    capabilities,
    intakePayload,
    structuredPlan,
    currentPlanRevisionId: synthesized.currentPlanRevisionId,
    currentPlanRevisionNumber: synthesized.currentPlanRevisionNumber,
    planLastUpdatedAt: synthesized.planLastUpdatedAt,
    plannerSource: synthesized.plannerSource,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapRevisionRow(row: Record<string, unknown>): PlanRevisionRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    revisionNumber: Number(row.revision_number),
    state: row.state as PlanRevisionRecord["state"],
    editedSection: row.edited_section as PlanRevisionRecord["editedSection"],
    changeSummary: String(row.change_summary),
    plannerSource: (row.planner_source as PlannerSource) ?? "rules_planner_v1",
    plan: row.plan_payload as StructuredPlan,
    createdAt: String(row.created_at),
  };
}

function mapBriefRow(row: Record<string, unknown>): ProjectBriefRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    prompt: row.prompt ? String(row.prompt) : "",
    projectType: row.project_type as ProjectBriefRecord["projectType"],
    targetUsers: String(row.target_users),
    desiredPagesFeatures: (row.desired_pages_features as string[]) ?? [],
    designStyle: String(row.design_style),
    primaryLocale: row.primary_locale as ProjectBriefRecord["primaryLocale"],
    supportedLocales: (row.supported_locales as ProjectBriefRecord["supportedLocales"]) ?? ["sq"],
    country: row.country as ProjectBriefRecord["country"],
    businessCategory: String(row.business_category),
    capabilities: (row.capabilities as ProjectBriefRecord["capabilities"]) ?? {
      auth: false,
      payments: false,
      cms: false,
      fileUpload: false,
      aiChat: false,
      calendar: false,
      analytics: false,
    },
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function buildWorkspaceProjectOwnerships(input: {
  projects: ProjectRecord[];
  members: WorkspaceMemberManagementBundle["members"];
  workspaceOwnerUserId: string;
}): WorkspaceProjectOwnershipVisibilityRecord[] {
  const membersByUserId = new Map(input.members.map((member) => [member.userId, member]));

  return [...input.projects]
    .sort((left, right) => left.name.localeCompare(right.name) || left.slug.localeCompare(right.slug))
    .map((project) => {
      const ownerMembership = membersByUserId.get(project.ownerUserId) ?? null;

      return {
        projectId: project.id,
        projectSlug: project.slug,
        projectName: project.name,
        projectOwnerUserId: project.ownerUserId,
        projectOwnerName: ownerMembership?.fullName ?? "Unknown owner",
        projectOwnerEmail: ownerMembership?.email ?? "",
        projectOwnerWorkspaceRole: ownerMembership?.role ?? null,
        projectOwnerMembershipStatus: ownerMembership?.status ?? null,
        isWorkspaceOwner: project.ownerUserId === input.workspaceOwnerUserId,
      };
    });
}

async function listWorkspacesLocal() {
  const store = await readLocalStore();
  return store.workspaces.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function listProjectsForWorkspaceLocal(workspaceId: string) {
  const store = await readLocalStore();
  return store.projects
    .filter((project) => project.workspaceId === workspaceId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function listPlanRevisionsForProjectLocal(projectId: string) {
  const store = await readLocalStore();
  return store.planRevisions
    .filter((revision) => revision.projectId === projectId)
    .sort((a, b) => b.revisionNumber - a.revisionNumber);
}

async function getProjectBriefLocal(projectId: string) {
  const store = await readLocalStore();
  return store.projectBriefs.find((brief) => brief.projectId === projectId) ?? null;
}

async function getWorkspaceBySlugLocal(slug: string) {
  const workspaces = await listWorkspacesLocal();
  return workspaces.find((workspace) => workspace.slug === slug) ?? null;
}

async function getWorkspaceByIdLocal(id: string) {
  const workspaces = await listWorkspacesLocal();
  return workspaces.find((workspace) => workspace.id === id) ?? null;
}

async function getProjectBySlugLocal(workspaceId: string, slug: string) {
  const projects = await listProjectsForWorkspaceLocal(workspaceId);
  return projects.find((project) => project.slug === slug) ?? null;
}

async function createWorkspaceLocal(input: CreateWorkspaceInput) {
  const store = await readLocalStore();
  const timestamp = nowIso();
  const workspace: WorkspaceRecord = {
    id: crypto.randomUUID(),
    slug: uniqueSlug(input.name, store.workspaces.map((item) => item.slug)),
    name: input.name,
    ownerUserId: input.ownerUserId,
    createdByUserId: input.createdByUserId,
    businessCategory: input.businessCategory,
    country: input.country,
    defaultLocale: input.defaultLocale,
    supportedLocales: input.supportedLocales,
    companyName: input.companyName,
    intentNotes: input.intentNotes,
    onboardingPayload: {
      companyName: input.companyName,
      intentNotes: input.intentNotes,
      createdFrom: "phase2-local",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.workspaces.unshift(workspace);
  await writeLocalStore(store);
  await createWorkspaceMembership({
    workspaceId: workspace.id,
    userId: input.ownerUserId,
    role: "owner",
  });
  return workspace;
}

async function createProjectLocal(input: CreateProjectInput) {
  const store = await readLocalStore();
  const timestamp = nowIso();
  const projectId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const slug = uniqueSlug(
    input.name,
    store.projects.filter((item) => item.workspaceId === input.workspaceId).map((item) => item.slug),
  );

  const revision: PlanRevisionRecord = {
    id: revisionId,
    projectId,
    revisionNumber: 1,
    state: "generated",
    editedSection: "status",
    changeSummary: "Initial plan revision created from project intake.",
    plannerSource: input.plannerSource,
    plan: input.structuredPlan,
    createdAt: timestamp,
  };

  const project: ProjectRecord = {
    ...input,
    id: projectId,
    slug,
    ownerUserId: input.ownerUserId,
    createdByUserId: input.createdByUserId,
    status: "plan_ready",
    currentPlanRevisionId: revisionId,
    currentPlanRevisionNumber: 1,
    planLastUpdatedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const brief: ProjectBriefRecord = {
    id: crypto.randomUUID(),
    projectId,
    workspaceId: input.workspaceId,
    name: input.name,
    prompt: input.prompt,
    projectType: input.projectType,
    targetUsers: input.targetUsers,
    desiredPagesFeatures: input.desiredPagesFeatures,
    designStyle: input.designStyle,
    primaryLocale: input.primaryLocale,
    supportedLocales: input.supportedLocales,
    country: input.country,
    businessCategory: input.businessCategory,
    capabilities: input.capabilities,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.projects.unshift(project);
  store.projectBriefs.unshift(brief);
  store.planRevisions.unshift(revision);
  await writeLocalStore(store);
  return project;
}

async function createPlanRevisionLocal(input: CreatePlanRevisionInput) {
  const store = await readLocalStore();
  const projectIndex = store.projects.findIndex((project) => project.id === input.projectId);

  if (projectIndex === -1) {
    throw new Error("Project not found.");
  }

  const project = store.projects[projectIndex];
  const revisions = store.planRevisions.filter((revision) => revision.projectId === input.projectId);
  const timestamp = nowIso();
  const revisionNumber =
    revisions.length > 0 ? Math.max(...revisions.map((revision) => revision.revisionNumber)) + 1 : 1;

  const revision: PlanRevisionRecord = {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    revisionNumber,
    state: input.state,
    editedSection: input.editedSection,
    changeSummary: input.changeSummary,
    plannerSource: input.plannerSource,
    plan: input.plan,
    createdAt: timestamp,
  };

  const nextProject: ProjectRecord = {
    ...project,
    status: input.nextProjectStatus,
    structuredPlan: input.plan,
    currentPlanRevisionId: revision.id,
    currentPlanRevisionNumber: revision.revisionNumber,
    planLastUpdatedAt: timestamp,
    plannerSource: input.plannerSource,
    updatedAt: timestamp,
  };

  store.projects[projectIndex] = nextProject;
  store.planRevisions.unshift(revision);
  await writeLocalStore(store);

  return {
    project: nextProject,
    revision,
  };
}

async function updateProjectBriefLocal(input: UpdateProjectBriefInput) {
  const store = await readLocalStore();
  const projectIndex = store.projects.findIndex((project) => project.id === input.projectId);

  if (projectIndex === -1) {
    throw new Error("Project not found.");
  }

  const timestamp = nowIso();
  const briefIndex = store.projectBriefs.findIndex((brief) => brief.projectId === input.projectId);
  const nextBrief: ProjectBriefRecord = {
    ...(briefIndex >= 0
      ? store.projectBriefs[briefIndex]
      : synthesizeProjectBrief(store.projects[projectIndex], {
          id: crypto.randomUUID(),
          createdAt: timestamp,
        })),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    ...input.brief,
    updatedAt: timestamp,
  };

  if (briefIndex >= 0) {
    store.projectBriefs[briefIndex] = nextBrief;
  } else {
    store.projectBriefs.unshift(nextBrief);
  }

  store.projects[projectIndex] = {
    ...store.projects[projectIndex],
    updatedAt: timestamp,
  };
  await writeLocalStore(store);
  return nextBrief;
}

async function updateWorkspaceOwnerLocal(input: {
  workspaceId: string;
  ownerUserId: string;
}) {
  const store = await readLocalStore();
  const workspaceIndex = store.workspaces.findIndex((workspace) => workspace.id === input.workspaceId);

  if (workspaceIndex === -1) {
    throw new Error("Workspace not found.");
  }

  const updatedWorkspace: WorkspaceRecord = {
    ...store.workspaces[workspaceIndex],
    ownerUserId: input.ownerUserId,
    updatedAt: nowIso(),
  };

  store.workspaces[workspaceIndex] = updatedWorkspace;
  await writeLocalStore(store);
  return updatedWorkspace;
}

async function listWorkspacesSupabase() {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("workspaces")
    .select("*, workspace_onboarding(company_name, intent_notes, onboarding_payload)")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) =>
    mapWorkspaceRow(
      row as unknown as Record<string, unknown>,
      ((row as { workspace_onboarding?: Array<Record<string, unknown>> }).workspace_onboarding ?? [])[0],
    ),
  );
}

async function getWorkspaceBySlugSupabase(slug: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("workspaces")
    .select("*, workspace_onboarding(company_name, intent_notes, onboarding_payload)")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapWorkspaceRow(
    data as unknown as Record<string, unknown>,
    ((data as { workspace_onboarding?: Array<Record<string, unknown>> }).workspace_onboarding ?? [])[0],
  );
}

async function getWorkspaceByIdSupabase(id: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("workspaces")
    .select("*, workspace_onboarding(company_name, intent_notes, onboarding_payload)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapWorkspaceRow(
    data as unknown as Record<string, unknown>,
    ((data as { workspace_onboarding?: Array<Record<string, unknown>> }).workspace_onboarding ?? [])[0],
  );
}

async function listPlanRevisionsForProjectSupabase(projectId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("project_plan_revisions")
    .select("*")
    .eq("project_id", projectId)
    .order("revision_number", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapRevisionRow(row as unknown as Record<string, unknown>));
}

async function listProjectsForWorkspaceSupabase(workspaceId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const revisionsByProject = await Promise.all(
    rows.map(async (row) => ({
      projectId: String(row.id),
      revisions: await listPlanRevisionsForProjectSupabase(String(row.id)),
    })),
  );

  return rows.map((row) => {
    const revisions = revisionsByProject.find((item) => item.projectId === String(row.id))?.revisions ?? [];
    return mapProjectRow(row, revisions[0]);
  });
}

async function getProjectBySlugSupabase(workspaceId: string, slug: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const revisions = await listPlanRevisionsForProjectSupabase(String(data.id));
  return {
    project: mapProjectRow(data as unknown as Record<string, unknown>, revisions[0]),
    revisions,
  };
}

async function getProjectBriefSupabase(projectId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("project_briefs")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapBriefRow(data as unknown as Record<string, unknown>) : null;
}

async function createWorkspaceSupabase(input: CreateWorkspaceInput) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const existing = await listWorkspacesSupabase();
  const slug = uniqueSlug(input.name, existing.map((workspace) => workspace.slug));

  const { data: workspaceRow, error: workspaceError } = await client
    .from("workspaces")
    .insert({
      slug,
      name: input.name,
      owner_user_id: input.ownerUserId,
      created_by_user_id: input.createdByUserId,
      business_category: input.businessCategory,
      country: input.country,
      default_locale: input.defaultLocale,
      supported_locales: input.supportedLocales,
    })
    .select("*")
    .single();

  if (workspaceError) {
    throw new Error(workspaceError.message);
  }

  const { error: onboardingError } = await client.from("workspace_onboarding").insert({
    workspace_id: workspaceRow.id,
    company_name: input.companyName,
    intent_notes: input.intentNotes,
    onboarding_payload: {
      companyName: input.companyName,
      intentNotes: input.intentNotes,
      createdFrom: "phase2-supabase",
    },
  });

  if (onboardingError) {
    throw new Error(onboardingError.message);
  }

  await createWorkspaceMembership({
    workspaceId: String(workspaceRow.id),
    userId: input.ownerUserId,
    role: "owner",
  });

  return mapWorkspaceRow(workspaceRow as unknown as Record<string, unknown>, {
    company_name: input.companyName,
    intent_notes: input.intentNotes,
    onboarding_payload: {
      companyName: input.companyName,
      intentNotes: input.intentNotes,
      createdFrom: "phase2-supabase",
    },
  });
}

async function createProjectSupabase(input: CreateProjectInput) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const existingProjects = await listProjectsForWorkspaceSupabase(input.workspaceId);
  const slug = uniqueSlug(input.name, existingProjects.map((project) => project.slug));
  const timestamp = nowIso();

  const { data: projectRow, error: projectError } = await client
    .from("projects")
    .insert({
      workspace_id: input.workspaceId,
      slug,
      name: input.name,
      owner_user_id: input.ownerUserId,
      created_by_user_id: input.createdByUserId,
      starting_mode: input.startingMode,
      status: "plan_ready",
      project_type: input.projectType,
      prompt: input.prompt,
      target_users: input.targetUsers,
      desired_pages_features: input.desiredPagesFeatures,
      design_style: input.designStyle,
      primary_locale: input.primaryLocale,
      country: input.country,
      business_category: input.businessCategory,
      capabilities: input.capabilities,
      intake_payload: {
        ...input.intakePayload,
        supportedLocales: input.supportedLocales,
      },
      structured_plan: input.structuredPlan,
      current_plan_revision_number: 1,
      plan_last_updated_at: timestamp,
      planner_source: input.plannerSource,
    })
    .select("*")
    .single();

  if (projectError) {
    throw new Error(projectError.message);
  }

  const { data: revisionRow, error: revisionError } = await client
    .from("project_plan_revisions")
    .insert({
      project_id: projectRow.id,
      revision_number: 1,
      state: "generated",
      edited_section: "status",
      change_summary: "Initial plan revision created from project intake.",
      planner_source: input.plannerSource,
      plan_payload: input.structuredPlan,
      created_at: timestamp,
    })
    .select("*")
    .single();

  if (revisionError) {
    throw new Error(revisionError.message);
  }

  const { data: updatedProjectRow, error: updateError } = await client
    .from("projects")
    .update({
      current_plan_revision_id: revisionRow.id,
    })
    .eq("id", projectRow.id)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: briefError } = await client.from("project_briefs").insert({
    project_id: projectRow.id,
    workspace_id: input.workspaceId,
    name: input.name,
    prompt: input.prompt,
    project_type: input.projectType,
    target_users: input.targetUsers,
    desired_pages_features: input.desiredPagesFeatures,
    design_style: input.designStyle,
    primary_locale: input.primaryLocale,
    supported_locales: input.supportedLocales,
    country: input.country,
    business_category: input.businessCategory,
    capabilities: input.capabilities,
    created_at: timestamp,
    updated_at: timestamp,
  });

  if (briefError) {
    throw new Error(briefError.message);
  }

  return mapProjectRow(updatedProjectRow as unknown as Record<string, unknown>, mapRevisionRow(revisionRow));
}

async function createPlanRevisionSupabase(input: CreatePlanRevisionInput) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const existingRevisions = await listPlanRevisionsForProjectSupabase(input.projectId);
  const revisionNumber =
    existingRevisions.length > 0 ? Math.max(...existingRevisions.map((revision) => revision.revisionNumber)) + 1 : 1;
  const timestamp = nowIso();

  const { data: revisionRow, error: revisionError } = await client
    .from("project_plan_revisions")
    .insert({
      project_id: input.projectId,
      revision_number: revisionNumber,
      state: input.state,
      edited_section: input.editedSection,
      change_summary: input.changeSummary,
      planner_source: input.plannerSource,
      plan_payload: input.plan,
      created_at: timestamp,
    })
    .select("*")
    .single();

  if (revisionError) {
    throw new Error(revisionError.message);
  }

  const { data: updatedProjectRow, error: projectError } = await client
    .from("projects")
    .update({
      status: input.nextProjectStatus,
      structured_plan: input.plan,
      current_plan_revision_id: revisionRow.id,
      current_plan_revision_number: revisionNumber,
      plan_last_updated_at: timestamp,
      planner_source: input.plannerSource,
    })
    .eq("id", input.projectId)
    .select("*")
    .single();

  if (projectError) {
    throw new Error(projectError.message);
  }

  return {
    project: mapProjectRow(updatedProjectRow as unknown as Record<string, unknown>, mapRevisionRow(revisionRow)),
    revision: mapRevisionRow(revisionRow as unknown as Record<string, unknown>),
  };
}

async function updateProjectBriefSupabase(input: UpdateProjectBriefInput) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const timestamp = nowIso();
  const row = {
    workspace_id: input.workspaceId,
    project_id: input.projectId,
    name: input.brief.name,
    prompt: input.brief.prompt,
    project_type: input.brief.projectType,
    target_users: input.brief.targetUsers,
    desired_pages_features: input.brief.desiredPagesFeatures,
    design_style: input.brief.designStyle,
    primary_locale: input.brief.primaryLocale,
    supported_locales: input.brief.supportedLocales,
    country: input.brief.country,
    business_category: input.brief.businessCategory,
    capabilities: input.brief.capabilities,
    updated_at: timestamp,
  };
  const existing = await getProjectBriefSupabase(input.projectId);

  if (existing) {
    const { data: updatedRow, error } = await client
      .from("project_briefs")
      .update(row)
      .eq("project_id", input.projectId)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapBriefRow(updatedRow as unknown as Record<string, unknown>);
  }

  const { data: insertedRow, error } = await client
    .from("project_briefs")
    .insert({
      ...row,
      created_at: timestamp,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapBriefRow(insertedRow as unknown as Record<string, unknown>);
}

async function updateWorkspaceOwnerSupabase(input: {
  workspaceId: string;
  ownerUserId: string;
}) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await client
    .from("workspaces")
    .update({
      owner_user_id: input.ownerUserId,
      updated_at: nowIso(),
    })
    .eq("id", input.workspaceId)
    .select("*, workspace_onboarding(company_name, intent_notes, onboarding_payload)")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapWorkspaceRow(
    data as unknown as Record<string, unknown>,
    ((data as { workspace_onboarding?: Array<Record<string, unknown>> }).workspace_onboarding ?? [])[0],
  );
}

export function getPersistenceSummary(): PersistenceSummary {
  return {
    mode: isSupabaseConfigured() ? "supabase" : "local",
    configured: isSupabaseConfigured(),
  };
}

export async function listWorkspaces() {
  const currentUser = await resolveCurrentUser();

  if (!currentUser) {
    return [];
  }

  const [workspaces, memberships] = await Promise.all([
    isSupabaseConfigured() ? listWorkspacesSupabase() : listWorkspacesLocal(),
    listWorkspaceMembershipsForUser(currentUser.id),
  ]);
  const membershipIds = new Set(memberships.map((membership) => membership.workspaceId));

  return workspaces.filter((workspace) => membershipIds.has(workspace.id));
}

export async function getWorkspaceBySlug(slug: string) {
  const workspace = isSupabaseConfigured()
    ? await getWorkspaceBySlugSupabase(slug)
    : await getWorkspaceBySlugLocal(slug);

  if (!workspace) {
    return null;
  }

  const access = await resolveWorkspaceAccess(workspace);
  return access ? workspace : null;
}

export async function getWorkspaceById(id: string) {
  return isSupabaseConfigured() ? getWorkspaceByIdSupabase(id) : getWorkspaceByIdLocal(id);
}

export async function getWorkspaceWithProjects(slug: string): Promise<WorkspaceWithProjects | null> {
  const workspace = isSupabaseConfigured()
    ? await getWorkspaceBySlugSupabase(slug)
    : await getWorkspaceBySlugLocal(slug);

  if (!workspace) {
    return null;
  }

  const access = await resolveWorkspaceAccess(workspace);

  if (!access) {
    return null;
  }

  const projects = isSupabaseConfigured()
    ? await listProjectsForWorkspaceSupabase(workspace.id)
    : await listProjectsForWorkspaceLocal(workspace.id);

  return {
    ...workspace,
    projects,
    currentUser: access.currentUser,
    membership: access.membership,
    permissions: access.permissions,
  };
}

export async function getWorkspaceMemberManagementBundle(
  slug: string,
): Promise<WorkspaceMemberManagementBundle | null> {
  const workspace = await getWorkspaceWithProjects(slug);
  if (!workspace) {
    return null;
  }

  const [members, invitations, events] = await Promise.all([
    listWorkspaceMembers(workspace.id),
    listWorkspaceInvitations(workspace.id),
    listWorkspaceMemberEvents(workspace.id),
  ]);

  return {
    workspace,
    currentUser: workspace.currentUser,
    membership: workspace.membership,
    permissions: workspace.permissions,
    members,
    invitations,
    events,
    projectOwnerships: buildWorkspaceProjectOwnerships({
      projects: workspace.projects,
      members,
      workspaceOwnerUserId: workspace.ownerUserId,
    }),
  };
}

export async function getWorkspaceInvitationAcceptanceBundle(
  invitationToken: string,
): Promise<WorkspaceInvitationAcceptanceBundle | null> {
  const invitation = await getWorkspaceInvitationByToken(invitationToken);

  if (!invitation) {
    return null;
  }

  const [workspace, existingUser, currentUser] = await Promise.all([
    getWorkspaceById(invitation.workspaceId),
    findUserByEmail(invitation.email),
    getCurrentAuthenticatedUser(),
  ]);

  if (!workspace) {
    return null;
  }

  return {
    workspace,
    invitation,
    existingUser: existingUser
      ? {
          id: existingUser.id,
          email: existingUser.email,
          fullName: existingUser.fullName,
          companyName: existingUser.companyName,
        }
      : null,
    currentUser: currentUser?.user ?? null,
  };
}

export async function getProjectPlanBundle(
  workspaceSlug: string,
  projectSlug: string,
): Promise<ProjectPlanBundle | null> {
  const workspace = isSupabaseConfigured()
    ? await getWorkspaceBySlugSupabase(workspaceSlug)
    : await getWorkspaceBySlugLocal(workspaceSlug);

  if (!workspace) {
    return null;
  }

  const access = await resolveWorkspaceAccess(workspace);

  if (!access) {
    return null;
  }

  if (isSupabaseConfigured()) {
    const result = await getProjectBySlugSupabase(workspace.id, projectSlug);

    if (!result) {
      return null;
    }

    const brief =
      (await getProjectBriefSupabase(result.project.id)) ?? synthesizeProjectBrief(result.project);

    return {
      workspace,
      project: result.project,
      brief,
      revisions: result.revisions,
      currentUser: access.currentUser,
      membership: access.membership,
      workspacePermissions: access.permissions,
      projectPermissions: buildProjectAccess({
        currentUser: access.currentUser,
        membership: access.membership,
        project: result.project,
      }),
    };
  }

  const project = await getProjectBySlugLocal(workspace.id, projectSlug);

  if (!project) {
    return null;
  }

  const revisions = await listPlanRevisionsForProjectLocal(project.id);
  const brief = (await getProjectBriefLocal(project.id)) ?? synthesizeProjectBrief(project);

  return {
    workspace,
    project,
    brief,
    revisions,
    currentUser: access.currentUser,
    membership: access.membership,
    workspacePermissions: access.permissions,
    projectPermissions: buildProjectAccess({
      currentUser: access.currentUser,
      membership: access.membership,
      project,
    }),
  };
}

export async function createWorkspace(input: CreateWorkspaceInput) {
  if (isSupabaseConfigured()) {
    return createWorkspaceSupabase(input);
  }

  return createWorkspaceLocal(input);
}

export async function createProject(input: CreateProjectInput) {
  if (isSupabaseConfigured()) {
    return createProjectSupabase(input);
  }

  return createProjectLocal(input);
}

export async function createPlanRevision(input: CreatePlanRevisionInput) {
  if (isSupabaseConfigured()) {
    return createPlanRevisionSupabase(input);
  }

  return createPlanRevisionLocal(input);
}

export async function updateProjectBrief(input: UpdateProjectBriefInput) {
  if (isSupabaseConfigured()) {
    return updateProjectBriefSupabase(input);
  }

  return updateProjectBriefLocal(input);
}

export async function updateWorkspaceOwner(input: {
  workspaceId: string;
  ownerUserId: string;
}) {
  if (isSupabaseConfigured()) {
    return updateWorkspaceOwnerSupabase(input);
  }

  return updateWorkspaceOwnerLocal(input);
}
