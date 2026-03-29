import { isSupabaseConfigured } from "@/lib/env";
import { canViewWorkspace } from "@/lib/auth/access";
import { buildProjectPermissions, buildWorkspacePermissions } from "@/lib/auth/access";
import { getCurrentAuthenticatedUser, getWorkspaceMembership } from "@/lib/auth/repository";
import type { PlannerArtifactRecord, PlannerRunRecord } from "@/lib/planner/types";
import { readLocalStore, writeLocalStore } from "@/lib/workspaces/local-store";
import { createSupabaseServerClient } from "@/lib/workspaces/supabase";
import type {
  AuditTimelineFilterSource,
  AuditTimelineSource,
  CodeWorkspaceStateRecord,
  CreateProjectAuditTimelineEventInput,
  PreviewDevice,
  ProjectAuditTimelineBundle,
  ProjectAuditTimelineEventRecord,
  ProjectCodeFileRecord,
  ProjectCodeFileRevisionRecord,
  ProjectCodePatchProposalRecord,
  VisualPageRecord,
  VisualStateRecord,
} from "@/lib/builder/types";
import type { PlanRevisionRecord, ProjectRecord, WorkspaceRecord } from "@/lib/workspaces/types";

function nowIso() {
  return new Date().toISOString();
}

function sortPlanRevisions(revisions: PlanRevisionRecord[]) {
  return [...revisions].sort((a, b) => b.revisionNumber - a.revisionNumber);
}

function sortTimelineEvents(events: ProjectAuditTimelineEventRecord[]) {
  return [...events].sort((a, b) => {
    if (a.occurredAt !== b.occurredAt) {
      return b.occurredAt.localeCompare(a.occurredAt);
    }

    return b.createdAt.localeCompare(a.createdAt);
  });
}

function buildAuditEvent(
  input: CreateProjectAuditTimelineEventInput,
): ProjectAuditTimelineEventRecord {
  const createdAt = input.createdAt ?? input.occurredAt;

  return {
    id: input.id ?? crypto.randomUUID(),
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    source: input.source,
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    actorType: input.actorType,
    actorUserId: input.actorUserId ?? null,
    actorLabel: input.actorLabel,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    linkedTab: input.linkedTab,
    linkContext: input.linkContext,
    metadata: input.metadata ?? {},
    occurredAt: input.occurredAt,
    createdAt,
  };
}

function mapAuditRow(row: Record<string, unknown>): ProjectAuditTimelineEventRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    workspaceId: String(row.workspace_id),
    source: row.source as ProjectAuditTimelineEventRecord["source"],
    kind: row.kind as ProjectAuditTimelineEventRecord["kind"],
    title: String(row.title),
    summary: String(row.summary),
    actorType: row.actor_type as ProjectAuditTimelineEventRecord["actorType"],
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    actorLabel: String(row.actor_label),
    entityType: String(row.entity_type),
    entityId: row.entity_id ? String(row.entity_id) : null,
    linkedTab: row.linked_tab as ProjectAuditTimelineEventRecord["linkedTab"],
    linkContext:
      (row.link_context as ProjectAuditTimelineEventRecord["linkContext"]) ?? { tab: "plan" },
    metadata: (row.metadata_json as ProjectAuditTimelineEventRecord["metadata"]) ?? {},
    occurredAt: String(row.occurred_at),
    createdAt: String(row.created_at),
  };
}

function buildPlanRevisionAuditEvent(
  workspaceId: string,
  project: ProjectRecord,
  revision: PlanRevisionRecord,
): ProjectAuditTimelineEventRecord {
  const stateTitle: Record<PlanRevisionRecord["state"], string> = {
    generated: `Plan revision ${revision.revisionNumber} generated`,
    draft_saved: `Plan revision ${revision.revisionNumber} saved`,
    needs_changes: `Plan revision ${revision.revisionNumber} marked for changes`,
    approved: `Plan revision ${revision.revisionNumber} approved`,
  };

  return buildAuditEvent({
    id: `audit-plan-revision-${revision.id}`,
    projectId: project.id,
    workspaceId,
    source: "plan",
    kind: "plan_revision",
    title: stateTitle[revision.state],
    summary: revision.changeSummary,
    actorType: revision.state === "generated" ? "assistant" : "user",
    actorLabel: revision.state === "generated" ? revision.plannerSource : "workspace_editor",
    entityType: "plan_revision",
    entityId: revision.id,
    linkedTab: "plan",
    linkContext: {
      tab: "plan",
      planRevisionId: revision.id,
      planRevisionNumber: revision.revisionNumber,
    },
    metadata: {
      state: revision.state,
      editedSection: revision.editedSection,
      plannerSource: revision.plannerSource,
    },
    occurredAt: revision.createdAt,
  });
}

function buildPlannerRunAuditEvent(
  workspaceId: string,
  project: ProjectRecord,
  run: PlannerRunRecord,
  artifactCount: number,
): ProjectAuditTimelineEventRecord {
  return buildAuditEvent({
    id: `audit-planner-run-${run.id}`,
    projectId: project.id,
    workspaceId,
    source: "plan",
    kind: "planner_run",
    title:
      run.status === "completed"
        ? `Planner run completed for revision ${run.generatedPlanRevisionNumber ?? "draft"}`
        : "Planner run failed",
    summary: run.summary,
    actorType: run.status === "completed" ? "assistant" : "system",
    actorLabel: run.source,
    entityType: "planner_run",
    entityId: run.id,
    linkedTab: "plan",
    linkContext: {
      tab: "plan",
      plannerRunId: run.id,
      briefId: run.briefId,
      planRevisionId: run.generatedPlanRevisionId,
      planRevisionNumber: run.generatedPlanRevisionNumber,
    },
    metadata: {
      status: run.status,
      trigger: run.trigger,
      source: run.source,
      briefUpdatedAt: run.briefUpdatedAt,
      artifactCount,
      errorMessage: run.errorMessage,
    },
    occurredAt: run.completedAt ?? run.startedAt,
    createdAt: run.createdAt,
  });
}

function buildVisualScaffoldAuditEvent(
  workspaceId: string,
  project: ProjectRecord,
  visualState: VisualStateRecord,
  visualPages: VisualPageRecord[],
  actorType: "system" | "user" = "system",
  actorLabel = "visual_scaffold",
): ProjectAuditTimelineEventRecord {
  return buildAuditEvent({
    id: `audit-visual-scaffold-${visualState.id}-${visualState.lastScaffoldAt}`,
    projectId: project.id,
    workspaceId,
    source: "visual",
    kind: "visual_scaffold",
    title:
      actorType === "user"
        ? "Visual scaffold regenerated"
        : "Visual scaffold created",
    summary: `${visualPages.length} page surfaces were mapped from plan revision ${visualState.scaffoldSourceRevisionNumber}.`,
    actorType,
    actorLabel,
    entityType: "visual_state",
    entityId: visualState.id,
    linkedTab: "visual",
    linkContext: {
      tab: "visual",
      visualPageId: visualState.activePageId || visualPages[0]?.id || null,
    },
    metadata: {
      pageCount: visualPages.length,
      scaffoldSourceRevisionNumber: visualState.scaffoldSourceRevisionNumber,
      manualChanges: visualState.manualChanges,
    },
    occurredAt: visualState.lastScaffoldAt,
  });
}

function buildCodeRevisionAuditEvent(
  workspaceId: string,
  project: ProjectRecord,
  revision: ProjectCodeFileRevisionRecord,
  file: ProjectCodeFileRecord | null,
): ProjectAuditTimelineEventRecord {
  const filePath = file?.path ?? "unknown-file";
  const baseTitle =
    revision.kind === "restored"
      ? `File restored for ${filePath}`
      : revision.kind === "synced" || revision.kind === "scaffold"
        ? `Code scaffold refreshed for ${filePath}`
        : `Code revision saved for ${filePath}`;

  return buildAuditEvent({
    id: `audit-code-revision-${revision.id}`,
    projectId: project.id,
    workspaceId,
    source: "code",
    kind:
      revision.kind === "restored"
        ? "code_restore"
        : revision.kind === "synced" || revision.kind === "scaffold"
          ? "code_refresh"
          : "code_revision",
    title: baseTitle,
    summary: revision.changeSummary,
    actorType:
      revision.authoredBy === "user"
        ? "user"
        : revision.sourceProposalId
          ? "assistant"
          : "system",
    actorLabel:
      revision.sourceProposalTitle ??
      (revision.authoredBy === "user" ? "workspace_editor" : "builder_runtime"),
    entityType: "code_revision",
    entityId: revision.id,
    linkedTab: "code",
    linkContext: {
      tab: "code",
      filePath,
      compareRevisionId:
        revision.restoreSource === "revision"
          ? revision.restoredFromRevisionId
          : revision.baseRevisionId,
      compareRevisionNumber:
        revision.restoreSource === "revision"
          ? revision.restoredFromRevisionNumber
          : revision.baseRevisionNumber,
      proposalId: revision.sourceProposalId,
    },
    metadata: {
      filePath,
      revisionKind: revision.kind,
      revisionNumber: revision.revisionNumber,
      baseRevisionNumber: revision.baseRevisionNumber,
      restoreSource: revision.restoreSource,
    },
    occurredAt: revision.createdAt,
  });
}

function buildProposalOutcomeAuditEvents(
  workspaceId: string,
  project: ProjectRecord,
  proposal: ProjectCodePatchProposalRecord,
): ProjectAuditTimelineEventRecord[] {
  const events: ProjectAuditTimelineEventRecord[] = [];

  if (proposal.status !== "pending") {
    const titleMap: Record<Exclude<ProjectCodePatchProposalRecord["status"], "pending">, string> = {
      applied: `Patch proposal applied for ${proposal.filePath}`,
      rejected: `Patch proposal rejected for ${proposal.filePath}`,
      stale: `Patch proposal went stale for ${proposal.filePath}`,
    };

    events.push(
      buildAuditEvent({
        id: `audit-proposal-${proposal.status}-${proposal.id}`,
        projectId: project.id,
        workspaceId,
        source: "code",
        kind:
          proposal.status === "applied"
            ? "proposal_applied"
            : proposal.status === "rejected"
              ? "proposal_rejected"
              : "proposal_stale",
        title: titleMap[proposal.status],
        summary: proposal.resolutionNote ?? proposal.changeSummary,
        actorType: proposal.status === "applied" || proposal.status === "rejected" ? "user" : "system",
        actorLabel:
          proposal.status === "stale"
            ? "sync_guardrail"
            : "workspace_editor",
        entityType: "patch_proposal",
        entityId: proposal.id,
        linkedTab: "code",
        linkContext: {
          tab: "code",
          filePath: proposal.filePath,
          proposalId: proposal.id,
          compareRevisionId: proposal.baseRevisionId,
          compareRevisionNumber: proposal.baseRevisionNumber,
        },
        metadata: {
          proposalStatus: proposal.status,
          filePath: proposal.filePath,
          baseRevisionNumber: proposal.baseRevisionNumber,
          invalidatedByRevisionNumber: proposal.invalidatedByRevisionNumber,
          resolvedRevisionId: proposal.resolvedRevisionId,
        },
        occurredAt: proposal.resolvedAt ?? proposal.createdAt,
      }),
    );
  }

  if (proposal.archivedAt) {
    events.push(
      buildAuditEvent({
        id: `audit-proposal-archived-${proposal.id}-${proposal.archivedAt}`,
        projectId: project.id,
        workspaceId,
        source: "code",
        kind: "proposal_archived",
        title: `Patch proposal archived for ${proposal.filePath}`,
        summary: proposal.archiveReason ?? "Proposal archived without removing audit history.",
        actorType: "user",
        actorLabel: "workspace_editor",
        entityType: "patch_proposal",
        entityId: proposal.id,
        linkedTab: "code",
        linkContext: {
          tab: "code",
          filePath: proposal.filePath,
          proposalId: proposal.id,
        },
        metadata: {
          filePath: proposal.filePath,
          archivedFromStatus: proposal.status,
        },
        occurredAt: proposal.archivedAt,
      }),
    );
  }

  return events;
}

function countTimelineSources(events: ProjectAuditTimelineEventRecord[]) {
  return events.reduce<Record<AuditTimelineSource, number>>(
    (accumulator, event) => {
      accumulator[event.source] += 1;
      return accumulator;
    },
    {
      plan: 0,
      visual: 0,
      code: 0,
      preview: 0,
      deploy: 0,
    },
  );
}

function latestPreviewEvent(
  events: ProjectAuditTimelineEventRecord[],
): ProjectAuditTimelineEventRecord | null {
  return sortTimelineEvents(events).find((event) => event.source === "preview") ?? null;
}

function samePreviewState(
  event: ProjectAuditTimelineEventRecord | null,
  pageId: string,
  device: PreviewDevice,
  expanded: boolean,
) {
  if (!event) {
    return false;
  }

  return (
    event.kind === "preview_state" &&
    event.linkContext.previewPageId === pageId &&
    event.linkContext.previewDevice === device &&
    Boolean(event.linkContext.previewExpanded) === expanded
  );
}

function normalizeTimelineSource(value: string | null | undefined): AuditTimelineFilterSource {
  if (value === "plan" || value === "visual" || value === "code" || value === "preview" || value === "deploy") {
    return value;
  }

  return "all";
}

async function appendProjectAuditEventsLocal(events: ProjectAuditTimelineEventRecord[]) {
  if (events.length === 0) {
    return;
  }

  const store = await readLocalStore();
  const existingIds = new Set(store.projectAuditTimelineEvents.map((event) => event.id));
  const nextEvents = events.filter((event) => !existingIds.has(event.id));

  if (nextEvents.length === 0) {
    return;
  }

  store.projectAuditTimelineEvents = [
    ...store.projectAuditTimelineEvents,
    ...nextEvents,
  ];
  await writeLocalStore(store);
}

async function appendProjectAuditEventsSupabase(events: ProjectAuditTimelineEventRecord[]) {
  if (events.length === 0) {
    return;
  }

  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await client.from("project_audit_timeline_events").upsert(
    events.map((event) => ({
      id: event.id,
      project_id: event.projectId,
      workspace_id: event.workspaceId,
      source: event.source,
      kind: event.kind,
      title: event.title,
      summary: event.summary,
      actor_type: event.actorType,
      actor_user_id: event.actorUserId,
      actor_label: event.actorLabel,
      entity_type: event.entityType,
      entity_id: event.entityId,
      linked_tab: event.linkedTab,
      link_context: event.linkContext,
      metadata_json: event.metadata,
      occurred_at: event.occurredAt,
      created_at: event.createdAt,
    })),
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function appendProjectAuditEvent(input: CreateProjectAuditTimelineEventInput) {
  const currentActor = input.actorType === "user" ? await getCurrentAuthenticatedUser() : null;
  const event = buildAuditEvent({
    ...input,
    actorUserId: input.actorUserId ?? currentActor?.user.id ?? null,
    actorLabel:
      input.actorType === "user" && input.actorLabel === "workspace_editor"
        ? currentActor?.user.fullName ?? currentActor?.user.email ?? input.actorLabel
        : input.actorLabel,
  });

  if (isSupabaseConfigured()) {
    await appendProjectAuditEventsSupabase([event]);
    return event;
  }

  await appendProjectAuditEventsLocal([event]);
  return event;
}

async function loadTimelineContextLocal(workspaceSlug: string, projectSlug: string) {
  const store = await readLocalStore();
  const workspace = store.workspaces.find((item) => item.slug === workspaceSlug) ?? null;
  const currentUser = await getCurrentAuthenticatedUser();

  if (!workspace || !currentUser) {
    return null;
  }

  const membership = await getWorkspaceMembership(workspace.id, currentUser.user.id);

  if (!canViewWorkspace(workspace, membership)) {
    return null;
  }

  const project = store.projects.find(
    (item) => item.workspaceId === workspace.id && item.slug === projectSlug,
  ) ?? null;

  if (!project) {
    return null;
  }

  const planRevisions = sortPlanRevisions(
    store.planRevisions.filter((revision) => revision.projectId === project.id),
  );

  if (planRevisions.length === 0) {
    return null;
  }

  return {
    workspace,
    project,
    currentUser: currentUser.user,
    membership: membership as NonNullable<typeof membership>,
    latestRevision: planRevisions[0],
    planRevisions,
    visualState: store.visualStates.find((item) => item.projectId === project.id) ?? null,
    visualPages: store.visualPages.filter((item) => item.projectId === project.id),
    codeState: store.codeStates.find((item) => item.projectId === project.id) ?? null,
    files: store.projectFiles.filter((item) => item.projectId === project.id),
    fileRevisions: store.projectFileRevisions.filter((item) => item.projectId === project.id),
    patchProposals: store.projectPatchProposals.filter((item) => item.projectId === project.id),
    plannerRuns: store.plannerRuns.filter((item) => item.projectId === project.id),
    plannerArtifacts: store.plannerArtifacts.filter((item) => item.projectId === project.id),
    events: store.projectAuditTimelineEvents.filter((item) => item.projectId === project.id),
  };
}

async function loadTimelineContextSupabase(workspaceSlug: string, projectSlug: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return null;
  }

  const { data: workspaceRow, error: workspaceError } = await client
    .from("workspaces")
    .select("id, slug, name, owner_user_id, created_by_user_id, business_category, country, default_locale, supported_locales, created_at, updated_at")
    .eq("slug", workspaceSlug)
    .maybeSingle();

  if (workspaceError) {
    throw new Error(workspaceError.message);
  }

  if (!workspaceRow) {
    return null;
  }

  const workspace: WorkspaceRecord = {
    id: String(workspaceRow.id),
    slug: String(workspaceRow.slug),
    name: String(workspaceRow.name),
    ownerUserId: String(workspaceRow.owner_user_id ?? workspaceRow.created_by_user_id ?? ""),
    createdByUserId: String(workspaceRow.created_by_user_id ?? workspaceRow.owner_user_id ?? ""),
    businessCategory: String(workspaceRow.business_category),
    country: workspaceRow.country as WorkspaceRecord["country"],
    defaultLocale: workspaceRow.default_locale as WorkspaceRecord["defaultLocale"],
    supportedLocales: (workspaceRow.supported_locales as WorkspaceRecord["supportedLocales"]) ?? ["sq"],
    companyName: String(workspaceRow.name),
    intentNotes: "",
    onboardingPayload: {},
    createdAt: String(workspaceRow.created_at),
    updatedAt: String(workspaceRow.updated_at),
  };
  const currentUser = await getCurrentAuthenticatedUser();

  if (!currentUser) {
    return null;
  }

  const membership = await getWorkspaceMembership(workspace.id, currentUser.user.id);

  if (!canViewWorkspace(workspace, membership)) {
    return null;
  }

  const { data: projectRow, error: projectError } = await client
    .from("projects")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("slug", projectSlug)
    .maybeSingle();

  if (projectError) {
    throw new Error(projectError.message);
  }

  if (!projectRow) {
    return null;
  }

  const [
    { data: planRows, error: planError },
    { data: visualStateRow, error: visualStateError },
    { data: visualPages, error: visualPagesError },
    { data: codeStateRow, error: codeStateError },
    { data: fileRows, error: fileError },
    { data: fileRevisionRows, error: fileRevisionError },
    { data: proposalRows, error: proposalError },
    { data: plannerRunRows, error: plannerRunError },
    { data: plannerArtifactRows, error: plannerArtifactError },
    { data: eventRows, error: eventError },
  ] = await Promise.all([
    client.from("project_plan_revisions").select("*").eq("project_id", String(projectRow.id)).order("revision_number", { ascending: false }),
    client.from("project_visual_states").select("*").eq("project_id", String(projectRow.id)).maybeSingle(),
    client.from("project_visual_pages").select("*").eq("project_id", String(projectRow.id)),
    client.from("project_code_states").select("*").eq("project_id", String(projectRow.id)).maybeSingle(),
    client.from("project_code_files").select("*").eq("project_id", String(projectRow.id)),
    client.from("project_code_file_revisions").select("*").eq("project_id", String(projectRow.id)),
    client.from("project_code_patch_proposals").select("*").eq("project_id", String(projectRow.id)),
    client.from("project_planner_runs").select("*").eq("project_id", String(projectRow.id)),
    client.from("project_planner_artifacts").select("*").eq("project_id", String(projectRow.id)),
    client.from("project_audit_timeline_events").select("*").eq("project_id", String(projectRow.id)),
  ]);

  if (planError || visualStateError || visualPagesError || codeStateError || fileError || fileRevisionError || proposalError || plannerRunError || plannerArtifactError || eventError) {
    throw new Error(
      planError?.message ??
        visualStateError?.message ??
        visualPagesError?.message ??
        codeStateError?.message ??
        fileError?.message ??
        fileRevisionError?.message ??
        proposalError?.message ??
        plannerRunError?.message ??
        plannerArtifactError?.message ??
        eventError?.message ??
        "Unable to load project audit timeline.",
    );
  }

  const planRevisions: PlanRevisionRecord[] = (planRows ?? []).map((row) => ({
    id: String(row.id),
    projectId: String(row.project_id),
    revisionNumber: Number(row.revision_number),
    state: row.state as PlanRevisionRecord["state"],
    editedSection: row.edited_section as PlanRevisionRecord["editedSection"],
    changeSummary: String(row.change_summary),
    plannerSource: row.planner_source as PlanRevisionRecord["plannerSource"],
    plan: row.plan_payload as PlanRevisionRecord["plan"],
    createdAt: String(row.created_at),
  }));

  if (planRevisions.length === 0) {
    return null;
  }

  const project: ProjectRecord = {
    id: String(projectRow.id),
    workspaceId: String(projectRow.workspace_id),
    slug: String(projectRow.slug),
    name: String(projectRow.name),
    ownerUserId: String(projectRow.owner_user_id ?? projectRow.created_by_user_id ?? ""),
    createdByUserId: String(projectRow.created_by_user_id ?? projectRow.owner_user_id ?? ""),
    startingMode: projectRow.starting_mode as ProjectRecord["startingMode"],
    status: projectRow.status as ProjectRecord["status"],
    projectType: projectRow.project_type as ProjectRecord["projectType"],
    prompt: String(projectRow.prompt ?? ""),
    targetUsers: String(projectRow.target_users),
    desiredPagesFeatures: (projectRow.desired_pages_features as string[]) ?? [],
    designStyle: String(projectRow.design_style),
    primaryLocale: projectRow.primary_locale as ProjectRecord["primaryLocale"],
    supportedLocales: ((projectRow.intake_payload as { supportedLocales?: ProjectRecord["supportedLocales"] })?.supportedLocales ?? [projectRow.primary_locale]) as ProjectRecord["supportedLocales"],
    country: projectRow.country as ProjectRecord["country"],
    businessCategory: String(projectRow.business_category),
    capabilities: (projectRow.capabilities as ProjectRecord["capabilities"]) ?? {
      auth: false,
      payments: false,
      cms: false,
      fileUpload: false,
      aiChat: false,
      calendar: false,
      analytics: false,
    },
    intakePayload: (projectRow.intake_payload as Record<string, unknown>) ?? {},
    structuredPlan: (projectRow.structured_plan as ProjectRecord["structuredPlan"]) ?? planRevisions[0].plan,
    currentPlanRevisionId: String(projectRow.current_plan_revision_id ?? planRevisions[0].id),
    currentPlanRevisionNumber: Number(projectRow.current_plan_revision_number ?? planRevisions[0].revisionNumber),
    planLastUpdatedAt: String(projectRow.plan_last_updated_at ?? planRevisions[0].createdAt),
    plannerSource: (projectRow.planner_source as ProjectRecord["plannerSource"]) ?? planRevisions[0].plannerSource,
    createdAt: String(projectRow.created_at),
    updatedAt: String(projectRow.updated_at),
  };

  return {
    workspace,
    project,
    currentUser: currentUser.user,
    membership: membership as NonNullable<typeof membership>,
    latestRevision: planRevisions[0],
    planRevisions,
    visualState: visualStateRow
      ? {
          id: String(visualStateRow.id),
          projectId: String(visualStateRow.project_id),
          activePageId: String(visualStateRow.active_page_id ?? ""),
          themeTokens: visualStateRow.theme_tokens as VisualStateRecord["themeTokens"],
          scaffoldSourceRevisionNumber: Number(visualStateRow.scaffold_source_revision_number ?? 1),
          manualChanges: Boolean(visualStateRow.manual_changes),
          lastScaffoldAt: String(visualStateRow.last_scaffold_at),
          createdAt: String(visualStateRow.created_at),
          updatedAt: String(visualStateRow.updated_at),
        }
      : null,
    visualPages: (visualPages ?? []).map((row) => ({
      id: String(row.id),
      visualStateId: String(row.visual_state_id),
      projectId: String(row.project_id),
      pageKey: String(row.page_key),
      title: String(row.title),
      slug: String(row.slug),
      orderIndex: Number(row.order_index),
      contentPayload: (row.content_payload as Record<string, unknown>) ?? {},
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    })),
    codeState: codeStateRow
      ? {
          id: String(codeStateRow.id),
          projectId: String(codeStateRow.project_id),
          activeFilePath: String(codeStateRow.active_file_path ?? ""),
          openFilePaths: Array.isArray(codeStateRow.open_file_paths)
            ? codeStateRow.open_file_paths.map((item: unknown) => String(item))
            : [],
          scaffoldSourceRevisionNumber: Number(codeStateRow.scaffold_source_revision_number ?? 1),
          sourceVisualUpdatedAt: String(codeStateRow.source_visual_updated_at),
          manualChanges: Boolean(codeStateRow.manual_changes),
          lastGeneratedAt: String(codeStateRow.last_generated_at),
          createdAt: String(codeStateRow.created_at),
          updatedAt: String(codeStateRow.updated_at),
        }
      : null,
    files: (fileRows ?? []).map((row) => ({
      id: String(row.id),
      codeStateId: String(row.code_state_id),
      projectId: String(row.project_id),
      path: String(row.path),
      directory: String(row.directory),
      name: String(row.name),
      extension: String(row.extension),
      kind: row.file_kind as ProjectCodeFileRecord["kind"],
      language: row.language as ProjectCodeFileRecord["language"],
      orderIndex: Number(row.order_index),
      ownership: row.ownership as ProjectCodeFileRecord["ownership"],
      editPolicy: row.edit_policy as ProjectCodeFileRecord["editPolicy"],
      content: String(row.content),
      currentRevisionId: String(row.current_revision_id ?? ""),
      currentRevisionNumber: Number(row.current_revision_number ?? 1),
      draftContent: row.draft_content ? String(row.draft_content) : null,
      draftUpdatedAt: row.draft_updated_at ? String(row.draft_updated_at) : null,
      draftBaseRevisionId: row.draft_base_revision_id ? String(row.draft_base_revision_id) : null,
      draftBaseRevisionNumber:
        typeof row.draft_base_revision_number === "number"
          ? row.draft_base_revision_number
          : row.draft_base_revision_number
            ? Number(row.draft_base_revision_number)
            : null,
      createdFromVisualPageId: row.created_from_visual_page_id ? String(row.created_from_visual_page_id) : null,
      createdFromSectionId: row.created_from_section_id ? String(row.created_from_section_id) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    })),
    fileRevisions: (fileRevisionRows ?? []).map((row) => ({
      id: String(row.id),
      fileId: String(row.file_id),
      projectId: String(row.project_id),
      revisionNumber: Number(row.revision_number ?? 1),
      kind: row.kind as ProjectCodeFileRevisionRecord["kind"],
      content: String(row.content),
      changeSummary: String(row.change_summary),
      authoredBy: row.authored_by as ProjectCodeFileRevisionRecord["authoredBy"],
      baseRevisionId: row.base_revision_id ? String(row.base_revision_id) : null,
      baseRevisionNumber:
        typeof row.base_revision_number === "number"
          ? row.base_revision_number
          : row.base_revision_number
            ? Number(row.base_revision_number)
            : null,
      sourceProposalId: row.source_proposal_id ? String(row.source_proposal_id) : null,
      sourceProposalTitle: row.source_proposal_title ? String(row.source_proposal_title) : null,
      restoreSource:
        row.restore_source === "revision" || row.restore_source === "scaffold"
          ? row.restore_source
          : null,
      restoredFromRevisionId: row.restored_from_revision_id ? String(row.restored_from_revision_id) : null,
      restoredFromRevisionNumber:
        typeof row.restored_from_revision_number === "number"
          ? row.restored_from_revision_number
          : row.restored_from_revision_number
            ? Number(row.restored_from_revision_number)
            : null,
      createdAt: String(row.created_at),
    })),
    patchProposals: (proposalRows ?? []).map((row) => ({
      id: String(row.id),
      codeStateId: String(row.code_state_id),
      fileId: String(row.file_id),
      projectId: String(row.project_id),
      filePath: String(row.file_path),
      title: String(row.title),
      requestPrompt: String(row.request_prompt),
      rationale: String(row.rationale),
      changeSummary: String(row.change_summary),
      status: row.status as ProjectCodePatchProposalRecord["status"],
      source: row.source as ProjectCodePatchProposalRecord["source"],
      baseRevisionId: row.base_revision_id ? String(row.base_revision_id) : null,
      baseRevisionNumber:
        typeof row.base_revision_number === "number"
          ? row.base_revision_number
          : row.base_revision_number
            ? Number(row.base_revision_number)
            : null,
      baseContent: String(row.base_content),
      proposedContent: String(row.proposed_content),
      resolvedRevisionId: row.resolved_revision_id ? String(row.resolved_revision_id) : null,
      invalidatedByRevisionId: row.invalidated_by_revision_id ? String(row.invalidated_by_revision_id) : null,
      invalidatedByRevisionNumber:
        typeof row.invalidated_by_revision_number === "number"
          ? row.invalidated_by_revision_number
          : row.invalidated_by_revision_number
            ? Number(row.invalidated_by_revision_number)
            : null,
      resolutionNote: row.resolution_note ? String(row.resolution_note) : null,
      archivedAt: row.archived_at ? String(row.archived_at) : null,
      archiveReason: row.archive_reason ? String(row.archive_reason) : null,
      createdAt: String(row.created_at),
      resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    })),
    plannerRuns: (plannerRunRows ?? []).map((row) => ({
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
      generatedPlanRevisionId: row.generated_plan_revision_id ? String(row.generated_plan_revision_id) : null,
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
    })),
    plannerArtifacts: (plannerArtifactRows ?? []).map((row) => ({
      id: String(row.id),
      plannerRunId: String(row.planner_run_id),
      projectId: String(row.project_id),
      workspaceId: String(row.workspace_id),
      artifactType: row.artifact_type as PlannerArtifactRecord["artifactType"],
      label: String(row.label),
      payload: (row.payload_json as PlannerArtifactRecord["payload"]) ?? {},
      createdAt: String(row.created_at),
    })),
    events: (eventRows ?? []).map((row) => mapAuditRow(row as Record<string, unknown>)),
  };
}

async function appendMissingAuditEvents(
  existingEvents: ProjectAuditTimelineEventRecord[],
  nextEvents: ProjectAuditTimelineEventRecord[],
) {
  const existingIds = new Set(existingEvents.map((event) => event.id));
  return nextEvents.filter((event) => !existingIds.has(event.id));
}

async function listDerivedDeployAuditEventsSupabase(
  context: NonNullable<Awaited<ReturnType<typeof loadTimelineContextSupabase>>>,
) {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const [
    { data: deployRunRows, error: deployRunError },
    { data: artifactRows, error: artifactError },
    { data: releaseRows, error: releaseError },
    { data: handoffRunRows, error: handoffRunError },
    { data: executionRunRows, error: executionRunError },
  ] = await Promise.all([
    client.from("project_deploy_runs").select("*").eq("project_id", context.project.id),
    client.from("project_deploy_artifacts").select("*").eq("project_id", context.project.id),
    client.from("project_deploy_releases").select("*").eq("project_id", context.project.id),
    client.from("project_deploy_handoff_runs").select("*").eq("project_id", context.project.id),
    client.from("project_deploy_execution_runs").select("*").eq("project_id", context.project.id),
  ]);

  if (
    deployRunError ||
    artifactError ||
    releaseError ||
    handoffRunError ||
    executionRunError
  ) {
    throw new Error(
      deployRunError?.message ??
        artifactError?.message ??
        releaseError?.message ??
        handoffRunError?.message ??
        executionRunError?.message ??
        "Unable to load deploy timeline context.",
    );
  }

  const runById = new Map(
    (deployRunRows ?? []).map((row) => [String(row.id), row as Record<string, unknown>]),
  );
  const artifactCountByRunId = (artifactRows ?? []).reduce<Map<string, number>>((accumulator, row) => {
    const runId = String((row as Record<string, unknown>).deploy_run_id);
    accumulator.set(runId, (accumulator.get(runId) ?? 0) + 1);
    return accumulator;
  }, new Map());

  const events: ProjectAuditTimelineEventRecord[] = [];

  for (const row of deployRunRows ?? []) {
    const record = row as Record<string, unknown>;
    const runId = String(record.id);
    const occurredAt = String(record.completed_at ?? record.started_at ?? nowIso());

    events.push(
      buildAuditEvent({
        id: `audit-deploy-run-${runId}`,
        projectId: context.project.id,
        workspaceId: context.workspace.id,
        source: "deploy",
        kind: "deploy_run",
        title: String(record.status) === "completed" ? "Deploy snapshot created" : "Deploy snapshot failed",
        summary: String(record.summary ?? ""),
        actorType: "user",
        actorLabel: "workspace_editor",
        entityType: "deploy_run",
        entityId: runId,
        linkedTab: "plan",
        linkContext: {
          tab: "plan",
          deployRunId: runId,
          generationRunId:
            typeof record.source_generation_run_id === "string"
              ? record.source_generation_run_id
              : null,
          planRevisionId:
            typeof record.source_plan_revision_id === "string"
              ? record.source_plan_revision_id
              : null,
          planRevisionNumber: Number(record.source_plan_revision_number ?? 0) || null,
        },
        metadata: {
          status: record.status ?? null,
          source: record.source ?? null,
          trigger: record.trigger ?? null,
          artifactCount: artifactCountByRunId.get(runId) ?? 0,
          outputSummary:
            typeof record.output_summary === "object" && record.output_summary
              ? record.output_summary
              : null,
          runtimeSource: record.runtime_source ?? null,
          sourceVisualRevisionNumber: record.source_visual_revision_number ?? null,
          sourceCodeRevisionNumber: record.source_code_revision_number ?? null,
          errorMessage: record.error_message ?? null,
        },
        occurredAt,
        createdAt: occurredAt,
      }),
    );
  }

  for (const row of releaseRows ?? []) {
    const record = row as Record<string, unknown>;
    const releaseId = String(record.id);
    const deployRunId = String(record.deploy_run_id);
    const runRecord = runById.get(deployRunId);
    const promotedAt = String(record.created_at ?? nowIso());

    events.push(
      buildAuditEvent({
        id: `audit-deploy-release-${releaseId}`,
        projectId: context.project.id,
        workspaceId: context.workspace.id,
        source: "deploy",
        kind: "deploy_release_promoted",
        title: "Deploy release promoted",
        summary: `Release ${String(record.name)} was promoted from deploy run ${deployRunId}.`,
        actorType: "user",
        actorLabel: "workspace_editor",
        entityType: "deploy_release",
        entityId: releaseId,
        linkedTab: "plan",
        linkContext: {
          tab: "plan",
          deployRunId,
          releaseId,
          planRevisionId:
            typeof record.source_plan_revision_id === "string"
              ? record.source_plan_revision_id
              : null,
          planRevisionNumber: Number(record.source_plan_revision_number ?? 0) || null,
        },
        metadata: {
          releaseName: record.name ?? null,
          releaseNumber: record.release_number ?? null,
          deployRunId,
        },
        occurredAt: promotedAt,
        createdAt: promotedAt,
      }),
    );

    if (record.handoff_prepared_at) {
      const preparedAt = String(record.handoff_prepared_at);
      events.push(
        buildAuditEvent({
          id: `audit-deploy-release-handoff-${releaseId}`,
          projectId: context.project.id,
          workspaceId: context.workspace.id,
          source: "deploy",
          kind: "deploy_release_handoff_prepared",
          title: "Deploy release handoff prepared",
          summary: `Release ${String(record.name)} was prepared for hosting handoff review.`,
          actorType: "user",
          actorLabel: "workspace_editor",
          entityType: "deploy_release",
          entityId: releaseId,
          linkedTab: "plan",
          linkContext: {
            tab: "plan",
            deployRunId,
            releaseId,
            planRevisionId:
              typeof record.source_plan_revision_id === "string"
                ? record.source_plan_revision_id
                : runRecord && typeof runRecord.source_plan_revision_id === "string"
                  ? runRecord.source_plan_revision_id
                  : null,
            planRevisionNumber:
              Number(record.source_plan_revision_number ?? runRecord?.source_plan_revision_number ?? 0) ||
              null,
          },
          metadata: {
            releaseName: record.name ?? null,
            releaseNumber: record.release_number ?? null,
            deployRunId,
            exportFileName: record.export_file_name ?? null,
          },
          occurredAt: preparedAt,
          createdAt: preparedAt,
        }),
      );
    }

    if (record.exported_at) {
      const exportedAt = String(record.exported_at);
      events.push(
        buildAuditEvent({
          id: `audit-deploy-release-export-${releaseId}-${exportedAt}`,
          projectId: context.project.id,
          workspaceId: context.workspace.id,
          source: "deploy",
          kind: "deploy_release_exported",
          title: "Deploy release export downloaded",
          summary: `Release ${String(record.name)} was exported as a hosting handoff snapshot.`,
          actorType: "user",
          actorLabel: "workspace_editor",
          entityType: "deploy_release",
          entityId: releaseId,
          linkedTab: "plan",
          linkContext: {
            tab: "plan",
            deployRunId,
            releaseId,
            planRevisionId:
              typeof record.source_plan_revision_id === "string"
                ? record.source_plan_revision_id
                : runRecord && typeof runRecord.source_plan_revision_id === "string"
                  ? runRecord.source_plan_revision_id
                  : null,
            planRevisionNumber:
              Number(record.source_plan_revision_number ?? runRecord?.source_plan_revision_number ?? 0) ||
              null,
          },
          metadata: {
            releaseName: record.name ?? null,
            releaseNumber: record.release_number ?? null,
            deployRunId,
            exportFileName: record.export_file_name ?? null,
          },
          occurredAt: exportedAt,
          createdAt: exportedAt,
        }),
      );
    }
  }

  for (const row of handoffRunRows ?? []) {
    const record = row as Record<string, unknown>;
    const handoffRunId = String(record.id);
    const deployRunId = String(record.deploy_run_id);
    const runRecord = runById.get(deployRunId);
    const occurredAt = String(record.completed_at ?? record.started_at ?? nowIso());

    events.push(
      buildAuditEvent({
        id: `audit-deploy-handoff-run-${handoffRunId}`,
        projectId: context.project.id,
        workspaceId: context.workspace.id,
        source: "deploy",
        kind: "deploy_handoff_run",
        title:
          String(record.status) === "completed"
            ? "Hosting adapter simulation completed"
            : String(record.status) === "blocked"
              ? "Hosting adapter simulation blocked"
              : "Hosting adapter simulation failed",
        summary: String(record.summary ?? ""),
        actorType: "user",
        actorLabel: "workspace_editor",
        entityType: "deploy_handoff_run",
        entityId: handoffRunId,
        linkedTab: "plan",
        linkContext: {
          tab: "plan",
          deployRunId,
          releaseId: String(record.release_id),
          handoffRunId,
          planRevisionId:
            runRecord && typeof runRecord.source_plan_revision_id === "string"
              ? runRecord.source_plan_revision_id
              : null,
          planRevisionNumber:
            Number(runRecord?.source_plan_revision_number ?? 0) || null,
        },
        metadata: {
          status: record.status ?? null,
          adapterPresetKey: record.adapter_preset_key ?? null,
          adapterKey: record.adapter_key ?? null,
          exportFileName: record.export_file_name ?? null,
          primaryDomain: record.primary_domain ?? null,
          environmentKey: record.environment_key ?? null,
        },
        occurredAt,
        createdAt: occurredAt,
      }),
    );
  }

  for (const row of executionRunRows ?? []) {
    const record = row as Record<string, unknown>;
    const executionRunId = String(record.id);
    const deployRunId = String(record.deploy_run_id);
    const runRecord = runById.get(deployRunId);
    const occurredAt = String(record.updated_at ?? record.created_at ?? nowIso());
    const readinessSummary =
      typeof record.readiness_summary_json === "object" && record.readiness_summary_json
        ? (record.readiness_summary_json as Record<string, unknown>)
        : {};
    const transitionRows = Array.isArray(record.status_transitions_json)
      ? (record.status_transitions_json as Array<Record<string, unknown>>)
      : [];
    const isRetry = typeof record.retry_of_execution_run_id === "string" && record.retry_of_execution_run_id.length > 0;

    events.push(
      buildAuditEvent({
        id: `audit-deploy-execution-run-${executionRunId}`,
        projectId: context.project.id,
        workspaceId: context.workspace.id,
        source: "deploy",
        kind: isRetry ? "deploy_execution_retried" : "deploy_execution_run",
        title: isRetry
          ? "Hosting execution retried"
          : String(record.status) === "ready"
            ? "Hosting execution completed"
            : String(record.status) === "submitted"
              ? "Hosting execution submitted"
              : String(record.status) === "blocked"
                ? "Hosting execution blocked"
                : "Hosting execution failed",
        summary: String(record.summary ?? ""),
        actorType: "user",
        actorLabel: "workspace_editor",
        entityType: "deploy_execution_run",
        entityId: executionRunId,
        linkedTab: "plan",
        linkContext: {
          tab: "plan",
          deployRunId,
          releaseId: String(record.release_id),
          executionRunId,
          planRevisionId:
            runRecord && typeof runRecord.source_plan_revision_id === "string"
              ? runRecord.source_plan_revision_id
              : null,
          planRevisionNumber:
            Number(runRecord?.source_plan_revision_number ?? 0) || null,
        },
        metadata: {
          status: record.status ?? null,
          requestedAdapterKey: record.requested_adapter_key ?? null,
          actualAdapterKey: record.actual_adapter_key ?? null,
          providerKey: record.provider_key ?? null,
          providerDeploymentId: record.provider_deployment_id ?? null,
          hostedUrl: record.hosted_url ?? null,
          primaryDomain: record.primary_domain ?? null,
          environmentKey: record.environment_key ?? null,
          blockingCount: Number(readinessSummary.blockingCount ?? 0),
          warningCount: Number(readinessSummary.warningCount ?? 0),
          retryOfExecutionRunId: record.retry_of_execution_run_id ?? null,
          attemptNumber: record.attempt_number ?? null,
          latestProviderStatus: record.latest_provider_status ?? null,
          errorMessage: record.error_message ?? null,
        },
        occurredAt,
        createdAt: occurredAt,
      }),
    );

    if (!isRetry && transitionRows.length > 1) {
      const previousTransition = transitionRows[transitionRows.length - 2] ?? null;
      const recheckedAt = String(record.last_checked_at ?? record.updated_at ?? occurredAt);

      events.push(
        buildAuditEvent({
          id: `audit-deploy-execution-recheck-${executionRunId}-${recheckedAt}`,
          projectId: context.project.id,
          workspaceId: context.workspace.id,
          source: "deploy",
          kind: "deploy_execution_rechecked",
          title: "Hosting execution rechecked",
          summary: String(record.summary ?? ""),
          actorType: "user",
          actorLabel: "workspace_editor",
          entityType: "deploy_execution_run",
          entityId: executionRunId,
          linkedTab: "plan",
          linkContext: {
            tab: "plan",
            deployRunId,
            releaseId: String(record.release_id),
            executionRunId,
            planRevisionId:
              runRecord && typeof runRecord.source_plan_revision_id === "string"
                ? runRecord.source_plan_revision_id
                : null,
            planRevisionNumber:
              Number(runRecord?.source_plan_revision_number ?? 0) || null,
          },
          metadata: {
            status: record.status ?? null,
            previousStatus:
              previousTransition && previousTransition.toStatus
                ? previousTransition.toStatus
                : null,
            latestProviderStatus: record.latest_provider_status ?? null,
            providerDeploymentId: record.provider_deployment_id ?? null,
            hostedUrl: record.hosted_url ?? null,
            blockingCount: Number(readinessSummary.blockingCount ?? 0),
            warningCount: Number(readinessSummary.warningCount ?? 0),
            errorMessage: record.error_message ?? null,
          },
          occurredAt: recheckedAt,
          createdAt: recheckedAt,
        }),
      );
    }
  }

  return events;
}

async function ensureBackfilledAuditEventsLocal(
  context: NonNullable<Awaited<ReturnType<typeof loadTimelineContextLocal>>>,
) {
  const fileById = new Map(context.files.map((file) => [file.id, file]));
  const artifactsByRunId = context.plannerArtifacts.reduce<Map<string, PlannerArtifactRecord[]>>(
    (accumulator, artifact) => {
      const bucket = accumulator.get(artifact.plannerRunId) ?? [];
      bucket.push(artifact);
      accumulator.set(artifact.plannerRunId, bucket);
      return accumulator;
    },
    new Map(),
  );
  const inferredEvents: ProjectAuditTimelineEventRecord[] = [
    ...context.plannerRuns.map((run) =>
      buildPlannerRunAuditEvent(
        context.workspace.id,
        context.project,
        run,
        artifactsByRunId.get(run.id)?.length ?? 0,
      ),
    ),
    ...context.planRevisions.map((revision) =>
      buildPlanRevisionAuditEvent(context.workspace.id, context.project, revision),
    ),
    ...(context.visualState && context.visualPages.length > 0
      ? [
          buildVisualScaffoldAuditEvent(
            context.workspace.id,
            context.project,
            context.visualState,
            context.visualPages,
          ),
        ]
      : []),
    ...context.fileRevisions.map((revision) =>
      buildCodeRevisionAuditEvent(
        context.workspace.id,
        context.project,
        revision,
        fileById.get(revision.fileId) ?? null,
      ),
    ),
    ...context.patchProposals.flatMap((proposal) =>
      buildProposalOutcomeAuditEvents(context.workspace.id, context.project, proposal),
    ),
  ];
  const missingEvents = await appendMissingAuditEvents(context.events, inferredEvents);

  if (missingEvents.length > 0) {
    await appendProjectAuditEventsLocal(missingEvents);
  }

  return sortTimelineEvents([...context.events, ...missingEvents]);
}

async function ensureBackfilledAuditEventsSupabase(
  context: NonNullable<Awaited<ReturnType<typeof loadTimelineContextSupabase>>>,
) {
  const fileById = new Map(context.files.map((file) => [file.id, file]));
  const artifactsByRunId = context.plannerArtifacts.reduce<Map<string, PlannerArtifactRecord[]>>(
    (accumulator, artifact) => {
      const bucket = accumulator.get(artifact.plannerRunId) ?? [];
      bucket.push(artifact);
      accumulator.set(artifact.plannerRunId, bucket);
      return accumulator;
    },
    new Map(),
  );
  const inferredEvents: ProjectAuditTimelineEventRecord[] = [
    ...context.plannerRuns.map((run) =>
      buildPlannerRunAuditEvent(
        context.workspace.id,
        context.project,
        run,
        artifactsByRunId.get(run.id)?.length ?? 0,
      ),
    ),
    ...context.planRevisions.map((revision) =>
      buildPlanRevisionAuditEvent(context.workspace.id, context.project, revision),
    ),
    ...(context.visualState && context.visualPages.length > 0
      ? [
          buildVisualScaffoldAuditEvent(
            context.workspace.id,
            context.project,
            context.visualState,
            context.visualPages,
          ),
        ]
      : []),
    ...context.fileRevisions.map((revision) =>
      buildCodeRevisionAuditEvent(
        context.workspace.id,
        context.project,
        revision,
        fileById.get(revision.fileId) ?? null,
      ),
    ),
    ...context.patchProposals.flatMap((proposal) =>
      buildProposalOutcomeAuditEvents(context.workspace.id, context.project, proposal),
    ),
  ];
  const deployEvents = await listDerivedDeployAuditEventsSupabase(context);
  const missingEvents = await appendMissingAuditEvents(context.events, [
    ...inferredEvents,
    ...deployEvents,
  ]);
  const persistableEvents = missingEvents.filter((event) => event.source !== "deploy");

  if (persistableEvents.length > 0) {
    await appendProjectAuditEventsSupabase(persistableEvents);
  }

  return sortTimelineEvents([...context.events, ...missingEvents]);
}

export async function getProjectAuditTimeline(
  workspaceSlug: string,
  projectSlug: string,
  sourceFilter: string | null | undefined,
): Promise<ProjectAuditTimelineBundle | null> {
  const selectedSource = normalizeTimelineSource(sourceFilter);
  const context = isSupabaseConfigured()
    ? await loadTimelineContextSupabase(workspaceSlug, projectSlug)
    : await loadTimelineContextLocal(workspaceSlug, projectSlug);

  if (!context) {
    return null;
  }

  const events = isSupabaseConfigured()
    ? await ensureBackfilledAuditEventsSupabase(context)
    : await ensureBackfilledAuditEventsLocal(context);
  const filteredEvents =
    selectedSource === "all"
      ? events
      : events.filter((event) => event.source === selectedSource);

  return {
    workspace: context.workspace,
    project: context.project,
    latestRevision: context.latestRevision,
    currentUser: context.currentUser,
    membership: context.membership,
    workspacePermissions: buildWorkspacePermissions(context.membership.role),
    projectPermissions: buildProjectPermissions({
      membership: context.membership,
      project: context.project,
      user: context.currentUser,
    }),
    events: filteredEvents,
    counts: countTimelineSources(events),
    selectedSource,
  };
}

export async function recordProjectPreviewTimelineState(input: {
  workspaceSlug: string;
  projectSlug: string;
  pageId: string;
  pageTitle: string;
  routePath: string;
  generationRunId?: string | null;
  runtimeSource?: "accepted_generation_target" | "visual_fallback";
  device: PreviewDevice;
  expanded: boolean;
}) {
  const context = isSupabaseConfigured()
    ? await loadTimelineContextSupabase(input.workspaceSlug, input.projectSlug)
    : await loadTimelineContextLocal(input.workspaceSlug, input.projectSlug);

  if (!context) {
    return null;
  }

  const currentEvents = isSupabaseConfigured()
    ? await ensureBackfilledAuditEventsSupabase(context)
    : await ensureBackfilledAuditEventsLocal(context);

  if (samePreviewState(latestPreviewEvent(currentEvents), input.pageId, input.device, input.expanded)) {
    return null;
  }

  return appendProjectAuditEvent({
    projectId: context.project.id,
    workspaceId: context.workspace.id,
    source: "preview",
    kind: "preview_state",
    title: `Preview opened on ${input.device}`,
    summary: `Preview reviewed on ${input.pageTitle}${input.expanded ? " in expanded mode" : ""}.`,
    actorType: "runtime",
    actorLabel: "preview_runtime",
    entityType: "preview_state",
    entityId: null,
    linkedTab: "preview",
    linkContext: {
      tab: "preview",
      previewPageId: input.pageId,
      previewRoutePath: input.routePath,
      generationRunId: input.generationRunId ?? null,
      previewDevice: input.device,
      previewExpanded: input.expanded,
    },
    metadata: {
      pageTitle: input.pageTitle,
      routePath: input.routePath,
      generationRunId: input.generationRunId ?? null,
      runtimeSource: input.runtimeSource ?? "visual_fallback",
      device: input.device,
      expanded: input.expanded,
    },
    occurredAt: nowIso(),
  });
}
