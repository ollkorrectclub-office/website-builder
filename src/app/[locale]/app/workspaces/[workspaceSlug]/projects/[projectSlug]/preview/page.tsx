import Link from "next/link";
import { notFound } from "next/navigation";

import { recordProjectPreviewTimelineState } from "@/lib/builder/audit-repository";
import { BuilderSyncGuardrailCard } from "@/components/builder/builder-sync-guardrail-card";
import { RuntimePreviewRenderer } from "@/components/builder/runtime-preview-renderer";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildRuntimePreviewBundle } from "@/lib/builder/runtime-preview";
import { getProjectCodeBundle } from "@/lib/builder/code-repository";
import { projectTabRoute } from "@/lib/builder/routes";
import { getProjectVisualBundle } from "@/lib/builder/repository";
import { getProjectGenerationBundle } from "@/lib/generation/repository";
import type { PreviewDevice } from "@/lib/builder/types";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { workspaceRoleLabels } from "@/lib/workspaces/options";
import { cn } from "@/lib/utils";

const deviceWidths: Record<PreviewDevice, string> = {
  desktop: "max-w-[1100px]",
  tablet: "max-w-[820px]",
  mobile: "max-w-[430px]",
};

function buildPreviewHref(
  locale: string,
  workspaceSlug: string,
  projectSlug: string,
  selectedRoutePath: string,
  selectedPageId: string,
  device: PreviewDevice,
  expanded: boolean,
) {
  const params = [
    `route=${encodeURIComponent(selectedRoutePath)}`,
    `page=${encodeURIComponent(selectedPageId)}`,
    `device=${encodeURIComponent(device)}`,
  ];

  if (expanded) {
    params.push("expanded=1");
  }

  return `${projectTabRoute(locale, workspaceSlug, projectSlug, "preview")}?${params.join("&")}`;
}

export default async function ProjectPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; workspaceSlug: string; projectSlug: string }>;
  searchParams: Promise<{ route?: string; page?: string; device?: string; expanded?: string }>;
}) {
  const { locale, workspaceSlug, projectSlug } = await params;
  const { route, page, device, expanded } = await searchParams;
  const dictionary = getDictionary(locale);
  const [bundle, codeBundle, generationBundle] = await Promise.all([
    getProjectVisualBundle(workspaceSlug, projectSlug),
    getProjectCodeBundle(workspaceSlug, projectSlug),
    getProjectGenerationBundle(workspaceSlug, projectSlug),
  ]);

  if (!bundle) {
    notFound();
  }

  const runtimeBundle = buildRuntimePreviewBundle({
    locale: locale as Locale,
    visualBundle: bundle,
    codeBundle,
    generationBundle,
    routeQuery: route ?? null,
    pageQuery: page ?? null,
  });
  const selectedRoute = runtimeBundle.selectedRoute;
  const selectedPage = runtimeBundle.selectedPage;
  const previewDevice = (
    device === "tablet" || device === "mobile" || device === "desktop"
      ? device
      : "desktop"
  ) as PreviewDevice;
  const visibleSections = runtimeBundle.visibleSections;
  const hiddenSectionCount = runtimeBundle.hiddenSectionCount;
  const visualHref = projectTabRoute(locale, workspaceSlug, projectSlug, "visual");
  const previewHref = selectedRoute && selectedPage
    ? buildPreviewHref(
        locale,
        workspaceSlug,
        projectSlug,
        selectedRoute.browserPath,
        selectedPage.id,
        previewDevice,
        expanded === "1",
      )
    : projectTabRoute(locale, workspaceSlug, projectSlug, "preview");

  if (selectedPage && selectedRoute) {
    await recordProjectPreviewTimelineState({
      workspaceSlug,
      projectSlug,
      pageId: selectedPage.id,
      pageTitle: selectedPage.title,
      routePath: selectedRoute.browserPath,
      generationRunId: runtimeBundle.generationRun?.id ?? null,
      runtimeSource: runtimeBundle.source,
      device: previewDevice,
      expanded: expanded === "1",
    });
  }

  return (
    selectedPage && selectedRoute ? (
      <div className="space-y-6">
        <Card className="px-6 py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {dictionary.builder.preview.title}
              </p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {dictionary.builder.preview.realCopy}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {(["desktop", "tablet", "mobile"] as PreviewDevice[]).map((item) => (
                <Link
                  key={item}
                  href={buildPreviewHref(
                    locale,
                    workspaceSlug,
                    projectSlug,
                    selectedRoute.browserPath,
                    selectedPage.id,
                    item,
                    expanded === "1",
                  )}
                  className={previewDevice === item ? buttonStyles("primary") : buttonStyles("secondary")}
                >
                  {dictionary.builder.preview.devices[item]}
                </Link>
              ))}
              {expanded === "1" ? (
                <Link
                  href={buildPreviewHref(
                    locale,
                    workspaceSlug,
                    projectSlug,
                    selectedRoute.browserPath,
                    selectedPage.id,
                    previewDevice,
                    false,
                  )}
                  className={buttonStyles("secondary")}
                >
                  {dictionary.builder.preview.exitExpanded}
                </Link>
              ) : (
                <a
                  href={buildPreviewHref(
                    locale,
                    workspaceSlug,
                    projectSlug,
                    selectedRoute.browserPath,
                    selectedPage.id,
                    previewDevice,
                    true,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonStyles("secondary")}
                >
                  {dictionary.builder.preview.openExpanded}
                </a>
              )}
            </div>
          </div>

          {runtimeBundle.routes.length > 1 ? (
            <div
              className="mt-6 rounded-[24px] border border-border bg-background/70 p-4"
              data-testid="preview-route-navigation"
            >
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.builder.preview.routeNavigation}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {runtimeBundle.routes.map((item) => {
                  const active = item.pageId === selectedPage.id;

                  return (
                    <Link
                      key={item.pageId}
                      href={buildPreviewHref(
                        locale,
                        workspaceSlug,
                        projectSlug,
                        item.browserPath,
                        item.pageId,
                        previewDevice,
                        expanded === "1",
                      )}
                      className={active ? buttonStyles("primary") : buttonStyles("secondary")}
                    >
                      <span className="flex flex-col text-left">
                        <span>{item.title}</span>
                        <span className="text-[11px] opacity-70">{item.browserPath}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="px-5 py-5" data-testid="preview-read-only-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-card-foreground">
                {dictionary.builder.preview.readOnlyTitle}
              </p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                {dictionary.builder.preview.readOnlyCopy}
              </p>
            </div>
            <Badge>
              {workspaceRoleLabels[bundle.membership.role][locale as Locale]}
            </Badge>
          </div>
        </Card>

        {codeBundle ? (
          <BuilderSyncGuardrailCard
            title={dictionary.builder.guardrails.previewTitle}
            copy={
              codeBundle.codeSyncState.staleFileCount > 0
                ? dictionary.builder.guardrails.previewWarningCopy
                : dictionary.builder.guardrails.previewCurrentCopy
            }
            tone={codeBundle.codeSyncState.staleFileCount > 0 ? "warning" : "current"}
            toneLabel={
              codeBundle.codeSyncState.staleFileCount > 0
                ? dictionary.builder.guardrails.warningBadge
                : dictionary.builder.guardrails.currentBadge
            }
            metrics={[
              {
                label: dictionary.builder.guardrails.linkedFiles,
                value: codeBundle.codeSyncState.linkedFileCount,
              },
              {
                label: dictionary.builder.guardrails.safeRefreshable,
                value: codeBundle.codeSyncState.safeRefreshableFileCount,
              },
              {
                label: dictionary.builder.guardrails.visualManaged,
                value: codeBundle.codeSyncState.visualManagedFileCount,
              },
              {
                label: dictionary.builder.guardrails.confirmationNeeded,
                value: codeBundle.codeSyncState.blockedFileCount,
              },
            ]}
            actions={
              <Link
                href={projectTabRoute(locale, workspaceSlug, projectSlug, "code")}
                className={buttonStyles("secondary")}
              >
                {dictionary.builder.guardrails.openCode}
              </Link>
            }
          />
        ) : null}

        <Card className="overflow-hidden px-6 py-6">
          <div className="flex flex-col gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {dictionary.builder.preview.frameLabel}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-2xl font-bold text-card-foreground">{selectedRoute.title}</p>
                <span className="text-sm text-muted-foreground">
                  {dictionary.builder.preview.devices[previewDevice]}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{selectedRoute.browserPath}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>
                {dictionary.builder.preview.visibleSections}: {visibleSections.length}
              </span>
              <span>
                {dictionary.builder.preview.hiddenSections}: {hiddenSectionCount}
              </span>
            </div>
          </div>

          <div className="mt-6 rounded-[32px] border border-border bg-background/60 p-5">
            <div className={cn("mx-auto w-full transition-all duration-200", deviceWidths[previewDevice])}>
              <RuntimePreviewRenderer
                projectName={bundle.project.name}
                selectedRoute={selectedRoute}
                routes={runtimeBundle.routes}
                sections={visibleSections}
                tokens={runtimeBundle.themeTokens}
                badgeLabel={
                  runtimeBundle.source === "accepted_generation_target"
                    ? dictionary.builder.preview.renderedFromRuntime
                    : dictionary.builder.preview.renderedFromVisual
                }
                emptyTitle={dictionary.builder.preview.emptyTitle}
                emptyCopy={dictionary.builder.preview.emptyCopy}
              />
            </div>
          </div>

          {expanded === "1" ? null : (
            <div className="mt-6 grid gap-3 lg:grid-cols-3">
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {dictionary.builder.preview.currentRoute}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">{selectedRoute.browserPath}</p>
              </div>
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {dictionary.builder.preview.runtimeSource}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground" data-testid="preview-runtime-source">
                  {runtimeBundle.source === "accepted_generation_target"
                    ? dictionary.builder.preview.runtimeFromGeneration
                    : dictionary.builder.preview.runtimeFromVisual}
                </p>
              </div>
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {dictionary.builder.preview.routeFile}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">
                  {runtimeBundle.routeFile.path ?? dictionary.builder.preview.notAvailable}
                </p>
              </div>
            </div>
          )}
        </Card>

        {expanded === "1" ? null : (
          <Card className="px-6 py-6">
            <div className="grid gap-3 lg:grid-cols-4">
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {dictionary.builder.preview.visualRevision}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">
                  {dictionary.plan.revisionPrefix} {runtimeBundle.visualPinnedRevisionNumber}
                </p>
              </div>
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {dictionary.builder.preview.codeRevision}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">
                  {runtimeBundle.codePinnedRevisionNumber
                    ? `${dictionary.plan.revisionPrefix} ${runtimeBundle.codePinnedRevisionNumber}`
                    : dictionary.builder.preview.notAvailable}
                </p>
              </div>
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {dictionary.builder.preview.layoutFile}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">
                  {runtimeBundle.layoutFile.path ?? dictionary.builder.preview.notAvailable}
                </p>
              </div>
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {dictionary.builder.preview.themeSummary}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">
                  {runtimeBundle.themeTokens.primaryColor} · {runtimeBundle.themeTokens.surfaceColor}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {dictionary.builder.preview.contentFile}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">
                  {runtimeBundle.contentFile.path ?? dictionary.builder.preview.notAvailable}
                </p>
              </div>
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {dictionary.builder.preview.themeFiles}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">
                  {runtimeBundle.themeStylesFile.path ?? dictionary.builder.preview.notAvailable}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {runtimeBundle.themeTokensFile.path ?? dictionary.builder.preview.notAvailable}
                </p>
              </div>
              <div className="rounded-[24px] border border-border bg-background/70 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {dictionary.builder.preview.runtimeState}
                </p>
                <p className="mt-2 text-sm font-semibold text-card-foreground">
                  {runtimeBundle.codeMatchesRuntimeRevision
                    ? dictionary.builder.preview.runtimeAligned
                    : dictionary.builder.preview.runtimeAwaitingCode}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    ) : (
      <Card className="px-6 py-8">
        <p className="font-display text-2xl font-bold text-card-foreground">
          {dictionary.builder.preview.emptyTitle}
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          {dictionary.builder.preview.emptyCopy}
        </p>
        <div className="mt-6">
          <Link href={visualHref} className={buttonStyles("secondary")}>
            {dictionary.builder.visual.title}
          </Link>
        </div>
        <p className="mt-6 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          {previewHref}
        </p>
      </Card>
    )
  );
}
