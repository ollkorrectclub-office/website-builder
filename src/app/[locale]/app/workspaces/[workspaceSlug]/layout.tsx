import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { getPersistenceSummary, getWorkspaceWithProjects } from "@/lib/workspaces/repository";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; workspaceSlug: string }>;
}) {
  const { locale, workspaceSlug } = await params;
  const dictionary = getDictionary(locale);
  const [workspace, persistence] = await Promise.all([
    getWorkspaceWithProjects(workspaceSlug),
    getPersistenceSummary(),
  ]);

  if (!workspace) {
    notFound();
  }

  return (
    <DashboardShell
      locale={locale as Locale}
      dictionary={dictionary}
      workspace={workspace}
      persistence={persistence}
      currentUser={workspace.currentUser}
      membership={workspace.membership}
    >
      {children}
    </DashboardShell>
  );
}
