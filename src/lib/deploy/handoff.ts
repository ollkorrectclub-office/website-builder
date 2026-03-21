import type {
  DeployArtifactRecord,
  DeployReleaseExportSnapshotRecord,
  DeployReleaseHandoffPayloadRecord,
  DeployReleaseRecord,
  DeployRunRecord,
  DeployTargetRecord,
} from "@/lib/deploy/types";

function countThemeTokens(artifacts: DeployArtifactRecord[]) {
  const themeArtifact = artifacts.find((artifact) => artifact.artifactType === "deploy_theme_bundle");
  const variables = Array.isArray(themeArtifact?.payload?.cssVariables)
    ? themeArtifact.payload.cssVariables
    : [];
  return variables.length;
}

function countRoutes(artifacts: DeployArtifactRecord[]) {
  const routeArtifact = artifacts.find((artifact) => artifact.artifactType === "deploy_route_bundle");
  const routes = Array.isArray(routeArtifact?.payload?.routes) ? routeArtifact.payload.routes : [];
  return routes.length;
}

function countFiles(artifacts: DeployArtifactRecord[]) {
  const packageArtifact = artifacts.find((artifact) => artifact.artifactType === "deploy_output_package");
  const files = Array.isArray(packageArtifact?.payload?.files) ? packageArtifact.payload.files : [];
  return files.length;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function buildDeployReleaseHandoffPayload(input: {
  target: DeployTargetRecord;
  release: DeployReleaseRecord;
  run: DeployRunRecord;
  artifacts: DeployArtifactRecord[];
  preparedAt: string;
}): DeployReleaseHandoffPayloadRecord {
  return {
    adapterPresetKey: input.target.settings.adapterPresetKey,
    adapterKey: input.target.settings.adapterKey,
    environmentKey: input.target.settings.environmentKey,
    primaryDomain: input.target.settings.primaryDomain,
    outputDirectory: input.target.settings.outputDirectory,
    nodeVersion: input.target.settings.nodeVersion,
    commands: {
      install: input.target.settings.installCommand,
      build: input.target.settings.buildCommand,
      start: input.target.settings.startCommand,
    },
    envContract: input.target.settings.envContract,
    adapterConfig: input.target.settings.adapterConfig,
    release: {
      id: input.release.id,
      name: input.release.name,
      releaseNumber: input.release.releaseNumber,
      status: input.release.status,
    },
    deployRun: {
      id: input.run.id,
      status: input.run.status,
      summary: input.run.summary,
      sourcePlanRevisionNumber: input.run.sourcePlanRevisionNumber,
      sourceVisualRevisionNumber: input.run.sourceVisualRevisionNumber,
      sourceCodeRevisionNumber: input.run.sourceCodeRevisionNumber,
      sourceGenerationRunId: input.run.sourceGenerationRunId,
      runtimeSource: input.run.runtimeSource,
    },
    artifactSummary: {
      artifactCount: input.artifacts.length,
      routeCount: countRoutes(input.artifacts),
      fileCount: countFiles(input.artifacts),
      themeTokenCount: countThemeTokens(input.artifacts),
      artifactTypes: input.artifacts.map((artifact) => artifact.artifactType),
    },
    artifactReferences: input.artifacts.map((artifact) => ({
      artifactType: artifact.artifactType,
      label: artifact.label,
    })),
    preparedAt: input.preparedAt,
  };
}

export function buildDeployReleaseExportSnapshot(input: {
  target: DeployTargetRecord;
  release: DeployReleaseRecord;
  run: DeployRunRecord;
  artifacts: DeployArtifactRecord[];
  handoffPayload: DeployReleaseHandoffPayloadRecord;
  generatedAt: string;
}): DeployReleaseExportSnapshotRecord {
  return {
    schemaVersion: "release-export-v1",
    generatedAt: input.generatedAt,
    deployTarget: {
      id: input.target.id,
      name: input.target.name,
      targetType: input.target.targetType,
      settings: input.target.settings,
    },
    release: {
      id: input.release.id,
      name: input.release.name,
      notes: input.release.notes,
      releaseNumber: input.release.releaseNumber,
      status: input.release.status,
      sourcePlanRevisionNumber: input.release.sourcePlanRevisionNumber,
      sourceVisualRevisionNumber: input.release.sourceVisualRevisionNumber,
      sourceCodeRevisionNumber: input.release.sourceCodeRevisionNumber,
      sourceGenerationRunId: input.release.sourceGenerationRunId,
      runtimeSource: input.release.runtimeSource,
    },
    deployRun: {
      id: input.run.id,
      summary: input.run.summary,
      status: input.run.status,
      startedAt: input.run.startedAt,
      completedAt: input.run.completedAt,
      outputSummary: input.run.outputSummary,
    },
    handoff: input.handoffPayload,
    artifacts: input.artifacts.map((artifact) => ({
      artifactType: artifact.artifactType,
      label: artifact.label,
      payload: artifact.payload,
    })),
  };
}

export function deployReleaseExportFileName(input: {
  projectName: string;
  releaseNumber: number;
  releaseName: string;
}) {
  const projectSlug = slugify(input.projectName) || "project";
  const releaseSlug = slugify(input.releaseName) || `release-${input.releaseNumber}`;
  return `${projectSlug}-${releaseSlug}-handoff.json`;
}
