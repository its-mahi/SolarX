// One pure entry point that composes every calculation (research R-10). No I/O, no framework.
import type { RuleSet } from "@/config/rules";
import { RULE_KEYS } from "@/config/rules";
import { calculateCentralCfa } from "./cfa";
import { chooseEstimateCapacity, recommendCapacityKw, type CapacityBasis } from "./capacity";
import { FinancialInputError } from "./errors";
import { estimateAnnualGenerationKwh } from "./generation";
import { calculateNetCost } from "./net-cost";
import { calculateSimplePaybackYears } from "./payback";
import { estimateAnnualSavings } from "./savings";
import { resolveTariff, type TariffBasis } from "./tariff";

export type EstimateInputs = {
  monthlyUnits: number;
  monthlyBill?: number | null;
  budget?: number | null;
  preferredCapacityKw?: number | null;
};

export type EstimateOptions = { capacityOverrideKw?: number };

export const ESTIMATE_NOTES = {
  overBudget: "Estimated upfront cost before subsidy exceeds your stated budget.",
  tariffClamped: "The tariff derived from your bill was limited to the supported range.",
} as const;

export type EstimateAssumptions = {
  inputs: { monthlyUnits: number; monthlyBill: number | null; budget: number | null; preferredCapacityKw: number | null };
  annualConsumptionKwh: number;
  recommendedCapacityKw: number;
  capacityBasis: CapacityBasis | "preview";
  generationKwhPerKwYear: number;
  benchmarkCostPerKw: number;
  tariffPerKwh: number;
  tariffBasis: TariffBasis;
  selfConsumptionShare: number;
  exportRatePerKwh: number;
  selfConsumedKwh: number;
  exportedKwh: number;
  cfaSlabs: { fromKw: number; toKw: number; ratePerKw: number }[];
  cfaCap: number;
  illustrativeRuleKeys: string[];
  notes: string[];
};

export type SolarEstimate = {
  capacityKw: number;
  recommendedCapacityKw: number;
  capacityBasis: CapacityBasis | "preview";
  installationCost: number;
  subsidyEstimate: number;
  netCost: number;
  annualGenerationKwh: number;
  annualSavingsEstimate: number;
  paybackYears: number | null;
  ruleVersion: string;
  assumptions: EstimateAssumptions;
};

const round = (value: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

export function buildSolarEstimate(inputs: EstimateInputs, rules: RuleSet, options: EstimateOptions = {}): SolarEstimate {
  const { min, max } = rules.rules.capacity_range_kw.value;
  const chosen = chooseEstimateCapacity(inputs, rules);
  let capacityKw = chosen.capacityKw;
  let basis: CapacityBasis | "preview" = chosen.basis;
  let notes = [...chosen.notes];

  const override = options.capacityOverrideKw;
  if (override !== undefined) {
    if (!Number.isFinite(override) || override < min || override > max) {
      throw new FinancialInputError(`Capacity must be between ${min} and ${max} kW`);
    }
    capacityKw = override;
    basis = "preview";
    notes = recommendCapacityKw(inputs.monthlyUnits, rules).notes;
  }

  const installationCost = Math.round(capacityKw * rules.rules.benchmark_cost_per_kw.value);
  const subsidyEstimate = calculateCentralCfa(capacityKw, rules);
  const netCost = calculateNetCost(installationCost, subsidyEstimate);
  const annualGenerationKwh = estimateAnnualGenerationKwh(capacityKw, rules);

  const tariff = resolveTariff(inputs, rules);
  const annualConsumptionKwh = Math.round(inputs.monthlyUnits * 12);
  const savings = estimateAnnualSavings({
    annualGenerationKwh,
    annualConsumptionKwh,
    tariffPerKwh: tariff.tariffPerKwh,
    selfConsumptionShare: rules.rules.self_consumption_share.value,
    exportRatePerKwh: rules.rules.export_rate_per_kwh.value,
  });
  const payback = calculateSimplePaybackYears(netCost, savings.annualSavings);

  if (inputs.budget !== null && inputs.budget !== undefined && installationCost > inputs.budget) notes.push(ESTIMATE_NOTES.overBudget);
  if (tariff.tariffBasis === "derived_from_bill_clamped") notes.push(ESTIMATE_NOTES.tariffClamped);

  const illustrativeRuleKeys = RULE_KEYS.filter((key) => rules.rules[key].verification === "illustrative");

  return {
    capacityKw: round(capacityKw, 2),
    recommendedCapacityKw: chosen.recommendedCapacityKw,
    capacityBasis: basis,
    installationCost,
    subsidyEstimate,
    netCost,
    annualGenerationKwh,
    annualSavingsEstimate: savings.annualSavings,
    paybackYears: payback === null ? null : round(payback, 1),
    ruleVersion: rules.version,
    assumptions: {
      inputs: {
        monthlyUnits: inputs.monthlyUnits,
        monthlyBill: inputs.monthlyBill ?? null,
        budget: inputs.budget ?? null,
        preferredCapacityKw: inputs.preferredCapacityKw ?? null,
      },
      annualConsumptionKwh,
      recommendedCapacityKw: chosen.recommendedCapacityKw,
      capacityBasis: basis,
      generationKwhPerKwYear: rules.rules.generation_kwh_per_kw_year.value,
      benchmarkCostPerKw: rules.rules.benchmark_cost_per_kw.value,
      tariffPerKwh: tariff.tariffPerKwh,
      tariffBasis: tariff.tariffBasis,
      selfConsumptionShare: rules.rules.self_consumption_share.value,
      exportRatePerKwh: rules.rules.export_rate_per_kwh.value,
      selfConsumedKwh: savings.selfConsumedKwh,
      exportedKwh: savings.exportedKwh,
      cfaSlabs: rules.rules.cfa_slabs.value.map((s) => ({ ...s })),
      cfaCap: rules.rules.cfa_cap.value,
      illustrativeRuleKeys,
      notes,
    },
  };
}
