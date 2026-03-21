import { getOptionalEnv } from "@/lib/env";
import { validateDeployTargetSettings } from "@/lib/deploy/settings";
import type {
  DeployArtifactRecord,
  DeployHandoffLogRecord,
  DeployReleaseReadinessCheckRecord,
  DeployReleaseReadinessResult,
  DeployReleaseRecord,
  DeployRunRecord,
  DeployTargetRecord,
} from "@/lib/deploy/types";

function countChecks(
  checks: DeployReleaseReadinessCheckRecord[],
  severity: DeployReleaseReadinessCheckRecord["severity"],
) {
  return checks.filter((check) => check.severity === severity).length;
}

function pushCheck(
  checks: DeployReleaseReadinessCheckRecord[],
  scope: DeployReleaseReadinessCheckRecord["scope"],
  severity: DeployReleaseReadinessCheckRecord["severity"],
  title: string,
  detail: string,
) {
  checks.push({
    id: `${scope}-${severity}-${checks.length + 1}`,
    scope,
    severity,
    title,
    detail,
  });
}

function adapterConfigValue(target: DeployTargetRecord, key: string) {
  return target.settings.adapterConfig.find((entry) => entry.key === key)?.value?.trim() ?? "";
}

export function evaluateDeployReleaseReadiness(input: {
  target: DeployTargetRecord;
  release: DeployReleaseRecord;
  run: DeployRunRecord | null;
  artifacts: DeployArtifactRecord[];
  checkedAt?: string;
}): DeployReleaseReadinessResult {
  const checks: DeployReleaseReadinessCheckRecord[] = [];
  const checkedAt = input.checkedAt ?? new Date().toISOString();
  const validation = validateDeployTargetSettings(input.target.settings);

  if (validation.isValid) {
    pushCheck(
      checks,
      "target",
      "pass",
      "Deploy target settings validated",
      `Domain, commands, env contract, and adapter config passed validation for ${input.target.settings.primaryDomain || "the current target"}.`,
    );
  } else {
    pushCheck(
      checks,
      "target",
      "blocking",
      "Deploy target settings are blocked",
      `${validation.issues.length} validation issue(s) must be fixed before handoff simulation can succeed.`,
    );
  }

  if (input.target.settings.adapterPresetKey === "custom") {
    pushCheck(
      checks,
      "target",
      "warning",
      "Deploy target is using a custom preset",
      "Simulation can continue, but a named hosting preset would give a clearer provider contract for future integrations.",
    );
  } else {
    pushCheck(
      checks,
      "target",
      "pass",
      "Hosting preset selected",
      `Preset ${input.target.settings.adapterPresetKey} is attached to this deploy target.`,
    );
  }

  if (!input.run) {
    pushCheck(
      checks,
      "handoff",
      "blocking",
      "Deploy run context is missing",
      "The selected release is not linked to a completed deploy run that can be handed off.",
    );
  } else if (input.run.status !== "completed") {
    pushCheck(
      checks,
      "handoff",
      "blocking",
      "Deploy run is not completed",
      "Only completed deploy runs can be handed off to a hosting adapter.",
    );
  } else {
    pushCheck(
      checks,
      "handoff",
      "pass",
      "Deploy run is completed",
      `Deploy run ${input.run.id} completed successfully and is eligible for release handoff.`,
    );
  }

  if (!input.release.handoffPayload) {
    pushCheck(
      checks,
      "handoff",
      "blocking",
      "Handoff payload has not been prepared",
      "Prepare the hosting handoff payload before running the adapter simulation.",
    );
  } else if (input.release.handoffPayload.release.id !== input.release.id) {
    pushCheck(
      checks,
      "handoff",
      "blocking",
      "Handoff payload is linked to a different release",
      "The persisted handoff payload does not match the selected release.",
    );
  } else if (input.run && input.release.handoffPayload.deployRun.id !== input.run.id) {
    pushCheck(
      checks,
      "handoff",
      "blocking",
      "Handoff payload is linked to a different deploy run",
      "Rebuild the handoff payload so it matches the current deploy run for this release.",
    );
  } else {
    pushCheck(
      checks,
      "handoff",
      "pass",
      "Handoff payload is ready",
      "The persisted hosting handoff payload matches the selected release and deploy run.",
    );
  }

  if (!input.release.exportSnapshot || !input.release.exportFileName) {
    pushCheck(
      checks,
      "export",
      "blocking",
      "Release export snapshot is missing",
      "Export the release snapshot before simulating adapter handoff execution.",
    );
  } else if (input.release.status !== "exported") {
    pushCheck(
      checks,
      "export",
      "blocking",
      "Release export has not been finalized",
      "The selected release must be exported before adapter handoff simulation can start.",
    );
  } else if (input.release.exportSnapshot.release.id !== input.release.id) {
    pushCheck(
      checks,
      "export",
      "blocking",
      "Export snapshot points at a different release",
      "Re-export the release snapshot so the export payload matches the selected release.",
    );
  } else if (input.release.exportSnapshot.deployTarget.id !== input.target.id) {
    pushCheck(
      checks,
      "export",
      "blocking",
      "Export snapshot points at a different deploy target",
      "The export snapshot no longer matches the current deploy target configuration.",
    );
  } else {
    pushCheck(
      checks,
      "export",
      "pass",
      "Release export snapshot is ready",
      `${input.release.exportFileName} is available and aligned with the selected deploy target.`,
    );
  }

  if (input.artifacts.length === 0) {
    pushCheck(
      checks,
      "export",
      "blocking",
      "No deploy artifacts were found",
      "The release export does not contain any artifacts to hand off.",
    );
  } else {
    pushCheck(
      checks,
      "export",
      "pass",
      "Deploy artifacts are attached",
      `${input.artifacts.length} persisted artifact(s) are available for the release handoff snapshot.`,
    );
  }

  return {
    isReady: !checks.some((check) => check.severity === "blocking"),
    blockingCount: countChecks(checks, "blocking"),
    warningCount: countChecks(checks, "warning"),
    checkedAt,
    checks,
  };
}

export function buildDeployHandoffSimulationLogs(input: {
  target: DeployTargetRecord;
  release: DeployReleaseRecord;
  run: DeployRunRecord | null;
  readiness: DeployReleaseReadinessResult;
  executedAt?: string;
}): {
  status: "blocked" | "completed";
  summary: string;
  logs: DeployHandoffLogRecord[];
} {
  const executedAt = input.executedAt ?? new Date().toISOString();
  const logs: DeployHandoffLogRecord[] = [];

  logs.push({
    id: crypto.randomUUID(),
    level: "info",
    message: `Loaded release ${input.release.name} for preset ${input.target.settings.adapterPresetKey}.`,
    metadata: {
      releaseId: input.release.id,
      deployRunId: input.release.deployRunId,
      adapterPresetKey: input.target.settings.adapterPresetKey,
      adapterKey: input.target.settings.adapterKey,
    },
    createdAt: executedAt,
  });

  for (const check of input.readiness.checks) {
    logs.push({
      id: crypto.randomUUID(),
      level:
        check.severity === "blocking"
          ? "error"
          : check.severity === "warning"
            ? "warning"
            : "info",
      message: `${check.title}: ${check.detail}`,
      metadata: {
        scope: check.scope,
        severity: check.severity,
      },
      createdAt: executedAt,
    });
  }

  if (!input.readiness.isReady) {
    return {
      status: "blocked",
      summary: `Hosting adapter simulation was blocked by ${input.readiness.blockingCount} readiness issue(s).`,
      logs,
    };
  }

  logs.push({
    id: crypto.randomUUID(),
    level: "info",
    message: `Prepared adapter envelope for domain ${input.target.settings.primaryDomain} in environment ${input.target.settings.environmentKey}.`,
    metadata: {
      primaryDomain: input.target.settings.primaryDomain,
      environmentKey: input.target.settings.environmentKey,
      exportFileName: input.release.exportFileName,
    },
    createdAt: executedAt,
  });

  logs.push({
    id: crypto.randomUUID(),
    level: "info",
    message: `Simulated provider acceptance completed for release ${input.release.releaseNumber}. No external deployment was performed.`,
    metadata: {
      releaseNumber: input.release.releaseNumber,
      runtimeSource: input.release.runtimeSource,
    },
    createdAt: executedAt,
  });

  return {
    status: "completed",
    summary: `Hosting adapter simulation completed for release ${input.release.name}.`,
    logs,
  };
}

export function evaluateDeployReleaseExecutionReadiness(input: {
  target: DeployTargetRecord;
  release: DeployReleaseRecord;
  run: DeployRunRecord | null;
  artifacts: DeployArtifactRecord[];
  checkedAt?: string;
}): DeployReleaseReadinessResult {
  const readiness = evaluateDeployReleaseReadiness(input);
  const checks = [...readiness.checks];

  if (input.release.status !== "handoff_ready" && input.release.status !== "exported") {
    pushCheck(
      checks,
      "execution",
      "blocking",
      "Release is not ready for external execution",
      "Only handoff-ready or exported releases can be executed against a real hosting adapter.",
    );
  } else {
    pushCheck(
      checks,
      "execution",
      "pass",
      "Release is eligible for external execution",
      `Release ${input.release.name} can be sent to a hosting adapter once provider checks pass.`,
    );
  }

  if (input.target.settings.adapterPresetKey !== "vercel_nextjs") {
    pushCheck(
      checks,
      "execution",
      "blocking",
      "Preset does not have a real execution adapter",
      `Preset ${input.target.settings.adapterPresetKey} still supports review and simulation only.`,
    );
  } else {
    pushCheck(
      checks,
      "execution",
      "pass",
      "Real execution adapter is available",
      "The Vercel adapter can submit this release to an external hosting provider.",
    );
  }

  const tokenEnvVar = adapterConfigValue(input.target, "tokenEnvVar");
  const apiBaseUrl = adapterConfigValue(input.target, "apiBaseUrl");
  const projectName = adapterConfigValue(input.target, "projectName");
  const deploymentTarget = adapterConfigValue(input.target, "deploymentTarget");

  if (!tokenEnvVar) {
    pushCheck(
      checks,
      "execution",
      "blocking",
      "Hosting adapter token env var is missing",
      "Set tokenEnvVar in adapter config before running a real hosting execution.",
    );
  } else if (!getOptionalEnv(tokenEnvVar)) {
    pushCheck(
      checks,
      "execution",
      "blocking",
      "Hosting adapter token is not configured",
      `Environment variable ${tokenEnvVar} is not set on this runtime.`,
    );
  } else {
    pushCheck(
      checks,
      "execution",
      "pass",
      "Hosting adapter token is configured",
      `Environment variable ${tokenEnvVar} is available for adapter execution.`,
    );
  }

  if (!apiBaseUrl) {
    pushCheck(
      checks,
      "execution",
      "blocking",
      "Hosting adapter base URL is missing",
      "Add apiBaseUrl to the adapter config before external execution.",
    );
  } else {
    pushCheck(
      checks,
      "execution",
      "pass",
      "Hosting adapter base URL is configured",
      `Requests will be sent to ${apiBaseUrl}.`,
    );
  }

  if (!projectName) {
    pushCheck(
      checks,
      "execution",
      "warning",
      "Hosting project name will be derived",
      "No explicit projectName was configured, so the adapter will derive one from the deploy target.",
    );
  } else {
    pushCheck(
      checks,
      "execution",
      "pass",
      "Hosting project name is configured",
      `Project name ${projectName} will be used for the external hosting execution.`,
    );
  }

  if (!deploymentTarget) {
    pushCheck(
      checks,
      "execution",
      "warning",
      "Provider deployment target will default to production",
      "No explicit deploymentTarget was set in adapter config.",
    );
  } else {
    pushCheck(
      checks,
      "execution",
      "pass",
      "Provider deployment target is configured",
      `Provider target ${deploymentTarget} will be requested during execution.`,
    );
  }

  const outputPackage = input.artifacts.find((artifact) => artifact.artifactType === "deploy_output_package");

  if (!outputPackage) {
    pushCheck(
      checks,
      "execution",
      "blocking",
      "Deploy output package is missing",
      "The selected release does not have a deploy output package artifact to send to a hosting provider.",
    );
  } else {
    pushCheck(
      checks,
      "execution",
      "pass",
      "Deploy output package is attached",
      "The provider execution can use the stored deploy output package from this release.",
    );
  }

  return {
    isReady: !checks.some((check) => check.severity === "blocking"),
    blockingCount: countChecks(checks, "blocking"),
    warningCount: countChecks(checks, "warning"),
    checkedAt: readiness.checkedAt,
    checks,
  };
}
