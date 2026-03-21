"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertProjectPermission } from "@/lib/auth/access";
import { buildRuntimePreviewBundle } from "@/lib/builder/runtime-preview";
import { projectBaseRoute, projectDeployRoute, projectTimelineRoute } from "@/lib/builder/routes";
import { getProjectCodeBundle } from "@/lib/builder/code-repository";
import { getProjectVisualBundle } from "@/lib/builder/repository";
import {
  deployValidationMessage,
  parseDeployAdapterConfig,
  parseDeployEnvContract,
  validateDeployTargetSettings,
} from "@/lib/deploy/settings";
import { getDeployService } from "@/lib/deploy/service";
import {
  applyProjectDeployTargetPreset,
  executeProjectDeployRelease,
  executeProjectDeployReleaseHandoffSimulation,
  prepareProjectDeployReleaseHandoff,
  getProjectDeployBundle,
  promoteProjectDeployRelease,
  recordProjectDeployRun,
  recheckProjectDeployExecutionRun,
  retryProjectDeployExecutionRun,
  updateProjectDeployTargetSettings,
} from "@/lib/deploy/repository";
import { getProjectGenerationBundle } from "@/lib/generation/repository";
import type { FormState } from "@/lib/workspaces/form-state";

function permissionError(message: string): FormState {
  return {
    status: "error",
    message,
  };
}

function revalidateDeployRoutes(locale: string, workspaceSlug: string, projectSlug: string) {
  revalidatePath(projectBaseRoute(locale, workspaceSlug, projectSlug), "layout");
  revalidatePath(projectDeployRoute(locale, workspaceSlug, projectSlug));
  revalidatePath(projectTimelineRoute(locale, workspaceSlug, projectSlug));
}

function formatValidationError(locale: string, messagePrefix: string, settings: Parameters<typeof validateDeployTargetSettings>[0]) {
  const validation = validateDeployTargetSettings(settings);

  if (validation.isValid) {
    return null;
  }

  return {
    status: "error" as const,
    message: `${messagePrefix} ${validation.issues
      .map((issue) => deployValidationMessage(locale === "en" ? "en" : "sq", issue))
      .join(" ")}`,
  };
}

export async function createDeploySnapshotAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  _prevState: FormState,
  _formData: FormData,
): Promise<FormState> {
  const [deployBundle, visualBundle, codeBundle, generationBundle] = await Promise.all([
    getProjectDeployBundle(workspaceSlug, projectSlug),
    getProjectVisualBundle(workspaceSlug, projectSlug),
    getProjectCodeBundle(workspaceSlug, projectSlug),
    getProjectGenerationBundle(workspaceSlug, projectSlug),
  ]);

  if (!deployBundle || !visualBundle || !codeBundle) {
    return {
      status: "error",
      message: "Deploy context could not be loaded from the current accepted builder state.",
    };
  }

  try {
    assertProjectPermission(
      deployBundle.projectPermissions,
      "canPublishDeploy",
      "You do not have permission to publish or create deploy snapshots for this project.",
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : "Access denied.");
  }

  const approvedRevision =
    deployBundle.revisions.find((revision) => revision.state === "approved") ?? null;

  if (!approvedRevision) {
    return {
      status: "error",
      message: "Approve a plan revision before creating a deploy snapshot.",
    };
  }

  const runtimeBundle = buildRuntimePreviewBundle({
    locale: locale === "en" ? "en" : "sq",
    visualBundle,
    codeBundle,
    generationBundle,
  });

  if (!deployBundle.acceptedState.readyToPublish) {
    return {
      status: "error",
      message: "Accepted Visual and Code state must exist before a deploy snapshot can be created.",
    };
  }

  try {
    const result = await getDeployService().createDeploySnapshot({
      context: {
        workspace: deployBundle.workspace,
        project: deployBundle.project,
        latestRevision: deployBundle.latestRevision,
        currentUser: deployBundle.currentUser,
        membership: deployBundle.membership,
        workspacePermissions: deployBundle.workspacePermissions,
        projectPermissions: deployBundle.projectPermissions,
      },
      revisions: deployBundle.revisions,
      approvedRevision,
      visualBundle,
      codeBundle,
      generationBundle,
      runtimeBundle,
    });
    const persisted = await recordProjectDeployRun({
      deployTargetId: deployBundle.target.id,
      workspaceId: deployBundle.workspace.id,
      projectId: deployBundle.project.id,
      sourcePlanRevisionId: result.sourcePlanRevisionId,
      sourcePlanRevisionNumber: result.sourcePlanRevisionNumber,
      sourcePlanSnapshot: result.sourcePlanSnapshot,
      sourceVisualRevisionNumber: result.sourceVisualRevisionNumber,
      sourceCodeRevisionNumber: result.sourceCodeRevisionNumber,
      sourceGenerationRunId: result.sourceGenerationRunId,
      runtimeSource: result.runtimeSource,
      source: result.source,
      trigger: result.trigger,
      status: result.status,
      summary: result.summary,
      outputSummary: result.outputSummary,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      artifacts: result.artifacts,
    });

    revalidateDeployRoutes(locale, workspaceSlug, projectSlug);
    redirect(
      `${projectDeployRoute(locale, workspaceSlug, projectSlug)}?deployRun=${encodeURIComponent(persisted.run.id)}#deploy-run-${persisted.run.id}`,
    );
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Deploy snapshot generation failed.",
    };
  }
}

export async function saveDeployTargetSettingsAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const deployBundle = await getProjectDeployBundle(workspaceSlug, projectSlug);

  if (!deployBundle) {
    return {
      status: "error",
      message: "Deploy target context could not be loaded.",
    };
  }

  try {
    assertProjectPermission(
      deployBundle.projectPermissions,
      "canPublishDeploy",
      "You do not have permission to update deploy target settings for this project.",
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : "Access denied.");
  }

  try {
    const nextSettings = {
      adapterPresetKey: deployBundle.target.settings.adapterPresetKey,
      adapterKey: deployBundle.target.settings.adapterKey,
      environmentKey: String(formData.get("environmentKey") ?? "production").trim() || "production",
      primaryDomain: String(formData.get("primaryDomain") ?? "").trim(),
      outputDirectory:
        String(formData.get("outputDirectory") ?? ".output/deploy").trim() || ".output/deploy",
      installCommand:
        String(formData.get("installCommand") ?? "npm install").trim() || "npm install",
      buildCommand: String(formData.get("buildCommand") ?? "npm run build").trim() || "npm run build",
      startCommand: String(formData.get("startCommand") ?? "npm run start").trim() || "npm run start",
      nodeVersion: String(formData.get("nodeVersion") ?? "22.x").trim() || "22.x",
      envContract: parseDeployEnvContract(String(formData.get("envContract") ?? "")),
      adapterConfig: parseDeployAdapterConfig(String(formData.get("adapterConfig") ?? "")),
    };
    const validationError = formatValidationError(
      locale,
      locale === "sq"
        ? "Deploy target settings nuk mund të ruhen."
        : "Deploy target settings could not be saved.",
      nextSettings,
    );

    if (validationError) {
      return validationError;
    }

    await updateProjectDeployTargetSettings({
      targetId: deployBundle.target.id,
      settings: nextSettings,
    });
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Deploy target settings could not be saved.",
    };
  }

  revalidateDeployRoutes(locale, workspaceSlug, projectSlug);
  redirect(`${projectDeployRoute(locale, workspaceSlug, projectSlug)}#target-settings`);
}

export async function applyDeployTargetPresetAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const deployBundle = await getProjectDeployBundle(workspaceSlug, projectSlug);

  if (!deployBundle) {
    return {
      status: "error",
      message: "Deploy target context could not be loaded.",
    };
  }

  try {
    assertProjectPermission(
      deployBundle.projectPermissions,
      "canPublishDeploy",
      "You do not have permission to update deploy target settings for this project.",
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : "Access denied.");
  }

  const presetKey = String(formData.get("presetKey") ?? "").trim();
  const normalizedPresetKey =
    presetKey === "vercel_nextjs" || presetKey === "netlify_static" || presetKey === "container_node"
      ? presetKey
      : null;

  if (!normalizedPresetKey) {
    return {
      status: "error",
      message:
        locale === "sq"
          ? "Zgjidh një preset valid për hosting adapter."
          : "Select a valid hosting adapter preset.",
    };
  }

  try {
    await applyProjectDeployTargetPreset({
      targetId: deployBundle.target.id,
      presetKey: normalizedPresetKey,
    });
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Deploy target preset could not be applied.",
    };
  }

  revalidateDeployRoutes(locale, workspaceSlug, projectSlug);
  redirect(`${projectDeployRoute(locale, workspaceSlug, projectSlug)}#target-settings`);
}

export async function prepareDeployReleaseHandoffAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const deployBundle = await getProjectDeployBundle(workspaceSlug, projectSlug);

  if (!deployBundle) {
    return {
      status: "error",
      message: "Deploy release context could not be loaded.",
    };
  }

  try {
    assertProjectPermission(
      deployBundle.projectPermissions,
      "canPublishDeploy",
      "You do not have permission to prepare hosting handoff payloads for this project.",
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : "Access denied.");
  }

  const releaseId = String(formData.get("releaseId") ?? "").trim();

  if (!releaseId) {
    return {
      status: "error",
      message: locale === "sq" ? "Zgjidh një release për handoff." : "Select a release for handoff.",
    };
  }

  const validationError = formatValidationError(
    locale,
    locale === "sq"
      ? "Hosting handoff nuk mund të përgatitet."
      : "Hosting handoff could not be prepared.",
    deployBundle.target.settings,
  );

  if (validationError) {
    return validationError;
  }

  try {
    const release = await prepareProjectDeployReleaseHandoff({ releaseId });
    revalidateDeployRoutes(locale, workspaceSlug, projectSlug);
    redirect(
      `${projectDeployRoute(locale, workspaceSlug, projectSlug)}?deployRun=${encodeURIComponent(release.deployRunId)}&release=${encodeURIComponent(release.id)}#release-${release.id}`,
    );
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Hosting handoff could not be prepared.",
    };
  }
}

export async function promoteDeployReleaseAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const deployBundle = await getProjectDeployBundle(workspaceSlug, projectSlug);

  if (!deployBundle) {
    return {
      status: "error",
      message: "Deploy release context could not be loaded.",
    };
  }

  try {
    assertProjectPermission(
      deployBundle.projectPermissions,
      "canPublishDeploy",
      "You do not have permission to promote deploy releases for this project.",
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : "Access denied.");
  }

  const deployRunId = String(formData.get("deployRunId") ?? "").trim();
  const releaseName = String(formData.get("releaseName") ?? "").trim();
  const releaseNotes = String(formData.get("releaseNotes") ?? "").trim();

  if (!deployRunId || !releaseName) {
    return {
      status: "error",
      message: "Select a completed deploy run and provide a release name before promotion.",
    };
  }

  try {
    const release = await promoteProjectDeployRelease({
      deployTargetId: deployBundle.target.id,
      deployRunId,
      workspaceId: deployBundle.workspace.id,
      projectId: deployBundle.project.id,
      name: releaseName,
      notes: releaseNotes,
      promotedByUserId: deployBundle.currentUser.id,
    });

    revalidateDeployRoutes(locale, workspaceSlug, projectSlug);
    redirect(
      `${projectDeployRoute(locale, workspaceSlug, projectSlug)}?deployRun=${encodeURIComponent(deployRunId)}&release=${encodeURIComponent(release.id)}#release-${release.id}`,
    );
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Deploy release promotion failed.",
    };
  }
}

export async function executeDeployReleaseHandoffSimulationAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const deployBundle = await getProjectDeployBundle(workspaceSlug, projectSlug);

  if (!deployBundle) {
    return {
      status: "error",
      message: "Deploy release context could not be loaded.",
    };
  }

  try {
    assertProjectPermission(
      deployBundle.projectPermissions,
      "canPublishDeploy",
      "You do not have permission to run hosting handoff simulations for this project.",
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : "Access denied.");
  }

  const releaseId = String(formData.get("releaseId") ?? "").trim();

  if (!releaseId) {
    return {
      status: "error",
      message:
        locale === "sq"
          ? "Zgjidh një release për simulation."
          : "Select a release for simulation.",
    };
  }

  try {
    const handoffRun = await executeProjectDeployReleaseHandoffSimulation({ releaseId });
    revalidateDeployRoutes(locale, workspaceSlug, projectSlug);
    redirect(
      `${projectDeployRoute(locale, workspaceSlug, projectSlug)}?deployRun=${encodeURIComponent(handoffRun.deployRunId)}&release=${encodeURIComponent(handoffRun.releaseId)}&handoffRun=${encodeURIComponent(handoffRun.id)}#handoff-run-${handoffRun.id}`,
    );
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Hosting adapter simulation could not be completed.",
    };
  }
}

export async function executeDeployReleaseAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const deployBundle = await getProjectDeployBundle(workspaceSlug, projectSlug);

  if (!deployBundle) {
    return {
      status: "error",
      message: "Deploy release context could not be loaded.",
    };
  }

  try {
    assertProjectPermission(
      deployBundle.projectPermissions,
      "canPublishDeploy",
      "You do not have permission to execute real hosting deployments for this project.",
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : "Access denied.");
  }

  const releaseId = String(formData.get("releaseId") ?? "").trim();

  if (!releaseId) {
    return {
      status: "error",
      message:
        locale === "sq"
          ? "Zgjidh një release për ekzekutim real."
          : "Select a release for real hosting execution.",
    };
  }

  try {
    const executionRun = await executeProjectDeployRelease({ releaseId });
    revalidateDeployRoutes(locale, workspaceSlug, projectSlug);
    redirect(
      `${projectDeployRoute(locale, workspaceSlug, projectSlug)}?deployRun=${encodeURIComponent(executionRun.deployRunId)}&release=${encodeURIComponent(executionRun.releaseId)}&executionRun=${encodeURIComponent(executionRun.id)}#execution-run-${executionRun.id}`,
    );
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Real hosting execution could not be completed.",
    };
  }
}

export async function recheckDeployExecutionRunAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const deployBundle = await getProjectDeployBundle(workspaceSlug, projectSlug);

  if (!deployBundle) {
    return {
      status: "error",
      message: "Deploy release context could not be loaded.",
    };
  }

  try {
    assertProjectPermission(
      deployBundle.projectPermissions,
      "canPublishDeploy",
      "You do not have permission to recheck hosting executions for this project.",
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : "Access denied.");
  }

  const executionRunId = String(formData.get("executionRunId") ?? "").trim();

  if (!executionRunId) {
    return {
      status: "error",
      message:
        locale === "sq"
          ? "Zgjidh një execution run për recheck."
          : "Select an execution run to recheck.",
    };
  }

  try {
    const executionRun = await recheckProjectDeployExecutionRun({ executionRunId });
    revalidateDeployRoutes(locale, workspaceSlug, projectSlug);
    redirect(
      `${projectDeployRoute(locale, workspaceSlug, projectSlug)}?deployRun=${encodeURIComponent(executionRun.deployRunId)}&release=${encodeURIComponent(executionRun.releaseId)}&executionRun=${encodeURIComponent(executionRun.id)}#execution-run-${executionRun.id}`,
    );
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Hosting execution recheck could not be completed.",
    };
  }
}

export async function retryDeployExecutionRunAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const deployBundle = await getProjectDeployBundle(workspaceSlug, projectSlug);

  if (!deployBundle) {
    return {
      status: "error",
      message: "Deploy release context could not be loaded.",
    };
  }

  try {
    assertProjectPermission(
      deployBundle.projectPermissions,
      "canPublishDeploy",
      "You do not have permission to retry hosting executions for this project.",
    );
  } catch (error) {
    return permissionError(error instanceof Error ? error.message : "Access denied.");
  }

  const executionRunId = String(formData.get("executionRunId") ?? "").trim();

  if (!executionRunId) {
    return {
      status: "error",
      message:
        locale === "sq"
          ? "Zgjidh një execution run për retry."
          : "Select an execution run to retry.",
    };
  }

  try {
    const executionRun = await retryProjectDeployExecutionRun({ executionRunId });
    revalidateDeployRoutes(locale, workspaceSlug, projectSlug);
    redirect(
      `${projectDeployRoute(locale, workspaceSlug, projectSlug)}?deployRun=${encodeURIComponent(executionRun.deployRunId)}&release=${encodeURIComponent(executionRun.releaseId)}&executionRun=${encodeURIComponent(executionRun.id)}#execution-run-${executionRun.id}`,
    );
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Hosting execution retry could not be completed.",
    };
  }
}
