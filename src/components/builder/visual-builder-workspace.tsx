import Link from "next/link";

import { BuilderSyncGuardrailCard } from "@/components/builder/builder-sync-guardrail-card";
import { VisualRefreshDiffCard } from "@/components/builder/visual-refresh-diff-card";
import { VisualRefreshQueueCard } from "@/components/builder/visual-refresh-queue-card";
import { visualSectionTypeLabels } from "@/lib/builder/options";
import type {
  CodeSyncState,
  ProjectBuilderRefreshQueueItemRecord,
  ProjectVisualBundle,
  VisualRefreshDiffRecord,
} from "@/lib/builder/types";
import type { GenerationRunRecord } from "@/lib/generation/types";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VisualPageRenderer } from "@/components/builder/visual-page-renderer";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

type BuilderAction = (formData: FormData) => Promise<void>;
type RegenerateAction = () => Promise<void>;

function buildVisualHref(
  locale: Locale,
  workspaceSlug: string,
  projectSlug: string,
  pageId: string,
  sectionId?: string,
) {
  const params = new URLSearchParams();
  params.set("page", pageId);

  if (sectionId) {
    params.set("section", sectionId);
  }

  return `/${locale}/app/workspaces/${workspaceSlug}/projects/${projectSlug}/visual?${params.toString()}`;
}

export function VisualBuilderWorkspace({
  locale,
  dictionary,
  bundle,
  selectedPageId,
  selectedSectionId,
  updateSectionAction,
  moveUpAction,
  moveDownAction,
  updateThemeTokensAction,
  regenerateAction,
  acceptQueueAction,
  deferQueueAction,
  activeQueueItem,
  queueGenerationRun,
  latestGenerationRun,
  queueReplacementHref,
  queueDiff,
  codeSyncState,
}: {
  locale: Locale;
  dictionary: Dictionary;
  bundle: ProjectVisualBundle;
  selectedPageId: string;
  selectedSectionId: string | null;
  updateSectionAction: BuilderAction;
  moveUpAction: BuilderAction;
  moveDownAction: BuilderAction;
  updateThemeTokensAction: BuilderAction;
  regenerateAction: RegenerateAction;
  acceptQueueAction: BuilderAction;
  deferQueueAction: BuilderAction;
  activeQueueItem: ProjectBuilderRefreshQueueItemRecord | null;
  queueGenerationRun: GenerationRunRecord | null;
  latestGenerationRun: GenerationRunRecord | null;
  queueReplacementHref: string | null;
  queueDiff: VisualRefreshDiffRecord | null;
  codeSyncState: CodeSyncState | null;
}) {
  const canEditVisual = bundle.projectPermissions.canIntakeVisual;
  const selectedPage =
    bundle.visualPages.find((page) => page.id === selectedPageId) ?? bundle.visualPages[0];
  const pageSections = bundle.visualSections
    .filter((section) => section.pageId === selectedPage.id)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const visibleSections = pageSections.filter((section) => section.isVisible);
  const selectedSection =
    pageSections.find((section) => section.id === selectedSectionId) ?? pageSections[0] ?? null;
  const selectedSectionIndex = selectedSection
    ? pageSections.findIndex((section) => section.id === selectedSection.id)
    : -1;
  const canMoveUp = selectedSectionIndex > 0;
  const canMoveDown = selectedSectionIndex > -1 && selectedSectionIndex < pageSections.length - 1;

  return (
    <div className="space-y-6">
      <Card className="px-6 py-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.builder.visual.title}
            </p>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {dictionary.builder.visual.realCopy}
            </p>
          </div>

          <form action={regenerateAction}>
            <button
              type="submit"
              className={buttonStyles("secondary")}
              disabled={!canEditVisual}
              data-testid="visual-regenerate"
            >
              {dictionary.builder.visual.regenerate}
            </button>
          </form>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-4">
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.builder.visual.sourceRevision}
            </p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">
              {dictionary.plan.revisionPrefix} {bundle.syncState.sourceRevisionNumber}
            </p>
          </div>
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.builder.visual.latestPlanRevision}
            </p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">
              {dictionary.plan.revisionPrefix} {bundle.syncState.latestRevisionNumber}
            </p>
          </div>
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.builder.visual.manualChanges}
            </p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">
              {bundle.syncState.hasManualChanges
                ? dictionary.builder.visual.manualChangesYes
                : dictionary.builder.visual.manualChangesNo}
            </p>
          </div>
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.builder.visual.syncState}
            </p>
            <p className="mt-2 text-lg font-semibold text-card-foreground">
              {bundle.syncState.needsRegeneration
                ? dictionary.builder.visual.syncOutdated
                : dictionary.builder.visual.syncCurrent}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.builder.visual.syncRulesTitle}
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {dictionary.builder.visual.syncRules.map((rule) => (
              <div key={rule} className="rounded-[20px] border border-border bg-card/80 px-4 py-4 text-sm leading-7 text-card-foreground">
                {rule}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {!canEditVisual ? (
        <Card className="px-5 py-5">
          <p className="text-sm leading-7 text-muted-foreground">{dictionary.builder.visual.permissionCopy}</p>
        </Card>
      ) : null}

      {activeQueueItem ? (
        <>
          {queueDiff ? (
            <VisualRefreshDiffCard
              dictionary={dictionary}
              diff={queueDiff}
            />
          ) : null}
          <VisualRefreshQueueCard
            locale={locale}
            dictionary={dictionary}
            bundle={bundle}
            queueItem={activeQueueItem}
            queueGenerationRun={queueGenerationRun}
            latestGenerationRun={latestGenerationRun}
            replacementHref={queueReplacementHref}
            selectedPageId={selectedPage.id}
            selectedSectionId={selectedSection?.id ?? null}
            acceptAction={acceptQueueAction}
            deferAction={deferQueueAction}
            canIntake={canEditVisual}
            readOnlyCopy={dictionary.builder.visual.permissionCopy}
          />
        </>
      ) : null}

      {codeSyncState ? (
        <BuilderSyncGuardrailCard
          title={dictionary.builder.guardrails.visualTitle}
          copy={
            codeSyncState.staleFileCount > 0
              ? dictionary.builder.guardrails.visualWarningCopy
              : dictionary.builder.guardrails.visualCurrentCopy
          }
          tone={codeSyncState.staleFileCount > 0 ? "warning" : "current"}
          toneLabel={
            codeSyncState.staleFileCount > 0
              ? dictionary.builder.guardrails.warningBadge
              : dictionary.builder.guardrails.currentBadge
          }
          metrics={[
            {
              label: dictionary.builder.guardrails.linkedFiles,
              value: codeSyncState.linkedFileCount,
            },
            {
              label: dictionary.builder.guardrails.safeRefreshable,
              value: codeSyncState.safeRefreshableFileCount,
            },
            {
              label: dictionary.builder.guardrails.visualManaged,
              value: codeSyncState.visualManagedFileCount,
            },
            {
              label: dictionary.builder.guardrails.confirmationNeeded,
              value: codeSyncState.blockedFileCount,
            },
          ]}
          actions={
            <Link
              href={`/${locale}/app/workspaces/${bundle.workspace.slug}/projects/${bundle.project.slug}/code`}
              className={buttonStyles("secondary")}
            >
              {dictionary.builder.guardrails.openCode}
            </Link>
          }
        />
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card className="px-5 py-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.builder.visual.pagesTitle}
            </p>
            <div className="mt-4 space-y-3">
              {bundle.visualPages.map((page) => {
                const active = page.id === selectedPage.id;
                const firstSectionId = bundle.visualSections.find((section) => section.pageId === page.id)?.id;

                return (
                  <Link
                    key={page.id}
                    href={buildVisualHref(locale, bundle.workspace.slug, bundle.project.slug, page.id, firstSectionId)}
                    className={active
                      ? "block rounded-[24px] border border-primary/40 bg-primary/10 px-4 py-4"
                      : "block rounded-[24px] border border-border bg-background/70 px-4 py-4 transition hover:border-primary/30"}
                  >
                    <p className="text-sm font-semibold text-card-foreground">{page.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{page.slug}</p>
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card className="px-5 py-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.builder.visual.sectionsTitle}
            </p>
            <div className="mt-4 space-y-3">
              {pageSections.map((section, index) => {
                const active = section.id === selectedSection?.id;

                return (
                  <Link
                    key={section.id}
                    href={buildVisualHref(locale, bundle.workspace.slug, bundle.project.slug, selectedPage.id, section.id)}
                    className={active
                      ? "block rounded-[24px] border border-primary/40 bg-primary/10 px-4 py-4"
                      : "block rounded-[24px] border border-border bg-background/70 px-4 py-4 transition hover:border-primary/30"}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-card-foreground">{section.label}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {visualSectionTypeLabels[section.sectionType][locale]}
                        </p>
                      </div>
                      <Badge>{index + 1}</Badge>
                    </div>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {section.isVisible
                        ? dictionary.builder.visual.visible
                        : dictionary.builder.visual.hidden}
                    </p>
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {dictionary.builder.visual.canvas}
              </p>
              <p className="mt-2 text-lg font-semibold text-card-foreground">{selectedPage.title}</p>
            </div>
            <Badge>{dictionary.builder.visual.liveCanvas}</Badge>
          </div>

          <div className="mt-6">
            <VisualPageRenderer
              page={selectedPage}
              sections={visibleSections}
              tokens={bundle.visualState.themeTokens}
              selectedSectionId={selectedSection?.id}
              sectionHref={(sectionId) =>
                buildVisualHref(locale, bundle.workspace.slug, bundle.project.slug, selectedPage.id, sectionId)
              }
              badgeLabel={dictionary.builder.visual.liveCanvas}
              emptyTitle={dictionary.builder.preview.emptyTitle}
              emptyCopy={dictionary.builder.preview.emptyCopy}
            />
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="px-5 py-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.builder.visual.sectionInspector}
            </p>

            {selectedSection ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-[24px] border border-border bg-background/70 p-4">
                  <p className="font-semibold text-card-foreground">{selectedSection.label}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {visualSectionTypeLabels[selectedSection.sectionType][locale]}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {dictionary.builder.lastUpdated}: {formatDateTimeLabel(selectedSection.updatedAt, locale)}
                  </p>
                </div>

                <div className="flex gap-3">
                  <form action={moveUpAction}>
                    <input type="hidden" name="visualStateId" value={bundle.visualState.id} />
                    <input type="hidden" name="sectionId" value={selectedSection.id} />
                    <input type="hidden" name="selectedPageId" value={selectedPage.id} />
                    <input type="hidden" name="selectedSectionId" value={selectedSection.id} />
                    <button
                      type="submit"
                      className={buttonStyles("secondary")}
                      disabled={!canEditVisual || !canMoveUp}
                    >
                      {dictionary.builder.visual.moveUp}
                    </button>
                  </form>
                  <form action={moveDownAction}>
                    <input type="hidden" name="visualStateId" value={bundle.visualState.id} />
                    <input type="hidden" name="sectionId" value={selectedSection.id} />
                    <input type="hidden" name="selectedPageId" value={selectedPage.id} />
                    <input type="hidden" name="selectedSectionId" value={selectedSection.id} />
                    <button
                      type="submit"
                      className={buttonStyles("secondary")}
                      disabled={!canEditVisual || !canMoveDown}
                    >
                      {dictionary.builder.visual.moveDown}
                    </button>
                  </form>
                </div>

                <form action={updateSectionAction} className="space-y-4">
                  <input type="hidden" name="visualStateId" value={bundle.visualState.id} />
                  <input type="hidden" name="sectionId" value={selectedSection.id} />
                  <input type="hidden" name="selectedPageId" value={selectedPage.id} />
                  <input type="hidden" name="selectedSectionId" value={selectedSection.id} />

                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-card-foreground">{dictionary.builder.visual.sectionLabel}</span>
                    <input
                      name="label"
                      defaultValue={selectedSection.label}
                      disabled={!canEditVisual}
                      data-testid="visual-section-label"
                      className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/50"
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-card-foreground">{dictionary.builder.visual.sectionTitleInput}</span>
                    <input
                      name="title"
                      defaultValue={selectedSection.title}
                      disabled={!canEditVisual}
                      className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/50"
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-card-foreground">{dictionary.builder.visual.contentBody}</span>
                    <textarea
                      name="body"
                      defaultValue={selectedSection.contentPayload.body ?? ""}
                      disabled={!canEditVisual}
                      className="min-h-24 w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm leading-7 outline-none transition focus:border-primary/50"
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-card-foreground">{dictionary.builder.visual.contentItems}</span>
                    <textarea
                      name="items"
                      defaultValue={(selectedSection.contentPayload.items ?? []).join("\n")}
                      disabled={!canEditVisual}
                      className="min-h-24 w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm leading-7 outline-none transition focus:border-primary/50"
                    />
                  </label>

                  <label className="inline-flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-card-foreground">
                    <input
                      type="checkbox"
                      name="isVisible"
                      defaultChecked={selectedSection.isVisible}
                      disabled={!canEditVisual}
                    />
                    <span>{dictionary.builder.visual.sectionVisibility}</span>
                  </label>

                  <button type="submit" className={buttonStyles("primary")} disabled={!canEditVisual}>
                    {dictionary.builder.visual.saveSection}
                  </button>
                </form>
              </div>
            ) : (
              <div className="mt-4 rounded-[24px] border border-dashed border-border bg-background/70 p-4">
                <p className="font-semibold text-card-foreground">{dictionary.builder.visual.noSectionSelected}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{dictionary.builder.visual.noSectionCopy}</p>
              </div>
            )}
          </Card>

          <Card className="px-5 py-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {dictionary.builder.visual.themeTokensTitle}
            </p>
            <form action={updateThemeTokensAction} className="mt-4 space-y-4">
              <input type="hidden" name="visualStateId" value={bundle.visualState.id} />
              <input type="hidden" name="selectedPageId" value={selectedPage.id} />
              <input type="hidden" name="selectedSectionId" value={selectedSection?.id ?? ""} />

              {([
                ["primaryColor", dictionary.builder.visual.primaryColor],
                ["secondaryColor", dictionary.builder.visual.secondaryColor],
                ["backgroundColor", dictionary.builder.visual.backgroundColor],
                ["surfaceColor", dictionary.builder.visual.surfaceColor],
                ["textColor", dictionary.builder.visual.textColor],
              ] as const).map(([name, label]) => (
                <label key={name} className="flex items-center justify-between gap-4 rounded-[24px] border border-border bg-background/70 px-4 py-3">
                  <span className="text-sm font-semibold text-card-foreground">{label}</span>
                  <input
                    type="color"
                    name={name}
                    defaultValue={bundle.visualState.themeTokens[name]}
                    disabled={!canEditVisual}
                    className="h-10 w-16 rounded-lg border border-border bg-transparent"
                  />
                </label>
              ))}

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-card-foreground">{dictionary.builder.visual.headingFontLabel}</span>
                <input
                  name="headingFontLabel"
                  defaultValue={bundle.visualState.themeTokens.headingFontLabel}
                  disabled={!canEditVisual}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/50"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-card-foreground">{dictionary.builder.visual.radiusScale}</span>
                <input
                  name="radiusScale"
                  defaultValue={bundle.visualState.themeTokens.radiusScale}
                  disabled={!canEditVisual}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/50"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-card-foreground">{dictionary.builder.visual.spacingScale}</span>
                <input
                  name="spacingScale"
                  defaultValue={bundle.visualState.themeTokens.spacingScale}
                  disabled={!canEditVisual}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/50"
                />
              </label>

              <button type="submit" className={buttonStyles("primary")} disabled={!canEditVisual}>
                {dictionary.builder.visual.saveTokens}
              </button>
            </form>
          </Card>
        </div>
      </section>
    </div>
  );
}
