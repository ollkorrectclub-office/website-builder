import { logoutAction, requireAuthenticatedUserOrRedirect } from "@/lib/auth/actions";
import { Logo } from "@/components/ui/logo";
import { WorkspaceList } from "@/components/dashboard/workspace-list";
import { PersistenceCard } from "@/components/dashboard/persistence-card";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { getPersistenceSummary, listWorkspaces } from "@/lib/workspaces/repository";

export default async function WorkspacesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const currentUser = await requireAuthenticatedUserOrRedirect(locale, `/${locale}/app/workspaces`);
  const dictionary = getDictionary(locale);
  const [workspaces, persistence] = await Promise.all([listWorkspaces(), getPersistenceSummary()]);
  const logout = logoutAction.bind(null, locale);

  return (
    <div className="min-h-screen px-6 py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <Logo href={`/${locale}`} label={dictionary.common.appName} />
          <div className="flex items-center gap-3">
            <div className="hidden rounded-full border border-border bg-card/80 px-4 py-2 text-sm text-muted-foreground sm:block">
              {currentUser.fullName}
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-full border border-border bg-card/80 px-4 py-3 text-sm font-semibold text-card-foreground transition hover:-translate-y-0.5"
              >
                {locale === "sq" ? "Dil" : "Sign out"}
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_360px]">
          <WorkspaceList locale={locale as Locale} dictionary={dictionary} workspaces={workspaces} />
          <div className="px-6 xl:px-0">
            <PersistenceCard dictionary={dictionary} persistence={persistence} />
          </div>
        </div>
      </div>
    </div>
  );
}
