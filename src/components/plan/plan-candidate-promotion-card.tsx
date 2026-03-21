"use client";

import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import type { PlanCandidateComparisonRecord } from "@/lib/builder/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { revisionStateLabels } from "@/lib/workspaces/options";
import type { FormState } from "@/lib/workspaces/form-state";
import type { PlanRevisionRecord } from "@/lib/workspaces/types";
import { formatDateTimeLabel, revisionTone } from "@/lib/workspaces/utils";
import { initialFormState } from "@/lib/workspaces/form-state";

type ReviewAction = (state: FormState, formData: FormData) => Promise<FormState>;

function listPreview(items: string[]) {
  return items.slice(0, 4);
}

export function PlanCandidatePromotionCard({
  locale,
  dictionary,
  approvedRevision,
  candidateRevision,
  comparison,
  promoteAction,
  canPromote = true,
  readOnlyCopy,
}: {
  locale: Locale;
  dictionary: Dictionary;
  approvedRevision: PlanRevisionRecord | null;
  candidateRevision: PlanRevisionRecord | null;
  comparison: PlanCandidateComparisonRecord | null;
  promoteAction: ReviewAction;
  canPromote?: boolean;
  readOnlyCopy?: string;
}) {
  const [state, formAction] = useActionState(promoteAction, initialFormState);

  return (
    <Card id="candidate-promotion" className="px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {dictionary.plan.candidatePromotion.eyebrow}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {dictionary.plan.candidatePromotion.copy}
          </p>
        </div>
        {candidateRevision ? (
          <Badge className={revisionTone(candidateRevision.state)}>
            {revisionStateLabels[candidateRevision.state][locale]}
          </Badge>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.candidatePromotion.approvedRevision}
          </p>
          <p className="mt-2 text-lg font-semibold text-card-foreground">
            {approvedRevision
              ? `${dictionary.plan.revisionPrefix} ${approvedRevision.revisionNumber}`
              : dictionary.plan.candidatePromotion.noApprovedRevision}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {approvedRevision
              ? formatDateTimeLabel(approvedRevision.createdAt, locale)
              : dictionary.plan.candidatePromotion.firstApprovalHint}
          </p>
        </div>
        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.candidatePromotion.latestCandidate}
          </p>
          <p className="mt-2 text-lg font-semibold text-card-foreground">
            {candidateRevision
              ? `${dictionary.plan.revisionPrefix} ${candidateRevision.revisionNumber}`
              : dictionary.plan.candidatePromotion.noCandidate}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {candidateRevision
              ? formatDateTimeLabel(candidateRevision.createdAt, locale)
              : dictionary.plan.candidatePromotion.noCandidateCopy}
          </p>
        </div>
      </div>

      {comparison && comparison.changedSections.length > 0 ? (
        <div className="mt-5 space-y-3">
          <div className="rounded-[22px] border border-border bg-card/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.candidatePromotion.changedSections}
            </p>
            <p className="mt-2 text-sm font-semibold text-card-foreground">
              {comparison.changedSections.length} {dictionary.plan.candidatePromotion.sectionDeltaCount}
            </p>
          </div>

          {comparison.changedSections.map((change) => {
            const sectionTitle = dictionary.plan.sections[change.key].title;

            return (
              <div
                key={change.key}
                className="rounded-[22px] border border-border bg-background/70 p-4"
              >
                <p className="font-semibold text-card-foreground">{sectionTitle}</p>

                {change.kind === "text" ? (
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-[18px] border border-border bg-card/70 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {dictionary.plan.runDelta.before}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        {change.beforeText || dictionary.plan.candidatePromotion.none}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-primary/20 bg-primary/5 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {dictionary.plan.runDelta.after}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-card-foreground">
                        {change.afterText || dictionary.plan.candidatePromotion.none}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-[18px] border border-border bg-card/70 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {dictionary.plan.runDelta.before}
                      </p>
                      <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                        {listPreview(change.beforeItems).map((item) => (
                          <p key={`${change.key}-before-${item}`} className="leading-6">
                            {item}
                          </p>
                        ))}
                        {change.beforeItems.length === 0 ? (
                          <p>{dictionary.plan.candidatePromotion.none}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-primary/20 bg-primary/5 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {dictionary.plan.runDelta.after}
                      </p>
                      <div className="mt-2 space-y-2 text-sm text-card-foreground">
                        {listPreview(change.afterItems).map((item) => (
                          <p key={`${change.key}-after-${item}`} className="leading-6">
                            {item}
                          </p>
                        ))}
                        {change.afterItems.length === 0 ? (
                          <p>{dictionary.plan.candidatePromotion.none}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}

                {change.kind === "list" && (change.addedItems.length > 0 || change.removedItems.length > 0) ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {change.addedItems.map((item) => (
                      <Badge
                        key={`${change.key}-added-${item}`}
                        className="border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200"
                      >
                        + {item}
                      </Badge>
                    ))}
                    {change.removedItems.map((item) => (
                      <Badge
                        key={`${change.key}-removed-${item}`}
                        className="border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200"
                      >
                        - {item}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : comparison ? (
        <div className="mt-5 rounded-[22px] border border-border bg-background/70 p-4">
          <p className="text-sm leading-7 text-muted-foreground">
            {dictionary.plan.candidatePromotion.noVisibleChanges}
          </p>
        </div>
      ) : null}

      {candidateRevision ? (
        <form action={formAction} className="mt-5 space-y-4">
          <input type="hidden" name="candidateRevisionId" value={candidateRevision.id} />
          <input
            type="hidden"
            name="candidateRevisionNumber"
            value={String(candidateRevision.revisionNumber)}
          />
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">
              {dictionary.plan.reviewNote}
            </span>
            <textarea
              name="reviewNote"
              defaultValue={dictionary.plan.candidatePromotion.defaultPromotionNote}
              className="min-h-24 w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm leading-7 outline-none transition focus:border-primary/50"
            />
          </label>
          {state.status === "error" ? (
            <p className="rounded-2xl border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {state.message}
            </p>
          ) : null}
          <SubmitButton
            label={dictionary.plan.candidatePromotion.promoteAction}
            pendingLabel={dictionary.plan.candidatePromotion.promoting}
            testId="candidate-promote-submit"
            disabled={!canPromote}
          />
          {!canPromote && readOnlyCopy ? (
            <p className="text-sm text-muted-foreground">{readOnlyCopy}</p>
          ) : null}
        </form>
      ) : null}
    </Card>
  );
}
