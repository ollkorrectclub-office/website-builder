"use client";

import { useActionState, useState } from "react";

import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { initialFormState, type FormState } from "@/lib/workspaces/form-state";
import {
  capabilityOptions,
  countryOptions,
  designStyleOptions,
  projectTypeOptions,
} from "@/lib/workspaces/options";

type ProjectAction = (state: FormState, formData: FormData) => Promise<FormState>;

const inputClass =
  "w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/50";

export function ProjectCreateFlow({
  locale,
  dictionary,
  action,
  workspaceDefaults,
}: {
  locale: Locale;
  dictionary: Dictionary;
  action: ProjectAction;
  workspaceDefaults: {
    businessCategory: string;
    country: "kosovo" | "albania";
    defaultLocale: Locale;
    supportedLocales: Locale[];
  };
}) {
  const [mode, setMode] = useState<"prompt" | "wizard">("prompt");
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Project intake</p>
        <h1 className="font-display text-4xl font-bold text-foreground">{dictionary.projectCreate.title}</h1>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{dictionary.projectCreate.copy}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setMode("prompt")}
          className={mode === "prompt"
            ? "rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-soft"
            : "rounded-full border border-border bg-card/80 px-5 py-3 text-sm font-semibold text-card-foreground"}
        >
          {dictionary.projectCreate.promptMode}
        </button>
        <button
          type="button"
          onClick={() => setMode("wizard")}
          className={mode === "wizard"
            ? "rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-soft"
            : "rounded-full border border-border bg-card/80 px-5 py-3 text-sm font-semibold text-card-foreground"}
        >
          {dictionary.projectCreate.wizardMode}
        </button>
      </div>

      <form action={formAction}>
        <input type="hidden" name="startingMode" value={mode} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <Card className="px-6 py-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold text-foreground">{dictionary.projectCreate.name}</span>
                <input
                  name="name"
                  defaultValue={mode === "prompt" ? "Prishtina Care" : "Operations North"}
                  className={inputClass}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">{dictionary.projectCreate.projectType}</span>
                <select name="projectType" defaultValue="website" className={inputClass}>
                  {projectTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label[locale]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">{dictionary.projectCreate.designStyle}</span>
                <select name="designStyle" defaultValue="premium-minimal" className={inputClass}>
                  {designStyleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label[locale]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold text-foreground">{dictionary.projectCreate.prompt}</span>
                <textarea
                  name="prompt"
                  defaultValue={
                    mode === "prompt"
                      ? "Build a premium bilingual website for a private clinic in Prishtina with service pages, booking CTA, and trust sections."
                      : "Create a structured product intake for an internal operations tool for an agency managing client projects."
                  }
                  className="min-h-32 w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm leading-7 outline-none transition focus:border-primary/50"
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold text-foreground">{dictionary.projectCreate.targetUsers}</span>
                <textarea
                  name="targetUsers"
                  defaultValue={
                    mode === "prompt"
                      ? "Patients seeking premium private healthcare, returning clients, family decision-makers"
                      : "Agency owners, project managers, delivery coordinators"
                  }
                  className="min-h-24 w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm leading-7 outline-none transition focus:border-primary/50"
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold text-foreground">
                  {dictionary.projectCreate.desiredPagesFeatures}
                </span>
                <textarea
                  name="desiredPagesFeatures"
                  defaultValue={
                    mode === "prompt"
                      ? "Home, Services, Doctors, Booking, Contact, Trust blocks"
                      : "Overview, Tasks, Reports, Client records, Permissions, Activity log"
                  }
                  className="min-h-24 w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm leading-7 outline-none transition focus:border-primary/50"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">{dictionary.projectCreate.language}</span>
                <select name="primaryLocale" defaultValue={workspaceDefaults.defaultLocale} className={inputClass}>
                  <option value="sq">Shqip</option>
                  <option value="en">English</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">{dictionary.projectCreate.country}</span>
                <select name="country" defaultValue={workspaceDefaults.country} className={inputClass}>
                  {countryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label[locale]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold text-foreground">
                  {dictionary.projectCreate.businessCategory}
                </span>
                <input name="businessCategory" defaultValue={workspaceDefaults.businessCategory} className={inputClass} />
              </label>

              <fieldset className="space-y-3 sm:col-span-2">
                <legend className="text-sm font-semibold text-foreground">{dictionary.projectCreate.capabilities}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {capabilityOptions.map((option) => {
                    const nameMap: Record<string, string> = {
                      auth: "needsAuth",
                      payments: "needsPayments",
                      cms: "needsCms",
                      fileUpload: "needsFileUpload",
                      aiChat: "needsAiChat",
                      calendar: "needsCalendar",
                      analytics: "needsAnalytics",
                    };

                    const defaults: Record<string, boolean> =
                      mode === "prompt"
                        ? { auth: true, calendar: true, analytics: true }
                        : { auth: true, cms: true, analytics: true };

                    return (
                      <label
                        key={option.key}
                        className="inline-flex items-center gap-3 rounded-3xl border border-border bg-background px-4 py-3 text-sm text-card-foreground"
                      >
                        <input
                          type="checkbox"
                          name={nameMap[option.key]}
                          defaultChecked={Boolean(defaults[option.key])}
                        />
                        <span>{option.label[locale]}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="space-y-3 sm:col-span-2">
                <legend className="text-sm font-semibold text-foreground">
                  {dictionary.dashboard.workspaceLocales}
                </legend>
                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm">
                    <input
                      type="checkbox"
                      name="supportedLocales"
                      value="sq"
                      defaultChecked={workspaceDefaults.supportedLocales.includes("sq")}
                    />
                    Shqip
                  </label>
                  <label className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm">
                    <input
                      type="checkbox"
                      name="supportedLocales"
                      value="en"
                      defaultChecked={workspaceDefaults.supportedLocales.includes("en")}
                    />
                    English
                  </label>
                </div>
              </fieldset>
            </div>

            {state.status === "error" ? (
              <p className="mt-5 rounded-2xl border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {state.message}
              </p>
            ) : null}

            <div className="mt-8">
              <SubmitButton
                label={mode === "prompt" ? dictionary.projectCreate.submitPrompt : dictionary.projectCreate.submitWizard}
                pendingLabel={mode === "prompt" ? dictionary.projectCreate.submitPrompt : dictionary.projectCreate.submitWizard}
              />
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="px-5 py-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {mode === "prompt" ? dictionary.projectCreate.promptMode : dictionary.projectCreate.wizardMode}
              </p>
              <p className="mt-3 text-sm leading-7 text-card-foreground">
                {mode === "prompt" ? dictionary.projectCreate.helperPrompt : dictionary.projectCreate.helperWizard}
              </p>
            </Card>
            <Card className="px-5 py-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {dictionary.dashboard.planSummary}
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                <li>{mode === "prompt" ? "Prompt intake" : "Wizard intake"}</li>
                <li>Project record</li>
                <li>Status state</li>
                <li>Mocked structured plan</li>
              </ul>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
