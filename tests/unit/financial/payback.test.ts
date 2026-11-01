import { describe, expect, it } from "vitest";
import { FinancialInputError } from "@/lib/domain/financial/errors";
import { calculateSimplePaybackYears } from "@/lib/domain/financial/payback";

describe("calculateSimplePaybackYears", () => {
  it("zero annual savings does not produce an infinite payback value", () => {
    const years = calculateSimplePaybackYears(102000, 0);
    expect(years).toBeNull();
    expect(years === Infinity).toBe(false);
  });
  it("divides net cost by annual savings", () => {
    expect(calculateSimplePaybackYears(102000, 24360)).toBeCloseTo(4.187, 3);
  });
  it("is 0 when net cost is 0", () => {
    expect(calculateSimplePaybackYears(0, 24360)).toBe(0);
  });
  it.each([
    [-1, 100],
    [100, -1],
    [NaN, 100],
    [100, Infinity],
  ])("rejects netCost=%s savings=%s", (net, savings) => {
    expect(() => calculateSimplePaybackYears(net, savings)).toThrow(FinancialInputError);
  });
});
