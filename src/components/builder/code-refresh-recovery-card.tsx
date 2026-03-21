import Link from "next/link";

import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  CodeFileSyncRecord,
  CodeRefreshCandidateRecord,
  ProjectCodeFileRecord,
} from "@/lib/builder/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

type CodeRefreshAction = (formData: FormData) => Promise<void>;

function recoveryStateLabel(dictionary: Dictionary, record: CodeFileSyncRecord) {
  if (!record.needsSync) {
    return dictionary.builder.code.recoveryCurrentState;
  }

  return record.requiresConfirmation
    ? dictionary.builder.code.recoveryBlockedState
    : dictionary.builder.code.recoverySafeState;
}

function recoveryStateCopy(dictionary: Dictionary, record: CodeFileSyncRecord) {
  if (!record.needsSync) {
    return dictionary.builder.code.recoveryCurrentCopy;
  }

  return record.requiresConfirmation
    ? dictionary.builder.code.recoveryBlockedCopy
    : dictionary.builder.code.recoverySafeCopy;
}

export function CodeRefreshRecoveryCard({
  locale,
  dictionary,
  selectedFile,
  syncRecord,
  refreshCandidate,
  pendingProposalCount,
  staleProposalCount,
  restoreReviewHref,
  safeRefreshAction,
  canRestore = true,
  readOnlyCopy,
}: {
  locale: Locale;
  dictionary: Dictionary;
  selectedFile: ProjectCodeFileRecord;
  syncRecord: CodeFileSyncRecord;
  refreshCandidate: CodeRefreshCandidateRecord | null;
  pendingProposalCount: number;
  staleProposalCount: number;
  restoreReviewHref: string;
  safeRefreshAction: CodeRefreshAction;
  canRestore?: boolean;
  readOnlyCopy?: string;
}) {
  const canUseSafeRefresh =
    syncRecord.needsSync &&
    syncRecord.safeToRefresh &&
    selectedFile.editPolicy === "locked";

  return (
    <Card className="px-5 py-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {dictionary.builder.code.recoveryTitle}
          </p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {dictionary.builder.code.recoveryCopy}
          </p>
          <p className="mt-3 text-lg font-semibold text-card-foreground">
            {recoveryStateLabel(dictionary, syncRecord)}
          </p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {recoveryStateCopy(dictionary, syncRecord)}
          </p>
        </div>
        <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4 text-sm leading-6 text-card-foreground">
          {refreshCandidate
            ? formatDateTimeLabel(refreshCandidate.sourceVisualUpdatedAt, locale)
            : formatDateTimeLabel(selectedFile.updatedAt, locale)}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.code.recoveryCurrentRevision}
          </p>
          <p className="mt-2 text-lg font-semibold text-card-foreground">{selectedFile.currentRevisionNumber}</p>
        </div>
        <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.code.recoverySourceRevision}
          </p>
          <p className="mt-2 text-lg font-semibold text-card-foreground">
            {refreshCandidate?.sourceRevisionNumber ?? 0}
          </p>
        </div>
        <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.code.recoveryPendingProposals}
          </p>
          <p className="mt-2 text-lg font-semibold text-card-foreground">{pendingProposalCount}</p>
        </div>
        <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.code.recoveryStaleProposals}
          </p>
          <p className="mt-2 text-lg font-semibold text-card-foreground">{staleProposalCount}</p>
        </div>
      </div>

      {syncRecord.needsSync ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {canUseSafeRefresh ? (
            <form action={safeRefreshAction}>
              <input type="hidden" name="filePath" value={selectedFile.path} />
              <button
                type="submit"
                data-testid="code-safe-refresh"
                className={buttonStyles("secondary")}
                disabled={!canRestore}
              >
                {dictionary.builder.guardrails.refreshSafe}
              </button>
            </form>
          ) : (
            <Link
              href={restoreReviewHref}
              data-testid="code-review-restore"
              aria-disabled={!canRestore}
              className={buttonStyles(syncRecord.requiresConfirmation ? "primary" : "secondary")}
            >
              {dictionary.builder.code.reviewRestore}
            </Link>
          )}
        </div>
      ) : null}

      {!canRestore && readOnlyCopy ? (
        <p className="mt-5 text-sm leading-7 text-muted-foreground">{readOnlyCopy}</p>
      ) : null}
    </Card>
  );
}
