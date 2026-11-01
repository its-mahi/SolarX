// Savings model (research R-08): only part of the generation offsets the retail tariff; the rest
// is exported at a lower rate. Self-use can never exceed what the home actually consumes.
import { FinancialInputError, assertFiniteNonNegative } from "./errors";

export type SavingsInput = {
  annualGenerationKwh: number;
  annualConsumptionKwh: number;
  tariffPerKwh: number;
  selfConsumptionShare: number;
  exportRatePerKwh: number;
};

export function estimateAnnualSavings(input: SavingsInput): {
  annualSavings: number;
  selfConsumedKwh: number;
  exportedKwh: number;
} {
  assertFiniteNonNegative(input.annualGenerationKwh, "Annual generation");
  assertFiniteNonNegative(input.annualConsumptionKwh, "Annual consumption");
  assertFiniteNonNegative(input.tariffPerKwh, "Tariff");
  assertFiniteNonNegative(input.exportRatePerKwh, "Export rate");
  if (!Number.isFinite(input.selfConsumptionShare) || input.selfConsumptionShare < 0 || input.selfConsumptionShare > 1) {
    throw new FinancialInputError("Self-consumption share must be between 0 and 1");
  }

  const selfConsumedKwh = Math.min(input.annualGenerationKwh * input.selfConsumptionShare, input.annualConsumptionKwh);
  const exportedKwh = input.annualGenerationKwh - selfConsumedKwh;
  const annualSavings = Math.round(selfConsumedKwh * input.tariffPerKwh + exportedKwh * input.exportRatePerKwh);
  return { annualSavings, selfConsumedKwh: Math.round(selfConsumedKwh), exportedKwh: Math.round(exportedKwh) };
}
