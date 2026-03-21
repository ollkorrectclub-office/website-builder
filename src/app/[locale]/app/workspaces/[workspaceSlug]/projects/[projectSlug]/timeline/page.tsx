import { notFound } from "next/navigation";

import { ProjectAuditTimeline } from "@/components/builder/project-audit-timeline";
import { getProjectAuditTimeline } from "@/lib/builder/audit-repository";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";

export default async function ProjectTimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; workspaceSlug: string; projectSlug: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { locale, workspaceSlug, projectSlug } = await params;
  const { source } = await searchParams;
  const dictionary = getDictionary(locale);
  const bundle = await getProjectAuditTimeline(workspaceSlug, projectSlug, source ?? null);

  if (!bundle) {
    notFound();
  }

  return (
    <ProjectAuditTimeline
      locale={locale as Locale}
      dictionary={dictionary}
      bundle={bundle}
    />
  );
}
