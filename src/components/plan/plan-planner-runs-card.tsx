"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import {
  plannerRunSummaryLabel,
  plannerSourceLabel,
  plannerStatusLabel,
  plannerTriggerLabel,
} from "@/lib/planner/labels";
import type { PlannerArtifactRecord, PlannerRunRecord } from "@/lib/planner/types";
import { initialFormState, type FormState } from "@/lib/workspaces/form-state";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

type PlannerAction = (state: FormState, formData: FormData) => Promise<FormState>;

function samePlannerContext(left: PlannerRunRecord, right: PlannerRunRecord) {
  return (
    left.briefId === right.briefId &&
    left.briefUpdatedAt === right.briefUpdatedAt &&
    JSON.stringify(left.inputSnapshot) === JSON.stringify(right.inputSnapshot)
  );
}

function buildPlannerHistoryHref(input: {
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

function RerunModeButton({
  value,
  label,
  pendingLabel,
  disabled,
  testId,
}: {
  value: "deterministic_internal" | "external_model";
  label: string;
  pendingLabel: string;
  disabled?: boolean;
  testId?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      name="requestedSelection"
      value={value}
      variant="secondary"
      disabled={disabled || pending}
      data-testid={testId}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}

function statusTone(status: PlannerRunRecord["status"]) {
  switch (status) {
    case "completed":
      return "border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "failed":
      return "border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200";
  }
}

export function PlanPlannerRunsCard({
  locale,
  dictionary,
  planHrefBase,
  runs,
  artifacts,
  latestRun,
  selectedPlannerRunId,
  selectedPlannerComparisonRunId,
  selectedGenerationRunId,
  selectedGenerationComparisonRunId,
  rerunPlannerAction,
  canRerun = true,
  readOnlyCopy,
}: {
  locale: Locale;
  dictionary: Dictionary;
  planHrefBase: string;
  runs: PlannerRunRecord[];
  artifacts: PlannerArtifactRecord[];
  latestRun: PlannerRunRecord | null;
  selectedPlannerRunId: string | null;
  selectedPlannerComparisonRunId: string | null;
  selectedGenerationRunId: string | null;
  selectedGenerationComparisonRunId: string | null;
  rerunPlannerAction: PlannerAction;
  canRerun?: boolean;
  readOnlyCopy?: string;
}) {
  const [state, formAction] = useActionState(rerunPlannerAction, initialFormState);
  const selectedRun =
    runs.find((run) => run.id === selectedPlannerRunId) ?? latestRun ?? runs[0] ?? null;
  const effectiveSelectedRunId = selectedRun?.id ?? null;
  const selectedArtifacts = selectedRun
    ? artifacts.filter((artifact) => artifact.plannerRunId === selectedRun.id)
    : [];
  const recentRuns = runs.slice(0, 4);

  return (
    <Card className="px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {dictionary.plan.plannerRun.title}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {dictionary.plan.plannerRun.copy}
          </p>
        </div>
        {latestRun ? (
          <Badge className={statusTone(latestRun.status)}>
            {plannerStatusLabel(dictionary, latestRun.status)}
          </Badge>
        ) : null}
      </div>

      {selectedRun ? (
        <div
          id={`planner-run-${selectedRun.id}`}
          className="mt-4 rounded-[24px] border border-border bg-background/70 p-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <Badge>{plannerSourceLabel(dictionary, selectedRun.source)}</Badge>
            <Badge>{plannerTriggerLabel(dictionary, selectedRun.trigger)}</Badge>
            <Badge className={statusTone(selectedRun.status)}>
              {plannerStatusLabel(dictionary, selectedRun.status)}
            </Badge>
          </div>
          <p className="mt-3 text-sm font-semibold text-card-foreground">
            {plannerRunSummaryLabel(dictionary, selectedRun)}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{selectedRun.summary}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[20px] border border-border bg-card/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.plannerRun.startedAt}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">
                {formatDateTimeLabel(selectedRun.startedAt, locale)}
              </p>
            </div>
            <div className="rounded-[20px] border border-border bg-card/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.plannerRun.artifactCount}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">
                {selectedArtifacts.length}
              </p>
            </div>
            <div className="rounded-[20px] border border-border bg-card/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.plannerRun.generatedRevision}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">
                {selectedRun.generatedPlanRevisionNumber
                  ? `${dictionary.plan.revisionPrefix} ${selectedRun.generatedPlanRevisionNumber}`
                  : dictionary.plan.plannerRun.none}
              </p>
            </div>
            <div className="rounded-[20px] border border-border bg-card/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.plannerRun.briefUpdatedAt}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">
                {selectedRun.briefUpdatedAt
                  ? formatDateTimeLabel(selectedRun.briefUpdatedAt, locale)
                  : dictionary.plan.plannerRun.none}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.plannerRun.latestArtifacts}
            </p>
            {selectedArtifacts.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedArtifacts.map((artifact) => (
                  <Badge key={artifact.id}>{artifact.label}</Badge>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {dictionary.plan.plannerRun.noArtifacts}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-[24px] border border-dashed border-border bg-background/70 p-4">
          <p className="text-sm text-muted-foreground">{dictionary.plan.plannerRun.empty}</p>
        </div>
      )}

      <form action={formAction} className="mt-4 space-y-4">
        {state.status === "error" ? (
          <p className="rounded-2xl border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {state.message}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <RerunModeButton
            value="deterministic_internal"
            label={dictionary.plan.plannerRun.rerunDeterministic}
            pendingLabel={dictionary.plan.plannerRun.rerunning}
            disabled={!canRerun}
            testId="planner-rerun-submit"
          />
          <RerunModeButton
            value="external_model"
            label={dictionary.plan.plannerRun.rerunExternal}
            pendingLabel={dictionary.plan.plannerRun.rerunning}
            disabled={!canRerun}
            testId="planner-rerun-external"
          />
        </div>
        {!canRerun && readOnlyCopy ? (
          <p className="text-sm text-muted-foreground">{readOnlyCopy}</p>
        ) : null}
      </form>

      {recentRuns.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.plannerRun.runHistory}
          </p>
          <div className="mt-3 space-y-3">
            {recentRuns.map((run) => {
              const isSelected = selectedRun?.id === run.id;
              const isCompared = selectedPlannerComparisonRunId === run.id;
              const canCompare =
                effectiveSelectedRunId !== null &&
                effectiveSelectedRunId !== run.id &&
                selectedRun !== null &&
                samePlannerContext(selectedRun, run);
              const reviewHref = buildPlannerHistoryHref({
                planHrefBase,
                plannerRunId: run.id,
                generationRunId: selectedGenerationRunId,
                generationCompareId: selectedGenerationComparisonRunId,
                anchor: `planner-run-${run.id}`,
              });
              const compareHref = canCompare
                ? buildPlannerHistoryHref({
                    planHrefBase,
                    plannerRunId: effectiveSelectedRunId,
                    plannerCompareId: run.id,
                    generationRunId: selectedGenerationRunId,
                    generationCompareId: selectedGenerationComparisonRunId,
                    anchor: "planner-compare",
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
                        {plannerTriggerLabel(dictionary, run.trigger)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDateTimeLabel(run.startedAt, locale)}
                      </p>
                    </div>
                    <Badge className={statusTone(run.status)}>
                      {plannerStatusLabel(dictionary, run.status)}
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
                        data-testid="planner-run-compare"
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
