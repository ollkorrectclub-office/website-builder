import { appendProjectAuditEvent } from "@/lib/builder/audit-repository";
import { isSupabaseConfigured } from "@/lib/env";
import { buildProjectGenerationTargetBundle } from "@/lib/generation/targets";
import { readLocalStore, writeLocalStore } from "@/lib/workspaces/local-store";
import { getProjectPlanBundle } from "@/lib/workspaces/repository";
import { createSupabaseServerClient } from "@/lib/workspaces/supabase";

import type {
  GenerationArtifactRecord,
  GenerationRunPersistenceInput,
  GenerationRunRecord,
  ProjectGenerationBundle,
  ProjectGenerationTargetBundle,
} from "@/lib/generation/types";

function emptyStructuredPlan(): GenerationRunRecord["sourcePlanSnapshot"] {
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

function sortGenerationRuns(runs: GenerationRunRecord[]) {
  return [...runs].sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

function sortGenerationArtifacts(artifacts: GenerationArtifactRecord[]) {
  return [...artifacts].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function mapGenerationRunRow(row: Record<string, unknown>): GenerationRunRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    workspaceId: String(row.workspace_id),
    sourcePlanRevisionId: String(row.source_plan_revision_id),
    sourcePlanRevisionNumber:
      typeof row.source_plan_revision_number === "number"
        ? row.source_plan_revision_number
        : Number(row.source_plan_revision_number ?? 1),
    sourcePlanSnapshot:
      (row.source_plan_snapshot as GenerationRunRecord["sourcePlanSnapshot"]) ?? emptyStructuredPlan(),
    source: row.source as GenerationRunRecord["source"],
    trigger: row.trigger as GenerationRunRecord["trigger"],
    status: row.status as GenerationRunRecord["status"],
    summary: String(row.summary ?? ""),
    outputSummary: (row.output_summary as GenerationRunRecord["outputSummary"]) ?? null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapGenerationArtifactRow(row: Record<string, unknown>): GenerationArtifactRecord {
  return {
    id: String(row.id),
    generationRunId: String(row.generation_run_id),
    projectId: String(row.project_id),
    workspaceId: String(row.workspace_id),
    artifactType: row.artifact_type as GenerationArtifactRecord["artifactType"],
    label: String(row.label),
    payload: (row.payload_json as GenerationArtifactRecord["payload"]) ?? {},
    createdAt: String(row.created_at),
  };
}

async function recordGenerationRunLocal(input: GenerationRunPersistenceInput) {
  const store = await readLocalStore();
  const timestamp = input.completedAt ?? input.startedAt;
  const runId = crypto.randomUUID();
  const run: GenerationRunRecord = {
    id: runId,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    sourcePlanRevisionId: input.sourcePlanRevisionId,
    sourcePlanRevisionNumber: input.sourcePlanRevisionNumber,
    sourcePlanSnapshot: input.sourcePlanSnapshot,
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
  const artifacts: GenerationArtifactRecord[] = input.artifacts.map((artifact) => ({
    id: crypto.randomUUID(),
    generationRunId: runId,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    artifactType: artifact.artifactType,
    label: artifact.label,
    payload: artifact.payload,
    createdAt: timestamp,
  }));

  store.generationRuns.unshift(run);
  store.generationArtifacts.unshift(...artifacts);
  await writeLocalStore(store);

  await appendProjectAuditEvent({
    id: `audit-generation-run-${run.id}`,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    source: "plan",
    kind: "generation_run",
    title:
      input.status === "completed"
        ? `Generation run completed for approved revision ${input.sourcePlanRevisionNumber}`
        : "Generation run failed",
    summary: input.summary,
    actorType: input.status === "completed" ? "assistant" : "system",
    actorLabel: input.source,
    entityType: "generation_run",
    entityId: run.id,
    linkedTab: "plan",
    linkContext: {
      tab: "plan",
      planRevisionId: input.sourcePlanRevisionId,
      planRevisionNumber: input.sourcePlanRevisionNumber,
      generationRunId: run.id,
    },
    metadata: {
      status: input.status,
      trigger: input.trigger,
      source: input.source,
      artifactCount: artifacts.length,
      outputSummary: input.outputSummary,
      errorMessage: input.errorMessage ?? null,
    },
    occurredAt: timestamp,
  });

  return {
    run,
    artifacts,
  };
}

async function recordGenerationRunSupabase(input: GenerationRunPersistenceInput) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const runId = crypto.randomUUID();
  const timestamp = input.completedAt ?? input.startedAt;
  const runRow = {
    id: runId,
    project_id: input.projectId,
    workspace_id: input.workspaceId,
    source_plan_revision_id: input.sourcePlanRevisionId,
    source_plan_revision_number: input.sourcePlanRevisionNumber,
    source_plan_snapshot: input.sourcePlanSnapshot,
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
    .from("project_generation_runs")
    .insert(runRow)
    .select("*")
    .single();

  if (runError) {
    throw new Error(runError.message);
  }

  const artifactRows = input.artifacts.map((artifact) => ({
    id: crypto.randomUUID(),
    generation_run_id: runId,
    project_id: input.projectId,
    workspace_id: input.workspaceId,
    artifact_type: artifact.artifactType,
    label: artifact.label,
    payload_json: artifact.payload,
    created_at: timestamp,
  }));

  if (artifactRows.length > 0) {
    const { error: artifactError } = await client.from("project_generation_artifacts").insert(artifactRows);

    if (artifactError) {
      throw new Error(artifactError.message);
    }
  }

  await appendProjectAuditEvent({
    id: `audit-generation-run-${runId}`,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    source: "plan",
    kind: "generation_run",
    title:
      input.status === "completed"
        ? `Generation run completed for approved revision ${input.sourcePlanRevisionNumber}`
        : "Generation run failed",
    summary: input.summary,
    actorType: input.status === "completed" ? "assistant" : "system",
    actorLabel: input.source,
    entityType: "generation_run",
    entityId: runId,
    linkedTab: "plan",
    linkContext: {
      tab: "plan",
      planRevisionId: input.sourcePlanRevisionId,
      planRevisionNumber: input.sourcePlanRevisionNumber,
      generationRunId: runId,
    },
    metadata: {
      status: input.status,
      trigger: input.trigger,
      source: input.source,
      artifactCount: input.artifacts.length,
      outputSummary: input.outputSummary,
      errorMessage: input.errorMessage ?? null,
    },
    occurredAt: timestamp,
  });

  return {
    run: mapGenerationRunRow(insertedRun as Record<string, unknown>),
    artifacts: artifactRows.map((row) =>
      mapGenerationArtifactRow({
        ...row,
        payload_json: row.payload_json,
      }),
    ),
  };
}

export async function recordProjectGenerationRun(input: GenerationRunPersistenceInput) {
  if (isSupabaseConfigured()) {
    return recordGenerationRunSupabase(input);
  }

  return recordGenerationRunLocal(input);
}

async function listProjectGenerationRunsLocal(projectId: string) {
  const store = await readLocalStore();
  return sortGenerationRuns(store.generationRuns.filter((run) => run.projectId === projectId));
}

async function listProjectGenerationArtifactsLocal(projectId: string) {
  const store = await readLocalStore();
  return sortGenerationArtifacts(store.generationArtifacts.filter((artifact) => artifact.projectId === projectId));
}

async function listProjectGenerationRunsSupabase(projectId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("project_generation_runs")
    .select("*")
    .eq("project_id", projectId)
    .order("started_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapGenerationRunRow(row as Record<string, unknown>));
}

async function listProjectGenerationArtifactsSupabase(projectId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("project_generation_artifacts")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapGenerationArtifactRow(row as Record<string, unknown>));
}

export async function getProjectGenerationBundle(
  workspaceSlug: string,
  projectSlug: string,
): Promise<ProjectGenerationBundle | null> {
  const bundle = await getProjectPlanBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    return null;
  }

  const [runs, artifacts] = await Promise.all([
    isSupabaseConfigured()
      ? listProjectGenerationRunsSupabase(bundle.project.id)
      : listProjectGenerationRunsLocal(bundle.project.id),
    isSupabaseConfigured()
      ? listProjectGenerationArtifactsSupabase(bundle.project.id)
      : listProjectGenerationArtifactsLocal(bundle.project.id),
  ]);
  const latestRun = runs[0] ?? null;
  const latestArtifacts = latestRun
    ? artifacts.filter((artifact) => artifact.generationRunId === latestRun.id)
    : [];

  return {
    runs,
    artifacts,
    latestRun,
    latestArtifacts,
  };
}

export async function getProjectGenerationTargetBundle(
  workspaceSlug: string,
  projectSlug: string,
  generationRunId: string,
): Promise<ProjectGenerationTargetBundle | null> {
  const bundle = await getProjectGenerationBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    return null;
  }

  const run = bundle.runs.find((item) => item.id === generationRunId) ?? null;

  if (!run) {
    return null;
  }

  return buildProjectGenerationTargetBundle({
    run,
    artifacts: bundle.artifacts.filter((artifact) => artifact.generationRunId === run.id),
  });
}
