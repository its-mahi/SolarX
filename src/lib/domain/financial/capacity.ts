// Transparent system-size heuristic (research R-04): annual use ÷ expected yield, rounded UP to
// the next step, kept inside the supported range. A preliminary guide, not an engineering design.
import type { RuleSet } from "@/config/rules";
import { FinancialInputError } from "./errors";

export const CAPACITY_NOTES = {
  raisedToMinimum: "Recommended size was raised to the minimum supported system size.",
  cappedAtMaximum: "Recommended size was capped at the maximum supported system size.",
  preferredOutOfRange: "Preferred capacity outside supported range — using the recommended size instead.",
} as const;

export type CapacityBasis = "preferred" | "recommended";

function ceilToStep(value: number, step: number): number {
  return Math.ceil(value / step - 1e-9) * step;
}

export function recommendCapacityKw(monthlyUnits: number, rules: RuleSet): { capacityKw: number; notes: string[] } {
  if (!Number.isFinite(monthlyUnits) || monthlyUnits <= 0) {
    throw new FinancialInputError("Monthly units must be a positive number");
  }
  const { min, max } = rules.rules.capacity_range_kw.value;
  const raw = ceilToStep((monthlyUnits * 12) / rules.rules.generation_kwh_per_kw_year.value, rules.rules.capacity_step_kw.value);
  const notes: string[] = [];
  let capacityKw = raw;
  if (raw < min) {
    capacityKw = min;
    notes.push(CAPACITY_NOTES.raisedToMinimum);
  } else if (raw > max) {
    capacityKw = max;
    notes.push(CAPACITY_NOTES.cappedAtMaximum);
  }
  return { capacityKw, notes };
}

export function chooseEstimateCapacity(
  inputs: { monthlyUnits: number; preferredCapacityKw?: number | null },
  rules: RuleSet,
): { capacityKw: number; recommendedCapacityKw: number; basis: CapacityBasis; notes: string[] } {
  const recommended = recommendCapacityKw(inputs.monthlyUnits, rules);
  const { min, max } = rules.rules.capacity_range_kw.value;
  const preferred = inputs.preferredCapacityKw;

  if (preferred !== null && preferred !== undefined) {
    if (preferred >= min && preferred <= max) {
      return { capacityKw: preferred, recommendedCapacityKw: recommended.capacityKw, basis: "preferred", notes: [] };
    }
    return {
      capacityKw: recommended.capacityKw,
      recommendedCapacityKw: recommended.capacityKw,
      basis: "recommended",
      notes: [...recommended.notes, CAPACITY_NOTES.preferredOutOfRange],
    };
  }
  return {
    capacityKw: recommended.capacityKw,
    recommendedCapacityKw: recommended.capacityKw,
    basis: "recommended",
    notes: recommended.notes,
  };
}
