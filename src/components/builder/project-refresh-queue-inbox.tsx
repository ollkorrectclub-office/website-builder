import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { projectTabRoute } from "@/lib/builder/routes";
import { buildRefreshQueueSummary } from "@/lib/builder/refresh-queue-review";
import type { ProjectBuilderRefreshQueueItemRecord } from "@/lib/builder/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

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

export function ProjectRefreshQueueInbox({
  locale,
  dictionary,
  workspaceSlug,
  projectSlug,
  queueItems,
}: {
  locale: Locale;
  dictionary: Dictionary;
  workspaceSlug: string;
  projectSlug: string;
  queueItems: ProjectBuilderRefreshQueueItemRecord[];
}) {
  const summary = buildRefreshQueueSummary(queueItems);

  return (
    <Card className="border-border/70 bg-background/80 px-5 py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {dictionary.builder.queueInbox.title}
          </p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {summary.activeItems.length > 0
              ? dictionary.builder.queueInbox.activeCopy
              : dictionary.builder.queueInbox.clearCopy}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-[22px] border border-border bg-background/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.builder.queueInbox.pending}
            </p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">{summary.pendingCount}</p>
          </div>
          <div className="rounded-[22px] border border-border bg-background/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.builder.queueInbox.deferred}
            </p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">{summary.deferredCount}</p>
          </div>
          <div className="rounded-[22px] border border-border bg-background/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.builder.queueInbox.stale}
            </p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">{summary.staleCount}</p>
          </div>
          <div className="rounded-[22px] border border-border bg-background/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.builder.queueInbox.completed}
            </p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">{summary.completedCount}</p>
          </div>
        </div>
      </div>

      {summary.activeItems.length > 0 ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {summary.activeItems.map((item) => (
            <Link
              key={item.id}
              href={projectTabRoute(locale, workspaceSlug, projectSlug, item.surface)}
              className="rounded-[24px] border border-border bg-background/70 px-4 py-4 transition hover:border-primary/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-card-foreground">
                    {item.surface === "visual"
                      ? dictionary.builder.queueInbox.visualItem
                      : dictionary.builder.queueInbox.codeItem}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                </div>
                <Badge className={queueTone(item.status)}>
                  {dictionary.builder.refreshQueue.statuses[item.status]}
                </Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <span>
                  {dictionary.builder.queueInbox.pinnedLabel}: {item.pinnedPlanRevisionNumber ?? "None"}
                </span>
                <span>
                  {dictionary.builder.queueInbox.targetLabel}: {item.targetPlanRevisionNumber}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
