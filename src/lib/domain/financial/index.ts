// Public financial API, reused by 006 (per-quote net cost) and 011 (advisor facts).
export { calculateCentralCfa } from "./cfa";
export { calculateNetCost } from "./net-cost";
export { calculateSimplePaybackYears } from "./payback";
export { chooseEstimateCapacity, recommendCapacityKw, CAPACITY_NOTES } from "./capacity";
export { estimateAnnualGenerationKwh } from "./generation";
export { resolveTariff } from "./tariff";
export { estimateAnnualSavings } from "./savings";
export { buildSolarEstimate, ESTIMATE_NOTES } from "./estimate";
export { FinancialInputError } from "./errors";
export type { EstimateAssumptions, EstimateInputs, EstimateOptions, SolarEstimate } from "./estimate";
export type { CapacityBasis } from "./capacity";
export type { TariffBasis } from "./tariff";
