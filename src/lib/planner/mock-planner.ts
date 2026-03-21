import { buildMockStructuredPlan } from "@/lib/workspaces/mock-plan";

import type { PlannerInput, PlannerService, PlannerServiceResult } from "@/lib/planner/types";

export class MockPlannerService implements PlannerService {
  async generateInitialPlan(input: PlannerInput): Promise<PlannerServiceResult> {
    const result = {
      plan: buildMockStructuredPlan(input),
      source: "mock_planner" as const,
      summary: `Mock planner output prepared for ${input.name}.`,
      status: "completed" as const,
      artifacts: [],
    };

    return {
      result,
      adapterExecution: {
        capability: "planning",
        requestedSelection: "deterministic_internal",
        executedSelection: "deterministic_internal",
        sourceType: "deterministic_internal",
        executionMode: "selected",
        requestedAdapterKey: "mock_planner",
        executedAdapterKey: "mock_planner",
        providerKey: null,
        providerLabel: null,
        modelName: null,
        endpointUrl: null,
        latencyMs: null,
        trace: null,
        fallbackReason: null,
        summary: "Mock planner executed.",
        metadata: {},
      },
    };
  }

  async rerunPlan(input: PlannerInput): Promise<PlannerServiceResult> {
    return this.generateInitialPlan(input);
  }
}
