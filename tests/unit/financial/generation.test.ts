import { describe, expect, it } from "vitest";
import { activeRuleSet as rules } from "@/config/rules";
import { FinancialInputError } from "@/lib/domain/financial/errors";
import { estimateAnnualGenerationKwh } from "@/lib/domain/financial/generation";

describe("estimateAnnualGenerationKwh", () => {
  it("3 kW × 1,400 = 4,200 kWh (integer)", () => {
    const kwh = estimateAnnualGenerationKwh(3, rules);
    expect(kwh).toBe(4200);
    expect(Number.isInteger(kwh)).toBe(true);
  });
  it("0 kW → 0", () => {
    expect(estimateAnnualGenerationKwh(0, rules)).toBe(0);
  });
  it.each([-1, NaN])("rejects %s", (kw) => {
    expect(() => estimateAnnualGenerationKwh(kw, rules)).toThrow(FinancialInputError);
  });
});
