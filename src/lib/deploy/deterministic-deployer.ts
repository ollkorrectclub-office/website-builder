import { Buffer } from "node:buffer";

import type { ProjectCodeFileRecord } from "@/lib/builder/types";
import type { DeployAdapter, DeployInput, DeployOutputFileRecord, DeployResult, DeployThemeVariableRecord } from "@/lib/deploy/types";

function tokenVariableName(tokenKey: string) {
  return `--${tokenKey.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`;
}

function buildThemeVariables(tokens: DeployInput["visualBundle"]["visualState"]["themeTokens"]) {
  return Object.entries(tokens).map<DeployThemeVariableRecord>(([tokenKey, value]) => ({
    tokenKey,
    cssVariable: tokenVariableName(tokenKey),
    value,
  }));
}

function buildThemeCss(tokens: DeployInput["visualBundle"]["visualState"]["themeTokens"]) {
  const declarations = buildThemeVariables(tokens)
    .map((entry) => `  ${entry.cssVariable}: ${entry.value};`)
    .join("\n");

  return `:root {\n${declarations}\n}\n`;
}

function countBytes(content: string) {
  return Buffer.byteLength(content, "utf-8");
}

function mapOutputFile(file: ProjectCodeFileRecord): DeployOutputFileRecord {
  return {
    path: file.path,
    kind: file.kind,
    language: file.language,
    ownership: file.ownership,
    revisionNumber: file.currentRevisionNumber,
    bytes: countBytes(file.content),
    content: file.content,
  };
}

export class DeterministicDeployAdapter implements DeployAdapter {
  readonly source = "deterministic_deployer_v1" as const;

  async deploy(input: DeployInput, trigger: "publish_requested"): Promise<DeployResult> {
    const approvedRevision = input.approvedRevision;
    const visualRevisionNumber = input.visualBundle.visualState.scaffoldSourceRevisionNumber;
    const codeRevisionNumber = input.codeBundle.codeState.scaffoldSourceRevisionNumber;
    const surfacesBehindApproved: Array<"visual" | "code"> = [];

    if (visualRevisionNumber < approvedRevision.revisionNumber) {
      surfacesBehindApproved.push("visual");
    }

    if (codeRevisionNumber < approvedRevision.revisionNumber) {
      surfacesBehindApproved.push("code");
    }

    const runtimeRoutes = input.runtimeBundle.routes.map((route) => {
      const sections = input.visualBundle.visualSections
        .filter((section) => section.pageId === route.pageId)
        .sort((left, right) => left.orderIndex - right.orderIndex);

      return {
        pageId: route.pageId,
        pageKey: route.pageKey,
        title: route.title,
        slug: route.slug,
        browserPath: route.browserPath,
        routeFilePath: route.sourceFilePath,
        layoutFilePath: input.runtimeBundle.layoutFile.path,
        contentFilePath: input.runtimeBundle.contentFile.path,
        sectionCount: sections.length,
        visibleSectionCount: sections.filter((section) => section.isVisible).length,
        hiddenSectionCount: sections.filter((section) => !section.isVisible).length,
        sections: sections.map((section) => ({
          id: section.id,
          sectionKey: section.sectionKey,
          title: section.title,
          label: section.label,
          sectionType: section.sectionType,
          isVisible: section.isVisible,
        })),
      };
    });

    const outputFiles = input.codeBundle.files.map(mapOutputFile);
    const themeVariables = buildThemeVariables(input.runtimeBundle.themeTokens);
    const themeCss = buildThemeCss(input.runtimeBundle.themeTokens);
    const outputSummary = {
      routeCount: runtimeRoutes.length,
      pageCount: input.visualBundle.visualPages.length,
      sectionCount: input.visualBundle.visualSections.length,
      fileCount: outputFiles.length,
      themeTokenCount: themeVariables.length,
      surfacesBehindApproved,
    };

    return {
      source: this.source,
      trigger,
      status: "completed",
      summary: `Deploy snapshot captured accepted state from plan revision ${approvedRevision.revisionNumber}.`,
      sourcePlanRevisionId: approvedRevision.id,
      sourcePlanRevisionNumber: approvedRevision.revisionNumber,
      sourcePlanSnapshot: approvedRevision.plan,
      sourceVisualRevisionNumber: visualRevisionNumber,
      sourceCodeRevisionNumber: codeRevisionNumber,
      sourceGenerationRunId: input.runtimeBundle.generationRun?.id ?? null,
      runtimeSource: input.runtimeBundle.source,
      outputSummary,
      artifacts: [
        {
          artifactType: "deploy_snapshot_manifest",
          label: "Accepted deploy snapshot manifest",
          payload: {
            projectId: input.context.project.id,
            projectName: input.context.project.name,
            workspaceId: input.context.workspace.id,
            workspaceName: input.context.workspace.name,
            approvedPlanRevisionId: approvedRevision.id,
            approvedPlanRevisionNumber: approvedRevision.revisionNumber,
            visualRevisionNumber,
            codeRevisionNumber,
            runtimeSource: input.runtimeBundle.source,
            generationRunId: input.runtimeBundle.generationRun?.id ?? null,
            outputSummary,
            createdFromAcceptedState: true,
          },
        },
        {
          artifactType: "deploy_route_bundle",
          label: "Accepted runtime route bundle",
          payload: {
            routes: runtimeRoutes,
          },
        },
        {
          artifactType: "deploy_theme_bundle",
          label: "Accepted theme token bundle",
          payload: {
            tokens: input.runtimeBundle.themeTokens,
            cssVariables: themeVariables,
            cssText: themeCss,
            source: input.runtimeBundle.themeSource,
          },
        },
        {
          artifactType: "deploy_output_package",
          label: "Deployable output package snapshot",
          payload: {
            entryFiles: {
              layout: input.runtimeBundle.layoutFile.path,
              content: input.runtimeBundle.contentFile.path,
              themeTokens: input.runtimeBundle.themeTokensFile.path,
              themeStyles: input.runtimeBundle.themeStylesFile.path,
            },
            files: outputFiles,
          },
        },
      ],
    };
  }
}
