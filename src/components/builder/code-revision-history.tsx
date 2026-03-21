import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { projectTabRoute } from "@/lib/builder/routes";
import type { ProjectCodeFileRevisionRecord } from "@/lib/builder/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

function buildCodeRoute(
  locale: Locale,
  workspaceSlug: string,
  projectSlug: string,
  filePath: string,
  options: {
    compareRevisionId?: string | null;
    proposalId?: string | null;
    restoreRevisionId?: string | null;
    restoreScaffold?: boolean;
  } = {},
) {
  const url = new URL(projectTabRoute(locale, workspaceSlug, projectSlug, "code"), "https://builder.local");
  url.searchParams.set("file", filePath);

  if (options.compareRevisionId) {
    url.searchParams.set("compare", options.compareRevisionId);
  }

  if (options.proposalId) {
    url.searchParams.set("proposal", options.proposalId);
  }

  if (options.restoreRevisionId) {
    url.searchParams.set("restoreRevision", options.restoreRevisionId);
  }

  if (options.restoreScaffold) {
    url.searchParams.set("restoreScaffold", "1");
  }

  return `${url.pathname}${url.search}`;
}

function buildProposalHref(
  locale: Locale,
  workspaceSlug: string,
  projectSlug: string,
  filePath: string,
  proposalId: string,
) {
  return buildCodeRoute(locale, workspaceSlug, projectSlug, filePath, {
    proposalId,
  });
}

export function CodeRevisionHistory({
  locale,
  dictionary,
  workspaceSlug,
  projectSlug,
  filePath,
  revisions,
  currentRevisionId,
  selectedCompareRevisionId,
  selectedRestoreRevisionId,
  selectedRestoreScaffold,
  canRestoreScaffold,
  canRestoreRevision = true,
}: {
  locale: Locale;
  dictionary: Dictionary;
  workspaceSlug: string;
  projectSlug: string;
  filePath: string;
  revisions: ProjectCodeFileRevisionRecord[];
  currentRevisionId: string;
  selectedCompareRevisionId: string | null;
  selectedRestoreRevisionId: string | null;
  selectedRestoreScaffold: boolean;
  canRestoreScaffold: boolean;
  canRestoreRevision?: boolean;
}) {
  return (
    <Card className="px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {dictionary.builder.code.revisionHistory}
        </p>
        {canRestoreScaffold && canRestoreRevision ? (
          <Link
            href={buildCodeRoute(locale, workspaceSlug, projectSlug, filePath, {
              restoreScaffold: true,
            })}
            className={selectedRestoreScaffold ? buttonStyles("primary") : buttonStyles("secondary")}
          >
            {dictionary.builder.code.restoreScaffold}
          </Link>
        ) : null}
      </div>
      <div className="mt-4 space-y-3">
        {revisions.map((revision) => {
          const current = revision.id === currentRevisionId;
          const comparing = revision.id === selectedCompareRevisionId;
          const restoring = revision.id === selectedRestoreRevisionId;

          return (
            <div key={revision.id} className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-card-foreground">
                  {dictionary.plan.revisionPrefix} {revision.revisionNumber}
                </p>
                {current ? <Badge>{dictionary.builder.code.currentRevision}</Badge> : null}
                <Badge>
                  {revision.kind === "scaffold"
                    ? dictionary.builder.code.scaffoldRevision
                    : revision.kind === "restored"
                      ? dictionary.builder.code.restoredRevision
                      : revision.kind === "synced"
                        ? dictionary.builder.code.syncedRevision
                        : dictionary.builder.code.savedRevision}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {formatDateTimeLabel(revision.createdAt, locale)}
              </p>
              <p className="mt-2 text-sm leading-7 text-card-foreground">
                {revision.changeSummary}
              </p>
              {revision.sourceProposalId ? (
                <div className="mt-3 rounded-[20px] border border-border bg-background/60 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {dictionary.builder.code.revisionLinkedProposal}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-card-foreground">
                    {revision.sourceProposalTitle ?? dictionary.builder.code.reviewProposal}
                  </p>
                  <div className="mt-3">
                    <Link
                      href={buildProposalHref(
                        locale,
                        workspaceSlug,
                        projectSlug,
                        filePath,
                        revision.sourceProposalId,
                      )}
                      className={buttonStyles("secondary")}
                    >
                      {dictionary.builder.code.viewLinkedProposal}
                    </Link>
                  </div>
                </div>
              ) : null}
              {revision.restoreSource ? (
                <div className="mt-3 rounded-[20px] border border-border bg-background/60 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {dictionary.builder.code.restoreOrigin}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-card-foreground">
                    {revision.restoreSource === "scaffold"
                      ? dictionary.builder.code.restoreSourceScaffold
                      : `${dictionary.builder.code.restoreSourceRevision} ${revision.restoredFromRevisionNumber ?? "?"}`}
                  </p>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-3">
                <Link
                  href={buildCodeRoute(locale, workspaceSlug, projectSlug, filePath, {
                    compareRevisionId: revision.id,
                  })}
                  className={comparing ? buttonStyles("primary") : buttonStyles("secondary")}
                >
                  {dictionary.builder.code.compareRevision}
                </Link>
                {!current && canRestoreRevision ? (
                  <Link
                    href={buildCodeRoute(locale, workspaceSlug, projectSlug, filePath, {
                      restoreRevisionId: revision.id,
                    })}
                    className={restoring ? buttonStyles("primary") : buttonStyles("secondary")}
                  >
                    {dictionary.builder.code.restoreRevision}
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
