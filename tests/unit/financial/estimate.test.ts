import { describe, expect, it } from "vitest";
import { activeRuleSet as rules } from "@/config/rules";
import { FinancialInputError } from "@/lib/domain/financial/errors";
import { buildSolarEstimate } from "@/lib/domain/financial/estimate";
import { ESTIMATE_DISCLAIMER, solarEstimateSchema } from "@/lib/validation/solar";

const demo = { monthlyUnits: 250, monthlyBill: null, budget: 150000, preferredCapacityKw: 3 };

describe("buildSolarEstimate", () => {
  it("produces the demo household's seven values", () => {
    const e = buildSolarEstimate(demo, rules);
    expect(e).toMatchObject({
      capacityKw: 3,
      recommendedCapacityKw: 2.5,
      capacityBasis: "preferred",
      installationCost: 180000,
      subsidyEstimate: 78000,
      netCost: 102000,
      annualGenerationKwh: 4200,
      annualSavingsEstimate: 24360,
      paybackYears: 4.2,
      ruleVersion: "pm-surya-ghar.v1",
    });
  });

  it("shows assumptions and the rule version", () => {
    const { assumptions: a } = buildSolarEstimate(demo, rules);
    expect(a.inputs).toEqual(demo);
    expect(a).toMatchObject({
      annualConsumptionKwh: 3000,
      generationKwhPerKwYear: 1400,
      benchmarkCostPerKw: 60000,
      tariffPerKwh: 7,
      tariffBasis: "default",
      selfConsumptionShare: 0.7,
      exportRatePerKwh: 3,
      selfConsumedKwh: 2940,
      exportedKwh: 1260,
      cfaCap: 78000,
      capacityBasis: "preferred",
    });
    expect(a.cfaSlabs).toHaveLength(2);
    expect(a.illustrativeRuleKeys).toHaveLength(10);
    expect(Array.isArray(a.notes)).toBe(true);
  });

  it("adds the over-budget note when the benchmark cost exceeds the budget", () => {
    expect(buildSolarEstimate(demo, rules).assumptions.notes).toContain(
      "Estimated upfront cost before subsidy exceeds your stated budget.",
    );
    expect(buildSolarEstimate({ ...demo, budget: 500000 }, rules).assumptions.notes).not.toContain(
      "Estimated upfront cost before subsidy exceeds your stated budget.",
    );
  });

  it("returns payback null when estimated savings are zero", () => {
    const zero = structuredClone(rules);
    zero.rules.default_tariff_per_kwh.value = 0;
    zero.rules.export_rate_per_kwh.value = 0;
    const e = buildSolarEstimate(demo, zero);
    expect(e.annualSavingsEstimate).toBe(0);
    expect(e.paybackYears).toBeNull();
  });

  it("is deterministic", () => {
    expect(buildSolarEstimate(demo, rules)).toEqual(buildSolarEstimate(demo, rules));
  });

  it("output parses with the response schema", () => {
    const e = buildSolarEstimate(demo, rules);
    expect(solarEstimateSchema.safeParse({ ...e, requestId: null }).success).toBe(true);
    expect(ESTIMATE_DISCLAIMER).toMatch(/does not guarantee/i);
  });

  it("notes when a bill-derived tariff was clamped", () => {
    const e = buildSolarEstimate({ monthlyUnits: 300, monthlyBill: 50 }, rules);
    expect(e.assumptions.tariffBasis).toBe("derived_from_bill_clamped");
    expect(e.assumptions.notes.some((n) => /tariff/i.test(n))).toBe(true);
  });
});

describe("buildSolarEstimate previews (what-if)", () => {
  it.each([
    [2, 60000],
    [3, 78000],
    [5, 78000],
  ])("capacityOverrideKw %s → subsidy ₹%s, basis preview", (kw, subsidy) => {
    const e = buildSolarEstimate(demo, rules, { capacityOverrideKw: kw });
    expect(e.capacityKw).toBe(kw);
    expect(e.subsidyEstimate).toBe(subsidy);
    expect(e.capacityBasis).toBe("preview");
    expect(e.assumptions.capacityBasis).toBe("preview");
  });

  it.each([0.5, 12, NaN])("rejects an override of %s kW", (kw) => {
    expect(() => buildSolarEstimate(demo, rules, { capacityOverrideKw: kw })).toThrow(FinancialInputError);
  });
});
