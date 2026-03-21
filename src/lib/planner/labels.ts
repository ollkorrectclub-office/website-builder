import type { Dictionary } from "@/lib/i18n/dictionaries";
import type {
  PlannerRunRecord,
  PlannerRunStatus,
  PlannerRunTrigger,
} from "@/lib/planner/types";
import type { PlannerSource } from "@/lib/workspaces/types";

export function plannerSourceLabel(
  dictionary: Dictionary,
  source: PlannerSource | null | undefined,
) {
  switch (source) {
    case "external_model_adapter_v1":
      return dictionary.plan.externalModelAdapter;
    case "rules_planner_v1":
      return dictionary.plan.rulesPlannerV1;
    case "mock_planner":
    default:
      return dictionary.plan.mockPlanner;
  }
}

export function plannerStatusLabel(
  dictionary: Dictionary,
  status: PlannerRunStatus,
) {
  return dictionary.plan.plannerRun.statuses[status];
}

export function plannerTriggerLabel(
  dictionary: Dictionary,
  trigger: PlannerRunTrigger,
) {
  return dictionary.plan.plannerRun.triggers[trigger];
}

export function plannerRunSummaryLabel(
  dictionary: Dictionary,
  run: Pick<PlannerRunRecord, "source" | "status" | "trigger">,
) {
  return `${plannerSourceLabel(dictionary, run.source)} · ${plannerTriggerLabel(dictionary, run.trigger)} · ${plannerStatusLabel(dictionary, run.status)}`;
}
