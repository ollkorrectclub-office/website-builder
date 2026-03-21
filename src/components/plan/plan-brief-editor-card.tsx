"use client";

import { useActionState } from "react";

import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { capabilityOptions, countryOptions, designStyleOptions, projectTypeOptions } from "@/lib/workspaces/options";
import { initialFormState, type FormState } from "@/lib/workspaces/form-state";
import type { ProjectBriefRecord } from "@/lib/workspaces/types";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

type BriefAction = (state: FormState, formData: FormData) => Promise<FormState>;

const inputClass =
  "w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm leading-7 outline-none transition focus:border-primary/50";

const capabilityInputNames: Record<keyof ProjectBriefRecord["capabilities"], string> = {
  auth: "needsAuth",
  payments: "needsPayments",
  cms: "needsCms",
  fileUpload: "needsFileUpload",
  aiChat: "needsAiChat",
  calendar: "needsCalendar",
  analytics: "needsAnalytics",
};

export function PlanBriefEditorCard({
  locale,
  dictionary,
  brief,
  currentPlanRevisionNumber,
  action,
  readOnly = false,
  readOnlyCopy,
}: {
  locale: Locale;
  dictionary: Dictionary;
  brief: ProjectBriefRecord;
  currentPlanRevisionNumber: number;
  action: BriefAction;
  readOnly?: boolean;
  readOnlyCopy?: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <Card id="brief-editor" className="scroll-mt-28 px-6 py-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {dictionary.plan.briefEditor.eyebrow}
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold text-card-foreground">
            {dictionary.plan.briefEditor.title}
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {dictionary.plan.briefEditor.copy}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.briefEditor.lastUpdated}
            </p>
            <p className="mt-2 text-sm font-semibold text-card-foreground">
              {formatDateTimeLabel(brief.updatedAt, locale)}
            </p>
          </div>
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.briefEditor.currentPlanRevision}
            </p>
            <p className="mt-2 text-sm font-semibold text-card-foreground">
              {dictionary.plan.revisionPrefix} {currentPlanRevisionNumber}
            </p>
          </div>
        </div>
      </div>

      <form action={formAction} className="mt-6 space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">{dictionary.plan.briefEditor.fields.name}</span>
            <input
              name="name"
              defaultValue={brief.name}
              className={inputClass}
              disabled={readOnly}
              data-testid="brief-name"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">
              {dictionary.plan.briefEditor.fields.projectType}
            </span>
            <select name="projectType" defaultValue={brief.projectType} className={inputClass} disabled={readOnly}>
              {projectTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label[locale]}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">
              {dictionary.plan.briefEditor.fields.designStyle}
            </span>
            <select name="designStyle" defaultValue={brief.designStyle} className={inputClass} disabled={readOnly}>
              {designStyleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label[locale]}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">
              {dictionary.plan.briefEditor.fields.businessCategory}
            </span>
            <input name="businessCategory" defaultValue={brief.businessCategory} className={inputClass} disabled={readOnly} />
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm font-semibold text-foreground">
              {dictionary.plan.briefEditor.fields.prompt}
            </span>
            <textarea
              name="prompt"
              defaultValue={brief.prompt}
              disabled={readOnly}
              className="min-h-32 w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm leading-7 outline-none transition focus:border-primary/50"
            />
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm font-semibold text-foreground">
              {dictionary.plan.briefEditor.fields.targetUsers}
            </span>
            <textarea
              name="targetUsers"
              defaultValue={brief.targetUsers}
              disabled={readOnly}
              className="min-h-24 w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm leading-7 outline-none transition focus:border-primary/50"
            />
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm font-semibold text-foreground">
              {dictionary.plan.briefEditor.fields.desiredPagesFeatures}
            </span>
            <textarea
              name="desiredPagesFeatures"
              defaultValue={brief.desiredPagesFeatures.join(", ")}
              disabled={readOnly}
              className="min-h-24 w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm leading-7 outline-none transition focus:border-primary/50"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">
              {dictionary.plan.briefEditor.fields.primaryLocale}
            </span>
            <select name="primaryLocale" defaultValue={brief.primaryLocale} className={inputClass} disabled={readOnly}>
              <option value="sq">Shqip</option>
              <option value="en">English</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">{dictionary.plan.briefEditor.fields.country}</span>
            <select name="country" defaultValue={brief.country} className={inputClass} disabled={readOnly}>
              {countryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label[locale]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-[24px] border border-border bg-background/70 p-5">
          <p className="text-sm font-semibold text-card-foreground">
            {dictionary.plan.briefEditor.fields.supportedLocales}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {(["sq", "en"] as const).map((language) => (
              <label
                key={language}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 text-sm text-card-foreground"
              >
                <input
                  type="checkbox"
                  name="supportedLocales"
                  value={language}
                  defaultChecked={brief.supportedLocales.includes(language)}
                  disabled={readOnly}
                />
                <span>{language === "sq" ? "Shqip" : "English"}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-background/70 p-5">
          <p className="text-sm font-semibold text-card-foreground">
            {dictionary.plan.briefEditor.fields.capabilities}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {capabilityOptions.map((option) => (
              <label
                key={option.key}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 text-sm text-card-foreground"
              >
                <input
                  type="checkbox"
                  name={capabilityInputNames[option.key]}
                  defaultChecked={brief.capabilities[option.key]}
                  disabled={readOnly}
                />
                <span>{option.label[locale]}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-primary/20 bg-primary/5 p-4 text-sm leading-7 text-muted-foreground">
          {dictionary.plan.briefEditor.helper}
        </div>

        {state.status === "error" ? (
          <p className="rounded-2xl border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {state.message}
          </p>
        ) : null}

        {readOnly && readOnlyCopy ? (
          <p className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
            {readOnlyCopy}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <SubmitButton
            label={dictionary.plan.briefEditor.saveAction}
            pendingLabel={dictionary.plan.briefEditor.saving}
            disabled={readOnly}
          />
        </div>
      </form>
    </Card>
  );
}
