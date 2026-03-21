import { buildMockStructuredPlan } from "@/lib/workspaces/mock-plan";

import { buildPlannerArtifacts } from "@/lib/planner/utils";
import type {
  PlannerAdapter,
  PlannerInput,
  PlannerResult,
  PlannerRunTrigger,
} from "@/lib/planner/types";

function planningSummary(input: PlannerInput, trigger: PlannerRunTrigger) {
  const modeLabel = trigger === "project_create" ? "initial" : "rerun";
  const capabilityCount = Object.values(input.capabilities).filter(Boolean).length;
  const pageCount = input.desiredPagesFeatures.filter(Boolean).length;

  return `Completed ${modeLabel} planner pass for ${input.name} with ${pageCount || 0} requested pages and ${capabilityCount} enabled capability flags.`;
}

export class RuleBasedPlannerAdapter implements PlannerAdapter {
  readonly source = "rules_planner_v1" as const;

  async plan(input: PlannerInput, trigger: PlannerRunTrigger): Promise<PlannerResult> {
    const plan = buildMockStructuredPlan(input);

    return {
      plan,
      source: this.source,
      summary: planningSummary(input, trigger),
      status: "completed",
      artifacts: buildPlannerArtifacts(input, plan, trigger),
    };
  }
}
