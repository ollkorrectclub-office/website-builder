import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ProjectBuilderShell } from "@/components/builder/project-builder-shell";
import { listProjectBuilderRefreshQueue } from "@/lib/builder/refresh-queue-repository";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { getProjectPlanBundle } from "@/lib/workspaces/repository";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; workspaceSlug: string; projectSlug: string }>;
}) {
  const { locale, workspaceSlug, projectSlug } = await params;
  const dictionary = getDictionary(locale);
  const [bundle, refreshQueue] = await Promise.all([
    getProjectPlanBundle(workspaceSlug, projectSlug),
    listProjectBuilderRefreshQueue(workspaceSlug, projectSlug),
  ]);

  if (!bundle) {
    notFound();
  }

  return (
    <ProjectBuilderShell
      locale={locale as Locale}
      dictionary={dictionary}
      workspace={bundle.workspace}
      project={bundle.project}
      latestRevision={bundle.revisions[0]}
      refreshQueue={refreshQueue}
      currentUser={bundle.currentUser}
      membership={bundle.membership}
    >
      {children}
    </ProjectBuilderShell>
  );
}
