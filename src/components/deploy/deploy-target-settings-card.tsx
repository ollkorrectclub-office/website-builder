"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deployAdapterPresetLabel } from "@/lib/deploy/labels";
import { listDeployAdapterPresets } from "@/lib/deploy/presets";
import {
  deployValidationMessage,
  serializeDeployAdapterConfig,
  serializeDeployEnvContract,
  validateDeployTargetSettings,
} from "@/lib/deploy/settings";
import type { ProjectDeployBundle } from "@/lib/deploy/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { initialFormState } from "@/lib/workspaces/form-state";
import type { FormState } from "@/lib/workspaces/form-state";

type DeployAction = (state: FormState, formData: FormData) => Promise<FormState>;

function SaveButton({ label, pendingLabel, disabled }: { label: string; pendingLabel: string; disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={disabled || pending} data-testid="deploy-target-settings-save">
      {pending ? pendingLabel : label}
    </Button>
  );
}

function fieldClasses(multiline = false) {
  return multiline
    ? "min-h-[132px] w-full rounded-[20px] border border-border bg-background/70 px-4 py-3 text-sm text-card-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
    : "w-full rounded-[20px] border border-border bg-background/70 px-4 py-3 text-sm text-card-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20";
}

export function DeployTargetSettingsCard({
  locale,
  dictionary,
  bundle,
  applyPresetAction,
  saveSettingsAction,
}: {
  locale: Locale;
  dictionary: Dictionary;
  bundle: ProjectDeployBundle;
  applyPresetAction: DeployAction;
  saveSettingsAction: DeployAction;
}) {
  const [presetState, presetFormAction] = useActionState(applyPresetAction, initialFormState);
  const [state, formAction] = useActionState(saveSettingsAction, initialFormState);
  const { settings } = bundle.target;
  const canPublish = bundle.projectPermissions.canPublishDeploy;
  const validation = validateDeployTargetSettings(settings);
  const presets = listDeployAdapterPresets();

  return (
    <Card id="target-settings" className="px-5 py-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {dictionary.builder.deploy.targetSettingsTitle}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {dictionary.builder.deploy.targetSettingsCopy}
        </p>
      </div>

      <div
        className={`mt-5 rounded-[22px] border p-4 ${
          validation.isValid
            ? "border-emerald-300/40 bg-emerald-100/60 text-emerald-950 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-100"
            : "border-red-300/40 bg-red-100/60 text-red-950 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-100"
        }`}
      >
        <p className="text-sm font-semibold">
          {validation.isValid
            ? dictionary.builder.deploy.validationReadyTitle
            : dictionary.builder.deploy.validationBlockedTitle}
        </p>
        <p className="mt-2 text-sm leading-6 opacity-90">
          {validation.isValid
            ? dictionary.builder.deploy.validationReadyCopy
            : dictionary.builder.deploy.validationBlockedCopy}
        </p>
        {!validation.isValid ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {validation.issues.map((issue, index) => (
              <li key={`${issue.field}-${issue.kind}-${issue.key ?? "issue"}-${index}`}>
                {deployValidationMessage(locale, issue)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-5 rounded-[22px] border border-border bg-background/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-card-foreground">
              {dictionary.builder.deploy.presetTitle}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {dictionary.builder.deploy.presetCopy}
            </p>
          </div>
          <Badge>{deployAdapterPresetLabel(dictionary, settings.adapterPresetKey)}</Badge>
        </div>

        <div className="mt-4 grid gap-3">
          {presets.map((preset) => (
            <form
              key={preset.key}
              action={presetFormAction}
              className="rounded-[18px] border border-border bg-card/70 p-4"
            >
              <input type="hidden" name="presetKey" value={preset.key} />
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-sm font-semibold text-card-foreground">
                    {deployAdapterPresetLabel(dictionary, preset.key)}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {dictionary.builder.deploy.presetDescriptions[preset.key]}
                  </p>
                </div>
                <Button
                  type="submit"
                  variant={settings.adapterPresetKey === preset.key ? "secondary" : "primary"}
                  disabled={!canPublish}
                >
                  {settings.adapterPresetKey === preset.key
                    ? dictionary.builder.deploy.presetActive
                    : dictionary.builder.deploy.applyPreset}
                </Button>
              </div>
            </form>
          ))}
        </div>

        {presetState.message ? (
          <p
            className={`mt-3 text-sm ${
              presetState.status === "error"
                ? "text-red-600 dark:text-red-300"
                : "text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {presetState.message}
          </p>
        ) : null}
      </div>

      <form action={formAction} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">{dictionary.builder.deploy.adapterKey}</span>
            <input
              name="adapterKeyReadonly"
              value={settings.adapterKey}
              readOnly
              className={fieldClasses()}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">{dictionary.builder.deploy.environmentKey}</span>
            <input
              name="environmentKey"
              defaultValue={settings.environmentKey}
              disabled={!canPublish}
              className={fieldClasses()}
              data-testid="deploy-target-settings-environment-key"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">{dictionary.builder.deploy.primaryDomain}</span>
            <input
              name="primaryDomain"
              defaultValue={settings.primaryDomain}
              disabled={!canPublish}
              placeholder="app.example.com"
              className={fieldClasses()}
              data-testid="deploy-target-settings-primary-domain"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">{dictionary.builder.deploy.outputDirectory}</span>
            <input
              name="outputDirectory"
              defaultValue={settings.outputDirectory}
              disabled={!canPublish}
              className={fieldClasses()}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">{dictionary.builder.deploy.installCommand}</span>
            <input
              name="installCommand"
              defaultValue={settings.installCommand}
              disabled={!canPublish}
              className={fieldClasses()}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">{dictionary.builder.deploy.buildCommand}</span>
            <input
              name="buildCommand"
              defaultValue={settings.buildCommand}
              disabled={!canPublish}
              className={fieldClasses()}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">{dictionary.builder.deploy.startCommand}</span>
            <input
              name="startCommand"
              defaultValue={settings.startCommand}
              disabled={!canPublish}
              className={fieldClasses()}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">{dictionary.builder.deploy.presetLabel}</span>
            <input
              name="adapterPresetReadonly"
              value={deployAdapterPresetLabel(dictionary, settings.adapterPresetKey)}
              readOnly
              className={fieldClasses()}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">{dictionary.builder.deploy.nodeVersion}</span>
            <input
              name="nodeVersion"
              defaultValue={settings.nodeVersion}
              disabled={!canPublish}
              className={fieldClasses()}
            />
          </label>
        </div>

        <label className="block space-y-2 text-sm">
          <span className="text-muted-foreground">{dictionary.builder.deploy.envContract}</span>
          <textarea
            name="envContract"
            defaultValue={serializeDeployEnvContract(settings.envContract)}
            disabled={!canPublish}
            className={fieldClasses(true)}
          />
        </label>

        <label className="block space-y-2 text-sm">
          <span className="text-muted-foreground">{dictionary.builder.deploy.adapterConfig}</span>
          <textarea
            name="adapterConfig"
            defaultValue={serializeDeployAdapterConfig(settings.adapterConfig)}
            disabled={!canPublish}
            className={fieldClasses(true)}
            data-testid="deploy-target-settings-adapter-config"
          />
        </label>

        <div className="flex flex-col gap-2">
          <SaveButton
            label={dictionary.builder.deploy.saveTargetSettings}
            pendingLabel={dictionary.builder.deploy.savingTargetSettings}
            disabled={!canPublish}
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
    </Card>
  );
}
