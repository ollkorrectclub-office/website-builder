import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/lib/auth/actions";
import { ProjectRefreshQueueInbox } from "@/components/builder/project-refresh-queue-inbox";
import { ProjectBuilderTabs } from "@/components/builder/project-builder-tabs";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { projectDeployRoute, projectTabRoute, projectTimelineRoute } from "@/lib/builder/routes";
import type { BuilderTabItem, ProjectBuilderRefreshQueueItemRecord } from "@/lib/builder/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { plannerSourceLabel } from "@/lib/planner/labels";
import { countryOptions, projectTypeOptions, revisionStateLabels, statusLabels, workspaceRoleLabels } from "@/lib/workspaces/options";
import type { AuthenticatedUserRecord, PlanRevisionRecord, ProjectRecord, WorkspaceMemberRecord, WorkspaceRecord } from "@/lib/workspaces/types";
import { formatDateTimeLabel, revisionTone, statusTone } from "@/lib/workspaces/utils";

function projectTypeLabel(locale: Locale, value: ProjectRecord["projectType"]) {
  return projectTypeOptions.find((option) => option.value === value)?.label[locale] ?? value;
}

function countryLabel(locale: Locale, value: WorkspaceRecord["country"]) {
  return countryOptions.find((option) => option.value === value)?.label[locale] ?? value;
}

export function ProjectBuilderShell({
  locale,
  dictionary,
  workspace,
  project,
  latestRevision,
  refreshQueue,
  currentUser,
  membership,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  workspace: WorkspaceRecord;
  project: ProjectRecord;
  latestRevision: PlanRevisionRecord;
  refreshQueue: ProjectBuilderRefreshQueueItemRecord[];
  currentUser: AuthenticatedUserRecord;
  membership: WorkspaceMemberRecord;
  children: ReactNode;
}) {
  const logout = logoutAction.bind(null, locale);
  const tabs: BuilderTabItem[] = [
    {
      key: "plan",
      href: projectTabRoute(locale, workspace.slug, project.slug, "plan"),
      label: dictionary.builder.tabs.plan.label,
      description: dictionary.builder.tabs.plan.description,
    },
    {
      key: "visual",
      href: projectTabRoute(locale, workspace.slug, project.slug, "visual"),
      label: dictionary.builder.tabs.visual.label,
      description: dictionary.builder.tabs.visual.description,
    },
    {
      key: "code",
      href: projectTabRoute(locale, workspace.slug, project.slug, "code"),
      label: dictionary.builder.tabs.code.label,
      description: dictionary.builder.tabs.code.description,
    },
    {
      key: "preview",
      href: projectTabRoute(locale, workspace.slug, project.slug, "preview"),
      label: dictionary.builder.tabs.preview.label,
      description: dictionary.builder.tabs.preview.description,
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/80">
        <div className="border-b border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.06),transparent_38%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.08),transparent_32%)] px-6 py-6 dark:bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.10),transparent_32%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_26%)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {dictionary.builder.studioEyebrow}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link
                  href={`/${locale}/app/workspaces/${workspace.slug}`}
                  className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                >
                  {workspace.name}
                </Link>
                <span className="text-muted-foreground">/</span>
                <h1 className="font-display text-3xl font-bold text-card-foreground lg:text-4xl">
                  {project.name}
                </h1>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
                {project.structuredPlan.productSummary}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Badge className={statusTone(project.status)}>
                {statusLabels[project.status][locale]}
              </Badge>
              <Badge className={revisionTone(latestRevision.state)}>
                {revisionStateLabels[latestRevision.state][locale]}
              </Badge>
              <Badge>{projectTypeLabel(locale, project.projectType)}</Badge>
              <Link
                href={`/${locale}/app/workspaces/${workspace.slug}`}
                className={buttonStyles("secondary")}
              >
                {dictionary.builder.openWorkspace}
              </Link>
              <Link
                href={projectTimelineRoute(locale, workspace.slug, project.slug)}
                className={buttonStyles("secondary")}
              >
                {dictionary.builder.timeline.open}
              </Link>
              <Link
                href={projectDeployRoute(locale, workspace.slug, project.slug)}
                className={buttonStyles("secondary")}
              >
                {dictionary.builder.deploy.open}
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="rounded-[24px] border border-border bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.builder.workspaceContext}
              </p>
              <p className="mt-2 text-lg font-semibold text-card-foreground">{workspace.name}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {workspace.businessCategory} · {countryLabel(locale, workspace.country)}
              </p>
            </div>
            <div className="rounded-[24px] border border-border bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.builder.projectStatus}
              </p>
              <p className="mt-2 text-lg font-semibold text-card-foreground">
                {statusLabels[project.status][locale]}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {dictionary.builder.projectType}: {projectTypeLabel(locale, project.projectType)}
              </p>
            </div>
            <div className="rounded-[24px] border border-border bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.builder.revisionSummary}
              </p>
              <p className="mt-2 text-lg font-semibold text-card-foreground">
                {dictionary.plan.revisionPrefix} {project.currentPlanRevisionNumber}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{latestRevision.changeSummary}</p>
            </div>
            <div className="rounded-[24px] border border-border bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.builder.lastUpdated}
              </p>
              <p className="mt-2 text-lg font-semibold text-card-foreground">
                {formatDateTimeLabel(project.updatedAt, locale)}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {dictionary.plan.plannerSource}: {plannerSourceLabel(dictionary, project.plannerSource)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-border bg-background/75 px-4 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {locale === "sq" ? "I kyqur" : "Signed in"}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">{currentUser.fullName}</p>
              <p className="text-xs text-muted-foreground">
                {currentUser.email} · {workspaceRoleLabels[membership.role][locale]}
              </p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className={buttonStyles("secondary")}
              >
                {locale === "sq" ? "Dil" : "Sign out"}
              </button>
            </form>
          </div>
        </div>

        <div className="px-4 py-4">
          <ProjectBuilderTabs items={tabs} />
        </div>
      </Card>

      <ProjectRefreshQueueInbox
        locale={locale}
        dictionary={dictionary}
        workspaceSlug={workspace.slug}
        projectSlug={project.slug}
        queueItems={refreshQueue}
      />

      {children}
    </div>
  );
}
