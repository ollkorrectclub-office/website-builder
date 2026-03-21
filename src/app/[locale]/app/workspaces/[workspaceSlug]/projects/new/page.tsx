import { notFound } from "next/navigation";

import { ProjectCreateFlow } from "@/components/dashboard/project-create-flow";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { createProjectAction } from "@/lib/workspaces/actions";
import { getWorkspaceBySlug } from "@/lib/workspaces/repository";

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ locale: string; workspaceSlug: string }>;
}) {
  const { locale, workspaceSlug } = await params;
  const dictionary = getDictionary(locale);
  const workspace = await getWorkspaceBySlug(workspaceSlug);

  if (!workspace) {
    notFound();
  }

  const action = createProjectAction.bind(null, locale, workspaceSlug);

  return (
    <ProjectCreateFlow
      locale={locale as Locale}
      dictionary={dictionary}
      action={action}
      workspaceDefaults={{
        businessCategory: workspace.businessCategory,
        country: workspace.country,
        defaultLocale: workspace.defaultLocale,
        supportedLocales: workspace.supportedLocales,
      }}
    />
  );
}
