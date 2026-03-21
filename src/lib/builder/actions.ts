"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertProjectPermission } from "@/lib/auth/access";
import {
  completeProjectBuilderRefreshQueueItem,
  deferProjectBuilderRefreshQueueItem,
  getActiveBuilderRefreshQueueItem,
  listProjectBuilderRefreshQueue,
} from "@/lib/builder/refresh-queue-repository";
import { projectBaseRoute, projectTabRoute, projectTimelineRoute } from "@/lib/builder/routes";
import {
  applyProjectVisualGenerationTarget,
  getProjectVisualBundle,
  moveProjectVisualSection,
  regenerateProjectVisualScaffold,
  updateProjectVisualSection,
  updateProjectVisualThemeTokens,
} from "@/lib/builder/repository";

function buildVisualRoute(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  selectedPageId?: string | null,
  selectedSectionId?: string | null,
) {
  const url = new URL(projectTabRoute(locale, workspaceSlug, projectSlug, "visual"), "https://builder.local");

  if (selectedPageId) {
    url.searchParams.set("page", selectedPageId);
  }

  if (selectedSectionId) {
    url.searchParams.set("section", selectedSectionId);
  }

  return `${url.pathname}${url.search}`;
}

function revalidateVisualProjectRoutes(locale: string, workspaceSlug: string, projectSlug: string) {
  revalidatePath(projectBaseRoute(locale, workspaceSlug, projectSlug), "layout");
  revalidatePath(projectTabRoute(locale, workspaceSlug, projectSlug, "visual"));
  revalidatePath(projectTabRoute(locale, workspaceSlug, projectSlug, "preview"));
  revalidatePath(projectTimelineRoute(locale, workspaceSlug, projectSlug));
}

function parseItems(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function updateVisualSectionAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  formData: FormData,
) {
  const visualStateId = String(formData.get("visualStateId") ?? "");
  const sectionId = String(formData.get("sectionId") ?? "");
  const selectedPageId = String(formData.get("selectedPageId") ?? "");
  const selectedSectionId = String(formData.get("selectedSectionId") ?? sectionId);
  const bundle = await getProjectVisualBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  assertProjectPermission(
    bundle.projectPermissions,
    "canIntakeVisual",
    "You do not have permission to edit the Visual surface for this project.",
  );

  await updateProjectVisualSection({
    visualStateId,
    sectionId,
    title: String(formData.get("title") ?? "").trim(),
    label: String(formData.get("label") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim(),
    items: parseItems(String(formData.get("items") ?? "")),
    isVisible: formData.get("isVisible") === "on",
  });

  revalidateVisualProjectRoutes(locale, workspaceSlug, projectSlug);
  redirect(buildVisualRoute(locale, workspaceSlug, projectSlug, selectedPageId, selectedSectionId));
}

export async function moveVisualSectionAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  direction: "up" | "down",
  formData: FormData,
) {
  const visualStateId = String(formData.get("visualStateId") ?? "");
  const sectionId = String(formData.get("sectionId") ?? "");
  const selectedPageId = String(formData.get("selectedPageId") ?? "");
  const selectedSectionId = String(formData.get("selectedSectionId") ?? sectionId);
  const bundle = await getProjectVisualBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  assertProjectPermission(
    bundle.projectPermissions,
    "canIntakeVisual",
    "You do not have permission to reorder Visual sections for this project.",
  );

  await moveProjectVisualSection({
    visualStateId,
    sectionId,
    direction,
  });

  revalidateVisualProjectRoutes(locale, workspaceSlug, projectSlug);
  redirect(buildVisualRoute(locale, workspaceSlug, projectSlug, selectedPageId, selectedSectionId));
}

export async function updateVisualThemeTokensAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  formData: FormData,
) {
  const visualStateId = String(formData.get("visualStateId") ?? "");
  const selectedPageId = String(formData.get("selectedPageId") ?? "");
  const selectedSectionId = String(formData.get("selectedSectionId") ?? "");
  const bundle = await getProjectVisualBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  assertProjectPermission(
    bundle.projectPermissions,
    "canIntakeVisual",
    "You do not have permission to update theme tokens for this project.",
  );

  await updateProjectVisualThemeTokens({
    visualStateId,
    tokens: {
      primaryColor: String(formData.get("primaryColor") ?? "#0f172a").trim(),
      secondaryColor: String(formData.get("secondaryColor") ?? "#0f766e").trim(),
      backgroundColor: String(formData.get("backgroundColor") ?? "#f8fafc").trim(),
      surfaceColor: String(formData.get("surfaceColor") ?? "#ffffff").trim(),
      textColor: String(formData.get("textColor") ?? "#111827").trim(),
      headingFontLabel: String(formData.get("headingFontLabel") ?? "Premium Grotesk").trim(),
      radiusScale: String(formData.get("radiusScale") ?? "large").trim(),
      spacingScale: String(formData.get("spacingScale") ?? "balanced").trim(),
    },
  });

  revalidateVisualProjectRoutes(locale, workspaceSlug, projectSlug);
  redirect(buildVisualRoute(locale, workspaceSlug, projectSlug, selectedPageId, selectedSectionId));
}

export async function regenerateVisualScaffoldAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
) {
  const bundle = await getProjectVisualBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  assertProjectPermission(
    bundle.projectPermissions,
    "canIntakeVisual",
    "You do not have permission to regenerate the Visual scaffold for this project.",
  );

  await regenerateProjectVisualScaffold(workspaceSlug, projectSlug);
  const refreshedBundle = await getProjectVisualBundle(workspaceSlug, projectSlug);

  if (!refreshedBundle) {
    redirect(projectTabRoute(locale, workspaceSlug, projectSlug, "visual"));
  }

  const firstPageId = refreshedBundle.visualPages[0]?.id ?? null;
  const firstSectionId =
    refreshedBundle.visualSections.find((section) => section.pageId === firstPageId)?.id ?? null;

  revalidateVisualProjectRoutes(locale, workspaceSlug, projectSlug);
  redirect(buildVisualRoute(locale, workspaceSlug, projectSlug, firstPageId, firstSectionId));
}

export async function acceptVisualRefreshQueueAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  formData: FormData,
) {
  const queueItemId = String(formData.get("queueItemId") ?? "");
  const selectedPageId = String(formData.get("selectedPageId") ?? "");
  const selectedSectionId = String(formData.get("selectedSectionId") ?? "");
  const queueItems = await listProjectBuilderRefreshQueue(workspaceSlug, projectSlug);
  const activeItem =
    queueItems.find((item) => item.id === queueItemId && item.surface === "visual") ??
    getActiveBuilderRefreshQueueItem(queueItems, "visual");

  if (!activeItem || activeItem.status === "completed" || activeItem.status === "stale") {
    redirect(buildVisualRoute(locale, workspaceSlug, projectSlug, selectedPageId, selectedSectionId));
  }

  let bundle = await getProjectVisualBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    redirect(projectTabRoute(locale, workspaceSlug, projectSlug, "visual"));
  }

  assertProjectPermission(
    bundle.projectPermissions,
    "canIntakeVisual",
    "You do not have permission to intake Visual refresh work for this project.",
  );

  if (bundle.syncState.sourceRevisionNumber < activeItem.targetPlanRevisionNumber) {
    if (activeItem.generationRunId) {
      await applyProjectVisualGenerationTarget(workspaceSlug, projectSlug, activeItem.generationRunId);
    } else {
      await regenerateProjectVisualScaffold(workspaceSlug, projectSlug);
    }
    bundle = await getProjectVisualBundle(workspaceSlug, projectSlug);

    if (!bundle) {
      redirect(projectTabRoute(locale, workspaceSlug, projectSlug, "visual"));
    }
  }

  if (bundle.syncState.sourceRevisionNumber < activeItem.targetPlanRevisionNumber) {
    throw new Error("Visual scaffold is still behind the approved target revision.");
  }

  await completeProjectBuilderRefreshQueueItem({
    workspaceSlug,
    projectSlug,
    queueItemId: activeItem.id,
  });

  const firstPageId = selectedPageId || bundle.visualPages[0]?.id || null;
  const firstSectionId =
    selectedSectionId ||
    bundle.visualSections.find((section) => section.pageId === firstPageId)?.id ||
    null;

  revalidateVisualProjectRoutes(locale, workspaceSlug, projectSlug);
  revalidatePath(projectTabRoute(locale, workspaceSlug, projectSlug, "code"));
  redirect(buildVisualRoute(locale, workspaceSlug, projectSlug, firstPageId, firstSectionId));
}

export async function deferVisualRefreshQueueAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  formData: FormData,
) {
  const queueItemId = String(formData.get("queueItemId") ?? "");
  const deferReason =
    String(formData.get("deferReason") ?? "").trim() ||
    "Deferred from Visual until the team is ready to update the scaffold.";
  const selectedPageId = String(formData.get("selectedPageId") ?? "");
  const selectedSectionId = String(formData.get("selectedSectionId") ?? "");
  const queueItems = await listProjectBuilderRefreshQueue(workspaceSlug, projectSlug);
  const queueItem = queueItems.find((item) => item.id === queueItemId && item.surface === "visual");

  if (!queueItem || queueItem.status === "stale" || queueItem.status === "completed") {
    redirect(buildVisualRoute(locale, workspaceSlug, projectSlug, selectedPageId, selectedSectionId));
  }

  const bundle = await getProjectVisualBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  assertProjectPermission(
    bundle.projectPermissions,
    "canIntakeVisual",
    "You do not have permission to defer Visual queue work for this project.",
  );

  await deferProjectBuilderRefreshQueueItem({
    workspaceSlug,
    projectSlug,
    queueItemId,
    deferReason,
  });

  revalidateVisualProjectRoutes(locale, workspaceSlug, projectSlug);
  redirect(buildVisualRoute(locale, workspaceSlug, projectSlug, selectedPageId, selectedSectionId));
}
