import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { VisualRefreshDiffRecord } from "@/lib/builder/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";

function changeTone(type: "added" | "removed" | "changed") {
  switch (type) {
    case "added":
      return "border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "removed":
      return "border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200";
    case "changed":
      return "border-amber-300/50 bg-amber-100/70 text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-200";
  }
}

export function VisualRefreshDiffCard({
  dictionary,
  diff,
}: {
  dictionary: Dictionary;
  diff: VisualRefreshDiffRecord;
}) {
  const hasChanges =
    diff.pageChanges.length > 0 || diff.sectionChanges.length > 0;

  return (
    <Card className="px-5 py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {dictionary.builder.refreshQueue.diffEyebrow}
          </p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {hasChanges
              ? dictionary.builder.refreshQueue.diffCopy
              : dictionary.builder.refreshQueue.diffNoChangesCopy}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{dictionary.plan.revisionPrefix} {diff.currentRevisionNumber}</Badge>
          <Badge>{dictionary.plan.revisionPrefix} {diff.targetRevisionNumber}</Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.refreshQueue.pageDelta}
          </p>
          <p className="mt-2 text-lg font-semibold text-card-foreground">
            {diff.currentPageCount} → {diff.targetPageCount}
          </p>
        </div>
        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.refreshQueue.sectionDelta}
          </p>
          <p className="mt-2 text-lg font-semibold text-card-foreground">
            {diff.currentSectionCount} → {diff.targetSectionCount}
          </p>
        </div>
        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.refreshQueue.pageChangesLabel}
          </p>
          <p className="mt-2 text-lg font-semibold text-card-foreground">
            +{diff.addedPageCount} / -{diff.removedPageCount} / ~{diff.changedPageCount}
          </p>
        </div>
        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.refreshQueue.sectionChangesLabel}
          </p>
          <p className="mt-2 text-lg font-semibold text-card-foreground">
            +{diff.addedSectionCount} / -{diff.removedSectionCount} / ~{diff.changedSectionCount}
          </p>
        </div>
        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.refreshQueue.themeChangesLabel}
          </p>
          <p className="mt-2 text-lg font-semibold text-card-foreground">
            {diff.changedThemeTokenCount}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.refreshQueue.pageReviewTitle}
          </p>
          <div className="mt-4 space-y-3">
            {diff.pageChanges.length > 0 ? diff.pageChanges.map((change) => (
              <div key={`${change.changeType}-${change.pageKey}`} className="rounded-[20px] border border-border bg-card/80 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">
                      {change.afterTitle ?? change.beforeTitle ?? change.pageKey}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {change.beforeTitle && change.afterTitle && change.beforeTitle !== change.afterTitle
                        ? `${change.beforeTitle} → ${change.afterTitle}`
                        : change.beforeSlug && change.afterSlug && change.beforeSlug !== change.afterSlug
                          ? `${change.beforeSlug} → ${change.afterSlug}`
                          : dictionary.builder.refreshQueue.structureStable}
                    </p>
                  </div>
                  <Badge className={changeTone(change.changeType)}>
                    {dictionary.builder.refreshQueue.changeTypes[change.changeType]}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  +{change.sectionAddedCount} / -{change.sectionRemovedCount} / ~{change.sectionChangedCount}
                </p>
              </div>
            )) : (
              <p className="text-sm leading-7 text-muted-foreground">
                {dictionary.builder.refreshQueue.noPageChanges}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.refreshQueue.sectionReviewTitle}
          </p>
          <div className="mt-4 space-y-3">
            {diff.sectionChanges.length > 0 ? diff.sectionChanges.map((change) => {
              const detailParts = [
                change.beforeLabel && change.afterLabel && change.beforeLabel !== change.afterLabel
                  ? `${change.beforeLabel} → ${change.afterLabel}`
                  : null,
                change.contentChanged ? dictionary.builder.refreshQueue.contentChanged : null,
                change.visibilityChanged ? dictionary.builder.refreshQueue.visibilityChanged : null,
              ].filter(Boolean);

              return (
                <div key={`${change.changeType}-${change.sectionKey}`} className="rounded-[20px] border border-border bg-card/80 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-card-foreground">
                        {change.pageTitle}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {change.afterLabel ?? change.beforeLabel ?? change.sectionKey}
                      </p>
                    </div>
                    <Badge className={changeTone(change.changeType)}>
                      {dictionary.builder.refreshQueue.changeTypes[change.changeType]}
                    </Badge>
                  </div>
                  {detailParts.length > 0 ? (
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {detailParts.join(" · ")}
                    </p>
                  ) : null}
                </div>
              );
            }) : (
              <p className="text-sm leading-7 text-muted-foreground">
                {dictionary.builder.refreshQueue.noSectionChanges}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.refreshQueue.themeReviewTitle}
          </p>
          <div className="mt-4 space-y-3">
            {diff.themeTokenChanges.length > 0 ? diff.themeTokenChanges.map((change) => (
              <div
                key={change.tokenKey}
                className="rounded-[20px] border border-border bg-card/80 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">
                      {dictionary.builder.refreshQueue.themeTokenLabels[change.tokenKey]}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {change.beforeValue} → {change.afterValue}
                    </p>
                  </div>
                  <Badge className={changeTone("changed")}>
                    {dictionary.builder.refreshQueue.changeTypes.changed}
                  </Badge>
                </div>
              </div>
            )) : (
              <p className="text-sm leading-7 text-muted-foreground">
                {dictionary.builder.refreshQueue.noThemeChanges}
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
