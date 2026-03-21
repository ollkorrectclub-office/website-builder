import Link from "next/link";

import type { ProjectBuilderRefreshQueueItemRecord, ProjectVisualBundle } from "@/lib/builder/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { GenerationRunRecord } from "@/lib/generation/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

type VisualQueueAction = (formData: FormData) => Promise<void>;

function queueTone(status: ProjectBuilderRefreshQueueItemRecord["status"]) {
  switch (status) {
    case "pending":
      return "border-amber-300/50 bg-amber-100/70 text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-200";
    case "deferred":
      return "border-border bg-background/80 text-muted-foreground";
    case "stale":
      return "border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200";
    case "completed":
      return "border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
}

export function VisualRefreshQueueCard({
  locale,
  dictionary,
  bundle,
  queueItem,
  queueGenerationRun,
  latestGenerationRun,
  replacementHref,
  selectedPageId,
  selectedSectionId,
  acceptAction,
  deferAction,
  canIntake = true,
  readOnlyCopy,
}: {
  locale: Locale;
  dictionary: Dictionary;
  bundle: ProjectVisualBundle;
  queueItem: ProjectBuilderRefreshQueueItemRecord;
  queueGenerationRun: GenerationRunRecord | null;
  latestGenerationRun: GenerationRunRecord | null;
  replacementHref: string | null;
  selectedPageId: string;
  selectedSectionId: string | null;
  acceptAction: VisualQueueAction;
  deferAction: VisualQueueAction;
  canIntake?: boolean;
  readOnlyCopy?: string;
}) {
  const alreadyCurrent = bundle.syncState.sourceRevisionNumber >= queueItem.targetPlanRevisionNumber;
  const isStale = queueItem.status === "stale";

  return (
    <Card className="px-5 py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {dictionary.builder.refreshQueue.visualEyebrow}
          </p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {isStale
              ? dictionary.builder.refreshQueue.visualStaleCopy
              : alreadyCurrent
              ? dictionary.builder.refreshQueue.visualReadyCopy
              : dictionary.builder.refreshQueue.visualPendingCopy}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className={queueTone(queueItem.status)}>
            {dictionary.builder.refreshQueue.statuses[queueItem.status]}
          </Badge>
          {queueItem.requiresManualReview || bundle.syncState.hasManualChanges ? (
            <Badge className="border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200">
              {dictionary.builder.refreshQueue.manualReview}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.refreshQueue.currentPinned}
          </p>
          <p className="mt-2 text-lg font-semibold text-card-foreground">
            {dictionary.plan.revisionPrefix} {bundle.syncState.sourceRevisionNumber}
          </p>
        </div>
        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.refreshQueue.approvedTarget}
          </p>
          <p className="mt-2 text-lg font-semibold text-card-foreground">
            {dictionary.plan.revisionPrefix} {queueItem.targetPlanRevisionNumber}
          </p>
        </div>
        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.refreshQueue.queueState}
          </p>
          <p className="mt-2 text-lg font-semibold text-card-foreground">
            {dictionary.builder.refreshQueue.statuses[queueItem.status]}
          </p>
        </div>
        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.refreshQueue.manualChanges}
          </p>
          <p className="mt-2 text-lg font-semibold text-card-foreground">
            {bundle.syncState.hasManualChanges
              ? dictionary.builder.refreshQueue.manualChangesYes
              : dictionary.builder.refreshQueue.manualChangesNo}
          </p>
        </div>
      </div>

      {(queueGenerationRun || latestGenerationRun) ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.builder.refreshQueue.queueGenerationRun}
            </p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">
              {queueGenerationRun
                ? `${dictionary.plan.revisionPrefix} ${queueGenerationRun.sourcePlanRevisionNumber}`
                : dictionary.plan.builderImpact.none}
            </p>
            {queueGenerationRun ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {formatDateTimeLabel(queueGenerationRun.startedAt, locale)}
              </p>
            ) : null}
          </div>
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.builder.refreshQueue.latestGenerationRun}
            </p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">
              {latestGenerationRun
                ? `${dictionary.plan.revisionPrefix} ${latestGenerationRun.sourcePlanRevisionNumber}`
                : dictionary.plan.builderImpact.none}
            </p>
            {latestGenerationRun ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {formatDateTimeLabel(latestGenerationRun.startedAt, locale)}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        {isStale ? (
          replacementHref ? (
            <Link
              href={replacementHref}
              className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition hover:opacity-90"
            >
              {dictionary.builder.refreshQueue.openLatestGenerationReview}
            </Link>
          ) : null
        ) : (
          <>
            <form action={acceptAction}>
              <input type="hidden" name="queueItemId" value={queueItem.id} />
              <input type="hidden" name="selectedPageId" value={selectedPageId} />
              <input type="hidden" name="selectedSectionId" value={selectedSectionId ?? ""} />
              <button
                type="submit"
                data-testid="visual-queue-accept"
                disabled={!canIntake}
                className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition hover:opacity-90"
              >
                {alreadyCurrent
                  ? dictionary.builder.refreshQueue.markCompleted
                  : dictionary.builder.refreshQueue.acceptVisual}
              </button>
            </form>

            <form action={deferAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="queueItemId" value={queueItem.id} />
              <input type="hidden" name="selectedPageId" value={selectedPageId} />
              <input type="hidden" name="selectedSectionId" value={selectedSectionId ?? ""} />
              <input
                name="deferReason"
                defaultValue={dictionary.builder.refreshQueue.deferVisualDefault}
                disabled={!canIntake}
                className="min-w-[240px] rounded-full border border-border bg-background px-4 py-2 text-sm text-card-foreground outline-none transition focus:border-primary/40"
              />
              <button
                type="submit"
                disabled={!canIntake}
                className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-semibold text-card-foreground transition hover:-translate-y-0.5 hover:border-primary/40"
              >
                {dictionary.builder.refreshQueue.defer}
              </button>
            </form>
          </>
        )}
      </div>

      {!canIntake && readOnlyCopy ? (
        <p className="mt-4 text-sm leading-7 text-muted-foreground">{readOnlyCopy}</p>
      ) : null}

      {queueItem.status === "deferred" && queueItem.deferReason ? (
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          {dictionary.builder.refreshQueue.deferredReasonLabel}: {queueItem.deferReason}
        </p>
      ) : null}

      {queueItem.status === "stale" && queueItem.staleReason ? (
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          {dictionary.builder.refreshQueue.staleReasonLabel}: {queueItem.staleReason}
        </p>
      ) : null}
    </Card>
  );
}
