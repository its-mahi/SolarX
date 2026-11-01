import { describe, expect, it } from "vitest";
import { FinancialInputError } from "@/lib/domain/financial/errors";
import { estimateAnnualSavings } from "@/lib/domain/financial/savings";

const base = { annualGenerationKwh: 4200, annualConsumptionKwh: 3000, tariffPerKwh: 7, selfConsumptionShare: 0.7, exportRatePerKwh: 3 };

describe("estimateAnnualSavings", () => {
  it("demo case: 2,940 self-used, 1,260 exported → ₹24,360", () => {
    expect(estimateAnnualSavings(base)).toEqual({ annualSavings: 24360, selfConsumedKwh: 2940, exportedKwh: 1260 });
  });
  it("caps self-consumed units at annual consumption for an oversized system", () => {
    const r = estimateAnnualSavings({ ...base, annualGenerationKwh: 14000 });
    expect(r.selfConsumedKwh).toBe(3000);
    expect(r.exportedKwh).toBe(11000);
    expect(r.annualSavings).toBe(3000 * 7 + 11000 * 3);
  });
  it("never assumes every unit offsets the full tariff", () => {
    expect(estimateAnnualSavings(base).annualSavings).toBeLessThan(base.annualGenerationKwh * base.tariffPerKwh);
  });
  it("zero generation → zero savings", () => {
    expect(estimateAnnualSavings({ ...base, annualGenerationKwh: 0 }).annualSavings).toBe(0);
  });
  it.each([
    { annualGenerationKwh: -1 },
    { annualConsumptionKwh: NaN },
    { tariffPerKwh: -7 },
    { selfConsumptionShare: 1.5 },
    { exportRatePerKwh: Infinity },
  ])("rejects invalid input %o", (override) => {
    expect(() => estimateAnnualSavings({ ...base, ...override })).toThrow(FinancialInputError);
  });
});
