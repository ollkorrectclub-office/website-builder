import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/lib/auth/actions";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { projectBaseRoute } from "@/lib/builder/routes";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { workspaceRoleLabels } from "@/lib/workspaces/options";
import type { PersistenceSummary, WorkspaceMemberRecord, WorkspaceWithProjects } from "@/lib/workspaces/types";

export function DashboardShell({
  locale,
  dictionary,
  workspace,
  persistence,
  currentUser,
  membership,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  workspace: WorkspaceWithProjects;
  persistence: PersistenceSummary;
  currentUser: WorkspaceWithProjects["currentUser"];
  membership: WorkspaceMemberRecord;
  children: ReactNode;
}) {
  const firstProject = workspace.projects[0];
  const logout = logoutAction.bind(null, locale);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen w-full max-w-[1500px] gap-6 px-4 py-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-6">
        <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <Card className="flex h-full flex-col gap-8 bg-slate-950 px-6 py-7 text-slate-100 shadow-panel">
            <div className="space-y-6">
              <Logo href={`/${locale}/app/workspaces/${workspace.slug}`} label={workspace.name} compact />
              <div className="space-y-3">
                <Badge className="border-white/10 bg-white/10 text-white/80">
                  {persistence.mode === "supabase" ? "Supabase" : "Local dev"}
                </Badge>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {dictionary.dashboard.greeting}
                  </p>
                  <h1 className="mt-3 font-display text-2xl font-bold leading-tight text-white">
                    {workspace.name}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{dictionary.dashboard.copy}</p>
                </div>
              </div>
            </div>

            <nav className="grid gap-2 text-sm font-medium">
              <Link
                href={`/${locale}/app/workspaces`}
                className="rounded-2xl px-4 py-3 text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                {dictionary.workspaceList.eyebrow}
              </Link>
              <Link
                href={`/${locale}/app/workspaces/${workspace.slug}`}
                className="rounded-2xl bg-white/8 px-4 py-3 text-white transition hover:bg-white/14"
              >
                {dictionary.dashboard.shellOverview}
              </Link>
              {workspace.permissions.canCreateProject ? (
                <Link
                  href={`/${locale}/app/workspaces/${workspace.slug}/projects/new`}
                  className="rounded-2xl px-4 py-3 text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  {dictionary.dashboard.createProject}
                </Link>
              ) : null}
              {firstProject ? (
                <Link
                  href={projectBaseRoute(locale, workspace.slug, firstProject.slug)}
                  className="rounded-2xl px-4 py-3 text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  {firstProject.name}
                </Link>
              ) : null}
              <a
                href={`/${locale}/app/workspaces/${workspace.slug}#workspace-setup`}
                className="rounded-2xl px-4 py-3 text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                {dictionary.dashboard.shellSettings}
              </a>
              <a
                href={`/${locale}/app/workspaces/${workspace.slug}#workspace-members`}
                className="rounded-2xl px-4 py-3 text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                {dictionary.dashboard.members.title}
              </a>
            </nav>

            <div className="mt-auto space-y-3 rounded-[24px] border border-white/10 bg-white/6 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    {locale === "sq" ? "I kyqur" : "Signed in"}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{currentUser.fullName}</p>
                  <p className="text-xs text-slate-400">{currentUser.email}</p>
                </div>
                <Badge className="border-white/10 bg-white/10 text-white/80">
                  {workspaceRoleLabels[membership.role][locale]}
                </Badge>
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                {dictionary.dashboard.latestIntent}
              </p>
              <p className="text-sm leading-6 text-slate-200">
                {workspace.intentNotes || dictionary.onboarding.helper}
              </p>
              <form action={logout} className="pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  {locale === "sq" ? "Dil" : "Sign out"}
                </button>
              </form>
            </div>
          </Card>
        </aside>

        <div className="space-y-6">
          <Card className="px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {dictionary.builder.studioEyebrow}
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold text-foreground">
                  {workspace.companyName}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <LocaleSwitcher locale={locale} />
                <ThemeToggle
                  lightLabel={dictionary.common.themeLight}
                  darkLabel={dictionary.common.themeDark}
                />
              </div>
            </div>
          </Card>

          {children}
        </div>
      </div>
    </div>
  );
}
