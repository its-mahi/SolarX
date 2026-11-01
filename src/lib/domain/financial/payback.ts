import { assertFiniteNonNegative } from "./errors";

/** Years to recover the net cost from savings, or null when savings are zero (never Infinity). */
export function calculateSimplePaybackYears(netCost: number, annualSavings: number): number | null {
  assertFiniteNonNegative(netCost, "Net cost");
  assertFiniteNonNegative(annualSavings, "Annual savings");
  if (annualSavings === 0) return null;
  return netCost / annualSavings;
}
