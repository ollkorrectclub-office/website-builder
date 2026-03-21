import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { projectTabRoute } from "@/lib/builder/routes";
import type { ProjectCodePatchProposalRecord } from "@/lib/builder/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import {
  modelAdapterExecutionModeLabel,
  modelAdapterOutcomeLabel,
  modelAdapterSelectionLabel,
  modelAdapterSourceLabel,
} from "@/lib/model-adapters/labels";
import type { ModelAdapterRunRecord } from "@/lib/model-adapters/types";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

function buildProposalHref(
  input: {
    locale: Locale;
    workspaceSlug: string;
    projectSlug: string;
    filePath: string;
    proposalId: string;
    proposalCompareId?: string | null;
  },
) {
  const params = new URLSearchParams();
  params.set("file", input.filePath);
  params.set("proposal", input.proposalId);

  if (input.proposalCompareId) {
    params.set("proposalCompare", input.proposalCompareId);
  }

  return `${projectTabRoute(input.locale, input.workspaceSlug, input.projectSlug, "code")}?${params.toString()}`;
}

function sameProposalContext(
  left: ProjectCodePatchProposalRecord,
  right: ProjectCodePatchProposalRecord,
) {
  return (
    left.filePath === right.filePath &&
    left.requestPrompt === right.requestPrompt &&
    left.baseRevisionId === right.baseRevisionId
  );
}

function proposalStatusLabel(dictionary: Dictionary, status: ProjectCodePatchProposalRecord["status"]) {
  if (status === "pending") {
    return dictionary.builder.code.proposalPending;
  }

  if (status === "applied") {
    return dictionary.builder.code.proposalApplied;
  }

  if (status === "rejected") {
    return dictionary.builder.code.proposalRejected;
  }

  return dictionary.builder.code.proposalStale;
}

function proposalSourceLabel(dictionary: Dictionary, source: ProjectCodePatchProposalRecord["source"]) {
  if (source === "external_patch_adapter_v1") {
    return dictionary.builder.code.proposalSourceExternal;
  }

  if (source === "mock_assistant") {
    return dictionary.builder.code.proposalSourceMock;
  }

  return source;
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

export function CodePatchProposalHistory({
  locale,
  dictionary,
  workspaceSlug,
  projectSlug,
  filePath,
  proposals,
  adapterRuns,
  selectedProposalId,
  selectedProposalComparisonId,
}: {
  locale: Locale;
  dictionary: Dictionary;
  workspaceSlug: string;
  projectSlug: string;
  filePath: string;
  proposals: ProjectCodePatchProposalRecord[];
  adapterRuns: ModelAdapterRunRecord[];
  selectedProposalId: string | null;
  selectedProposalComparisonId: string | null;
}) {
  const selectedProposal =
    proposals.find((proposal) => proposal.id === selectedProposalId) ?? null;

  return (
    <Card className="px-5 py-5">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {dictionary.builder.code.patchHistory}
      </p>
      <div className="mt-4 space-y-3">
        {proposals.length > 0 ? (
          proposals.map((proposal) => {
            const selected = proposal.id === selectedProposalId;
            const compared = proposal.id === selectedProposalComparisonId;
            const adapterRun =
              adapterRuns.find((run) => run.linkedEntityId === proposal.id) ?? null;
            const canCompare =
              selectedProposal !== null &&
              proposal.id !== selectedProposal.id &&
              sameProposalContext(selectedProposal, proposal);

            return (
              <div
                key={proposal.id}
                className={[
                  "rounded-[24px] border px-4 py-4",
                  selected
                    ? "border-primary/40 bg-primary/10"
                    : compared
                      ? "border-amber-300/50 bg-amber-100/50 dark:border-amber-600/40 dark:bg-amber-950/25"
                      : "border-border bg-background/70",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-card-foreground">{proposal.title}</p>
                  <Badge>{proposalStatusLabel(dictionary, proposal.status)}</Badge>
                  <Badge>{proposalSourceLabel(dictionary, proposal.source)}</Badge>
                  {adapterRun ? <Badge>{modelAdapterSelectionLabel(dictionary, adapterRun.requestedSelection)}</Badge> : null}
                  {adapterRun ? <Badge>{modelAdapterExecutionModeLabel(dictionary, adapterRun.executionMode)}</Badge> : null}
                  {adapterRun ? <Badge className={outcomeTone(adapterRun)}>{modelAdapterOutcomeLabel(dictionary, adapterRun)}</Badge> : null}
                  {proposal.archivedAt ? <Badge>{dictionary.builder.code.proposalArchived}</Badge> : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {formatDateTimeLabel(proposal.createdAt, locale)}
                </p>
                <p className="mt-3 text-sm leading-7 text-card-foreground">
                  {proposal.changeSummary}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {proposal.baseRevisionNumber !== null ? (
                    <span>
                      {dictionary.builder.code.proposalBaseRevision}: {proposal.baseRevisionNumber}
                    </span>
                  ) : null}
                  {adapterRun ? (
                    <span>
                      {dictionary.builder.code.proposalAdapterSource}:{" "}
                      {modelAdapterSourceLabel(dictionary, adapterRun.sourceType)}
                    </span>
                  ) : null}
                  {proposal.status === "stale" && proposal.invalidatedByRevisionNumber !== null ? (
                    <span>
                      {dictionary.builder.code.proposalInvalidatedRevision}: {proposal.invalidatedByRevisionNumber}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {proposal.requestPrompt}
                </p>
                {proposal.resolutionNote ? (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {proposal.resolutionNote}
                  </p>
                ) : null}
                {proposal.archivedAt ? (
                  <div className="mt-3 rounded-[20px] border border-border bg-background/60 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {dictionary.builder.code.proposalArchived}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-card-foreground">
                      {proposal.archiveReason ?? dictionary.builder.code.archiveProposalDefault}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {formatDateTimeLabel(proposal.archivedAt, locale)}
                    </p>
                  </div>
                ) : null}
                <div className="mt-3">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={buildProposalHref({
                        locale,
                        workspaceSlug,
                        projectSlug,
                        filePath,
                        proposalId: proposal.id,
                      })}
                      className={selected ? buttonStyles("primary") : buttonStyles("secondary")}
                    >
                      {dictionary.plan.adapterCompare.reviewCurrent}
                    </Link>
                    {canCompare ? (
                      <Link
                        href={buildProposalHref({
                          locale,
                          workspaceSlug,
                          projectSlug,
                          filePath,
                          proposalId: selectedProposal.id,
                          proposalCompareId: proposal.id,
                        })}
                        className={buttonStyles("secondary")}
                        data-testid="patch-proposal-compare"
                      >
                        {dictionary.plan.adapterCompare.compareWithSelected}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-[24px] border border-dashed border-border bg-background/50 px-4 py-6 text-sm leading-7 text-muted-foreground">
            {dictionary.builder.code.patchHistoryEmpty}
          </div>
        )}
      </div>
    </Card>
  );
}
