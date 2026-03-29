"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  deployAdapterKeyLabel,
  deployExecutionRunStatusLabel,
  deployExecutionSourceLabel,
} from "@/lib/deploy/labels";
import { evaluateDeployReleaseExecutionReadiness } from "@/lib/deploy/readiness";
import type {
  DeployExecutionLogRecord,
  DeployExecutionRunRecord,
  DeployReleaseRecord,
  HostedDeploymentRecord,
  ProjectDeployBundle,
} from "@/lib/deploy/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { initialFormState } from "@/lib/workspaces/form-state";
import type { FormState } from "@/lib/workspaces/form-state";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

type DeployAction = (state: FormState, formData: FormData) => Promise<FormState>;
type ExecutionStatusFilter = "all" | DeployExecutionRunRecord["status"];

function ActionButton({
  label,
  pendingLabel,
  disabled,
  testId,
  onClick,
}: {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
  testId?: string;
  onClick?: () => void;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={disabled || pending} data-testid={testId} onClick={onClick}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function statusTone(status: "pass" | "warning" | "blocking") {
  switch (status) {
    case "pass":
      return "border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "warning":
      return "border-amber-300/50 bg-amber-100/70 text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-200";
    case "blocking":
      return "border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200";
  }
}

function executionTone(status: "blocked" | "submitted" | "ready" | "failed") {
  switch (status) {
    case "blocked":
      return "border-amber-300/50 bg-amber-100/70 text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-200";
    case "submitted":
      return "border-sky-300/50 bg-sky-100/70 text-sky-900 dark:border-sky-600/40 dark:bg-sky-950/40 dark:text-sky-200";
    case "ready":
      return "border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "failed":
      return "border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200";
  }
}

function executionStatusFilterOptions(): ExecutionStatusFilter[] {
  return ["all", "submitted", "ready", "failed", "blocked"];
}

function executionProblemCount(runs: DeployExecutionRunRecord[]) {
  return runs.filter((run) => run.status === "failed" || run.status === "blocked").length;
}

export function DeployReleaseExecutionCard({
  locale,
  dictionary,
  workspaceSlug,
  projectSlug,
  bundle,
  selectedRelease,
  selectedExecutionRunId,
  executeDeployReleaseAction,
  recheckDeployExecutionRunAction,
  retryDeployExecutionRunAction,
}: {
  locale: Locale;
  dictionary: Dictionary;
  workspaceSlug: string;
  projectSlug: string;
  bundle: ProjectDeployBundle;
  selectedRelease: DeployReleaseRecord | null;
  selectedExecutionRunId: string | null;
  executeDeployReleaseAction: DeployAction;
  recheckDeployExecutionRunAction: DeployAction;
  retryDeployExecutionRunAction: DeployAction;
}) {
  const [state, formAction] = useActionState(executeDeployReleaseAction, initialFormState);
  const [recheckState, recheckFormAction] = useActionState(
    recheckDeployExecutionRunAction,
    initialFormState,
  );
  const [retryState, retryFormAction] = useActionState(
    retryDeployExecutionRunAction,
    initialFormState,
  );
  const [historyStatusFilter, setHistoryStatusFilter] = useState<ExecutionStatusFilter>("all");
  const [pendingExecutionRedirect, setPendingExecutionRedirect] = useState<{
    previousLatestExecutionRunId: string | null;
    releaseId: string;
  } | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canPublish = bundle.projectPermissions.canPublishDeploy;
  const releaseRun = selectedRelease
    ? bundle.runs.find((run) => run.id === selectedRelease.deployRunId) ?? null
    : null;
  const releaseArtifacts = releaseRun
    ? bundle.artifacts.filter((artifact) => artifact.deployRunId === releaseRun.id)
    : [];
  const readiness = selectedRelease
    ? evaluateDeployReleaseExecutionReadiness({
        target: bundle.target,
        release: selectedRelease,
        run: releaseRun,
        artifacts: releaseArtifacts,
      })
    : null;
  const releaseExecutionRuns = selectedRelease
    ? bundle.executionRuns.filter((run) => run.releaseId === selectedRelease.id)
    : [];
  const visibleExecutionRuns = releaseExecutionRuns.filter((run) =>
    historyStatusFilter === "all" ? true : run.status === historyStatusFilter,
  );
  const selectedExecutionRun =
    releaseExecutionRuns.find((run) => run.id === selectedExecutionRunId) ??
    releaseExecutionRuns[0] ??
    null;
  const canRecheck = canPublish && selectedExecutionRun?.status === "submitted";
  const canRetry =
    canPublish &&
    (selectedExecutionRun?.status === "submitted" || selectedExecutionRun?.status === "failed");
  const retrySourceRun =
    selectedExecutionRun?.retryOfExecutionRunId
      ? releaseExecutionRuns.find((run) => run.id === selectedExecutionRun.retryOfExecutionRunId) ?? null
      : null;
  const releaseHostedDeployment = selectedRelease?.hostedDeployment ?? null;
  const targetHostedDeployment = bundle.target.hostedDeployment;
  const latestReadyRun = releaseExecutionRuns.find((run) => run.status === "ready") ?? null;
  const recheckDisabledCopy = !canPublish
    ? dictionary.builder.deploy.permissionCopy
    : !selectedExecutionRun
      ? dictionary.builder.deploy.executionResultEmpty
      : selectedExecutionRun.status !== "submitted"
        ? dictionary.builder.deploy.executionRecheckDisabled
        : null;
  const retryDisabledCopy = !canPublish
    ? dictionary.builder.deploy.permissionCopy
    : !selectedExecutionRun
      ? dictionary.builder.deploy.executionResultEmpty
      : selectedExecutionRun.status !== "submitted" && selectedExecutionRun.status !== "failed"
        ? dictionary.builder.deploy.executionRetryDisabled
        : null;

  useEffect(() => {
    if (!pendingExecutionRedirect) {
      return;
    }

    if (state.status === "error") {
      setPendingExecutionRedirect(null);
      return;
    }

    const currentSearchParams = new URLSearchParams(searchParams?.toString() ?? "");
    const currentExecutionRunId = currentSearchParams.get("executionRun");

    if (currentExecutionRunId) {
      setPendingExecutionRedirect(null);
      return;
    }

    const latestExecutionRun =
      bundle.executionRuns.find((run) => run.releaseId === pendingExecutionRedirect.releaseId) ?? null;

    if (!latestExecutionRun || latestExecutionRun.releaseId !== pendingExecutionRedirect.releaseId) {
      return;
    }

    if (latestExecutionRun.id === pendingExecutionRedirect.previousLatestExecutionRunId) {
      return;
    }

    const nextParams = new URLSearchParams(currentSearchParams.toString());
    nextParams.set("deployRun", latestExecutionRun.deployRunId);
    nextParams.set("release", latestExecutionRun.releaseId);
    nextParams.set("executionRun", latestExecutionRun.id);
    router.replace(`${pathname}?${nextParams.toString()}#execution-run-${latestExecutionRun.id}`, {
      scroll: false,
    });
    setPendingExecutionRedirect(null);
  }, [bundle.executionRuns, pathname, pendingExecutionRedirect, router, searchParams, state.status]);

  return (
    <Card className="px-5 py-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {dictionary.builder.deploy.executionTitle}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {dictionary.builder.deploy.executionCopy}
        </p>
      </div>

      {!selectedRelease ? (
        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          {dictionary.builder.deploy.executionNoRelease}
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={dictionary.builder.deploy.adapterKey}
              value={bundle.target.settings.adapterKey}
            />
            <MetricCard
              label={dictionary.builder.deploy.readinessStatus}
              value={
                readiness?.isReady
                  ? dictionary.builder.deploy.readinessReady
                  : dictionary.builder.deploy.readinessBlocked
              }
            />
            <MetricCard
              label={dictionary.builder.deploy.blockerCount}
              value={String(readiness?.blockingCount ?? 0)}
            />
            <MetricCard
              label={dictionary.builder.deploy.warningCount}
              value={String(readiness?.warningCount ?? 0)}
            />
          </div>

          {readiness ? (
            <div className="rounded-[22px] border border-border bg-background/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-card-foreground">
                    {dictionary.builder.deploy.executionReadinessTitle}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {dictionary.builder.deploy.executionReadinessCopy}
                  </p>
                </div>
                <Badge
                  className={statusTone(
                    readiness.isReady ? "pass" : readiness.blockingCount > 0 ? "blocking" : "warning",
                  )}
                >
                  {readiness.isReady
                    ? dictionary.builder.deploy.readinessReady
                    : dictionary.builder.deploy.readinessBlocked}
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                {readiness.checks.map((check) => (
                  <div
                    key={check.id}
                    className="rounded-[18px] border border-border bg-card/70 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-card-foreground">{check.title}</p>
                      <Badge className={statusTone(check.severity)}>
                        {dictionary.builder.deploy.readinessSeverity[check.severity]}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{check.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <form action={formAction} className="rounded-[22px] border border-border bg-background/70 p-4">
            <input type="hidden" name="releaseId" value={selectedRelease.id} />
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm font-semibold text-card-foreground">
                  {dictionary.builder.deploy.runExecutionTitle}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {dictionary.builder.deploy.runExecutionCopy}
                </p>
              </div>
              <ActionButton
                label={dictionary.builder.deploy.runExecution}
                pendingLabel={dictionary.builder.deploy.runningExecution}
                disabled={!canPublish}
                testId="deploy-run-execution"
                onClick={() =>
                  setPendingExecutionRedirect({
                    previousLatestExecutionRunId: releaseExecutionRuns[0]?.id ?? null,
                    releaseId: selectedRelease.id,
                  })
                }
              />
            </div>
            {state.message ? (
              <p
                className={`mt-3 text-sm ${
                  state.status === "error"
                    ? "text-red-600 dark:text-red-300"
                    : "text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {state.message}
              </p>
            ) : null}
          </form>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="min-w-0 rounded-[22px] border border-border bg-background/70 p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-sm font-semibold text-card-foreground">
                    {dictionary.builder.deploy.executionHistoryTitle}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {dictionary.builder.deploy.executionHistoryCopy}
                  </p>
                </div>
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {dictionary.builder.deploy.executionHistoryFilterStatus}
                  </span>
                  <select
                    value={historyStatusFilter}
                    onChange={(event) => setHistoryStatusFilter(event.target.value as ExecutionStatusFilter)}
                    className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-card-foreground"
                    data-testid="deploy-execution-history-filter-status"
                  >
                    {executionStatusFilterOptions().map((status) => (
                      <option key={status} value={status}>
                        {status === "all"
                          ? dictionary.builder.deploy.executionHistoryFilterAllStatuses
                          : deployExecutionRunStatusLabel(dictionary, status)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label={dictionary.builder.deploy.executionHistoryLatestRun}
                  value={
                    releaseExecutionRuns[0]
                      ? formatDateTimeLabel(releaseExecutionRuns[0].startedAt, locale)
                      : dictionary.builder.deploy.notAvailable
                  }
                />
                <MetricCard
                  label={dictionary.builder.deploy.executionHistoryReadyCount}
                  value={String(releaseExecutionRuns.filter((run) => run.status === "ready").length)}
                />
                <MetricCard
                  label={dictionary.builder.deploy.executionHistoryPendingCount}
                  value={String(releaseExecutionRuns.filter((run) => run.status === "submitted").length)}
                />
                <MetricCard
                  label={dictionary.builder.deploy.executionHistoryProblemCount}
                  value={String(executionProblemCount(releaseExecutionRuns))}
                />
              </div>

              <div className="mt-4 space-y-3">
                {visibleExecutionRuns.length > 0 ? (
                  visibleExecutionRuns.map((run) => {
                    const active = selectedExecutionRun?.id === run.id;
                    const href = `/${locale}/app/workspaces/${workspaceSlug}/projects/${projectSlug}/deploy?deployRun=${encodeURIComponent(run.deployRunId)}&release=${encodeURIComponent(run.releaseId)}&executionRun=${encodeURIComponent(run.id)}#execution-run-${run.id}`;

                    return (
                      <Link
                        key={run.id}
                        href={href}
                        className={`block rounded-[18px] border px-4 py-4 transition ${
                          active
                            ? "border-primary/40 bg-primary/10"
                            : "border-border bg-card/70 hover:border-primary/30 hover:bg-card/90"
                        }`}
                        data-testid="deploy-execution-history-item"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-card-foreground">
                            {formatDateTimeLabel(run.startedAt, locale)}
                          </p>
                          <Badge className={executionTone(run.status)}>
                            {deployExecutionRunStatusLabel(dictionary, run.status)}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{run.summary}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge>{`${dictionary.builder.deploy.executionAttemptNumber} ${run.attemptNumber}`}</Badge>
                          <Badge>{deployAdapterKeyLabel(dictionary, run.requestedAdapterKey)}</Badge>
                          <Badge>{deployExecutionSourceLabel(dictionary, run.actualAdapterKey)}</Badge>
                          <Badge>{run.latestProviderStatus ?? dictionary.builder.deploy.notAvailable}</Badge>
                        </div>
                        {run.hostedUrl ? (
                          <p className="mt-2 text-xs text-muted-foreground">{run.hostedUrl}</p>
                        ) : null}
                      </Link>
                    );
                  })
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    {dictionary.builder.deploy.executionHistoryEmpty}
                  </p>
                )}
              </div>
            </div>

            <div
              className="min-w-0 rounded-[22px] border border-border bg-background/70 p-4"
              id={selectedExecutionRun ? `execution-run-${selectedExecutionRun.id}` : undefined}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-card-foreground">
                    {dictionary.builder.deploy.executionResultTitle}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {selectedExecutionRun
                      ? selectedExecutionRun.summary
                      : dictionary.builder.deploy.executionResultEmpty}
                  </p>
                </div>
                {selectedExecutionRun ? (
                  <div className="flex flex-wrap gap-2">
                    <Badge className={executionTone(selectedExecutionRun.status)}>
                      {deployExecutionRunStatusLabel(dictionary, selectedExecutionRun.status)}
                    </Badge>
                    {latestReadyRun?.id === selectedExecutionRun.id ? (
                      <Badge>{dictionary.builder.deploy.executionLatestReady}</Badge>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {selectedExecutionRun ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <MetricCard
                      label={dictionary.builder.deploy.executionRequestedAdapter}
                      value={deployAdapterKeyLabel(dictionary, selectedExecutionRun.requestedAdapterKey)}
                    />
                    <MetricCard
                      label={dictionary.builder.deploy.executionSource}
                      value={deployExecutionSourceLabel(dictionary, selectedExecutionRun.actualAdapterKey)}
                    />
                    <MetricCard
                      label={dictionary.builder.deploy.providerLabel}
                      value={selectedExecutionRun.providerLabel ?? dictionary.builder.deploy.notAvailable}
                    />
                    <MetricCard
                      label={dictionary.builder.deploy.providerDeploymentId}
                      value={selectedExecutionRun.providerDeploymentId ?? dictionary.builder.deploy.notAvailable}
                    />
                    <MetricCard
                      label={dictionary.builder.deploy.executionRequestId}
                      value={
                        selectedExecutionRun.providerResponse?.requestId ?? dictionary.builder.deploy.notAvailable
                      }
                    />
                    <MetricCard
                      label={dictionary.builder.deploy.executionHttpStatus}
                      value={
                        selectedExecutionRun.providerResponse?.httpStatus
                          ? String(selectedExecutionRun.providerResponse.httpStatus)
                          : dictionary.builder.deploy.notAvailable
                      }
                    />
                    <MetricCard
                      label={dictionary.builder.deploy.executionStartedAt}
                      value={formatDateTimeLabel(selectedExecutionRun.startedAt, locale)}
                    />
                    <MetricCard
                      label={dictionary.builder.deploy.executionCompletedAt}
                      value={
                        selectedExecutionRun.completedAt
                          ? formatDateTimeLabel(selectedExecutionRun.completedAt, locale)
                          : dictionary.builder.deploy.notAvailable
                      }
                    />
                    <MetricCard
                      label={dictionary.builder.deploy.executionLastCheckedAt}
                      value={
                        selectedExecutionRun.lastCheckedAt
                          ? formatDateTimeLabel(selectedExecutionRun.lastCheckedAt, locale)
                          : dictionary.builder.deploy.notAvailable
                      }
                    />
                    <MetricCard
                      label={dictionary.builder.deploy.executionProviderStatus}
                      value={selectedExecutionRun.latestProviderStatus ?? dictionary.builder.deploy.notAvailable}
                    />
                    <MetricCard
                      label={dictionary.builder.deploy.executionAttemptNumber}
                      value={String(selectedExecutionRun.attemptNumber)}
                    />
                    <MetricCard
                      label={dictionary.builder.deploy.environmentKey}
                      value={selectedExecutionRun.environmentKey}
                    />
                    <MetricCard
                      label={dictionary.builder.deploy.primaryDomain}
                      value={selectedExecutionRun.primaryDomain}
                    />
                    <MetricCard
                      label={dictionary.builder.deploy.linkedRelease}
                      value={selectedRelease.name}
                    />
                    <MetricCard
                      label={dictionary.builder.deploy.linkedDeployRun}
                      value={selectedExecutionRun.deployRunId}
                    />
                  </div>

                  {retrySourceRun ? (
                    <div className="rounded-[18px] border border-border bg-card/70 p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        {dictionary.builder.deploy.executionRetryOf}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-card-foreground">
                        {formatDateTimeLabel(retrySourceRun.startedAt, locale)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{retrySourceRun.id}</p>
                    </div>
                  ) : null}

                  {(selectedExecutionRun.hostedUrl ||
                    selectedExecutionRun.hostedInspectionUrl ||
                    releaseHostedDeployment ||
                    targetHostedDeployment) ? (
                    <div className="grid gap-4 xl:grid-cols-3">
                      <HostedDeploymentCard
                        dictionary={dictionary}
                        locale={locale}
                        title={dictionary.builder.deploy.hostedMetadataTitle}
                        testIdPrefix="deploy-execution"
                        metadata={
                          selectedExecutionRun.hostedUrl || selectedExecutionRun.hostedInspectionUrl
                            ? {
                                providerKey: selectedExecutionRun.providerKey ?? "vercel",
                                providerLabel:
                                  selectedExecutionRun.providerLabel ?? dictionary.builder.deploy.notAvailable,
                                requestedAdapterPresetKey: bundle.target.settings.adapterPresetKey,
                                actualAdapterKey: selectedExecutionRun.actualAdapterKey,
                                deployRunId: selectedExecutionRun.deployRunId,
                                releaseId: selectedExecutionRun.releaseId,
                                executionRunId: selectedExecutionRun.id,
                                providerDeploymentId: selectedExecutionRun.providerDeploymentId,
                                hostedUrl: selectedExecutionRun.hostedUrl,
                                hostedInspectionUrl: selectedExecutionRun.hostedInspectionUrl,
                                primaryDomain: selectedExecutionRun.primaryDomain,
                                environmentKey: selectedExecutionRun.environmentKey,
                                providerStatus: selectedExecutionRun.latestProviderStatus,
                                readyAt: selectedExecutionRun.completedAt ?? selectedExecutionRun.startedAt,
                                updatedAt: selectedExecutionRun.lastCheckedAt ?? selectedExecutionRun.updatedAt,
                              }
                            : null
                        }
                      />
                      <HostedDeploymentCard
                        dictionary={dictionary}
                        locale={locale}
                        title={dictionary.builder.deploy.releaseHostedMetadataTitle}
                        testIdPrefix="deploy-release"
                        metadata={releaseHostedDeployment}
                      />
                      <HostedDeploymentCard
                        dictionary={dictionary}
                        locale={locale}
                        title={dictionary.builder.deploy.targetHostedMetadataTitle}
                        testIdPrefix="deploy-target"
                        metadata={targetHostedDeployment}
                      />
                    </div>
                  ) : null}

                  {selectedExecutionRun.errorMessage ? (
                    <div className="rounded-[18px] border border-red-300/40 bg-red-100/60 p-3 text-red-950 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-100">
                      <p className="text-sm font-semibold">{dictionary.builder.deploy.executionErrorTitle}</p>
                      <p className="mt-2 text-sm leading-6">{selectedExecutionRun.errorMessage}</p>
                    </div>
                  ) : null}

                  <div className="grid gap-3 xl:grid-cols-2">
                    <form action={recheckFormAction} className="rounded-[18px] border border-border bg-card/70 p-3">
                      <input type="hidden" name="executionRunId" value={selectedExecutionRun.id} />
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-card-foreground">
                          {dictionary.builder.deploy.executionRecheckTitle}
                        </p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {dictionary.builder.deploy.executionRecheckCopy}
                        </p>
                      </div>
                      <div className="mt-3">
                        <ActionButton
                          label={dictionary.builder.deploy.executionRecheck}
                          pendingLabel={dictionary.builder.deploy.executionRechecking}
                          disabled={!canRecheck}
                          testId="deploy-recheck-execution"
                        />
                      </div>
                      {!canRecheck && recheckDisabledCopy ? (
                        <p className="mt-3 text-sm text-muted-foreground">{recheckDisabledCopy}</p>
                      ) : null}
                      {recheckState.message ? (
                        <p
                          className={`mt-3 text-sm ${
                            recheckState.status === "error"
                              ? "text-red-600 dark:text-red-300"
                              : "text-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          {recheckState.message}
                        </p>
                      ) : null}
                    </form>

                    <form action={retryFormAction} className="rounded-[18px] border border-border bg-card/70 p-3">
                      <input type="hidden" name="executionRunId" value={selectedExecutionRun.id} />
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-card-foreground">
                          {dictionary.builder.deploy.executionRetryTitle}
                        </p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {dictionary.builder.deploy.executionRetryCopy}
                        </p>
                      </div>
                      <div className="mt-3">
                        <ActionButton
                          label={dictionary.builder.deploy.executionRetry}
                          pendingLabel={dictionary.builder.deploy.executionRetrying}
                          disabled={!canRetry}
                          testId="deploy-retry-execution"
                        />
                      </div>
                      {!canRetry && retryDisabledCopy ? (
                        <p className="mt-3 text-sm text-muted-foreground">{retryDisabledCopy}</p>
                      ) : null}
                      {retryState.message ? (
                        <p
                          className={`mt-3 text-sm ${
                            retryState.status === "error"
                              ? "text-red-600 dark:text-red-300"
                              : "text-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          {retryState.message}
                        </p>
                      ) : null}
                    </form>
                  </div>

                  <div className="rounded-[18px] border border-border bg-card/70 p-3">
                    <p className="text-sm font-semibold text-card-foreground">
                      {dictionary.builder.deploy.executionTransitionsTitle}
                    </p>
                    <div className="mt-3 space-y-3">
                      {selectedExecutionRun.statusTransitions.length > 0 ? (
                        selectedExecutionRun.statusTransitions.map((transition) => (
                          <div key={transition.id} className="rounded-[16px] border border-border bg-background/70 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-card-foreground">
                                {formatDateTimeLabel(transition.createdAt, locale)}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {transition.fromStatus ? (
                                  <Badge>{deployExecutionRunStatusLabel(dictionary, transition.fromStatus)}</Badge>
                                ) : null}
                                <Badge className={executionTone(transition.toStatus)}>
                                  {deployExecutionRunStatusLabel(dictionary, transition.toStatus)}
                                </Badge>
                              </div>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              {transition.summary}
                            </p>
                            <div className="mt-2 grid gap-3 md:grid-cols-2">
                              <MetricCard
                                label={dictionary.builder.deploy.executionTransitionFrom}
                                value={
                                  transition.fromProviderStatus ?? dictionary.builder.deploy.notAvailable
                                }
                              />
                              <MetricCard
                                label={dictionary.builder.deploy.executionTransitionTo}
                                value={transition.toProviderStatus ?? dictionary.builder.deploy.notAvailable}
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm leading-6 text-muted-foreground">
                          {dictionary.builder.deploy.executionTransitionsEmpty}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[18px] border border-border bg-card/70 p-3">
                    <p className="text-sm font-semibold text-card-foreground">
                      {dictionary.builder.deploy.executionLogsTitle}
                    </p>
                    <div className="mt-3 space-y-3">
                      {selectedExecutionRun.logs.length > 0 ? (
                        selectedExecutionRun.logs.map((log) => (
                          <ExecutionLogCard key={log.id} log={log} locale={locale} />
                        ))
                      ) : (
                        <p className="text-sm leading-6 text-muted-foreground">
                          {dictionary.builder.deploy.executionLogsEmpty}
                        </p>
                      )}
                    </div>
                  </div>

                  {selectedExecutionRun.providerResponse ? (
                    <div className="rounded-[18px] border border-border bg-card/70 p-3">
                      <p className="text-sm font-semibold text-card-foreground">
                        {dictionary.builder.deploy.providerResponseTitle}
                      </p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <MetricCard
                          label={dictionary.builder.deploy.executionRequestId}
                          value={
                            selectedExecutionRun.providerResponse.requestId ??
                            dictionary.builder.deploy.notAvailable
                          }
                        />
                        <MetricCard
                          label={dictionary.builder.deploy.executionHttpStatus}
                          value={
                            selectedExecutionRun.providerResponse.httpStatus
                              ? String(selectedExecutionRun.providerResponse.httpStatus)
                              : dictionary.builder.deploy.notAvailable
                          }
                        />
                        <MetricCard
                          label={dictionary.builder.deploy.hostedUrl}
                          value={
                            selectedExecutionRun.providerResponse.deploymentUrl ??
                            dictionary.builder.deploy.notAvailable
                          }
                        />
                        <MetricCard
                          label={dictionary.builder.deploy.inspectorUrl}
                          value={
                            selectedExecutionRun.providerResponse.deploymentInspectorUrl ??
                            dictionary.builder.deploy.notAvailable
                          }
                        />
                      </div>
                      <pre className="mt-3 overflow-x-auto rounded-[16px] bg-slate-950/95 p-3 text-xs leading-6 text-slate-100">
                        {JSON.stringify(selectedExecutionRun.providerResponse, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[18px] border border-border bg-card/70 p-3">
      <p className="break-words text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 break-all text-sm font-semibold text-card-foreground">{value}</p>
    </div>
  );
}

function HostedDeploymentCard({
  dictionary,
  locale,
  title,
  testIdPrefix,
  metadata,
}: {
  dictionary: Dictionary;
  locale: Locale;
  title: string;
  testIdPrefix: string;
  metadata: HostedDeploymentRecord | null;
}) {
  if (!metadata) {
    return null;
  }

  return (
    <div className="min-w-0 rounded-[18px] border border-border bg-card/70 p-3">
      <p className="text-sm font-semibold text-card-foreground">{title}</p>
      <div className="mt-3 space-y-3">
        <MetricCard label={dictionary.builder.deploy.providerLabel} value={metadata.providerLabel} />
        <MetricCard
          label={dictionary.builder.deploy.providerDeploymentId}
          value={metadata.providerDeploymentId ?? dictionary.builder.deploy.notAvailable}
        />
        <MetricCard label={dictionary.builder.deploy.linkedRelease} value={metadata.releaseId} />
        <MetricCard label={dictionary.builder.deploy.linkedExecutionRun} value={metadata.executionRunId} />
        <MetricCard label={dictionary.builder.deploy.primaryDomain} value={metadata.primaryDomain} />
        <MetricCard label={dictionary.builder.deploy.environmentKey} value={metadata.environmentKey} />
        <MetricCard
          label={dictionary.builder.deploy.executionProviderStatus}
          value={metadata.providerStatus ?? dictionary.builder.deploy.notAvailable}
        />
        <MetricCard
          label={dictionary.builder.deploy.executionReadyAt}
          value={formatDateTimeLabel(metadata.readyAt, locale)}
        />
        <MetricCard
          label={dictionary.builder.deploy.hostedMetadataUpdatedAt}
          value={formatDateTimeLabel(metadata.updatedAt, locale)}
        />
        {metadata.hostedUrl ? (
          <div className="rounded-[18px] border border-border bg-background/70 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {dictionary.builder.deploy.hostedUrl}
            </p>
            <a
              href={metadata.hostedUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
              data-testid={`${testIdPrefix}-hosted-link`}
            >
              {dictionary.builder.deploy.openHostedDeployment}
            </a>
            <p className="mt-2 break-all text-xs text-muted-foreground">{metadata.hostedUrl}</p>
          </div>
        ) : null}
        {metadata.hostedInspectionUrl ? (
          <div className="rounded-[18px] border border-border bg-background/70 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {dictionary.builder.deploy.inspectorUrl}
            </p>
            <a
              href={metadata.hostedInspectionUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
              data-testid={`${testIdPrefix}-inspector-link`}
            >
              {dictionary.builder.deploy.openInspectorUrl}
            </a>
            <p className="mt-2 break-all text-xs text-muted-foreground">
              {metadata.hostedInspectionUrl}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ExecutionLogCard({
  log,
  locale,
}: {
  log: DeployExecutionLogRecord;
  locale: Locale;
}) {
  return (
    <div className="rounded-[16px] border border-border bg-background/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-card-foreground">{log.message}</p>
          <Badge>{log.level}</Badge>
        </div>
        <Badge>{formatDateTimeLabel(log.createdAt, locale)}</Badge>
      </div>
      {Object.keys(log.metadata).length > 0 ? (
        <pre className="mt-3 overflow-x-auto rounded-[14px] bg-slate-950/95 p-3 text-xs leading-6 text-slate-100">
          {JSON.stringify(log.metadata, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
