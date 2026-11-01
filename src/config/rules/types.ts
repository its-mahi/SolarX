// Types for the versioned PM Surya Ghar rule set (data-model.md §3, constitution V).

export type CfaSlab = { fromKw: number; toKw: number; ratePerKw: number };

/** Value type of every rule, by key. */
export type RuleValues = {
  cfa_slabs: CfaSlab[];
  cfa_cap: number;
  generation_kwh_per_kw_year: number;
  benchmark_cost_per_kw: number;
  default_tariff_per_kwh: number;
  tariff_bounds_per_kwh: { min: number; max: number };
  self_consumption_share: number;
  export_rate_per_kwh: number;
  capacity_range_kw: { min: number; max: number };
  capacity_step_kw: number;
};

export type RuleKey = keyof RuleValues;

export const RULE_KEYS: readonly RuleKey[] = [
  "cfa_slabs",
  "cfa_cap",
  "generation_kwh_per_kw_year",
  "benchmark_cost_per_kw",
  "default_tariff_per_kwh",
  "tariff_bounds_per_kwh",
  "self_consumption_share",
  "export_rate_per_kwh",
  "capacity_range_kw",
  "capacity_step_kw",
];

export type RuleVerification = "illustrative" | "verified";

export type Rule<K extends RuleKey = RuleKey> = {
  key: K;
  name: string;
  value: RuleValues[K];
  unit: string;
  consumerCategory: string;
  geography: string;
  sourceTitle: string;
  sourceUrl: string;
  /** ISO date the rule takes effect, or null while unverified. */
  effectiveDate: string | null;
  /** ISO date someone last checked the source, or null = "pending verification". */
  retrievedOn: string | null;
  verification: RuleVerification;
  limitations: string[];
};

export type RuleSet = {
  version: string;
  name: string;
  publishedOn: string;
  rules: { [K in RuleKey]: Rule<K> };
};
