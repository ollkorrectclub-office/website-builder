"use client";

import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ProjectCodePatchProposalRecord } from "@/lib/builder/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import {
  externalModelProviderLabel,
  modelAdapterExecutionModeLabel,
  modelAdapterOutcomeLabel,
  modelAdapterSelectionLabel,
  modelAdapterSourceLabel,
} from "@/lib/model-adapters/labels";
import type { ModelAdapterRunRecord, ModelAdapterTracePreviewRecord } from "@/lib/model-adapters/types";
import { initialFormState } from "@/lib/workspaces/form-state";
import type { FormState } from "@/lib/workspaces/form-state";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

type PatchProposalAction = (state: FormState, formData: FormData) => Promise<FormState>;

function TraceBlock({
  label,
  preview,
  emptyLabel,
}: {
  label: string;
  preview: ModelAdapterTracePreviewRecord | null;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-[22px] border border-border bg-background/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        {preview ? (
          <Badge>
            {preview.format.toUpperCase()} · {preview.charCount}
            {preview.truncated ? "+" : ""}
          </Badge>
        ) : null}
      </div>
      <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-card-foreground">
        {preview?.preview || emptyLabel}
      </pre>
    </div>
  );
}

function outcomeTone(run: ModelAdapterRunRecord) {
  if (run.status === "failed") {
    return "border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200";
  }

  if (run.executionMode === "fallback") {
    return "border-amber-300/50 bg-amber-100/70 text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-200";
  }

  if (run.sourceType === "external_model") {
    return "border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200";
  }

  return "border-border bg-background/80 text-muted-foreground";
}

function RetryPatchForm({
  dictionary,
  selectedProposal,
  adapterRun,
  action,
  canRetry,
  readOnlyCopy,
}: {
  dictionary: Dictionary;
  selectedProposal: ProjectCodePatchProposalRecord;
  adapterRun: ModelAdapterRunRecord;
  action: PatchProposalAction;
  canRetry: boolean;
  readOnlyCopy?: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="mt-5 space-y-3">
      <input type="hidden" name="filePath" value={selectedProposal.filePath} />
      <input type="hidden" name="requestPrompt" value={selectedProposal.requestPrompt} />
      <input type="hidden" name="requestedSelection" value={adapterRun.requestedSelection} />
      <input type="hidden" name="retryOfRunId" value={adapterRun.id} />
      <SubmitButton
        label={
          adapterRun.requestedSelection === "external_model"
            ? dictionary.builder.code.retryProposalExternal
            : dictionary.builder.code.retryProposalDeterministic
        }
        pendingLabel={dictionary.builder.code.retryProposalPending}
        variant="secondary"
        disabled={!canRetry}
        testId="code-proposal-trace-retry"
      />
      {!canRetry && readOnlyCopy ? (
        <p className="text-sm text-muted-foreground">{readOnlyCopy}</p>
      ) : null}
      {state.status === "error" ? (
        <p className="rounded-2xl border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function CodePatchProposalTraceCard({
  locale,
  dictionary,
  selectedProposal,
  adapterRun,
  createPatchProposalAction,
  canRetry = true,
  readOnlyCopy,
}: {
  locale: Locale;
  dictionary: Dictionary;
  selectedProposal: ProjectCodePatchProposalRecord | null;
  adapterRun: ModelAdapterRunRecord | null;
  createPatchProposalAction: PatchProposalAction;
  canRetry?: boolean;
  readOnlyCopy?: string;
}) {
  if (!adapterRun || !selectedProposal) {
    return (
      <Card className="px-5 py-5" data-testid="code-proposal-trace-card">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {dictionary.builder.code.patchTrace.title}
        </p>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          {dictionary.builder.code.patchTrace.copy}
        </p>
        <div className="mt-4 rounded-[22px] border border-dashed border-border bg-background/60 p-4">
          <p className="text-sm text-muted-foreground">{dictionary.builder.code.patchTrace.noRun}</p>
        </div>
      </Card>
    );
  }

  const trace = adapterRun.trace;
  const usage = trace?.usage;
  const completedAt = adapterRun.completedAt ?? adapterRun.startedAt;

  return (
    <Card className="px-5 py-5" data-testid="code-proposal-trace-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {dictionary.builder.code.patchTrace.title}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {dictionary.builder.code.patchTrace.copy}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{modelAdapterSelectionLabel(dictionary, adapterRun.requestedSelection)}</Badge>
          <Badge>{modelAdapterSourceLabel(dictionary, adapterRun.sourceType)}</Badge>
          <Badge>{modelAdapterExecutionModeLabel(dictionary, adapterRun.executionMode)}</Badge>
          <Badge className={outcomeTone(adapterRun)}>{modelAdapterOutcomeLabel(dictionary, adapterRun)}</Badge>
        </div>
      </div>

      <div className="mt-4 rounded-[24px] border border-border bg-background/70 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[20px] border border-border bg-card/70 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.providerTrace.requestedAdapter}
            </p>
            <p className="mt-2 text-sm font-semibold text-card-foreground">{adapterRun.requestedAdapterKey}</p>
          </div>
          <div className="rounded-[20px] border border-border bg-card/70 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.providerTrace.actualAdapter}
            </p>
            <p className="mt-2 text-sm font-semibold text-card-foreground">{adapterRun.executedAdapterKey}</p>
          </div>
          <div className="rounded-[20px] border border-border bg-card/70 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.providerTrace.provider}
            </p>
            <p className="mt-2 text-sm font-semibold text-card-foreground">
              {externalModelProviderLabel(dictionary, adapterRun.providerKey)}
            </p>
          </div>
          <div className="rounded-[20px] border border-border bg-card/70 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.providerTrace.model}
            </p>
            <p className="mt-2 text-sm font-semibold text-card-foreground">
              {adapterRun.modelName || dictionary.plan.providerTrace.none}
            </p>
          </div>
          <div className="rounded-[20px] border border-border bg-card/70 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.providerTrace.latency}
            </p>
            <p className="mt-2 text-sm font-semibold text-card-foreground">
              {adapterRun.latencyMs !== null
                ? `${adapterRun.latencyMs} ${dictionary.plan.providerTrace.milliseconds}`
                : dictionary.plan.providerTrace.none}
            </p>
          </div>
          <div className="rounded-[20px] border border-border bg-card/70 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.providerTrace.responseStatus}
            </p>
            <p className="mt-2 text-sm font-semibold text-card-foreground">
              {trace?.responseStatus || dictionary.plan.providerTrace.none}
            </p>
          </div>
          <div className="rounded-[20px] border border-border bg-card/70 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.providerTrace.responseId}
            </p>
            <p className="mt-2 text-sm font-semibold text-card-foreground">
              {trace?.responseId || dictionary.plan.providerTrace.none}
            </p>
          </div>
          <div className="rounded-[20px] border border-border bg-card/70 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.providerTrace.recordedAt}
            </p>
            <p className="mt-2 text-sm font-semibold text-card-foreground">
              {formatDateTimeLabel(completedAt, locale)}
            </p>
          </div>
          <div className="rounded-[20px] border border-border bg-card/70 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.providerTrace.attemptNumber}
            </p>
            <p className="mt-2 text-sm font-semibold text-card-foreground">{adapterRun.attemptNumber}</p>
          </div>
          <div className="rounded-[20px] border border-border bg-card/70 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.providerTrace.retryOf}
            </p>
            <p className="mt-2 text-sm font-semibold text-card-foreground">
              {adapterRun.retryOfRunId || dictionary.plan.providerTrace.none}
            </p>
          </div>
        </div>

        {adapterRun.fallbackReason ? (
          <div className="mt-4 rounded-[20px] border border-amber-300/50 bg-amber-50/80 p-4 text-sm leading-7 text-amber-950 dark:border-amber-600/30 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="text-xs uppercase tracking-[0.16em] text-amber-800/80 dark:text-amber-200/80">
              {dictionary.plan.providerTrace.fallbackReason}
            </p>
            <p className="mt-2">{adapterRun.fallbackReason}</p>
          </div>
        ) : null}

        {adapterRun.errorMessage ? (
          <div className="mt-4 rounded-[20px] border border-red-300/50 bg-red-50/80 p-4 text-sm leading-7 text-red-950 dark:border-red-600/30 dark:bg-red-950/30 dark:text-red-100">
            <p className="text-xs uppercase tracking-[0.16em] text-red-800/80 dark:text-red-200/80">
              {dictionary.plan.providerTrace.failureDetails}
            </p>
            <p className="mt-2">{adapterRun.errorMessage}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4">
        <TraceBlock
          label={dictionary.plan.providerTrace.promptTrace}
          preview={trace?.prompt ?? null}
          emptyLabel={dictionary.plan.providerTrace.none}
        />
        <TraceBlock
          label={dictionary.plan.providerTrace.inputTrace}
          preview={trace?.input ?? null}
          emptyLabel={dictionary.plan.providerTrace.none}
        />
        <TraceBlock
          label={dictionary.plan.providerTrace.outputTrace}
          preview={trace?.output ?? null}
          emptyLabel={dictionary.plan.providerTrace.none}
        />
        {trace?.error ? (
          <TraceBlock
            label={dictionary.plan.providerTrace.errorTrace}
            preview={trace.error}
            emptyLabel={dictionary.plan.providerTrace.none}
          />
        ) : null}
      </div>

      {usage ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[20px] border border-border bg-background/70 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.providerTrace.inputTokens}
            </p>
            <p className="mt-2 text-sm font-semibold text-card-foreground">
              {usage.inputTokens ?? dictionary.plan.providerTrace.none}
            </p>
          </div>
          <div className="rounded-[20px] border border-border bg-background/70 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.providerTrace.outputTokens}
            </p>
            <p className="mt-2 text-sm font-semibold text-card-foreground">
              {usage.outputTokens ?? dictionary.plan.providerTrace.none}
            </p>
          </div>
          <div className="rounded-[20px] border border-border bg-background/70 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.providerTrace.totalTokens}
            </p>
            <p className="mt-2 text-sm font-semibold text-card-foreground">
              {usage.totalTokens ?? dictionary.plan.providerTrace.none}
            </p>
          </div>
        </div>
      ) : null}

      <RetryPatchForm
        dictionary={dictionary}
        selectedProposal={selectedProposal}
        adapterRun={adapterRun}
        action={createPatchProposalAction}
        canRetry={canRetry}
        readOnlyCopy={readOnlyCopy}
      />
    </Card>
  );
}
