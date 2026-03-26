import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { projectDeployRoute, projectTabRoute, projectTimelineRoute } from "@/lib/builder/routes";
import type {
  AuditTimelineFilterSource,
  AuditTimelineSource,
  ProjectAuditTimelineBundle,
  ProjectAuditTimelineEventRecord,
} from "@/lib/builder/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { plannerStatusLabel, plannerTriggerLabel } from "@/lib/planner/labels";
import { cn } from "@/lib/utils";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

function sourceTone(source: AuditTimelineSource) {
  switch (source) {
    case "plan":
      return "border-primary/40 bg-primary/10 text-primary";
    case "visual":
      return "border-amber-300/50 bg-amber-100/70 text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-200";
    case "code":
      return "border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "preview":
      return "border-sky-300/50 bg-sky-100/70 text-sky-900 dark:border-sky-600/40 dark:bg-sky-950/40 dark:text-sky-200";
    case "deploy":
      return "border-fuchsia-300/50 bg-fuchsia-100/70 text-fuchsia-900 dark:border-fuchsia-600/40 dark:bg-fuchsia-950/40 dark:text-fuchsia-200";
  }
}

function displayActorLabel(locale: Locale, event: ProjectAuditTimelineEventRecord) {
  switch (event.actorLabel) {
    case "workspace_editor":
      return locale === "sq" ? "Editor i workspace-it" : "Workspace editor";
    case "preview_runtime":
      return locale === "sq" ? "Preview runtime" : "Preview runtime";
    case "builder_runtime":
      return locale === "sq" ? "Builder runtime" : "Builder runtime";
    case "visual_scaffold":
      return locale === "sq" ? "Visual scaffold" : "Visual scaffold";
    case "sync_guardrail":
      return locale === "sq" ? "Sync guardrail" : "Sync guardrail";
    case "rules_planner_v1":
      return locale === "sq" ? "Rules planner v1" : "Rules planner v1";
    case "external_model_adapter_v1":
      return locale === "sq" ? "External model adapter v1" : "External model adapter v1";
    case "deterministic_generator_v1":
      return locale === "sq" ? "Deterministic generator v1" : "Deterministic generator v1";
    case "external_codegen_adapter_v1":
      return locale === "sq" ? "External codegen adapter v1" : "External codegen adapter v1";
    case "external_patch_adapter_v1":
      return locale === "sq" ? "External patch adapter v1" : "External patch adapter v1";
    case "mock_assistant":
      return locale === "sq" ? "Mock assistant" : "Mock assistant";
    case "deterministic_deployer_v1":
      return locale === "sq" ? "Deterministic deployer v1" : "Deterministic deployer v1";
    case "mock_planner":
      return locale === "sq" ? "Mock planner" : "Mock planner";
    default:
      return event.actorLabel;
  }
}

function displayEventTitle(
  locale: Locale,
  dictionary: Dictionary,
  event: ProjectAuditTimelineEventRecord,
) {
  const filePath = event.linkContext.filePath;
  const planRevisionNumber = event.linkContext.planRevisionNumber;
  const pageCount = Number(event.metadata.pageCount ?? 0);
  const scaffoldSourceRevisionNumber = Number(event.metadata.scaffoldSourceRevisionNumber ?? 0);
  const pageTitle = String(event.metadata.pageTitle ?? "");

  switch (event.kind) {
    case "planner_run": {
      const status = String(event.metadata.status ?? "");
      const revisionLabel = planRevisionNumber ? ` ${planRevisionNumber}` : "";

      if (locale === "sq") {
        return status === "failed"
          ? "Planner run dështoi"
          : revisionLabel
            ? `Planner run për revision${revisionLabel} u përfundua`
            : "Planner run u përfundua";
      }

      return status === "failed"
        ? "Planner run failed"
        : revisionLabel
          ? `Planner run completed for revision${revisionLabel}`
          : "Planner run completed";
    }
    case "generation_run": {
      const status = String(event.metadata.status ?? "");
      const revisionLabel = planRevisionNumber ? ` ${planRevisionNumber}` : "";

      if (locale === "sq") {
        return status === "failed"
          ? "Generation run dështoi"
          : revisionLabel
            ? `Generation run për revision${revisionLabel} u përfundua`
            : "Generation run u përfundua";
      }

      return status === "failed"
        ? "Generation run failed"
        : revisionLabel
          ? `Generation run completed for revision${revisionLabel}`
          : "Generation run completed";
    }
    case "brief_updated":
      return locale === "sq" ? "Project brief u përditësua" : "Project brief updated";
    case "plan_revision": {
      const state = String(event.metadata.state ?? "");
      const titleMap =
        locale === "sq"
          ? {
              generated: `Plan revision ${planRevisionNumber ?? ""} u gjenerua`,
              draft_saved: `Plan revision ${planRevisionNumber ?? ""} u ruajt`,
              needs_changes: `Plan revision ${planRevisionNumber ?? ""} kërkon ndryshime`,
              approved: `Plan revision ${planRevisionNumber ?? ""} u aprovua`,
            }
          : {
              generated: `Plan revision ${planRevisionNumber ?? ""} generated`,
              draft_saved: `Plan revision ${planRevisionNumber ?? ""} saved`,
              needs_changes: `Plan revision ${planRevisionNumber ?? ""} marked for changes`,
              approved: `Plan revision ${planRevisionNumber ?? ""} approved`,
            };

      return titleMap[state as keyof typeof titleMap] ?? event.title;
    }
    case "plan_candidate_promoted": {
      const promotedRevisionNumber = Number(event.metadata.promotedRevisionNumber ?? planRevisionNumber ?? 0);

      return locale === "sq"
        ? `Kandidati i planit u promovua në revision ${promotedRevisionNumber}`
        : `Plan candidate promoted to revision ${promotedRevisionNumber}`;
    }
    case "refresh_queue_created":
      return locale === "sq"
        ? "U krijua refresh queue nga generation review"
        : "Refresh queue created from generation review";
    case "refresh_queue_deferred":
      return locale === "sq"
        ? event.source === "visual"
          ? "Visual refresh queue u shty"
          : "Code refresh queue u shty"
        : event.source === "visual"
          ? "Visual refresh queue deferred"
          : "Code refresh queue deferred";
    case "refresh_queue_stale":
      return locale === "sq"
        ? event.source === "visual"
          ? "Visual refresh queue u vjetrua"
          : "Code refresh queue u vjetrua"
        : event.source === "visual"
          ? "Visual refresh queue went stale"
          : "Code refresh queue went stale";
    case "refresh_queue_completed":
      return locale === "sq"
        ? event.source === "visual"
          ? "Visual refresh queue u përfundua"
          : "Code refresh queue u përfundua"
        : event.source === "visual"
          ? "Visual refresh queue completed"
          : "Code refresh queue completed";
    case "visual_scaffold":
      return locale === "sq"
        ? "Visual scaffold u përditësua"
        : "Visual scaffold updated";
    case "visual_section_updated":
      return locale === "sq"
        ? "U përditësua një seksion visual"
        : "Visual section updated";
    case "visual_section_reordered":
      return locale === "sq"
        ? "U ndryshua renditja e seksioneve visual"
        : "Visual section order changed";
    case "visual_theme_updated":
      return locale === "sq"
        ? "U përditësuan theme tokens"
        : "Theme tokens updated";
    case "code_revision":
      return locale === "sq"
        ? `U ruajt një code revision për ${filePath}`
        : `Code revision saved for ${filePath}`;
    case "code_restore":
      return locale === "sq"
        ? `U rikthye file-i ${filePath}`
        : `File restored for ${filePath}`;
    case "code_refresh":
      return locale === "sq"
        ? `U rifreskua scaffold-i i kodit për ${filePath}`
        : `Code scaffold refreshed for ${filePath}`;
    case "proposal_applied":
      return locale === "sq"
        ? `U aplikua patch proposal për ${filePath}`
        : `Patch proposal applied for ${filePath}`;
    case "proposal_rejected":
      return locale === "sq"
        ? `U refuzua patch proposal për ${filePath}`
        : `Patch proposal rejected for ${filePath}`;
    case "proposal_stale":
      return locale === "sq"
        ? `Patch proposal u vjetrua për ${filePath}`
        : `Patch proposal went stale for ${filePath}`;
    case "proposal_archived":
      return locale === "sq"
        ? `Patch proposal u arkivua për ${filePath}`
        : `Patch proposal archived for ${filePath}`;
    case "preview_state":
      return locale === "sq"
        ? `Preview u hap në ${dictionary.builder.preview.devices[event.linkContext.previewDevice ?? "desktop"]}`
        : `Preview opened on ${dictionary.builder.preview.devices[event.linkContext.previewDevice ?? "desktop"]}`;
    case "deploy_run":
      return locale === "sq"
        ? event.metadata.status === "failed"
          ? "Deploy snapshot dështoi"
          : "Deploy snapshot u krijua"
        : event.metadata.status === "failed"
          ? "Deploy snapshot failed"
          : "Deploy snapshot created";
    case "deploy_target_updated":
      return locale === "sq" ? "Deploy target settings u ruajtën" : "Deploy target settings saved";
    case "deploy_release_promoted":
      return locale === "sq"
        ? `Deploy release ${String(event.metadata.releaseName ?? "")} u promovua`
        : `Deploy release ${String(event.metadata.releaseName ?? "")} promoted`;
    case "deploy_release_handoff_prepared":
      return locale === "sq"
        ? `Hosting handoff u përgatit për ${String(event.metadata.releaseName ?? "")}`
        : `Hosting handoff prepared for ${String(event.metadata.releaseName ?? "")}`;
    case "deploy_release_exported":
      return locale === "sq"
        ? `Deploy export u shkarkua për ${String(event.metadata.releaseName ?? "")}`
        : `Deploy export downloaded for ${String(event.metadata.releaseName ?? "")}`;
    case "deploy_handoff_run":
      return locale === "sq"
        ? `Hosting simulation ${String(event.metadata.status ?? "")} për ${String(event.metadata.primaryDomain ?? "")}`
        : `Hosting simulation ${String(event.metadata.status ?? "")} for ${String(event.metadata.primaryDomain ?? "")}`;
    case "deploy_execution_run":
      return locale === "sq"
        ? `Hosting execution ${String(event.metadata.status ?? "")} për ${String(event.metadata.primaryDomain ?? "")}`
        : `Hosting execution ${String(event.metadata.status ?? "")} for ${String(event.metadata.primaryDomain ?? "")}`;
    case "deploy_execution_rechecked":
      return locale === "sq"
        ? `Hosting execution u rikontrollua për ${String(event.metadata.providerDeploymentId ?? event.metadata.primaryDomain ?? "")}`
        : `Hosting execution rechecked for ${String(event.metadata.providerDeploymentId ?? event.metadata.primaryDomain ?? "")}`;
    case "deploy_execution_retried":
      return locale === "sq"
        ? `Hosting execution u riprovua për ${String(event.metadata.primaryDomain ?? "")}`
        : `Hosting execution retried for ${String(event.metadata.primaryDomain ?? "")}`;
    case "adapter_config_updated":
      return locale === "sq" ? "Model adapter settings u ruajtën" : "Model adapter settings saved";
    case "model_adapter_run":
      return locale === "sq"
        ? `Model adapter run ${String(event.metadata.status ?? "")}`
        : `Model adapter run ${String(event.metadata.status ?? "")}`;
    case "project_owner_reassigned":
      return event.title;
    default:
      if (event.kind === "visual_scaffold" && pageCount > 0 && scaffoldSourceRevisionNumber > 0) {
        return locale === "sq"
          ? `Visual scaffold me ${pageCount} faqe nga revision ${scaffoldSourceRevisionNumber}`
          : `Visual scaffold with ${pageCount} pages from revision ${scaffoldSourceRevisionNumber}`;
      }

      if (event.kind === "preview_state" && pageTitle) {
        return locale === "sq"
          ? `Preview për ${pageTitle}`
          : `Preview for ${pageTitle}`;
      }

      return event.title;
  }
}

function displayEventSummary(
  locale: Locale,
  dictionary: Dictionary,
  event: ProjectAuditTimelineEventRecord,
) {
  const pageCount = Number(event.metadata.pageCount ?? 0);
  const scaffoldSourceRevisionNumber = Number(event.metadata.scaffoldSourceRevisionNumber ?? 0);
  const targetRevisionNumber = Number(event.metadata.targetPlanRevisionNumber ?? 0);
  const filePath = event.linkContext.filePath;
  const pageTitle = String(event.metadata.pageTitle ?? "");

  switch (event.kind) {
    case "planner_run": {
      const artifactCount = Number(event.metadata.artifactCount ?? 0);
      const triggerValue =
        event.metadata.trigger === "project_rerun" ? "project_rerun" : "project_create";
      const triggerLabel = plannerTriggerLabel(dictionary, triggerValue);
      const suffix =
        event.metadata.errorMessage && typeof event.metadata.errorMessage === "string"
          ? ` ${event.metadata.errorMessage}`
          : "";

      return locale === "sq"
        ? `${triggerLabel} ruajti ${artifactCount} artifact-e.${suffix}`.trim()
        : `${triggerLabel} stored ${artifactCount} artifacts.${suffix}`.trim();
    }
    case "generation_run": {
      const artifactCount = Number(event.metadata.artifactCount ?? 0);
      const queuedSurfaces = Array.isArray(event.metadata.queuedSurfaces)
        ? event.metadata.queuedSurfaces.map((value) => String(value))
        : [];
      const suffix =
        event.metadata.errorMessage && typeof event.metadata.errorMessage === "string"
          ? ` ${event.metadata.errorMessage}`
          : "";

      if (queuedSurfaces.length === 0) {
        return locale === "sq"
          ? `${artifactCount} generation artifact-e u ruajtën.${suffix}`.trim()
          : `${artifactCount} generation artifacts were stored.${suffix}`.trim();
      }

      return locale === "sq"
        ? `${artifactCount} generation artifact-e u ruajtën dhe queue u përgatit për ${queuedSurfaces.join(", ")}.${suffix}`.trim()
        : `${artifactCount} generation artifacts were stored and queue handoff was prepared for ${queuedSurfaces.join(", ")}.${suffix}`.trim();
    }
    case "brief_updated":
      return locale === "sq"
        ? "Brief-i u ruajt si input i pavarur nga plani aktual. Rerun-i i planner-it krijon vetëm kandidat të ri plani."
        : "The brief was saved independently from the current plan. Rerunning the planner only creates a new plan candidate.";
    case "plan_candidate_promoted": {
      const queuedSurfaces = Array.isArray(event.metadata.queuedSurfaces)
        ? event.metadata.queuedSurfaces.map((value) => String(value))
        : [];
      const generationRunId =
        typeof event.metadata.generationRunId === "string" ? event.metadata.generationRunId : null;

      if (queuedSurfaces.length === 0) {
        return locale === "sq"
          ? generationRunId
            ? "Promovimi krijoi generation outputs të rishikueshme. Queue work krijohet vetëm pasi ato të kontrollohen në Plan Mode."
            : "Promovimi u ruajt pa krijuar refresh queue të reja."
          : generationRunId
            ? "Promotion created reviewable generation outputs. Queue work is created only after those targets are reviewed in Plan Mode."
            : "Promotion was recorded without creating new refresh queue items.";
      }

      const label = queuedSurfaces.join(", ");
      return locale === "sq"
        ? `Promovimi krijoi handoff për ${label}.`
        : `Promotion created handoff for ${label}.`;
    }
    case "refresh_queue_created": {
      const queuedSurfaces = Array.isArray(event.metadata.queuedSurfaces)
        ? event.metadata.queuedSurfaces.map((value) => String(value))
        : [];

      return locale === "sq"
        ? `Generation review krijoi queue work për ${queuedSurfaces.join(", ")}.`
        : `Generation review created queue work for ${queuedSurfaces.join(", ")}.`;
    }
    case "refresh_queue_deferred":
      return locale === "sq"
        ? `Queue item u shty me arsyen: ${String(event.metadata.deferReason ?? event.summary)}`
        : `The queue item was deferred with the reason: ${String(event.metadata.deferReason ?? event.summary)}`;
    case "refresh_queue_stale": {
      const supersededRevision = Number(event.metadata.supersededByPlanRevisionNumber ?? 0);

      return locale === "sq"
        ? `Queue item nuk duhet konsumuar më. Zëvendësoje nga generation run më i ri${supersededRevision > 0 ? ` për revision ${supersededRevision}` : ""}.`
        : `This queue item should no longer be consumed. Replace it from the latest generation run${supersededRevision > 0 ? ` for revision ${supersededRevision}` : ""}.`;
    }
    case "refresh_queue_completed":
      return locale === "sq"
        ? `Queue item për revision ${targetRevisionNumber || ""} u mbyll nga surface-i përkatës.`
        : `The queue item for revision ${targetRevisionNumber || ""} was completed from the owning surface.`;
    case "visual_scaffold":
      return locale === "sq"
        ? `${pageCount} sipërfaqe faqesh u lidhën me plan revision ${scaffoldSourceRevisionNumber}.`
        : `${pageCount} page surfaces were mapped from plan revision ${scaffoldSourceRevisionNumber}.`;
    case "visual_section_reordered":
      return locale === "sq"
        ? "Renditja e seksioneve u ndryshua brenda faqes aktive."
        : "Section order changed inside the active page.";
    case "visual_theme_updated":
      return locale === "sq"
        ? "Ngjyrat, typography label dhe spacing tokens u ruajtën për scaffold-in visual."
        : "Color, typography, and spacing tokens were saved for the visual scaffold.";
    case "code_refresh":
      return locale === "sq"
        ? `Scaffold-i aktual i kodit u sinkronizua për ${filePath}.`
        : `The current code scaffold was synchronized for ${filePath}.`;
    case "preview_state":
      return locale === "sq"
        ? `Preview u rishikua në ${pageTitle}${event.linkContext.previewExpanded ? " me expanded mode" : ""}.`
        : `Preview was reviewed on ${pageTitle}${event.linkContext.previewExpanded ? " in expanded mode" : ""}.`;
    case "deploy_run": {
      const outputSummary =
        typeof event.metadata.outputSummary === "object" && event.metadata.outputSummary
          ? (event.metadata.outputSummary as Record<string, unknown>)
          : null;
      const routeCount = Number(outputSummary?.routeCount ?? 0);
      const fileCount = Number(outputSummary?.fileCount ?? 0);
      const runtimeSource = String(event.metadata.runtimeSource ?? "");

      return locale === "sq"
        ? `Snapshot-i i deploy-it ruajti ${routeCount} route dhe ${fileCount} file nga ${runtimeSource || "accepted state"}.`
        : `The deploy snapshot stored ${routeCount} routes and ${fileCount} files from ${runtimeSource || "accepted state"}.`;
    }
    case "deploy_target_updated":
      return locale === "sq"
        ? `Adapter-i ${String(event.metadata.adapterKey ?? "")} u ruajt për environment ${String(event.metadata.environmentKey ?? "")}.`
        : `Adapter ${String(event.metadata.adapterKey ?? "")} was saved for environment ${String(event.metadata.environmentKey ?? "")}.`;
    case "deploy_release_promoted":
      return locale === "sq"
        ? `Release ${String(event.metadata.releaseName ?? "")} u promovua nga deploy run ${String(event.metadata.deployRunId ?? "")}.`
        : `Release ${String(event.metadata.releaseName ?? "")} was promoted from deploy run ${String(event.metadata.deployRunId ?? "")}.`;
    case "deploy_release_handoff_prepared":
      return locale === "sq"
        ? `Payload-i i hosting handoff u ruajt për release ${String(event.metadata.releaseName ?? "")}.`
        : `The hosting handoff payload was stored for release ${String(event.metadata.releaseName ?? "")}.`;
    case "deploy_release_exported":
      return locale === "sq"
        ? `Release export u gjenerua si ${String(event.metadata.exportFileName ?? "")}.`
        : `The release export was generated as ${String(event.metadata.exportFileName ?? "")}.`;
    case "deploy_handoff_run":
      return locale === "sq"
        ? `Simulation-i i hosting adapter ruajti statusin ${String(event.metadata.status ?? "")} për preset ${String(event.metadata.adapterPresetKey ?? "")}.`
        : `The hosting adapter simulation stored status ${String(event.metadata.status ?? "")} for preset ${String(event.metadata.adapterPresetKey ?? "")}.`;
    case "deploy_execution_run":
      return locale === "sq"
        ? `Hosting execution ruajti statusin ${String(event.metadata.status ?? "")} me adapter ${String(event.metadata.actualAdapterKey ?? "")}.`
        : `The hosting execution stored status ${String(event.metadata.status ?? "")} using adapter ${String(event.metadata.actualAdapterKey ?? "")}.`;
    case "deploy_execution_rechecked":
      return locale === "sq"
        ? `Rikontrollimi ruajti statusin ${String(event.metadata.status ?? "")} me provider status ${String(event.metadata.latestProviderStatus ?? "")}.`
        : `The recheck stored status ${String(event.metadata.status ?? "")} with provider status ${String(event.metadata.latestProviderStatus ?? "")}.`;
    case "deploy_execution_retried":
      return locale === "sq"
        ? `U krijua një run i ri execution nga retry i ${String(event.metadata.retryOfExecutionRunId ?? "")}.`
        : `A new execution run was created by retrying ${String(event.metadata.retryOfExecutionRunId ?? "")}.`;
    case "adapter_config_updated":
      return locale === "sq"
        ? `Selection-et e planning, generation dhe patch suggestion u ruajtën me provider ${String(event.metadata.externalProviderKey ?? "deterministic_internal")}.`
        : `Planning, generation, and patch suggestion selections were saved with provider ${String(event.metadata.externalProviderKey ?? "deterministic_internal")}.`;
    case "model_adapter_run": {
      const latencySuffix =
        typeof event.metadata.latencyMs === "number"
          ? locale === "sq"
            ? ` me ${String(event.metadata.latencyMs)}ms`
            : ` with ${String(event.metadata.latencyMs)}ms`
          : "";
      const attemptSuffix =
        typeof event.metadata.attemptNumber === "number" && event.metadata.attemptNumber > 1
          ? locale === "sq"
            ? ` në attempt ${String(event.metadata.attemptNumber)}`
            : ` on attempt ${String(event.metadata.attemptNumber)}`
          : "";
      const prefix =
        event.metadata.runKind === "provider_verification"
          ? locale === "sq"
            ? "Live provider verification"
            : "Live provider verification"
          : locale === "sq"
            ? "Adapter run"
            : "The adapter run";
      return locale === "sq"
        ? `${prefix} përdori ${String(event.metadata.executedAdapterKey ?? "")}${latencySuffix}${attemptSuffix}${event.metadata.fallbackReason ? ` pas fallback-ut: ${String(event.metadata.fallbackReason)}` : ""}.`
        : `${prefix} used ${String(event.metadata.executedAdapterKey ?? "")}${latencySuffix}${attemptSuffix}${event.metadata.fallbackReason ? ` after fallback: ${String(event.metadata.fallbackReason)}` : ""}.`;
    }
    default:
      return event.summary;
  }
}

function buildFilterHref(
  locale: Locale,
  workspaceSlug: string,
  projectSlug: string,
  source: AuditTimelineFilterSource,
) {
  if (source === "all") {
    return projectTimelineRoute(locale, workspaceSlug, projectSlug);
  }

  return `${projectTimelineRoute(locale, workspaceSlug, projectSlug)}?source=${encodeURIComponent(source)}`;
}

function buildEventHref(
  locale: Locale,
  workspaceSlug: string,
  projectSlug: string,
  event: ProjectAuditTimelineEventRecord,
) {
  if (
    event.kind === "deploy_run" ||
    event.kind === "deploy_target_updated" ||
    event.kind === "deploy_release_promoted" ||
    event.kind === "deploy_release_handoff_prepared" ||
    event.kind === "deploy_release_exported" ||
    event.kind === "deploy_handoff_run" ||
    event.kind === "deploy_execution_run" ||
    event.kind === "deploy_execution_rechecked" ||
    event.kind === "deploy_execution_retried"
  ) {
    const base = projectDeployRoute(locale, workspaceSlug, projectSlug);
    const params = new URLSearchParams();

    if (event.linkContext.deployRunId) {
      params.set("deployRun", event.linkContext.deployRunId);
    }
    if (event.linkContext.releaseId) {
      params.set("release", event.linkContext.releaseId);
    }
    if (event.linkContext.handoffRunId) {
      params.set("handoffRun", event.linkContext.handoffRunId);
    }
    if (event.linkContext.executionRunId) {
      params.set("executionRun", event.linkContext.executionRunId);
    }
    if (event.linkContext.artifactType) {
      params.set("artifact", event.linkContext.artifactType);
    }

    const query = params.toString();
    const href = query ? `${base}?${query}` : base;

    if (event.linkContext.handoffRunId) {
      return `${href}#handoff-run-${event.linkContext.handoffRunId}`;
    }

    if (event.linkContext.executionRunId) {
      return `${href}#execution-run-${event.linkContext.executionRunId}`;
    }

    if (event.linkContext.releaseId) {
      return `${href}#release-${event.linkContext.releaseId}`;
    }

    if (event.linkContext.deployRunId) {
      return `${href}#deploy-run-${event.linkContext.deployRunId}`;
    }

    if (event.kind === "deploy_target_updated") {
      return `${href}#target-settings`;
    }

    return href;
  }

  const base = projectTabRoute(locale, workspaceSlug, projectSlug, event.linkedTab);
  const params = new URLSearchParams();

  if (event.linkedTab === "visual") {
    if (event.linkContext.visualPageId) {
      params.set("page", event.linkContext.visualPageId);
    }
    if (event.linkContext.visualSectionId) {
      params.set("section", event.linkContext.visualSectionId);
    }
  }

  if (event.linkedTab === "code") {
    if (event.linkContext.filePath) {
      params.set("file", event.linkContext.filePath);
    }
    if (event.linkContext.compareRevisionId) {
      params.set("compare", event.linkContext.compareRevisionId);
    }
    if (event.linkContext.proposalId) {
      params.set("proposal", event.linkContext.proposalId);
    }
  }

  if (event.linkedTab === "plan" && event.linkContext.plannerRunId) {
    params.set("plannerRun", event.linkContext.plannerRunId);
  }

  if (event.linkedTab === "plan" && event.linkContext.generationRunId) {
    params.set("generationRun", event.linkContext.generationRunId);
  }

  if (event.linkedTab === "preview") {
    if (event.linkContext.previewRoutePath) {
      params.set("route", event.linkContext.previewRoutePath);
    }
    if (event.linkContext.previewPageId) {
      params.set("page", event.linkContext.previewPageId);
    }
    if (event.linkContext.previewDevice) {
      params.set("device", event.linkContext.previewDevice);
    }
    if (event.linkContext.previewExpanded) {
      params.set("expanded", "1");
    }
  }

  const query = params.toString();
  const baseWithQuery = query ? `${base}?${query}` : base;

  if (event.linkedTab === "plan" && event.kind === "planner_run" && event.linkContext.plannerRunId) {
    return `${baseWithQuery}#planner-run-${event.linkContext.plannerRunId}`;
  }

  if (event.linkedTab === "plan" && event.kind === "brief_updated") {
    return `${baseWithQuery}#brief-editor`;
  }

  if (event.linkedTab === "plan" && event.kind === "adapter_config_updated") {
    return `${baseWithQuery}#model-adapters`;
  }

  if (event.linkedTab === "plan" && event.linkContext.planRevisionId) {
    return `${baseWithQuery}#revision-${event.linkContext.planRevisionId}`;
  }

  if (event.linkedTab === "plan" && event.linkContext.plannerRunId) {
    return `${baseWithQuery}#planner-run-${event.linkContext.plannerRunId}`;
  }

  return baseWithQuery;
}

function metadataLines(
  dictionary: Dictionary,
  locale: Locale,
  event: ProjectAuditTimelineEventRecord,
) {
  const lines: Array<{ label: string; value: string }> = [
    {
      label: dictionary.builder.timeline.metadata.actor,
      value: displayActorLabel(locale, event),
    },
    {
      label: dictionary.builder.timeline.metadata.timestamp,
      value: formatDateTimeLabel(event.occurredAt, locale),
    },
  ];

  if (event.linkContext.filePath) {
    lines.push({
      label: dictionary.builder.timeline.metadata.file,
      value: event.linkContext.filePath,
    });
  }

  if (event.linkContext.planRevisionNumber) {
    lines.push({
      label: dictionary.builder.timeline.metadata.revision,
      value: `${dictionary.plan.revisionPrefix} ${event.linkContext.planRevisionNumber}`,
    });
  }

  if (event.linkContext.compareRevisionNumber) {
    lines.push({
      label: dictionary.builder.timeline.metadata.baseRevision,
      value: `${dictionary.plan.revisionPrefix} ${event.linkContext.compareRevisionNumber}`,
    });
  }

  if (event.linkContext.visualPageId) {
    lines.push({
      label: dictionary.builder.timeline.metadata.page,
      value: event.linkContext.visualPageId,
    });
  }

  if (event.linkContext.visualSectionId) {
    lines.push({
      label: dictionary.builder.timeline.metadata.section,
      value: event.linkContext.visualSectionId,
    });
  }

  if (event.linkContext.proposalId) {
    lines.push({
      label: dictionary.builder.timeline.metadata.proposal,
      value: event.linkContext.proposalId,
    });
  }

  if (event.linkContext.plannerRunId) {
    lines.push({
      label: dictionary.builder.timeline.metadata.plannerRun,
      value: event.linkContext.plannerRunId,
    });
  }

  if (event.linkContext.generationRunId) {
    lines.push({
      label: dictionary.builder.timeline.metadata.generationRun,
      value: event.linkContext.generationRunId,
    });
  }

  if (event.linkContext.deployRunId) {
    lines.push({
      label: dictionary.builder.timeline.metadata.deployRun,
      value: event.linkContext.deployRunId,
    });
  }

  if (event.linkContext.releaseId) {
    lines.push({
      label: dictionary.builder.timeline.metadata.release,
      value: event.linkContext.releaseId,
    });
  }

  if (event.linkContext.artifactType) {
    lines.push({
      label: dictionary.builder.timeline.metadata.artifact,
      value: event.linkContext.artifactType,
    });
  }

  if (event.linkContext.briefId) {
    lines.push({
      label: dictionary.builder.timeline.metadata.brief,
      value: event.linkContext.briefId,
    });
  }

  if (event.kind === "planner_run" && typeof event.metadata.status === "string") {
    lines.push({
      label: dictionary.builder.timeline.metadata.plannerStatus,
      value: plannerStatusLabel(
        dictionary,
        event.metadata.status as "completed" | "failed",
      ),
    });
  }

  if (event.kind === "planner_run" && typeof event.metadata.trigger === "string") {
    lines.push({
      label: dictionary.builder.timeline.metadata.plannerTrigger,
      value: plannerTriggerLabel(
        dictionary,
        event.metadata.trigger as "project_create" | "project_rerun",
      ),
    });
  }

  if (event.kind === "planner_run" && typeof event.metadata.artifactCount !== "undefined") {
    lines.push({
      label: dictionary.builder.timeline.metadata.artifacts,
      value: String(event.metadata.artifactCount),
    });
  }

  if (event.linkContext.previewDevice) {
    lines.push({
      label: dictionary.builder.timeline.metadata.device,
      value: dictionary.builder.preview.devices[event.linkContext.previewDevice],
    });
  }

  if (event.kind === "project_owner_reassigned") {
    lines.push(
      {
        label: locale === "sq" ? "Pronari i mëparshëm" : "Previous owner",
        value: String(event.metadata.previousOwnerName ?? event.metadata.previousOwnerEmail ?? "—"),
      },
      {
        label: locale === "sq" ? "Pronari i ri" : "New owner",
        value: String(event.metadata.nextOwnerName ?? event.metadata.nextOwnerEmail ?? "—"),
      },
    );
  }

  return lines;
}

export function ProjectAuditTimeline({
  locale,
  dictionary,
  bundle,
}: {
  locale: Locale;
  dictionary: Dictionary;
  bundle: ProjectAuditTimelineBundle;
}) {
  const filterOptions: AuditTimelineFilterSource[] = ["all", "plan", "visual", "code", "preview", "deploy"];
  const allCount =
    bundle.counts.plan +
    bundle.counts.visual +
    bundle.counts.code +
    bundle.counts.preview +
    bundle.counts.deploy;
  const sourceLabels = dictionary.builder.timeline.sources;

  return (
    <div className="space-y-6">
      <Card className="px-6 py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.builder.timeline.eyebrow}
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-card-foreground">
              {dictionary.builder.timeline.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {dictionary.builder.timeline.copy}
            </p>
          </div>

          <Link
            href={projectTabRoute(locale, bundle.workspace.slug, bundle.project.slug, "plan")}
            className={buttonStyles("secondary")}
          >
            {dictionary.builder.timeline.backToBuilder}
          </Link>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.builder.timeline.summary.total}
            </p>
            <p className="mt-2 text-2xl font-bold text-card-foreground">{allCount}</p>
          </div>
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {sourceLabels.plan}
            </p>
            <p className="mt-2 text-2xl font-bold text-card-foreground">{bundle.counts.plan}</p>
          </div>
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {sourceLabels.visual}
            </p>
            <p className="mt-2 text-2xl font-bold text-card-foreground">{bundle.counts.visual}</p>
          </div>
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {sourceLabels.code} / {sourceLabels.preview}
            </p>
            <p className="mt-2 text-2xl font-bold text-card-foreground">
              {bundle.counts.code + bundle.counts.preview}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.timeline.filtersLabel}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {filterOptions.map((source) => {
              const count =
                source === "all"
                  ? bundle.counts.plan + bundle.counts.visual + bundle.counts.code + bundle.counts.preview
                  : bundle.counts[source];
              const active = bundle.selectedSource === source;
              const label =
                source === "all" ? dictionary.builder.timeline.sources.all : sourceLabels[source];

              return (
                <Link
                  key={source}
                  href={buildFilterHref(locale, bundle.workspace.slug, bundle.project.slug, source)}
                  className={cn(
                    "inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-semibold transition",
                    active
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border bg-background/80 text-muted-foreground hover:border-primary/30 hover:text-card-foreground",
                  )}
                >
                  <span>{label}</span>
                  <span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </Card>

      {bundle.events.length === 0 ? (
        <Card className="px-6 py-8">
          <p className="text-lg font-semibold text-card-foreground">
            {dictionary.builder.timeline.emptyTitle}
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
            {dictionary.builder.timeline.emptyCopy}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {bundle.events.map((event) => {
            const href = buildEventHref(locale, bundle.workspace.slug, bundle.project.slug, event);

            return (
              <Card
                key={event.id}
                className="px-6 py-5"
                data-testid="timeline-event-card"
                data-event-kind={event.kind}
                data-entity-id={event.entityId}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className={sourceTone(event.source)}>
                        {sourceLabels[event.source]}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatDateTimeLabel(event.occurredAt, locale)}
                      </span>
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-card-foreground">
                      {displayEventTitle(locale, dictionary, event)}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {displayEventSummary(locale, dictionary, event)}
                    </p>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {metadataLines(dictionary, locale, event).map((line) => (
                        <div
                          key={`${event.id}-${line.label}`}
                          className="rounded-[20px] border border-border bg-background/70 px-4 py-3"
                        >
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            {line.label}
                          </p>
                          <p className="mt-2 truncate text-sm font-medium text-card-foreground">
                            {line.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-start">
                    <Link
                      href={href}
                      className={buttonStyles("secondary")}
                      data-testid="timeline-open-context"
                    >
                      {dictionary.builder.timeline.openContext}
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
