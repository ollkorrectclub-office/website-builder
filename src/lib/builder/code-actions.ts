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
  archiveProjectCodePatchProposal,
  applyProjectCodePatchProposal,
  createProjectCodePatchProposal,
  getProjectCodeBundle,
  refreshProjectCodeScaffold,
  rejectProjectCodePatchProposal,
  restoreProjectCodeFileRevision,
  saveProjectCodeFileRevision,
  updateProjectCodeFileDraft,
} from "@/lib/builder/code-repository";
import type { CreateCodePatchProposalInput } from "@/lib/builder/types";
import type { FormState } from "@/lib/workspaces/form-state";

function buildCodeRoute(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  options: {
    filePath?: string | null;
    compareRevisionId?: string | null;
    proposalId?: string | null;
    restoreRevisionId?: string | null;
    restoreScaffold?: boolean;
  } = {},
) {
  const url = new URL(projectTabRoute(locale, workspaceSlug, projectSlug, "code"), "https://builder.local");

  if (options.filePath) {
    url.searchParams.set("file", options.filePath);
  }

  if (options.compareRevisionId) {
    url.searchParams.set("compare", options.compareRevisionId);
  }

  if (options.proposalId) {
    url.searchParams.set("proposal", options.proposalId);
  }

  if (options.restoreRevisionId) {
    url.searchParams.set("restoreRevision", options.restoreRevisionId);
  }

  if (options.restoreScaffold) {
    url.searchParams.set("restoreScaffold", "1");
  }

  return `${url.pathname}${url.search}`;
}

function revalidateCodeProjectRoutes(locale: string, workspaceSlug: string, projectSlug: string) {
  revalidatePath(projectBaseRoute(locale, workspaceSlug, projectSlug), "layout");
  revalidatePath(projectTabRoute(locale, workspaceSlug, projectSlug, "code"));
  revalidatePath(projectTimelineRoute(locale, workspaceSlug, projectSlug));
}

function parseRequestedAdapterSelection(
  value: FormDataEntryValue | null,
): CreateCodePatchProposalInput["requestedSelectionOverride"] {
  const normalized = String(value ?? "").trim();

  if (normalized === "external_model" || normalized === "deterministic_internal") {
    return normalized;
  }

  return null;
}

function parseRetryOfRunId(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

export async function saveCodeFileDraftAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  formData: FormData,
) {
  const codeStateId = String(formData.get("codeStateId") ?? "");
  const fileId = String(formData.get("fileId") ?? "");
  const filePath = String(formData.get("filePath") ?? "");
  const expectedRevisionNumber = Number(formData.get("expectedRevisionNumber") ?? 1);
  const content = String(formData.get("content") ?? "");
  const bundle = await getProjectCodeBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  assertProjectPermission(
    bundle.projectPermissions,
    "canReviewCode",
    "You do not have permission to edit code drafts for this project.",
  );

  await updateProjectCodeFileDraft({
    codeStateId,
    fileId,
    filePath,
    content,
    expectedRevisionNumber,
  });

  revalidateCodeProjectRoutes(locale, workspaceSlug, projectSlug);
  redirect(buildCodeRoute(locale, workspaceSlug, projectSlug, { filePath }));
}

export async function saveCodeFileRevisionAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  formData: FormData,
) {
  const codeStateId = String(formData.get("codeStateId") ?? "");
  const fileId = String(formData.get("fileId") ?? "");
  const filePath = String(formData.get("filePath") ?? "");
  const expectedRevisionNumber = Number(formData.get("expectedRevisionNumber") ?? 1);
  const content = String(formData.get("content") ?? "");
  const changeSummary = String(formData.get("changeSummary") ?? "");
  const bundle = await getProjectCodeBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  assertProjectPermission(
    bundle.projectPermissions,
    "canReviewCode",
    "You do not have permission to save code revisions for this project.",
  );

  await saveProjectCodeFileRevision({
    codeStateId,
    fileId,
    filePath,
    content,
    changeSummary,
    expectedRevisionNumber,
  });

  revalidateCodeProjectRoutes(locale, workspaceSlug, projectSlug);
  redirect(buildCodeRoute(locale, workspaceSlug, projectSlug, { filePath }));
}

export async function refreshCodeScaffoldAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  mode: "safe" | "force",
  formData: FormData,
) {
  const filePath = String(formData.get("filePath") ?? "");
  const confirmed = formData.get("confirmRefresh") === "on";
  const bundle = await getProjectCodeBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  assertProjectPermission(
    bundle.projectPermissions,
    "canReviewCode",
    "You do not have permission to refresh scaffold-owned files for this project.",
  );

  if (mode === "force" && !confirmed) {
    redirect(buildCodeRoute(locale, workspaceSlug, projectSlug, { filePath }));
  }

  await refreshProjectCodeScaffold(workspaceSlug, projectSlug, filePath, mode);

  revalidateCodeProjectRoutes(locale, workspaceSlug, projectSlug);
  redirect(buildCodeRoute(locale, workspaceSlug, projectSlug, { filePath }));
}

export async function createCodePatchProposalAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const filePath = String(formData.get("filePath") ?? "");
  const requestPrompt = String(formData.get("requestPrompt") ?? "");
  const requestedSelectionOverride = parseRequestedAdapterSelection(formData.get("requestedSelection"));
  const retryOfRunId = parseRetryOfRunId(formData.get("retryOfRunId"));
  const bundle = await getProjectCodeBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    return {
      status: "error",
      message: "Project not found.",
    };
  }

  try {
    assertProjectPermission(
      bundle.projectPermissions,
      "canManageProposals",
      "You do not have permission to request code patch proposals for this project.",
    );
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Access denied.",
    };
  }

  let proposal;

  try {
    proposal = await createProjectCodePatchProposal({
      workspaceSlug,
      projectSlug,
      filePath,
      requestPrompt,
      requestedSelectionOverride,
      retryOfRunId,
    });
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Patch proposal generation failed.",
    };
  }

  revalidateCodeProjectRoutes(locale, workspaceSlug, projectSlug);
  redirect(buildCodeRoute(locale, workspaceSlug, projectSlug, {
    filePath,
    proposalId: proposal.id,
  }));
}

export async function restoreCodeFileRevisionAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  formData: FormData,
) {
  const filePath = String(formData.get("filePath") ?? "");
  const targetType = String(formData.get("targetType") ?? "revision");
  const targetRevisionId = String(formData.get("targetRevisionId") ?? "");
  const expectedRevisionNumber = Number(formData.get("expectedRevisionNumber") ?? 1);
  const confirmed = formData.get("confirmRestore") === "on";
  const bundle = await getProjectCodeBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  assertProjectPermission(
    bundle.projectPermissions,
    "canRestoreCode",
    "You do not have permission to restore code revisions for this project.",
  );

  if (!confirmed) {
    redirect(
      buildCodeRoute(locale, workspaceSlug, projectSlug, {
        filePath,
        restoreRevisionId: targetType === "revision" ? targetRevisionId : null,
        restoreScaffold: targetType === "scaffold",
      }),
    );
  }

  await restoreProjectCodeFileRevision({
    workspaceSlug,
    projectSlug,
    filePath,
    expectedRevisionNumber,
    targetType: targetType === "scaffold" ? "scaffold" : "revision",
    targetRevisionId: targetType === "revision" ? targetRevisionId : null,
  });

  revalidateCodeProjectRoutes(locale, workspaceSlug, projectSlug);
  redirect(buildCodeRoute(locale, workspaceSlug, projectSlug, { filePath }));
}

export async function applyCodePatchProposalAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  formData: FormData,
) {
  const filePath = String(formData.get("filePath") ?? "");
  const proposalId = String(formData.get("proposalId") ?? "");
  const bundle = await getProjectCodeBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  assertProjectPermission(
    bundle.projectPermissions,
    "canManageProposals",
    "You do not have permission to apply code patch proposals for this project.",
  );

  await applyProjectCodePatchProposal({
    workspaceSlug,
    projectSlug,
    proposalId,
  });

  revalidateCodeProjectRoutes(locale, workspaceSlug, projectSlug);
  redirect(buildCodeRoute(locale, workspaceSlug, projectSlug, {
    filePath,
    proposalId,
  }));
}

export async function rejectCodePatchProposalAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  formData: FormData,
) {
  const filePath = String(formData.get("filePath") ?? "");
  const proposalId = String(formData.get("proposalId") ?? "");
  const rejectionReason = String(formData.get("rejectionReason") ?? "");
  const bundle = await getProjectCodeBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  assertProjectPermission(
    bundle.projectPermissions,
    "canManageProposals",
    "You do not have permission to reject code patch proposals for this project.",
  );

  await rejectProjectCodePatchProposal({
    workspaceSlug,
    projectSlug,
    proposalId,
    rejectionReason,
  });

  revalidateCodeProjectRoutes(locale, workspaceSlug, projectSlug);
  redirect(buildCodeRoute(locale, workspaceSlug, projectSlug, {
    filePath,
    proposalId,
  }));
}

export async function archiveCodePatchProposalAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  formData: FormData,
) {
  const filePath = String(formData.get("filePath") ?? "");
  const proposalId = String(formData.get("proposalId") ?? "");
  const archiveReason = String(formData.get("archiveReason") ?? "");
  const bundle = await getProjectCodeBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  assertProjectPermission(
    bundle.projectPermissions,
    "canManageProposals",
    "You do not have permission to archive code patch proposals for this project.",
  );

  await archiveProjectCodePatchProposal({
    workspaceSlug,
    projectSlug,
    proposalId,
    archiveReason,
  });

  revalidateCodeProjectRoutes(locale, workspaceSlug, projectSlug);
  redirect(
    buildCodeRoute(locale, workspaceSlug, projectSlug, {
      filePath,
      proposalId,
    }),
  );
}

export async function deferCodeRefreshQueueAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  formData: FormData,
) {
  const queueItemId = String(formData.get("queueItemId") ?? "");
  const filePath = String(formData.get("filePath") ?? "");
  const deferReason =
    String(formData.get("deferReason") ?? "").trim() ||
    "Deferred from Code until the team is ready to review the rebase.";
  const queueItems = await listProjectBuilderRefreshQueue(workspaceSlug, projectSlug);
  const queueItem = queueItems.find((item) => item.id === queueItemId && item.surface === "code");
  const bundle = await getProjectCodeBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  assertProjectPermission(
    bundle.projectPermissions,
    "canReviewCode",
    "You do not have permission to defer Code queue work for this project.",
  );

  if (!queueItem || queueItem.status === "stale" || queueItem.status === "completed") {
    redirect(buildCodeRoute(locale, workspaceSlug, projectSlug, { filePath }));
  }

  await deferProjectBuilderRefreshQueueItem({
    workspaceSlug,
    projectSlug,
    queueItemId,
    deferReason,
  });

  revalidateCodeProjectRoutes(locale, workspaceSlug, projectSlug);
  redirect(buildCodeRoute(locale, workspaceSlug, projectSlug, { filePath }));
}

export async function completeCodeRefreshQueueAction(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  formData: FormData,
) {
  const queueItemId = String(formData.get("queueItemId") ?? "");
  const filePath = String(formData.get("filePath") ?? "");
  const bundle = await getProjectCodeBundle(workspaceSlug, projectSlug);

  if (!bundle) {
    throw new Error("Project not found.");
  }

  assertProjectPermission(
    bundle.projectPermissions,
    "canReviewCode",
    "You do not have permission to complete Code queue review for this project.",
  );

  const queueItems = await listProjectBuilderRefreshQueue(workspaceSlug, projectSlug);
  const activeItem =
    queueItems.find((item) => item.id === queueItemId && item.surface === "code") ??
    getActiveBuilderRefreshQueueItem(queueItems, "code");

  if (!activeItem || activeItem.status === "completed" || activeItem.status === "stale") {
    redirect(buildCodeRoute(locale, workspaceSlug, projectSlug, { filePath }));
  }

  if (bundle.visualSyncState.sourceRevisionNumber < activeItem.targetPlanRevisionNumber) {
    throw new Error("Visual must be refreshed to the approved target before code review can finish.");
  }

  if (bundle.codeSyncState.staleFileCount > 0) {
    throw new Error("Code rebase review is not complete yet. Resolve the stale files first.");
  }

  if (bundle.codeSyncState.sourceRevisionNumber < activeItem.targetPlanRevisionNumber) {
    throw new Error("Code is still pinned behind the approved target revision.");
  }

  await completeProjectBuilderRefreshQueueItem({
    workspaceSlug,
    projectSlug,
    queueItemId: activeItem.id,
  });

  revalidateCodeProjectRoutes(locale, workspaceSlug, projectSlug);
  redirect(buildCodeRoute(locale, workspaceSlug, projectSlug, { filePath }));
}
