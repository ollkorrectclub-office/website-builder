"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deployReleaseStatusLabel } from "@/lib/deploy/labels";
import { deployValidationMessage, validateDeployTargetSettings } from "@/lib/deploy/settings";
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

export function DeployReleaseHandoffCard({
  locale,
  dictionary,
  bundle,
  selectedRelease,
  prepareHandoffAction,
  exportAction,
}: {
  locale: Locale;
  dictionary: Dictionary;
  bundle: ProjectDeployBundle;
  selectedRelease: DeployReleaseRecord | null;
  prepareHandoffAction: DeployAction;
  exportAction: string;
}) {
  const [state, formAction] = useActionState(prepareHandoffAction, initialFormState);
  const validation = validateDeployTargetSettings(bundle.target.settings);
  const canPublish = bundle.projectPermissions.canPublishDeploy;
  const payload = selectedRelease?.handoffPayload ?? null;

  return (
    <Card className="px-5 py-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {dictionary.builder.deploy.handoffTitle}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {dictionary.builder.deploy.handoffCopy}
        </p>
      </div>

      {!selectedRelease ? (
        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          {dictionary.builder.deploy.handoffNoRelease}
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="rounded-[22px] border border-border bg-background/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-card-foreground">{selectedRelease.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dictionary.builder.deploy.releaseNumber}: {selectedRelease.releaseNumber}
                </p>
              </div>
              <Badge>{deployReleaseStatusLabel(dictionary, selectedRelease.status)}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {selectedRelease.notes || dictionary.builder.deploy.releaseNoNotes}
            </p>
          </div>

          {selectedRelease.status === "promoted" ? (
            <form action={formAction} className="space-y-3 rounded-[22px] border border-border bg-background/70 p-4">
              <input type="hidden" name="releaseId" value={selectedRelease.id} />
              <p className="text-sm leading-6 text-muted-foreground">
                {dictionary.builder.deploy.handoffPrepareCopy}
              </p>
              {!validation.isValid ? (
                <div className="rounded-[18px] border border-red-300/40 bg-red-100/60 p-3 text-red-950 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-100">
                  <p className="text-sm font-semibold">{dictionary.builder.deploy.validationBlockedTitle}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {validation.issues.map((issue, index) => (
                      <li key={`${issue.field}-${issue.kind}-${issue.key ?? "issue"}-${index}`}>
                        {deployValidationMessage(locale, issue)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="space-y-2">
                <ActionButton
                  label={dictionary.builder.deploy.prepareHandoff}
                  pendingLabel={dictionary.builder.deploy.preparingHandoff}
                  disabled={!canPublish || !validation.isValid}
                  testId="deploy-prepare-handoff"
                />
                {state.message ? (
                  <p
                    className={`text-sm ${
                      state.status === "error" ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    {state.message}
                  </p>
                ) : null}
              </div>
            </form>
          ) : null}

          {payload ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label={dictionary.builder.deploy.adapterKey} value={payload.adapterKey} />
                <MetricCard label={dictionary.builder.deploy.environmentKey} value={payload.environmentKey} />
                <MetricCard label={dictionary.builder.deploy.primaryDomain} value={payload.primaryDomain} />
                <MetricCard label={dictionary.builder.deploy.outputDirectory} value={payload.outputDirectory} />
              </div>

              <div className="rounded-[22px] border border-border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {dictionary.builder.deploy.handoffPreparedAt}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">
                  {formatDateTimeLabel(payload.preparedAt, locale)}
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-[22px] border border-border bg-background/70 p-4">
                  <p className="text-sm font-semibold text-card-foreground">
                    {dictionary.builder.deploy.handoffPayloadTitle}
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        {dictionary.builder.deploy.commandSetTitle}
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <li>{payload.commands.install}</li>
                        <li>{payload.commands.build}</li>
                        <li>{payload.commands.start}</li>
                        <li>{payload.nodeVersion}</li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        {dictionary.builder.deploy.envContract}
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        {payload.envContract.map((entry) => (
                          <li key={entry.key}>
                            <span className="font-semibold text-card-foreground">{entry.key}</span>{" "}
                            <span className="text-xs">
                              {entry.required
                                ? dictionary.builder.deploy.requiredLabel
                                : dictionary.builder.deploy.optionalLabel}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {dictionary.builder.deploy.adapterConfig}
                    </p>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {payload.adapterConfig.map((entry) => (
                        <li key={entry.key}>
                          <span className="font-semibold text-card-foreground">{entry.key}</span>: {entry.value}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="rounded-[22px] border border-border bg-background/70 p-4">
                  <p className="text-sm font-semibold text-card-foreground">
                    {dictionary.builder.deploy.handoffArtifactSummaryTitle}
                  </p>
                  <div className="mt-4 space-y-3">
                    <MetricCard label={dictionary.builder.deploy.routes} value={String(payload.artifactSummary.routeCount)} />
                    <MetricCard label={dictionary.builder.deploy.files} value={String(payload.artifactSummary.fileCount)} />
                    <MetricCard label={dictionary.builder.deploy.themeTokenTitle} value={String(payload.artifactSummary.themeTokenCount)} />
                  </div>
                </div>
              </div>

              <div className="rounded-[22px] border border-border bg-background/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">
                      {dictionary.builder.deploy.exportTitle}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedRelease.exportFileName ?? dictionary.builder.deploy.notAvailable}
                    </p>
                  </div>
                  {selectedRelease.status === "exported" && selectedRelease.exportedAt ? (
                    <Badge>
                      {dictionary.builder.deploy.exportedAtLabel}: {formatDateTimeLabel(selectedRelease.exportedAt, locale)}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <form action={exportAction} method="post">
                    <input type="hidden" name="releaseId" value={selectedRelease.id} />
                    <Button type="submit" disabled={!canPublish} data-testid="deploy-export-release">
                      {selectedRelease.status === "exported"
                        ? dictionary.builder.deploy.downloadAgain
                        : dictionary.builder.deploy.exportRelease}
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          ) : null}
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
