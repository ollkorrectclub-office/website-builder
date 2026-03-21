"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  deployAdapterPresetLabel,
  deployHandoffRunStatusLabel,
} from "@/lib/deploy/labels";
import { evaluateDeployReleaseReadiness } from "@/lib/deploy/readiness";
import type { DeployReleaseRecord, ProjectDeployBundle } from "@/lib/deploy/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { initialFormState } from "@/lib/workspaces/form-state";
import type { FormState } from "@/lib/workspaces/form-state";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

type DeployAction = (state: FormState, formData: FormData) => Promise<FormState>;

function ActionButton({
  label,
  pendingLabel,
  disabled,
  testId,
}: {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
  testId?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={disabled || pending} data-testid={testId}>
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

function handoffTone(status: "blocked" | "completed" | "failed") {
  switch (status) {
    case "blocked":
      return "border-amber-300/50 bg-amber-100/70 text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-200";
    case "completed":
      return "border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "failed":
      return "border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200";
  }
}

function logTone(level: "info" | "warning" | "error") {
  switch (level) {
    case "info":
      return "text-muted-foreground";
    case "warning":
      return "text-amber-700 dark:text-amber-300";
    case "error":
      return "text-red-700 dark:text-red-300";
  }
}

export function DeployReleaseSimulationCard({
  locale,
  dictionary,
  workspaceSlug,
  projectSlug,
  bundle,
  selectedRelease,
  selectedHandoffRunId,
  executeSimulationAction,
}: {
  locale: Locale;
  dictionary: Dictionary;
  workspaceSlug: string;
  projectSlug: string;
  bundle: ProjectDeployBundle;
  selectedRelease: DeployReleaseRecord | null;
  selectedHandoffRunId: string | null;
  executeSimulationAction: DeployAction;
}) {
  const [state, formAction] = useActionState(executeSimulationAction, initialFormState);
  const canPublish = bundle.projectPermissions.canPublishDeploy;
  const releaseRun = selectedRelease
    ? bundle.runs.find((run) => run.id === selectedRelease.deployRunId) ?? null
    : null;
  const releaseArtifacts = releaseRun
    ? bundle.artifacts.filter((artifact) => artifact.deployRunId === releaseRun.id)
    : [];
  const readiness = selectedRelease
    ? evaluateDeployReleaseReadiness({
        target: bundle.target,
        release: selectedRelease,
        run: releaseRun,
        artifacts: releaseArtifacts,
      })
    : null;
  const releaseHandoffRuns = selectedRelease
    ? bundle.handoffRuns.filter((run) => run.releaseId === selectedRelease.id)
    : [];
  const selectedHandoffRun =
    releaseHandoffRuns.find((run) => run.id === selectedHandoffRunId) ??
    releaseHandoffRuns[0] ??
    null;

  return (
    <Card className="px-5 py-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {dictionary.builder.deploy.simulationTitle}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {dictionary.builder.deploy.simulationCopy}
        </p>
      </div>

      {!selectedRelease ? (
        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          {dictionary.builder.deploy.simulationNoRelease}
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={dictionary.builder.deploy.presetLabel}
              value={deployAdapterPresetLabel(dictionary, bundle.target.settings.adapterPresetKey)}
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
                    {dictionary.builder.deploy.readinessTitle}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {dictionary.builder.deploy.readinessCopy}
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
                  {dictionary.builder.deploy.runSimulationTitle}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {selectedRelease.status === "exported"
                    ? dictionary.builder.deploy.runSimulationCopy
                    : dictionary.builder.deploy.runSimulationBlockedCopy}
                </p>
              </div>
              <ActionButton
                label={dictionary.builder.deploy.runSimulation}
                pendingLabel={dictionary.builder.deploy.runningSimulation}
                disabled={!canPublish}
                testId="deploy-run-simulation"
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
            <div
              className="rounded-[22px] border border-border bg-background/70 p-4"
              data-testid="deploy-handoff-history"
            >
              <p className="text-sm font-semibold text-card-foreground">
                {dictionary.builder.deploy.handoffHistoryTitle}
              </p>
              <div className="mt-4 space-y-3">
                {releaseHandoffRuns.length > 0 ? (
                  releaseHandoffRuns.map((run) => {
                    const active = selectedHandoffRun?.id === run.id;
                    const href = `/${locale}/app/workspaces/${workspaceSlug}/projects/${projectSlug}/deploy?deployRun=${encodeURIComponent(run.deployRunId)}&release=${encodeURIComponent(run.releaseId)}&handoffRun=${encodeURIComponent(run.id)}#handoff-run-${run.id}`;

                    return (
                      <Link
                        key={run.id}
                        href={href}
                        data-testid="deploy-handoff-history-item"
                        className={`block rounded-[18px] border px-4 py-4 transition ${
                          active
                            ? "border-primary/40 bg-primary/10"
                            : "border-border bg-card/70 hover:border-primary/30 hover:bg-card/90"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-card-foreground">
                            {formatDateTimeLabel(run.startedAt, locale)}
                          </p>
                          <Badge className={handoffTone(run.status)}>
                            {deployHandoffRunStatusLabel(dictionary, run.status)}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{run.summary}</p>
                      </Link>
                    );
                  })
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    {dictionary.builder.deploy.noHandoffRuns}
                  </p>
                )}
              </div>
            </div>

            <div
              id={selectedHandoffRun ? `handoff-run-${selectedHandoffRun.id}` : undefined}
              className="rounded-[22px] border border-border bg-background/70 p-4"
              data-testid="deploy-handoff-logs"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-card-foreground">
                  {dictionary.builder.deploy.handoffLogsTitle}
                </p>
                {selectedHandoffRun ? (
                  <Badge className={handoffTone(selectedHandoffRun.status)}>
                    {deployHandoffRunStatusLabel(dictionary, selectedHandoffRun.status)}
                  </Badge>
                ) : null}
              </div>

              {selectedHandoffRun ? (
                <div className="mt-4 space-y-3">
                  {selectedHandoffRun.logs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-[16px] border border-border bg-card/70 p-3"
                      data-testid="deploy-handoff-log-item"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className={`text-sm font-medium ${logTone(log.level)}`}>{log.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTimeLabel(log.createdAt, locale)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {dictionary.builder.deploy.handoffLogsEmpty}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-border bg-card/70 p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold text-card-foreground">{value}</p>
    </div>
  );
}
