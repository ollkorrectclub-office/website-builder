"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button, buttonStyles } from "@/components/ui/button";
import { loginAction } from "@/lib/auth/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { initialFormState } from "@/lib/workspaces/form-state";

export function LoginForm({
  locale,
  dictionary,
  nextPath,
}: {
  locale: Locale;
  dictionary: Dictionary;
  nextPath: string | null;
}) {
  const [state, formAction] = useActionState(loginAction.bind(null, locale, nextPath), initialFormState);

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Secure workspace access
        </p>
        <h2 className="font-display text-3xl font-bold text-foreground">{dictionary.auth.loginTitle}</h2>
        <p className="text-sm leading-7 text-muted-foreground">{dictionary.auth.loginCopy}</p>
      </div>

      <form action={formAction} className="mt-8 space-y-5">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">{dictionary.auth.email}</span>
          <input
            name="email"
            type="email"
            defaultValue="arta@besa.studio"
            data-testid="login-email"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none ring-0 transition focus:border-primary/50"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">{dictionary.auth.password}</span>
          <input
            name="password"
            type="password"
            defaultValue="phase1-demo"
            data-testid="login-password"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none ring-0 transition focus:border-primary/50"
          />
        </label>

        {state.status === "error" ? (
          <p className="rounded-2xl border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {state.message}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" data-testid="login-submit">{dictionary.auth.submitLogin}</Button>
          <Link href={`/${locale}/signup${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`} className={buttonStyles("secondary")}>
            {dictionary.common.signup}
          </Link>
        </div>

        <p className="text-sm text-muted-foreground">{dictionary.auth.legalNote}</p>
        <div className="rounded-[24px] border border-border bg-background/70 p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">{locale === "sq" ? "Llogari demo" : "Demo accounts"}</p>
          <p className="mt-2">{locale === "sq" ? "Owner" : "Owner"}: arta@besa.studio</p>
          <p>{locale === "sq" ? "Admin" : "Admin"}: nora@besa.studio</p>
          <p>{locale === "sq" ? "Editor" : "Editor"}: leon@besa.studio</p>
          <p>{locale === "sq" ? "Viewer" : "Viewer"}: sara@besa.studio</p>
          <p className="mt-2">{locale === "sq" ? "Fjalëkalimi" : "Password"}: phase1-demo</p>
        </div>
      </form>
    </div>
  );
}
