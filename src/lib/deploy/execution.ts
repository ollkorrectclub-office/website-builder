import { URL } from "node:url";

import { readDeployOutputFiles } from "@/lib/deploy/artifacts";
import { readApiKeyFromEnv } from "@/lib/model-adapters/openai-compatible";

import type {
  DeployArtifactRecord,
  DeployExecutionLogRecord,
  DeployExecutionProviderKey,
  DeployExecutionRunRecord,
  DeployExecutionRunStatus,
  DeployExecutionSource,
  DeployExecutionTraceRecord,
  DeployReleaseRecord,
  DeployRunRecord,
  DeployTargetRecord,
} from "@/lib/deploy/types";

const DEFAULT_VERCEL_API_BASE_URL = "https://api.vercel.com";

export interface HostingExecutionResult {
  source: DeployExecutionSource;
  requestedAdapterKey: DeployTargetRecord["settings"]["adapterKey"];
  actualAdapterKey: DeployExecutionSource;
  providerKey: DeployExecutionProviderKey | null;
  providerLabel: string | null;
  status: DeployExecutionRunStatus;
  summary: string;
  logs: DeployExecutionLogRecord[];
  providerResponse: DeployExecutionTraceRecord | null;
  latestProviderStatus: string | null;
  hostedUrl: string | null;
  hostedInspectionUrl: string | null;
  providerDeploymentId: string | null;
  errorMessage: string | null;
}

function configMap(settings: DeployTargetRecord["settings"]) {
  return new Map(settings.adapterConfig.map((entry) => [entry.key, entry.value]));
}

function normalizeHostedUrl(value: string | null | undefined) {
  if (!value || value.trim().length === 0) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

function projectSlug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "project"
  );
}

function safeObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function providerErrorMessage(payload: Record<string, unknown>, fallback: string) {
  const error = safeObject(payload.error);
  const message = typeof error.message === "string" ? error.message : null;
  const code = typeof error.code === "string" ? error.code : null;

  if (message && code) {
    return `${message} (${code})`;
  }

  return message ?? fallback;
}

function vercelStatus(value: string | null | undefined): DeployExecutionRunStatus {
  switch ((value ?? "").toUpperCase()) {
    case "READY":
      return "ready";
    case "ERROR":
    case "CANCELED":
      return "failed";
    default:
      return "submitted";
  }
}

function buildVercelApiUrl(baseUrl: string, path: string, config: Map<string, string>) {
  const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const teamId = config.get("teamId");
  const teamSlug = config.get("teamSlug");

  if (teamId) {
    url.searchParams.set("teamId", teamId);
  }

  if (teamSlug) {
    url.searchParams.set("slug", teamSlug);
  }

  return url.toString();
}

function buildProviderTrace(input: {
  requestId: string | null;
  deploymentId: string | null;
  deploymentUrl: string | null;
  deploymentInspectorUrl: string | null;
  providerStatus: string | null;
  httpStatus: number | null;
  metadata: Record<string, unknown>;
}): DeployExecutionTraceRecord {
  return {
    requestId: input.requestId,
    deploymentId: input.deploymentId,
    deploymentUrl: input.deploymentUrl,
    deploymentInspectorUrl: input.deploymentInspectorUrl,
    providerStatus: input.providerStatus,
    httpStatus: input.httpStatus,
    metadata: input.metadata,
  };
}

function buildExecutionLog(
  level: DeployExecutionLogRecord["level"],
  message: string,
  metadata: Record<string, unknown>,
  createdAt: string,
): DeployExecutionLogRecord {
  return {
    id: crypto.randomUUID(),
    level,
    message,
    metadata,
    createdAt,
  };
}

function domainLabel(target: DeployTargetRecord) {
  return target.settings.primaryDomain || "the configured target";
}

function summaryForStatus(
  status: DeployExecutionRunStatus,
  target: DeployTargetRecord,
  mode: "execute" | "recheck",
) {
  const domain = domainLabel(target);

  switch (status) {
    case "ready":
      return `Vercel deployment is ready for ${domain}.`;
    case "failed":
      return `Vercel deployment failed for ${domain}.`;
    case "submitted":
      return mode === "recheck"
        ? `Vercel deployment is still pending for ${domain}.`
        : `Vercel deployment was submitted for ${domain}.`;
    case "blocked":
      return `Vercel deployment is blocked for ${domain}.`;
  }
}

function unsupportedExecutionResult(
  requestedAdapterKey: DeployTargetRecord["settings"]["adapterKey"],
  target: DeployTargetRecord,
  message: string,
  createdAt: string,
): HostingExecutionResult {
  return {
    source: "unsupported_hosting_adapter_v1",
    requestedAdapterKey,
    actualAdapterKey: "unsupported_hosting_adapter_v1",
    providerKey: null,
    providerLabel: null,
    status: "blocked",
    summary: `Preset ${target.settings.adapterPresetKey} does not have a real hosting execution adapter yet.`,
    logs: [buildExecutionLog("warning", message, { adapterPresetKey: target.settings.adapterPresetKey }, createdAt)],
    providerResponse: null,
    latestProviderStatus: null,
    hostedUrl: null,
    hostedInspectionUrl: null,
    providerDeploymentId: null,
    errorMessage: message,
  };
}

function resolveVercelConfig(target: DeployTargetRecord) {
  const config = configMap(target.settings);
  const apiBaseUrl = (config.get("apiBaseUrl") ?? DEFAULT_VERCEL_API_BASE_URL).trim();
  const tokenEnvVar = (config.get("tokenEnvVar") ?? "VERCEL_TOKEN").trim();
  const configuredProjectName = (config.get("projectName") ?? "").trim();
  const deploymentTarget = (config.get("deploymentTarget") ?? "production").trim() || "production";
  const framework = (config.get("framework") ?? "nextjs-app-router").trim();
  const projectName =
    configuredProjectName && configuredProjectName !== "project-slug"
      ? configuredProjectName
      : projectSlug(target.name);

  return {
    config,
    apiBaseUrl,
    tokenEnvVar,
    configuredProjectName,
    deploymentTarget,
    framework,
    projectName,
  };
}

async function inspectVercelDeployment(input: {
  apiBaseUrl: string;
  apiKey: string;
  config: Map<string, string>;
  deploymentId: string;
  requestId: string | null;
  initialHostedUrl: string | null;
  initialInspectorUrl: string | null;
  target: DeployTargetRecord;
  release: DeployReleaseRecord;
  mode: "execute" | "recheck";
  fallbackStatus: DeployExecutionRunStatus;
  startedAt: string;
}): Promise<HostingExecutionResult> {
  const inspectUrl = buildVercelApiUrl(
    input.apiBaseUrl,
    `/v13/deployments/${input.deploymentId}`,
    input.config,
  );
  const inspectStartedAt = Date.now();

  try {
    const response = await fetch(inspectUrl, {
      method: "GET",
      headers: {
        authorization: `Bearer ${input.apiKey}`,
      },
      cache: "no-store",
    });
    const text = await response.text();
    const payload = text.trim().length > 0 ? safeObject(JSON.parse(text)) : {};
    const providerStatus =
      typeof payload.readyState === "string"
        ? payload.readyState
        : typeof payload.ready_state === "string"
          ? payload.ready_state
          : null;
    const status = response.ok ? vercelStatus(providerStatus) : input.fallbackStatus;
    const hostedUrl = normalizeHostedUrl(
      typeof payload.url === "string" ? payload.url : input.initialHostedUrl,
    );
    const inspectorUrl =
      typeof payload.inspectorUrl === "string" ? payload.inspectorUrl : input.initialInspectorUrl;
    const errorMessage =
      response.ok || input.mode === "recheck"
        ? null
        : providerErrorMessage(
            payload,
            `Vercel returned ${response.status} ${response.statusText}.`,
          );

    const message =
      response.ok
        ? status === "ready"
          ? `Vercel reported READY for deployment ${input.deploymentId}.`
          : `Vercel reported ${providerStatus ?? "SUBMITTED"} for deployment ${input.deploymentId}.`
        : `Vercel inspection returned ${response.status} ${response.statusText}; keeping status ${input.fallbackStatus}.`;

    return {
      source: "vercel_deploy_api_v1",
      requestedAdapterKey: input.target.settings.adapterKey,
      actualAdapterKey: "vercel_deploy_api_v1",
      providerKey: "vercel",
      providerLabel: "Vercel",
      status,
      summary: response.ok
        ? summaryForStatus(status, input.target, input.mode)
        : `${summaryForStatus(input.fallbackStatus, input.target, input.mode)} Recheck could not confirm a newer provider state.`,
      logs: [
        buildExecutionLog(response.ok ? "info" : "warning", message, {
          stage: "inspect",
          releaseId: input.release.id,
          deploymentId: input.deploymentId,
          providerStatus,
          httpStatus: response.status,
          latencyMs: Date.now() - inspectStartedAt,
        }, input.startedAt),
      ],
      providerResponse: buildProviderTrace({
        requestId:
          typeof payload.id === "string"
            ? payload.id
            : typeof response.headers.get("x-vercel-id") === "string"
              ? response.headers.get("x-vercel-id")
              : input.requestId,
        deploymentId: typeof payload.id === "string" ? payload.id : input.deploymentId,
        deploymentUrl: hostedUrl,
        deploymentInspectorUrl: inspectorUrl,
        providerStatus,
        httpStatus: response.status,
        metadata: {
          stage: "inspect",
          response: payload,
          apiBaseUrl: input.apiBaseUrl,
          mode: input.mode,
          latencyMs: Date.now() - inspectStartedAt,
        },
      }),
      latestProviderStatus: providerStatus,
      hostedUrl,
      hostedInspectionUrl: inspectorUrl,
      providerDeploymentId: typeof payload.id === "string" ? payload.id : input.deploymentId,
      errorMessage,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Vercel inspection request failed.";

    return {
      source: "vercel_deploy_api_v1",
      requestedAdapterKey: input.target.settings.adapterKey,
      actualAdapterKey: "vercel_deploy_api_v1",
      providerKey: "vercel",
      providerLabel: "Vercel",
      status: input.fallbackStatus,
      summary: `${summaryForStatus(input.fallbackStatus, input.target, input.mode)} Recheck could not confirm a newer provider state.`,
      logs: [
        buildExecutionLog("warning", `Vercel inspection request failed: ${message}`, {
          stage: "inspect",
          releaseId: input.release.id,
          deploymentId: input.deploymentId,
          apiBaseUrl: input.apiBaseUrl,
        }, input.startedAt),
      ],
      providerResponse: buildProviderTrace({
        requestId: input.requestId,
        deploymentId: input.deploymentId,
        deploymentUrl: input.initialHostedUrl,
        deploymentInspectorUrl: input.initialInspectorUrl,
        providerStatus: null,
        httpStatus: null,
        metadata: {
          stage: "inspect",
          apiBaseUrl: input.apiBaseUrl,
          mode: input.mode,
          requestFailed: true,
        },
      }),
      latestProviderStatus: null,
      hostedUrl: input.initialHostedUrl,
      hostedInspectionUrl: input.initialInspectorUrl,
      providerDeploymentId: input.deploymentId,
      errorMessage: input.mode === "recheck" ? message : null,
    };
  }
}

export async function executeDeployReleaseWithHostingAdapter(input: {
  target: DeployTargetRecord;
  release: DeployReleaseRecord;
  run: DeployRunRecord;
  artifacts: DeployArtifactRecord[];
}): Promise<HostingExecutionResult> {
  const requestedAdapterKey = input.target.settings.adapterKey;
  const createdAt = new Date().toISOString();

  if (input.target.settings.adapterPresetKey !== "vercel_nextjs") {
    return unsupportedExecutionResult(
      requestedAdapterKey,
      input.target,
      "This hosting preset is not wired for real external execution yet.",
      createdAt,
    );
  }

  const resolved = resolveVercelConfig(input.target);
  let apiKey: string;

  try {
    apiKey = readApiKeyFromEnv(resolved.tokenEnvVar);
  } catch (error) {
    return {
      source: "vercel_deploy_api_v1",
      requestedAdapterKey,
      actualAdapterKey: "vercel_deploy_api_v1",
      providerKey: "vercel",
      providerLabel: "Vercel",
      status: "blocked",
      summary: `Vercel execution is blocked until ${resolved.tokenEnvVar} is configured.`,
      logs: [
        buildExecutionLog("warning", `Missing required provider token env var ${resolved.tokenEnvVar}.`, {
          tokenEnvVar: resolved.tokenEnvVar,
          releaseId: input.release.id,
        }, createdAt),
      ],
      providerResponse: null,
      latestProviderStatus: null,
      hostedUrl: null,
      hostedInspectionUrl: null,
      providerDeploymentId: null,
      errorMessage: error instanceof Error ? error.message : "Vercel token is not configured.",
    };
  }

  const packageArtifact =
    input.artifacts.find((artifact) => artifact.artifactType === "deploy_output_package") ?? null;
  const outputFiles = packageArtifact ? readDeployOutputFiles(packageArtifact.payload) : [];

  if (outputFiles.length === 0) {
    return {
      source: "vercel_deploy_api_v1",
      requestedAdapterKey,
      actualAdapterKey: "vercel_deploy_api_v1",
      providerKey: "vercel",
      providerLabel: "Vercel",
      status: "blocked",
      summary: "Vercel execution is blocked because the deploy output package is empty.",
      logs: [
        buildExecutionLog("error", "The deploy output package is empty and cannot be uploaded.", {
          releaseId: input.release.id,
          deployRunId: input.run.id,
        }, createdAt),
      ],
      providerResponse: null,
      latestProviderStatus: null,
      hostedUrl: null,
      hostedInspectionUrl: null,
      providerDeploymentId: null,
      errorMessage: "No deploy output package files were available to upload.",
    };
  }

  const requestBody = {
    name: resolved.projectName,
    target: resolved.deploymentTarget,
    files: outputFiles.map((file) => ({
      file: file.path,
      data: file.content,
    })),
    projectSettings: {
      framework: resolved.framework === "nextjs-app-router" ? "nextjs" : resolved.framework,
      installCommand: input.target.settings.installCommand,
      buildCommand: input.target.settings.buildCommand,
      devCommand: input.target.settings.startCommand,
      outputDirectory: input.target.settings.outputDirectory,
      nodeVersion: input.target.settings.nodeVersion,
    },
    meta: {
      projectId: input.target.projectId,
      releaseId: input.release.id,
      deployRunId: input.run.id,
      environmentKey: input.target.settings.environmentKey,
      sourcePlanRevisionNumber: String(input.run.sourcePlanRevisionNumber),
    },
  };

  const createUrl = buildVercelApiUrl(resolved.apiBaseUrl, "/v13/deployments", resolved.config);
  const requestStartedAt = Date.now();

  try {
    const createResponse = await fetch(createUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store",
    });
    const createText = await createResponse.text();
    const createPayload = createText.trim().length > 0 ? safeObject(JSON.parse(createText)) : {};
    const deploymentId = typeof createPayload.id === "string" ? createPayload.id : null;
    const createState =
      typeof createPayload.readyState === "string"
        ? createPayload.readyState
        : typeof createPayload.ready_state === "string"
          ? createPayload.ready_state
          : null;
    const hostedUrl = normalizeHostedUrl(
      typeof createPayload.url === "string" ? createPayload.url : null,
    );
    const inspectorUrl =
      typeof createPayload.inspectorUrl === "string" ? createPayload.inspectorUrl : null;
    const baseLogs: DeployExecutionLogRecord[] = [
      buildExecutionLog("info", `Prepared ${outputFiles.length} file(s) for Vercel deployment.`, {
        releaseId: input.release.id,
        deployRunId: input.run.id,
        fileCount: outputFiles.length,
        deploymentTarget: resolved.deploymentTarget,
        projectName: resolved.projectName,
      }, createdAt),
      buildExecutionLog(createResponse.ok ? "info" : "error", `Vercel create deployment responded with ${createResponse.status}.`, {
        stage: "create",
        releaseId: input.release.id,
        httpStatus: createResponse.status,
        deploymentId,
        latencyMs: Date.now() - requestStartedAt,
      }, createdAt),
    ];

    if (!createResponse.ok) {
      return {
        source: "vercel_deploy_api_v1",
        requestedAdapterKey,
        actualAdapterKey: "vercel_deploy_api_v1",
        providerKey: "vercel",
        providerLabel: "Vercel",
        status: "failed",
        summary: `Vercel deployment request failed for release ${input.release.name}.`,
        logs: baseLogs,
        providerResponse: buildProviderTrace({
          requestId:
            typeof createPayload.id === "string"
              ? createPayload.id
              : typeof createResponse.headers.get("x-vercel-id") === "string"
                ? createResponse.headers.get("x-vercel-id")
                : null,
          deploymentId,
          deploymentUrl: hostedUrl,
          deploymentInspectorUrl: inspectorUrl,
          providerStatus: createState ?? String(createResponse.status),
          httpStatus: createResponse.status,
          metadata: {
            stage: "create",
            response: createPayload,
            fileCount: outputFiles.length,
            requestedTarget: resolved.deploymentTarget,
            apiBaseUrl: resolved.apiBaseUrl,
          },
        }),
        latestProviderStatus: createState,
        hostedUrl,
        hostedInspectionUrl: inspectorUrl,
        providerDeploymentId: deploymentId,
        errorMessage: providerErrorMessage(
          createPayload,
          `Vercel returned ${createResponse.status} ${createResponse.statusText}.`,
        ),
      };
    }

    if (!deploymentId) {
      return {
        source: "vercel_deploy_api_v1",
        requestedAdapterKey,
        actualAdapterKey: "vercel_deploy_api_v1",
        providerKey: "vercel",
        providerLabel: "Vercel",
        status: "submitted",
        summary: summaryForStatus("submitted", input.target, "execute"),
        logs: [
          ...baseLogs,
          buildExecutionLog("warning", "Vercel returned no deployment id; keeping execution in submitted state.", {
            releaseId: input.release.id,
            stage: "create",
          }, createdAt),
        ],
        providerResponse: buildProviderTrace({
          requestId:
            typeof createResponse.headers.get("x-vercel-id") === "string"
              ? createResponse.headers.get("x-vercel-id")
              : null,
          deploymentId: null,
          deploymentUrl: hostedUrl,
          deploymentInspectorUrl: inspectorUrl,
          providerStatus: createState,
          httpStatus: createResponse.status,
          metadata: {
            stage: "create",
            response: createPayload,
            fileCount: outputFiles.length,
            requestedTarget: resolved.deploymentTarget,
            apiBaseUrl: resolved.apiBaseUrl,
          },
        }),
        latestProviderStatus: createState,
        hostedUrl,
        hostedInspectionUrl: inspectorUrl,
        providerDeploymentId: null,
        errorMessage: null,
      };
    }

    const inspection = await inspectVercelDeployment({
      apiBaseUrl: resolved.apiBaseUrl,
      apiKey,
      config: resolved.config,
      deploymentId,
      requestId:
        typeof createResponse.headers.get("x-vercel-id") === "string"
          ? createResponse.headers.get("x-vercel-id")
          : null,
      initialHostedUrl: hostedUrl,
      initialInspectorUrl: inspectorUrl,
      target: input.target,
      release: input.release,
      mode: "execute",
      fallbackStatus: "submitted",
      startedAt: createdAt,
    });

    return {
      ...inspection,
      logs: baseLogs.concat(inspection.logs),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vercel execution failed.";

    return {
      source: "vercel_deploy_api_v1",
      requestedAdapterKey,
      actualAdapterKey: "vercel_deploy_api_v1",
      providerKey: "vercel",
      providerLabel: "Vercel",
      status: "failed",
      summary: `Vercel deployment request failed for release ${input.release.name}.`,
      logs: [
        buildExecutionLog("error", `Vercel execution request failed: ${message}`, {
          stage: "request",
          apiBaseUrl: resolved.apiBaseUrl,
          fileCount: outputFiles.length,
          deploymentTarget: resolved.deploymentTarget,
        }, createdAt),
      ],
      providerResponse: buildProviderTrace({
        requestId: null,
        deploymentId: null,
        deploymentUrl: null,
        deploymentInspectorUrl: null,
        providerStatus: "request_failed",
        httpStatus: null,
        metadata: {
          stage: "request",
          apiBaseUrl: resolved.apiBaseUrl,
          fileCount: outputFiles.length,
          deploymentTarget: resolved.deploymentTarget,
        },
      }),
      latestProviderStatus: "request_failed",
      hostedUrl: null,
      hostedInspectionUrl: null,
      providerDeploymentId: null,
      errorMessage: message,
    };
  }
}

export async function recheckDeployExecutionWithHostingAdapter(input: {
  target: DeployTargetRecord;
  release: DeployReleaseRecord;
  run: DeployRunRecord;
  executionRun: DeployExecutionRunRecord;
}): Promise<HostingExecutionResult> {
  const requestedAdapterKey = input.executionRun.requestedAdapterKey;
  const createdAt = new Date().toISOString();

  if (input.executionRun.actualAdapterKey !== "vercel_deploy_api_v1") {
    return unsupportedExecutionResult(
      requestedAdapterKey,
      input.target,
      "This execution run is not backed by a real polling adapter.",
      createdAt,
    );
  }

  const deploymentId =
    input.executionRun.providerDeploymentId ??
    input.executionRun.providerResponse?.deploymentId ??
    null;

  if (!deploymentId) {
    return {
      source: "vercel_deploy_api_v1",
      requestedAdapterKey,
      actualAdapterKey: "vercel_deploy_api_v1",
      providerKey: "vercel",
      providerLabel: "Vercel",
      status: input.executionRun.status,
      summary: `${summaryForStatus(input.executionRun.status, input.target, "recheck")} The provider deployment id is missing, so no recheck could be performed.`,
      logs: [
        buildExecutionLog("error", "No provider deployment id is stored for this execution run.", {
          executionRunId: input.executionRun.id,
          releaseId: input.release.id,
        }, createdAt),
      ],
      providerResponse: input.executionRun.providerResponse,
      latestProviderStatus: input.executionRun.latestProviderStatus,
      hostedUrl: input.executionRun.hostedUrl,
      hostedInspectionUrl: input.executionRun.hostedInspectionUrl,
      providerDeploymentId: null,
      errorMessage: "Provider deployment id is missing.",
    };
  }

  const resolved = resolveVercelConfig(input.target);
  let apiKey: string;

  try {
    apiKey = readApiKeyFromEnv(resolved.tokenEnvVar);
  } catch (error) {
    return {
      source: "vercel_deploy_api_v1",
      requestedAdapterKey,
      actualAdapterKey: "vercel_deploy_api_v1",
      providerKey: "vercel",
      providerLabel: "Vercel",
      status: input.executionRun.status,
      summary: `${summaryForStatus(input.executionRun.status, input.target, "recheck")} Configure ${resolved.tokenEnvVar} to poll the provider again.`,
      logs: [
        buildExecutionLog("warning", `Missing required provider token env var ${resolved.tokenEnvVar}.`, {
          executionRunId: input.executionRun.id,
          tokenEnvVar: resolved.tokenEnvVar,
        }, createdAt),
      ],
      providerResponse: input.executionRun.providerResponse,
      latestProviderStatus: input.executionRun.latestProviderStatus,
      hostedUrl: input.executionRun.hostedUrl,
      hostedInspectionUrl: input.executionRun.hostedInspectionUrl,
      providerDeploymentId: deploymentId,
      errorMessage: error instanceof Error ? error.message : "Vercel token is not configured.",
    };
  }

  return inspectVercelDeployment({
    apiBaseUrl: resolved.apiBaseUrl,
    apiKey,
    config: resolved.config,
    deploymentId,
    requestId: input.executionRun.providerResponse?.requestId ?? null,
    initialHostedUrl: input.executionRun.hostedUrl,
    initialInspectorUrl: input.executionRun.hostedInspectionUrl,
    target: input.target,
    release: input.release,
    mode: "recheck",
    fallbackStatus: input.executionRun.status,
    startedAt: createdAt,
  });
}
