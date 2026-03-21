import { redirect } from "next/navigation";

import { projectTabRoute } from "@/lib/builder/routes";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ locale: string; workspaceSlug: string; projectSlug: string }>;
}) {
  const { locale, workspaceSlug, projectSlug } = await params;
  redirect(projectTabRoute(locale, workspaceSlug, projectSlug, "plan"));
}
