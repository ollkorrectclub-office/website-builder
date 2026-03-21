import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { projectTabRoute } from "@/lib/builder/routes";
import type {
  BuilderImpactSurfaceRecord,
  BuilderPromotionQueueDraft,
  ProjectBuilderRefreshQueueItemRecord,
} from "@/lib/builder/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

function surfaceRoute(
  locale: Locale,
  workspaceSlug: string,
  projectSlug: string,
  surface: BuilderImpactSurfaceRecord["surface"],
) {
  if (surface === "preview") {
    return projectTabRoute(locale, workspaceSlug, projectSlug, "preview");
  }

  return projectTabRoute(locale, workspaceSlug, projectSlug, surface);
}

function surfaceTone(status: BuilderImpactSurfaceRecord["status"]) {
  switch (status) {
    case "current":
      return "border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "refresh_pending":
      return "border-amber-300/50 bg-amber-100/70 text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-200";
    case "refresh_blocked":
      return "border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200";
    case "not_initialized":
      return "border-border bg-background/80 text-muted-foreground";
  }
}

function queueSurfaceLabel(
  dictionary: Dictionary,
  surface: BuilderImpactSurfaceRecord["surface"] | BuilderPromotionQueueDraft["surface"],
) {
  switch (surface) {
    case "visual":
      return dictionary.builder.tabs.visual.label;
    case "code":
      return dictionary.builder.tabs.code.label;
    case "preview":
      return dictionary.builder.tabs.preview.label;
  }
}

function surfaceStatusLabel(dictionary: Dictionary, status: BuilderImpactSurfaceRecord["status"]) {
  return dictionary.plan.builderImpact.statuses[status];
}

function renderPinnedRevision(
  dictionary: Dictionary,
  surface: BuilderImpactSurfaceRecord,
) {
  return surface.pinnedRevisionNumber
    ? `${dictionary.plan.revisionPrefix} ${surface.pinnedRevisionNumber}`
    : dictionary.plan.builderImpact.none;
}

export function PlanBuilderImpactCard({
  locale,
  dictionary,
  workspaceSlug,
  projectSlug,
  surfaces,
  pendingQueue,
  promotionQueueDrafts,
}: {
  locale: Locale;
  dictionary: Dictionary;
  workspaceSlug: string;
  projectSlug: string;
  surfaces: BuilderImpactSurfaceRecord[];
  pendingQueue: ProjectBuilderRefreshQueueItemRecord[];
  promotionQueueDrafts: BuilderPromotionQueueDraft[];
}) {
  return (
    <Card id="refresh-handoff" className="px-5 py-5">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {dictionary.plan.builderImpact.eyebrow}
      </p>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        {dictionary.plan.builderImpact.copy}
      </p>

      <div className="mt-4 space-y-3">
        {surfaces.map((surface) => (
          <div
            key={surface.surface}
            className="rounded-[22px] border border-border bg-background/70 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-card-foreground">
                  {queueSurfaceLabel(dictionary, surface.surface)}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {dictionary.plan.builderImpact.pinnedRevision}: {renderPinnedRevision(dictionary, surface)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={surfaceTone(surface.status)}>
                  {surfaceStatusLabel(dictionary, surface.status)}
                </Badge>
                <Link
                  href={surfaceRoute(locale, workspaceSlug, projectSlug, surface.surface)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-card-foreground transition hover:-translate-y-0.5 hover:border-primary/40"
                >
                  {dictionary.plan.builderImpact.openSurface}
                </Link>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-[18px] border border-border bg-card/70 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {dictionary.plan.builderImpact.approvedRevision}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">
                  {surface.approvedRevisionNumber
                    ? `${dictionary.plan.revisionPrefix} ${surface.approvedRevisionNumber}`
                    : dictionary.plan.builderImpact.none}
                </p>
              </div>
              <div className="rounded-[18px] border border-border bg-card/70 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {dictionary.plan.builderImpact.latestCandidate}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">
                  {surface.latestCandidateRevisionNumber
                    ? `${dictionary.plan.revisionPrefix} ${surface.latestCandidateRevisionNumber}`
                    : dictionary.plan.builderImpact.none}
                </p>
              </div>
              <div className="rounded-[18px] border border-border bg-card/70 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {dictionary.plan.builderImpact.targetAfterPromotion}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">
                  {surface.targetRevisionNumber
                    ? `${dictionary.plan.revisionPrefix} ${surface.targetRevisionNumber}`
                    : dictionary.plan.builderImpact.none}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
              {surface.needsRefreshAfterPromotion ? (
                <Badge className={surfaceTone(surface.status)}>
                  {dictionary.plan.builderImpact.refreshRequired}
                </Badge>
              ) : (
                <Badge className={surfaceTone("current")}>
                  {dictionary.plan.builderImpact.noRefreshRequired}
                </Badge>
              )}
              {surface.hasManualChanges ? (
                <Badge className="border-border bg-background/80 text-muted-foreground">
                  {dictionary.plan.builderImpact.manualChanges}
                </Badge>
              ) : null}
              {surface.requiresManualReview ? (
                <Badge className="border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200">
                  {dictionary.plan.builderImpact.manualReview}
                </Badge>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.builderImpact.afterPromotionQueue}
          </p>
          <div className="mt-3 space-y-3">
            {promotionQueueDrafts.length > 0 ? (
              promotionQueueDrafts.map((item) => (
                <div key={`${item.surface}-${item.targetPlanRevisionNumber}`} className="rounded-[18px] border border-border bg-card/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-card-foreground">
                      {queueSurfaceLabel(dictionary, item.surface)}
                    </p>
                    <Badge
                      className={cn(
                        item.requiresManualReview
                          ? "border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200"
                          : "border-amber-300/50 bg-amber-100/70 text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-200",
                      )}
                    >
                      {item.requiresManualReview
                        ? dictionary.plan.builderImpact.manualReview
                        : dictionary.plan.builderImpact.queueReady}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-7 text-muted-foreground">
                {dictionary.plan.builderImpact.queuePreviewEmpty}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.builderImpact.pendingQueue}
          </p>
          <div className="mt-3 space-y-3">
            {pendingQueue.length > 0 ? (
              pendingQueue.map((item) => (
                <div key={item.id} className="rounded-[18px] border border-border bg-card/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-card-foreground">
                      {queueSurfaceLabel(dictionary, item.surface)}
                    </p>
                    <Badge
                      className={
                        item.status === "pending"
                          ? surfaceTone(item.requiresManualReview ? "refresh_blocked" : "refresh_pending")
                          : item.status === "deferred"
                            ? surfaceTone("refresh_blocked")
                            : item.status === "stale"
                              ? surfaceTone("refresh_blocked")
                            : surfaceTone("current")
                      }
                    >
                      {item.status === "pending"
                        ? dictionary.plan.builderImpact.queuePending
                        : item.status === "deferred"
                          ? dictionary.plan.builderImpact.queueDeferred
                          : item.status === "stale"
                            ? dictionary.plan.builderImpact.queueStale
                          : dictionary.plan.builderImpact.queueCompleted}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {dictionary.plan.builderImpact.queueMeta.replace(
                      "{revision}",
                      `${dictionary.plan.revisionPrefix} ${item.targetPlanRevisionNumber}`,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.completedAt
                      ? formatDateTimeLabel(item.completedAt, locale)
                      : formatDateTimeLabel(item.createdAt, locale)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-7 text-muted-foreground">
                {dictionary.plan.builderImpact.pendingQueueEmpty}
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
