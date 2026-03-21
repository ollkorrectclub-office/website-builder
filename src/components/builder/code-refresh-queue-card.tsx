import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ProjectBuilderRefreshQueueItemRecord, ProjectCodeBundle } from "@/lib/builder/types";
import type { GenerationRunRecord } from "@/lib/generation/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

type CodeQueueAction = (formData: FormData) => Promise<void>;

interface CodeRefreshProgressItem {
  path: string;
  href: string;
  statusLabel: string;
  summary: string;
  tone: ProjectBuilderRefreshQueueItemRecord["status"] | "blocked" | "current";
}

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

function progressToneClass(tone: CodeRefreshProgressItem["tone"]) {
  switch (tone) {
    case "current":
      return "border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "blocked":
      return "border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200";
    case "completed":
      return queueTone("completed");
    case "deferred":
      return queueTone("deferred");
    case "pending":
      return queueTone("pending");
  }
}

export function CodeRefreshQueueCard({
  locale,
  dictionary,
  bundle,
  queueItem,
  queueGenerationRun,
  latestGenerationRun,
  replacementHref,
  selectedFilePath,
  openVisualHref,
  firstReviewHref,
  reviewProgressItems,
  reviewedFileCount,
  totalReviewFileCount,
  deferAction,
  completeAction,
  canReview = true,
  readOnlyCopy,
}: {
  locale: Locale;
  dictionary: Dictionary;
  bundle: ProjectCodeBundle;
  queueItem: ProjectBuilderRefreshQueueItemRecord;
  queueGenerationRun: GenerationRunRecord | null;
  latestGenerationRun: GenerationRunRecord | null;
  replacementHref: string | null;
  selectedFilePath: string;
  openVisualHref: string;
  firstReviewHref: string | null;
  reviewProgressItems: CodeRefreshProgressItem[];
  reviewedFileCount: number;
  totalReviewFileCount: number;
  deferAction: CodeQueueAction;
  completeAction: CodeQueueAction;
  canReview?: boolean;
  readOnlyCopy?: string;
}) {
  const visualReady = bundle.visualSyncState.sourceRevisionNumber >= queueItem.targetPlanRevisionNumber;
  const reviewComplete =
    visualReady &&
    bundle.codeSyncState.sourceRevisionNumber >= queueItem.targetPlanRevisionNumber &&
    bundle.codeSyncState.staleFileCount === 0;
  const isStale = queueItem.status === "stale";

  return (
    <Card className="px-5 py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {dictionary.builder.refreshQueue.codeEyebrow}
          </p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {isStale
              ? dictionary.builder.refreshQueue.codeStaleCopy
              : !visualReady
              ? dictionary.builder.refreshQueue.codeWaitingVisualCopy
              : reviewComplete
                ? dictionary.builder.refreshQueue.codeReadyCompleteCopy
                : dictionary.builder.refreshQueue.codeReviewCopy}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className={queueTone(queueItem.status)}>
            {dictionary.builder.refreshQueue.statuses[queueItem.status]}
          </Badge>
          {queueItem.requiresManualReview ? (
            <Badge className="border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200">
              {dictionary.builder.refreshQueue.manualReview}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-5">
        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.refreshQueue.visualPinned}
          </p>
          <p className="mt-2 text-lg font-semibold text-card-foreground">
            {dictionary.plan.revisionPrefix} {bundle.visualSyncState.sourceRevisionNumber}
          </p>
        </div>
        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.refreshQueue.currentPinned}
          </p>
          <p className="mt-2 text-lg font-semibold text-card-foreground">
            {dictionary.plan.revisionPrefix} {bundle.codeSyncState.sourceRevisionNumber}
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
            {dictionary.builder.refreshQueue.filesNeedingReview}
          </p>
          <p className="mt-2 text-lg font-semibold text-card-foreground">
            {bundle.codeSyncState.staleFileCount}
          </p>
        </div>
        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.refreshQueue.manualChanges}
          </p>
          <p className="mt-2 text-lg font-semibold text-card-foreground">
            {bundle.codeSyncState.hasManualChanges
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
            {!visualReady ? (
              <Link
                href={openVisualHref}
                data-testid="code-queue-open-visual"
                className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition hover:opacity-90"
              >
                {dictionary.builder.refreshQueue.openVisualQueue}
              </Link>
            ) : reviewComplete ? (
              <form action={completeAction}>
                <input type="hidden" name="queueItemId" value={queueItem.id} />
                <input type="hidden" name="filePath" value={selectedFilePath} />
                <button
                  type="submit"
                  data-testid="code-queue-complete"
                  disabled={!canReview}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition hover:opacity-90"
                >
                  {dictionary.builder.refreshQueue.completeCodeReview}
                </button>
              </form>
            ) : firstReviewHref ? (
              <Link
                href={firstReviewHref}
                data-testid="code-queue-start-review"
                aria-disabled={!canReview}
                className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition hover:opacity-90"
              >
                {dictionary.builder.refreshQueue.startCodeReview}
              </Link>
            ) : null}

            <form action={deferAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="queueItemId" value={queueItem.id} />
              <input type="hidden" name="filePath" value={selectedFilePath} />
              <input
                name="deferReason"
                defaultValue={dictionary.builder.refreshQueue.deferCodeDefault}
                disabled={!canReview}
                className="min-w-[240px] rounded-full border border-border bg-background px-4 py-2 text-sm text-card-foreground outline-none transition focus:border-primary/40"
              />
              <button
                type="submit"
                disabled={!canReview}
                className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-semibold text-card-foreground transition hover:-translate-y-0.5 hover:border-primary/40"
              >
                {dictionary.builder.refreshQueue.defer}
              </button>
            </form>
          </>
        )}
      </div>

      {!canReview && readOnlyCopy ? (
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

      <div className="mt-5 rounded-[24px] border border-border bg-background/70 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.builder.refreshQueue.rebaseProgressTitle}
            </p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {visualReady
                ? dictionary.builder.refreshQueue.rebaseProgressCopy
                : dictionary.builder.refreshQueue.rebaseProgressWaitingCopy}
            </p>
          </div>
          <div className="rounded-[20px] border border-border bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.builder.refreshQueue.reviewedFiles}
            </p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">
              {visualReady ? `${reviewedFileCount} / ${totalReviewFileCount}` : "0 / 0"}
            </p>
          </div>
        </div>

        {!isStale && visualReady && reviewProgressItems.length > 0 ? (
          <div className="mt-4 space-y-3">
            {reviewProgressItems.map((item) => (
              <Link
                key={item.path}
                href={item.href}
                className="block rounded-[20px] border border-border bg-card/80 px-4 py-4 transition hover:border-primary/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">{item.path}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                  </div>
                  <Badge className={progressToneClass(item.tone)}>
                    {item.statusLabel}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
