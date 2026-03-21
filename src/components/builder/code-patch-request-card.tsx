"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { initialFormState } from "@/lib/workspaces/form-state";
import type { FormState } from "@/lib/workspaces/form-state";

type PatchProposalAction = (state: FormState, formData: FormData) => Promise<FormState>;

export function CodePatchRequestCard({
  dictionary,
  filePath,
  canManageProposals,
  canRequestProposal,
  stateTitle,
  stateCopy,
  action,
}: {
  dictionary: Dictionary;
  filePath: string;
  canManageProposals: boolean;
  canRequestProposal: boolean;
  stateTitle: string;
  stateCopy: string;
  action: PatchProposalAction;
}) {
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <Card className="px-5 py-5">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {dictionary.builder.code.patchAssistantTitle}
      </p>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        {dictionary.builder.code.patchAssistantCopy}
      </p>
      <div className="mt-4 rounded-[24px] border border-border bg-background/70 px-4 py-4">
        <p className="text-sm font-semibold text-card-foreground">{stateTitle}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{stateCopy}</p>
      </div>
      <form action={formAction} className="mt-4 space-y-3">
        <input type="hidden" name="filePath" value={filePath} />
        <label className="block">
          <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.code.patchRequest}
          </span>
          <textarea
            name="requestPrompt"
            placeholder={dictionary.builder.code.patchPromptPlaceholder}
            disabled={!canManageProposals}
            className="mt-3 min-h-[132px] w-full rounded-[28px] border border-border bg-background/80 px-5 py-4 text-sm leading-7 text-card-foreground outline-none transition focus:border-primary/40"
          />
        </label>
        {state.status === "error" ? (
          <p className="rounded-2xl border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {state.message}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            name="requestedSelection"
            value="deterministic_internal"
            variant="secondary"
            disabled={!canRequestProposal}
            data-testid="code-generate-proposal"
          >
            {dictionary.builder.code.generateProposalDeterministic}
          </Button>
          <Button
            type="submit"
            name="requestedSelection"
            value="external_model"
            variant="secondary"
            disabled={!canRequestProposal}
            data-testid="code-generate-proposal-external"
          >
            {dictionary.builder.code.generateProposalExternal}
          </Button>
        </div>
      </form>
    </Card>
  );
}
