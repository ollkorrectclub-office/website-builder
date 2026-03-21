"use client";

import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState, type FormState } from "@/lib/workspaces/form-state";

type ReviewAction = (state: FormState, formData: FormData) => Promise<FormState>;

export function PlanReviewActions({
  reviewStatusTitle,
  projectStatusTitle,
  currentRevisionTitle,
  lastUpdatedTitle,
  revisionStateTitle,
  statusLabel,
  revisionLabel,
  lastUpdatedLabel,
  reviewStateLabel,
  needsChangesAction,
  reviewNoteLabel,
  needsChangesCardTitle,
  needsChangesDefaultNote,
  needsChangesLabel,
  savingLabel,
  canMarkNeedsChanges = true,
  readOnlyCopy,
}: {
  reviewStatusTitle: string;
  projectStatusTitle: string;
  currentRevisionTitle: string;
  lastUpdatedTitle: string;
  revisionStateTitle: string;
  statusLabel: string;
  revisionLabel: string;
  lastUpdatedLabel: string;
  reviewStateLabel: string;
  needsChangesAction: ReviewAction;
  reviewNoteLabel: string;
  needsChangesCardTitle: string;
  needsChangesDefaultNote: string;
  needsChangesLabel: string;
  savingLabel: string;
  canMarkNeedsChanges?: boolean;
  readOnlyCopy?: string;
}) {
  const [changesState, changesFormAction] = useActionState(needsChangesAction, initialFormState);

  return (
    <div className="space-y-6">
      <Card className="px-5 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{reviewStatusTitle}</p>
        <div className="mt-4 grid gap-3">
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{projectStatusTitle}</p>
            <p className="mt-2 font-semibold text-card-foreground">{statusLabel}</p>
          </div>
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{currentRevisionTitle}</p>
            <p className="mt-2 font-semibold text-card-foreground">{revisionLabel}</p>
          </div>
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{lastUpdatedTitle}</p>
            <p className="mt-2 font-semibold text-card-foreground">{lastUpdatedLabel}</p>
          </div>
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{revisionStateTitle}</p>
            <div className="mt-2">
              <Badge>{reviewStateLabel}</Badge>
            </div>
          </div>
        </div>
      </Card>

      <Card className="px-5 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{needsChangesCardTitle}</p>
        <form action={changesFormAction} className="mt-4 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">{reviewNoteLabel}</span>
            <textarea
              name="reviewNote"
              defaultValue={needsChangesDefaultNote}
              disabled={!canMarkNeedsChanges}
              className="min-h-24 w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm leading-7 outline-none transition focus:border-primary/50"
            />
          </label>
          {changesState.status === "error" ? (
            <p className="rounded-2xl border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {changesState.message}
            </p>
          ) : null}
          <SubmitButton
            label={needsChangesLabel}
            pendingLabel={savingLabel}
            variant="secondary"
            disabled={!canMarkNeedsChanges}
          />
          {!canMarkNeedsChanges && readOnlyCopy ? (
            <p className="text-sm text-muted-foreground">{readOnlyCopy}</p>
          ) : null}
        </form>
      </Card>
    </div>
  );
}
