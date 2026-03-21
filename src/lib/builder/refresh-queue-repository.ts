import { appendProjectAuditEvent } from "@/lib/builder/audit-repository";
import type {
  BuilderRefreshSurface,
  CreateProjectBuilderRefreshQueueItemInput,
  ProjectBuilderRefreshQueueItemRecord,
} from "@/lib/builder/types";
import { isSupabaseConfigured } from "@/lib/env";
import { findLatestCompletedGenerationRun } from "@/lib/generation/runs";
import { getProjectGenerationBundle } from "@/lib/generation/repository";
import { readLocalStore, writeLocalStore } from "@/lib/workspaces/local-store";
import { getProjectPlanBundle } from "@/lib/workspaces/repository";
import { createSupabaseServerClient } from "@/lib/workspaces/supabase";

function nowIso() {
  return new Date().toISOString();
}

function statusRank(status: ProjectBuilderRefreshQueueItemRecord["status"]) {
  switch (status) {
    case "pending":
      return 0;
    case "deferred":
      return 1;
    case "stale":
      return 2;
    case "completed":
      return 3;
  }
}

function sortRefreshQueue(items: ProjectBuilderRefreshQueueItemRecord[]) {
  return [...items].sort((left, right) => {
    if (statusRank(left.status) !== statusRank(right.status)) {
      return statusRank(left.status) - statusRank(right.status);
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

function mapRefreshQueueRow(row: Record<string, unknown>): ProjectBuilderRefreshQueueItemRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    projectId: String(row.project_id),
    generationRunId: row.generation_run_id ? String(row.generation_run_id) : null,
    surface: row.surface as ProjectBuilderRefreshQueueItemRecord["surface"],
    status: row.status as ProjectBuilderRefreshQueueItemRecord["status"],
    reason: row.reason as ProjectBuilderRefreshQueueItemRecord["reason"],
    targetPlanRevisionId: row.target_plan_revision_id ? String(row.target_plan_revision_id) : null,
    targetPlanRevisionNumber:
      typeof row.target_plan_revision_number === "number"
        ? row.target_plan_revision_number
        : Number(row.target_plan_revision_number ?? 1),
    pinnedPlanRevisionNumber:
      typeof row.pinned_plan_revision_number === "number"
        ? row.pinned_plan_revision_number
        : row.pinned_plan_revision_number
          ? Number(row.pinned_plan_revision_number)
          : null,
    requiresManualReview: Boolean(row.requires_manual_review),
    summary: String(row.summary ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deferredAt: row.deferred_at ? String(row.deferred_at) : null,
    deferReason: row.defer_reason ? String(row.defer_reason) : null,
    staleAt: row.stale_at ? String(row.stale_at) : null,
    staleReason: row.stale_reason ? String(row.stale_reason) : null,
    supersededByGenerationRunId: row.superseded_by_generation_run_id
      ? String(row.superseded_by_generation_run_id)
      : null,
    supersededByPlanRevisionNumber:
      typeof row.superseded_by_plan_revision_number === "number"
        ? row.superseded_by_plan_revision_number
        : row.superseded_by_plan_revision_number
          ? Number(row.superseded_by_plan_revision_number)
          : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

function queueDeferTitle(surface: BuilderRefreshSurface) {
  return surface === "visual" ? "Visual refresh deferred" : "Code refresh deferred";
}

function queueCompleteTitle(surface: BuilderRefreshSurface) {
  return surface === "visual" ? "Visual refresh completed" : "Code rebase review completed";
}

function queueStaleTitle(surface: BuilderRefreshSurface) {
  return surface === "visual" ? "Visual refresh queue superseded" : "Code refresh queue superseded";
}

function isCurrentQueueItemStatus(status: ProjectBuilderRefreshQueueItemRecord["status"]) {
  return status === "pending" || status === "deferred";
}

async function listRefreshQueueLocal(projectId: string) {
  const store = await readLocalStore();
  return sortRefreshQueue(store.projectBuilderRefreshQueueItems.filter((item) => item.projectId === projectId));
}

async function listRefreshQueueSupabase(projectId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("project_builder_refresh_queue_items")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return sortRefreshQueue((data ?? []).map((row) => mapRefreshQueueRow(row as Record<string, unknown>)));
}

async function enqueueRefreshQueueLocal(items: CreateProjectBuilderRefreshQueueItemInput[]) {
  if (items.length === 0) {
    return [];
  }

  const store = await readLocalStore();
  const timestamp = nowIso();
  const created = items.map<ProjectBuilderRefreshQueueItemRecord>((item) => ({
    id: crypto.randomUUID(),
    workspaceId: item.workspaceId,
    projectId: item.projectId,
    generationRunId: item.generationRunId ?? null,
    surface: item.surface,
    status: "pending",
    reason: item.reason,
    targetPlanRevisionId: item.targetPlanRevisionId,
    targetPlanRevisionNumber: item.targetPlanRevisionNumber,
    pinnedPlanRevisionNumber: item.pinnedPlanRevisionNumber,
    requiresManualReview: item.requiresManualReview,
    summary: item.summary,
    createdAt: timestamp,
    updatedAt: timestamp,
    deferredAt: null,
    deferReason: null,
    staleAt: null,
    staleReason: null,
    supersededByGenerationRunId: null,
    supersededByPlanRevisionNumber: null,
    completedAt: null,
  }));

  store.projectBuilderRefreshQueueItems = [
    ...store.projectBuilderRefreshQueueItems,
    ...created,
  ];
  await writeLocalStore(store);

  return sortRefreshQueue(created);
}

async function enqueueRefreshQueueSupabase(items: CreateProjectBuilderRefreshQueueItemInput[]) {
  if (items.length === 0) {
    return [];
  }

  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const timestamp = nowIso();
  const rows = items.map((item) => ({
    id: crypto.randomUUID(),
    workspace_id: item.workspaceId,
    project_id: item.projectId,
    generation_run_id: item.generationRunId ?? null,
    surface: item.surface,
    status: "pending",
    reason: item.reason,
    target_plan_revision_id: item.targetPlanRevisionId,
    target_plan_revision_number: item.targetPlanRevisionNumber,
    pinned_plan_revision_number: item.pinnedPlanRevisionNumber,
    requires_manual_review: item.requiresManualReview,
    summary: item.summary,
    created_at: timestamp,
    updated_at: timestamp,
    deferred_at: null,
    defer_reason: null,
    stale_at: null,
    stale_reason: null,
    superseded_by_generation_run_id: null,
    superseded_by_plan_revision_number: null,
    completed_at: null,
  }));
  const { data, error } = await client
    .from("project_builder_refresh_queue_items")
    .insert(rows)
    .select("*");

  if (error) {
    throw new Error(error.message);
  }

  return sortRefreshQueue((data ?? []).map((row) => mapRefreshQueueRow(row as Record<string, unknown>)));
}

async function updateRefreshQueueStatusLocal(input: {
  queueItemId: string;
  nextStatus: ProjectBuilderRefreshQueueItemRecord["status"];
  deferReason?: string | null;
  staleReason?: string | null;
  supersededByGenerationRunId?: string | null;
  supersededByPlanRevisionNumber?: number | null;
}) {
  const store = await readLocalStore();
  const index = store.projectBuilderRefreshQueueItems.findIndex((item) => item.id === input.queueItemId);

  if (index === -1) {
    throw new Error("Refresh queue item not found.");
  }

  const timestamp = nowIso();
  const current = store.projectBuilderRefreshQueueItems[index];
  const nextItem: ProjectBuilderRefreshQueueItemRecord = {
    ...current,
    status: input.nextStatus,
    updatedAt: timestamp,
    deferredAt: input.nextStatus === "deferred" ? timestamp : current.deferredAt,
    deferReason:
      input.nextStatus === "deferred"
        ? (input.deferReason?.trim() || current.deferReason || "Deferred from the builder surface.")
        : current.deferReason,
    staleAt: input.nextStatus === "stale" ? (current.staleAt ?? timestamp) : current.staleAt,
    staleReason:
      input.nextStatus === "stale"
        ? (input.staleReason?.trim() ||
          current.staleReason ||
          "A newer generation run is available for this surface.")
        : current.staleReason,
    supersededByGenerationRunId:
      input.nextStatus === "stale"
        ? (input.supersededByGenerationRunId ?? current.supersededByGenerationRunId ?? null)
        : current.supersededByGenerationRunId,
    supersededByPlanRevisionNumber:
      input.nextStatus === "stale"
        ? (input.supersededByPlanRevisionNumber ?? current.supersededByPlanRevisionNumber ?? null)
        : current.supersededByPlanRevisionNumber,
    completedAt: input.nextStatus === "completed" ? (current.completedAt ?? timestamp) : current.completedAt,
  };

  store.projectBuilderRefreshQueueItems[index] = nextItem;
  await writeLocalStore(store);

  return nextItem;
}

async function updateRefreshQueueStatusSupabase(input: {
  queueItemId: string;
  nextStatus: ProjectBuilderRefreshQueueItemRecord["status"];
  deferReason?: string | null;
  staleReason?: string | null;
  supersededByGenerationRunId?: string | null;
  supersededByPlanRevisionNumber?: number | null;
}) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data: existingRow, error: existingError } = await client
    .from("project_builder_refresh_queue_items")
    .select("*")
    .eq("id", input.queueItemId)
    .single();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existing = mapRefreshQueueRow(existingRow as Record<string, unknown>);
  const timestamp = nowIso();
  const row = {
    status: input.nextStatus,
    updated_at: timestamp,
    deferred_at: input.nextStatus === "deferred" ? timestamp : existing.deferredAt,
    defer_reason:
      input.nextStatus === "deferred"
        ? (input.deferReason?.trim() || existing.deferReason || "Deferred from the builder surface.")
        : existing.deferReason,
    stale_at: input.nextStatus === "stale" ? (existing.staleAt ?? timestamp) : existing.staleAt,
    stale_reason:
      input.nextStatus === "stale"
        ? (input.staleReason?.trim() ||
          existing.staleReason ||
          "A newer generation run is available for this surface.")
        : existing.staleReason,
    superseded_by_generation_run_id:
      input.nextStatus === "stale"
        ? (input.supersededByGenerationRunId ?? existing.supersededByGenerationRunId)
        : existing.supersededByGenerationRunId,
    superseded_by_plan_revision_number:
      input.nextStatus === "stale"
        ? (input.supersededByPlanRevisionNumber ?? existing.supersededByPlanRevisionNumber)
        : existing.supersededByPlanRevisionNumber,
    completed_at: input.nextStatus === "completed" ? timestamp : existing.completedAt,
  };
  const { data, error } = await client
    .from("project_builder_refresh_queue_items")
    .update(row)
    .eq("id", input.queueItemId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRefreshQueueRow(data as Record<string, unknown>);
}

async function appendQueueAuditEvent(input: {
  workspaceSlug: string;
  projectSlug: string;
  item: ProjectBuilderRefreshQueueItemRecord;
  kind: "refresh_queue_deferred" | "refresh_queue_stale" | "refresh_queue_completed";
}) {
  const bundle = await getProjectPlanBundle(input.workspaceSlug, input.projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  const occurredAt =
    input.kind === "refresh_queue_completed"
      ? input.item.completedAt ?? input.item.updatedAt
      : input.kind === "refresh_queue_deferred"
        ? input.item.deferredAt ?? input.item.updatedAt
        : input.item.staleAt ?? input.item.updatedAt;

  await appendProjectAuditEvent({
    projectId: bundle.project.id,
    workspaceId: bundle.workspace.id,
    source: input.item.surface,
    kind: input.kind,
    title:
      input.kind === "refresh_queue_completed"
        ? queueCompleteTitle(input.item.surface)
        : input.kind === "refresh_queue_deferred"
          ? queueDeferTitle(input.item.surface)
          : queueStaleTitle(input.item.surface),
    summary:
      input.kind === "refresh_queue_completed"
        ? input.item.summary
        : input.kind === "refresh_queue_deferred"
          ? input.item.deferReason ?? input.item.summary
          : input.item.staleReason ?? input.item.summary,
    actorType: input.kind === "refresh_queue_stale" ? "runtime" : "user",
    actorLabel: input.kind === "refresh_queue_stale" ? "builder_runtime" : "workspace_editor",
    entityType: "refresh_queue_item",
    entityId: input.item.id,
    linkedTab: input.item.surface,
    linkContext: {
      tab: input.item.surface,
      generationRunId: input.item.generationRunId,
      planRevisionId: input.item.targetPlanRevisionId,
      planRevisionNumber: input.item.targetPlanRevisionNumber,
    },
    metadata: {
      queueItemId: input.item.id,
      surface: input.item.surface,
      status: input.item.status,
      generationRunId: input.item.generationRunId,
      targetPlanRevisionNumber: input.item.targetPlanRevisionNumber,
      pinnedPlanRevisionNumber: input.item.pinnedPlanRevisionNumber,
      requiresManualReview: input.item.requiresManualReview,
      deferReason: input.item.deferReason,
      staleReason: input.item.staleReason,
      supersededByGenerationRunId: input.item.supersededByGenerationRunId,
      supersededByPlanRevisionNumber: input.item.supersededByPlanRevisionNumber,
    },
    occurredAt,
  });
}

async function markRefreshQueueItemStale(input: {
  workspaceSlug: string;
  projectSlug: string;
  queueItemId: string;
  staleReason: string;
  supersededByGenerationRunId: string;
  supersededByPlanRevisionNumber: number;
}) {
  const item = isSupabaseConfigured()
    ? await updateRefreshQueueStatusSupabase({
        queueItemId: input.queueItemId,
        nextStatus: "stale",
        staleReason: input.staleReason,
        supersededByGenerationRunId: input.supersededByGenerationRunId,
        supersededByPlanRevisionNumber: input.supersededByPlanRevisionNumber,
      })
    : await updateRefreshQueueStatusLocal({
        queueItemId: input.queueItemId,
        nextStatus: "stale",
        staleReason: input.staleReason,
        supersededByGenerationRunId: input.supersededByGenerationRunId,
        supersededByPlanRevisionNumber: input.supersededByPlanRevisionNumber,
      });

  await appendQueueAuditEvent({
    workspaceSlug: input.workspaceSlug,
    projectSlug: input.projectSlug,
    item,
    kind: "refresh_queue_stale",
  });

  return item;
}

async function reconcileSupersededGenerationQueueItems(
  workspaceSlug: string,
  projectSlug: string,
  items: ProjectBuilderRefreshQueueItemRecord[],
) {
  const generationBundle = await getProjectGenerationBundle(workspaceSlug, projectSlug);
  const latestCompletedRun = generationBundle
    ? findLatestCompletedGenerationRun(generationBundle.runs)
    : null;

  if (!latestCompletedRun) {
    return items;
  }

  const staleCandidates = items.filter(
    (item) =>
      item.generationRunId &&
      isCurrentQueueItemStatus(item.status) &&
      item.generationRunId !== latestCompletedRun.id,
  );

  if (staleCandidates.length === 0) {
    return items;
  }

  const updatedItems = new Map<string, ProjectBuilderRefreshQueueItemRecord>();

  for (const item of staleCandidates) {
    const nextItem = await markRefreshQueueItemStale({
      workspaceSlug,
      projectSlug,
      queueItemId: item.id,
      staleReason: `A newer generation run is available for revision ${latestCompletedRun.sourcePlanRevisionNumber}. Re-queue this surface from the latest generation review before consuming more work.`,
      supersededByGenerationRunId: latestCompletedRun.id,
      supersededByPlanRevisionNumber: latestCompletedRun.sourcePlanRevisionNumber,
    });
    updatedItems.set(nextItem.id, nextItem);
  }

  return sortRefreshQueue(items.map((item) => updatedItems.get(item.id) ?? item));
}

export async function listProjectBuilderRefreshQueue(
  workspaceSlug: string,
  projectSlug: string,
) {
  const planBundle = await getProjectPlanBundle(workspaceSlug, projectSlug);

  if (!planBundle) {
    return [];
  }

  const queueItems = isSupabaseConfigured()
    ? listRefreshQueueSupabase(planBundle.project.id)
    : listRefreshQueueLocal(planBundle.project.id);

  return reconcileSupersededGenerationQueueItems(
    workspaceSlug,
    projectSlug,
    await queueItems,
  );
}

export async function enqueueProjectBuilderRefreshQueue(
  items: CreateProjectBuilderRefreshQueueItemInput[],
) {
  if (isSupabaseConfigured()) {
    return enqueueRefreshQueueSupabase(items);
  }

  return enqueueRefreshQueueLocal(items);
}

export function getActiveBuilderRefreshQueueItem(
  items: ProjectBuilderRefreshQueueItemRecord[],
  surface: BuilderRefreshSurface,
) {
  return (
    items.find((item) => item.surface === surface && item.status === "pending") ??
    items.find((item) => item.surface === surface && item.status === "deferred") ??
    null
  );
}

export function getLatestStaleBuilderRefreshQueueItem(
  items: ProjectBuilderRefreshQueueItemRecord[],
  surface: BuilderRefreshSurface,
) {
  return items.find((item) => item.surface === surface && item.status === "stale") ?? null;
}

export function getRelevantBuilderRefreshQueueItem(
  items: ProjectBuilderRefreshQueueItemRecord[],
  surface: BuilderRefreshSurface,
) {
  return (
    getActiveBuilderRefreshQueueItem(items, surface) ??
    getLatestStaleBuilderRefreshQueueItem(items, surface) ??
    null
  );
}

export async function deferProjectBuilderRefreshQueueItem(input: {
  workspaceSlug: string;
  projectSlug: string;
  queueItemId: string;
  deferReason?: string | null;
}) {
  const item = isSupabaseConfigured()
    ? await updateRefreshQueueStatusSupabase({
        queueItemId: input.queueItemId,
        nextStatus: "deferred",
        deferReason: input.deferReason,
      })
    : await updateRefreshQueueStatusLocal({
        queueItemId: input.queueItemId,
        nextStatus: "deferred",
        deferReason: input.deferReason,
      });

  await appendQueueAuditEvent({
    workspaceSlug: input.workspaceSlug,
    projectSlug: input.projectSlug,
    item,
    kind: "refresh_queue_deferred",
  });

  return item;
}

export async function completeProjectBuilderRefreshQueueItem(input: {
  workspaceSlug: string;
  projectSlug: string;
  queueItemId: string;
}) {
  const item = isSupabaseConfigured()
    ? await updateRefreshQueueStatusSupabase({
        queueItemId: input.queueItemId,
        nextStatus: "completed",
      })
    : await updateRefreshQueueStatusLocal({
        queueItemId: input.queueItemId,
        nextStatus: "completed",
      });

  await appendQueueAuditEvent({
    workspaceSlug: input.workspaceSlug,
    projectSlug: input.projectSlug,
    item,
    kind: "refresh_queue_completed",
  });

  return item;
}
