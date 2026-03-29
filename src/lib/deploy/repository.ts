import { appendProjectAuditEvent } from "@/lib/builder/audit-repository";
import { listProjectBuilderRefreshQueue } from "@/lib/builder/refresh-queue-repository";
import { buildRuntimePreviewBundle } from "@/lib/builder/runtime-preview";
import { isSupabaseConfigured } from "@/lib/env";
import { getProjectGenerationBundle } from "@/lib/generation/repository";
import { readLocalStore, writeLocalStore } from "@/lib/workspaces/local-store";
import { getProjectPlanBundle } from "@/lib/workspaces/repository";
import { createSupabaseServerClient } from "@/lib/workspaces/supabase";
import { getProjectCodeBundle } from "@/lib/builder/code-repository";
import { getProjectVisualBundle } from "@/lib/builder/repository";
import {
  buildDeployReleaseExportSnapshot,
  buildDeployReleaseHandoffPayload,
  deployReleaseExportFileName,
} from "@/lib/deploy/handoff";
import {
  executeDeployReleaseWithHostingAdapter,
  recheckDeployExecutionWithHostingAdapter,
} from "@/lib/deploy/execution";
import { applyDeployAdapterPreset } from "@/lib/deploy/presets";
import {
  evaluateDeployReleaseExecutionReadiness,
  buildDeployHandoffSimulationLogs,
  evaluateDeployReleaseReadiness,
} from "@/lib/deploy/readiness";
import { defaultDeployTargetSettings, normalizeDeployTargetSettings } from "@/lib/deploy/settings";

import type {
  ApplyDeployTargetPresetInput,
  DeployArtifactRecord,
  DeployExecutionRunRecord,
  HostedDeploymentRecord,
  DeployHandoffRunRecord,
  DeployReleaseExportResult,
  DeployReleaseRecord,
  DeployRunPersistenceInput,
  DeployRunRecord,
  DeployTargetRecord,
  ExecuteDeployReleaseInput,
  ExecuteDeployReleaseHandoffSimulationInput,
  ExportDeployReleaseInput,
  PrepareDeployReleaseHandoffInput,
  ProjectDeployAcceptedStateRecord,
  ProjectDeployBundle,
  PromoteDeployReleaseInput,
  RecheckDeployExecutionRunInput,
  RetryDeployExecutionRunInput,
  UpdateDeployTargetSettingsInput,
} from "@/lib/deploy/types";

async function appendDeployAuditEvent(...args: Parameters<typeof appendProjectAuditEvent>) {
  try {
    return await appendProjectAuditEvent(...args);
  } catch (error) {
    console.error("Deploy audit event could not be persisted.", {
      eventId: args[0]?.id ?? null,
      kind: args[0]?.kind ?? null,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function emptyStructuredPlan(): DeployRunRecord["sourcePlanSnapshot"] {
  return {
    productSummary: "",
    targetUsers: [],
    pageMap: [],
    featureList: [],
    dataModels: [],
    authRoles: [],
    integrationsNeeded: [],
    designDirection: "",
  };
}

function nowIso() {
  return new Date().toISOString();
}

function sortDeployRuns(runs: DeployRunRecord[]) {
  return [...runs].sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

function sortDeployArtifacts(artifacts: DeployArtifactRecord[]) {
  return [...artifacts].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function sortDeployHandoffRuns(runs: DeployHandoffRunRecord[]) {
  return [...runs].sort((left, right) => {
    if (left.startedAt !== right.startedAt) {
      return right.startedAt.localeCompare(left.startedAt);
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

function sortDeployExecutionRuns(runs: DeployExecutionRunRecord[]) {
  return [...runs].sort((left, right) => {
    if (left.startedAt !== right.startedAt) {
      return right.startedAt.localeCompare(left.startedAt);
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

function defaultDeployTarget(input: {
  workspaceId: string;
  projectId: string;
  projectName: string;
  timestamp?: string;
}): DeployTargetRecord {
  const timestamp = input.timestamp ?? nowIso();

  return {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    name: `${input.projectName} production snapshot`,
    targetType: "internal_snapshot_v1",
    status: "idle",
    settings: defaultDeployTargetSettings(),
    latestDeployRunId: null,
    latestDeployRunStatus: null,
    latestPlanRevisionId: null,
    latestPlanRevisionNumber: null,
    latestVisualRevisionNumber: null,
    latestCodeRevisionNumber: null,
    latestGenerationRunId: null,
    latestRuntimeSource: null,
    latestSummary: null,
    latestReleaseId: null,
    latestReleaseName: null,
    latestReleaseNumber: null,
    latestExecutionRunId: null,
    latestExecutionRunStatus: null,
    hostedDeployment: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function mapDeployTargetRow(row: Record<string, unknown>): DeployTargetRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    projectId: String(row.project_id),
    name: String(row.name),
    targetType: row.target_type as DeployTargetRecord["targetType"],
    status: row.status as DeployTargetRecord["status"],
    settings: normalizeDeployTargetSettings(
      ((row.settings_json as DeployTargetRecord["settings"] | null) ??
        (row.settings as DeployTargetRecord["settings"] | null)) as
        | DeployTargetRecord["settings"]
        | null,
    ),
    latestDeployRunId: row.latest_deploy_run_id ? String(row.latest_deploy_run_id) : null,
    latestDeployRunStatus: row.latest_deploy_run_status
      ? (row.latest_deploy_run_status as DeployTargetRecord["latestDeployRunStatus"])
      : null,
    latestPlanRevisionId: row.latest_plan_revision_id ? String(row.latest_plan_revision_id) : null,
    latestPlanRevisionNumber:
      typeof row.latest_plan_revision_number === "number"
        ? row.latest_plan_revision_number
        : row.latest_plan_revision_number
          ? Number(row.latest_plan_revision_number)
          : null,
    latestVisualRevisionNumber:
      typeof row.latest_visual_revision_number === "number"
        ? row.latest_visual_revision_number
        : row.latest_visual_revision_number
          ? Number(row.latest_visual_revision_number)
          : null,
    latestCodeRevisionNumber:
      typeof row.latest_code_revision_number === "number"
        ? row.latest_code_revision_number
        : row.latest_code_revision_number
          ? Number(row.latest_code_revision_number)
          : null,
    latestGenerationRunId: row.latest_generation_run_id ? String(row.latest_generation_run_id) : null,
    latestRuntimeSource: row.latest_runtime_source
      ? (row.latest_runtime_source as DeployTargetRecord["latestRuntimeSource"])
      : null,
    latestSummary: row.latest_summary ? String(row.latest_summary) : null,
    latestReleaseId: row.latest_release_id ? String(row.latest_release_id) : null,
    latestReleaseName: row.latest_release_name ? String(row.latest_release_name) : null,
    latestReleaseNumber:
      typeof row.latest_release_number === "number"
        ? row.latest_release_number
        : row.latest_release_number
          ? Number(row.latest_release_number)
          : null,
    latestExecutionRunId:
      typeof row.latest_execution_run_id === "string" ? row.latest_execution_run_id : null,
    latestExecutionRunStatus:
      typeof row.latest_execution_run_status === "string"
        ? (row.latest_execution_run_status as DeployTargetRecord["latestExecutionRunStatus"])
        : null,
    hostedDeployment:
      typeof row.hosted_metadata_json === "object" && row.hosted_metadata_json
        ? (row.hosted_metadata_json as DeployTargetRecord["hostedDeployment"])
        : typeof row.hostedDeployment === "object" && row.hostedDeployment
          ? (row.hostedDeployment as DeployTargetRecord["hostedDeployment"])
          : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapDeployRunRow(row: Record<string, unknown>): DeployRunRecord {
  return {
    id: String(row.id),
    deployTargetId: String(row.deploy_target_id),
    workspaceId: String(row.workspace_id),
    projectId: String(row.project_id),
    sourcePlanRevisionId: String(row.source_plan_revision_id),
    sourcePlanRevisionNumber:
      typeof row.source_plan_revision_number === "number"
        ? row.source_plan_revision_number
        : Number(row.source_plan_revision_number ?? 1),
    sourcePlanSnapshot:
      (row.source_plan_snapshot as DeployRunRecord["sourcePlanSnapshot"]) ?? emptyStructuredPlan(),
    sourceVisualRevisionNumber:
      typeof row.source_visual_revision_number === "number"
        ? row.source_visual_revision_number
        : Number(row.source_visual_revision_number ?? 1),
    sourceCodeRevisionNumber:
      typeof row.source_code_revision_number === "number"
        ? row.source_code_revision_number
        : Number(row.source_code_revision_number ?? 1),
    sourceGenerationRunId: row.source_generation_run_id ? String(row.source_generation_run_id) : null,
    runtimeSource: row.runtime_source as DeployRunRecord["runtimeSource"],
    source: row.source as DeployRunRecord["source"],
    trigger: row.trigger as DeployRunRecord["trigger"],
    status: row.status as DeployRunRecord["status"],
    summary: String(row.summary ?? ""),
    outputSummary: (row.output_summary as DeployRunRecord["outputSummary"]) ?? null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapDeployArtifactRow(row: Record<string, unknown>): DeployArtifactRecord {
  return {
    id: String(row.id),
    deployRunId: String(row.deploy_run_id),
    deployTargetId: String(row.deploy_target_id),
    workspaceId: String(row.workspace_id),
    projectId: String(row.project_id),
    artifactType: row.artifact_type as DeployArtifactRecord["artifactType"],
    label: String(row.label),
    payload: (row.payload_json as DeployArtifactRecord["payload"]) ?? {},
    createdAt: String(row.created_at),
  };
}

function mapDeployReleaseRow(row: Record<string, unknown>): DeployReleaseRecord {
  return {
    id: String(row.id),
    deployTargetId: String(row.deploy_target_id),
    deployRunId: String(row.deploy_run_id),
    workspaceId: String(row.workspace_id),
    projectId: String(row.project_id),
    releaseNumber:
      typeof row.release_number === "number"
        ? row.release_number
        : Number(row.release_number ?? 1),
    name: String(row.name),
    notes: String(row.notes ?? ""),
    status: row.status as DeployReleaseRecord["status"],
    sourcePlanRevisionId: String(row.source_plan_revision_id),
    sourcePlanRevisionNumber:
      typeof row.source_plan_revision_number === "number"
        ? row.source_plan_revision_number
        : Number(row.source_plan_revision_number ?? 1),
    sourceVisualRevisionNumber:
      typeof row.source_visual_revision_number === "number"
        ? row.source_visual_revision_number
        : Number(row.source_visual_revision_number ?? 1),
    sourceCodeRevisionNumber:
      typeof row.source_code_revision_number === "number"
        ? row.source_code_revision_number
        : Number(row.source_code_revision_number ?? 1),
    sourceGenerationRunId: row.source_generation_run_id ? String(row.source_generation_run_id) : null,
    runtimeSource: row.runtime_source as DeployReleaseRecord["runtimeSource"],
    promotedByUserId: row.promoted_by_user_id ? String(row.promoted_by_user_id) : null,
    handoffPayload:
      typeof row.handoff_payload_json === "object" && row.handoff_payload_json
        ? (row.handoff_payload_json as DeployReleaseRecord["handoffPayload"])
        : typeof row.handoffPayload === "object" && row.handoffPayload
          ? (row.handoffPayload as DeployReleaseRecord["handoffPayload"])
          : null,
    exportSnapshot:
      typeof row.export_snapshot_json === "object" && row.export_snapshot_json
        ? (row.export_snapshot_json as DeployReleaseRecord["exportSnapshot"])
        : typeof row.exportSnapshot === "object" && row.exportSnapshot
          ? (row.exportSnapshot as DeployReleaseRecord["exportSnapshot"])
          : null,
    exportFileName: row.export_file_name ? String(row.export_file_name) : typeof row.exportFileName === "string" ? row.exportFileName : null,
    handoffPreparedAt: row.handoff_prepared_at ? String(row.handoff_prepared_at) : typeof row.handoffPreparedAt === "string" ? row.handoffPreparedAt : null,
    exportedAt: row.exported_at ? String(row.exported_at) : typeof row.exportedAt === "string" ? row.exportedAt : null,
    latestExecutionRunId:
      typeof row.latest_execution_run_id === "string"
        ? row.latest_execution_run_id
        : typeof row.latestExecutionRunId === "string"
          ? row.latestExecutionRunId
          : null,
    latestExecutionStatus:
      typeof row.latest_execution_status === "string"
        ? (row.latest_execution_status as DeployReleaseRecord["latestExecutionStatus"])
        : typeof row.latestExecutionStatus === "string"
          ? (row.latestExecutionStatus as DeployReleaseRecord["latestExecutionStatus"])
          : null,
    hostedDeployment:
      typeof row.hosted_metadata_json === "object" && row.hosted_metadata_json
        ? (row.hosted_metadata_json as DeployReleaseRecord["hostedDeployment"])
        : typeof row.hostedDeployment === "object" && row.hostedDeployment
          ? (row.hostedDeployment as DeployReleaseRecord["hostedDeployment"])
          : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapDeployHandoffRunRow(row: Record<string, unknown>): DeployHandoffRunRecord {
  return {
    id: String(row.id),
    deployTargetId: String(row.deploy_target_id),
    deployRunId: String(row.deploy_run_id),
    releaseId: String(row.release_id),
    workspaceId: String(row.workspace_id),
    projectId: String(row.project_id),
    source: row.source as DeployHandoffRunRecord["source"],
    adapterPresetKey: row.adapter_preset_key as DeployHandoffRunRecord["adapterPresetKey"],
    adapterKey: row.adapter_key as DeployHandoffRunRecord["adapterKey"],
    status: row.status as DeployHandoffRunRecord["status"],
    summary: String(row.summary ?? ""),
    readinessSummary:
      (row.readiness_summary_json as DeployHandoffRunRecord["readinessSummary"]) ??
      (row.readinessSummary as DeployHandoffRunRecord["readinessSummary"]) ?? {
        isReady: false,
        blockingCount: 1,
        warningCount: 0,
        checkedAt: String(row.created_at ?? new Date().toISOString()),
        checks: [],
      },
    logs:
      (row.logs_json as DeployHandoffRunRecord["logs"]) ??
      (row.logs as DeployHandoffRunRecord["logs"]) ??
      [],
    primaryDomain: String(row.primary_domain ?? row.primaryDomain ?? ""),
    environmentKey: String(row.environment_key ?? row.environmentKey ?? ""),
    exportFileName:
      typeof row.export_file_name === "string"
        ? row.export_file_name
        : typeof row.exportFileName === "string"
          ? row.exportFileName
          : null,
    startedAt: String(row.started_at ?? row.startedAt ?? row.created_at),
    completedAt:
      typeof row.completed_at === "string"
        ? row.completed_at
        : typeof row.completedAt === "string"
          ? row.completedAt
          : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapDeployExecutionRunRow(row: Record<string, unknown>): DeployExecutionRunRecord {
  return {
    id: String(row.id),
    deployTargetId: String(row.deploy_target_id ?? row.deployTargetId),
    deployRunId: String(row.deploy_run_id ?? row.deployRunId),
    releaseId: String(row.release_id ?? row.releaseId),
    workspaceId: String(row.workspace_id ?? row.workspaceId),
    projectId: String(row.project_id ?? row.projectId),
    requestedAdapterPresetKey: (row.requested_adapter_preset_key ??
      row.requestedAdapterPresetKey) as DeployExecutionRunRecord["requestedAdapterPresetKey"],
    requestedAdapterKey: (row.requested_adapter_key ??
      row.requestedAdapterKey) as DeployExecutionRunRecord["requestedAdapterKey"],
    actualAdapterKey: (row.actual_adapter_key ??
      row.actualAdapterKey) as DeployExecutionRunRecord["actualAdapterKey"],
    providerKey:
      typeof row.provider_key === "string"
        ? (row.provider_key as DeployExecutionRunRecord["providerKey"])
        : typeof row.providerKey === "string"
          ? (row.providerKey as DeployExecutionRunRecord["providerKey"])
          : null,
    providerLabel:
      typeof row.provider_label === "string"
        ? row.provider_label
        : typeof row.providerLabel === "string"
          ? row.providerLabel
          : null,
    status: (row.status as DeployExecutionRunRecord["status"]) ?? "blocked",
    summary: String(row.summary ?? ""),
    readinessSummary:
      (row.readiness_summary_json as DeployExecutionRunRecord["readinessSummary"]) ??
      (row.readinessSummary as DeployExecutionRunRecord["readinessSummary"]) ?? {
        isReady: false,
        blockingCount: 1,
        warningCount: 0,
        checkedAt: String(row.created_at ?? new Date().toISOString()),
        checks: [],
      },
    logs:
      (row.logs_json as DeployExecutionRunRecord["logs"]) ??
      (row.logs as DeployExecutionRunRecord["logs"]) ??
      [],
    statusTransitions:
      (row.status_transitions_json as DeployExecutionRunRecord["statusTransitions"]) ??
      (row.statusTransitions as DeployExecutionRunRecord["statusTransitions"]) ??
      [],
    providerResponse:
      typeof row.provider_response_json === "object" && row.provider_response_json
        ? (row.provider_response_json as DeployExecutionRunRecord["providerResponse"])
        : typeof row.providerResponse === "object" && row.providerResponse
          ? (row.providerResponse as DeployExecutionRunRecord["providerResponse"])
          : null,
    latestProviderStatus:
      typeof row.latest_provider_status === "string"
        ? row.latest_provider_status
        : typeof row.latestProviderStatus === "string"
          ? row.latestProviderStatus
          : null,
    hostedUrl:
      typeof row.hosted_url === "string"
        ? row.hosted_url
        : typeof row.hostedUrl === "string"
          ? row.hostedUrl
          : null,
    hostedInspectionUrl:
      typeof row.hosted_inspection_url === "string"
        ? row.hosted_inspection_url
        : typeof row.hostedInspectionUrl === "string"
          ? row.hostedInspectionUrl
          : null,
    providerDeploymentId:
      typeof row.provider_deployment_id === "string"
        ? row.provider_deployment_id
        : typeof row.providerDeploymentId === "string"
          ? row.providerDeploymentId
          : null,
    primaryDomain: String(row.primary_domain ?? row.primaryDomain ?? ""),
    environmentKey: String(row.environment_key ?? row.environmentKey ?? ""),
    lastCheckedAt:
      typeof row.last_checked_at === "string"
        ? row.last_checked_at
        : typeof row.lastCheckedAt === "string"
          ? row.lastCheckedAt
          : null,
    retryOfExecutionRunId:
      typeof row.retry_of_execution_run_id === "string"
        ? row.retry_of_execution_run_id
        : typeof row.retryOfExecutionRunId === "string"
          ? row.retryOfExecutionRunId
          : null,
    attemptNumber:
      typeof row.attempt_number === "number"
        ? row.attempt_number
        : typeof row.attemptNumber === "number"
          ? row.attemptNumber
          : 1,
    errorMessage:
      typeof row.error_message === "string"
        ? row.error_message
        : typeof row.errorMessage === "string"
          ? row.errorMessage
          : null,
    startedAt: String(row.started_at ?? row.startedAt ?? row.created_at),
    completedAt:
      typeof row.completed_at === "string"
        ? row.completed_at
        : typeof row.completedAt === "string"
          ? row.completedAt
          : null,
    createdAt: String(row.created_at ?? row.createdAt),
    updatedAt: String(row.updated_at ?? row.updatedAt),
  };
}

async function ensureProjectDeployTargetLocal(input: {
  workspaceId: string;
  projectId: string;
  projectName: string;
}) {
  const store = await readLocalStore();
  const existing = store.deployTargets.find((target) => target.projectId === input.projectId) ?? null;

  if (existing) {
    return existing;
  }

  const target = defaultDeployTarget(input);
  store.deployTargets.unshift(target);
  await writeLocalStore(store);
  return target;
}

async function ensureProjectDeployTargetSupabase(input: {
  workspaceId: string;
  projectId: string;
  projectName: string;
}) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data: existing, error: existingError } = await client
    .from("project_deploy_targets")
    .select("*")
    .eq("project_id", input.projectId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return mapDeployTargetRow(existing as Record<string, unknown>);
  }

  const target = defaultDeployTarget(input);
  const { data, error } = await client
    .from("project_deploy_targets")
    .insert({
      id: target.id,
      workspace_id: target.workspaceId,
      project_id: target.projectId,
      name: target.name,
      target_type: target.targetType,
      status: target.status,
      settings_json: target.settings,
      latest_deploy_run_id: null,
      latest_deploy_run_status: null,
      latest_plan_revision_id: null,
      latest_plan_revision_number: null,
      latest_visual_revision_number: null,
      latest_code_revision_number: null,
      latest_generation_run_id: null,
      latest_runtime_source: null,
      latest_summary: null,
      latest_release_id: null,
      latest_release_name: null,
      latest_release_number: null,
      latest_execution_run_id: null,
      latest_execution_run_status: null,
      hosted_metadata_json: null,
      created_at: target.createdAt,
      updated_at: target.updatedAt,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapDeployTargetRow(data as Record<string, unknown>);
}

async function listProjectDeployRunsLocal(projectId: string) {
  const store = await readLocalStore();
  return sortDeployRuns(store.deployRuns.filter((run) => run.projectId === projectId));
}

async function listProjectDeployRunsSupabase(projectId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("project_deploy_runs")
    .select("*")
    .eq("project_id", projectId)
    .order("started_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return sortDeployRuns((data ?? []).map((row) => mapDeployRunRow(row as Record<string, unknown>)));
}

async function listProjectDeployArtifactsLocal(projectId: string) {
  const store = await readLocalStore();
  return sortDeployArtifacts(store.deployArtifacts.filter((artifact) => artifact.projectId === projectId));
}

async function listProjectDeployArtifactsSupabase(projectId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("project_deploy_artifacts")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return sortDeployArtifacts((data ?? []).map((row) => mapDeployArtifactRow(row as Record<string, unknown>)));
}

async function listProjectDeployReleasesLocal(projectId: string) {
  const store = await readLocalStore();
  return [...store.deployReleases.filter((release) => release.projectId === projectId)].sort(
    (left, right) => right.releaseNumber - left.releaseNumber || right.createdAt.localeCompare(left.createdAt),
  );
}

async function listProjectDeployReleasesSupabase(projectId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("project_deploy_releases")
    .select("*")
    .eq("project_id", projectId)
    .order("release_number", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapDeployReleaseRow(row as Record<string, unknown>));
}

async function listProjectDeployHandoffRunsLocal(projectId: string) {
  const store = await readLocalStore();
  return sortDeployHandoffRuns(
    (store.deployHandoffRuns ?? []).filter((run) => run.projectId === projectId),
  );
}

async function listProjectDeployHandoffRunsSupabase(projectId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("project_deploy_handoff_runs")
    .select("*")
    .eq("project_id", projectId)
    .order("started_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return sortDeployHandoffRuns(
    (data ?? []).map((row) => mapDeployHandoffRunRow(row as Record<string, unknown>)),
  );
}

async function listProjectDeployExecutionRunsLocal(projectId: string) {
  const store = await readLocalStore();
  return sortDeployExecutionRuns(
    (store.deployExecutionRuns ?? []).filter((run) => run.projectId === projectId),
  );
}

async function listProjectDeployExecutionRunsSupabase(projectId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("project_deploy_execution_runs")
    .select("*")
    .eq("project_id", projectId)
    .order("started_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return sortDeployExecutionRuns(
    (data ?? []).map((row) => mapDeployExecutionRunRow(row as Record<string, unknown>)),
  );
}

async function recordDeployRunLocal(input: DeployRunPersistenceInput) {
  const store = await readLocalStore();
  const timestamp = input.completedAt ?? input.startedAt;
  const runId = crypto.randomUUID();
  const run: DeployRunRecord = {
    id: runId,
    deployTargetId: input.deployTargetId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    sourcePlanRevisionId: input.sourcePlanRevisionId,
    sourcePlanRevisionNumber: input.sourcePlanRevisionNumber,
    sourcePlanSnapshot: input.sourcePlanSnapshot,
    sourceVisualRevisionNumber: input.sourceVisualRevisionNumber,
    sourceCodeRevisionNumber: input.sourceCodeRevisionNumber,
    sourceGenerationRunId: input.sourceGenerationRunId,
    runtimeSource: input.runtimeSource,
    source: input.source,
    trigger: input.trigger,
    status: input.status,
    summary: input.summary,
    outputSummary: input.outputSummary,
    errorMessage: input.errorMessage ?? null,
    startedAt: input.startedAt,
    completedAt: input.completedAt ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const artifacts: DeployArtifactRecord[] = input.artifacts.map((artifact) => ({
    id: crypto.randomUUID(),
    deployRunId: runId,
    deployTargetId: input.deployTargetId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    artifactType: artifact.artifactType,
    label: artifact.label,
    payload: artifact.payload,
    createdAt: timestamp,
  }));

  store.deployRuns.unshift(run);
  store.deployArtifacts.unshift(...artifacts);
  const targetIndex = store.deployTargets.findIndex((target) => target.id === input.deployTargetId);

  if (targetIndex !== -1) {
    store.deployTargets[targetIndex] = {
      ...store.deployTargets[targetIndex],
      status: input.status === "completed" ? "snapshot_ready" : "failed",
      latestDeployRunId: run.id,
      latestDeployRunStatus: run.status,
      latestPlanRevisionId: run.sourcePlanRevisionId,
      latestPlanRevisionNumber: run.sourcePlanRevisionNumber,
      latestVisualRevisionNumber: run.sourceVisualRevisionNumber,
      latestCodeRevisionNumber: run.sourceCodeRevisionNumber,
      latestGenerationRunId: run.sourceGenerationRunId,
      latestRuntimeSource: run.runtimeSource,
      latestSummary: run.summary,
      settings: store.deployTargets[targetIndex].settings,
      latestReleaseId: store.deployTargets[targetIndex].latestReleaseId,
      latestReleaseName: store.deployTargets[targetIndex].latestReleaseName,
      latestReleaseNumber: store.deployTargets[targetIndex].latestReleaseNumber,
      latestExecutionRunId: store.deployTargets[targetIndex].latestExecutionRunId,
      latestExecutionRunStatus: store.deployTargets[targetIndex].latestExecutionRunStatus,
      hostedDeployment: store.deployTargets[targetIndex].hostedDeployment,
      updatedAt: timestamp,
    };
  }

  await writeLocalStore(store);

  await appendDeployAuditEvent({
    id: `audit-deploy-run-${run.id}`,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    source: "deploy",
    kind: "deploy_run",
    title: input.status === "completed" ? "Deploy snapshot created" : "Deploy snapshot failed",
    summary: input.summary,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "deploy_run",
    entityId: run.id,
    linkedTab: "plan",
    linkContext: {
      tab: "plan",
      deployRunId: run.id,
      generationRunId: run.sourceGenerationRunId,
      planRevisionId: run.sourcePlanRevisionId,
      planRevisionNumber: run.sourcePlanRevisionNumber,
    },
    metadata: {
      status: run.status,
      source: run.source,
      trigger: run.trigger,
      artifactCount: artifacts.length,
      outputSummary: run.outputSummary,
      runtimeSource: run.runtimeSource,
      sourceVisualRevisionNumber: run.sourceVisualRevisionNumber,
      sourceCodeRevisionNumber: run.sourceCodeRevisionNumber,
      errorMessage: run.errorMessage,
    },
    occurredAt: timestamp,
  });

  return {
    run,
    artifacts,
  };
}

async function recordDeployRunSupabase(input: DeployRunPersistenceInput) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const runId = crypto.randomUUID();
  const timestamp = input.completedAt ?? input.startedAt;
  const runRow = {
    id: runId,
    deploy_target_id: input.deployTargetId,
    project_id: input.projectId,
    workspace_id: input.workspaceId,
    source_plan_revision_id: input.sourcePlanRevisionId,
    source_plan_revision_number: input.sourcePlanRevisionNumber,
    source_plan_snapshot: input.sourcePlanSnapshot,
    source_visual_revision_number: input.sourceVisualRevisionNumber,
    source_code_revision_number: input.sourceCodeRevisionNumber,
    source_generation_run_id: input.sourceGenerationRunId,
    runtime_source: input.runtimeSource,
    source: input.source,
    trigger: input.trigger,
    status: input.status,
    summary: input.summary,
    output_summary: input.outputSummary,
    error_message: input.errorMessage ?? null,
    started_at: input.startedAt,
    completed_at: input.completedAt ?? null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const { data: insertedRun, error: runError } = await client
    .from("project_deploy_runs")
    .insert(runRow)
    .select("*")
    .single();

  if (runError) {
    throw new Error(runError.message);
  }

  const artifactRows = input.artifacts.map((artifact) => ({
    id: crypto.randomUUID(),
    deploy_run_id: runId,
    deploy_target_id: input.deployTargetId,
    project_id: input.projectId,
    workspace_id: input.workspaceId,
    artifact_type: artifact.artifactType,
    label: artifact.label,
    payload_json: artifact.payload,
    created_at: timestamp,
  }));

  if (artifactRows.length > 0) {
    const { error: artifactError } = await client.from("project_deploy_artifacts").insert(artifactRows);

    if (artifactError) {
      throw new Error(artifactError.message);
    }
  }

  const { error: targetError } = await client
    .from("project_deploy_targets")
    .update({
      status: input.status === "completed" ? "snapshot_ready" : "failed",
      latest_deploy_run_id: runId,
      latest_deploy_run_status: input.status,
      latest_plan_revision_id: input.sourcePlanRevisionId,
      latest_plan_revision_number: input.sourcePlanRevisionNumber,
      latest_visual_revision_number: input.sourceVisualRevisionNumber,
      latest_code_revision_number: input.sourceCodeRevisionNumber,
      latest_generation_run_id: input.sourceGenerationRunId,
      latest_runtime_source: input.runtimeSource,
      latest_summary: input.summary,
      updated_at: timestamp,
    })
    .eq("id", input.deployTargetId);

  if (targetError) {
    throw new Error(targetError.message);
  }

  await appendDeployAuditEvent({
    id: `audit-deploy-run-${runId}`,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    source: "deploy",
    kind: "deploy_run",
    title: input.status === "completed" ? "Deploy snapshot created" : "Deploy snapshot failed",
    summary: input.summary,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "deploy_run",
    entityId: runId,
    linkedTab: "plan",
    linkContext: {
      tab: "plan",
      deployRunId: runId,
      generationRunId: input.sourceGenerationRunId,
      planRevisionId: input.sourcePlanRevisionId,
      planRevisionNumber: input.sourcePlanRevisionNumber,
    },
    metadata: {
      status: input.status,
      source: input.source,
      trigger: input.trigger,
      artifactCount: input.artifacts.length,
      outputSummary: input.outputSummary,
      runtimeSource: input.runtimeSource,
      sourceVisualRevisionNumber: input.sourceVisualRevisionNumber,
      sourceCodeRevisionNumber: input.sourceCodeRevisionNumber,
      errorMessage: input.errorMessage ?? null,
    },
    occurredAt: timestamp,
  });

  return {
    run: mapDeployRunRow(insertedRun as Record<string, unknown>),
    artifacts: artifactRows.map((row) =>
      mapDeployArtifactRow({
        ...row,
        payload_json: row.payload_json,
      }),
    ),
  };
}

async function updateDeployTargetSettingsLocal(input: UpdateDeployTargetSettingsInput) {
  const store = await readLocalStore();
  const index = store.deployTargets.findIndex((target) => target.id === input.targetId);

  if (index === -1) {
    throw new Error("Deploy target not found.");
  }

  const current = store.deployTargets[index];
  const updated: DeployTargetRecord = {
    ...current,
    settings: input.settings,
    updatedAt: nowIso(),
  };
  store.deployTargets[index] = updated;
  await writeLocalStore(store);

  await appendDeployAuditEvent({
    id: `audit-deploy-target-${updated.id}-${updated.updatedAt}`,
    projectId: updated.projectId,
    workspaceId: updated.workspaceId,
    source: "deploy",
    kind: "deploy_target_updated",
    title: "Deploy target settings updated",
    summary: `Deploy target settings were updated for preset ${updated.settings.adapterPresetKey}.`,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "deploy_target",
    entityId: updated.id,
    linkedTab: "plan",
    linkContext: {
      tab: "plan",
    },
    metadata: {
      adapterPresetKey: updated.settings.adapterPresetKey,
      adapterKey: updated.settings.adapterKey,
      environmentKey: updated.settings.environmentKey,
      primaryDomain: updated.settings.primaryDomain,
      outputDirectory: updated.settings.outputDirectory,
    },
    occurredAt: updated.updatedAt,
  });

  return updated;
}

async function updateDeployTargetSettingsSupabase(input: UpdateDeployTargetSettingsInput) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const timestamp = nowIso();
  const { data, error } = await client
    .from("project_deploy_targets")
    .update({
      settings_json: input.settings,
      updated_at: timestamp,
    })
    .eq("id", input.targetId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const updated = mapDeployTargetRow(data as Record<string, unknown>);
  await appendDeployAuditEvent({
    id: `audit-deploy-target-${updated.id}-${timestamp}`,
    projectId: updated.projectId,
    workspaceId: updated.workspaceId,
    source: "deploy",
    kind: "deploy_target_updated",
    title: "Deploy target settings updated",
    summary: `Deploy target settings were updated for preset ${updated.settings.adapterPresetKey}.`,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "deploy_target",
    entityId: updated.id,
    linkedTab: "plan",
    linkContext: {
      tab: "plan",
    },
    metadata: {
      adapterPresetKey: updated.settings.adapterPresetKey,
      adapterKey: updated.settings.adapterKey,
      environmentKey: updated.settings.environmentKey,
      primaryDomain: updated.settings.primaryDomain,
      outputDirectory: updated.settings.outputDirectory,
    },
    occurredAt: timestamp,
  });

  return updated;
}

async function applyDeployTargetPresetLocal(input: ApplyDeployTargetPresetInput) {
  const store = await readLocalStore();
  const index = store.deployTargets.findIndex((target) => target.id === input.targetId);

  if (index === -1) {
    throw new Error("Deploy target not found.");
  }

  const current = store.deployTargets[index];
  const updated: DeployTargetRecord = {
    ...current,
    settings: applyDeployAdapterPreset(current.settings, input.presetKey),
    updatedAt: nowIso(),
  };
  store.deployTargets[index] = updated;
  await writeLocalStore(store);

  await appendDeployAuditEvent({
    id: `audit-deploy-target-${updated.id}-${updated.updatedAt}`,
    projectId: updated.projectId,
    workspaceId: updated.workspaceId,
    source: "deploy",
    kind: "deploy_target_updated",
    title: "Deploy target preset applied",
    summary: `Deploy target preset ${updated.settings.adapterPresetKey} was applied.`,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "deploy_target",
    entityId: updated.id,
    linkedTab: "plan",
    linkContext: {
      tab: "plan",
    },
    metadata: {
      adapterPresetKey: updated.settings.adapterPresetKey,
      adapterKey: updated.settings.adapterKey,
      environmentKey: updated.settings.environmentKey,
      primaryDomain: updated.settings.primaryDomain,
      outputDirectory: updated.settings.outputDirectory,
    },
    occurredAt: updated.updatedAt,
  });

  return updated;
}

async function applyDeployTargetPresetSupabase(input: ApplyDeployTargetPresetInput) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data: currentRow, error: currentError } = await client
    .from("project_deploy_targets")
    .select("*")
    .eq("id", input.targetId)
    .single();

  if (currentError) {
    throw new Error(currentError.message);
  }

  const current = mapDeployTargetRow(currentRow as Record<string, unknown>);
  const timestamp = nowIso();
  const nextSettings = applyDeployAdapterPreset(current.settings, input.presetKey);
  const { data, error } = await client
    .from("project_deploy_targets")
    .update({
      settings_json: nextSettings,
      updated_at: timestamp,
    })
    .eq("id", input.targetId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const updated = mapDeployTargetRow(data as Record<string, unknown>);
  await appendDeployAuditEvent({
    id: `audit-deploy-target-${updated.id}-${timestamp}`,
    projectId: updated.projectId,
    workspaceId: updated.workspaceId,
    source: "deploy",
    kind: "deploy_target_updated",
    title: "Deploy target preset applied",
    summary: `Deploy target preset ${updated.settings.adapterPresetKey} was applied.`,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "deploy_target",
    entityId: updated.id,
    linkedTab: "plan",
    linkContext: {
      tab: "plan",
    },
    metadata: {
      adapterPresetKey: updated.settings.adapterPresetKey,
      adapterKey: updated.settings.adapterKey,
      environmentKey: updated.settings.environmentKey,
      primaryDomain: updated.settings.primaryDomain,
      outputDirectory: updated.settings.outputDirectory,
    },
    occurredAt: timestamp,
  });

  return updated;
}

function buildReleaseAuditLinkContext(run: DeployRunRecord, releaseId: string) {
  return {
    tab: "plan" as const,
    deployRunId: run.id,
    releaseId,
    planRevisionId: run.sourcePlanRevisionId,
    planRevisionNumber: run.sourcePlanRevisionNumber,
  };
}

function buildHandoffRunAuditLinkContext(input: {
  run: DeployRunRecord;
  releaseId: string;
  handoffRunId: string;
}) {
  return {
    tab: "plan" as const,
    deployRunId: input.run.id,
    releaseId: input.releaseId,
    handoffRunId: input.handoffRunId,
    planRevisionId: input.run.sourcePlanRevisionId,
    planRevisionNumber: input.run.sourcePlanRevisionNumber,
  };
}

function buildExecutionRunAuditLinkContext(input: {
  run: DeployRunRecord;
  releaseId: string;
  executionRunId: string;
}) {
  return {
    tab: "plan" as const,
    deployRunId: input.run.id,
    releaseId: input.releaseId,
    executionRunId: input.executionRunId,
    planRevisionId: input.run.sourcePlanRevisionId,
    planRevisionNumber: input.run.sourcePlanRevisionNumber,
  };
}

async function prepareDeployReleaseHandoffLocal(input: PrepareDeployReleaseHandoffInput) {
  const store = await readLocalStore();
  const releaseIndex = store.deployReleases.findIndex((entry) => entry.id === input.releaseId);

  if (releaseIndex === -1) {
    throw new Error("Deploy release not found.");
  }

  const release = store.deployReleases[releaseIndex];

  if (release.status !== "promoted") {
    throw new Error("Only promoted releases can be prepared for hosting handoff.");
  }

  const run = store.deployRuns.find((entry) => entry.id === release.deployRunId) ?? null;
  const target = store.deployTargets.find((entry) => entry.id === release.deployTargetId) ?? null;

  if (!run || !target) {
    throw new Error("Deploy release context is incomplete.");
  }

  const artifacts = sortDeployArtifacts(
    store.deployArtifacts.filter((artifact) => artifact.deployRunId === run.id),
  );
  const timestamp = nowIso();
  const releaseForPreparation: DeployReleaseRecord = {
    ...release,
    status: "handoff_ready",
    updatedAt: timestamp,
  };
  const handoffPayload = buildDeployReleaseHandoffPayload({
    target,
    release: releaseForPreparation,
    run,
    artifacts,
    preparedAt: timestamp,
  });
  const exportSnapshot = buildDeployReleaseExportSnapshot({
    target,
    release: releaseForPreparation,
    run,
    artifacts,
    handoffPayload,
    generatedAt: timestamp,
  });
  const exportFileName = deployReleaseExportFileName({
    projectName: target.name,
    releaseNumber: release.releaseNumber,
    releaseName: release.name,
  });
  const nextRelease: DeployReleaseRecord = {
    ...release,
    status: "handoff_ready",
    handoffPayload,
    exportSnapshot,
    exportFileName,
    handoffPreparedAt: timestamp,
    updatedAt: timestamp,
  };

  store.deployReleases[releaseIndex] = nextRelease;
  await writeLocalStore(store);

  await appendDeployAuditEvent({
    id: `audit-deploy-release-handoff-${nextRelease.id}`,
    projectId: nextRelease.projectId,
    workspaceId: nextRelease.workspaceId,
    source: "deploy",
    kind: "deploy_release_handoff_prepared",
    title: "Deploy release handoff prepared",
    summary: `Release ${nextRelease.name} was prepared for hosting handoff review.`,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "deploy_release",
    entityId: nextRelease.id,
    linkedTab: "plan",
    linkContext: buildReleaseAuditLinkContext(run, nextRelease.id),
    metadata: {
      releaseName: nextRelease.name,
      releaseNumber: nextRelease.releaseNumber,
      deployRunId: run.id,
      artifactCount: artifacts.length,
      exportFileName,
      primaryDomain: target.settings.primaryDomain,
      environmentKey: target.settings.environmentKey,
    },
    occurredAt: timestamp,
  });

  return nextRelease;
}

async function prepareDeployReleaseHandoffSupabase(input: PrepareDeployReleaseHandoffInput) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data: releaseRow, error: releaseError } = await client
    .from("project_deploy_releases")
    .select("*")
    .eq("id", input.releaseId)
    .single();

  if (releaseError) {
    throw new Error(releaseError.message);
  }

  const release = mapDeployReleaseRow(releaseRow as Record<string, unknown>);

  if (release.status !== "promoted") {
    throw new Error("Only promoted releases can be prepared for hosting handoff.");
  }

  const [{ data: runRow, error: runError }, { data: targetRow, error: targetError }, { data: artifactsRows, error: artifactsError }] =
    await Promise.all([
      client.from("project_deploy_runs").select("*").eq("id", release.deployRunId).single(),
      client.from("project_deploy_targets").select("*").eq("id", release.deployTargetId).single(),
      client.from("project_deploy_artifacts").select("*").eq("deploy_run_id", release.deployRunId).order("created_at", { ascending: true }),
    ]);

  if (runError) {
    throw new Error(runError.message);
  }
  if (targetError) {
    throw new Error(targetError.message);
  }
  if (artifactsError) {
    throw new Error(artifactsError.message);
  }

  const run = mapDeployRunRow(runRow as Record<string, unknown>);
  const target = mapDeployTargetRow(targetRow as Record<string, unknown>);
  const artifacts = sortDeployArtifacts(
    (artifactsRows ?? []).map((row) => mapDeployArtifactRow(row as Record<string, unknown>)),
  );
  const timestamp = nowIso();
  const releaseForPreparation: DeployReleaseRecord = {
    ...release,
    status: "handoff_ready",
    updatedAt: timestamp,
  };
  const handoffPayload = buildDeployReleaseHandoffPayload({
    target,
    release: releaseForPreparation,
    run,
    artifacts,
    preparedAt: timestamp,
  });
  const exportSnapshot = buildDeployReleaseExportSnapshot({
    target,
    release: releaseForPreparation,
    run,
    artifacts,
    handoffPayload,
    generatedAt: timestamp,
  });
  const exportFileName = deployReleaseExportFileName({
    projectName: target.name,
    releaseNumber: release.releaseNumber,
    releaseName: release.name,
  });

  const { data, error } = await client
    .from("project_deploy_releases")
    .update({
      status: "handoff_ready",
      handoff_payload_json: handoffPayload,
      export_snapshot_json: exportSnapshot,
      export_file_name: exportFileName,
      handoff_prepared_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", release.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const nextRelease = mapDeployReleaseRow(data as Record<string, unknown>);

  await appendDeployAuditEvent({
    id: `audit-deploy-release-handoff-${nextRelease.id}`,
    projectId: nextRelease.projectId,
    workspaceId: nextRelease.workspaceId,
    source: "deploy",
    kind: "deploy_release_handoff_prepared",
    title: "Deploy release handoff prepared",
    summary: `Release ${nextRelease.name} was prepared for hosting handoff review.`,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "deploy_release",
    entityId: nextRelease.id,
    linkedTab: "plan",
    linkContext: buildReleaseAuditLinkContext(run, nextRelease.id),
    metadata: {
      releaseName: nextRelease.name,
      releaseNumber: nextRelease.releaseNumber,
      deployRunId: run.id,
      artifactCount: artifacts.length,
      exportFileName,
      primaryDomain: target.settings.primaryDomain,
      environmentKey: target.settings.environmentKey,
    },
    occurredAt: timestamp,
  });

  return nextRelease;
}

async function exportDeployReleaseSnapshotLocal(
  input: ExportDeployReleaseInput,
): Promise<DeployReleaseExportResult> {
  const store = await readLocalStore();
  const releaseIndex = store.deployReleases.findIndex((entry) => entry.id === input.releaseId);

  if (releaseIndex === -1) {
    throw new Error("Deploy release not found.");
  }

  const release = store.deployReleases[releaseIndex];

  if (release.status === "promoted") {
    throw new Error("Prepare the hosting handoff before exporting this release snapshot.");
  }

  if (!release.exportSnapshot || !release.exportFileName) {
    throw new Error("This release does not have an export snapshot yet.");
  }

  if (release.status === "handoff_ready") {
    const run = store.deployRuns.find((entry) => entry.id === release.deployRunId) ?? null;

    if (!run) {
      throw new Error("Deploy run not found for this release.");
    }

    const timestamp = nowIso();
    const nextRelease: DeployReleaseRecord = {
      ...release,
      status: "exported",
      exportedAt: timestamp,
      updatedAt: timestamp,
    };
    store.deployReleases[releaseIndex] = nextRelease;
    await writeLocalStore(store);

    await appendDeployAuditEvent({
      id: `audit-deploy-release-export-${nextRelease.id}-${timestamp}`,
      projectId: nextRelease.projectId,
      workspaceId: nextRelease.workspaceId,
      source: "deploy",
      kind: "deploy_release_exported",
      title: "Deploy release export downloaded",
      summary: `Release ${nextRelease.name} was exported as a hosting handoff snapshot.`,
      actorType: "user",
      actorLabel: "workspace_editor",
      entityType: "deploy_release",
      entityId: nextRelease.id,
      linkedTab: "plan",
      linkContext: buildReleaseAuditLinkContext(run, nextRelease.id),
      metadata: {
        releaseName: nextRelease.name,
        releaseNumber: nextRelease.releaseNumber,
        deployRunId: run.id,
        exportFileName: nextRelease.exportFileName,
      },
      occurredAt: timestamp,
    });

    return {
      release: nextRelease,
      fileName: nextRelease.exportFileName ?? "release-export.json",
      content: JSON.stringify(nextRelease.exportSnapshot ?? {}, null, 2),
    };
  }

  return {
    release,
    fileName: release.exportFileName ?? "release-export.json",
    content: JSON.stringify(release.exportSnapshot ?? {}, null, 2),
  };
}

async function exportDeployReleaseSnapshotSupabase(
  input: ExportDeployReleaseInput,
): Promise<DeployReleaseExportResult> {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data: releaseRow, error: releaseError } = await client
    .from("project_deploy_releases")
    .select("*")
    .eq("id", input.releaseId)
    .single();

  if (releaseError) {
    throw new Error(releaseError.message);
  }

  const release = mapDeployReleaseRow(releaseRow as Record<string, unknown>);

  if (release.status === "promoted") {
    throw new Error("Prepare the hosting handoff before exporting this release snapshot.");
  }

  if (!release.exportSnapshot || !release.exportFileName) {
    throw new Error("This release does not have an export snapshot yet.");
  }

  if (release.status === "handoff_ready") {
    const { data: runRow, error: runError } = await client
      .from("project_deploy_runs")
      .select("*")
      .eq("id", release.deployRunId)
      .single();

    if (runError) {
      throw new Error(runError.message);
    }

    const run = mapDeployRunRow(runRow as Record<string, unknown>);
    const timestamp = nowIso();

    const { data, error } = await client
      .from("project_deploy_releases")
      .update({
        status: "exported",
        exported_at: timestamp,
        updated_at: timestamp,
      })
      .eq("id", release.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const nextRelease = mapDeployReleaseRow(data as Record<string, unknown>);

    await appendDeployAuditEvent({
      id: `audit-deploy-release-export-${nextRelease.id}-${timestamp}`,
      projectId: nextRelease.projectId,
      workspaceId: nextRelease.workspaceId,
      source: "deploy",
      kind: "deploy_release_exported",
      title: "Deploy release export downloaded",
      summary: `Release ${nextRelease.name} was exported as a hosting handoff snapshot.`,
      actorType: "user",
      actorLabel: "workspace_editor",
      entityType: "deploy_release",
      entityId: nextRelease.id,
      linkedTab: "plan",
      linkContext: buildReleaseAuditLinkContext(run, nextRelease.id),
      metadata: {
        releaseName: nextRelease.name,
        releaseNumber: nextRelease.releaseNumber,
        deployRunId: run.id,
        exportFileName: nextRelease.exportFileName,
      },
      occurredAt: timestamp,
    });

    return {
      release: nextRelease,
      fileName: nextRelease.exportFileName ?? "release-export.json",
      content: JSON.stringify(nextRelease.exportSnapshot, null, 2),
    };
  }

  return {
    release,
    fileName: release.exportFileName ?? "release-export.json",
    content: JSON.stringify(release.exportSnapshot ?? {}, null, 2),
  };
}

async function executeDeployReleaseHandoffSimulationLocal(
  input: ExecuteDeployReleaseHandoffSimulationInput,
) {
  const store = await readLocalStore();
  const release = store.deployReleases.find((entry) => entry.id === input.releaseId) ?? null;

  if (!release) {
    throw new Error("Deploy release not found.");
  }

  const run = store.deployRuns.find((entry) => entry.id === release.deployRunId) ?? null;
  const target = store.deployTargets.find((entry) => entry.id === release.deployTargetId) ?? null;

  if (!target) {
    throw new Error("Deploy target context is incomplete.");
  }

  const artifacts = sortDeployArtifacts(
    store.deployArtifacts.filter((artifact) => artifact.deployRunId === release.deployRunId),
  );
  const startedAt = nowIso();
  const readiness = evaluateDeployReleaseReadiness({
    target,
    release,
    run,
    artifacts,
    checkedAt: startedAt,
  });
  const simulation = buildDeployHandoffSimulationLogs({
    target,
    release,
    run,
    readiness,
    executedAt: startedAt,
  });
  const completedAt = nowIso();
  const handoffRun: DeployHandoffRunRecord = {
    id: crypto.randomUUID(),
    deployTargetId: target.id,
    deployRunId: release.deployRunId,
    releaseId: release.id,
    workspaceId: release.workspaceId,
    projectId: release.projectId,
    source: "hosting_adapter_simulator_v1",
    adapterPresetKey: target.settings.adapterPresetKey,
    adapterKey: target.settings.adapterKey,
    status: simulation.status,
    summary: simulation.summary,
    readinessSummary: readiness,
    logs: simulation.logs,
    primaryDomain: target.settings.primaryDomain,
    environmentKey: target.settings.environmentKey,
    exportFileName: release.exportFileName,
    startedAt,
    completedAt,
    createdAt: startedAt,
    updatedAt: completedAt,
  };

  store.deployHandoffRuns.unshift(handoffRun);
  await writeLocalStore(store);

  await appendDeployAuditEvent({
    id: `audit-deploy-handoff-run-${handoffRun.id}`,
    projectId: handoffRun.projectId,
    workspaceId: handoffRun.workspaceId,
    source: "deploy",
    kind: "deploy_handoff_run",
    title:
      handoffRun.status === "completed"
        ? "Hosting adapter simulation completed"
        : handoffRun.status === "blocked"
          ? "Hosting adapter simulation blocked"
          : "Hosting adapter simulation failed",
    summary: handoffRun.summary,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "deploy_handoff_run",
    entityId: handoffRun.id,
    linkedTab: "plan",
    linkContext: run
      ? buildHandoffRunAuditLinkContext({
          run,
          releaseId: release.id,
          handoffRunId: handoffRun.id,
        })
      : {
          tab: "plan",
          releaseId: release.id,
          handoffRunId: handoffRun.id,
        },
    metadata: {
      status: handoffRun.status,
      adapterPresetKey: handoffRun.adapterPresetKey,
      adapterKey: handoffRun.adapterKey,
      blockingCount: readiness.blockingCount,
      warningCount: readiness.warningCount,
      exportFileName: handoffRun.exportFileName,
      primaryDomain: handoffRun.primaryDomain,
      environmentKey: handoffRun.environmentKey,
    },
    occurredAt: completedAt,
  });

  return handoffRun;
}

async function executeDeployReleaseHandoffSimulationSupabase(
  input: ExecuteDeployReleaseHandoffSimulationInput,
) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data: releaseRow, error: releaseError } = await client
    .from("project_deploy_releases")
    .select("*")
    .eq("id", input.releaseId)
    .single();

  if (releaseError) {
    throw new Error(releaseError.message);
  }

  const release = mapDeployReleaseRow(releaseRow as Record<string, unknown>);
  const [{ data: runRow, error: runError }, { data: targetRow, error: targetError }, { data: artifactRows, error: artifactError }] =
    await Promise.all([
      client.from("project_deploy_runs").select("*").eq("id", release.deployRunId).maybeSingle(),
      client.from("project_deploy_targets").select("*").eq("id", release.deployTargetId).single(),
      client
        .from("project_deploy_artifacts")
        .select("*")
        .eq("deploy_run_id", release.deployRunId)
        .order("created_at", { ascending: true }),
    ]);

  if (runError) {
    throw new Error(runError.message);
  }
  if (targetError) {
    throw new Error(targetError.message);
  }
  if (artifactError) {
    throw new Error(artifactError.message);
  }

  const run = runRow ? mapDeployRunRow(runRow as Record<string, unknown>) : null;
  const target = mapDeployTargetRow(targetRow as Record<string, unknown>);
  const artifacts = sortDeployArtifacts(
    (artifactRows ?? []).map((row) => mapDeployArtifactRow(row as Record<string, unknown>)),
  );
  const startedAt = nowIso();
  const readiness = evaluateDeployReleaseReadiness({
    target,
    release,
    run,
    artifacts,
    checkedAt: startedAt,
  });
  const simulation = buildDeployHandoffSimulationLogs({
    target,
    release,
    run,
    readiness,
    executedAt: startedAt,
  });
  const completedAt = nowIso();
  const handoffRunRow = {
    id: crypto.randomUUID(),
    deploy_target_id: target.id,
    deploy_run_id: release.deployRunId,
    release_id: release.id,
    workspace_id: release.workspaceId,
    project_id: release.projectId,
    source: "hosting_adapter_simulator_v1",
    adapter_preset_key: target.settings.adapterPresetKey,
    adapter_key: target.settings.adapterKey,
    status: simulation.status,
    summary: simulation.summary,
    readiness_summary_json: readiness,
    logs_json: simulation.logs,
    primary_domain: target.settings.primaryDomain,
    environment_key: target.settings.environmentKey,
    export_file_name: release.exportFileName,
    started_at: startedAt,
    completed_at: completedAt,
    created_at: startedAt,
    updated_at: completedAt,
  };

  const { data, error } = await client
    .from("project_deploy_handoff_runs")
    .insert(handoffRunRow)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const handoffRun = mapDeployHandoffRunRow(data as Record<string, unknown>);

  await appendDeployAuditEvent({
    id: `audit-deploy-handoff-run-${handoffRun.id}`,
    projectId: handoffRun.projectId,
    workspaceId: handoffRun.workspaceId,
    source: "deploy",
    kind: "deploy_handoff_run",
    title:
      handoffRun.status === "completed"
        ? "Hosting adapter simulation completed"
        : handoffRun.status === "blocked"
          ? "Hosting adapter simulation blocked"
          : "Hosting adapter simulation failed",
    summary: handoffRun.summary,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "deploy_handoff_run",
    entityId: handoffRun.id,
    linkedTab: "plan",
    linkContext: run
      ? buildHandoffRunAuditLinkContext({
          run,
          releaseId: release.id,
          handoffRunId: handoffRun.id,
        })
      : {
          tab: "plan",
          releaseId: release.id,
          handoffRunId: handoffRun.id,
        },
    metadata: {
      status: handoffRun.status,
      adapterPresetKey: handoffRun.adapterPresetKey,
      adapterKey: handoffRun.adapterKey,
      blockingCount: readiness.blockingCount,
      warningCount: readiness.warningCount,
      exportFileName: handoffRun.exportFileName,
      primaryDomain: handoffRun.primaryDomain,
      environmentKey: handoffRun.environmentKey,
    },
    occurredAt: completedAt,
  });

  return handoffRun;
}

function buildExecutionStatusTransition(input: {
  fromStatus: DeployExecutionRunRecord["status"] | null;
  toStatus: DeployExecutionRunRecord["status"];
  fromProviderStatus: string | null;
  toProviderStatus: string | null;
  summary: string;
  createdAt: string;
}) {
  return {
    id: crypto.randomUUID(),
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    fromProviderStatus: input.fromProviderStatus,
    toProviderStatus: input.toProviderStatus,
    summary: input.summary,
    createdAt: input.createdAt,
  };
}

function buildHostedDeploymentMetadata(input: {
  target: DeployTargetRecord;
  release: DeployReleaseRecord;
  executionRunId: string;
  actualAdapterKey: DeployExecutionRunRecord["actualAdapterKey"];
  providerKey: NonNullable<DeployExecutionRunRecord["providerKey"]>;
  providerLabel: string;
  providerDeploymentId: string | null;
  hostedUrl: string | null;
  hostedInspectionUrl: string | null;
  latestProviderStatus: string | null;
  readyAt: string;
}): HostedDeploymentRecord {
  return {
    providerKey: input.providerKey,
    providerLabel: input.providerLabel,
    requestedAdapterPresetKey: input.target.settings.adapterPresetKey,
    actualAdapterKey: input.actualAdapterKey,
    deployRunId: input.release.deployRunId,
    releaseId: input.release.id,
    executionRunId: input.executionRunId,
    providerDeploymentId: input.providerDeploymentId,
    hostedUrl: input.hostedUrl,
    hostedInspectionUrl: input.hostedInspectionUrl,
    primaryDomain: input.target.settings.primaryDomain,
    environmentKey: input.target.settings.environmentKey,
    providerStatus: input.latestProviderStatus,
    readyAt: input.readyAt,
    updatedAt: input.readyAt,
  };
}

function nextExecutionAttemptNumber(
  releaseExecutionRuns: DeployExecutionRunRecord[],
  retrySource: DeployExecutionRunRecord | null,
) {
  const highestAttempt = Math.max(0, ...releaseExecutionRuns.map((run) => run.attemptNumber));

  if (retrySource) {
    return Math.max(highestAttempt, retrySource.attemptNumber) + 1;
  }

  return highestAttempt + 1;
}

function maybeUpdateLocalHostedMetadata(input: {
  store: Awaited<ReturnType<typeof readLocalStore>>;
  targetId: string;
  releaseId: string;
  executionRunId: string;
  executionRunStatus: DeployExecutionRunRecord["status"];
  hostedDeployment: HostedDeploymentRecord | null;
  updatedAt: string;
}) {
  const targetIndex = input.store.deployTargets.findIndex((entry) => entry.id === input.targetId);
  if (targetIndex !== -1) {
    const current = input.store.deployTargets[targetIndex];
    const shouldReplaceHosted =
      input.hostedDeployment &&
      (!current.hostedDeployment || current.hostedDeployment.updatedAt <= input.hostedDeployment.updatedAt);

    input.store.deployTargets[targetIndex] = {
      ...current,
      latestExecutionRunId: input.executionRunId,
      latestExecutionRunStatus: input.executionRunStatus,
      hostedDeployment: shouldReplaceHosted ? input.hostedDeployment : current.hostedDeployment,
      updatedAt: input.updatedAt,
    };
  }

  const releaseIndex = input.store.deployReleases.findIndex((entry) => entry.id === input.releaseId);
  if (releaseIndex !== -1) {
    const current = input.store.deployReleases[releaseIndex];
    const shouldReplaceHosted =
      input.hostedDeployment &&
      (!current.hostedDeployment || current.hostedDeployment.updatedAt <= input.hostedDeployment.updatedAt);

    input.store.deployReleases[releaseIndex] = {
      ...current,
      latestExecutionRunId: input.executionRunId,
      latestExecutionStatus: input.executionRunStatus,
      hostedDeployment: shouldReplaceHosted ? input.hostedDeployment : current.hostedDeployment,
      updatedAt: input.updatedAt,
    };
  }
}

async function maybeUpdateSupabaseHostedMetadata(input: {
  client: ReturnType<typeof createSupabaseServerClient>;
  target: DeployTargetRecord;
  release: DeployReleaseRecord;
  executionRunId: string;
  executionRunStatus: DeployExecutionRunRecord["status"];
  hostedDeployment: HostedDeploymentRecord | null;
  updatedAt: string;
}) {
  const client = input.client;

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const nextTargetHostedDeployment =
    input.hostedDeployment &&
    (!input.target.hostedDeployment ||
      input.target.hostedDeployment.updatedAt <= input.hostedDeployment.updatedAt)
      ? input.hostedDeployment
      : input.target.hostedDeployment;

  const nextReleaseHostedDeployment =
    input.hostedDeployment &&
    (!input.release.hostedDeployment ||
      input.release.hostedDeployment.updatedAt <= input.hostedDeployment.updatedAt)
      ? input.hostedDeployment
      : input.release.hostedDeployment;

  const [{ error: targetError }, { error: releaseError }] = await Promise.all([
    client
      .from("project_deploy_targets")
      .update({
        latest_execution_run_id: input.executionRunId,
        latest_execution_run_status: input.executionRunStatus,
        hosted_metadata_json: nextTargetHostedDeployment,
        updated_at: input.updatedAt,
      })
      .eq("id", input.target.id),
    client
      .from("project_deploy_releases")
      .update({
        latest_execution_run_id: input.executionRunId,
        latest_execution_status: input.executionRunStatus,
        hosted_metadata_json: nextReleaseHostedDeployment,
        updated_at: input.updatedAt,
      })
      .eq("id", input.release.id),
  ]);

  if (targetError) {
    throw new Error(targetError.message);
  }

  if (releaseError) {
    throw new Error(releaseError.message);
  }
}

async function executeDeployReleaseLocal(
  input: ExecuteDeployReleaseInput,
  retrySourceExecutionRunId: string | null = null,
) {
  const store = await readLocalStore();
  const release = store.deployReleases.find((entry) => entry.id === input.releaseId) ?? null;

  if (!release) {
    throw new Error("Deploy release not found.");
  }

  const run = store.deployRuns.find((entry) => entry.id === release.deployRunId) ?? null;
  const target = store.deployTargets.find((entry) => entry.id === release.deployTargetId) ?? null;

  if (!run || !target) {
    throw new Error("Deploy release context is incomplete.");
  }

  const releaseExecutionRuns = store.deployExecutionRuns.filter((entry) => entry.releaseId === release.id);
  const retrySource = retrySourceExecutionRunId
    ? releaseExecutionRuns.find((entry) => entry.id === retrySourceExecutionRunId) ?? null
    : null;

  if (retrySourceExecutionRunId && !retrySource) {
    throw new Error("The selected execution run could not be retried.");
  }

  if (retrySource && retrySource.status !== "submitted" && retrySource.status !== "failed") {
    throw new Error("Only submitted or failed execution runs can be retried.");
  }

  const artifacts = sortDeployArtifacts(
    store.deployArtifacts.filter((artifact) => artifact.deployRunId === release.deployRunId),
  );
  const startedAt = nowIso();
  const readiness = evaluateDeployReleaseExecutionReadiness({
    target,
    release,
    run,
    artifacts,
    checkedAt: startedAt,
  });
  const execution =
    readiness.isReady
      ? await executeDeployReleaseWithHostingAdapter({
          target,
          release,
          run,
          artifacts,
        })
      : {
          source:
            target.settings.adapterPresetKey === "vercel_nextjs"
              ? ("vercel_deploy_api_v1" as const)
              : ("unsupported_hosting_adapter_v1" as const),
          requestedAdapterKey: target.settings.adapterKey,
          actualAdapterKey:
            target.settings.adapterPresetKey === "vercel_nextjs"
              ? ("vercel_deploy_api_v1" as const)
              : ("unsupported_hosting_adapter_v1" as const),
          providerKey:
            target.settings.adapterPresetKey === "vercel_nextjs" ? ("vercel" as const) : null,
          providerLabel: target.settings.adapterPresetKey === "vercel_nextjs" ? "Vercel" : null,
          status: "blocked" as const,
          summary: `Hosting execution is blocked by ${readiness.blockingCount} readiness issue(s).`,
          logs: [
            {
              id: crypto.randomUUID(),
              level: "warning" as const,
              message: "Real hosting execution is blocked until the readiness issues are resolved.",
              metadata: {
                blockingCount: readiness.blockingCount,
                warningCount: readiness.warningCount,
              },
              createdAt: startedAt,
            },
          ],
          providerResponse: null,
          latestProviderStatus: null,
          hostedUrl: null,
          hostedInspectionUrl: null,
          providerDeploymentId: null,
          errorMessage: "Resolve the readiness blockers before running a real hosting execution.",
        };
  const updatedAt = nowIso();
  const completedAt = execution.status === "submitted" ? null : updatedAt;
  const executionRunId = crypto.randomUUID();
  const hostedDeployment =
    execution.status === "ready" && execution.providerKey && execution.providerLabel
      ? buildHostedDeploymentMetadata({
          target,
          release,
          executionRunId,
          actualAdapterKey: execution.actualAdapterKey,
          providerKey: execution.providerKey,
          providerLabel: execution.providerLabel,
          providerDeploymentId: execution.providerDeploymentId,
          hostedUrl: execution.hostedUrl,
          hostedInspectionUrl: execution.hostedInspectionUrl,
          latestProviderStatus: execution.latestProviderStatus,
          readyAt: updatedAt,
        })
      : null;

  const executionRun: DeployExecutionRunRecord = {
    id: executionRunId,
    deployTargetId: target.id,
    deployRunId: release.deployRunId,
    releaseId: release.id,
    workspaceId: release.workspaceId,
    projectId: release.projectId,
    requestedAdapterPresetKey: target.settings.adapterPresetKey,
    requestedAdapterKey: execution.requestedAdapterKey,
    actualAdapterKey: execution.actualAdapterKey,
    providerKey: execution.providerKey,
    providerLabel: execution.providerLabel,
    status: execution.status,
    summary: execution.summary,
    readinessSummary: readiness,
    logs: execution.logs,
    statusTransitions: [
      buildExecutionStatusTransition({
        fromStatus: null,
        toStatus: execution.status,
        fromProviderStatus: null,
        toProviderStatus: execution.latestProviderStatus,
        summary: execution.summary,
        createdAt: updatedAt,
      }),
    ],
    providerResponse: execution.providerResponse,
    latestProviderStatus: execution.latestProviderStatus,
    hostedUrl: execution.hostedUrl,
    hostedInspectionUrl: execution.hostedInspectionUrl,
    providerDeploymentId: execution.providerDeploymentId,
    primaryDomain: target.settings.primaryDomain,
    environmentKey: target.settings.environmentKey,
    lastCheckedAt: updatedAt,
    retryOfExecutionRunId: retrySource?.id ?? null,
    attemptNumber: nextExecutionAttemptNumber(releaseExecutionRuns, retrySource),
    errorMessage: execution.errorMessage,
    startedAt,
    completedAt,
    createdAt: startedAt,
    updatedAt,
  };

  store.deployExecutionRuns.unshift(executionRun);
  maybeUpdateLocalHostedMetadata({
    store,
    targetId: target.id,
    releaseId: release.id,
    executionRunId: executionRun.id,
    executionRunStatus: executionRun.status,
    hostedDeployment,
    updatedAt,
  });
  await writeLocalStore(store);

  await appendDeployAuditEvent({
    id: `audit-deploy-execution-run-${executionRun.id}`,
    projectId: executionRun.projectId,
    workspaceId: executionRun.workspaceId,
    source: "deploy",
    kind: retrySource ? "deploy_execution_retried" : "deploy_execution_run",
    title: retrySource
      ? "Hosting execution retried"
      : executionRun.status === "ready"
        ? "Hosting execution completed"
        : executionRun.status === "submitted"
          ? "Hosting execution submitted"
          : executionRun.status === "blocked"
            ? "Hosting execution blocked"
            : "Hosting execution failed",
    summary: executionRun.summary,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "deploy_execution_run",
    entityId: executionRun.id,
    linkedTab: "plan",
    linkContext: buildExecutionRunAuditLinkContext({
      run,
      releaseId: release.id,
      executionRunId: executionRun.id,
    }),
    metadata: {
      status: executionRun.status,
      requestedAdapterKey: executionRun.requestedAdapterKey,
      actualAdapterKey: executionRun.actualAdapterKey,
      providerKey: executionRun.providerKey,
      providerDeploymentId: executionRun.providerDeploymentId,
      hostedUrl: executionRun.hostedUrl,
      primaryDomain: executionRun.primaryDomain,
      environmentKey: executionRun.environmentKey,
      blockingCount: readiness.blockingCount,
      warningCount: readiness.warningCount,
      retryOfExecutionRunId: executionRun.retryOfExecutionRunId,
      attemptNumber: executionRun.attemptNumber,
      latestProviderStatus: executionRun.latestProviderStatus,
      errorMessage: executionRun.errorMessage,
    },
    occurredAt: updatedAt,
  });

  return executionRun;
}

async function executeDeployReleaseSupabase(
  input: ExecuteDeployReleaseInput,
  retrySourceExecutionRunId: string | null = null,
) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data: releaseRow, error: releaseError } = await client
    .from("project_deploy_releases")
    .select("*")
    .eq("id", input.releaseId)
    .single();

  if (releaseError) {
    throw new Error(releaseError.message);
  }

  const release = mapDeployReleaseRow(releaseRow as Record<string, unknown>);
  const [
    { data: runRow, error: runError },
    { data: targetRow, error: targetError },
    { data: artifactRows, error: artifactError },
    { data: existingExecutionRows, error: existingExecutionError },
  ] = await Promise.all([
    client.from("project_deploy_runs").select("*").eq("id", release.deployRunId).single(),
    client.from("project_deploy_targets").select("*").eq("id", release.deployTargetId).single(),
    client
      .from("project_deploy_artifacts")
      .select("*")
      .eq("deploy_run_id", release.deployRunId)
      .order("created_at", { ascending: true }),
    client
      .from("project_deploy_execution_runs")
      .select("*")
      .eq("release_id", release.id)
      .order("started_at", { ascending: false }),
  ]);

  if (runError) {
    throw new Error(runError.message);
  }
  if (targetError) {
    throw new Error(targetError.message);
  }
  if (artifactError) {
    throw new Error(artifactError.message);
  }
  if (existingExecutionError) {
    throw new Error(existingExecutionError.message);
  }

  const run = mapDeployRunRow(runRow as Record<string, unknown>);
  const target = mapDeployTargetRow(targetRow as Record<string, unknown>);
  const artifacts = sortDeployArtifacts(
    (artifactRows ?? []).map((row) => mapDeployArtifactRow(row as Record<string, unknown>)),
  );
  const releaseExecutionRuns = sortDeployExecutionRuns(
    (existingExecutionRows ?? []).map((row) => mapDeployExecutionRunRow(row as Record<string, unknown>)),
  );
  const retrySource = retrySourceExecutionRunId
    ? releaseExecutionRuns.find((entry) => entry.id === retrySourceExecutionRunId) ?? null
    : null;

  if (retrySourceExecutionRunId && !retrySource) {
    throw new Error("The selected execution run could not be retried.");
  }

  if (retrySource && retrySource.status !== "submitted" && retrySource.status !== "failed") {
    throw new Error("Only submitted or failed execution runs can be retried.");
  }

  const startedAt = nowIso();
  const readiness = evaluateDeployReleaseExecutionReadiness({
    target,
    release,
    run,
    artifacts,
    checkedAt: startedAt,
  });
  const execution =
    readiness.isReady
      ? await executeDeployReleaseWithHostingAdapter({
          target,
          release,
          run,
          artifacts,
        })
      : {
          source:
            target.settings.adapterPresetKey === "vercel_nextjs"
              ? ("vercel_deploy_api_v1" as const)
              : ("unsupported_hosting_adapter_v1" as const),
          requestedAdapterKey: target.settings.adapterKey,
          actualAdapterKey:
            target.settings.adapterPresetKey === "vercel_nextjs"
              ? ("vercel_deploy_api_v1" as const)
              : ("unsupported_hosting_adapter_v1" as const),
          providerKey:
            target.settings.adapterPresetKey === "vercel_nextjs" ? ("vercel" as const) : null,
          providerLabel: target.settings.adapterPresetKey === "vercel_nextjs" ? "Vercel" : null,
          status: "blocked" as const,
          summary: `Hosting execution is blocked by ${readiness.blockingCount} readiness issue(s).`,
          logs: [
            {
              id: crypto.randomUUID(),
              level: "warning" as const,
              message: "Real hosting execution is blocked until the readiness issues are resolved.",
              metadata: {
                blockingCount: readiness.blockingCount,
                warningCount: readiness.warningCount,
              },
              createdAt: startedAt,
            },
          ],
          providerResponse: null,
          latestProviderStatus: null,
          hostedUrl: null,
          hostedInspectionUrl: null,
          providerDeploymentId: null,
          errorMessage: "Resolve the readiness blockers before running a real hosting execution.",
        };
  const updatedAt = nowIso();
  const completedAt = execution.status === "submitted" ? null : updatedAt;
  const executionRunId = crypto.randomUUID();
  const hostedDeployment =
    execution.status === "ready" && execution.providerKey && execution.providerLabel
      ? buildHostedDeploymentMetadata({
          target,
          release,
          executionRunId,
          actualAdapterKey: execution.actualAdapterKey,
          providerKey: execution.providerKey,
          providerLabel: execution.providerLabel,
          providerDeploymentId: execution.providerDeploymentId,
          hostedUrl: execution.hostedUrl,
          hostedInspectionUrl: execution.hostedInspectionUrl,
          latestProviderStatus: execution.latestProviderStatus,
          readyAt: updatedAt,
        })
      : null;

  const executionRunRow = {
    id: executionRunId,
    deploy_target_id: target.id,
    deploy_run_id: release.deployRunId,
    release_id: release.id,
    workspace_id: release.workspaceId,
    project_id: release.projectId,
    requested_adapter_preset_key: target.settings.adapterPresetKey,
    requested_adapter_key: execution.requestedAdapterKey,
    actual_adapter_key: execution.actualAdapterKey,
    provider_key: execution.providerKey,
    provider_label: execution.providerLabel,
    status: execution.status,
    summary: execution.summary,
    readiness_summary_json: readiness,
    logs_json: execution.logs,
    status_transitions_json: [
      buildExecutionStatusTransition({
        fromStatus: null,
        toStatus: execution.status,
        fromProviderStatus: null,
        toProviderStatus: execution.latestProviderStatus,
        summary: execution.summary,
        createdAt: updatedAt,
      }),
    ],
    provider_response_json: execution.providerResponse,
    latest_provider_status: execution.latestProviderStatus,
    hosted_url: execution.hostedUrl,
    hosted_inspection_url: execution.hostedInspectionUrl,
    provider_deployment_id: execution.providerDeploymentId,
    primary_domain: target.settings.primaryDomain,
    environment_key: target.settings.environmentKey,
    last_checked_at: updatedAt,
    retry_of_execution_run_id: retrySource?.id ?? null,
    attempt_number: nextExecutionAttemptNumber(releaseExecutionRuns, retrySource),
    error_message: execution.errorMessage,
    started_at: startedAt,
    completed_at: completedAt,
    created_at: startedAt,
    updated_at: updatedAt,
  };

  const { data, error } = await client
    .from("project_deploy_execution_runs")
    .insert(executionRunRow)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await maybeUpdateSupabaseHostedMetadata({
    client,
    target,
    release,
    executionRunId,
    executionRunStatus: executionRunRow.status,
    hostedDeployment,
    updatedAt,
  });

  const executionRun = mapDeployExecutionRunRow(data as Record<string, unknown>);

  await appendDeployAuditEvent({
    id: `audit-deploy-execution-run-${executionRun.id}`,
    projectId: executionRun.projectId,
    workspaceId: executionRun.workspaceId,
    source: "deploy",
    kind: retrySource ? "deploy_execution_retried" : "deploy_execution_run",
    title: retrySource
      ? "Hosting execution retried"
      : executionRun.status === "ready"
        ? "Hosting execution completed"
        : executionRun.status === "submitted"
          ? "Hosting execution submitted"
          : executionRun.status === "blocked"
            ? "Hosting execution blocked"
            : "Hosting execution failed",
    summary: executionRun.summary,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "deploy_execution_run",
    entityId: executionRun.id,
    linkedTab: "plan",
    linkContext: buildExecutionRunAuditLinkContext({
      run,
      releaseId: release.id,
      executionRunId: executionRun.id,
    }),
    metadata: {
      status: executionRun.status,
      requestedAdapterKey: executionRun.requestedAdapterKey,
      actualAdapterKey: executionRun.actualAdapterKey,
      providerKey: executionRun.providerKey,
      providerDeploymentId: executionRun.providerDeploymentId,
      hostedUrl: executionRun.hostedUrl,
      primaryDomain: executionRun.primaryDomain,
      environmentKey: executionRun.environmentKey,
      blockingCount: readiness.blockingCount,
      warningCount: readiness.warningCount,
      retryOfExecutionRunId: executionRun.retryOfExecutionRunId,
      attemptNumber: executionRun.attemptNumber,
      latestProviderStatus: executionRun.latestProviderStatus,
      errorMessage: executionRun.errorMessage,
    },
    occurredAt: updatedAt,
  });

  return executionRun;
}

async function recheckDeployExecutionRunLocal(input: RecheckDeployExecutionRunInput) {
  const store = await readLocalStore();
  const executionRunIndex = store.deployExecutionRuns.findIndex((entry) => entry.id === input.executionRunId);

  if (executionRunIndex === -1) {
    throw new Error("Execution run not found.");
  }

  const executionRun = store.deployExecutionRuns[executionRunIndex];

  if (executionRun.status !== "submitted") {
    throw new Error("Only submitted execution runs can be rechecked.");
  }

  const release = store.deployReleases.find((entry) => entry.id === executionRun.releaseId) ?? null;
  const run = store.deployRuns.find((entry) => entry.id === executionRun.deployRunId) ?? null;
  const target = store.deployTargets.find((entry) => entry.id === executionRun.deployTargetId) ?? null;

  if (!release || !run || !target) {
    throw new Error("Execution run context is incomplete.");
  }

  const artifacts = sortDeployArtifacts(
    store.deployArtifacts.filter((artifact) => artifact.deployRunId === executionRun.deployRunId),
  );
  const checkedAt = nowIso();
  const readiness = evaluateDeployReleaseExecutionReadiness({
    target,
    release,
    run,
    artifacts,
    checkedAt,
  });
  const result = await recheckDeployExecutionWithHostingAdapter({
    target,
    release,
    run,
    executionRun,
  });
  const updatedAt = nowIso();
  const nextStatusTransitions = executionRun.statusTransitions.concat(
    buildExecutionStatusTransition({
      fromStatus: executionRun.status,
      toStatus: result.status,
      fromProviderStatus: executionRun.latestProviderStatus,
      toProviderStatus: result.latestProviderStatus,
      summary: result.summary,
      createdAt: updatedAt,
    }),
  );

  const hostedDeployment =
    result.status === "ready" && result.providerKey && result.providerLabel
      ? buildHostedDeploymentMetadata({
          target,
          release,
          executionRunId: executionRun.id,
          actualAdapterKey: result.actualAdapterKey,
          providerKey: result.providerKey,
          providerLabel: result.providerLabel,
          providerDeploymentId: result.providerDeploymentId,
          hostedUrl: result.hostedUrl,
          hostedInspectionUrl: result.hostedInspectionUrl,
          latestProviderStatus: result.latestProviderStatus,
          readyAt: updatedAt,
        })
      : null;

  const nextExecutionRun: DeployExecutionRunRecord = {
    ...executionRun,
    status: result.status,
    summary: result.summary,
    readinessSummary: readiness,
    logs: executionRun.logs.concat(result.logs),
    statusTransitions: nextStatusTransitions,
    providerResponse: result.providerResponse ?? executionRun.providerResponse,
    latestProviderStatus: result.latestProviderStatus ?? executionRun.latestProviderStatus,
    hostedUrl: result.hostedUrl ?? executionRun.hostedUrl,
    hostedInspectionUrl: result.hostedInspectionUrl ?? executionRun.hostedInspectionUrl,
    providerDeploymentId: result.providerDeploymentId ?? executionRun.providerDeploymentId,
    lastCheckedAt: updatedAt,
    errorMessage: result.errorMessage,
    completedAt: result.status === "submitted" ? null : updatedAt,
    updatedAt,
  };

  store.deployExecutionRuns[executionRunIndex] = nextExecutionRun;
  maybeUpdateLocalHostedMetadata({
    store,
    targetId: target.id,
    releaseId: release.id,
    executionRunId: nextExecutionRun.id,
    executionRunStatus: nextExecutionRun.status,
    hostedDeployment,
    updatedAt,
  });
  await writeLocalStore(store);

  await appendDeployAuditEvent({
    id: `audit-deploy-execution-recheck-${nextExecutionRun.id}-${updatedAt}`,
    projectId: nextExecutionRun.projectId,
    workspaceId: nextExecutionRun.workspaceId,
    source: "deploy",
    kind: "deploy_execution_rechecked",
    title: "Hosting execution rechecked",
    summary: nextExecutionRun.summary,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "deploy_execution_run",
    entityId: nextExecutionRun.id,
    linkedTab: "plan",
    linkContext: buildExecutionRunAuditLinkContext({
      run,
      releaseId: release.id,
      executionRunId: nextExecutionRun.id,
    }),
    metadata: {
      status: nextExecutionRun.status,
      previousStatus: executionRun.status,
      latestProviderStatus: nextExecutionRun.latestProviderStatus,
      providerDeploymentId: nextExecutionRun.providerDeploymentId,
      hostedUrl: nextExecutionRun.hostedUrl,
      blockingCount: readiness.blockingCount,
      warningCount: readiness.warningCount,
      errorMessage: nextExecutionRun.errorMessage,
    },
    occurredAt: updatedAt,
  });

  return nextExecutionRun;
}

async function recheckDeployExecutionRunSupabase(input: RecheckDeployExecutionRunInput) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data: executionRow, error: executionError } = await client
    .from("project_deploy_execution_runs")
    .select("*")
    .eq("id", input.executionRunId)
    .single();

  if (executionError) {
    throw new Error(executionError.message);
  }

  const executionRun = mapDeployExecutionRunRow(executionRow as Record<string, unknown>);

  if (executionRun.status !== "submitted") {
    throw new Error("Only submitted execution runs can be rechecked.");
  }

  const [
    { data: releaseRow, error: releaseError },
    { data: runRow, error: runError },
    { data: targetRow, error: targetError },
    { data: artifactRows, error: artifactError },
  ] = await Promise.all([
    client.from("project_deploy_releases").select("*").eq("id", executionRun.releaseId).single(),
    client.from("project_deploy_runs").select("*").eq("id", executionRun.deployRunId).single(),
    client.from("project_deploy_targets").select("*").eq("id", executionRun.deployTargetId).single(),
    client
      .from("project_deploy_artifacts")
      .select("*")
      .eq("deploy_run_id", executionRun.deployRunId)
      .order("created_at", { ascending: true }),
  ]);

  if (releaseError) {
    throw new Error(releaseError.message);
  }
  if (runError) {
    throw new Error(runError.message);
  }
  if (targetError) {
    throw new Error(targetError.message);
  }
  if (artifactError) {
    throw new Error(artifactError.message);
  }

  const release = mapDeployReleaseRow(releaseRow as Record<string, unknown>);
  const run = mapDeployRunRow(runRow as Record<string, unknown>);
  const target = mapDeployTargetRow(targetRow as Record<string, unknown>);
  const artifacts = sortDeployArtifacts(
    (artifactRows ?? []).map((row) => mapDeployArtifactRow(row as Record<string, unknown>)),
  );
  const checkedAt = nowIso();
  const readiness = evaluateDeployReleaseExecutionReadiness({
    target,
    release,
    run,
    artifacts,
    checkedAt,
  });
  const result = await recheckDeployExecutionWithHostingAdapter({
    target,
    release,
    run,
    executionRun,
  });
  const updatedAt = nowIso();
  const nextStatusTransitions = executionRun.statusTransitions.concat(
    buildExecutionStatusTransition({
      fromStatus: executionRun.status,
      toStatus: result.status,
      fromProviderStatus: executionRun.latestProviderStatus,
      toProviderStatus: result.latestProviderStatus,
      summary: result.summary,
      createdAt: updatedAt,
    }),
  );

  const hostedDeployment =
    result.status === "ready" && result.providerKey && result.providerLabel
      ? buildHostedDeploymentMetadata({
          target,
          release,
          executionRunId: executionRun.id,
          actualAdapterKey: result.actualAdapterKey,
          providerKey: result.providerKey,
          providerLabel: result.providerLabel,
          providerDeploymentId: result.providerDeploymentId,
          hostedUrl: result.hostedUrl,
          hostedInspectionUrl: result.hostedInspectionUrl,
          latestProviderStatus: result.latestProviderStatus,
          readyAt: updatedAt,
        })
      : null;

  const { data, error } = await client
    .from("project_deploy_execution_runs")
    .update({
      status: result.status,
      summary: result.summary,
      readiness_summary_json: readiness,
      logs_json: executionRun.logs.concat(result.logs),
      status_transitions_json: nextStatusTransitions,
      provider_response_json: result.providerResponse ?? executionRun.providerResponse,
      latest_provider_status: result.latestProviderStatus ?? executionRun.latestProviderStatus,
      hosted_url: result.hostedUrl ?? executionRun.hostedUrl,
      hosted_inspection_url: result.hostedInspectionUrl ?? executionRun.hostedInspectionUrl,
      provider_deployment_id: result.providerDeploymentId ?? executionRun.providerDeploymentId,
      last_checked_at: updatedAt,
      error_message: result.errorMessage,
      completed_at: result.status === "submitted" ? null : updatedAt,
      updated_at: updatedAt,
    })
    .eq("id", executionRun.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await maybeUpdateSupabaseHostedMetadata({
    client,
    target,
    release,
    executionRunId: executionRun.id,
    executionRunStatus: result.status,
    hostedDeployment,
    updatedAt,
  });

  const nextExecutionRun = mapDeployExecutionRunRow(data as Record<string, unknown>);

  await appendDeployAuditEvent({
    id: `audit-deploy-execution-recheck-${nextExecutionRun.id}-${updatedAt}`,
    projectId: nextExecutionRun.projectId,
    workspaceId: nextExecutionRun.workspaceId,
    source: "deploy",
    kind: "deploy_execution_rechecked",
    title: "Hosting execution rechecked",
    summary: nextExecutionRun.summary,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "deploy_execution_run",
    entityId: nextExecutionRun.id,
    linkedTab: "plan",
    linkContext: buildExecutionRunAuditLinkContext({
      run,
      releaseId: release.id,
      executionRunId: nextExecutionRun.id,
    }),
    metadata: {
      status: nextExecutionRun.status,
      previousStatus: executionRun.status,
      latestProviderStatus: nextExecutionRun.latestProviderStatus,
      providerDeploymentId: nextExecutionRun.providerDeploymentId,
      hostedUrl: nextExecutionRun.hostedUrl,
      blockingCount: readiness.blockingCount,
      warningCount: readiness.warningCount,
      errorMessage: nextExecutionRun.errorMessage,
    },
    occurredAt: updatedAt,
  });

  return nextExecutionRun;
}

async function retryDeployExecutionRunLocal(input: RetryDeployExecutionRunInput) {
  const store = await readLocalStore();
  const executionRun = store.deployExecutionRuns.find((entry) => entry.id === input.executionRunId) ?? null;

  if (!executionRun) {
    throw new Error("Execution run not found.");
  }

  if (executionRun.status !== "submitted" && executionRun.status !== "failed") {
    throw new Error("Only submitted or failed execution runs can be retried.");
  }

  return executeDeployReleaseLocal({ releaseId: executionRun.releaseId }, executionRun.id);
}

async function retryDeployExecutionRunSupabase(input: RetryDeployExecutionRunInput) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await client
    .from("project_deploy_execution_runs")
    .select("*")
    .eq("id", input.executionRunId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const executionRun = mapDeployExecutionRunRow(data as Record<string, unknown>);

  if (executionRun.status !== "submitted" && executionRun.status !== "failed") {
    throw new Error("Only submitted or failed execution runs can be retried.");
  }

  return executeDeployReleaseSupabase({ releaseId: executionRun.releaseId }, executionRun.id);
}

async function promoteDeployReleaseLocal(input: PromoteDeployReleaseInput) {
  const store = await readLocalStore();
  const run = store.deployRuns.find((entry) => entry.id === input.deployRunId) ?? null;

  if (!run) {
    throw new Error("Deploy run not found.");
  }

  if (run.status !== "completed") {
    throw new Error("Only completed deploy runs can be promoted into releases.");
  }

  if (store.deployReleases.some((release) => release.deployRunId === input.deployRunId)) {
    throw new Error("This deploy run has already been promoted into a named release.");
  }

  const timestamp = nowIso();
  const nextReleaseNumber =
    Math.max(0, ...store.deployReleases.filter((release) => release.projectId === input.projectId).map((release) => release.releaseNumber)) + 1;
  const release: DeployReleaseRecord = {
    id: crypto.randomUUID(),
    deployTargetId: input.deployTargetId,
    deployRunId: input.deployRunId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    releaseNumber: nextReleaseNumber,
    name: input.name,
    notes: input.notes,
    status: "promoted",
    sourcePlanRevisionId: run.sourcePlanRevisionId,
    sourcePlanRevisionNumber: run.sourcePlanRevisionNumber,
    sourceVisualRevisionNumber: run.sourceVisualRevisionNumber,
    sourceCodeRevisionNumber: run.sourceCodeRevisionNumber,
    sourceGenerationRunId: run.sourceGenerationRunId,
    runtimeSource: run.runtimeSource,
    promotedByUserId: input.promotedByUserId,
    handoffPayload: null,
    exportSnapshot: null,
    exportFileName: null,
    handoffPreparedAt: null,
    exportedAt: null,
    latestExecutionRunId: null,
    latestExecutionStatus: null,
    hostedDeployment: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.deployReleases.unshift(release);
  const targetIndex = store.deployTargets.findIndex((target) => target.id === input.deployTargetId);

  if (targetIndex !== -1) {
    store.deployTargets[targetIndex] = {
      ...store.deployTargets[targetIndex],
      latestReleaseId: release.id,
      latestReleaseName: release.name,
      latestReleaseNumber: release.releaseNumber,
      updatedAt: timestamp,
    };
  }

  await writeLocalStore(store);

  await appendDeployAuditEvent({
    id: `audit-deploy-release-${release.id}`,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    source: "deploy",
    kind: "deploy_release_promoted",
    title: "Deploy release promoted",
    summary: `Release ${release.name} was promoted from deploy run ${run.id}.`,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "deploy_release",
    entityId: release.id,
    linkedTab: "plan",
    linkContext: {
      tab: "plan",
      deployRunId: run.id,
      releaseId: release.id,
      planRevisionId: run.sourcePlanRevisionId,
      planRevisionNumber: run.sourcePlanRevisionNumber,
    },
    metadata: {
      releaseName: release.name,
      releaseNumber: release.releaseNumber,
      deployRunId: run.id,
      sourceVisualRevisionNumber: run.sourceVisualRevisionNumber,
      sourceCodeRevisionNumber: run.sourceCodeRevisionNumber,
      sourceGenerationRunId: run.sourceGenerationRunId,
      runtimeSource: run.runtimeSource,
    },
    occurredAt: timestamp,
  });

  return release;
}

async function promoteDeployReleaseSupabase(input: PromoteDeployReleaseInput) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data: runRow, error: runError } = await client
    .from("project_deploy_runs")
    .select("*")
    .eq("id", input.deployRunId)
    .single();

  if (runError) {
    throw new Error(runError.message);
  }

  const run = mapDeployRunRow(runRow as Record<string, unknown>);

  if (run.status !== "completed") {
    throw new Error("Only completed deploy runs can be promoted into releases.");
  }

  const { data: existingRelease, error: existingError } = await client
    .from("project_deploy_releases")
    .select("id")
    .eq("deploy_run_id", input.deployRunId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingRelease) {
    throw new Error("This deploy run has already been promoted into a named release.");
  }

  const { data: latestReleaseRow } = await client
    .from("project_deploy_releases")
    .select("release_number")
    .eq("project_id", input.projectId)
    .order("release_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const timestamp = nowIso();
  const nextReleaseNumber =
    typeof latestReleaseRow?.release_number === "number" ? latestReleaseRow.release_number + 1 : 1;
  const releaseId = crypto.randomUUID();
  const releaseRow = {
    id: releaseId,
    deploy_target_id: input.deployTargetId,
    deploy_run_id: input.deployRunId,
    workspace_id: input.workspaceId,
    project_id: input.projectId,
    release_number: nextReleaseNumber,
    name: input.name,
    notes: input.notes,
    status: "promoted",
    source_plan_revision_id: run.sourcePlanRevisionId,
    source_plan_revision_number: run.sourcePlanRevisionNumber,
    source_visual_revision_number: run.sourceVisualRevisionNumber,
    source_code_revision_number: run.sourceCodeRevisionNumber,
    source_generation_run_id: run.sourceGenerationRunId,
    runtime_source: run.runtimeSource,
    promoted_by_user_id: input.promotedByUserId,
    handoff_payload_json: null,
    export_snapshot_json: null,
    export_file_name: null,
    handoff_prepared_at: null,
    exported_at: null,
    latest_execution_run_id: null,
    latest_execution_status: null,
    hosted_metadata_json: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const { data, error } = await client
    .from("project_deploy_releases")
    .insert(releaseRow)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const release = mapDeployReleaseRow(data as Record<string, unknown>);

  const { error: targetError } = await client
    .from("project_deploy_targets")
    .update({
      latest_release_id: release.id,
      latest_release_name: release.name,
      latest_release_number: release.releaseNumber,
      updated_at: timestamp,
    })
    .eq("id", input.deployTargetId);

  if (targetError) {
    throw new Error(targetError.message);
  }

  await appendDeployAuditEvent({
    id: `audit-deploy-release-${release.id}`,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    source: "deploy",
    kind: "deploy_release_promoted",
    title: "Deploy release promoted",
    summary: `Release ${release.name} was promoted from deploy run ${run.id}.`,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "deploy_release",
    entityId: release.id,
    linkedTab: "plan",
    linkContext: {
      tab: "plan",
      deployRunId: run.id,
      releaseId: release.id,
      planRevisionId: run.sourcePlanRevisionId,
      planRevisionNumber: run.sourcePlanRevisionNumber,
    },
    metadata: {
      releaseName: release.name,
      releaseNumber: release.releaseNumber,
      deployRunId: run.id,
      sourceVisualRevisionNumber: run.sourceVisualRevisionNumber,
      sourceCodeRevisionNumber: run.sourceCodeRevisionNumber,
      sourceGenerationRunId: run.sourceGenerationRunId,
      runtimeSource: run.runtimeSource,
    },
    occurredAt: timestamp,
  });

  return release;
}

function buildAcceptedState(input: {
  approvedRevisionId: string | null;
  approvedRevisionNumber: number | null;
  visualRevisionNumber: number | null;
  codeRevisionNumber: number | null;
  runtimeSource: ProjectDeployAcceptedStateRecord["runtimeSource"];
  generationRunId: string | null;
  routeCount: number;
  pageCount: number;
  sectionCount: number;
  fileCount: number;
  themeTokenCount: number;
  pendingQueueCount: number;
  deferredQueueCount: number;
  staleQueueCount: number;
  completedQueueCount: number;
}): ProjectDeployAcceptedStateRecord {
  const surfacesBehindApproved: Array<"visual" | "code"> = [];

  if (
    input.approvedRevisionNumber !== null &&
    input.visualRevisionNumber !== null &&
    input.visualRevisionNumber < input.approvedRevisionNumber
  ) {
    surfacesBehindApproved.push("visual");
  }

  if (
    input.approvedRevisionNumber !== null &&
    input.codeRevisionNumber !== null &&
    input.codeRevisionNumber < input.approvedRevisionNumber
  ) {
    surfacesBehindApproved.push("code");
  }

  return {
    approvedPlanRevisionId: input.approvedRevisionId,
    approvedPlanRevisionNumber: input.approvedRevisionNumber,
    visualRevisionNumber: input.visualRevisionNumber,
    codeRevisionNumber: input.codeRevisionNumber,
    runtimeSource: input.runtimeSource,
    generationRunId: input.generationRunId,
    routeCount: input.routeCount,
    pageCount: input.pageCount,
    sectionCount: input.sectionCount,
    fileCount: input.fileCount,
    themeTokenCount: input.themeTokenCount,
    pendingQueueCount: input.pendingQueueCount,
    deferredQueueCount: input.deferredQueueCount,
    staleQueueCount: input.staleQueueCount,
    completedQueueCount: input.completedQueueCount,
    surfacesBehindApproved,
    readyToPublish:
      input.approvedRevisionNumber !== null &&
      input.visualRevisionNumber !== null &&
      input.codeRevisionNumber !== null,
  };
}

export async function recordProjectDeployRun(input: DeployRunPersistenceInput) {
  if (isSupabaseConfigured()) {
    return recordDeployRunSupabase(input);
  }

  return recordDeployRunLocal(input);
}

export async function updateProjectDeployTargetSettings(input: UpdateDeployTargetSettingsInput) {
  if (isSupabaseConfigured()) {
    return updateDeployTargetSettingsSupabase(input);
  }

  return updateDeployTargetSettingsLocal(input);
}

export async function applyProjectDeployTargetPreset(input: ApplyDeployTargetPresetInput) {
  if (isSupabaseConfigured()) {
    return applyDeployTargetPresetSupabase(input);
  }

  return applyDeployTargetPresetLocal(input);
}

export async function promoteProjectDeployRelease(input: PromoteDeployReleaseInput) {
  if (isSupabaseConfigured()) {
    return promoteDeployReleaseSupabase(input);
  }

  return promoteDeployReleaseLocal(input);
}

export async function prepareProjectDeployReleaseHandoff(input: PrepareDeployReleaseHandoffInput) {
  if (isSupabaseConfigured()) {
    return prepareDeployReleaseHandoffSupabase(input);
  }

  return prepareDeployReleaseHandoffLocal(input);
}

export async function exportProjectDeployReleaseSnapshot(input: ExportDeployReleaseInput) {
  if (isSupabaseConfigured()) {
    return exportDeployReleaseSnapshotSupabase(input);
  }

  return exportDeployReleaseSnapshotLocal(input);
}

export async function executeProjectDeployReleaseHandoffSimulation(
  input: ExecuteDeployReleaseHandoffSimulationInput,
) {
  if (isSupabaseConfigured()) {
    return executeDeployReleaseHandoffSimulationSupabase(input);
  }

  return executeDeployReleaseHandoffSimulationLocal(input);
}

export async function executeProjectDeployRelease(input: ExecuteDeployReleaseInput) {
  if (isSupabaseConfigured()) {
    return executeDeployReleaseSupabase(input);
  }

  return executeDeployReleaseLocal(input);
}

export async function recheckProjectDeployExecutionRun(input: RecheckDeployExecutionRunInput) {
  if (isSupabaseConfigured()) {
    return recheckDeployExecutionRunSupabase(input);
  }

  return recheckDeployExecutionRunLocal(input);
}

export async function retryProjectDeployExecutionRun(input: RetryDeployExecutionRunInput) {
  if (isSupabaseConfigured()) {
    return retryDeployExecutionRunSupabase(input);
  }

  return retryDeployExecutionRunLocal(input);
}

export async function getProjectDeployBundle(
  workspaceSlug: string,
  projectSlug: string,
): Promise<ProjectDeployBundle | null> {
  const planBundle = await getProjectPlanBundle(workspaceSlug, projectSlug);

  if (!planBundle) {
    return null;
  }

  const [visualBundle, generationBundle, queueItems] = await Promise.all([
    getProjectVisualBundle(workspaceSlug, projectSlug),
    getProjectGenerationBundle(workspaceSlug, projectSlug),
    listProjectBuilderRefreshQueue(workspaceSlug, projectSlug),
  ]);
  const codeBundle = await getProjectCodeBundle(workspaceSlug, projectSlug);

  const target = isSupabaseConfigured()
    ? await ensureProjectDeployTargetSupabase({
        workspaceId: planBundle.workspace.id,
        projectId: planBundle.project.id,
        projectName: planBundle.project.name,
      })
    : await ensureProjectDeployTargetLocal({
        workspaceId: planBundle.workspace.id,
        projectId: planBundle.project.id,
        projectName: planBundle.project.name,
      });
  const [runs, artifacts, releases, handoffRuns, executionRuns] = await Promise.all([
    isSupabaseConfigured()
      ? listProjectDeployRunsSupabase(planBundle.project.id)
      : listProjectDeployRunsLocal(planBundle.project.id),
    isSupabaseConfigured()
      ? listProjectDeployArtifactsSupabase(planBundle.project.id)
      : listProjectDeployArtifactsLocal(planBundle.project.id),
    isSupabaseConfigured()
      ? listProjectDeployReleasesSupabase(planBundle.project.id)
      : listProjectDeployReleasesLocal(planBundle.project.id),
    isSupabaseConfigured()
      ? listProjectDeployHandoffRunsSupabase(planBundle.project.id)
      : listProjectDeployHandoffRunsLocal(planBundle.project.id),
    isSupabaseConfigured()
      ? listProjectDeployExecutionRunsSupabase(planBundle.project.id)
      : listProjectDeployExecutionRunsLocal(planBundle.project.id),
  ]);

  const latestRun = runs[0] ?? null;
  const latestArtifacts = latestRun
    ? artifacts.filter((artifact) => artifact.deployRunId === latestRun.id)
    : [];
  const latestRelease = releases[0] ?? null;
  const latestHandoffRun = handoffRuns[0] ?? null;
  const latestExecutionRun = executionRuns[0] ?? null;
  const approvedRevision = planBundle.revisions.find((revision) => revision.state === "approved") ?? null;
  const runtimeBundle =
    visualBundle && codeBundle
      ? buildRuntimePreviewBundle({
          locale: planBundle.project.primaryLocale,
          visualBundle,
          codeBundle,
          generationBundle,
        })
      : null;
  const acceptedState = buildAcceptedState({
    approvedRevisionId: approvedRevision?.id ?? null,
    approvedRevisionNumber: approvedRevision?.revisionNumber ?? null,
    visualRevisionNumber: visualBundle?.visualState.scaffoldSourceRevisionNumber ?? null,
    codeRevisionNumber: codeBundle?.codeState.scaffoldSourceRevisionNumber ?? null,
    runtimeSource: runtimeBundle?.source ?? "unavailable",
    generationRunId: runtimeBundle?.generationRun?.id ?? null,
    routeCount: runtimeBundle?.routes.length ?? 0,
    pageCount: visualBundle?.visualPages.length ?? 0,
    sectionCount: visualBundle?.visualSections.length ?? 0,
    fileCount: codeBundle?.files.length ?? 0,
    themeTokenCount: runtimeBundle ? Object.keys(runtimeBundle.themeTokens).length : 0,
    pendingQueueCount: queueItems.filter((item) => item.status === "pending").length,
    deferredQueueCount: queueItems.filter((item) => item.status === "deferred").length,
    staleQueueCount: queueItems.filter((item) => item.status === "stale").length,
    completedQueueCount: queueItems.filter((item) => item.status === "completed").length,
  });

  return {
    workspace: planBundle.workspace,
    project: planBundle.project,
    latestRevision: planBundle.revisions[0],
    currentUser: planBundle.currentUser,
    membership: planBundle.membership,
    workspacePermissions: planBundle.workspacePermissions,
    projectPermissions: planBundle.projectPermissions,
    revisions: planBundle.revisions,
    target,
    runs,
    artifacts,
    releases,
    handoffRuns,
    executionRuns,
    latestRun,
    latestArtifacts,
    latestRelease,
    latestHandoffRun,
    latestExecutionRun,
    acceptedState,
  };
}
