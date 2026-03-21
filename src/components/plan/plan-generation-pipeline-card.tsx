"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  BuilderImpactSurfaceRecord,
  ProjectBuilderRefreshQueueItemRecord,
} from "@/lib/builder/types";
import { generationSourceLabel, generationStatusLabel, generationTriggerLabel } from "@/lib/generation/labels";
import { findLatestCompletedGenerationRun } from "@/lib/generation/runs";
import type {
  GenerationArtifactRecord,
  GenerationCodeFileTargetRecord,
  GenerationRouteTargetRecord,
  GenerationRunRecord,
} from "@/lib/generation/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { initialFormState } from "@/lib/workspaces/form-state";
import type { FormState } from "@/lib/workspaces/form-state";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

type QueueAction = (state: FormState, formData: FormData) => Promise<FormState>;
type RerunAction = (state: FormState, formData: FormData) => Promise<FormState>;

function sameGenerationContext(left: GenerationRunRecord, right: GenerationRunRecord) {
  return left.sourcePlanRevisionId === right.sourcePlanRevisionId;
}

function buildGenerationHistoryHref(input: {
  planHrefBase: string;
  plannerRunId?: string | null;
  plannerCompareId?: string | null;
  generationRunId?: string | null;
  generationCompareId?: string | null;
  anchor?: string | null;
}) {
  const params = new URLSearchParams();

  if (input.plannerRunId) {
    params.set("plannerRun", input.plannerRunId);
  }

  if (input.plannerCompareId) {
    params.set("plannerCompare", input.plannerCompareId);
  }

  if (input.generationRunId) {
    params.set("generationRun", input.generationRunId);
  }

  if (input.generationCompareId) {
    params.set("generationCompare", input.generationCompareId);
  }

  const query = params.toString();
  const anchor = input.anchor ? `#${input.anchor}` : "";

  return `${input.planHrefBase}${query ? `?${query}` : ""}${anchor}`;
}

function statusTone(status: GenerationRunRecord["status"]) {
  switch (status) {
    case "completed":
      return "border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "failed":
      return "border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200";
  }
}

function queueStatusTone(
  status: "ready" | "pending" | "deferred" | "stale" | "completed" | "current" | "superseded" | "outdated",
) {
  switch (status) {
    case "ready":
      return "border-primary/30 bg-primary/10 text-primary";
    case "pending":
      return "border-amber-300/50 bg-amber-100/70 text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-200";
    case "deferred":
    case "stale":
    case "superseded":
      return "border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200";
    case "completed":
    case "current":
      return "border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "outdated":
      return "border-border bg-background/80 text-muted-foreground";
  }
}

function readRouteTargets(payload: Record<string, unknown>) {
  return Array.isArray(payload.routes)
    ? payload.routes.filter((item): item is GenerationRouteTargetRecord => typeof item === "object" && item !== null)
    : [];
}

function readVisualPages(payload: Record<string, unknown>) {
  return Array.isArray(payload.pages)
    ? payload.pages.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : [];
}

function readCodeFiles(payload: Record<string, unknown>) {
  return Array.isArray(payload.files)
    ? payload.files.filter((item): item is GenerationCodeFileTargetRecord => typeof item === "object" && item !== null)
    : [];
}

function readThemeTokens(payload: Record<string, unknown>) {
  const tokens = payload.tokens;
  return typeof tokens === "object" && tokens ? (tokens as Record<string, string>) : {};
}

function artifactByType(
  artifacts: GenerationArtifactRecord[],
  artifactType: GenerationArtifactRecord["artifactType"],
) {
  return artifacts.find((artifact) => artifact.artifactType === artifactType) ?? null;
}

function itemCountLabel(dictionary: Dictionary, count: number) {
  return `${count} ${dictionary.plan.generation.details.items}`;
}

function summarizeContent(payload: Record<string, unknown>) {
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const eyebrow = typeof payload.eyebrow === "string" ? payload.eyebrow.trim() : "";
  const ctaLabel = typeof payload.ctaLabel === "string" ? payload.ctaLabel.trim() : "";
  const items = Array.isArray(payload.items)
    ? payload.items.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  return {
    eyebrow,
    body,
    ctaLabel,
    itemCount: items.length,
  };
}

function firstRelevantQueueItem(
  items: ProjectBuilderRefreshQueueItemRecord[],
  surface: "visual" | "code",
  selectedRun: GenerationRunRecord | null,
) {
  if (!selectedRun) {
    return null;
  }

  return (
    items.find((item) => item.surface === surface && item.generationRunId === selectedRun.id) ??
    items.find(
      (item) =>
        item.surface === surface &&
        !item.generationRunId &&
        item.targetPlanRevisionNumber === selectedRun.sourcePlanRevisionNumber,
    ) ??
    null
  );
}

function surfaceQueueStatus(input: {
  surface: BuilderImpactSurfaceRecord;
  queueItem: ProjectBuilderRefreshQueueItemRecord | null;
  selectedRun: GenerationRunRecord | null;
  approvedRevisionNumber: number | null;
  latestApprovedRun: GenerationRunRecord | null;
}) {
  if (!input.selectedRun || input.selectedRun.status !== "completed") {
    return "outdated" as const;
  }

  if (
    input.approvedRevisionNumber === null ||
    input.selectedRun.sourcePlanRevisionNumber !== input.approvedRevisionNumber
  ) {
    return "outdated" as const;
  }

  if (input.latestApprovedRun && input.selectedRun.id !== input.latestApprovedRun.id) {
    return "superseded" as const;
  }

  if (input.queueItem?.status === "stale") {
    return "stale" as const;
  }

  if (input.queueItem?.status === "pending") {
    return "pending" as const;
  }

  if (input.queueItem?.status === "deferred") {
    return "deferred" as const;
  }

  if (input.queueItem?.status === "completed") {
    return "completed" as const;
  }

  const pinnedRevision = input.surface.pinnedRevisionNumber ?? 0;
  if (pinnedRevision >= input.selectedRun.sourcePlanRevisionNumber) {
    return "current" as const;
  }

  return "ready" as const;
}

function statusLabel(
  dictionary: Dictionary,
  status: ReturnType<typeof surfaceQueueStatus>,
) {
  switch (status) {
    case "ready":
      return dictionary.plan.generation.queueReview.ready;
    case "pending":
      return dictionary.plan.builderImpact.queuePending;
    case "deferred":
      return dictionary.plan.builderImpact.queueDeferred;
    case "stale":
      return dictionary.builder.refreshQueue.statuses.stale;
    case "completed":
      return dictionary.plan.builderImpact.queueCompleted;
    case "current":
      return dictionary.plan.builderImpact.noRefreshRequired;
    case "superseded":
      return dictionary.plan.generation.queueReview.supersededRun;
    case "outdated":
      return dictionary.plan.generation.queueReview.outdated;
  }
}

function codeFileGroups(files: GenerationCodeFileTargetRecord[]) {
  const groups = new Map<string, GenerationCodeFileTargetRecord[]>();

  for (const file of files) {
    const existing = groups.get(file.kind) ?? [];
    existing.push(file);
    groups.set(file.kind, existing);
  }

  return Array.from(groups.entries());
}

function QueueModeButton({
  name,
  value,
  label,
  pendingLabel,
  disabled,
  testId,
}: {
  name: string;
  value: string;
  label: string;
  pendingLabel: string;
  disabled?: boolean;
  testId?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      name={name}
      value={value}
      variant="secondary"
      disabled={disabled || pending}
      data-testid={testId}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function PlanGenerationPipelineCard({
  locale,
  dictionary,
  planHrefBase,
  runs,
  artifacts,
  latestRun,
  selectedGenerationRunId,
  selectedGenerationComparisonRunId,
  selectedPlannerRunId,
  selectedPlannerComparisonRunId,
  rerunAction,
  queueAction,
  refreshQueueItems,
  visualSurface,
  codeSurface,
  canQueue = true,
  readOnlyCopy,
}: {
  locale: Locale;
  dictionary: Dictionary;
  planHrefBase: string;
  runs: GenerationRunRecord[];
  artifacts: GenerationArtifactRecord[];
  latestRun: GenerationRunRecord | null;
  selectedGenerationRunId: string | null;
  selectedGenerationComparisonRunId: string | null;
  selectedPlannerRunId: string | null;
  selectedPlannerComparisonRunId: string | null;
  rerunAction: RerunAction;
  queueAction: QueueAction;
  refreshQueueItems: ProjectBuilderRefreshQueueItemRecord[];
  visualSurface: BuilderImpactSurfaceRecord;
  codeSurface: BuilderImpactSurfaceRecord;
  canQueue?: boolean;
  readOnlyCopy?: string;
}) {
  const [rerunState, rerunFormAction] = useActionState(rerunAction, initialFormState);
  const [state, formAction] = useActionState(queueAction, initialFormState);
  const selectedRun =
    runs.find((run) => run.id === selectedGenerationRunId) ?? latestRun ?? runs[0] ?? null;
  const effectiveSelectedRunId = selectedRun?.id ?? null;
  const selectedArtifacts = selectedRun
    ? artifacts.filter((artifact) => artifact.generationRunId === selectedRun.id)
    : [];
  const routeArtifact = artifactByType(selectedArtifacts, "route_page_target");
  const visualArtifact = artifactByType(selectedArtifacts, "visual_scaffold_target");
  const codeArtifact = artifactByType(selectedArtifacts, "code_scaffold_target");
  const themeArtifact = artifactByType(selectedArtifacts, "theme_token_target");
  const recentRuns = runs.slice(0, 4);
  const routeTargets = routeArtifact ? readRouteTargets(routeArtifact.payload) : [];
  const visualPages = visualArtifact ? readVisualPages(visualArtifact.payload) : [];
  const codeFiles = codeArtifact ? readCodeFiles(codeArtifact.payload) : [];
  const themeTokens = themeArtifact ? readThemeTokens(themeArtifact.payload) : {};
  const approvedRevisionNumber = visualSurface.approvedRevisionNumber ?? codeSurface.approvedRevisionNumber ?? null;
  const latestApprovedRun = approvedRevisionNumber
    ? findLatestCompletedGenerationRun(runs, approvedRevisionNumber)
    : null;

  const visualQueueItem = firstRelevantQueueItem(refreshQueueItems, "visual", selectedRun);
  const codeQueueItem = firstRelevantQueueItem(refreshQueueItems, "code", selectedRun);
  const visualStatus = surfaceQueueStatus({
    surface: visualSurface,
    queueItem: visualQueueItem,
    selectedRun,
    approvedRevisionNumber,
    latestApprovedRun,
  });
  const codeStatus = surfaceQueueStatus({
    surface: codeSurface,
    queueItem: codeQueueItem,
    selectedRun,
    approvedRevisionNumber,
    latestApprovedRun,
  });

  const canQueueVisual = canQueue && visualStatus === "ready";
  const canQueueCode = canQueue && codeStatus === "ready";
  const canQueueBoth = canQueueVisual && canQueueCode;
  const selectedRunIsCurrent =
    Boolean(selectedRun) &&
    selectedRun?.status === "completed" &&
    latestApprovedRun !== null &&
    selectedRun.id === latestApprovedRun.id;
  const selectedRunIsSuperseded =
    Boolean(selectedRun) &&
    selectedRun?.status === "completed" &&
    approvedRevisionNumber !== null &&
    selectedRun.sourcePlanRevisionNumber === approvedRevisionNumber &&
    latestApprovedRun !== null &&
    selectedRun.id !== latestApprovedRun.id;

  return (
    <Card className="px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {dictionary.plan.generation.title}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {dictionary.plan.generation.copy}
          </p>
        </div>
        {latestRun ? (
          <Badge className={statusTone(latestRun.status)}>
            {generationStatusLabel(dictionary, latestRun.status)}
          </Badge>
        ) : null}
      </div>

      {selectedRun ? (
        <div
          id={`generation-run-${selectedRun.id}`}
          className="mt-4 rounded-[24px] border border-border bg-background/70 p-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <Badge>{generationSourceLabel(dictionary, selectedRun.source)}</Badge>
            <Badge>{generationTriggerLabel(dictionary, selectedRun.trigger)}</Badge>
            <Badge className={statusTone(selectedRun.status)}>
              {generationStatusLabel(dictionary, selectedRun.status)}
            </Badge>
          </div>

          <p className="mt-3 text-sm font-semibold text-card-foreground">{selectedRun.summary}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[20px] border border-border bg-card/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.generation.startedAt}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">
                {formatDateTimeLabel(selectedRun.startedAt, locale)}
              </p>
            </div>
            <div className="rounded-[20px] border border-border bg-card/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.generation.sourceRevision}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">
                {dictionary.plan.revisionPrefix} {selectedRun.sourcePlanRevisionNumber}
              </p>
            </div>
            <div className="rounded-[20px] border border-border bg-card/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.generation.artifactCount}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">
                {selectedArtifacts.length}
              </p>
            </div>
            <div className="rounded-[20px] border border-border bg-card/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.generation.outputSummary}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">
                {selectedRun.outputSummary
                  ? `${selectedRun.outputSummary.visualPageCount} ${dictionary.plan.generation.shortLabels.pages}, ${selectedRun.outputSummary.visualSectionCount} ${dictionary.plan.generation.shortLabels.sections}, ${selectedRun.outputSummary.codeFileCount} ${dictionary.plan.generation.shortLabels.files}`
                  : dictionary.plan.generation.none}
              </p>
            </div>
          </div>

          {selectedRun.errorMessage ? (
            <p className="mt-4 rounded-[20px] border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {selectedRun.errorMessage}
            </p>
          ) : null}

          <div className="mt-5 rounded-[22px] border border-border bg-card/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-card-foreground">
                  {dictionary.plan.generation.rerunTitle}
                </p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {dictionary.plan.generation.rerunCopy}
                </p>
              </div>
              <Badge>{dictionary.plan.revisionPrefix} {selectedRun.sourcePlanRevisionNumber}</Badge>
            </div>

            {rerunState.status === "error" ? (
              <p className="mt-4 rounded-2xl border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {rerunState.message}
              </p>
            ) : null}

            {!canQueue && readOnlyCopy ? (
              <p className="mt-4 text-sm text-muted-foreground">{readOnlyCopy}</p>
            ) : null}

            <form action={rerunFormAction} className="mt-4 flex flex-wrap gap-3">
              <QueueModeButton
                name="requestedSelection"
                value="deterministic_internal"
                label={dictionary.plan.generation.rerunDeterministic}
                pendingLabel={dictionary.plan.generation.rerunning}
                disabled={!canQueue}
                testId="generation-rerun-deterministic"
              />
              <QueueModeButton
                name="requestedSelection"
                value="external_model"
                label={dictionary.plan.generation.rerunExternal}
                pendingLabel={dictionary.plan.generation.rerunning}
                disabled={!canQueue}
                testId="generation-rerun-external"
              />
            </form>
          </div>

          {selectedArtifacts.length > 0 ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-[22px] border border-border bg-card/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-card-foreground">
                    {dictionary.plan.generation.artifacts.routePageTarget}
                  </p>
                  <Badge>{routeTargets.length} {dictionary.plan.generation.shortLabels.routes}</Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {routeTargets.map((route) => (
                    <div
                      key={`${route.pageKey}-${route.routePath}`}
                      className="rounded-[18px] border border-border bg-background/70 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-card-foreground">{route.title}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            {route.pageKey} · {route.slug}
                          </p>
                        </div>
                        <Badge>{route.sectionCount} {dictionary.plan.generation.shortLabels.sections}</Badge>
                      </div>
                      <p className="mt-2 font-mono text-xs text-muted-foreground">{route.routePath}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[22px] border border-border bg-card/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-card-foreground">
                    {dictionary.plan.generation.artifacts.visualTarget}
                  </p>
                  <Badge>{visualPages.length} {dictionary.plan.generation.shortLabels.pages}</Badge>
                </div>
                <div className="mt-3 space-y-3">
                  {visualPages.map((page) => {
                    const sections = Array.isArray(page.sections)
                      ? page.sections.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
                      : [];

                    return (
                      <div
                        key={String(page.pageKey)}
                        className="rounded-[18px] border border-border bg-background/70 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-card-foreground">
                              {String(page.title ?? page.pageKey)}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              {String(page.pageKey)} · {String(page.slug ?? "")}
                            </p>
                          </div>
                          <Badge>{sections.length} {dictionary.plan.generation.shortLabels.sections}</Badge>
                        </div>
                        <div className="mt-3 space-y-2">
                          {sections.map((section, index) => {
                            const sectionPayload =
                              typeof section.contentPayload === "object" && section.contentPayload
                                ? (section.contentPayload as Record<string, unknown>)
                                : {};
                            const summary = summarizeContent(sectionPayload);

                            return (
                              <div
                                key={String(section.sectionKey ?? section.id ?? `${page.pageKey}-${index}`)}
                                className="rounded-[16px] border border-border bg-card/70 px-3 py-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-semibold text-card-foreground">
                                      {String(section.label ?? section.title ?? section.sectionKey ?? "section")}
                                    </p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                      {String(section.sectionType ?? "section")}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Badge>
                                      {Boolean(section.isVisible)
                                        ? dictionary.plan.generation.details.visible
                                        : dictionary.plan.generation.details.hidden}
                                    </Badge>
                                    {summary.itemCount > 0 ? (
                                      <Badge>{itemCountLabel(dictionary, summary.itemCount)}</Badge>
                                    ) : null}
                                  </div>
                                </div>
                                {(summary.eyebrow || summary.body || summary.ctaLabel) ? (
                                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                                    {summary.eyebrow ? <p>{summary.eyebrow}</p> : null}
                                    {summary.body ? <p className="leading-6">{summary.body}</p> : null}
                                    {summary.ctaLabel ? (
                                      <p className="font-semibold text-card-foreground">{summary.ctaLabel}</p>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[22px] border border-border bg-card/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-card-foreground">
                    {dictionary.plan.generation.artifacts.codeTarget}
                  </p>
                  <Badge>{codeFiles.length} {dictionary.plan.generation.shortLabels.files}</Badge>
                </div>
                <div className="mt-3 space-y-3">
                  {codeFileGroups(codeFiles).map(([group, files]) => (
                    <div key={group} className="rounded-[18px] border border-border bg-background/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-card-foreground">{group}</p>
                        <Badge>{files.length}</Badge>
                      </div>
                      <div className="mt-3 space-y-2">
                        {files.map((file) => (
                          <div
                            key={file.path}
                            className="flex items-center justify-between gap-3 rounded-[16px] border border-border bg-card/70 px-4 py-3"
                          >
                            <div>
                              <p className="font-mono text-xs text-card-foreground">{file.path}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {file.ownership} · {file.editPolicy} · {file.lineCount} {dictionary.plan.generation.details.lines}
                              </p>
                            </div>
                            <Badge>{file.language}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[22px] border border-border bg-card/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-card-foreground">
                    {dictionary.plan.generation.artifacts.themeTarget}
                  </p>
                  <Badge>{Object.keys(themeTokens).length}</Badge>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {Object.entries(themeTokens).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-[18px] border border-border bg-background/70 px-4 py-3"
                    >
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{key}</p>
                      <div className="mt-2 flex items-center gap-3">
                        {String(value).startsWith("#") ? (
                          <span
                            className="h-5 w-5 rounded-full border border-black/10"
                            style={{ backgroundColor: value }}
                          />
                        ) : null}
                        <p className="text-sm font-semibold text-card-foreground">{String(value)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[22px] border border-border bg-card/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">
                      {dictionary.plan.generation.queueReview.title}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {dictionary.plan.generation.queueReview.copy}
                    </p>
                  </div>
                  <Badge
                    className={queueStatusTone(
                      selectedRunIsCurrent
                        ? "ready"
                        : selectedRunIsSuperseded
                          ? "superseded"
                          : "outdated",
                    )}
                  >
                    {selectedRunIsCurrent
                      ? dictionary.plan.generation.queueReview.currentApproved
                      : selectedRunIsSuperseded
                        ? dictionary.plan.generation.queueReview.supersededRun
                      : dictionary.plan.generation.queueReview.outdated}
                  </Badge>
                </div>

                {selectedRunIsSuperseded && latestApprovedRun ? (
                  <div className="mt-4 rounded-[18px] border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                    <p>{dictionary.plan.generation.queueReview.supersededCopy}</p>
                    <Link
                      href={`?generationRun=${encodeURIComponent(latestApprovedRun.id)}#generation-run-${latestApprovedRun.id}`}
                      className="mt-3 inline-flex rounded-full border border-current/20 px-4 py-2 font-semibold transition hover:opacity-90"
                    >
                      {dictionary.plan.generation.queueReview.openLatestRun}
                    </Link>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {[
                    {
                      surface: "visual" as const,
                      label: dictionary.builder.tabs.visual.label,
                      state: visualSurface,
                      queueItem: visualQueueItem,
                      status: visualStatus,
                    },
                    {
                      surface: "code" as const,
                      label: dictionary.builder.tabs.code.label,
                      state: codeSurface,
                      queueItem: codeQueueItem,
                      status: codeStatus,
                    },
                  ].map((surface) => (
                    <div
                      key={surface.surface}
                      className="rounded-[18px] border border-border bg-background/70 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-card-foreground">{surface.label}</p>
                        <Badge className={queueStatusTone(surface.status)}>
                          {statusLabel(dictionary, surface.status)}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[16px] border border-border bg-card/70 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            {dictionary.plan.builderImpact.pinnedRevision}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-card-foreground">
                            {surface.state.pinnedRevisionNumber
                              ? `${dictionary.plan.revisionPrefix} ${surface.state.pinnedRevisionNumber}`
                              : dictionary.plan.builderImpact.none}
                          </p>
                        </div>
                        <div className="rounded-[16px] border border-border bg-card/70 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            {dictionary.plan.generation.queueReview.targetRevision}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-card-foreground">
                            {selectedRun
                              ? `${dictionary.plan.revisionPrefix} ${selectedRun.sourcePlanRevisionNumber}`
                              : dictionary.plan.builderImpact.none}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {surface.state.requiresManualReview ? (
                          <Badge className="border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200">
                            {dictionary.plan.builderImpact.manualReview}
                          </Badge>
                        ) : null}
                        {surface.queueItem?.status === "stale" && latestApprovedRun ? (
                          <Badge className={queueStatusTone("stale")}>
                            {dictionary.plan.generation.queueReview.staleQueue}
                          </Badge>
                        ) : null}
                        {surface.queueItem?.status === "deferred" && surface.queueItem.deferReason ? (
                          <Badge className={queueStatusTone("deferred")}>{surface.queueItem.deferReason}</Badge>
                        ) : null}
                      </div>
                      {surface.queueItem?.status === "stale" && latestApprovedRun ? (
                        <div className="mt-3 rounded-[16px] border border-red-300/50 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                          <p>{surface.queueItem.staleReason ?? dictionary.plan.generation.queueReview.staleQueueCopy}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.16em]">
                            {dictionary.plan.generation.queueReview.latestGenerationRun}: {dictionary.plan.revisionPrefix}{" "}
                            {latestApprovedRun.sourcePlanRevisionNumber}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                {!selectedRunIsCurrent && !selectedRunIsSuperseded ? (
                  <div className="mt-4 rounded-[18px] border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                    {dictionary.plan.generation.queueReview.outdatedCopy}
                  </div>
                ) : null}

                {state.status === "error" ? (
                  <p className="mt-4 rounded-2xl border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                    {state.message}
                  </p>
                ) : null}

                {!canQueue && readOnlyCopy ? (
                  <p className="mt-4 text-sm text-muted-foreground">{readOnlyCopy}</p>
                ) : null}

                <form action={formAction} className="mt-4 flex flex-wrap gap-3">
                  <input type="hidden" name="generationRunId" value={selectedRun.id} />
                  <QueueModeButton
                    name="queueMode"
                    value="visual"
                    label={dictionary.plan.generation.queueReview.queueVisualOnly}
                    pendingLabel={dictionary.plan.generation.queueReview.queueing}
                    disabled={!canQueueVisual}
                    testId="generation-queue-visual"
                  />
                  <QueueModeButton
                    name="queueMode"
                    value="code"
                    label={dictionary.plan.generation.queueReview.queueCodeOnly}
                    pendingLabel={dictionary.plan.generation.queueReview.queueing}
                    disabled={!canQueueCode}
                    testId="generation-queue-code"
                  />
                  <QueueModeButton
                    name="queueMode"
                    value="both"
                    label={dictionary.plan.generation.queueReview.queueBoth}
                    pendingLabel={dictionary.plan.generation.queueReview.queueing}
                    disabled={!canQueueBoth}
                    testId="generation-queue-both"
                  />
                </form>

                {!canQueueVisual && !canQueueCode && selectedRunIsCurrent ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {dictionary.plan.generation.queueReview.noQueueWork}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {dictionary.plan.generation.noArtifacts}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-[24px] border border-dashed border-border bg-background/70 p-4">
          <p className="text-sm text-muted-foreground">{dictionary.plan.generation.empty}</p>
        </div>
      )}

      {recentRuns.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.generation.runHistory}
          </p>
          <div className="mt-3 space-y-3">
            {recentRuns.map((run) => {
              const isSelected = selectedRun?.id === run.id;
              const isCompared = selectedGenerationComparisonRunId === run.id;
              const canCompare =
                effectiveSelectedRunId !== null &&
                effectiveSelectedRunId !== run.id &&
                selectedRun !== null &&
                sameGenerationContext(selectedRun, run);
              const reviewHref = buildGenerationHistoryHref({
                planHrefBase,
                plannerRunId: selectedPlannerRunId,
                plannerCompareId: selectedPlannerComparisonRunId,
                generationRunId: run.id,
                anchor: `generation-run-${run.id}`,
              });
              const compareHref = canCompare
                ? buildGenerationHistoryHref({
                    planHrefBase,
                    plannerRunId: selectedPlannerRunId,
                    plannerCompareId: selectedPlannerComparisonRunId,
                    generationRunId: effectiveSelectedRunId,
                    generationCompareId: run.id,
                    anchor: "generation-compare",
                  })
                : null;

              return (
                <div
                  key={run.id}
                  className={`block rounded-[22px] border p-4 transition hover:-translate-y-0.5 ${
                    isSelected
                      ? "border-primary/40 bg-primary/5"
                      : isCompared
                        ? "border-amber-300/40 bg-amber-50/50 hover:border-amber-400/40 dark:border-amber-700/40 dark:bg-amber-950/20"
                        : "border-border bg-background/70 hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-card-foreground">
                        {generationTriggerLabel(dictionary, run.trigger)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDateTimeLabel(run.startedAt, locale)}
                      </p>
                    </div>
                    <Badge className={statusTone(run.status)}>
                      {generationStatusLabel(dictionary, run.status)}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{run.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={reviewHref}
                      className={isSelected ? buttonStyles("primary") : buttonStyles("secondary")}
                    >
                      {dictionary.plan.adapterCompare.reviewCurrent}
                    </Link>
                    {compareHref ? (
                      <Link
                        href={compareHref}
                        className={buttonStyles("secondary")}
                        data-testid="generation-run-compare"
                      >
                        {dictionary.plan.adapterCompare.compareWithSelected}
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
