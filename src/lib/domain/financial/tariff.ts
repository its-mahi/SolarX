// Tariff used for savings: the household's own bill ÷ units when given, clamped to a sane range.
import type { RuleSet } from "@/config/rules";

export type TariffBasis = "default" | "derived_from_bill" | "derived_from_bill_clamped";

export function resolveTariff(
  input: { monthlyUnits: number; monthlyBill?: number | null },
  rules: RuleSet,
): { tariffPerKwh: number; tariffBasis: TariffBasis } {
  const fallback = rules.rules.default_tariff_per_kwh.value;
  const { min, max } = rules.rules.tariff_bounds_per_kwh.value;
  const bill = input.monthlyBill;

  if (bill === null || bill === undefined || bill <= 0 || !Number.isFinite(input.monthlyUnits) || input.monthlyUnits <= 0) {
    return { tariffPerKwh: fallback, tariffBasis: "default" };
  }
  const derived = bill / input.monthlyUnits;
  const clamped = Math.min(Math.max(derived, min), max);
  return {
    tariffPerKwh: clamped,
    tariffBasis: clamped === derived ? "derived_from_bill" : "derived_from_bill_clamped",
  };
}
