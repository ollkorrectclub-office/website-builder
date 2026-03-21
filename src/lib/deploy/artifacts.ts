import type {
  DeployArtifactRecord,
  DeployOutputFileRecord,
  DeployRouteSnapshotRecord,
  DeployThemeVariableRecord,
} from "@/lib/deploy/types";

export interface DeploySnapshotManifestRecord {
  projectId: string;
  projectName: string;
  workspaceId: string;
  workspaceName: string;
  approvedPlanRevisionId: string;
  approvedPlanRevisionNumber: number;
  visualRevisionNumber: number;
  codeRevisionNumber: number;
  runtimeSource: string;
  generationRunId: string | null;
  outputSummary: Record<string, unknown> | null;
  createdFromAcceptedState: boolean;
}

export function deployArtifactByType(
  artifacts: DeployArtifactRecord[],
  type: DeployArtifactRecord["artifactType"],
) {
  return artifacts.find((artifact) => artifact.artifactType === type) ?? null;
}

export function readDeploySnapshotManifest(payload: Record<string, unknown>): DeploySnapshotManifestRecord | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return {
    projectId: typeof payload.projectId === "string" ? payload.projectId : "",
    projectName: typeof payload.projectName === "string" ? payload.projectName : "",
    workspaceId: typeof payload.workspaceId === "string" ? payload.workspaceId : "",
    workspaceName: typeof payload.workspaceName === "string" ? payload.workspaceName : "",
    approvedPlanRevisionId:
      typeof payload.approvedPlanRevisionId === "string" ? payload.approvedPlanRevisionId : "",
    approvedPlanRevisionNumber:
      typeof payload.approvedPlanRevisionNumber === "number" ? payload.approvedPlanRevisionNumber : 0,
    visualRevisionNumber: typeof payload.visualRevisionNumber === "number" ? payload.visualRevisionNumber : 0,
    codeRevisionNumber: typeof payload.codeRevisionNumber === "number" ? payload.codeRevisionNumber : 0,
    runtimeSource: typeof payload.runtimeSource === "string" ? payload.runtimeSource : "",
    generationRunId: typeof payload.generationRunId === "string" ? payload.generationRunId : null,
    outputSummary:
      typeof payload.outputSummary === "object" && payload.outputSummary
        ? (payload.outputSummary as Record<string, unknown>)
        : null,
    createdFromAcceptedState: payload.createdFromAcceptedState === true,
  };
}

export function readDeployRoutes(payload: Record<string, unknown>) {
  return Array.isArray(payload.routes)
    ? payload.routes.filter(
        (item): item is DeployRouteSnapshotRecord => typeof item === "object" && item !== null,
      )
    : [];
}

export function readDeployThemeVariables(payload: Record<string, unknown>) {
  return Array.isArray(payload.cssVariables)
    ? payload.cssVariables.filter(
        (item): item is DeployThemeVariableRecord => typeof item === "object" && item !== null,
      )
    : [];
}

export function readDeployThemeCss(payload: Record<string, unknown>) {
  return typeof payload.cssText === "string" ? payload.cssText : "";
}

export function readDeployOutputFiles(payload: Record<string, unknown>) {
  return Array.isArray(payload.files)
    ? payload.files.filter(
        (item): item is DeployOutputFileRecord => typeof item === "object" && item !== null,
      )
    : [];
}

export function fileKindSummary(files: DeployOutputFileRecord[]) {
  const groups = new Map<string, number>();

  for (const file of files) {
    groups.set(file.kind, (groups.get(file.kind) ?? 0) + 1);
  }

  return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right));
}
