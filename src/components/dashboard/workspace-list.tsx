import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { countryOptions } from "@/lib/workspaces/options";
import { formatDateLabel } from "@/lib/workspaces/utils";
import type { WorkspaceRecord } from "@/lib/workspaces/types";

function countryLabel(locale: Locale, value: WorkspaceRecord["country"]) {
  return countryOptions.find((option) => option.value === value)?.label[locale] ?? value;
}

export function WorkspaceList({
  locale,
  dictionary,
  workspaces,
}: {
  locale: Locale;
  dictionary: Dictionary;
  workspaces: WorkspaceRecord[];
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {dictionary.workspaceList.eyebrow}
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold text-foreground">
            {dictionary.workspaceList.title}
          </h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">{dictionary.workspaceList.copy}</p>
        </div>

        <Link href={`/${locale}/app/workspaces/new`} className={buttonStyles("primary")}>
          {dictionary.workspaceList.create}
        </Link>
      </div>

      {workspaces.length === 0 ? (
        <Card className="px-8 py-10 text-center">
          <h2 className="font-display text-2xl font-bold text-card-foreground">
            {dictionary.workspaceList.emptyTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
            {dictionary.workspaceList.emptyCopy}
          </p>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {workspaces.map((workspace) => (
            <Card key={workspace.id} className="px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-card-foreground">{workspace.name}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{workspace.companyName}</p>
                </div>
                <Badge>{countryLabel(locale, workspace.country)}</Badge>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-border bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {dictionary.workspaceList.category}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-card-foreground">
                    {workspace.businessCategory}
                  </p>
                </div>
                <div className="rounded-3xl border border-border bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {dictionary.workspaceList.languages}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-card-foreground">
                    {workspace.supportedLocales.join(" / ")}
                  </p>
                </div>
                <div className="rounded-3xl border border-border bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {dictionary.workspaceList.createdAt}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-card-foreground">
                    {formatDateLabel(workspace.createdAt, locale)}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <Link
                  href={`/${locale}/app/workspaces/${workspace.slug}`}
                  className={buttonStyles("secondary")}
                >
                  {dictionary.workspaceList.open}
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
