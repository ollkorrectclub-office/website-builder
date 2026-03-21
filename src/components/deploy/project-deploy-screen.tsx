"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { DeployArtifactInspectorCard } from "@/components/deploy/deploy-artifact-inspector-card";
import { DeployReleaseExecutionCard } from "@/components/deploy/deploy-release-execution-card";
import { DeployReleaseHandoffCard } from "@/components/deploy/deploy-release-handoff-card";
import { DeployReleasePromotionCard } from "@/components/deploy/deploy-release-promotion-card";
import { DeployReleaseSimulationCard } from "@/components/deploy/deploy-release-simulation-card";
import { DeployTargetSettingsCard } from "@/components/deploy/deploy-target-settings-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  deployExecutionRunStatusLabel,
  deployRunStatusLabel,
  deploySourceLabel,
  deployTargetStatusLabel,
  deployTriggerLabel,
} from "@/lib/deploy/labels";
import type { ProjectDeployBundle } from "@/lib/deploy/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { initialFormState } from "@/lib/workspaces/form-state";
import type { FormState } from "@/lib/workspaces/form-state";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

type DeployAction = (state: FormState, formData: FormData) => Promise<FormState>;

function statusTone(status: "completed" | "failed") {
  switch (status) {
    case "completed":
      return "border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "failed":
      return "border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200";
  }
}

function targetTone(status: ProjectDeployBundle["target"]["status"]) {
  switch (status) {
    case "snapshot_ready":
      return "border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "failed":
      return "border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200";
    case "idle":
      return "border-border bg-background/80 text-muted-foreground";
  }
}

function SnapshotButton({
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

export function ProjectDeployScreen({
  locale,
  dictionary,
  workspaceSlug,
  projectSlug,
  bundle,
  selectedDeployRunId,
  selectedArtifactType,
  selectedFilePath,
  selectedReleaseId,
  selectedHandoffRunId,
  selectedExecutionRunId,
  createDeployAction,
  applyDeployTargetPresetAction,
  saveDeployTargetSettingsAction,
  promoteDeployReleaseAction,
  prepareDeployReleaseHandoffAction,
  executeDeployReleaseHandoffSimulationAction,
  executeDeployReleaseAction,
  recheckDeployExecutionRunAction,
  retryDeployExecutionRunAction,
  exportAction,
}: {
  locale: Locale;
  dictionary: Dictionary;
  workspaceSlug: string;
  projectSlug: string;
  bundle: ProjectDeployBundle;
  selectedDeployRunId: string | null;
  selectedArtifactType: string | null;
  selectedFilePath: string | null;
  selectedReleaseId: string | null;
  selectedHandoffRunId: string | null;
  selectedExecutionRunId: string | null;
  createDeployAction: DeployAction;
  applyDeployTargetPresetAction: DeployAction;
  saveDeployTargetSettingsAction: DeployAction;
  promoteDeployReleaseAction: DeployAction;
  prepareDeployReleaseHandoffAction: DeployAction;
  executeDeployReleaseHandoffSimulationAction: DeployAction;
  executeDeployReleaseAction: DeployAction;
  recheckDeployExecutionRunAction: DeployAction;
  retryDeployExecutionRunAction: DeployAction;
  exportAction: string;
}) {
  const [state, formAction] = useActionState(createDeployAction, initialFormState);
  const selectedRun =
    bundle.runs.find((run) => run.id === selectedDeployRunId) ??
    bundle.latestRun ??
    bundle.runs[0] ??
    null;
  const canPublish = bundle.projectPermissions.canPublishDeploy;
  const behindApproved = bundle.acceptedState.surfacesBehindApproved;
  const runLinks = bundle.runs.slice(0, 8);
  const selectedRelease =
    bundle.releases.find((release) => release.id === selectedReleaseId) ??
    (selectedRun ? bundle.releases.find((release) => release.deployRunId === selectedRun.id) ?? null : null) ??
    bundle.latestRelease;

  return (
    <div className="space-y-6 overflow-x-hidden">
      <Card className="px-6 py-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.builder.deploy.title}
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold text-card-foreground">
              {dictionary.builder.deploy.heading}
            </h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              {dictionary.builder.deploy.copy}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge className={targetTone(bundle.target.status)}>
              {deployTargetStatusLabel(dictionary, bundle.target.status)}
            </Badge>
            {bundle.latestRun ? (
              <Badge className={statusTone(bundle.latestRun.status)}>
                {deployRunStatusLabel(dictionary, bundle.latestRun.status)}
              </Badge>
            ) : null}
            {bundle.latestRelease ? (
              <Badge>{bundle.latestRelease.name}</Badge>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={dictionary.builder.deploy.acceptedPlan}
            value={
              bundle.acceptedState.approvedPlanRevisionNumber
                ? `${dictionary.plan.revisionPrefix} ${bundle.acceptedState.approvedPlanRevisionNumber}`
                : dictionary.builder.deploy.notReady
            }
          />
          <MetricCard
            label={dictionary.builder.deploy.acceptedVisual}
            value={
              bundle.acceptedState.visualRevisionNumber
                ? `${dictionary.plan.revisionPrefix} ${bundle.acceptedState.visualRevisionNumber}`
                : dictionary.builder.deploy.notReady
            }
          />
          <MetricCard
            label={dictionary.builder.deploy.acceptedCode}
            value={
              bundle.acceptedState.codeRevisionNumber
                ? `${dictionary.plan.revisionPrefix} ${bundle.acceptedState.codeRevisionNumber}`
                : dictionary.builder.deploy.notReady
            }
          />
          <MetricCard
            label={dictionary.builder.deploy.runtimeSource}
            value={
              bundle.acceptedState.runtimeSource === "accepted_generation_target"
                ? dictionary.builder.preview.runtimeFromGeneration
                : bundle.acceptedState.runtimeSource === "visual_fallback"
                  ? dictionary.builder.preview.runtimeFromVisual
                  : dictionary.builder.deploy.notReady
            }
          />
        </div>

        <div className="mt-6 flex flex-col gap-4 rounded-[24px] border border-border bg-background/70 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-card-foreground">
              {dictionary.builder.deploy.acceptedStateTitle}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              {behindApproved.length > 0
                ? dictionary.builder.deploy.behindApprovedCopy.replace("{surfaces}", behindApproved.join(", "))
                : dictionary.builder.deploy.alignedCopy}
            </p>
            <p className="text-xs text-muted-foreground">
              {dictionary.builder.deploy.queueStateLabel}: {bundle.acceptedState.pendingQueueCount}{" "}
              {dictionary.builder.queueInbox.pending}, {bundle.acceptedState.deferredQueueCount}{" "}
              {dictionary.builder.queueInbox.deferred}, {bundle.acceptedState.staleQueueCount}{" "}
              {dictionary.builder.queueInbox.stale}
            </p>
          </div>

          <form action={formAction} className="space-y-2">
            <SnapshotButton
              label={dictionary.builder.deploy.createSnapshot}
              pendingLabel={dictionary.builder.deploy.creatingSnapshot}
              disabled={!canPublish || !bundle.acceptedState.readyToPublish}
              testId="deploy-create-snapshot"
            />
            {state.message ? (
              <p
                className={`max-w-md text-sm ${
                  state.status === "error" ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {state.message}
              </p>
            ) : null}
            {!canPublish ? (
              <p className="max-w-md text-xs text-muted-foreground">
                {dictionary.builder.deploy.permissionCopy}
              </p>
            ) : null}
          </form>
        </div>
      </Card>

      {!canPublish ? (
        <Card className="px-5 py-5" data-testid="deploy-read-only-card">
          <p className="text-sm font-semibold text-card-foreground">
            {dictionary.builder.deploy.targetTitle}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {dictionary.builder.deploy.permissionCopy}
          </p>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_380px]">
        <div className="min-w-0 space-y-6">
          <DeployArtifactInspectorCard
            locale={locale}
            dictionary={dictionary}
            workspaceSlug={workspaceSlug}
            projectSlug={projectSlug}
            bundle={bundle}
            selectedRun={selectedRun}
            selectedArtifactType={selectedArtifactType}
            selectedFilePath={selectedFilePath}
          />
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="px-5 py-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.builder.deploy.targetTitle}
            </p>
            <p className="mt-3 text-lg font-semibold text-card-foreground">{bundle.target.name}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {dictionary.builder.deploy.targetCopy}
            </p>
            <div className="mt-4 grid gap-3">
              <MetricCard
                label={dictionary.builder.deploy.targetStatus}
                value={deployTargetStatusLabel(dictionary, bundle.target.status)}
              />
              <MetricCard
                label={dictionary.builder.deploy.latestSnapshot}
                value={
                  bundle.latestRun
                    ? formatDateTimeLabel(bundle.latestRun.startedAt, locale)
                    : dictionary.builder.deploy.notAvailable
                }
              />
              <MetricCard
                label={dictionary.builder.deploy.latestRelease}
                value={bundle.latestRelease?.name ?? dictionary.builder.deploy.notAvailable}
              />
              <MetricCard
                label={dictionary.builder.deploy.latestExecutionStatus}
                value={
                  bundle.target.latestExecutionRunStatus
                    ? deployExecutionRunStatusLabel(dictionary, bundle.target.latestExecutionRunStatus)
                    : dictionary.builder.deploy.notAvailable
                }
              />
              <MetricCard
                label={dictionary.builder.deploy.hostedUrl}
                value={bundle.target.hostedDeployment?.hostedUrl ?? dictionary.builder.deploy.notAvailable}
              />
              <MetricCard
                label={dictionary.builder.deploy.executionReadyAt}
                value={
                  bundle.target.hostedDeployment
                    ? formatDateTimeLabel(bundle.target.hostedDeployment.readyAt, locale)
                    : dictionary.builder.deploy.notAvailable
                }
              />
            </div>
          </Card>

          <DeployTargetSettingsCard
            locale={locale}
            dictionary={dictionary}
            bundle={bundle}
            applyPresetAction={applyDeployTargetPresetAction}
            saveSettingsAction={saveDeployTargetSettingsAction}
          />

          <DeployReleasePromotionCard
            locale={locale}
            dictionary={dictionary}
            workspaceSlug={workspaceSlug}
            projectSlug={projectSlug}
            bundle={bundle}
            selectedRun={selectedRun}
            selectedReleaseId={selectedReleaseId}
            promoteReleaseAction={promoteDeployReleaseAction}
          />

          <DeployReleaseHandoffCard
            locale={locale}
            dictionary={dictionary}
            bundle={bundle}
            selectedRelease={selectedRelease}
            prepareHandoffAction={prepareDeployReleaseHandoffAction}
            exportAction={exportAction}
          />

          <DeployReleaseSimulationCard
            locale={locale}
            dictionary={dictionary}
            workspaceSlug={workspaceSlug}
            projectSlug={projectSlug}
            bundle={bundle}
            selectedRelease={selectedRelease}
            selectedHandoffRunId={selectedHandoffRunId}
            executeSimulationAction={executeDeployReleaseHandoffSimulationAction}
          />

          <DeployReleaseExecutionCard
            locale={locale}
            dictionary={dictionary}
            workspaceSlug={workspaceSlug}
            projectSlug={projectSlug}
            bundle={bundle}
            selectedRelease={selectedRelease}
            selectedExecutionRunId={selectedExecutionRunId}
            executeDeployReleaseAction={executeDeployReleaseAction}
            recheckDeployExecutionRunAction={recheckDeployExecutionRunAction}
            retryDeployExecutionRunAction={retryDeployExecutionRunAction}
          />

          <Card className="px-5 py-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.builder.deploy.runHistory}
            </p>
            <div className="mt-4 space-y-3">
              {runLinks.length > 0 ? (
                runLinks.map((run) => {
                  const active = selectedRun?.id === run.id;
                  const href = `/${locale}/app/workspaces/${workspaceSlug}/projects/${projectSlug}/deploy?deployRun=${encodeURIComponent(run.id)}#deploy-run-${run.id}`;

                  return (
                    <Link
                      key={run.id}
                      href={href}
                      className={`block rounded-[20px] border px-4 py-4 transition ${
                        active
                          ? "border-primary/40 bg-primary/10"
                          : "border-border bg-background/70 hover:border-primary/30 hover:bg-card/80"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-card-foreground">
                          {formatDateTimeLabel(run.startedAt, locale)}
                        </p>
                        <Badge className={statusTone(run.status)}>
                          {deployRunStatusLabel(dictionary, run.status)}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {deploySourceLabel(dictionary, run.source)} · {deployTriggerLabel(dictionary, run.trigger)}
                      </p>
                    </Link>
                  );
                })
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  {dictionary.builder.deploy.noRuns}
                </p>
              )}
            </div>
          </Card>

          <Card className="px-5 py-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.builder.deploy.previewBoundaryTitle}
            </p>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {dictionary.builder.deploy.previewBoundaryCopy}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/${locale}/app/workspaces/${workspaceSlug}/projects/${projectSlug}/preview`}
                className={buttonStyles("secondary")}
              >
                {dictionary.builder.tabs.preview.label}
              </Link>
              <Link
                href={`/${locale}/app/workspaces/${workspaceSlug}/projects/${projectSlug}/plan`}
                className={buttonStyles("secondary")}
              >
                {dictionary.builder.tabs.plan.label}
              </Link>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-border bg-background/70 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold text-card-foreground">{value}</p>
    </div>
  );
}
