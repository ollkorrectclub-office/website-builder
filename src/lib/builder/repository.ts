import { isSupabaseConfigured } from "@/lib/env";
import { appendProjectAuditEvent } from "@/lib/builder/audit-repository";
import { createVisualScaffold } from "@/lib/builder/scaffold";
import { getProjectGenerationTargetBundle } from "@/lib/generation/repository";
import { readLocalStore, writeLocalStore } from "@/lib/workspaces/local-store";
import { getProjectPlanBundle } from "@/lib/workspaces/repository";
import { createSupabaseServerClient } from "@/lib/workspaces/supabase";
import type {
  GeneratedVisualScaffold,
  MoveVisualSectionInput,
  ProjectVisualBundle,
  UpdateVisualSectionInput,
  UpdateVisualThemeTokensInput,
  VisualPageRecord,
  VisualSectionRecord,
  VisualStateRecord,
} from "@/lib/builder/types";
import type { ProjectGenerationTargetBundle } from "@/lib/generation/types";
import type { ProjectPlanBundle } from "@/lib/workspaces/types";

function nowIso() {
  return new Date().toISOString();
}

function sortPages(pages: VisualPageRecord[]) {
  return [...pages].sort((a, b) => a.orderIndex - b.orderIndex);
}

function sortSections(sections: VisualSectionRecord[]) {
  return [...sections].sort((a, b) => a.orderIndex - b.orderIndex);
}

function mapVisualStateRow(row: Record<string, unknown>): VisualStateRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    activePageId: String(row.active_page_id ?? ""),
    themeTokens: row.theme_tokens as VisualStateRecord["themeTokens"],
    scaffoldSourceRevisionNumber: Number(row.scaffold_source_revision_number ?? 1),
    manualChanges: Boolean(row.manual_changes),
    lastScaffoldAt: String(row.last_scaffold_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapVisualPageRow(row: Record<string, unknown>): VisualPageRecord {
  return {
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
  };
}

function mapVisualSectionRow(row: Record<string, unknown>): VisualSectionRecord {
  return {
    id: String(row.id),
    visualStateId: String(row.visual_state_id),
    projectId: String(row.project_id),
    pageId: String(row.page_id),
    sectionKey: String(row.section_key),
    sectionType: row.section_type as VisualSectionRecord["sectionType"],
    title: String(row.title),
    label: String(row.label),
    orderIndex: Number(row.order_index),
    isVisible: Boolean(row.is_visible),
    contentPayload: (row.content_payload as VisualSectionRecord["contentPayload"]) ?? {},
    createdFromPlan: row.created_from_plan ? String(row.created_from_plan) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function buildVisualBundle(
  bundle: ProjectPlanBundle,
  visualState: VisualStateRecord,
  visualPages: VisualPageRecord[],
  visualSections: VisualSectionRecord[],
): ProjectVisualBundle {
  const sourceRevision =
    bundle.revisions.find((revision) => revision.revisionNumber === visualState.scaffoldSourceRevisionNumber) ??
    bundle.revisions[0];
  const approvedRevision = bundle.revisions.find((revision) => revision.state === "approved") ?? null;
  const latestRelevantRevision = approvedRevision ?? bundle.revisions[0];

  return {
    workspace: bundle.workspace,
    project: bundle.project,
    latestRevision: bundle.revisions[0],
    currentUser: bundle.currentUser,
    membership: bundle.membership,
    workspacePermissions: bundle.workspacePermissions,
    projectPermissions: bundle.projectPermissions,
    revisions: bundle.revisions,
    visualState,
    visualPages: sortPages(visualPages),
    visualSections: sortSections(visualSections),
    sourceRevision,
    syncState: {
      sourceRevisionNumber: visualState.scaffoldSourceRevisionNumber,
      sourceRevisionState: sourceRevision.state,
      latestRevisionNumber: bundle.revisions[0].revisionNumber,
      approvedRevisionNumber: approvedRevision?.revisionNumber ?? null,
      hasManualChanges: visualState.manualChanges,
      needsRegeneration: latestRelevantRevision.revisionNumber > visualState.scaffoldSourceRevisionNumber,
    },
  };
}

async function touchProjectLocal(projectId: string, timestamp: string) {
  const store = await readLocalStore();
  const projectIndex = store.projects.findIndex((project) => project.id === projectId);

  if (projectIndex !== -1) {
    store.projects[projectIndex] = {
      ...store.projects[projectIndex],
      updatedAt: timestamp,
    };
    await writeLocalStore(store);
  }
}

async function getVisualRecordsLocal(projectId: string) {
  const store = await readLocalStore();
  const visualState = store.visualStates.find((state) => state.projectId === projectId) ?? null;

  if (!visualState) {
    return null;
  }

  return {
    visualState,
    visualPages: store.visualPages.filter((page) => page.projectId === projectId),
    visualSections: store.visualSections.filter((section) => section.projectId === projectId),
  };
}

function generationTargetTimestamp(target: ProjectGenerationTargetBundle) {
  return target.run.completedAt ?? target.run.updatedAt ?? target.run.createdAt;
}

function buildVisualScaffoldFromGenerationTarget(
  bundle: ProjectPlanBundle,
  target: ProjectGenerationTargetBundle,
  existingState: VisualStateRecord | null,
): GeneratedVisualScaffold {
  const timestamp = generationTargetTimestamp(target);
  const visualStateId = existingState?.id ?? crypto.randomUUID();
  const preferredActivePageId =
    (existingState?.activePageId &&
    target.visualPages.some((page) => page.id === existingState.activePageId)
      ? existingState.activePageId
      : null) ?? target.visualPages[0]?.id ?? "";
  const visualState: VisualStateRecord = {
    id: visualStateId,
    projectId: bundle.project.id,
    activePageId: preferredActivePageId,
    themeTokens: target.themeTarget,
    scaffoldSourceRevisionNumber: target.run.sourcePlanRevisionNumber,
    manualChanges: false,
    lastScaffoldAt: timestamp,
    createdAt: existingState?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  const visualPages = target.visualPages.map<VisualPageRecord>((page) => ({
    id: page.id,
    visualStateId,
    projectId: bundle.project.id,
    pageKey: page.pageKey,
    title: page.title,
    slug: page.slug,
    orderIndex: page.orderIndex,
    contentPayload: page.contentPayload,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  const visualSections = target.visualSections.map<VisualSectionRecord>((section) => ({
    id: section.id,
    visualStateId,
    projectId: bundle.project.id,
    pageId: section.pageId,
    sectionKey: section.sectionKey,
    sectionType: section.sectionType,
    title: section.title,
    label: section.label,
    orderIndex: section.orderIndex,
    isVisible: section.isVisible,
    contentPayload: section.contentPayload,
    createdFromPlan: section.createdFromPlan,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  return {
    visualState,
    visualPages,
    visualSections,
    sourceRevision:
      bundle.revisions.find((revision) => revision.id === target.run.sourcePlanRevisionId) ??
      bundle.revisions.find((revision) => revision.revisionNumber === target.run.sourcePlanRevisionNumber) ??
      bundle.revisions[0],
  };
}

async function replaceVisualScaffoldLocal(
  bundle: ProjectPlanBundle,
  trigger: "system" | "user" = "system",
  scaffoldOverride: GeneratedVisualScaffold | null = null,
  generationRunId: string | null = null,
) {
  const store = await readLocalStore();
  const existingState = store.visualStates.find((state) => state.projectId === bundle.project.id) ?? null;
  const scaffold =
    scaffoldOverride ??
    createVisualScaffold({
      project: bundle.project,
      revisions: bundle.revisions,
      existingState,
      existingTokens: existingState?.themeTokens ?? null,
    });

  store.visualStates = [
    scaffold.visualState,
    ...store.visualStates.filter((state) => state.projectId !== bundle.project.id),
  ];
  store.visualPages = [
    ...store.visualPages.filter((page) => page.projectId !== bundle.project.id),
    ...scaffold.visualPages,
  ];
  store.visualSections = [
    ...store.visualSections.filter((section) => section.projectId !== bundle.project.id),
    ...scaffold.visualSections,
  ];

  const projectIndex = store.projects.findIndex((project) => project.id === bundle.project.id);

  if (projectIndex !== -1) {
    store.projects[projectIndex] = {
      ...store.projects[projectIndex],
      updatedAt: scaffold.visualState.updatedAt,
    };
  }

  await writeLocalStore(store);
  await appendProjectAuditEvent({
    id: `audit-visual-scaffold-${scaffold.visualState.id}-${scaffold.visualState.lastScaffoldAt}`,
    projectId: bundle.project.id,
    workspaceId: bundle.workspace.id,
    source: "visual",
    kind: "visual_scaffold",
    title: trigger === "user" ? "Visual scaffold regenerated" : "Visual scaffold created",
    summary: generationRunId
      ? `${scaffold.visualPages.length} page surfaces were applied from generation run ${generationRunId} for plan revision ${scaffold.visualState.scaffoldSourceRevisionNumber}.`
      : `${scaffold.visualPages.length} page surfaces were mapped from plan revision ${scaffold.visualState.scaffoldSourceRevisionNumber}.`,
    actorType: trigger,
    actorLabel: trigger === "user" ? "workspace_editor" : "visual_scaffold",
    entityType: "visual_state",
    entityId: scaffold.visualState.id,
    linkedTab: "visual",
    linkContext: {
      tab: "visual",
      generationRunId,
      planRevisionNumber: scaffold.visualState.scaffoldSourceRevisionNumber,
      visualPageId: scaffold.visualState.activePageId || scaffold.visualPages[0]?.id || null,
    },
    metadata: {
      pageCount: scaffold.visualPages.length,
      scaffoldSourceRevisionNumber: scaffold.visualState.scaffoldSourceRevisionNumber,
      generationRunId,
    },
    occurredAt: scaffold.visualState.lastScaffoldAt,
  });

  return {
    visualState: scaffold.visualState,
    visualPages: scaffold.visualPages,
    visualSections: scaffold.visualSections,
  };
}

async function updateVisualSectionLocal(input: UpdateVisualSectionInput) {
  const store = await readLocalStore();
  const sectionIndex = store.visualSections.findIndex((section) => section.id === input.sectionId);
  const stateIndex = store.visualStates.findIndex((state) => state.id === input.visualStateId);

  if (sectionIndex === -1 || stateIndex === -1) {
    throw new Error("Visual section not found.");
  }

  const timestamp = nowIso();
  const currentSection = store.visualSections[sectionIndex];
  const project = store.projects.find((item) => item.id === currentSection.projectId) ?? null;

  store.visualSections[sectionIndex] = {
    ...currentSection,
    title: input.title,
    label: input.label,
    isVisible: input.isVisible,
    contentPayload: {
      ...currentSection.contentPayload,
      body: input.body,
      items: input.items,
    },
    updatedAt: timestamp,
  };

  store.visualStates[stateIndex] = {
    ...store.visualStates[stateIndex],
    manualChanges: true,
    updatedAt: timestamp,
  };

  await writeLocalStore(store);
  await touchProjectLocal(store.visualStates[stateIndex].projectId, timestamp);

  if (project) {
    await appendProjectAuditEvent({
      projectId: project.id,
      workspaceId: project.workspaceId,
      source: "visual",
      kind: "visual_section_updated",
      title: `Visual section updated: ${input.title}`,
      summary: `Section metadata and content were updated for ${input.title}.`,
      actorType: "user",
      actorLabel: "workspace_editor",
      entityType: "visual_section",
      entityId: input.sectionId,
      linkedTab: "visual",
      linkContext: {
        tab: "visual",
        visualPageId: currentSection.pageId,
        visualSectionId: input.sectionId,
      },
      metadata: {
        sectionType: currentSection.sectionType,
        isVisible: input.isVisible,
      },
      occurredAt: timestamp,
    });
  }
}

async function moveVisualSectionLocal(input: MoveVisualSectionInput) {
  const store = await readLocalStore();
  const section = store.visualSections.find((item) => item.id === input.sectionId);
  const stateIndex = store.visualStates.findIndex((state) => state.id === input.visualStateId);

  if (!section || stateIndex === -1) {
    throw new Error("Visual section not found.");
  }

  const pageSections = sortSections(store.visualSections.filter((item) => item.pageId === section.pageId));
  const currentIndex = pageSections.findIndex((item) => item.id === section.id);
  const targetIndex = input.direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex === -1 || targetIndex < 0 || targetIndex >= pageSections.length) {
    return;
  }

  const timestamp = nowIso();
  const currentSection = pageSections[currentIndex];
  const targetSection = pageSections[targetIndex];
  const currentStoreIndex = store.visualSections.findIndex((item) => item.id === currentSection.id);
  const targetStoreIndex = store.visualSections.findIndex((item) => item.id === targetSection.id);
  const project = store.projects.find((item) => item.id === section.projectId) ?? null;

  store.visualSections[currentStoreIndex] = {
    ...store.visualSections[currentStoreIndex],
    orderIndex: targetSection.orderIndex,
    updatedAt: timestamp,
  };
  store.visualSections[targetStoreIndex] = {
    ...store.visualSections[targetStoreIndex],
    orderIndex: currentSection.orderIndex,
    updatedAt: timestamp,
  };
  store.visualStates[stateIndex] = {
    ...store.visualStates[stateIndex],
    manualChanges: true,
    updatedAt: timestamp,
  };

  await writeLocalStore(store);
  await touchProjectLocal(store.visualStates[stateIndex].projectId, timestamp);

  if (project) {
    await appendProjectAuditEvent({
      projectId: project.id,
      workspaceId: project.workspaceId,
      source: "visual",
      kind: "visual_section_reordered",
      title: `Visual sections reordered on ${section.pageId}`,
      summary: `${currentSection.title} moved ${input.direction} within the current page structure.`,
      actorType: "user",
      actorLabel: "workspace_editor",
      entityType: "visual_section",
      entityId: section.id,
      linkedTab: "visual",
      linkContext: {
        tab: "visual",
        visualPageId: section.pageId,
        visualSectionId: section.id,
      },
      metadata: {
        direction: input.direction,
        swappedWithSectionId: targetSection.id,
      },
      occurredAt: timestamp,
    });
  }
}

async function updateVisualThemeTokensLocal(input: UpdateVisualThemeTokensInput) {
  const store = await readLocalStore();
  const stateIndex = store.visualStates.findIndex((state) => state.id === input.visualStateId);

  if (stateIndex === -1) {
    throw new Error("Visual state not found.");
  }

  const timestamp = nowIso();
  const state = store.visualStates[stateIndex];
  const project = store.projects.find((item) => item.id === state.projectId) ?? null;

  store.visualStates[stateIndex] = {
    ...state,
    themeTokens: input.tokens,
    manualChanges: true,
    updatedAt: timestamp,
  };

  await writeLocalStore(store);
  await touchProjectLocal(store.visualStates[stateIndex].projectId, timestamp);

  if (project) {
    await appendProjectAuditEvent({
      projectId: project.id,
      workspaceId: project.workspaceId,
      source: "visual",
      kind: "visual_theme_updated",
      title: "Visual theme tokens updated",
      summary: `Primary, surface, typography, radius, and spacing tokens were updated for the visual scaffold.`,
      actorType: "user",
      actorLabel: "workspace_editor",
      entityType: "visual_theme",
      entityId: state.id,
      linkedTab: "visual",
      linkContext: {
        tab: "visual",
        visualPageId: state.activePageId || null,
      },
      metadata: {
        primaryColor: input.tokens.primaryColor,
        secondaryColor: input.tokens.secondaryColor,
        headingFontLabel: input.tokens.headingFontLabel,
      },
      occurredAt: timestamp,
    });
  }
}

async function getVisualRecordsSupabase(projectId: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return null;
  }

  const { data: stateRow, error: stateError } = await client
    .from("project_visual_states")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (stateError) {
    throw new Error(stateError.message);
  }

  if (!stateRow) {
    return null;
  }

  const [{ data: pages, error: pagesError }, { data: sections, error: sectionsError }] = await Promise.all([
    client.from("project_visual_pages").select("*").eq("project_id", projectId).order("order_index", { ascending: true }),
    client.from("project_visual_sections").select("*").eq("project_id", projectId).order("order_index", { ascending: true }),
  ]);

  if (pagesError) {
    throw new Error(pagesError.message);
  }

  if (sectionsError) {
    throw new Error(sectionsError.message);
  }

  return {
    visualState: mapVisualStateRow(stateRow as unknown as Record<string, unknown>),
    visualPages: (pages ?? []).map((row) => mapVisualPageRow(row as unknown as Record<string, unknown>)),
    visualSections: (sections ?? []).map((row) => mapVisualSectionRow(row as unknown as Record<string, unknown>)),
  };
}

async function replaceVisualScaffoldSupabase(
  bundle: ProjectPlanBundle,
  trigger: "system" | "user" = "system",
  scaffoldOverride: GeneratedVisualScaffold | null = null,
  generationRunId: string | null = null,
) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const existing = await getVisualRecordsSupabase(bundle.project.id);
  const scaffold =
    scaffoldOverride ??
    createVisualScaffold({
      project: bundle.project,
      revisions: bundle.revisions,
      existingState: existing?.visualState ?? null,
      existingTokens: existing?.visualState.themeTokens ?? null,
    });

  if (existing?.visualState) {
    const { error: deleteSectionsError } = await client
      .from("project_visual_sections")
      .delete()
      .eq("project_id", bundle.project.id);

    if (deleteSectionsError) {
      throw new Error(deleteSectionsError.message);
    }

    const { error: deletePagesError } = await client
      .from("project_visual_pages")
      .delete()
      .eq("project_id", bundle.project.id);

    if (deletePagesError) {
      throw new Error(deletePagesError.message);
    }

    const { error: updateStateError } = await client
      .from("project_visual_states")
      .update({
        active_page_id: scaffold.visualState.activePageId,
        theme_tokens: scaffold.visualState.themeTokens,
        scaffold_source_revision_number: scaffold.visualState.scaffoldSourceRevisionNumber,
        manual_changes: scaffold.visualState.manualChanges,
        last_scaffold_at: scaffold.visualState.lastScaffoldAt,
        updated_at: scaffold.visualState.updatedAt,
      })
      .eq("id", scaffold.visualState.id);

    if (updateStateError) {
      throw new Error(updateStateError.message);
    }
  } else {
    const { error: createStateError } = await client.from("project_visual_states").insert({
      id: scaffold.visualState.id,
      project_id: scaffold.visualState.projectId,
      active_page_id: scaffold.visualState.activePageId,
      theme_tokens: scaffold.visualState.themeTokens,
      scaffold_source_revision_number: scaffold.visualState.scaffoldSourceRevisionNumber,
      manual_changes: scaffold.visualState.manualChanges,
      last_scaffold_at: scaffold.visualState.lastScaffoldAt,
      created_at: scaffold.visualState.createdAt,
      updated_at: scaffold.visualState.updatedAt,
    });

    if (createStateError) {
      throw new Error(createStateError.message);
    }
  }

  const { error: createPagesError } = await client.from("project_visual_pages").insert(
    scaffold.visualPages.map((page) => ({
      id: page.id,
      visual_state_id: page.visualStateId,
      project_id: page.projectId,
      page_key: page.pageKey,
      title: page.title,
      slug: page.slug,
      order_index: page.orderIndex,
      content_payload: page.contentPayload,
      created_at: page.createdAt,
      updated_at: page.updatedAt,
    })),
  );

  if (createPagesError) {
    throw new Error(createPagesError.message);
  }

  const { error: createSectionsError } = await client.from("project_visual_sections").insert(
    scaffold.visualSections.map((section) => ({
      id: section.id,
      visual_state_id: section.visualStateId,
      project_id: section.projectId,
      page_id: section.pageId,
      section_key: section.sectionKey,
      section_type: section.sectionType,
      title: section.title,
      label: section.label,
      order_index: section.orderIndex,
      is_visible: section.isVisible,
      content_payload: section.contentPayload,
      created_from_plan: section.createdFromPlan,
      created_at: section.createdAt,
      updated_at: section.updatedAt,
    })),
  );

  if (createSectionsError) {
    throw new Error(createSectionsError.message);
  }

  const { error: touchProjectError } = await client
    .from("projects")
    .update({
      updated_at: scaffold.visualState.updatedAt,
    })
    .eq("id", bundle.project.id);

  if (touchProjectError) {
    throw new Error(touchProjectError.message);
  }

  await appendProjectAuditEvent({
    id: `audit-visual-scaffold-${scaffold.visualState.id}-${scaffold.visualState.lastScaffoldAt}`,
    projectId: bundle.project.id,
    workspaceId: bundle.workspace.id,
    source: "visual",
    kind: "visual_scaffold",
    title: trigger === "user" ? "Visual scaffold regenerated" : "Visual scaffold created",
    summary: generationRunId
      ? `${scaffold.visualPages.length} page surfaces were applied from generation run ${generationRunId} for plan revision ${scaffold.visualState.scaffoldSourceRevisionNumber}.`
      : `${scaffold.visualPages.length} page surfaces were mapped from plan revision ${scaffold.visualState.scaffoldSourceRevisionNumber}.`,
    actorType: trigger,
    actorLabel: trigger === "user" ? "workspace_editor" : "visual_scaffold",
    entityType: "visual_state",
    entityId: scaffold.visualState.id,
    linkedTab: "visual",
    linkContext: {
      tab: "visual",
      generationRunId,
      planRevisionNumber: scaffold.visualState.scaffoldSourceRevisionNumber,
      visualPageId: scaffold.visualState.activePageId || scaffold.visualPages[0]?.id || null,
    },
    metadata: {
      pageCount: scaffold.visualPages.length,
      scaffoldSourceRevisionNumber: scaffold.visualState.scaffoldSourceRevisionNumber,
      generationRunId,
    },
    occurredAt: scaffold.visualState.lastScaffoldAt,
  });

  return {
    visualState: scaffold.visualState,
    visualPages: scaffold.visualPages,
    visualSections: scaffold.visualSections,
  };
}

async function updateVisualSectionSupabase(input: UpdateVisualSectionInput) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const timestamp = nowIso();
  const { data: sectionRow, error: sectionError } = await client
    .from("project_visual_sections")
    .update({
      title: input.title,
      label: input.label,
      is_visible: input.isVisible,
      content_payload: {
        body: input.body,
        items: input.items,
      },
      updated_at: timestamp,
    })
    .eq("id", input.sectionId)
    .select("id, project_id, page_id, section_type")
    .single();

  if (sectionError) {
    throw new Error(sectionError.message);
  }

  const { data: stateRow, error: stateError } = await client
    .from("project_visual_states")
    .update({
      manual_changes: true,
      updated_at: timestamp,
    })
    .eq("id", input.visualStateId)
    .select("project_id")
    .single();

  if (stateError) {
    throw new Error(stateError.message);
  }

  const { error: projectError } = await client
    .from("projects")
    .update({
      updated_at: timestamp,
    })
    .eq("id", String(stateRow.project_id));

  if (projectError) {
    throw new Error(projectError.message);
  }

  const { data: projectRow, error: workspaceError } = await client
    .from("projects")
    .select("workspace_id")
    .eq("id", String(stateRow.project_id))
    .single();

  if (workspaceError) {
    throw new Error(workspaceError.message);
  }

  await appendProjectAuditEvent({
    projectId: String(stateRow.project_id),
    workspaceId: String(projectRow.workspace_id),
    source: "visual",
    kind: "visual_section_updated",
    title: `Visual section updated: ${input.title}`,
    summary: `Section metadata and content were updated for ${input.title}.`,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "visual_section",
    entityId: String(sectionRow.id),
    linkedTab: "visual",
    linkContext: {
      tab: "visual",
      visualPageId: String(sectionRow.page_id),
      visualSectionId: String(sectionRow.id),
    },
    metadata: {
      sectionType: String(sectionRow.section_type),
      isVisible: input.isVisible,
    },
    occurredAt: timestamp,
  });
}

async function moveVisualSectionSupabase(input: MoveVisualSectionInput) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data: sectionRows, error: sectionError } = await client
    .from("project_visual_sections")
    .select("id, page_id, order_index")
    .eq("visual_state_id", input.visualStateId)
    .order("order_index", { ascending: true });

  if (sectionError) {
    throw new Error(sectionError.message);
  }

  const current = (sectionRows ?? []).find((row) => String(row.id) === input.sectionId);

  if (!current) {
    throw new Error("Visual section not found.");
  }

  const pageSections = (sectionRows ?? [])
    .filter((row) => String(row.page_id) === String(current.page_id))
    .sort((a, b) => Number(a.order_index) - Number(b.order_index));
  const currentIndex = pageSections.findIndex((row) => String(row.id) === input.sectionId);
  const targetIndex = input.direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex === -1 || targetIndex < 0 || targetIndex >= pageSections.length) {
    return;
  }

  const target = pageSections[targetIndex];
  const timestamp = nowIso();

  const [{ error: currentUpdateError }, { error: targetUpdateError }] = await Promise.all([
    client.from("project_visual_sections").update({
      order_index: Number(target.order_index),
      updated_at: timestamp,
    }).eq("id", String(current.id)),
    client.from("project_visual_sections").update({
      order_index: Number(current.order_index),
      updated_at: timestamp,
    }).eq("id", String(target.id)),
  ]);

  if (currentUpdateError) {
    throw new Error(currentUpdateError.message);
  }

  if (targetUpdateError) {
    throw new Error(targetUpdateError.message);
  }

  const { data: stateRow, error: stateError } = await client
    .from("project_visual_states")
    .update({
      manual_changes: true,
      updated_at: timestamp,
    })
    .eq("id", input.visualStateId)
    .select("project_id")
    .single();

  if (stateError) {
    throw new Error(stateError.message);
  }

  const { error: projectError } = await client
    .from("projects")
    .update({
      updated_at: timestamp,
    })
    .eq("id", String(stateRow.project_id));

  if (projectError) {
    throw new Error(projectError.message);
  }

  const { data: projectRow, error: workspaceError } = await client
    .from("projects")
    .select("workspace_id")
    .eq("id", String(stateRow.project_id))
    .single();

  if (workspaceError) {
    throw new Error(workspaceError.message);
  }

  await appendProjectAuditEvent({
    projectId: String(stateRow.project_id),
    workspaceId: String(projectRow.workspace_id),
    source: "visual",
    kind: "visual_section_reordered",
    title: `Visual sections reordered on ${String(current.page_id)}`,
    summary: `A section moved ${input.direction} inside the current page structure.`,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "visual_section",
    entityId: String(current.id),
    linkedTab: "visual",
    linkContext: {
      tab: "visual",
      visualPageId: String(current.page_id),
      visualSectionId: String(current.id),
    },
    metadata: {
      direction: input.direction,
      swappedWithSectionId: String(target.id),
    },
    occurredAt: timestamp,
  });
}

async function updateVisualThemeTokensSupabase(input: UpdateVisualThemeTokensInput) {
  const client = createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const timestamp = nowIso();
  const { data: stateRow, error: stateError } = await client
    .from("project_visual_states")
    .update({
      theme_tokens: input.tokens,
      manual_changes: true,
      updated_at: timestamp,
    })
    .eq("id", input.visualStateId)
    .select("project_id")
    .single();

  if (stateError) {
    throw new Error(stateError.message);
  }

  const { error: projectError } = await client
    .from("projects")
    .update({
      updated_at: timestamp,
    })
    .eq("id", String(stateRow.project_id));

  if (projectError) {
    throw new Error(projectError.message);
  }

  const { data: projectRow, error: workspaceError } = await client
    .from("projects")
    .select("workspace_id")
    .eq("id", String(stateRow.project_id))
    .single();

  if (workspaceError) {
    throw new Error(workspaceError.message);
  }

  await appendProjectAuditEvent({
    projectId: String(stateRow.project_id),
    workspaceId: String(projectRow.workspace_id),
    source: "visual",
    kind: "visual_theme_updated",
    title: "Visual theme tokens updated",
    summary: `Primary, surface, typography, radius, and spacing tokens were updated for the visual scaffold.`,
    actorType: "user",
    actorLabel: "workspace_editor",
    entityType: "visual_theme",
    entityId: input.visualStateId,
    linkedTab: "visual",
    linkContext: {
      tab: "visual",
    },
    metadata: {
      primaryColor: input.tokens.primaryColor,
      secondaryColor: input.tokens.secondaryColor,
      headingFontLabel: input.tokens.headingFontLabel,
    },
    occurredAt: timestamp,
  });
}

async function ensureVisualRecords(bundle: ProjectPlanBundle) {
  if (isSupabaseConfigured()) {
    const existing = await getVisualRecordsSupabase(bundle.project.id);

    if (existing && existing.visualPages.length > 0 && existing.visualSections.length > 0) {
      return existing;
    }

    return replaceVisualScaffoldSupabase(bundle, "system");
  }

  const existing = await getVisualRecordsLocal(bundle.project.id);

  if (existing && existing.visualPages.length > 0 && existing.visualSections.length > 0) {
    return existing;
  }

  return replaceVisualScaffoldLocal(bundle, "system");
}

export async function getProjectVisualBundle(
  workspaceSlug: string,
  projectSlug: string,
): Promise<ProjectVisualBundle | null> {
  const bundle = await getProjectPlanBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    return null;
  }

  const visual = await ensureVisualRecords(bundle);

  return buildVisualBundle(bundle, visual.visualState, visual.visualPages, visual.visualSections);
}

export async function getProjectVisualBundleSnapshot(
  workspaceSlug: string,
  projectSlug: string,
): Promise<ProjectVisualBundle | null> {
  const bundle = await getProjectPlanBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    return null;
  }

  const visual = isSupabaseConfigured()
    ? await getVisualRecordsSupabase(bundle.project.id)
    : await getVisualRecordsLocal(bundle.project.id);

  if (!visual || visual.visualPages.length === 0 || visual.visualSections.length === 0) {
    return null;
  }

  return buildVisualBundle(bundle, visual.visualState, visual.visualPages, visual.visualSections);
}

export async function regenerateProjectVisualScaffold(workspaceSlug: string, projectSlug: string) {
  const bundle = await getProjectPlanBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  return isSupabaseConfigured()
    ? replaceVisualScaffoldSupabase(bundle, "user")
    : replaceVisualScaffoldLocal(bundle, "user");
}

export async function applyProjectVisualGenerationTarget(
  workspaceSlug: string,
  projectSlug: string,
  generationRunId: string,
) {
  const [bundle, generationTarget, visualSnapshot] = await Promise.all([
    getProjectPlanBundle(workspaceSlug, projectSlug),
    getProjectGenerationTargetBundle(workspaceSlug, projectSlug, generationRunId),
    getProjectVisualBundleSnapshot(workspaceSlug, projectSlug),
  ]);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  if (!generationTarget) {
    throw new Error("The selected generation target could not be loaded.");
  }

  if (generationTarget.run.status !== "completed") {
    throw new Error("Only completed generation runs can be consumed by Visual.");
  }

  const scaffold = buildVisualScaffoldFromGenerationTarget(
    bundle,
    generationTarget,
    visualSnapshot?.visualState ?? null,
  );

  return isSupabaseConfigured()
    ? replaceVisualScaffoldSupabase(bundle, "user", scaffold, generationTarget.run.id)
    : replaceVisualScaffoldLocal(bundle, "user", scaffold, generationTarget.run.id);
}

export async function updateProjectVisualSection(input: UpdateVisualSectionInput) {
  if (isSupabaseConfigured()) {
    return updateVisualSectionSupabase(input);
  }

  return updateVisualSectionLocal(input);
}

export async function moveProjectVisualSection(input: MoveVisualSectionInput) {
  if (isSupabaseConfigured()) {
    return moveVisualSectionSupabase(input);
  }

  return moveVisualSectionLocal(input);
}

export async function updateProjectVisualThemeTokens(input: UpdateVisualThemeTokensInput) {
  if (isSupabaseConfigured()) {
    return updateVisualThemeTokensSupabase(input);
  }

  return updateVisualThemeTokensLocal(input);
}
