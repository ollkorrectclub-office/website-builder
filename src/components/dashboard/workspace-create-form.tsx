"use client";

import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { Card } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { initialFormState, type FormState } from "@/lib/workspaces/form-state";
import { countryOptions } from "@/lib/workspaces/options";

type WorkspaceAction = (state: FormState, formData: FormData) => Promise<FormState>;

const baseInputClass =
  "w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/50";

export function WorkspaceCreateForm({
  locale,
  dictionary,
  action,
}: {
  locale: Locale;
  dictionary: Dictionary;
  action: WorkspaceAction;
}) {
  const [step, setStep] = useState(0);
  const [state, formAction] = useActionState(action, initialFormState);
  const [draft, setDraft] = useState({
    name: "",
    companyName: "",
    businessCategory: "",
    country: "kosovo",
    defaultLocale: locale,
    supportedLocales: ["sq", "en"] as Array<"sq" | "en">,
    intentNotes: "",
  });

  const steps = [dictionary.onboarding.stepOne, dictionary.onboarding.stepTwo, dictionary.onboarding.stepThree];
  const isLastStep = step === steps.length - 1;

  function toggleSupportedLocale(nextLocale: "sq" | "en", checked: boolean) {
    setDraft((current) => {
      const nextValues = checked
        ? Array.from(new Set([nextLocale, ...current.supportedLocales]))
        : current.supportedLocales.filter((value) => value !== nextLocale);

      return {
        ...current,
        supportedLocales: nextValues.length > 0 ? nextValues : current.supportedLocales,
      };
    });
  }

  return (
    <form action={formAction} className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Workspace onboarding</p>
        <h1 className="font-display text-4xl font-bold text-foreground">{dictionary.onboarding.title}</h1>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{dictionary.onboarding.copy}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((item, index) => (
          <Card key={item} className={step === index ? "border-primary/50 px-5 py-4" : "px-5 py-4"}>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">0{index + 1}</p>
            <p className="mt-3 font-semibold text-card-foreground">{item}</p>
          </Card>
        ))}
      </div>

      <Card className="px-6 py-6 sm:px-8">
        {step === 0 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">{dictionary.onboarding.workspaceName}</span>
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Your workspace name"
                className={baseInputClass}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">{dictionary.onboarding.companyName}</span>
              <input
                value={draft.companyName}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, companyName: event.target.value }))
                }
                placeholder="Your company or team name"
                className={baseInputClass}
              />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-semibold text-foreground">{dictionary.onboarding.businessCategory}</span>
              <input
                value={draft.businessCategory}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, businessCategory: event.target.value }))
                }
                placeholder="Business category"
                className={baseInputClass}
              />
            </label>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">{dictionary.onboarding.country}</span>
              <select
                value={draft.country}
                onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))}
                className={baseInputClass}
              >
                {countryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label[locale]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">{dictionary.onboarding.defaultLanguage}</span>
              <select
                value={draft.defaultLocale}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    defaultLocale: event.target.value === "en" ? "en" : "sq",
                  }))
                }
                className={baseInputClass}
              >
                <option value="sq">Shqip</option>
                <option value="en">English</option>
              </select>
            </label>
            <fieldset className="space-y-3 sm:col-span-2">
              <legend className="text-sm font-semibold text-foreground">{dictionary.onboarding.supportedLanguages}</legend>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm">
                  <input
                    type="checkbox"
                    value="sq"
                    checked={draft.supportedLocales.includes("sq")}
                    onChange={(event) => toggleSupportedLocale("sq", event.target.checked)}
                  />
                  Shqip
                </label>
                <label className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm">
                  <input
                    type="checkbox"
                    value="en"
                    checked={draft.supportedLocales.includes("en")}
                    onChange={(event) => toggleSupportedLocale("en", event.target.checked)}
                  />
                  English
                </label>
              </div>
            </fieldset>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">{dictionary.onboarding.intentNotes}</span>
              <textarea
                value={draft.intentNotes}
                onChange={(event) => setDraft((current) => ({ ...current, intentNotes: event.target.value }))}
                placeholder="Describe your primary goals, workflows, and launch priorities."
                className="min-h-40 w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm leading-7 outline-none transition focus:border-primary/50"
              />
            </label>
            <p className="text-sm leading-7 text-muted-foreground">{dictionary.onboarding.helper}</p>
          </div>
        ) : null}

        <input type="hidden" name="name" value={draft.name} />
        <input type="hidden" name="companyName" value={draft.companyName} />
        <input type="hidden" name="businessCategory" value={draft.businessCategory} />
        <input type="hidden" name="country" value={draft.country} />
        <input type="hidden" name="defaultLocale" value={draft.defaultLocale} />
        {draft.supportedLocales.map((supportedLocale) => (
          <input key={supportedLocale} type="hidden" name="supportedLocales" value={supportedLocale} />
        ))}
        <input type="hidden" name="intentNotes" value={draft.intentNotes} />

        {state.status === "error" ? (
          <p className="mt-5 rounded-2xl border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {state.message}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          {!isLastStep ? (
            <button
              type="button"
              onClick={() => setStep((current) => current + 1)}
              className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition hover:-translate-y-0.5"
            >
              {dictionary.onboarding.continue}
            </button>
          ) : (
            <SubmitButton label={dictionary.onboarding.finish} pendingLabel={dictionary.onboarding.finish} />
          )}
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((current) => current - 1)}
              className="inline-flex items-center justify-center rounded-full border border-border bg-card/80 px-5 py-3 text-sm font-semibold text-card-foreground transition hover:-translate-y-0.5"
            >
              {dictionary.common.back}
            </button>
          ) : null}
        </div>
      </Card>
    </form>
  );
}
