// Central financial assistance (CFA) from the active rule set's slabs and cap.
import type { RuleSet } from "@/config/rules";
import { assertFiniteNonNegative } from "./errors";

export function calculateCentralCfa(capacityKw: number, rules: RuleSet): number {
  assertFiniteNonNegative(capacityKw, "Capacity");
  let total = 0;
  for (const { fromKw, toKw, ratePerKw } of rules.rules.cfa_slabs.value) {
    const kwInSlab = Math.min(Math.max(capacityKw - fromKw, 0), toKw - fromKw);
    total += kwInSlab * ratePerKw;
  }
  return Math.round(Math.min(total, rules.rules.cfa_cap.value));
}
