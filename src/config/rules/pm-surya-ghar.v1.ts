// PM Surya Ghar rule set v1. EVERY value here is ILLUSTRATIVE: planning placeholders from the
// product plan (§12) and research R-05..R-08, not official figures. Verify each one against
// https://pmsuryaghar.gov.in/ and https://mnre.gov.in/ before the demo, then record
// retrievedOn / effectiveDate and switch `verification` to "verified". If any value changes,
// create pm-surya-ghar.v2.ts and point activeRuleSet at it (research R-02).
import type { Rule, RuleKey, RuleSet } from "./types";

const PORTAL = "https://pmsuryaghar.gov.in/";
const MNRE = "https://mnre.gov.in/";
const ILLUSTRATIVE = "Illustrative — verify before demo";

const residential = "Residential — individual household";
const central = "All India (central assistance only; state top-ups not included)";
const portalTitle = "PM Surya Ghar: Muft Bijli Yojana — National Portal";

function rule<K extends RuleKey>(r: Omit<Rule<K>, "effectiveDate" | "retrievedOn" | "verification">): Rule<K> {
  return { ...r, effectiveDate: null, retrievedOn: null, verification: "illustrative" };
}

export const pmSuryaGharV1: RuleSet = {
  version: "pm-surya-ghar.v1",
  name: "PM Surya Ghar — illustrative baseline",
  publishedOn: "2026-11-01",
  rules: {
    cfa_slabs: rule({
      key: "cfa_slabs",
      name: "Central financial assistance (CFA) per kW",
      value: [
        { fromKw: 0, toKw: 2, ratePerKw: 30000 },
        { fromKw: 2, toKw: 3, ratePerKw: 18000 },
      ],
      unit: "INR per kW",
      consumerCategory: residential,
      geography: central,
      sourceTitle: portalTitle,
      sourceUrl: PORTAL,
      limitations: [`${ILLUSTRATIVE} (baseline from the product plan)`, "Does not establish eligibility"],
    }),
    cfa_cap: rule({
      key: "cfa_cap",
      name: "Maximum central financial assistance",
      value: 78000,
      unit: "INR",
      consumerCategory: residential,
      geography: central,
      sourceTitle: portalTitle,
      sourceUrl: PORTAL,
      limitations: [ILLUSTRATIVE, "Does not establish eligibility"],
    }),
    generation_kwh_per_kw_year: rule({
      key: "generation_kwh_per_kw_year",
      name: "Expected annual generation per kW",
      value: 1400,
      unit: "kWh per kW per year",
      consumerCategory: "Rooftop solar — household",
      geography: "India (generic, not location-specific)",
      sourceTitle: "SolarX planning assumption — verify with the PM Surya Ghar portal calculator",
      sourceUrl: PORTAL,
      limitations: [ILLUSTRATIVE, "Real output depends on location, orientation, shading and losses"],
    }),
    benchmark_cost_per_kw: rule({
      key: "benchmark_cost_per_kw",
      name: "Benchmark installation cost per kW (before subsidy)",
      value: 60000,
      unit: "INR per kW",
      consumerCategory: "Residential on-grid — household",
      geography: "India (generic)",
      sourceTitle: "SolarX planning assumption — verify with the MNRE benchmark cost notification",
      sourceUrl: MNRE,
      limitations: [ILLUSTRATIVE, "Vendor quotes will differ"],
    }),
    default_tariff_per_kwh: rule({
      key: "default_tariff_per_kwh",
      name: "Default electricity tariff",
      value: 7,
      unit: "INR per kWh",
      consumerCategory: residential,
      geography: "India (generic)",
      sourceTitle: "SolarX planning assumption — verify with the state DISCOM tariff order",
      sourceUrl: PORTAL,
      limitations: [ILLUSTRATIVE, "Fixed charges and tariff slabs are not modelled"],
    }),
    tariff_bounds_per_kwh: rule({
      key: "tariff_bounds_per_kwh",
      name: "Allowed range for a tariff derived from your bill",
      value: { min: 3, max: 12 },
      unit: "INR per kWh",
      consumerCategory: residential,
      geography: "India (generic)",
      sourceTitle: "SolarX planning assumption — verify with the state DISCOM tariff order",
      sourceUrl: PORTAL,
      limitations: [ILLUSTRATIVE, "Stops unrealistic bills from producing absurd savings"],
    }),
    self_consumption_share: rule({
      key: "self_consumption_share",
      name: "Share of generated power used at home",
      value: 0.7,
      unit: "ratio (0–1)",
      consumerCategory: residential,
      geography: "India (generic)",
      sourceTitle: "SolarX planning assumption",
      sourceUrl: PORTAL,
      limitations: [ILLUSTRATIVE, "Depends on when the household uses electricity"],
    }),
    export_rate_per_kwh: rule({
      key: "export_rate_per_kwh",
      name: "Rate for power sent back to the grid",
      value: 3,
      unit: "INR per kWh",
      consumerCategory: "Residential net billing",
      geography: "India (generic)",
      sourceTitle: "SolarX planning assumption — verify the DISCOM net-metering or feed-in rate",
      sourceUrl: PORTAL,
      limitations: [ILLUSTRATIVE, "Net-metering rules differ by state"],
    }),
    capacity_range_kw: rule({
      key: "capacity_range_kw",
      name: "Supported system size",
      value: { min: 1, max: 10 },
      unit: "kW",
      consumerCategory: residential,
      geography: "India",
      sourceTitle: "SolarX product rule",
      sourceUrl: PORTAL,
      limitations: [ILLUSTRATIVE, "Keeps the tool to typical household systems"],
    }),
    capacity_step_kw: rule({
      key: "capacity_step_kw",
      name: "System size rounding step",
      value: 0.5,
      unit: "kW",
      consumerCategory: residential,
      geography: "India",
      sourceTitle: "SolarX product rule",
      sourceUrl: PORTAL,
      limitations: [ILLUSTRATIVE],
    }),
  },
};
