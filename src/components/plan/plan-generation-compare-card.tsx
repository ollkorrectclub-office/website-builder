"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { buildGenerationOutputComparison } from "@/lib/model-adapters/comparisons";
import {
  externalModelProviderLabel,
  modelAdapterExecutionModeLabel,
  modelAdapterSelectionLabel,
  modelAdapterSourceLabel,
} from "@/lib/model-adapters/labels";
import type { ModelAdapterRunRecord } from "@/lib/model-adapters/types";
import type { GenerationArtifactRecord, GenerationRunRecord } from "@/lib/generation/types";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

function buildGenerationCompareHref(input: {
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

function AdapterRunSummary({
  locale,
  dictionary,
  label,
  run,
  adapterRun,
}: {
  locale: Locale;
  dictionary: Dictionary;
  label: string;
  run: GenerationRunRecord;
  adapterRun: ModelAdapterRunRecord | null;
}) {
  return (
    <div className="rounded-[22px] border border-border bg-background/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-card-foreground">{label}</p>
        <Badge>{formatDateTimeLabel(run.startedAt, locale)}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {adapterRun ? <Badge>{modelAdapterSelectionLabel(dictionary, adapterRun.requestedSelection)}</Badge> : null}
        {adapterRun ? <Badge>{modelAdapterSourceLabel(dictionary, adapterRun.sourceType)}</Badge> : null}
        {adapterRun ? <Badge>{modelAdapterExecutionModeLabel(dictionary, adapterRun.executionMode)}</Badge> : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-border bg-card/70 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.providerTrace.actualAdapter}
          </p>
          <p className="mt-2 text-sm font-semibold text-card-foreground">
            {adapterRun?.executedAdapterKey ?? run.source}
          </p>
        </div>
        <div className="rounded-[18px] border border-border bg-card/70 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.providerTrace.provider}
          </p>
          <p className="mt-2 text-sm font-semibold text-card-foreground">
            {externalModelProviderLabel(dictionary, adapterRun?.providerKey ?? null)}
          </p>
        </div>
        <div className="rounded-[18px] border border-border bg-card/70 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.providerTrace.model}
          </p>
          <p className="mt-2 text-sm font-semibold text-card-foreground">
            {adapterRun?.modelName || dictionary.plan.providerTrace.none}
          </p>
        </div>
        <div className="rounded-[18px] border border-border bg-card/70 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.providerTrace.latency}
          </p>
          <p className="mt-2 text-sm font-semibold text-card-foreground">
            {adapterRun?.latencyMs !== null && adapterRun?.latencyMs !== undefined
              ? `${adapterRun.latencyMs} ${dictionary.plan.providerTrace.milliseconds}`
              : dictionary.plan.providerTrace.none}
          </p>
        </div>
        <div className="rounded-[18px] border border-border bg-card/70 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.adapterCompare.sourceRevision}
          </p>
          <p className="mt-2 text-sm font-semibold text-card-foreground">
            {dictionary.plan.revisionPrefix} {run.sourcePlanRevisionNumber}
          </p>
        </div>
        <div className="rounded-[18px] border border-border bg-card/70 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.generation.artifactCount}
          </p>
          <p className="mt-2 text-sm font-semibold text-card-foreground">
            {run.outputSummary
              ? `${run.outputSummary.routeCount} / ${run.outputSummary.codeFileCount}`
              : dictionary.plan.providerTrace.none}
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  beforeValue,
  afterValue,
}: {
  label: string;
  beforeValue: number;
  afterValue: number;
}) {
  return (
    <div className="rounded-[20px] border border-border bg-background/70 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold text-card-foreground">
        {beforeValue} → {afterValue}
      </p>
    </div>
  );
}

function changeTone(changeType: "added" | "removed" | "changed") {
  switch (changeType) {
    case "added":
      return "border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "removed":
      return "border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200";
    case "changed":
      return "border-amber-300/50 bg-amber-100/70 text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-200";
  }
}

function changeLabel(dictionary: Dictionary, changeType: "added" | "removed" | "changed") {
  return dictionary.builder.refreshQueue.changeTypes[changeType];
}

function renderChangeList(
  title: string,
  emptyCopy: string,
  items: Array<{
    key: string;
    changeType: "added" | "removed" | "changed";
    title: string;
    summary: string;
  }>,
  dictionary: Dictionary,
) {
  return (
    <div className="rounded-[22px] border border-border bg-background/70 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      {items.length > 0 ? (
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <div key={item.key} className="rounded-[18px] border border-border bg-card/70 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-card-foreground">{item.title}</p>
                <Badge className={changeTone(item.changeType)}>
                  {changeLabel(dictionary, item.changeType)}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{emptyCopy}</p>
      )}
    </div>
  );
}

export function PlanGenerationCompareCard({
  locale,
  dictionary,
  planHrefBase,
  selectedRun,
  selectedAdapterRun,
  comparisonRun,
  comparisonAdapterRun,
  selectedPlannerRunId,
  selectedPlannerComparisonRunId,
  selectedComparisonRunId,
  artifacts,
}: {
  locale: Locale;
  dictionary: Dictionary;
  planHrefBase: string;
  selectedRun: GenerationRunRecord | null;
  selectedAdapterRun: ModelAdapterRunRecord | null;
  comparisonRun: GenerationRunRecord | null;
  comparisonAdapterRun: ModelAdapterRunRecord | null;
  selectedPlannerRunId: string | null;
  selectedPlannerComparisonRunId: string | null;
  selectedComparisonRunId: string | null;
  artifacts: GenerationArtifactRecord[];
}) {
  const comparison = buildGenerationOutputComparison({
    selectedRun,
    comparisonRun,
    artifacts,
  });
  const clearHref = selectedRun
    ? buildGenerationCompareHref({
        planHrefBase,
        plannerRunId: selectedPlannerRunId,
        plannerCompareId: selectedPlannerComparisonRunId,
        generationRunId: selectedRun.id,
        anchor: `generation-run-${selectedRun.id}`,
      })
    : null;
  const reviewLeftHref = selectedRun
    ? buildGenerationCompareHref({
        planHrefBase,
        plannerRunId: selectedPlannerRunId,
        plannerCompareId: selectedPlannerComparisonRunId,
        generationRunId: selectedRun.id,
        anchor: `generation-run-${selectedRun.id}`,
      })
    : null;
  const reviewRightHref = comparisonRun
    ? buildGenerationCompareHref({
        planHrefBase,
        plannerRunId: selectedPlannerRunId,
        plannerCompareId: selectedPlannerComparisonRunId,
        generationRunId: comparisonRun.id,
        anchor: `generation-run-${comparisonRun.id}`,
      })
    : null;

  return (
    <Card id="generation-compare" className="px-5 py-5" data-testid="generation-compare-card">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {dictionary.plan.adapterCompare.generationTitle}
      </p>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        {dictionary.plan.adapterCompare.generationCopy}
      </p>

      {selectedRun ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {reviewLeftHref ? (
            <Link
              href={reviewLeftHref}
              className={buttonStyles("secondary")}
              data-testid="generation-compare-review-left"
            >
              {dictionary.plan.adapterCompare.reviewLeft}
            </Link>
          ) : null}
          {reviewRightHref ? (
            <Link
              href={reviewRightHref}
              className={buttonStyles("secondary")}
              data-testid="generation-compare-review-right"
            >
              {dictionary.plan.adapterCompare.reviewRight}
            </Link>
          ) : null}
          {selectedComparisonRunId && clearHref ? (
            <Link
              href={clearHref}
              className={buttonStyles("secondary")}
              data-testid="generation-compare-clear"
            >
              {dictionary.plan.adapterCompare.clearPairing}
            </Link>
          ) : null}
        </div>
      ) : null}

      {!selectedRun ? (
        <div className="mt-4 rounded-[22px] border border-dashed border-border bg-background/60 p-4">
          <p className="text-sm text-muted-foreground">{dictionary.plan.adapterCompare.noSelectedRun}</p>
        </div>
      ) : !comparisonRun ? (
        <div className="mt-4 rounded-[22px] border border-dashed border-border bg-background/60 p-4">
          <p className="text-sm text-muted-foreground">{dictionary.plan.adapterCompare.noComparison}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <AdapterRunSummary
              locale={locale}
              dictionary={dictionary}
              label={dictionary.plan.adapterCompare.leftRun}
              run={selectedRun}
              adapterRun={selectedAdapterRun}
            />
            <AdapterRunSummary
              locale={locale}
              dictionary={dictionary}
              label={dictionary.plan.adapterCompare.rightRun}
              run={comparisonRun}
              adapterRun={comparisonAdapterRun}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryMetric
              label={dictionary.plan.generation.shortLabels.routes}
              beforeValue={comparison.beforeRouteCount}
              afterValue={comparison.afterRouteCount}
            />
            <SummaryMetric
              label={dictionary.plan.generation.shortLabels.pages}
              beforeValue={comparison.beforePageCount}
              afterValue={comparison.afterPageCount}
            />
            <SummaryMetric
              label={dictionary.plan.generation.shortLabels.sections}
              beforeValue={comparison.beforeSectionCount}
              afterValue={comparison.afterSectionCount}
            />
            <SummaryMetric
              label={dictionary.plan.generation.shortLabels.files}
              beforeValue={comparison.beforeCodeFileCount}
              afterValue={comparison.afterCodeFileCount}
            />
            <SummaryMetric
              label={dictionary.plan.adapterCompare.themeTokens}
              beforeValue={comparison.beforeThemeTokenCount}
              afterValue={comparison.afterThemeTokenCount}
            />
          </div>

          {!comparison.hasChanges ? (
            <div className="rounded-[22px] border border-dashed border-border bg-background/60 p-4">
              <p className="text-sm text-muted-foreground">{dictionary.plan.adapterCompare.noOutputChanges}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {renderChangeList(
                dictionary.plan.adapterCompare.routeChanges,
                dictionary.plan.adapterCompare.noRouteChanges,
                comparison.routeChanges.map((change) => ({
                  key: `${change.routePath}-${change.changeType}`,
                  changeType: change.changeType,
                  title: change.routePath,
                  summary:
                    change.changeType === "changed"
                      ? `${change.beforeTitle ?? dictionary.plan.providerTrace.none} → ${change.afterTitle ?? dictionary.plan.providerTrace.none}; ${change.beforeSectionCount ?? 0} → ${change.afterSectionCount ?? 0} ${dictionary.plan.generation.shortLabels.sections}`
                      : change.changeType === "added"
                        ? `${change.afterTitle ?? change.pageKey} · ${change.afterSectionCount ?? 0} ${dictionary.plan.generation.shortLabels.sections}`
                        : `${change.beforeTitle ?? change.pageKey} · ${change.beforeSectionCount ?? 0} ${dictionary.plan.generation.shortLabels.sections}`,
                })),
                dictionary,
              )}
              {renderChangeList(
                dictionary.plan.adapterCompare.visualChanges,
                dictionary.plan.adapterCompare.noVisualChanges,
                [
                  ...comparison.pageChanges.map((change) => ({
                    key: `page-${change.pageKey}-${change.changeType}`,
                    changeType: change.changeType,
                    title: `${change.pageKey}`,
                    summary:
                      change.changeType === "changed"
                        ? `${change.beforeTitle ?? dictionary.plan.providerTrace.none} → ${change.afterTitle ?? dictionary.plan.providerTrace.none}; +${change.sectionAddedCount} / -${change.sectionRemovedCount} / ~${change.sectionChangedCount}`
                        : change.changeType === "added"
                          ? `${change.afterTitle ?? change.pageKey}`
                          : `${change.beforeTitle ?? change.pageKey}`,
                  })),
                  ...comparison.sectionChanges.slice(0, 8).map((change) => ({
                    key: `section-${change.pageKey}-${change.sectionKey}-${change.changeType}`,
                    changeType: change.changeType,
                    title: `${change.pageKey} / ${change.sectionKey}`,
                    summary:
                      change.changeType === "changed"
                        ? `${change.beforeLabel ?? dictionary.plan.providerTrace.none} → ${change.afterLabel ?? dictionary.plan.providerTrace.none}`
                        : change.changeType === "added"
                          ? change.afterLabel ?? change.sectionKey
                          : change.beforeLabel ?? change.sectionKey,
                  })),
                ],
                dictionary,
              )}
              {renderChangeList(
                dictionary.plan.adapterCompare.codeChanges,
                dictionary.plan.adapterCompare.noCodeChanges,
                comparison.codeFileChanges.map((change) => ({
                  key: `${change.path}-${change.changeType}`,
                  changeType: change.changeType,
                  title: change.path,
                  summary:
                    change.changeType === "changed"
                      ? `${change.beforeLineCount ?? 0} → ${change.afterLineCount ?? 0} ${dictionary.plan.generation.details.lines}`
                      : change.changeType === "added"
                        ? `${change.afterLineCount ?? 0} ${dictionary.plan.generation.details.lines}`
                        : `${change.beforeLineCount ?? 0} ${dictionary.plan.generation.details.lines}`,
                })),
                dictionary,
              )}
              {renderChangeList(
                dictionary.plan.adapterCompare.themeChanges,
                dictionary.plan.adapterCompare.noThemeChanges,
                comparison.themeTokenChanges.map((change) => ({
                  key: String(change.tokenKey),
                  changeType: "changed",
                  title: String(change.tokenKey),
                  summary: `${change.beforeValue ?? dictionary.plan.providerTrace.none} → ${change.afterValue ?? dictionary.plan.providerTrace.none}`,
                })),
                dictionary,
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
