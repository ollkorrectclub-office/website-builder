import { createCodeScaffold } from "@/lib/builder/code-scaffold";
import { createVisualScaffold } from "@/lib/builder/scaffold";
import type { ProjectVisualBundle } from "@/lib/builder/types";
import type { GenerationAdapter, GenerationInput, GenerationResult } from "@/lib/generation/types";

function countLines(content: string) {
  return content.split("\n").length;
}

function buildShadowProject(input: GenerationInput) {
  return {
    ...input.project,
    structuredPlan: input.approvedRevision.plan,
    currentPlanRevisionId: input.approvedRevision.id,
    currentPlanRevisionNumber: input.approvedRevision.revisionNumber,
    plannerSource: input.approvedRevision.plannerSource,
    planLastUpdatedAt: input.approvedRevision.createdAt,
  };
}

function buildGeneratedVisualBundle(
  input: GenerationInput,
  shadowProject: GenerationInput["project"],
  visualTarget: ReturnType<typeof createVisualScaffold>,
): ProjectVisualBundle {
  return {
    workspace: input.workspace,
    project: shadowProject,
    latestRevision: input.revisions[0],
    currentUser: input.currentUser,
    membership: input.membership,
    workspacePermissions: input.workspacePermissions,
    projectPermissions: input.projectPermissions,
    revisions: input.revisions,
    visualState: visualTarget.visualState,
    visualPages: visualTarget.visualPages,
    visualSections: visualTarget.visualSections,
    sourceRevision: input.approvedRevision,
    syncState: {
      sourceRevisionNumber: input.approvedRevision.revisionNumber,
      sourceRevisionState: input.approvedRevision.state,
      latestRevisionNumber: input.revisions[0]?.revisionNumber ?? input.approvedRevision.revisionNumber,
      approvedRevisionNumber: input.approvedRevision.revisionNumber,
      hasManualChanges: false,
      needsRegeneration: false,
    },
  };
}

export class DeterministicGenerationAdapter implements GenerationAdapter {
  readonly source = "deterministic_generator_v1" as const;

  async generate(input: GenerationInput, trigger: GenerationResult["trigger"]): Promise<GenerationResult> {
    const shadowProject = buildShadowProject(input);
    const visualTarget = createVisualScaffold({
      project: shadowProject,
      revisions: input.revisions,
      preferredRevisionNumber: input.approvedRevision.revisionNumber,
    });
    const visualBundle = buildGeneratedVisualBundle(input, shadowProject, visualTarget);
    const codeTarget = createCodeScaffold({
      visualBundle,
    });

    const routeTargets = visualTarget.visualPages
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((page) => {
        const routeFile =
          codeTarget.files.find(
            (file) => file.kind === "route" && file.createdFromVisualPageId === page.id,
          ) ?? null;
        const sectionCount = visualTarget.visualSections.filter((section) => section.pageId === page.id).length;

        return {
          pageKey: page.pageKey,
          title: page.title,
          slug: page.slug,
          routePath: routeFile?.path ?? `app/[locale]/${page.slug === "home" ? "page" : `${page.slug}/page`}.tsx`,
          sectionCount,
        };
      });

    const outputSummary = {
      visualPageCount: visualTarget.visualPages.length,
      visualSectionCount: visualTarget.visualSections.length,
      routeCount: routeTargets.length,
      codeFileCount: codeTarget.files.length,
      componentFileCount: codeTarget.files.filter((file) => file.kind === "component").length,
      themeTokenCount: Object.keys(visualTarget.visualState.themeTokens).length,
    };

    const artifacts = [
      {
        artifactType: "route_page_target" as const,
        label: "Route and page target",
        payload: {
          sourcePlanRevisionNumber: input.approvedRevision.revisionNumber,
          routes: routeTargets,
        },
      },
      {
        artifactType: "theme_token_target" as const,
        label: "Theme token target",
        payload: {
          sourcePlanRevisionNumber: input.approvedRevision.revisionNumber,
          tokens: visualTarget.visualState.themeTokens,
        },
      },
      {
        artifactType: "visual_scaffold_target" as const,
        label: "Visual scaffold target",
        payload: {
          sourcePlanRevisionNumber: input.approvedRevision.revisionNumber,
          activePageId: visualTarget.visualState.activePageId,
          pages: visualTarget.visualPages.map((page) => ({
            id: page.id,
            pageKey: page.pageKey,
            title: page.title,
            slug: page.slug,
            orderIndex: page.orderIndex,
            contentPayload: page.contentPayload,
            sections: visualTarget.visualSections
              .filter((section) => section.pageId === page.id)
              .sort((left, right) => left.orderIndex - right.orderIndex)
              .map((section) => ({
                id: section.id,
                pageId: section.pageId,
                sectionKey: section.sectionKey,
                sectionType: section.sectionType,
                title: section.title,
                label: section.label,
                orderIndex: section.orderIndex,
                isVisible: section.isVisible,
                contentPayload: section.contentPayload,
                createdFromPlan: section.createdFromPlan,
              })),
          })),
        },
      },
      {
        artifactType: "code_scaffold_target" as const,
        label: "Code scaffold target",
        payload: {
          sourcePlanRevisionNumber: input.approvedRevision.revisionNumber,
          state: {
            activeFilePath: codeTarget.codeState.activeFilePath,
            openFilePaths: codeTarget.codeState.openFilePaths,
            scaffoldSourceRevisionNumber: codeTarget.codeState.scaffoldSourceRevisionNumber,
          },
          files: codeTarget.files.map((file) => ({
            id: file.id,
            path: file.path,
            directory: file.directory,
            name: file.name,
            extension: file.extension,
            kind: file.kind,
            language: file.language,
            orderIndex: file.orderIndex,
            ownership: file.ownership,
            editPolicy: file.editPolicy,
            createdFromVisualPageId: file.createdFromVisualPageId,
            createdFromSectionId: file.createdFromSectionId,
            lineCount: countLines(file.content),
            content: file.content,
          })),
          fileLinks: codeTarget.fileLinks.map((link) => {
            const file = codeTarget.files.find((entry) => entry.id === link.fileId);

            return {
              filePath: file?.path ?? "",
              targetType: link.targetType,
              role: link.role,
              visualPageId: link.visualPageId,
              visualSectionId: link.visualSectionId,
              targetLabel: link.targetLabel,
            };
          }),
        },
      },
    ];

    return {
      source: this.source,
      trigger,
      status: "completed",
      summary: `Generated ${outputSummary.visualPageCount} page targets, ${outputSummary.visualSectionCount} visual sections, and ${outputSummary.codeFileCount} scaffold files from approved revision ${input.approvedRevision.revisionNumber}.`,
      sourcePlanRevisionId: input.approvedRevision.id,
      sourcePlanRevisionNumber: input.approvedRevision.revisionNumber,
      sourcePlanSnapshot: input.approvedRevision.plan,
      outputSummary,
      routeTargets,
      themeTarget: visualTarget.visualState.themeTokens,
      visualTarget,
      codeTarget,
      artifacts,
    };
  }
}
