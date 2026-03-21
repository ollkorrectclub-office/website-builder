"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { PlannerRunDelta } from "@/lib/planner/deltas";
import {
  externalModelProviderLabel,
  modelAdapterExecutionModeLabel,
  modelAdapterSelectionLabel,
  modelAdapterSourceLabel,
} from "@/lib/model-adapters/labels";
import type { ModelAdapterRunRecord } from "@/lib/model-adapters/types";
import type { PlannerRunRecord } from "@/lib/planner/types";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

function buildPlannerCompareHref(input: {
  planHrefBase: string;
  plannerRunId: string | null;
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
  run: PlannerRunRecord;
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
            {dictionary.plan.adapterCompare.generatedRevision}
          </p>
          <p className="mt-2 text-sm font-semibold text-card-foreground">
            {run.generatedPlanRevisionNumber
              ? `${dictionary.plan.revisionPrefix} ${run.generatedPlanRevisionNumber}`
              : dictionary.plan.providerTrace.none}
          </p>
        </div>
        <div className="rounded-[18px] border border-border bg-card/70 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.plannerRun.briefUpdatedAt}
          </p>
          <p className="mt-2 text-sm font-semibold text-card-foreground">
            {run.briefUpdatedAt
              ? formatDateTimeLabel(run.briefUpdatedAt, locale)
              : dictionary.plan.providerTrace.none}
          </p>
        </div>
      </div>

      {adapterRun?.fallbackReason ? (
        <div className="mt-4 rounded-[18px] border border-amber-300/50 bg-amber-50/80 p-3 text-sm text-amber-950 dark:border-amber-600/30 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="text-xs uppercase tracking-[0.16em] text-amber-800/80 dark:text-amber-200/80">
            {dictionary.plan.providerTrace.fallbackReason}
          </p>
          <p className="mt-2">{adapterRun.fallbackReason}</p>
        </div>
      ) : null}
    </div>
  );
}

export function PlanPlannerCompareCard({
  locale,
  dictionary,
  planHrefBase,
  selectedRun,
  selectedAdapterRun,
  comparisonRun,
  comparisonAdapterRun,
  selectedComparisonRunId,
  selectedGenerationRunId,
  selectedGenerationComparisonRunId,
  delta,
}: {
  locale: Locale;
  dictionary: Dictionary;
  planHrefBase: string;
  selectedRun: PlannerRunRecord | null;
  selectedAdapterRun: ModelAdapterRunRecord | null;
  comparisonRun: PlannerRunRecord | null;
  comparisonAdapterRun: ModelAdapterRunRecord | null;
  selectedComparisonRunId: string | null;
  selectedGenerationRunId: string | null;
  selectedGenerationComparisonRunId: string | null;
  delta: PlannerRunDelta;
}) {
  const clearHref = selectedRun
    ? buildPlannerCompareHref({
        planHrefBase,
        plannerRunId: selectedRun.id,
        generationRunId: selectedGenerationRunId,
        generationCompareId: selectedGenerationComparisonRunId,
        anchor: `planner-run-${selectedRun.id}`,
      })
    : null;
  const reviewLeftHref = selectedRun
    ? buildPlannerCompareHref({
        planHrefBase,
        plannerRunId: selectedRun.id,
        generationRunId: selectedGenerationRunId,
        generationCompareId: selectedGenerationComparisonRunId,
        anchor: `planner-run-${selectedRun.id}`,
      })
    : null;
  const reviewRightHref = comparisonRun
    ? buildPlannerCompareHref({
        planHrefBase,
        plannerRunId: comparisonRun.id,
        generationRunId: selectedGenerationRunId,
        generationCompareId: selectedGenerationComparisonRunId,
        anchor: `planner-run-${comparisonRun.id}`,
      })
    : null;

  return (
    <Card id="planner-compare" className="px-5 py-5" data-testid="planner-compare-card">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {dictionary.plan.adapterCompare.planningTitle}
      </p>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        {dictionary.plan.adapterCompare.planningCopy}
      </p>

      {selectedRun ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {reviewLeftHref ? (
            <Link
              href={reviewLeftHref}
              className={buttonStyles("secondary")}
              data-testid="planner-compare-review-left"
            >
              {dictionary.plan.adapterCompare.reviewLeft}
            </Link>
          ) : null}
          {reviewRightHref ? (
            <Link
              href={reviewRightHref}
              className={buttonStyles("secondary")}
              data-testid="planner-compare-review-right"
            >
              {dictionary.plan.adapterCompare.reviewRight}
            </Link>
          ) : null}
          {selectedComparisonRunId && clearHref ? (
            <Link href={clearHref} className={buttonStyles("secondary")} data-testid="planner-compare-clear">
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

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[20px] border border-border bg-background/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.adapterCompare.briefChanges}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">
                {delta.briefFieldChanges.length + delta.briefListChanges.length}
              </p>
            </div>
            <div className="rounded-[20px] border border-border bg-background/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.adapterCompare.planChanges}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">
                {delta.planFieldChanges.length + delta.planListChanges.length}
              </p>
            </div>
            <div className="rounded-[20px] border border-border bg-background/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.adapterCompare.signalChanges}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">
                {delta.signalChanges.length}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
