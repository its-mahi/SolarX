import type { RuleSet } from "@/config/rules";
import { assertFiniteNonNegative } from "./errors";

/** Expected annual generation in whole kWh. */
export function estimateAnnualGenerationKwh(capacityKw: number, rules: RuleSet): number {
  assertFiniteNonNegative(capacityKw, "Capacity");
  return Math.round(capacityKw * rules.rules.generation_kwh_per_kw_year.value);
}
