import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
}

interface WorkspaceRow {
  id: string;
  slug: string;
}

interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  owner_user_id: string | null;
}

interface WorkspaceMemberRow {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "editor" | "viewer";
  status: "active" | "deactivated";
}

function createSupabaseAdminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase E2E admin client is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export interface SupabaseWorkspaceMembershipBaseline {
  workspaceId: string;
  projectId: string;
  projectName: string;
  ownerFullName: string;
  ownerUserId: string;
  ownerMembershipId: string;
}

export async function normalizeSupabaseWorkspaceMembershipBaseline(input: {
  ownerEmail: string;
  workspaceSlug: string;
  projectSlug: string;
}) {
  const admin = createSupabaseAdminClient();
  const normalizedEmail = input.ownerEmail.trim().toLowerCase();

  const { data: ownerProfile, error: ownerError } = await admin
    .from("profiles")
    .select("id,email,full_name")
    .eq("email", normalizedEmail)
    .maybeSingle<ProfileRow>();

  if (ownerError) {
    throw new Error(`Unable to load the Supabase owner profile: ${ownerError.message}`);
  }

  if (!ownerProfile) {
    throw new Error(`No Supabase profile was found for ${input.ownerEmail}.`);
  }

  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .select("id,slug")
    .eq("slug", input.workspaceSlug)
    .maybeSingle<WorkspaceRow>();

  if (workspaceError) {
    throw new Error(`Unable to load the Supabase workspace: ${workspaceError.message}`);
  }

  if (!workspace) {
    throw new Error(`No workspace was found for slug ${input.workspaceSlug}.`);
  }

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id,slug,name,owner_user_id")
    .eq("workspace_id", workspace.id)
    .eq("slug", input.projectSlug)
    .maybeSingle<ProjectRow>();

  if (projectError) {
    throw new Error(`Unable to load the Supabase project: ${projectError.message}`);
  }

  if (!project) {
    throw new Error(`No project was found for slug ${input.projectSlug} in workspace ${input.workspaceSlug}.`);
  }

  const { data: workspaceMembers, error: membersError } = await admin
    .from("workspace_members")
    .select("id,user_id,role,status")
    .eq("workspace_id", workspace.id)
    .returns<WorkspaceMemberRow[]>();

  if (membersError) {
    throw new Error(`Unable to load workspace members: ${membersError.message}`);
  }

  const ownerMembership = workspaceMembers.find((member) => member.user_id === ownerProfile.id) ?? null;

  if (!ownerMembership) {
    throw new Error(`${input.ownerEmail} is not a member of workspace ${input.workspaceSlug}.`);
  }

  const otherOwnerMembershipIds = workspaceMembers
    .filter((member) => member.user_id !== ownerProfile.id && member.role === "owner")
    .map((member) => member.id);

  if (otherOwnerMembershipIds.length > 0) {
    const { error: demoteError } = await admin
      .from("workspace_members")
      .update({ role: "admin" })
      .in("id", otherOwnerMembershipIds);

    if (demoteError) {
      throw new Error(`Unable to demote the previous workspace owner(s): ${demoteError.message}`);
    }
  }

  const { error: restoreOwnerMembershipError } = await admin
    .from("workspace_members")
    .update({ role: "owner", status: "active" })
    .eq("id", ownerMembership.id);

  if (restoreOwnerMembershipError) {
    throw new Error(`Unable to restore the configured workspace owner membership: ${restoreOwnerMembershipError.message}`);
  }

  const { error: workspaceOwnerError } = await admin
    .from("workspaces")
    .update({ owner_user_id: ownerProfile.id })
    .eq("id", workspace.id);

  if (workspaceOwnerError) {
    throw new Error(`Unable to restore the workspace owner pointer: ${workspaceOwnerError.message}`);
  }

  const { error: projectOwnerError } = await admin
    .from("projects")
    .update({ owner_user_id: ownerProfile.id })
    .eq("id", project.id);

  if (projectOwnerError) {
    throw new Error(`Unable to restore the target project owner pointer: ${projectOwnerError.message}`);
  }

  return {
    workspaceId: workspace.id,
    projectId: project.id,
    projectName: project.name,
    ownerFullName: ownerProfile.full_name,
    ownerUserId: ownerProfile.id,
    ownerMembershipId: ownerMembership.id,
  } satisfies SupabaseWorkspaceMembershipBaseline;
}
