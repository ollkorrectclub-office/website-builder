import Link from "next/link";

import { WorkspaceCreateForm } from "@/components/dashboard/workspace-create-form";
import { Logo } from "@/components/ui/logo";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { createWorkspaceAction } from "@/lib/workspaces/actions";

export default async function NewWorkspacePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dictionary = getDictionary(locale);
  const action = createWorkspaceAction.bind(null, locale);

  return (
    <div className="min-h-screen px-6 py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <Logo href={`/${locale}`} label={dictionary.common.appName} />
          <Link
            href={`/${locale}/app/workspaces`}
            className="rounded-full border border-border bg-card/80 px-4 py-3 text-sm font-semibold text-card-foreground transition hover:-translate-y-0.5"
          >
            {dictionary.workspaceList.title}
          </Link>
        </div>

        <WorkspaceCreateForm locale={locale as Locale} dictionary={dictionary} action={action} />
      </div>
    </div>
  );
}
