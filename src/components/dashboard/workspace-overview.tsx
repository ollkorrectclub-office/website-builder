import Link from "next/link";

import { projectBaseRoute } from "@/lib/builder/routes";
import { WorkspaceMembersCard } from "@/components/dashboard/workspace-members-card";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { countryOptions, statusLabels } from "@/lib/workspaces/options";
import type {
  PersistenceSummary,
  WorkspaceMemberManagementBundle,
  WorkspaceWithProjects,
} from "@/lib/workspaces/types";
import { formatDateLabel, statusTone } from "@/lib/workspaces/utils";
import { PersistenceCard } from "@/components/dashboard/persistence-card";
import type { FormState } from "@/lib/workspaces/form-state";

function countryLabel(locale: Locale, value: WorkspaceWithProjects["country"]) {
  return countryOptions.find((option) => option.value === value)?.label[locale] ?? value;
}

export function WorkspaceOverview({
  locale,
  dictionary,
  workspace,
  persistence,
  memberManagement,
  inviteMemberAction,
  updateMemberRoleAction,
  deactivateMemberAction,
  reactivateMemberAction,
  revokeInvitationAction,
  resendInvitationAction,
  transferOwnerAction,
  reassignProjectOwnerAction,
}: {
  locale: Locale;
  dictionary: Dictionary;
  workspace: WorkspaceWithProjects;
  persistence: PersistenceSummary;
  memberManagement: WorkspaceMemberManagementBundle;
  inviteMemberAction: (state: FormState, formData: FormData) => Promise<FormState>;
  updateMemberRoleAction: (state: FormState, formData: FormData) => Promise<FormState>;
  deactivateMemberAction: (state: FormState, formData: FormData) => Promise<FormState>;
  reactivateMemberAction: (state: FormState, formData: FormData) => Promise<FormState>;
  revokeInvitationAction: (state: FormState, formData: FormData) => Promise<FormState>;
  resendInvitationAction: (state: FormState, formData: FormData) => Promise<FormState>;
  transferOwnerAction: (state: FormState, formData: FormData) => Promise<FormState>;
  reassignProjectOwnerAction: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="px-5 py-5">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {dictionary.dashboard.activeProjects}
          </p>
          <p className="mt-3 text-3xl font-bold text-card-foreground">{workspace.projects.length}</p>
        </Card>
        <Card className="px-5 py-5">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {dictionary.dashboard.workspaceCountry}
          </p>
          <p className="mt-3 text-xl font-bold text-card-foreground">
            {countryLabel(locale, workspace.country)}
          </p>
        </Card>
        <Card className="px-5 py-5">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {dictionary.dashboard.workspaceCategory}
          </p>
          <p className="mt-3 text-xl font-bold text-card-foreground">{workspace.businessCategory}</p>
        </Card>
        <Card className="px-5 py-5">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {dictionary.dashboard.workspaceLocales}
          </p>
          <p className="mt-3 text-xl font-bold text-card-foreground">
            {workspace.supportedLocales.join(" / ")}
          </p>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <Card id="projects" className="px-6 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {dictionary.dashboard.projectTable}
              </p>
              <h3 className="mt-2 font-display text-2xl font-bold text-card-foreground">
                {dictionary.dashboard.projectTable}
              </h3>
            </div>
            {workspace.permissions.canCreateProject ? (
              <Link
                href={`/${locale}/app/workspaces/${workspace.slug}/projects/new`}
                className={buttonStyles("primary")}
              >
                {dictionary.dashboard.createProject}
              </Link>
            ) : null}
          </div>

          {workspace.projects.length === 0 ? (
            <div className="mt-8 rounded-[28px] border border-dashed border-border bg-background/60 px-6 py-8 text-center">
              <h4 className="font-display text-2xl font-bold text-card-foreground">
                {dictionary.dashboard.noProjectsTitle}
              </h4>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                {dictionary.dashboard.noProjectsCopy}
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">{dictionary.dashboard.projectSector}</th>
                    <th className="pb-3 font-medium">{dictionary.dashboard.projectStage}</th>
                    <th className="pb-3 font-medium">{dictionary.dashboard.projectLocale}</th>
                    <th className="pb-3 font-medium">{dictionary.dashboard.projectUpdated}</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.projects.map((project) => (
                    <tr key={project.id} className="border-b border-border last:border-0">
                      <td className="py-4">
                        <Link
                          href={projectBaseRoute(locale, workspace.slug, project.slug)}
                          className="font-semibold text-card-foreground transition hover:text-primary"
                        >
                          {project.name}
                        </Link>
                      </td>
                      <td className="py-4 text-muted-foreground">{project.businessCategory}</td>
                      <td className="py-4">
                        <Badge className={statusTone(project.status)}>
                          {statusLabels[project.status][locale]}
                        </Badge>
                      </td>
                      <td className="py-4 text-muted-foreground">{project.supportedLocales.join(" / ")}</td>
                      <td className="py-4 text-muted-foreground">{formatDateLabel(project.updatedAt, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <PersistenceCard dictionary={dictionary} persistence={persistence} />
          <Card id="workspace-setup" className="px-5 py-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.dashboard.latestIntent}
            </p>
            <p className="mt-3 text-sm leading-7 text-card-foreground">
              {workspace.intentNotes || "No onboarding notes were stored yet."}
            </p>
          </Card>
        </div>
      </section>

      <WorkspaceMembersCard
        locale={locale}
        dictionary={dictionary}
        bundle={memberManagement}
        inviteMemberAction={inviteMemberAction}
        updateRoleAction={updateMemberRoleAction}
        deactivateMemberAction={deactivateMemberAction}
        reactivateMemberAction={reactivateMemberAction}
        revokeInvitationAction={revokeInvitationAction}
        resendInvitationAction={resendInvitationAction}
        transferOwnerAction={transferOwnerAction}
        reassignProjectOwnerAction={reassignProjectOwnerAction}
      />
    </div>
  );
}
