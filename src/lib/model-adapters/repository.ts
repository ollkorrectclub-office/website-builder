import { appendProjectAuditEvent } from "@/lib/builder/audit-repository";
import { isSupabaseConfigured } from "@/lib/env";
import {
  buildModelAdapterHealthByCapability,
  latestOperationalRunByCapability,
  latestVerificationRunByCapability,
} from "@/lib/model-adapters/health";
import { defaultProjectModelAdapterConfig } from "@/lib/model-adapters/registry";
import type {
  ModelAdapterCapability,
  ModelAdapterRunPersistenceInput,
  ModelAdapterRunRecord,
  ProjectModelAdapterBundle,
  ProjectModelAdapterConfigRecord,
  SaveProjectModelAdapterConfigInput,
} from "@/lib/model-adapters/types";
import { readLocalStore, writeLocalStore } from "@/lib/workspaces/local-store";
import { getProjectPlanBundle } from "@/lib/workspaces/repository";
import { createSupabaseServerClient } from "@/lib/workspaces/supabase";

function sortModelAdapterRuns(runs: ModelAdapterRunRecord[]) {
  return [...runs].sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

function nextAttemptNumber(runs: ModelAdapterRunRecord[], retryOfRunId: string | null | undefined) {
  if (!retryOfRunId) {
    return 1;
  }

  const retrySource = runs.find((run) => run.id === retryOfRunId) ?? null;

  if (retrySource) {
    return Math.max(1, retrySource.attemptNumber) + 1;
  }

  return 2;
}

function mapModelAdapterConfigRow(row: Record<string, unknown>): ProjectModelAdapterConfigRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    projectId: String(row.project_id),
    planningSelection: row.planning_selection as ProjectModelAdapterConfigRecord["planningSelection"],
    generationSelection: row.generation_selection as ProjectModelAdapterConfigRecord["generationSelection"],
    patchSelection: row.patch_selection as ProjectModelAdapterConfigRecord["patchSelection"],
    externalProviderKey:
      row.external_provider_key === "openai_compatible" || row.external_provider_key === "custom_http"
        ? row.external_provider_key
        : null,
    externalProviderLabel: row.external_provider_label ? String(row.external_provider_label) : null,
    externalEndpointUrl: row.external_endpoint_url ? String(row.external_endpoint_url) : null,
    externalApiKeyEnvVar: row.external_api_key_env_var ? String(row.external_api_key_env_var) : null,
    planningModel: row.planning_model ? String(row.planning_model) : null,
    generationModel: row.generation_model ? String(row.generation_model) : null,
    patchModel: row.patch_model ? String(row.patch_model) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapModelAdapterRunRow(row: Record<string, unknown>): ModelAdapterRunRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    projectId: String(row.project_id),
    capability: row.capability as ModelAdapterCapability,
    requestedSelection: row.requested_selection as ModelAdapterRunRecord["requestedSelection"],
    executedSelection: row.executed_selection as ModelAdapterRunRecord["executedSelection"],
    sourceType: row.source_type as ModelAdapterRunRecord["sourceType"],
    executionMode: row.execution_mode as ModelAdapterRunRecord["executionMode"],
    requestedAdapterKey: String(row.requested_adapter_key),
    executedAdapterKey: String(row.executed_adapter_key),
    providerKey:
      row.provider_key === "openai_compatible" || row.provider_key === "custom_http"
        ? row.provider_key
        : null,
    providerLabel: row.provider_label ? String(row.provider_label) : null,
    modelName: row.model_name ? String(row.model_name) : null,
    endpointUrl: row.endpoint_url ? String(row.endpoint_url) : null,
    latencyMs:
      typeof row.latency_ms === "number"
        ? row.latency_ms
        : row.latency_ms
          ? Number(row.latency_ms)
          : null,
    trace:
      (row.trace_json as ModelAdapterRunRecord["trace"]) ??
      ((row.trace as ModelAdapterRunRecord["trace"]) ?? null),
    fallbackReason: row.fallback_reason ? String(row.fallback_reason) : null,
    summary: String(row.summary ?? ""),
    metadata: (row.metadata_json as ModelAdapterRunRecord["metadata"]) ?? {},
    status: row.status as ModelAdapterRunRecord["status"],
    trigger: String(row.trigger ?? ""),
    linkedEntityType:
      row.linked_entity_type === "planner_run" ||
      row.linked_entity_type === "generation_run" ||
      row.linked_entity_type === "patch_proposal"
        ? row.linked_entity_type
        : null,
    linkedEntityId: row.linked_entity_id ? String(row.linked_entity_id) : null,
    retryOfRunId: row.retry_of_run_id ? String(row.retry_of_run_id) : null,
    attemptNumber:
      typeof row.attempt_number === "number"
        ? row.attempt_number
        : row.attempt_number
          ? Number(row.attempt_number)
          : 1,
    errorMessage: row.error_message ? String(row.error_message) : null,
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function getProjectModelAdapterConfigLocal(projectId: string, workspaceId: string) {
  const store = await readLocalStore();
  return (
    store.modelAdapterConfigs.find((entry) => entry.projectId === projectId) ??
    defaultProjectModelAdapterConfig({ workspaceId, projectId })
  );
}

async function getProjectModelAdapterConfigSupabase(projectId: string, workspaceId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return defaultProjectModelAdapterConfig({ workspaceId, projectId });
  }

  const { data, error } = await client
    .from("project_model_adapter_configs")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data
    ? mapModelAdapterConfigRow(data as Record<string, unknown>)
    : defaultProjectModelAdapterConfig({ workspaceId, projectId });
}

export async function getProjectModelAdapterConfigByIds(projectId: string, workspaceId: string) {
  if (isSupabaseConfigured()) {
    return getProjectModelAdapterConfigSupabase(projectId, workspaceId);
  }

  return getProjectModelAdapterConfigLocal(projectId, workspaceId);
}

async function saveProjectModelAdapterConfigLocal(input: SaveProjectModelAdapterConfigInput) {
  const store = await readLocalStore();
  const timestamp = new Date().toISOString();
  const existing = store.modelAdapterConfigs.find((entry) => entry.projectId === input.projectId) ?? null;
  const record: ProjectModelAdapterConfigRecord = {
    id: existing?.id ?? crypto.randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    planningSelection: input.planningSelection,
    generationSelection: input.generationSelection,
    patchSelection: input.patchSelection,
    externalProviderKey: input.externalProviderKey,
    externalProviderLabel: input.externalProviderLabel,
    externalEndpointUrl: input.externalEndpointUrl,
    externalApiKeyEnvVar: input.externalApiKeyEnvVar,
    planningModel: input.planningModel,
    generationModel: input.generationModel,
    patchModel: input.patchModel,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  store.modelAdapterConfigs = [
    record,
    ...store.modelAdapterConfigs.filter((entry) => entry.projectId !== input.projectId),
  ];
  await writeLocalStore(store);

  await appendProjectAuditEvent({
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    source: "plan",
    kind: "adapter_config_updated",
    title: "Model adapter settings saved",
    summary: "Planning, generation, and patch adapter selections were updated.",
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "model_adapter_config",
    entityId: record.id,
    linkedTab: "plan",
    linkContext: {
      tab: "plan",
    },
    metadata: {
      planningSelection: record.planningSelection,
      generationSelection: record.generationSelection,
      patchSelection: record.patchSelection,
      externalProviderKey: record.externalProviderKey,
      externalEndpointUrl: record.externalEndpointUrl,
    },
    occurredAt: timestamp,
  });

  return record;
}

async function saveProjectModelAdapterConfigSupabase(input: SaveProjectModelAdapterConfigInput) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const existing = await getProjectModelAdapterConfigSupabase(input.projectId, input.workspaceId);
  const timestamp = new Date().toISOString();
  const row = {
    id: existing.id,
    workspace_id: input.workspaceId,
    project_id: input.projectId,
    planning_selection: input.planningSelection,
    generation_selection: input.generationSelection,
    patch_selection: input.patchSelection,
    external_provider_key: input.externalProviderKey,
    external_provider_label: input.externalProviderLabel,
    external_endpoint_url: input.externalEndpointUrl,
    external_api_key_env_var: input.externalApiKeyEnvVar,
    planning_model: input.planningModel,
    generation_model: input.generationModel,
    patch_model: input.patchModel,
    created_at: existing.createdAt,
    updated_at: timestamp,
  };

  const { data, error } = await client
    .from("project_model_adapter_configs")
    .upsert(row)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await appendProjectAuditEvent({
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    source: "plan",
    kind: "adapter_config_updated",
    title: "Model adapter settings saved",
    summary: "Planning, generation, and patch adapter selections were updated.",
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "model_adapter_config",
    entityId: existing.id,
    linkedTab: "plan",
    linkContext: {
      tab: "plan",
    },
    metadata: {
      planningSelection: input.planningSelection,
      generationSelection: input.generationSelection,
      patchSelection: input.patchSelection,
      externalProviderKey: input.externalProviderKey,
      externalEndpointUrl: input.externalEndpointUrl,
    },
    occurredAt: timestamp,
  });

  return mapModelAdapterConfigRow(data as Record<string, unknown>);
}

export async function saveProjectModelAdapterConfig(input: SaveProjectModelAdapterConfigInput) {
  if (isSupabaseConfigured()) {
    return saveProjectModelAdapterConfigSupabase(input);
  }

  return saveProjectModelAdapterConfigLocal(input);
}

async function listProjectModelAdapterRunsLocal(projectId: string) {
  const store = await readLocalStore();
  return sortModelAdapterRuns(store.modelAdapterRuns.filter((entry) => entry.projectId === projectId));
}

async function listProjectModelAdapterRunsSupabase(projectId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("project_model_adapter_runs")
    .select("*")
    .eq("project_id", projectId)
    .order("started_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapModelAdapterRunRow(row as Record<string, unknown>));
}

export async function listProjectModelAdapterRunsByProjectId(projectId: string) {
  if (isSupabaseConfigured()) {
    return listProjectModelAdapterRunsSupabase(projectId);
  }

  return listProjectModelAdapterRunsLocal(projectId);
}

function latestRunByCapability(runs: ModelAdapterRunRecord[]) {
  return latestOperationalRunByCapability(runs);
}

async function recordProjectModelAdapterRunLocal(input: ModelAdapterRunPersistenceInput) {
  const store = await readLocalStore();
  const timestamp = input.completedAt ?? input.startedAt;
  const projectRuns = store.modelAdapterRuns.filter((entry) => entry.projectId === input.projectId);
  const record: ModelAdapterRunRecord = {
    id: input.id ?? crypto.randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    capability: input.capability,
    requestedSelection: input.requestedSelection,
    executedSelection: input.executedSelection,
    sourceType: input.sourceType,
    executionMode: input.executionMode,
    requestedAdapterKey: input.requestedAdapterKey,
    executedAdapterKey: input.executedAdapterKey,
    providerKey: input.providerKey,
    providerLabel: input.providerLabel,
    modelName: input.modelName,
    endpointUrl: input.endpointUrl,
    latencyMs: input.latencyMs ?? null,
    trace: input.trace ?? null,
    fallbackReason: input.fallbackReason,
    summary: input.summary,
    metadata: input.metadata,
    status: input.status,
    trigger: input.trigger,
    linkedEntityType: input.linkedEntityType,
    linkedEntityId: input.linkedEntityId,
    retryOfRunId: input.retryOfRunId ?? null,
    attemptNumber: input.attemptNumber ?? nextAttemptNumber(projectRuns, input.retryOfRunId),
    errorMessage: input.errorMessage ?? null,
    startedAt: input.startedAt,
    completedAt: input.completedAt ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.modelAdapterRuns.unshift(record);
  await writeLocalStore(store);

  await appendProjectAuditEvent({
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    source: input.capability === "patch_suggestion" ? "code" : "plan",
    kind: "model_adapter_run",
    title: `${input.capability.replace("_", " ")} adapter run ${input.status}`,
    summary: input.summary,
    actorType: input.status === "completed" ? "assistant" : "system",
    actorLabel: input.executedAdapterKey,
    entityType: "model_adapter_run",
    entityId: record.id,
    linkedTab: input.capability === "patch_suggestion" ? "code" : "plan",
    linkContext: {
      tab: input.capability === "patch_suggestion" ? "code" : "plan",
      plannerRunId: input.linkedEntityType === "planner_run" ? input.linkedEntityId : null,
      generationRunId: input.linkedEntityType === "generation_run" ? input.linkedEntityId : null,
      proposalId: input.linkedEntityType === "patch_proposal" ? input.linkedEntityId : null,
      filePath:
        input.capability === "patch_suggestion" && typeof input.metadata.filePath === "string"
          ? input.metadata.filePath
          : undefined,
    },
    metadata: {
      capability: input.capability,
      requestedSelection: input.requestedSelection,
      executedSelection: input.executedSelection,
      sourceType: input.sourceType,
      executionMode: input.executionMode,
      requestedAdapterKey: input.requestedAdapterKey,
      executedAdapterKey: input.executedAdapterKey,
      providerKey: input.providerKey,
      providerLabel: input.providerLabel,
      modelName: input.modelName,
      responseId: input.trace?.responseId ?? null,
      responseStatus: input.trace?.responseStatus ?? null,
      latencyMs: input.latencyMs ?? null,
      fallbackReason: input.fallbackReason,
      linkedEntityType: input.linkedEntityType,
      linkedEntityId: input.linkedEntityId,
      status: input.status,
      retryOfRunId: record.retryOfRunId,
      attemptNumber: record.attemptNumber,
      runKind: input.metadata.runKind ?? null,
    },
    occurredAt: timestamp,
  });

  return record;
}

async function recordProjectModelAdapterRunSupabase(input: ModelAdapterRunPersistenceInput) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const timestamp = input.completedAt ?? input.startedAt;
  const projectRuns = await listProjectModelAdapterRunsByProjectId(input.projectId);
  const row = {
    id: input.id ?? crypto.randomUUID(),
    workspace_id: input.workspaceId,
    project_id: input.projectId,
    capability: input.capability,
    requested_selection: input.requestedSelection,
    executed_selection: input.executedSelection,
    source_type: input.sourceType,
    execution_mode: input.executionMode,
    requested_adapter_key: input.requestedAdapterKey,
    executed_adapter_key: input.executedAdapterKey,
    provider_key: input.providerKey,
    provider_label: input.providerLabel,
    model_name: input.modelName,
    endpoint_url: input.endpointUrl,
    latency_ms: input.latencyMs ?? null,
    trace_json: input.trace ?? null,
    fallback_reason: input.fallbackReason,
    summary: input.summary,
    metadata_json: input.metadata,
    status: input.status,
    trigger: input.trigger,
    linked_entity_type: input.linkedEntityType,
    linked_entity_id: input.linkedEntityId,
    retry_of_run_id: input.retryOfRunId ?? null,
    attempt_number: input.attemptNumber ?? nextAttemptNumber(projectRuns, input.retryOfRunId),
    error_message: input.errorMessage ?? null,
    started_at: input.startedAt,
    completed_at: input.completedAt ?? null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const { data, error } = await client
    .from("project_model_adapter_runs")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await appendProjectAuditEvent({
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    source: input.capability === "patch_suggestion" ? "code" : "plan",
    kind: "model_adapter_run",
    title: `${input.capability.replace("_", " ")} adapter run ${input.status}`,
    summary: input.summary,
    actorType: input.status === "completed" ? "assistant" : "system",
    actorLabel: input.executedAdapterKey,
    entityType: "model_adapter_run",
    entityId: row.id,
    linkedTab: input.capability === "patch_suggestion" ? "code" : "plan",
    linkContext: {
      tab: input.capability === "patch_suggestion" ? "code" : "plan",
      plannerRunId: input.linkedEntityType === "planner_run" ? input.linkedEntityId : null,
      generationRunId: input.linkedEntityType === "generation_run" ? input.linkedEntityId : null,
      proposalId: input.linkedEntityType === "patch_proposal" ? input.linkedEntityId : null,
      filePath:
        input.capability === "patch_suggestion" && typeof input.metadata.filePath === "string"
          ? input.metadata.filePath
          : undefined,
    },
    metadata: {
      capability: input.capability,
      requestedSelection: input.requestedSelection,
      executedSelection: input.executedSelection,
      sourceType: input.sourceType,
      executionMode: input.executionMode,
      requestedAdapterKey: input.requestedAdapterKey,
      executedAdapterKey: input.executedAdapterKey,
      providerKey: input.providerKey,
      providerLabel: input.providerLabel,
      modelName: input.modelName,
      responseId: input.trace?.responseId ?? null,
      responseStatus: input.trace?.responseStatus ?? null,
      latencyMs: input.latencyMs ?? null,
      fallbackReason: input.fallbackReason,
      linkedEntityType: input.linkedEntityType,
      linkedEntityId: input.linkedEntityId,
      status: input.status,
      retryOfRunId: row.retry_of_run_id,
      attemptNumber: row.attempt_number,
      runKind: input.metadata.runKind ?? null,
    },
    occurredAt: timestamp,
  });

  return mapModelAdapterRunRow(data as Record<string, unknown>);
}

export async function recordProjectModelAdapterRun(input: ModelAdapterRunPersistenceInput) {
  if (isSupabaseConfigured()) {
    return recordProjectModelAdapterRunSupabase(input);
  }

  return recordProjectModelAdapterRunLocal(input);
}

export async function getProjectModelAdapterBundle(
  workspaceSlug: string,
  projectSlug: string,
): Promise<ProjectModelAdapterBundle | null> {
  const bundle = await getProjectPlanBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    return null;
  }

  const [config, runs] = await Promise.all([
    getProjectModelAdapterConfigByIds(bundle.project.id, bundle.workspace.id),
    listProjectModelAdapterRunsByProjectId(bundle.project.id),
  ]);
  const latestRuns = latestRunByCapability(runs);
  const latestVerificationRuns = latestVerificationRunByCapability(runs);

  return {
    config,
    runs,
    latestRunByCapability: latestRuns,
    latestVerificationRunByCapability: latestVerificationRuns,
    healthByCapability: buildModelAdapterHealthByCapability(config, latestRuns, latestVerificationRuns),
  };
}
