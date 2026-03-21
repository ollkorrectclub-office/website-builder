import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { projectTabRoute } from "@/lib/builder/routes";
import type {
  CodeRestoreTargetType,
  ProjectCodeFileRecord,
  ProjectCodeFileRevisionRecord,
} from "@/lib/builder/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

type CodeFileAction = (formData: FormData) => Promise<void>;

export function CodeRestoreReviewCard({
  locale,
  dictionary,
  workspaceSlug,
  projectSlug,
  selectedFile,
  currentRevision,
  targetType,
  targetRevision,
  targetRevisionNumber,
  targetContentMatchesCurrent,
  restoreAction,
  canRestore = true,
  readOnlyCopy,
}: {
  locale: Locale;
  dictionary: Dictionary;
  workspaceSlug: string;
  projectSlug: string;
  selectedFile: ProjectCodeFileRecord;
  currentRevision: ProjectCodeFileRevisionRecord | null;
  targetType: CodeRestoreTargetType;
  targetRevision: ProjectCodeFileRevisionRecord | null;
  targetRevisionNumber: number | null;
  targetContentMatchesCurrent: boolean;
  restoreAction: CodeFileAction;
  canRestore?: boolean;
  readOnlyCopy?: string;
}) {
  const cancelHref = `${projectTabRoute(locale, workspaceSlug, projectSlug, "code")}?file=${encodeURIComponent(selectedFile.path)}`;

  return (
    <Card className="px-5 py-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {dictionary.builder.code.restoreReviewTitle}
          </p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {targetType === "scaffold"
              ? dictionary.builder.code.restoreScaffoldCopy
              : dictionary.builder.code.restoreRevisionCopy}
          </p>
        </div>
        <Link href={cancelHref} className={buttonStyles("secondary")}>
          {dictionary.builder.code.cancelRestore}
        </Link>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.code.restoreCurrentRevision}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-card-foreground">
              {currentRevision
                ? `${dictionary.plan.revisionPrefix} ${currentRevision.revisionNumber}`
                : `${dictionary.plan.revisionPrefix} ${selectedFile.currentRevisionNumber}`}
            </p>
            <Badge>{dictionary.builder.code.currentRevision}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {currentRevision?.changeSummary ?? dictionary.builder.code.restoreCurrentStateCopy}
          </p>
        </div>

        <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.code.restoreTarget}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-card-foreground">
              {targetType === "scaffold"
                ? dictionary.builder.code.restoreSourceScaffold
                : `${dictionary.plan.revisionPrefix} ${targetRevisionNumber ?? "?"}`}
            </p>
            <Badge>
              {targetType === "scaffold"
                ? dictionary.builder.code.scaffoldRevision
                : targetRevision?.kind === "restored"
                  ? dictionary.builder.code.restoredRevision
                  : targetRevision?.kind === "synced"
                    ? dictionary.builder.code.syncedRevision
                    : targetRevision?.kind === "scaffold"
                      ? dictionary.builder.code.scaffoldRevision
                      : dictionary.builder.code.savedRevision}
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {targetType === "scaffold"
              ? `${dictionary.builder.code.restoreScaffoldTargetCopy} ${targetRevisionNumber ?? "?"}.`
              : targetRevision?.changeSummary ?? dictionary.builder.code.restoreRevisionTargetCopy}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-border bg-background/70 px-4 py-4">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          {dictionary.builder.code.restoreSafety}
        </p>
        <p className="mt-3 text-sm font-semibold text-card-foreground">
          {targetContentMatchesCurrent
            ? dictionary.builder.code.restoreAlreadyCurrent
            : dictionary.builder.code.restoreWritesNewRevision}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {targetContentMatchesCurrent
            ? dictionary.builder.code.restoreAlreadyCurrentCopy
            : dictionary.builder.code.restoreWritesNewRevisionCopy}
        </p>
      </div>

      {!targetContentMatchesCurrent ? (
        <form action={restoreAction} className="mt-5 flex flex-wrap items-center gap-3">
          <input type="hidden" name="filePath" value={selectedFile.path} />
          <input type="hidden" name="expectedRevisionNumber" value={selectedFile.currentRevisionNumber} />
          <input type="hidden" name="targetType" value={targetType} />
          <input
            type="hidden"
            name="targetRevisionId"
            value={targetType === "revision" ? targetRevision?.id ?? "" : ""}
          />
          <label className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-3 text-sm text-card-foreground">
            <input type="checkbox" name="confirmRestore" data-testid="code-restore-confirm" disabled={!canRestore} />
            <span>{dictionary.builder.code.confirmRestore}</span>
          </label>
          <Button data-testid="code-restore-submit" disabled={!canRestore}>
            {dictionary.builder.code.restoreAction}
          </Button>
        </form>
      ) : null}

      {!canRestore && readOnlyCopy ? (
        <p className="mt-5 text-sm leading-7 text-muted-foreground">{readOnlyCopy}</p>
      ) : null}
    </Card>
  );
}
