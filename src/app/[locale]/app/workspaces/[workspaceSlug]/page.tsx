import { notFound } from "next/navigation";

import { WorkspaceOverview } from "@/components/dashboard/workspace-overview";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import {
  getPersistenceSummary,
  getWorkspaceMemberManagementBundle,
  getWorkspaceWithProjects,
} from "@/lib/workspaces/repository";
import {
  addWorkspaceMemberAction,
  deactivateWorkspaceMemberAction,
  transferWorkspaceOwnershipAction,
  updateWorkspaceMemberRoleAction,
} from "@/lib/workspaces/actions";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ locale: string; workspaceSlug: string }>;
}) {
  const { locale, workspaceSlug } = await params;
  const dictionary = getDictionary(locale);
  const [workspace, persistence, memberManagement] = await Promise.all([
    getWorkspaceWithProjects(workspaceSlug),
    getPersistenceSummary(),
    getWorkspaceMemberManagementBundle(workspaceSlug),
  ]);

  if (!workspace || !memberManagement) {
    notFound();
  }

  return (
    <WorkspaceOverview
      locale={locale as Locale}
      dictionary={dictionary}
      workspace={workspace}
      persistence={persistence}
      memberManagement={memberManagement}
      inviteMemberAction={addWorkspaceMemberAction.bind(null, locale, workspace.slug)}
      updateMemberRoleAction={updateWorkspaceMemberRoleAction.bind(null, locale, workspace.slug)}
      deactivateMemberAction={deactivateWorkspaceMemberAction.bind(null, locale, workspace.slug)}
      transferOwnerAction={transferWorkspaceOwnershipAction.bind(null, locale, workspace.slug)}
    />
  );
}
