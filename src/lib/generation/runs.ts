import type { GenerationRunRecord } from "@/lib/generation/types";

export function findLatestCompletedGenerationRun(
  runs: GenerationRunRecord[],
  sourcePlanRevisionNumber?: number | null,
) {
  return (
    runs.find(
      (run) =>
        run.status === "completed" &&
        (sourcePlanRevisionNumber == null || run.sourcePlanRevisionNumber === sourcePlanRevisionNumber),
    ) ?? null
  );
}
