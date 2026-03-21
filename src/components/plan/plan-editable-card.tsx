"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState, type FormState } from "@/lib/workspaces/form-state";
import type { StructuredPlanDataModel } from "@/lib/workspaces/types";

type SectionAction = (state: FormState, formData: FormData) => Promise<FormState>;

interface PlanEditableCardProps {
  id: string;
  title: string;
  description: string;
  action: SectionAction;
  inputName: string;
  inputLabel: string;
  helperText: string;
  defaultValue: string;
  displayKind: "text" | "list" | "dataModels";
  displayText?: string;
  displayItems?: string[];
  displayDataModels?: StructuredPlanDataModel[];
  changeSummary: string;
  editLabel: string;
  cancelLabel: string;
  saveLabel: string;
  savingLabel: string;
  readOnly?: boolean;
  readOnlyCopy?: string;
}

export function PlanEditableCard({
  id,
  title,
  description,
  action,
  inputName,
  inputLabel,
  helperText,
  defaultValue,
  displayKind,
  displayText,
  displayItems,
  displayDataModels,
  changeSummary,
  editLabel,
  cancelLabel,
  saveLabel,
  savingLabel,
  readOnly = false,
  readOnlyCopy,
}: PlanEditableCardProps) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <Card id={id} className="scroll-mt-28 px-6 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-display text-2xl font-bold text-card-foreground">{title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{description}</p>
        </div>
        <Button
          type="button"
          variant={editing ? "ghost" : "secondary"}
          onClick={() => setEditing((value) => !value)}
          disabled={readOnly}
        >
          {editing ? cancelLabel : editLabel}
        </Button>
      </div>

      <div className="mt-6">
        {displayKind === "text" ? (
          <p className="rounded-[24px] border border-border bg-background/70 p-5 text-sm leading-8 text-card-foreground">
            {displayText}
          </p>
        ) : null}

        {displayKind === "list" ? (
          <div className="grid gap-3">
            {(displayItems ?? []).map((item) => (
              <div
                key={item}
                className="rounded-[24px] border border-border bg-background/70 px-4 py-4 text-sm leading-7 text-card-foreground"
              >
                {item}
              </div>
            ))}
          </div>
        ) : null}

        {displayKind === "dataModels" ? (
          <div className="grid gap-3">
            {(displayDataModels ?? []).map((item) => (
              <div key={item.name} className="rounded-[24px] border border-border bg-background/70 p-4">
                <p className="font-semibold text-card-foreground">{item.name}</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {readOnly && readOnlyCopy ? (
        <p className="mt-6 rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
          {readOnlyCopy}
        </p>
      ) : null}

      {editing && !readOnly ? (
        <form action={formAction} className="mt-6 space-y-4">
          <input type="hidden" name="changeSummary" value={changeSummary} />
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">{inputLabel}</span>
            <textarea
              name={inputName}
              defaultValue={defaultValue}
              className="min-h-32 w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm leading-7 outline-none transition focus:border-primary/50"
            />
          </label>
          <p className="text-sm leading-7 text-muted-foreground">{helperText}</p>

          {state.status === "error" ? (
            <p className="rounded-2xl border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {state.message}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <SubmitButton label={saveLabel} pendingLabel={savingLabel} />
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              {cancelLabel}
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
