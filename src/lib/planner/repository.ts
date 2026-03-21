import { appendProjectAuditEvent } from "@/lib/builder/audit-repository";
import { isSupabaseConfigured } from "@/lib/env";
import { readLocalStore, writeLocalStore } from "@/lib/workspaces/local-store";
import { getProjectPlanBundle } from "@/lib/workspaces/repository";
import { createSupabaseServerClient } from "@/lib/workspaces/supabase";

import type {
  PlannerArtifactRecord,
  PlannerRunPersistenceInput,
  PlannerRunRecord,
  ProjectPlannerBundle,
} from "@/lib/planner/types";

function sortPlannerRuns(runs: PlannerRunRecord[]) {
  return [...runs].sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

function sortPlannerArtifacts(artifacts: PlannerArtifactRecord[]) {
  return [...artifacts].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function mapPlannerRunRow(row: Record<string, unknown>): PlannerRunRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    workspaceId: String(row.workspace_id),
    briefId: row.brief_id ? String(row.brief_id) : null,
    briefUpdatedAt: row.brief_updated_at ? String(row.brief_updated_at) : null,
    source: row.source as PlannerRunRecord["source"],
    trigger: row.trigger as PlannerRunRecord["trigger"],
    status: row.status as PlannerRunRecord["status"],
    summary: String(row.summary),
    inputSnapshot: (row.input_snapshot as PlannerRunRecord["inputSnapshot"]) ?? {},
    outputPlan: (row.output_plan as PlannerRunRecord["outputPlan"]) ?? null,
    generatedPlanRevisionId: row.generated_plan_revision_id
      ? String(row.generated_plan_revision_id)
      : null,
    generatedPlanRevisionNumber:
      typeof row.generated_plan_revision_number === "number"
        ? row.generated_plan_revision_number
        : row.generated_plan_revision_number
          ? Number(row.generated_plan_revision_number)
          : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapPlannerArtifactRow(row: Record<string, unknown>): PlannerArtifactRecord {
  return {
    id: String(row.id),
    plannerRunId: String(row.planner_run_id),
    projectId: String(row.project_id),
    workspaceId: String(row.workspace_id),
    artifactType: row.artifact_type as PlannerArtifactRecord["artifactType"],
    label: String(row.label),
    payload: (row.payload_json as PlannerArtifactRecord["payload"]) ?? {},
    createdAt: String(row.created_at),
  };
}

async function recordPlannerRunLocal(input: PlannerRunPersistenceInput) {
  const store = await readLocalStore();
  const timestamp = input.completedAt ?? input.startedAt;
  const runId = crypto.randomUUID();
  const run: PlannerRunRecord = {
    id: runId,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    briefId: input.briefId ?? null,
    briefUpdatedAt: input.briefUpdatedAt ?? null,
    source: input.source,
    trigger: input.trigger,
    status: input.status,
    summary: input.summary,
    inputSnapshot: input.inputSnapshot,
    outputPlan: input.outputPlan,
    generatedPlanRevisionId: input.generatedPlanRevisionId ?? null,
    generatedPlanRevisionNumber: input.generatedPlanRevisionNumber ?? null,
    errorMessage: input.errorMessage ?? null,
    startedAt: input.startedAt,
    completedAt: input.completedAt ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const artifacts: PlannerArtifactRecord[] = input.artifacts.map((artifact) => ({
    id: crypto.randomUUID(),
    plannerRunId: runId,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    artifactType: artifact.artifactType,
    label: artifact.label,
    payload: artifact.payload,
    createdAt: timestamp,
  }));

  store.plannerRuns.unshift(run);
  store.plannerArtifacts.unshift(...artifacts);
  await writeLocalStore(store);

  await appendProjectAuditEvent({
    id: `audit-planner-run-${run.id}`,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    source: "plan",
    kind: "planner_run",
    title:
      input.status === "completed"
        ? "Planner run completed"
        : "Planner run failed",
    summary: input.summary,
    actorType: input.status === "completed" ? "assistant" : "system",
    actorLabel: input.source,
    entityType: "planner_run",
    entityId: run.id,
    linkedTab: "plan",
    linkContext: {
      tab: "plan",
      plannerRunId: run.id,
      briefId: input.briefId ?? null,
      planRevisionId: input.generatedPlanRevisionId ?? null,
      planRevisionNumber: input.generatedPlanRevisionNumber ?? null,
    },
    metadata: {
      status: input.status,
      trigger: input.trigger,
      source: input.source,
      briefUpdatedAt: input.briefUpdatedAt ?? null,
      artifactCount: artifacts.length,
      errorMessage: input.errorMessage ?? null,
    },
    occurredAt: timestamp,
  });

  return {
    run,
    artifacts,
  };
}

async function recordPlannerRunSupabase(input: PlannerRunPersistenceInput) {
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
    brief_id: input.briefId ?? null,
    brief_updated_at: input.briefUpdatedAt ?? null,
    source: input.source,
    trigger: input.trigger,
    status: input.status,
    summary: input.summary,
    input_snapshot: input.inputSnapshot,
    output_plan: input.outputPlan,
    generated_plan_revision_id: input.generatedPlanRevisionId ?? null,
    generated_plan_revision_number: input.generatedPlanRevisionNumber ?? null,
    error_message: input.errorMessage ?? null,
    started_at: input.startedAt,
    completed_at: input.completedAt ?? null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const { data: insertedRun, error: runError } = await client
    .from("project_planner_runs")
    .insert(runRow)
    .select("*")
    .single();

  if (runError) {
    throw new Error(runError.message);
  }

  const artifactRows = input.artifacts.map((artifact) => ({
    id: crypto.randomUUID(),
    planner_run_id: runId,
    project_id: input.projectId,
    workspace_id: input.workspaceId,
    artifact_type: artifact.artifactType,
    label: artifact.label,
    payload_json: artifact.payload,
    created_at: timestamp,
  }));

  if (artifactRows.length > 0) {
    const { error: artifactError } = await client.from("project_planner_artifacts").insert(artifactRows);

    if (artifactError) {
      throw new Error(artifactError.message);
    }
  }

  await appendProjectAuditEvent({
    id: `audit-planner-run-${runId}`,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    source: "plan",
    kind: "planner_run",
    title:
      input.status === "completed"
        ? "Planner run completed"
        : "Planner run failed",
    summary: input.summary,
    actorType: input.status === "completed" ? "assistant" : "system",
    actorLabel: input.source,
    entityType: "planner_run",
    entityId: runId,
    linkedTab: "plan",
    linkContext: {
      tab: "plan",
      plannerRunId: runId,
      briefId: input.briefId ?? null,
      planRevisionId: input.generatedPlanRevisionId ?? null,
      planRevisionNumber: input.generatedPlanRevisionNumber ?? null,
    },
    metadata: {
      status: input.status,
      trigger: input.trigger,
      source: input.source,
      briefUpdatedAt: input.briefUpdatedAt ?? null,
      artifactCount: input.artifacts.length,
      errorMessage: input.errorMessage ?? null,
    },
    occurredAt: timestamp,
  });

  return {
    run: mapPlannerRunRow(insertedRun as Record<string, unknown>),
    artifacts: artifactRows.map((row) =>
      mapPlannerArtifactRow({
        ...row,
        payload_json: row.payload_json,
      }),
    ),
  };
}

export async function recordProjectPlannerRun(input: PlannerRunPersistenceInput) {
  if (isSupabaseConfigured()) {
    return recordPlannerRunSupabase(input);
  }

  return recordPlannerRunLocal(input);
}

async function listProjectPlannerRunsLocal(projectId: string) {
  const store = await readLocalStore();
  return sortPlannerRuns(store.plannerRuns.filter((run) => run.projectId === projectId));
}

async function listProjectPlannerArtifactsLocal(projectId: string) {
  const store = await readLocalStore();
  return sortPlannerArtifacts(store.plannerArtifacts.filter((artifact) => artifact.projectId === projectId));
}

async function listProjectPlannerRunsSupabase(projectId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("project_planner_runs")
    .select("*")
    .eq("project_id", projectId)
    .order("started_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapPlannerRunRow(row as Record<string, unknown>));
}

async function listProjectPlannerArtifactsSupabase(projectId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("project_planner_artifacts")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapPlannerArtifactRow(row as Record<string, unknown>));
}

export async function getProjectPlannerBundle(
  workspaceSlug: string,
  projectSlug: string,
): Promise<ProjectPlannerBundle | null> {
  const bundle = await getProjectPlanBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    return null;
  }

  const [runs, artifacts] = await Promise.all([
    isSupabaseConfigured()
      ? listProjectPlannerRunsSupabase(bundle.project.id)
      : listProjectPlannerRunsLocal(bundle.project.id),
    isSupabaseConfigured()
      ? listProjectPlannerArtifactsSupabase(bundle.project.id)
      : listProjectPlannerArtifactsLocal(bundle.project.id),
  ]);
  const latestRun = runs[0] ?? null;

  return {
    runs,
    artifacts,
    latestRun,
    latestArtifacts: latestRun
      ? artifacts.filter((artifact) => artifact.plannerRunId === latestRun.id)
      : [],
  };
}
