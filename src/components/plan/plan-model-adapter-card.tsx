"use client";

import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import {
  externalModelProviderLabel,
  modelAdapterCapabilityLabel,
  modelAdapterExecutionModeLabel,
  modelAdapterHealthStatusLabel,
  modelAdapterOutcomeLabel,
  modelAdapterSelectionLabel,
  modelAdapterSourceLabel,
} from "@/lib/model-adapters/labels";
import type {
  ModelAdapterCapability,
  ModelAdapterCapabilityHealthRecord,
  ModelAdapterHealthStatus,
  ModelAdapterRunRecord,
  ProjectModelAdapterBundle,
} from "@/lib/model-adapters/types";
import { initialFormState } from "@/lib/workspaces/form-state";
import type { FormState } from "@/lib/workspaces/form-state";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

type AdapterConfigAction = (state: FormState, formData: FormData) => Promise<FormState>;
type AdapterVerificationAction = AdapterConfigAction;

function selectionForCapability(
  config: ProjectModelAdapterBundle["config"],
  capability: keyof ProjectModelAdapterBundle["latestRunByCapability"],
) {
  switch (capability) {
    case "planning":
      return config.planningSelection;
    case "generation":
      return config.generationSelection;
    case "patch_suggestion":
      return config.patchSelection;
  }
}

function modelForCapability(
  config: ProjectModelAdapterBundle["config"],
  capability: keyof ProjectModelAdapterBundle["latestRunByCapability"],
) {
  switch (capability) {
    case "planning":
      return config.planningModel;
    case "generation":
      return config.generationModel;
    case "patch_suggestion":
      return config.patchModel;
  }
}

function healthTone(status: ModelAdapterHealthStatus) {
  switch (status) {
    case "verified":
      return "border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "config_incomplete":
    case "env_missing":
    case "verification_failed":
      return "border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200";
    case "ready_to_verify":
      return "border-amber-300/50 bg-amber-100/70 text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-200";
    case "deterministic_only":
      return "border-border bg-background/80 text-muted-foreground";
  }
}

function healthCopy(
  dictionary: Dictionary,
  health: ModelAdapterCapabilityHealthRecord,
) {
  const copy = dictionary.plan.modelAdapters.healthCopy;

  switch (health.status) {
    case "config_incomplete":
      return `${copy.config_incomplete} ${copy.missingFields}: ${health.missingFields.join(", ")}.`;
    case "env_missing":
      return health.apiKeyEnvVar
        ? `${copy.env_missing} ${copy.apiKeyEnvVar}: ${health.apiKeyEnvVar}.`
        : copy.env_missing;
    case "verification_failed":
      return health.latestVerificationRun?.errorMessage
        ? `${copy.verification_failed} ${health.latestVerificationRun.errorMessage}`
        : copy.verification_failed;
    default:
      return copy[health.status];
  }
}

function outcomeTone(run: ModelAdapterRunRecord) {
  if (run.status === "failed") {
    return "border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200";
  }

  if (run.executionMode === "fallback") {
    return "border-amber-300/50 bg-amber-100/70 text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-200";
  }

  if (run.sourceType === "external_model") {
    return "border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200";
  }

  return "border-border bg-background/80 text-muted-foreground";
}

function CapabilityVerificationForm({
  capability,
  locale,
  dictionary,
  action,
  canConfigure,
  latestVerificationRun,
}: {
  capability: ModelAdapterCapability;
  locale: Locale;
  dictionary: Dictionary;
  action: AdapterVerificationAction;
  canConfigure: boolean;
  latestVerificationRun: ModelAdapterRunRecord | null;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const retryingFailedVerification = latestVerificationRun?.status === "failed";

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="capability" value={capability} />
      {retryingFailedVerification ? (
        <input type="hidden" name="retryOfRunId" value={latestVerificationRun.id} />
      ) : null}
      <SubmitButton
        label={
          retryingFailedVerification
            ? dictionary.plan.modelAdapters.retryVerifyAction
            : dictionary.plan.modelAdapters.verifyAction
        }
        pendingLabel={dictionary.plan.modelAdapters.verifyingAction}
        variant="secondary"
        disabled={!canConfigure}
        testId={`verify-provider-${capability}`}
      />
      {latestVerificationRun ? (
        <p className="text-xs leading-6 text-muted-foreground">
          {dictionary.plan.modelAdapters.lastVerifiedLabel}:{" "}
          {formatDateTimeLabel(latestVerificationRun.completedAt ?? latestVerificationRun.startedAt, locale)}
        </p>
      ) : null}
      {state.status === "error" ? (
        <p className="rounded-2xl border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function PlanModelAdapterCard({
  locale,
  dictionary,
  adapterBundle,
  action,
  verifyAction,
  canConfigure = true,
  readOnlyCopy,
}: {
  locale: Locale;
  dictionary: Dictionary;
  adapterBundle: ProjectModelAdapterBundle;
  action: AdapterConfigAction;
  verifyAction: AdapterVerificationAction;
  canConfigure?: boolean;
  readOnlyCopy?: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const capabilities = ["planning", "generation", "patch_suggestion"] as const;

  return (
    <Card id="model-adapters" className="px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {dictionary.plan.modelAdapters.title}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {dictionary.plan.modelAdapters.copy}
          </p>
        </div>
        <Badge>{externalModelProviderLabel(dictionary, adapterBundle.config.externalProviderKey)}</Badge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {capabilities.map((capability) => {
          const run = adapterBundle.latestRunByCapability[capability];
          const health = adapterBundle.healthByCapability[capability];
          const selection = selectionForCapability(adapterBundle.config, capability);
          const modelName = modelForCapability(adapterBundle.config, capability);
          const latestVerificationRun = adapterBundle.latestVerificationRunByCapability[capability];

          return (
            <div
              key={capability}
              id={`model-adapter-${capability}`}
              className="rounded-[22px] border border-border bg-background/70 p-4"
            >
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {modelAdapterCapabilityLabel(dictionary, capability)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge>{modelAdapterSelectionLabel(dictionary, selection)}</Badge>
                <Badge className={healthTone(health.status)}>
                  {modelAdapterHealthStatusLabel(dictionary, health.status)}
                </Badge>
                {run ? (
                  <Badge className={outcomeTone(run)}>{modelAdapterOutcomeLabel(dictionary, run)}</Badge>
                ) : null}
                {run ? <Badge>{modelAdapterSourceLabel(dictionary, run.sourceType)}</Badge> : null}
                {run ? <Badge>{modelAdapterExecutionModeLabel(dictionary, run.executionMode)}</Badge> : null}
              </div>
              <p className="mt-3 text-sm font-semibold text-card-foreground">
                {run ? run.summary : dictionary.plan.modelAdapters.noRun}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {modelName || dictionary.plan.modelAdapters.noModel}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{healthCopy(dictionary, health)}</p>
              {run ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {formatDateTimeLabel(run.completedAt ?? run.startedAt, locale)}
                </p>
              ) : null}
              {run?.fallbackReason ? (
                <div className="mt-3 rounded-[18px] border border-amber-300/50 bg-amber-50/80 px-3 py-3 text-sm leading-6 text-amber-950 dark:border-amber-600/30 dark:bg-amber-950/30 dark:text-amber-100">
                  {run.fallbackReason}
                </div>
              ) : null}
              {latestVerificationRun?.status === "failed" && latestVerificationRun.errorMessage ? (
                <div className="mt-3 rounded-[18px] border border-red-300/50 bg-red-50/80 px-3 py-3 text-sm leading-6 text-red-950 dark:border-red-600/30 dark:bg-red-950/30 dark:text-red-100">
                  {latestVerificationRun.errorMessage}
                </div>
              ) : null}
              <CapabilityVerificationForm
                capability={capability}
                locale={locale}
                dictionary={dictionary}
                action={verifyAction}
                canConfigure={canConfigure && selection === "external_model"}
                latestVerificationRun={latestVerificationRun}
              />
            </div>
          );
        })}
      </div>

      <form action={formAction} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {capabilities.map((capability) => {
            const fieldName =
              capability === "planning"
                ? "planningSelection"
                : capability === "generation"
                  ? "generationSelection"
                  : "patchSelection";
            const modelFieldName =
              capability === "planning"
                ? "planningModel"
                : capability === "generation"
                  ? "generationModel"
                  : "patchModel";

            return (
              <div key={capability} className="rounded-[22px] border border-border bg-background/60 p-4">
                <p className="text-sm font-semibold text-card-foreground">
                  {modelAdapterCapabilityLabel(dictionary, capability)}
                </p>
                <label className="mt-3 block text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {dictionary.plan.modelAdapters.selectionLabel}
                </label>
                <select
                  name={fieldName}
                  defaultValue={selectionForCapability(adapterBundle.config, capability)}
                  disabled={!canConfigure}
                  data-testid={`model-adapter-selection-${capability}`}
                  className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-card-foreground"
                >
                  <option value="deterministic_internal">
                    {dictionary.plan.modelAdapters.selections.deterministic_internal}
                  </option>
                  <option value="external_model">
                    {dictionary.plan.modelAdapters.selections.external_model}
                  </option>
                </select>

                <label className="mt-4 block text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {dictionary.plan.modelAdapters.modelLabel}
                </label>
                <input
                  name={modelFieldName}
                  defaultValue={modelForCapability(adapterBundle.config, capability) ?? ""}
                  placeholder={dictionary.plan.modelAdapters.modelPlaceholder}
                  disabled={!canConfigure}
                  data-testid={`model-adapter-model-${capability}`}
                  className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-card-foreground"
                />
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {dictionary.plan.modelAdapters.providerLabel}
            </label>
            <select
              name="externalProviderKey"
              defaultValue={adapterBundle.config.externalProviderKey ?? ""}
              disabled={!canConfigure}
              data-testid="model-adapter-provider-key"
              className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-card-foreground"
            >
              <option value="">{dictionary.plan.modelAdapters.notConfigured}</option>
              <option value="openai_compatible">{dictionary.plan.modelAdapters.providers.openai_compatible}</option>
              <option value="custom_http">{dictionary.plan.modelAdapters.providers.custom_http}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {dictionary.plan.modelAdapters.providerLabelCustom}
            </label>
            <input
              name="externalProviderLabel"
              defaultValue={adapterBundle.config.externalProviderLabel ?? ""}
              placeholder={dictionary.plan.modelAdapters.providerPlaceholder}
              disabled={!canConfigure}
              data-testid="model-adapter-provider-label"
              className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-card-foreground"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {dictionary.plan.modelAdapters.endpointLabel}
            </label>
            <input
              name="externalEndpointUrl"
              defaultValue={adapterBundle.config.externalEndpointUrl ?? ""}
              placeholder="https://api.example.com/v1"
              disabled={!canConfigure}
              data-testid="model-adapter-endpoint"
              className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-card-foreground"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {dictionary.plan.modelAdapters.apiKeyEnvVarLabel}
            </label>
            <input
              name="externalApiKeyEnvVar"
              defaultValue={adapterBundle.config.externalApiKeyEnvVar ?? ""}
              placeholder="OPENAI_API_KEY"
              disabled={!canConfigure}
              data-testid="model-adapter-api-key-env-var"
              className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-card-foreground"
            />
          </div>
        </div>

        {state.status === "error" ? (
          <p className="rounded-2xl border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {state.message}
          </p>
        ) : null}

        {!canConfigure && readOnlyCopy ? (
          <p className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
            {readOnlyCopy}
          </p>
        ) : null}

        <SubmitButton
          label={dictionary.plan.modelAdapters.saveAction}
          pendingLabel={dictionary.plan.modelAdapters.savingAction}
          variant="secondary"
          disabled={!canConfigure}
          testId="model-adapter-save"
        />
      </form>
    </Card>
  );
}
