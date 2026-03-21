import type { BuilderTabKey } from "@/lib/builder/types";

export function projectBaseRoute(locale: string, workspaceSlug: string, projectSlug: string) {
  return `/${locale}/app/workspaces/${workspaceSlug}/projects/${projectSlug}`;
}

export function projectTabRoute(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  tab: BuilderTabKey,
) {
  return `${projectBaseRoute(locale, workspaceSlug, projectSlug)}/${tab}`;
}

export function projectTimelineRoute(locale: string, workspaceSlug: string, projectSlug: string) {
  return `${projectBaseRoute(locale, workspaceSlug, projectSlug)}/timeline`;
}

export function projectDeployRoute(locale: string, workspaceSlug: string, projectSlug: string) {
  return `${projectBaseRoute(locale, workspaceSlug, projectSlug)}/deploy`;
}

export function projectDeployExportRoute(locale: string, workspaceSlug: string, projectSlug: string) {
  return `${projectDeployRoute(locale, workspaceSlug, projectSlug)}/export`;
}
