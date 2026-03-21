"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import {
  externalModelProviderLabel,
  modelAdapterCapabilityLabel,
  modelAdapterExecutionModeLabel,
  modelAdapterSourceLabel,
} from "@/lib/model-adapters/labels";
import type {
  ModelAdapterCapability,
  ModelAdapterRunRecord,
  ModelAdapterRunStatus,
} from "@/lib/model-adapters/types";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

type CapabilityFilter = "all" | ModelAdapterCapability;
type StatusFilter = "all" | ModelAdapterRunStatus;
type TriggerFilter =
  | "all"
  | "provider_verification"
  | "project_create"
  | "project_rerun"
  | "plan_approved"
  | "generation_rerun"
  | "proposal_request";
type LinkedEntityFilter = "all" | "planner_run" | "generation_run" | "patch_proposal" | "unlinked";

function runStatusLabel(dictionary: Dictionary, status: ModelAdapterRunStatus) {
  return dictionary.plan.plannerRun.statuses[status];
}

function triggerLabel(dictionary: Dictionary, trigger: string) {
  const labels = dictionary.plan.modelAdapters.runHistory.triggers;

  switch (trigger) {
    case "provider_verification":
      return labels.provider_verification;
    case "project_create":
      return labels.project_create;
    case "project_rerun":
      return labels.project_rerun;
    case "plan_approved":
      return labels.plan_approved;
    case "generation_rerun":
      return labels.generation_rerun;
    case "proposal_request":
      return labels.proposal_request;
    default:
      return trigger.replaceAll("_", " ");
  }
}

function retrySummary(dictionary: Dictionary, run: ModelAdapterRunRecord) {
  const copy = dictionary.plan.modelAdapters.runHistory;

  if (!run.retryOfRunId) {
    return `${dictionary.plan.providerTrace.attemptNumber} ${run.attemptNumber} · ${dictionary.plan.providerTrace.retryOf}: ${copy.none}`;
  }

  return `${dictionary.plan.providerTrace.attemptNumber} ${run.attemptNumber} · ${dictionary.plan.providerTrace.retryOf}: ${run.retryOfRunId}`;
}

function linkedEntityLabel(dictionary: Dictionary, filter: Exclude<LinkedEntityFilter, "all">) {
  const labels = dictionary.plan.modelAdapters.runHistory.linkedEntities;

  switch (filter) {
    case "planner_run":
      return labels.planner_run;
    case "generation_run":
      return labels.generation_run;
    case "patch_proposal":
      return labels.patch_proposal;
    case "unlinked":
      return labels.unlinked;
  }
}

function buildReviewHref(input: {
  run: ModelAdapterRunRecord;
  planHrefBase?: string | null;
  codeHrefBase?: string | null;
}) {
  if (input.run.linkedEntityType === "planner_run" && input.run.linkedEntityId && input.planHrefBase) {
    const params = new URLSearchParams();
    params.set("plannerRun", input.run.linkedEntityId);
    return `${input.planHrefBase}?${params.toString()}#planner-run-${input.run.linkedEntityId}`;
  }

  if (input.run.linkedEntityType === "generation_run" && input.run.linkedEntityId && input.planHrefBase) {
    const params = new URLSearchParams();
    params.set("generationRun", input.run.linkedEntityId);
    return `${input.planHrefBase}?${params.toString()}#generation-run-${input.run.linkedEntityId}`;
  }

  if (
    input.run.linkedEntityType === "patch_proposal" &&
    input.run.linkedEntityId &&
    input.codeHrefBase &&
    typeof input.run.metadata.filePath === "string"
  ) {
    const params = new URLSearchParams();
    params.set("file", input.run.metadata.filePath);
    params.set("proposal", input.run.linkedEntityId);
    return `${input.codeHrefBase}?${params.toString()}#proposal-${input.run.linkedEntityId}`;
  }

  return null;
}

export function ModelAdapterRunHistoryCard({
  locale,
  dictionary,
  title,
  copy,
  runs,
  allowedCapabilities = ["planning", "generation", "patch_suggestion"],
  defaultCapability = "all",
  planHrefBase,
  codeHrefBase,
  testIdPrefix,
}: {
  locale: Locale;
  dictionary: Dictionary;
  title: string;
  copy: string;
  runs: ModelAdapterRunRecord[];
  allowedCapabilities?: ModelAdapterCapability[];
  defaultCapability?: CapabilityFilter;
  planHrefBase?: string | null;
  codeHrefBase?: string | null;
  testIdPrefix: string;
}) {
  const [capabilityFilter, setCapabilityFilter] = useState<CapabilityFilter>(
    defaultCapability === "all" || allowedCapabilities.includes(defaultCapability)
      ? defaultCapability
      : "all",
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [triggerFilter, setTriggerFilter] = useState<TriggerFilter>("all");
  const [linkedEntityFilter, setLinkedEntityFilter] = useState<LinkedEntityFilter>("all");

  const visibleRuns = runs.filter((run) => {
    if (!allowedCapabilities.includes(run.capability)) {
      return false;
    }

    if (capabilityFilter !== "all" && run.capability !== capabilityFilter) {
      return false;
    }

    if (statusFilter !== "all" && run.status !== statusFilter) {
      return false;
    }

    if (triggerFilter !== "all" && run.trigger !== triggerFilter) {
      return false;
    }

    if (linkedEntityFilter === "unlinked") {
      return run.linkedEntityType === null;
    }

    if (linkedEntityFilter !== "all" && run.linkedEntityType !== linkedEntityFilter) {
      return false;
    }

    return true;
  });

  const historyCopy = dictionary.plan.modelAdapters.runHistory;

  return (
    <Card className="px-5 py-5" data-testid={`${testIdPrefix}-card`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{copy}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {historyCopy.filters.capability}
            </span>
            <select
              value={capabilityFilter}
              onChange={(event) => setCapabilityFilter(event.target.value as CapabilityFilter)}
              className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-card-foreground"
              data-testid={`${testIdPrefix}-filter-capability`}
            >
              <option value="all">{historyCopy.filters.allCapabilities}</option>
              {allowedCapabilities.map((capability) => (
                <option key={capability} value={capability}>
                  {modelAdapterCapabilityLabel(dictionary, capability)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {historyCopy.filters.status}
            </span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-card-foreground"
              data-testid={`${testIdPrefix}-filter-status`}
            >
              <option value="all">{historyCopy.filters.allStatuses}</option>
              <option value="completed">{runStatusLabel(dictionary, "completed")}</option>
              <option value="failed">{runStatusLabel(dictionary, "failed")}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {historyCopy.filters.trigger}
            </span>
            <select
              value={triggerFilter}
              onChange={(event) => setTriggerFilter(event.target.value as TriggerFilter)}
              className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-card-foreground"
              data-testid={`${testIdPrefix}-filter-trigger`}
            >
              <option value="all">{historyCopy.filters.allTriggers}</option>
              <option value="provider_verification">{triggerLabel(dictionary, "provider_verification")}</option>
              <option value="project_create">{triggerLabel(dictionary, "project_create")}</option>
              <option value="project_rerun">{triggerLabel(dictionary, "project_rerun")}</option>
              <option value="plan_approved">{triggerLabel(dictionary, "plan_approved")}</option>
              <option value="generation_rerun">{triggerLabel(dictionary, "generation_rerun")}</option>
              <option value="proposal_request">{triggerLabel(dictionary, "proposal_request")}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {historyCopy.filters.linkedEntity}
            </span>
            <select
              value={linkedEntityFilter}
              onChange={(event) => setLinkedEntityFilter(event.target.value as LinkedEntityFilter)}
              className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-card-foreground"
              data-testid={`${testIdPrefix}-filter-linked-entity`}
            >
              <option value="all">{historyCopy.filters.allLinkedEntities}</option>
              <option value="planner_run">{linkedEntityLabel(dictionary, "planner_run")}</option>
              <option value="generation_run">{linkedEntityLabel(dictionary, "generation_run")}</option>
              <option value="patch_proposal">{linkedEntityLabel(dictionary, "patch_proposal")}</option>
              <option value="unlinked">{linkedEntityLabel(dictionary, "unlinked")}</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {visibleRuns.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-border bg-background/60 p-4">
            <p className="text-sm text-muted-foreground">{historyCopy.empty}</p>
          </div>
        ) : null}

        {visibleRuns.map((run) => (
          <div
            key={run.id}
            className="rounded-[24px] border border-border bg-background/70 p-4"
            data-testid={`${testIdPrefix}-item`}
          >
            {(() => {
              const reviewHref = buildReviewHref({
                run,
                planHrefBase,
                codeHrefBase,
              });

              return (
                <>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold text-card-foreground">{run.summary}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {triggerLabel(dictionary, run.trigger)} · {formatDateTimeLabel(run.completedAt ?? run.startedAt, locale)}
                </p>
                {typeof run.metadata.filePath === "string" ? (
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {run.metadata.filePath}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge>{modelAdapterCapabilityLabel(dictionary, run.capability)}</Badge>
                <Badge>{runStatusLabel(dictionary, run.status)}</Badge>
                <Badge>{modelAdapterSourceLabel(dictionary, run.sourceType)}</Badge>
                <Badge>{modelAdapterExecutionModeLabel(dictionary, run.executionMode)}</Badge>
                {run.linkedEntityType ? (
                  <Badge>{linkedEntityLabel(dictionary, run.linkedEntityType)}</Badge>
                ) : (
                  <Badge>{linkedEntityLabel(dictionary, "unlinked")}</Badge>
                )}
                {reviewHref ? (
                  <Link
                    href={reviewHref}
                    className={buttonStyles("secondary")}
                    data-testid={`${testIdPrefix}-open-review`}
                  >
                    {historyCopy.openLinkedReview}
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-[20px] border border-border bg-card/70 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {dictionary.plan.providerTrace.requestedAdapter}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">{run.requestedAdapterKey}</p>
              </div>
              <div className="rounded-[20px] border border-border bg-card/70 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {dictionary.plan.providerTrace.actualAdapter}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">{run.executedAdapterKey}</p>
              </div>
              <div className="rounded-[20px] border border-border bg-card/70 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {historyCopy.providerKey}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">
                  {run.providerKey ?? historyCopy.none}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {externalModelProviderLabel(dictionary, run.providerKey)}
                </p>
              </div>
              <div className="rounded-[20px] border border-border bg-card/70 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {historyCopy.retryAncestry}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">{retrySummary(dictionary, run)}</p>
              </div>
              <div className="rounded-[20px] border border-border bg-card/70 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {historyCopy.status}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">
                  {runStatusLabel(dictionary, run.status)}
                </p>
              </div>
              <div className="rounded-[20px] border border-border bg-card/70 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {historyCopy.trigger}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">{triggerLabel(dictionary, run.trigger)}</p>
              </div>
              <div className="rounded-[20px] border border-border bg-card/70 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {historyCopy.linkedEntity}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">
                  {run.linkedEntityType ? linkedEntityLabel(dictionary, run.linkedEntityType) : linkedEntityLabel(dictionary, "unlinked")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {run.linkedEntityId ?? historyCopy.none}
                </p>
              </div>
            </div>

            {run.errorMessage ? (
              <div className="mt-4 rounded-[20px] border border-red-300/50 bg-red-50/80 p-4 text-sm leading-7 text-red-950 dark:border-red-600/30 dark:bg-red-950/30 dark:text-red-100">
                <p className="text-xs uppercase tracking-[0.16em] text-red-800/80 dark:text-red-200/80">
                  {dictionary.plan.providerTrace.failureDetails}
                </p>
                <p className="mt-2">{run.errorMessage}</p>
              </div>
            ) : null}
                </>
              );
            })()}
          </div>
        ))}
      </div>
    </Card>
  );
}
