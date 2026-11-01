import { assertFiniteNonNegative } from "./errors";

/** Upfront cost after subsidy; never negative. */
export function calculateNetCost(installationCost: number, subsidy: number): number {
  assertFiniteNonNegative(installationCost, "Installation cost");
  assertFiniteNonNegative(subsidy, "Subsidy");
  return Math.max(0, installationCost - subsidy);
}
