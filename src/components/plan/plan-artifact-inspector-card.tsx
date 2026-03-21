import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import {
  plannerSourceLabel,
  plannerStatusLabel,
  plannerTriggerLabel,
} from "@/lib/planner/labels";
import type { PlannerArtifactRecord, PlannerRunRecord } from "@/lib/planner/types";
import { capabilityOptions, countryOptions, projectTypeOptions } from "@/lib/workspaces/options";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

function badgeList(items: string[], emptyLabel: string) {
  if (items.length === 0) {
    return (
      <Badge className="border-dashed border-border bg-transparent text-muted-foreground">
        {emptyLabel}
      </Badge>
    );
  }

  return items.map((item) => (
    <Badge key={item} className="border-border bg-card/70 text-card-foreground">
      {item}
    </Badge>
  ));
}

function findArtifact(artifacts: PlannerArtifactRecord[], artifactType: PlannerArtifactRecord["artifactType"]) {
  return artifacts.find((artifact) => artifact.artifactType === artifactType) ?? null;
}

function capabilityLabels(locale: Locale, rawValue: unknown) {
  const values =
    typeof rawValue === "object" && rawValue
      ? Object.entries(rawValue as Record<string, boolean>)
          .filter(([, enabled]) => enabled)
          .map(([key]) => capabilityOptions.find((option) => option.key === key)?.label[locale] ?? key)
      : [];

  return values;
}

export function PlanArtifactInspectorCard({
  locale,
  dictionary,
  selectedRun,
  selectedArtifacts,
}: {
  locale: Locale;
  dictionary: Dictionary;
  selectedRun: PlannerRunRecord | null;
  selectedArtifacts: PlannerArtifactRecord[];
}) {
  if (!selectedRun) {
    return (
      <Card className="px-5 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {dictionary.plan.artifactInspector.title}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">{dictionary.plan.artifactInspector.empty}</p>
      </Card>
    );
  }

  const normalizedBrief = findArtifact(selectedArtifacts, "normalized_brief");
  const planningSignals = findArtifact(selectedArtifacts, "planning_signals");
  const planPayload = findArtifact(selectedArtifacts, "plan_payload");
  const normalizedBriefPayload =
    (normalizedBrief?.payload as Record<string, unknown> | undefined) ?? selectedRun.inputSnapshot;
  const planPayloadData =
    (planPayload?.payload as Record<string, unknown> | undefined) ?? selectedRun.outputPlan ?? {};
  const selectedProjectType =
    projectTypeOptions.find((option) => option.value === normalizedBriefPayload.projectType)?.label[locale] ??
    String(normalizedBriefPayload.projectType ?? "");
  const selectedCountry =
    countryOptions.find((option) => option.value === normalizedBriefPayload.country)?.label[locale] ??
    String(normalizedBriefPayload.country ?? "");
  const briefTargetUsers = Array.isArray(normalizedBriefPayload.targetUsers)
    ? normalizedBriefPayload.targetUsers.map(String)
    : [];
  const briefPages = Array.isArray(normalizedBriefPayload.desiredPagesFeatures)
    ? normalizedBriefPayload.desiredPagesFeatures.map(String)
    : [];
  const briefLocales = Array.isArray(normalizedBriefPayload.supportedLocales)
    ? normalizedBriefPayload.supportedLocales.map((value) => (value === "sq" ? "Shqip" : "English"))
    : [];
  const primaryLocaleLabel =
    normalizedBriefPayload.primaryLocale === "sq"
      ? "Shqip"
      : normalizedBriefPayload.primaryLocale === "en"
        ? "English"
        : String(normalizedBriefPayload.primaryLocale ?? "");
  const briefCapabilities = capabilityLabels(locale, normalizedBriefPayload.capabilities);
  const planPages = Array.isArray(planPayloadData.pageMap) ? planPayloadData.pageMap.map(String) : [];
  const planFeatures = Array.isArray(planPayloadData.featureList) ? planPayloadData.featureList.map(String) : [];
  const planIntegrations = Array.isArray(planPayloadData.integrationsNeeded)
    ? planPayloadData.integrationsNeeded.map(String)
    : [];
  const planAuthRoles = Array.isArray(planPayloadData.authRoles) ? planPayloadData.authRoles.map(String) : [];
  const planDataModels = Array.isArray(planPayloadData.dataModels)
    ? planPayloadData.dataModels.map((item) => ({
        name: String((item as { name?: string }).name ?? ""),
        description: String((item as { description?: string }).description ?? ""),
      }))
    : [];

  return (
    <Card className="px-5 py-5">
      <div className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {dictionary.plan.artifactInspector.title}
        </p>
        <p className="text-sm leading-7 text-muted-foreground">
          {dictionary.plan.artifactInspector.copy}
        </p>
      </div>

      <div className="mt-4 rounded-[24px] border border-border bg-background/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{plannerSourceLabel(dictionary, selectedRun.source)}</Badge>
          <Badge>{plannerTriggerLabel(dictionary, selectedRun.trigger)}</Badge>
          <Badge>{plannerStatusLabel(dictionary, selectedRun.status)}</Badge>
        </div>
        <p className="mt-3 text-sm font-semibold text-card-foreground">{selectedRun.summary}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {formatDateTimeLabel(selectedRun.startedAt, locale)}
        </p>
      </div>

      <div className="mt-5 space-y-4">
        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.artifactInspector.normalizedBrief}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.briefEditor.fields.name}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">
                {String(normalizedBriefPayload.name ?? selectedRun.inputSnapshot.name)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.briefEditor.fields.projectType}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">{selectedProjectType}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.briefEditor.fields.prompt}
              </p>
              <p className="mt-2 text-sm leading-7 text-card-foreground">
                {String(normalizedBriefPayload.prompt ?? "") || dictionary.plan.artifactInspector.none}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.briefEditor.fields.country}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">{selectedCountry}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.briefEditor.fields.primaryLocale}
              </p>
              <p className="mt-2 text-sm font-semibold text-card-foreground">
                {primaryLocaleLabel || dictionary.plan.artifactInspector.none}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.briefEditor.fields.targetUsers}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {badgeList(briefTargetUsers, dictionary.plan.artifactInspector.none)}
              </div>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.briefEditor.fields.desiredPagesFeatures}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {badgeList(briefPages, dictionary.plan.artifactInspector.none)}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.briefEditor.fields.supportedLocales}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {badgeList(briefLocales, dictionary.plan.artifactInspector.none)}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.briefEditor.fields.capabilities}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {badgeList(briefCapabilities, dictionary.plan.artifactInspector.none)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.artifactInspector.planningSignals}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[20px] border border-border bg-card/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.artifactInspector.requestedPages}
              </p>
              <p className="mt-2 text-lg font-semibold text-card-foreground">
                {String(planningSignals?.payload.requestedPageCount ?? briefPages.length)}
              </p>
            </div>
            <div className="rounded-[20px] border border-border bg-card/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.artifactInspector.resolvedPages}
              </p>
              <p className="mt-2 text-lg font-semibold text-card-foreground">
                {String(planningSignals?.payload.resolvedPageCount ?? planPages.length)}
              </p>
            </div>
            <div className="rounded-[20px] border border-border bg-card/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.artifactInspector.capabilityCount}
              </p>
              <p className="mt-2 text-lg font-semibold text-card-foreground">
                {String(planningSignals?.payload.enabledCapabilities ? (planningSignals.payload.enabledCapabilities as unknown[]).length : briefCapabilities.length)}
              </p>
            </div>
            <div className="rounded-[20px] border border-border bg-card/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.artifactInspector.featureCount}
              </p>
              <p className="mt-2 text-lg font-semibold text-card-foreground">
                {String(planningSignals?.payload.featureCount ?? planFeatures.length)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {dictionary.plan.artifactInspector.planPayload}
          </p>
          <p className="mt-3 text-sm leading-7 text-card-foreground">
            {String(planPayloadData.productSummary ?? "") || dictionary.plan.artifactInspector.none}
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.sections.pageMap.title}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {badgeList(planPages, dictionary.plan.artifactInspector.none)}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.sections.featureList.title}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {badgeList(planFeatures, dictionary.plan.artifactInspector.none)}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.sections.integrationsNeeded.title}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {badgeList(planIntegrations, dictionary.plan.artifactInspector.none)}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.sections.authRoles.title}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {badgeList(planAuthRoles, dictionary.plan.artifactInspector.none)}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.sections.dataModels.title}
              </p>
              <div className="mt-3 grid gap-2">
                {planDataModels.map((item) => (
                  <div key={`${item.name}-${item.description}`} className="rounded-[20px] border border-border bg-card/70 p-3">
                    <p className="text-sm font-semibold text-card-foreground">{item.name}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
