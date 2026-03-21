import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { buildPlannerRunDelta, type PlannerRunDeltaLabelKey } from "@/lib/planner/deltas";
import { plannerTriggerLabel } from "@/lib/planner/labels";
import { capabilityOptions, countryOptions, projectTypeOptions } from "@/lib/workspaces/options";
import type { PlannerRunRecord } from "@/lib/planner/types";
import { formatDateTimeLabel } from "@/lib/workspaces/utils";

function labelForKey(dictionary: Dictionary, key: PlannerRunDeltaLabelKey) {
  return dictionary.plan.runDelta.labels[key];
}

function emptyValue(dictionary: Dictionary, value: string) {
  return value === "None" ? dictionary.plan.artifactInspector.none : value;
}

function displayDeltaValue(
  locale: Locale,
  dictionary: Dictionary,
  key: PlannerRunDeltaLabelKey,
  value: string,
) {
  const nextValue = emptyValue(dictionary, value);

  if (nextValue === dictionary.plan.artifactInspector.none) {
    return nextValue;
  }

  switch (key) {
    case "projectType":
      return projectTypeOptions.find((option) => option.value === nextValue)?.label[locale] ?? nextValue;
    case "country":
      return countryOptions.find((option) => option.value === nextValue)?.label[locale] ?? nextValue;
    case "primaryLocale":
      return nextValue === "sq" ? "Shqip" : nextValue === "en" ? "English" : nextValue;
    default:
      return nextValue;
  }
}

function displayDeltaItem(locale: Locale, key: PlannerRunDeltaLabelKey, value: string) {
  switch (key) {
    case "supportedLocales":
      return value === "sq" ? "Shqip" : value === "en" ? "English" : value;
    case "capabilities":
      return capabilityOptions.find((option) => option.key === value)?.label[locale] ?? value;
    default:
      return value;
  }
}

export function PlanRunDeltaCard({
  locale,
  dictionary,
  selectedRun,
  comparisonRun,
}: {
  locale: Locale;
  dictionary: Dictionary;
  selectedRun: PlannerRunRecord | null;
  comparisonRun: PlannerRunRecord | null;
}) {
  const delta = buildPlannerRunDelta(selectedRun, comparisonRun);

  return (
    <Card className="px-5 py-5">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {dictionary.plan.runDelta.title}
      </p>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        {dictionary.plan.runDelta.copy}
      </p>

      {selectedRun && comparisonRun ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <Badge>
            {dictionary.plan.runDelta.currentRunLabel} {plannerTriggerLabel(dictionary, selectedRun.trigger)}
          </Badge>
          <Badge>
            {dictionary.plan.runDelta.previousRunLabel} {plannerTriggerLabel(dictionary, comparisonRun.trigger)}
          </Badge>
        </div>
      ) : null}

      {selectedRun && comparisonRun ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[20px] border border-border bg-background/70 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.runDelta.currentRunLabel}
            </p>
            <p className="mt-2 text-sm font-semibold text-card-foreground">
              {formatDateTimeLabel(selectedRun.startedAt, locale)}
            </p>
          </div>
          <div className="rounded-[20px] border border-border bg-background/70 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {dictionary.plan.runDelta.previousRunLabel}
            </p>
            <p className="mt-2 text-sm font-semibold text-card-foreground">
              {formatDateTimeLabel(comparisonRun.startedAt, locale)}
            </p>
          </div>
        </div>
      ) : null}

      {!selectedRun || !comparisonRun ? (
        <div className="mt-4 rounded-[24px] border border-dashed border-border bg-background/70 p-4">
          <p className="text-sm text-muted-foreground">{dictionary.plan.runDelta.empty}</p>
        </div>
      ) : !delta.hasChanges ? (
        <div className="mt-4 rounded-[24px] border border-dashed border-border bg-background/70 p-4">
          <p className="text-sm text-muted-foreground">{dictionary.plan.runDelta.noChanges}</p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {delta.briefFieldChanges.length > 0 || delta.briefListChanges.length > 0 ? (
            <div className="rounded-[24px] border border-border bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.runDelta.briefChanges}
              </p>
              <div className="mt-4 space-y-3">
                {delta.briefFieldChanges.map((change) => (
                  <div key={`${change.labelKey}-${change.currentValue}`} className="rounded-[20px] border border-border bg-card/70 p-3">
                    <p className="text-sm font-semibold text-card-foreground">
                      {labelForKey(dictionary, change.labelKey)}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {dictionary.plan.runDelta.before}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {displayDeltaValue(locale, dictionary, change.labelKey, change.previousValue)}
                    </p>
                    <p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {dictionary.plan.runDelta.after}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-card-foreground">
                      {displayDeltaValue(locale, dictionary, change.labelKey, change.currentValue)}
                    </p>
                  </div>
                ))}
                {delta.briefListChanges.map((change) => (
                  <div key={change.labelKey} className="rounded-[20px] border border-border bg-card/70 p-3">
                    <p className="text-sm font-semibold text-card-foreground">
                      {labelForKey(dictionary, change.labelKey)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {change.added.map((item) => (
                        <Badge key={`add-${change.labelKey}-${item}`} className="border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200">
                          + {displayDeltaItem(locale, change.labelKey, item)}
                        </Badge>
                      ))}
                      {change.removed.map((item) => (
                        <Badge key={`remove-${change.labelKey}-${item}`} className="border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200">
                          - {displayDeltaItem(locale, change.labelKey, item)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {delta.planFieldChanges.length > 0 || delta.planListChanges.length > 0 ? (
            <div className="rounded-[24px] border border-border bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.runDelta.planChanges}
              </p>
              <div className="mt-4 space-y-3">
                {delta.planFieldChanges.map((change) => (
                  <div key={`${change.labelKey}-${change.currentValue}`} className="rounded-[20px] border border-border bg-card/70 p-3">
                    <p className="text-sm font-semibold text-card-foreground">
                      {labelForKey(dictionary, change.labelKey)}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {dictionary.plan.runDelta.before}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {displayDeltaValue(locale, dictionary, change.labelKey, change.previousValue)}
                    </p>
                    <p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {dictionary.plan.runDelta.after}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-card-foreground">
                      {displayDeltaValue(locale, dictionary, change.labelKey, change.currentValue)}
                    </p>
                  </div>
                ))}
                {delta.planListChanges.map((change) => (
                  <div key={change.labelKey} className="rounded-[20px] border border-border bg-card/70 p-3">
                    <p className="text-sm font-semibold text-card-foreground">
                      {labelForKey(dictionary, change.labelKey)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {change.added.map((item) => (
                        <Badge key={`add-${change.labelKey}-${item}`} className="border-emerald-300/50 bg-emerald-100/70 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200">
                          + {displayDeltaItem(locale, change.labelKey, item)}
                        </Badge>
                      ))}
                      {change.removed.map((item) => (
                        <Badge key={`remove-${change.labelKey}-${item}`} className="border-red-300/50 bg-red-100/70 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200">
                          - {displayDeltaItem(locale, change.labelKey, item)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {delta.signalChanges.length > 0 ? (
            <div className="rounded-[24px] border border-border bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {dictionary.plan.runDelta.signalChanges}
              </p>
              <div className="mt-4 space-y-3">
                {delta.signalChanges.map((change) => (
                  <div key={change.labelKey} className="rounded-[20px] border border-border bg-card/70 p-3">
                    <p className="text-sm font-semibold text-card-foreground">
                      {labelForKey(dictionary, change.labelKey)}
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                          {dictionary.plan.runDelta.before}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {displayDeltaValue(locale, dictionary, change.labelKey, change.previousValue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                          {dictionary.plan.runDelta.after}
                        </p>
                        <p className="mt-1 text-sm text-card-foreground">
                          {displayDeltaValue(locale, dictionary, change.labelKey, change.currentValue)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
