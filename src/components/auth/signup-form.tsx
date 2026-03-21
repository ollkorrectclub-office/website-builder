"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button, buttonStyles } from "@/components/ui/button";
import { signupAction } from "@/lib/auth/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { initialFormState } from "@/lib/workspaces/form-state";

export function SignupForm({
  locale,
  dictionary,
  nextPath,
}: {
  locale: Locale;
  dictionary: Dictionary;
  nextPath: string | null;
}) {
  const [state, formAction] = useActionState(signupAction.bind(null, locale, nextPath), initialFormState);

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Create workspace
        </p>
        <h2 className="font-display text-3xl font-bold text-foreground">{dictionary.auth.signupTitle}</h2>
        <p className="text-sm leading-7 text-muted-foreground">{dictionary.auth.signupCopy}</p>
      </div>

      <form action={formAction} className="mt-8 space-y-5">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">{dictionary.auth.fullName}</span>
          <input
            name="fullName"
            type="text"
            defaultValue="Arta Kelmendi"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/50"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">{dictionary.auth.company}</span>
          <input
            name="companyName"
            type="text"
            defaultValue="Besa Studio"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/50"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">{dictionary.auth.email}</span>
          <input
            name="email"
            type="email"
            defaultValue="arta@besa.studio"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/50"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">{dictionary.auth.password}</span>
          <input
            name="password"
            type="password"
            defaultValue="phase1-demo"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/50"
          />
        </label>

        {state.status === "error" ? (
          <p className="rounded-2xl border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {state.message}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit">{dictionary.auth.submitSignup}</Button>
          <Link href={`/${locale}/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`} className={buttonStyles("ghost")}>
            {dictionary.common.login}
          </Link>
        </div>

        <p className="text-sm text-muted-foreground">{dictionary.auth.legalNote}</p>
      </form>
    </div>
  );
}
