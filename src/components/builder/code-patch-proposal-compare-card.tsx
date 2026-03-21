"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CodeDiffView } from "@/components/builder/code-diff-view";
import { buildCodeDiff } from "@/lib/builder/code-diff";
import { projectTabRoute } from "@/lib/builder/routes";
import type { ProjectCodePatchProposalRecord } from "@/lib/builder/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import {
  externalModelProviderLabel,
  modelAdapterExecutionModeLabel,
  modelAdapterSelectionLabel,
  modelAdapterSourceLabel,
} from "@/lib/model-adapters/labels";
import type { ModelAdapterRunRecord } from "@/lib/model-adapters/types";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

function buildProposalCompareHref(input: {
  locale: Locale;
  workspaceSlug: string;
  projectSlug: string;
  filePath: string;
  proposalId?: string | null;
  proposalCompareId?: string | null;
  anchor?: string | null;
}) {
  const params = new URLSearchParams();
  params.set("file", input.filePath);

  if (input.proposalId) {
    params.set("proposal", input.proposalId);
  }

  if (input.proposalCompareId) {
    params.set("proposalCompare", input.proposalCompareId);
  }

  const query = params.toString();
  const anchor = input.anchor ? `#${input.anchor}` : "";

  return `${projectTabRoute(input.locale, input.workspaceSlug, input.projectSlug, "code")}?${query}${anchor}`;
}

function AdapterSummary({
  locale,
  dictionary,
  label,
  proposal,
  adapterRun,
}: {
  locale: Locale;
  dictionary: Dictionary;
  label: string;
  proposal: ProjectCodePatchProposalRecord;
  adapterRun: ModelAdapterRunRecord | null;
}) {
  return (
    <div className="rounded-[22px] border border-border bg-background/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-card-foreground">{label}</p>
        <Badge>{formatDateTimeLabel(proposal.createdAt, locale)}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {adapterRun ? <Badge>{modelAdapterSelectionLabel(dictionary, adapterRun.requestedSelection)}</Badge> : null}
        {adapterRun ? <Badge>{modelAdapterSourceLabel(dictionary, adapterRun.sourceType)}</Badge> : null}
        {adapterRun ? <Badge>{modelAdapterExecutionModeLabel(dictionary, adapterRun.executionMode)}</Badge> : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-border bg-card/70 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.providerTrace.actualAdapter}
          </p>
          <p className="mt-2 text-sm font-semibold text-card-foreground">
            {adapterRun?.executedAdapterKey ?? proposal.source}
          </p>
        </div>
        <div className="rounded-[18px] border border-border bg-card/70 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.providerTrace.provider}
          </p>
          <p className="mt-2 text-sm font-semibold text-card-foreground">
            {externalModelProviderLabel(dictionary, adapterRun?.providerKey ?? null)}
          </p>
        </div>
        <div className="rounded-[18px] border border-border bg-card/70 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.providerTrace.model}
          </p>
          <p className="mt-2 text-sm font-semibold text-card-foreground">
            {adapterRun?.modelName || dictionary.plan.providerTrace.none}
          </p>
        </div>
        <div className="rounded-[18px] border border-border bg-card/70 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.providerTrace.latency}
          </p>
          <p className="mt-2 text-sm font-semibold text-card-foreground">
            {adapterRun?.latencyMs !== null && adapterRun?.latencyMs !== undefined
              ? `${adapterRun.latencyMs} ${dictionary.plan.providerTrace.milliseconds}`
              : dictionary.plan.providerTrace.none}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-[18px] border border-border bg-card/70 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.code.patchSummary}
          </p>
          <p className="mt-2 text-sm leading-6 text-card-foreground">{proposal.changeSummary}</p>
        </div>
        <div className="rounded-[18px] border border-border bg-card/70 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.code.patchRequest}
          </p>
          <p className="mt-2 text-sm leading-6 text-card-foreground">{proposal.requestPrompt}</p>
        </div>
      </div>
    </div>
  );
}

export function CodePatchProposalCompareCard({
  locale,
  dictionary,
  workspaceSlug,
  projectSlug,
  filePath,
  selectedProposal,
  selectedAdapterRun,
  comparisonProposal,
  comparisonAdapterRun,
  selectedComparisonProposalId,
}: {
  locale: Locale;
  dictionary: Dictionary;
  workspaceSlug: string;
  projectSlug: string;
  filePath: string;
  selectedProposal: ProjectCodePatchProposalRecord | null;
  selectedAdapterRun: ModelAdapterRunRecord | null;
  comparisonProposal: ProjectCodePatchProposalRecord | null;
  comparisonAdapterRun: ModelAdapterRunRecord | null;
  selectedComparisonProposalId: string | null;
}) {
  if (!selectedProposal) {
    return null;
  }

  const reviewLeftHref = buildProposalCompareHref({
    locale,
    workspaceSlug,
    projectSlug,
    filePath,
    proposalId: selectedProposal.id,
    anchor: `proposal-${selectedProposal.id}`,
  });
  const reviewRightHref = comparisonProposal
    ? buildProposalCompareHref({
        locale,
        workspaceSlug,
        projectSlug,
        filePath,
        proposalId: comparisonProposal.id,
        anchor: `proposal-${comparisonProposal.id}`,
      })
    : null;
  const clearHref = buildProposalCompareHref({
    locale,
    workspaceSlug,
    projectSlug,
    filePath,
    proposalId: selectedProposal.id,
    anchor: `proposal-${selectedProposal.id}`,
  });

  return (
    <Card className="px-5 py-5" data-testid="patch-compare-card">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {dictionary.plan.adapterCompare.patchTitle}
      </p>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        {dictionary.plan.adapterCompare.patchCopy}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={reviewLeftHref}
          className={buttonStyles("secondary")}
          data-testid="patch-compare-review-left"
        >
          {dictionary.plan.adapterCompare.reviewLeft}
        </Link>
        {reviewRightHref ? (
          <Link
            href={reviewRightHref}
            className={buttonStyles("secondary")}
            data-testid="patch-compare-review-right"
          >
            {dictionary.plan.adapterCompare.reviewRight}
          </Link>
        ) : null}
        {selectedComparisonProposalId ? (
          <Link
            href={clearHref}
            className={buttonStyles("secondary")}
            data-testid="patch-compare-clear"
          >
            {dictionary.plan.adapterCompare.clearPairing}
          </Link>
        ) : null}
      </div>

      {!comparisonProposal ? (
        <div className="mt-4 rounded-[22px] border border-dashed border-border bg-background/60 p-4">
          <p className="text-sm text-muted-foreground">{dictionary.plan.adapterCompare.noComparison}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <AdapterSummary
              locale={locale}
              dictionary={dictionary}
              label={dictionary.plan.adapterCompare.leftRun}
              proposal={selectedProposal}
              adapterRun={selectedAdapterRun}
            />
            <AdapterSummary
              locale={locale}
              dictionary={dictionary}
              label={dictionary.plan.adapterCompare.rightRun}
              proposal={comparisonProposal}
              adapterRun={comparisonAdapterRun}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-[20px] border border-border bg-background/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.adapterCompare.fileContext}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">{filePath}</p>
            </div>
            <div className="rounded-[20px] border border-border bg-background/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.builder.code.proposalBaseRevision}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">
                {comparisonProposal.baseRevisionNumber ?? dictionary.plan.providerTrace.none} →{" "}
                {selectedProposal.baseRevisionNumber ?? dictionary.plan.providerTrace.none}
              </p>
            </div>
            <div className="rounded-[20px] border border-border bg-background/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.adapterCompare.outputChanged}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">
                {comparisonProposal.proposedContent === selectedProposal.proposedContent
                  ? dictionary.plan.adapterCompare.noOutputChanges
                  : dictionary.builder.code.diffTitle}
              </p>
            </div>
            <div className="rounded-[20px] border border-border bg-background/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.adapterCompare.traceMetadata}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">
                {comparisonAdapterRun || selectedAdapterRun
                  ? dictionary.plan.adapterCompare.available
                  : dictionary.plan.providerTrace.none}
              </p>
            </div>
          </div>

          <CodeDiffView
            dictionary={dictionary}
            title={dictionary.plan.adapterCompare.patchDiffTitle}
            lines={buildCodeDiff(comparisonProposal.proposedContent, selectedProposal.proposedContent)}
          />
        </div>
      )}
    </Card>
  );
}
