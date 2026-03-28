import { ExternalLLMPlannerAdapter } from "@/lib/planner/external-llm-planner";
import { RuleBasedPlannerAdapter } from "@/lib/planner/rule-based-planner";
import type {
  PlannerExternalAdapter,
  PlannerExternalAdapterConfig,
  PlannerExternalAdapterFactory,
  PlannerServiceDependencies,
} from "@/lib/planner/types";

class DefaultPlannerExternalAdapterFactory implements PlannerExternalAdapterFactory {
  create(config: PlannerExternalAdapterConfig): PlannerExternalAdapter {
    return new ExternalLLMPlannerAdapter(config);
  }
}

export function defaultPlannerServiceDependencies(): PlannerServiceDependencies {
  return {
    deterministicAdapter: new RuleBasedPlannerAdapter(),
    externalAdapterFactory: new DefaultPlannerExternalAdapterFactory(),
  };
}
