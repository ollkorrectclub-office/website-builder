"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { initialFormState } from "@/lib/workspaces/form-state";
import type { FormState } from "@/lib/workspaces/form-state";
import type { WorkspaceInvitationDeliveryChannel, WorkspaceInvitationDisplayStatus } from "@/lib/workspaces/types";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

function localized(locale: Locale, sq: string, en: string) {
  return locale === "sq" ? sq : en;
}

function fieldClass() {
  return "w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/50";
}

export function WorkspaceInvitationAcceptCard({
  locale,
  dictionary,
  workspaceName,
  workspaceHref,
  loginHref,
  invitationEmail,
  roleLabel,
  invitationDisplayStatus,
  invitationLastSentAt,
  invitationExpiresAt,
  deliveryChannel,
  deliveryAttemptNumber,
  hasExistingAccount,
  currentUserEmail,
  acceptAction,
  logoutAction,
}: {
  locale: Locale;
  dictionary: Dictionary;
  workspaceName: string;
  workspaceHref: string;
  loginHref: string;
  invitationEmail: string;
  roleLabel: string;
  invitationDisplayStatus: WorkspaceInvitationDisplayStatus;
  invitationLastSentAt: string;
  invitationExpiresAt: string;
  deliveryChannel: WorkspaceInvitationDeliveryChannel;
  deliveryAttemptNumber: number;
  hasExistingAccount: boolean;
  currentUserEmail: string | null;
  acceptAction: (state: FormState, formData: FormData) => Promise<FormState>;
  logoutAction: () => Promise<void>;
}) {
  const [state, formAction] = useActionState(acceptAction, initialFormState);
  const matchesSignedInUser = currentUserEmail === invitationEmail;
  const deliveryLabel =
    deliveryChannel === "stored_link"
      ? localized(locale, "Link i ruajtur", "Stored link")
      : localized(locale, "Dërgesë", "Delivery");

  return (
    <Card className="mx-auto max-w-2xl px-6 py-6">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {localized(locale, "Ftesë workspace-i", "Workspace invitation")}
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold text-card-foreground">{workspaceName}</h1>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        {localized(
          locale,
          `Kjo ftesë është për ${invitationEmail} me rolin ${roleLabel}.`,
          `This invitation is for ${invitationEmail} with the ${roleLabel} role.`,
        )}
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3" data-testid="workspace-invitation-delivery-meta">
        <div className="rounded-2xl border border-border bg-background/70 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {localized(locale, "Dërgimi", "Delivery")}
          </p>
          <p className="mt-2 text-sm font-semibold text-card-foreground">{deliveryLabel}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background/70 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {localized(locale, "Tentativa", "Attempt")}
          </p>
          <p className="mt-2 text-sm font-semibold text-card-foreground">#{deliveryAttemptNumber}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background/70 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {localized(locale, "Skadon", "Expires")}
          </p>
          <p className="mt-2 text-sm font-semibold text-card-foreground">
            {formatDateTimeLabel(invitationExpiresAt, locale)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {localized(locale, "Dërguar më", "Sent at")} {formatDateTimeLabel(invitationLastSentAt, locale)}
      </p>

      {invitationDisplayStatus !== "pending" ? (
        <div className="mt-6 space-y-4">
          <p
            className="rounded-2xl border border-border bg-background/70 px-4 py-4 text-sm text-muted-foreground"
            data-testid={invitationDisplayStatus === "expired" ? "workspace-invitation-expired-state" : undefined}
          >
            {invitationDisplayStatus === "accepted"
              ? localized(locale, "Kjo ftesë është pranuar tashmë.", "This invitation has already been accepted.")
              : invitationDisplayStatus === "expired"
                ? localized(
                    locale,
                    "Kjo ftesë ka skaduar. Kërko nga owner-i ose admin-i i workspace-it një link të ri.",
                    "This invitation has expired. Ask the workspace owner or an admin for a fresh link.",
                  )
                : localized(locale, "Kjo ftesë nuk është më aktive.", "This invitation is no longer active.")}
          </p>
          <Link href={workspaceHref} className={buttonStyles("primary")}>
            {localized(locale, "Hap workspace-in", "Open workspace")}
          </Link>
        </div>
      ) : currentUserEmail && !matchesSignedInUser ? (
        <div className="mt-6 space-y-4">
          <p className="rounded-2xl border border-border bg-background/70 px-4 py-4 text-sm text-muted-foreground">
            {localized(
              locale,
              `Je i kyçur si ${currentUserEmail}. Dil dhe kyçu me ${invitationEmail} për ta pranuar ftesën.`,
              `You are signed in as ${currentUserEmail}. Sign out and use ${invitationEmail} to accept this invitation.`,
            )}
          </p>
          <form action={logoutAction}>
            <Button type="submit">{localized(locale, "Dil", "Sign out")}</Button>
          </form>
        </div>
      ) : currentUserEmail && matchesSignedInUser ? (
        <form action={formAction} className="mt-6 space-y-4" data-testid="workspace-invitation-accept-form">
          <Button type="submit" data-testid="workspace-invitation-accept-submit">
            {localized(locale, "Prano ftesën", "Accept invitation")}
          </Button>
          {state.message ? (
            <p className={`text-sm ${state.status === "error" ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
              {state.message}
            </p>
          ) : null}
        </form>
      ) : hasExistingAccount ? (
        <div className="mt-6 space-y-4">
          <p className="rounded-2xl border border-border bg-background/70 px-4 py-4 text-sm text-muted-foreground">
            {localized(
              locale,
              "Ky email ka tashmë llogari. Kyçu për të vazhduar me pranimin e ftesës.",
              "This email already has an account. Sign in to continue with invitation acceptance.",
            )}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={loginHref} className={buttonStyles("primary")}>
              {dictionary.common.login}
            </Link>
          </div>
        </div>
      ) : (
        <form action={formAction} className="mt-6 space-y-4" data-testid="workspace-invitation-accept-form">
          <label className="block space-y-2 text-sm">
            <span className="text-muted-foreground">{dictionary.auth.fullName}</span>
            <input name="fullName" className={fieldClass()} />
          </label>
          <label className="block space-y-2 text-sm">
            <span className="text-muted-foreground">{dictionary.auth.password}</span>
            <input name="password" type="password" className={fieldClass()} />
          </label>
          <p className="text-xs text-muted-foreground">
            {localized(
              locale,
              "Kjo do të krijojë një llogari bazë dhe do ta pranojë ftesën në të njëjtën kohë.",
              "This will create a basic account and accept the invitation in one step.",
            )}
          </p>
          <Button type="submit" data-testid="workspace-invitation-accept-submit">
            {localized(locale, "Krijo llogari dhe prano", "Create account and accept")}
          </Button>
          {state.message ? (
            <p className={`text-sm ${state.status === "error" ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
              {state.message}
            </p>
          ) : null}
        </form>
      )}
    </Card>
  );
}
