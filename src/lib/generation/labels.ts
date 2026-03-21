import type { Dictionary } from "@/lib/i18n/dictionaries";
import type {
  GenerationRunRecord,
  GenerationSource,
} from "@/lib/generation/types";

export function generationSourceLabel(dictionary: Dictionary, source: GenerationSource) {
  return dictionary.plan.generation.sources[source];
}

export function generationTriggerLabel(
  dictionary: Dictionary,
  trigger: GenerationRunRecord["trigger"],
) {
  return dictionary.plan.generation.triggers[trigger];
}

export function generationStatusLabel(
  dictionary: Dictionary,
  status: GenerationRunRecord["status"],
) {
  return dictionary.plan.generation.statuses[status];
}
