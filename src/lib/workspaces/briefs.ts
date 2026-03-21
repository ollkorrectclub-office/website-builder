import type { ProjectBriefFields, ProjectBriefRecord, ProjectRecord } from "@/lib/workspaces/types";

export function projectBriefFieldsFromProject(project: ProjectRecord): ProjectBriefFields {
  return {
    name: project.name,
    prompt: project.prompt,
    projectType: project.projectType,
    targetUsers: project.targetUsers,
    desiredPagesFeatures: project.desiredPagesFeatures,
    designStyle: project.designStyle,
    primaryLocale: project.primaryLocale,
    supportedLocales: project.supportedLocales,
    country: project.country,
    businessCategory: project.businessCategory,
    capabilities: project.capabilities,
  };
}

export function synthesizeProjectBrief(
  project: ProjectRecord,
  overrides: Partial<ProjectBriefRecord> = {},
): ProjectBriefRecord {
  const fields = projectBriefFieldsFromProject(project);

  return {
    id: overrides.id ?? `brief-${project.id}`,
    projectId: project.id,
    workspaceId: project.workspaceId,
    ...fields,
    createdAt: overrides.createdAt ?? project.createdAt,
    updatedAt: overrides.updatedAt ?? project.updatedAt,
  };
}
