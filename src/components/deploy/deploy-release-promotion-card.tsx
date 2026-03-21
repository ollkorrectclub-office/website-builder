"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deployReleaseStatusLabel, deployRunStatusLabel } from "@/lib/deploy/labels";
import { suggestedReleaseName } from "@/lib/deploy/settings";
import type { DeployReleaseRecord, DeployRunRecord, ProjectDeployBundle } from "@/lib/deploy/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { initialFormState } from "@/lib/workspaces/form-state";
import type { FormState } from "@/lib/workspaces/form-state";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

type DeployAction = (state: FormState, formData: FormData) => Promise<FormState>;

function PromoteButton({
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

function fieldClasses(multiline = false) {
  return multiline
    ? "min-h-[112px] w-full rounded-[20px] border border-border bg-background/70 px-4 py-3 text-sm text-card-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
    : "w-full rounded-[20px] border border-border bg-background/70 px-4 py-3 text-sm text-card-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20";
}

export function DeployReleasePromotionCard({
  locale,
  dictionary,
  workspaceSlug,
  projectSlug,
  bundle,
  selectedRun,
  selectedReleaseId,
  promoteReleaseAction,
}: {
  locale: Locale;
  dictionary: Dictionary;
  workspaceSlug: string;
  projectSlug: string;
  bundle: ProjectDeployBundle;
  selectedRun: DeployRunRecord | null;
  selectedReleaseId: string | null;
  promoteReleaseAction: DeployAction;
}) {
  const [state, formAction] = useActionState(promoteReleaseAction, initialFormState);
  const canPublish = bundle.projectPermissions.canPublishDeploy;
  const selectedRelease =
    bundle.releases.find((release) => release.id === selectedReleaseId) ??
    (selectedRun ? bundle.releases.find((release) => release.deployRunId === selectedRun.id) ?? null : null) ??
    bundle.latestRelease;
  const runRelease = selectedRun
    ? bundle.releases.find((release) => release.deployRunId === selectedRun.id) ?? null
    : null;
  const nextReleaseNumber = (bundle.target.latestReleaseNumber ?? 0) + 1;
  const suggestedName = suggestedReleaseName({
    projectName: bundle.project.name,
    nextReleaseNumber,
    planRevisionNumber: selectedRun?.sourcePlanRevisionNumber ?? bundle.acceptedState.approvedPlanRevisionNumber,
  });
  const runHref = selectedRun
    ? `/${locale}/app/workspaces/${workspaceSlug}/projects/${projectSlug}/deploy?deployRun=${encodeURIComponent(selectedRun.id)}#deploy-run-${selectedRun.id}`
    : null;

  return (
    <Card className="px-5 py-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {dictionary.builder.deploy.releasePromotionTitle}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {dictionary.builder.deploy.releasePromotionCopy}
        </p>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="rounded-[22px] border border-border bg-background/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-card-foreground">
                {selectedRun
                  ? `${dictionary.builder.deploy.latestSnapshot} · ${formatDateTimeLabel(selectedRun.startedAt, locale)}`
                  : dictionary.builder.deploy.notAvailable}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedRun
                  ? `${dictionary.plan.revisionPrefix} ${selectedRun.sourcePlanRevisionNumber} · ${deployRunStatusLabel(dictionary, selectedRun.status)}`
                  : dictionary.builder.deploy.releaseNeedsRun}
              </p>
            </div>
            {selectedRun ? <Badge>{deployRunStatusLabel(dictionary, selectedRun.status)}</Badge> : null}
          </div>
        </div>

        {runRelease ? (
          <div id={`release-${runRelease.id}`} className="rounded-[22px] border border-emerald-300/40 bg-emerald-100/60 p-4 text-emerald-950 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{runRelease.name}</p>
                <p className="mt-1 text-xs opacity-80">
                  {dictionary.builder.deploy.releaseNumber}: {runRelease.releaseNumber}
                </p>
              </div>
              <Badge>{deployReleaseStatusLabel(dictionary, runRelease.status)}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6">{runRelease.notes || dictionary.builder.deploy.releaseNoNotes}</p>
          </div>
        ) : selectedRun?.status === "completed" ? (
          <form action={formAction} className="space-y-4 rounded-[22px] border border-border bg-background/70 p-4">
            <input type="hidden" name="deployRunId" value={selectedRun.id} />
            <label className="block space-y-2 text-sm">
              <span className="text-muted-foreground">{dictionary.builder.deploy.releaseName}</span>
              <input
                name="releaseName"
                defaultValue={suggestedName}
                disabled={!canPublish}
                data-testid="deploy-release-name"
                className={fieldClasses()}
              />
            </label>
            <label className="block space-y-2 text-sm">
              <span className="text-muted-foreground">{dictionary.builder.deploy.releaseNotes}</span>
              <textarea
                name="releaseNotes"
                defaultValue=""
                disabled={!canPublish}
                className={fieldClasses(true)}
              />
            </label>
            <div className="space-y-2">
              <PromoteButton
                label={dictionary.builder.deploy.promoteRelease}
                pendingLabel={dictionary.builder.deploy.promotingRelease}
                disabled={!canPublish}
                data-testid="deploy-release-promote"
              />
              {state.message ? (
                <p className={`text-sm ${state.status === "error" ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                  {state.message}
                </p>
              ) : null}
              {!canPublish ? (
                <p className="text-xs text-muted-foreground">{dictionary.builder.deploy.permissionCopy}</p>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="rounded-[22px] border border-border bg-background/70 p-4">
            <p className="text-sm font-semibold text-card-foreground">
              {dictionary.builder.deploy.releaseNeedsRunTitle}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {dictionary.builder.deploy.releaseNeedsRun}
            </p>
            {runHref ? (
              <Link href={runHref} className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline">
                {dictionary.builder.deploy.openSelectedRun}
              </Link>
            ) : null}
          </div>
        )}

        <div className="rounded-[22px] border border-border bg-background/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-card-foreground">
              {dictionary.builder.deploy.releaseHistoryTitle}
            </p>
            {bundle.latestRelease ? (
              <Badge>{dictionary.builder.deploy.latestRelease}</Badge>
            ) : null}
          </div>
          <div className="mt-4 space-y-3">
            {bundle.releases.length > 0 ? (
              bundle.releases.slice(0, 6).map((release) => {
                const active = selectedRelease?.id === release.id;
                const href = `/${locale}/app/workspaces/${workspaceSlug}/projects/${projectSlug}/deploy?deployRun=${encodeURIComponent(release.deployRunId)}&release=${encodeURIComponent(release.id)}#release-${release.id}`;

                return (
                  <Link
                    key={release.id}
                    href={href}
                    id={`release-${release.id}`}
                    className={`block rounded-[20px] border px-4 py-4 transition ${
                      active
                        ? "border-primary/40 bg-primary/10"
                        : "border-border bg-card/70 hover:border-primary/30 hover:bg-card/90"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-card-foreground">{release.name}</p>
                      <Badge>{deployReleaseStatusLabel(dictionary, release.status)}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {dictionary.builder.deploy.releaseNumber}: {release.releaseNumber} ·{" "}
                      {formatDateTimeLabel(release.createdAt, locale)}
                    </p>
                  </Link>
                );
              })
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">{dictionary.builder.deploy.noReleases}</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
