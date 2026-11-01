import { describe, expect, it } from "vitest";
import { FinancialInputError } from "@/lib/domain/financial/errors";
import { calculateNetCost } from "@/lib/domain/financial/net-cost";

describe("calculateNetCost", () => {
  it("subtracts subsidy from cost", () => {
    expect(calculateNetCost(180000, 78000)).toBe(102000);
  });
  it("never goes negative when subsidy exceeds cost", () => {
    expect(calculateNetCost(50000, 78000)).toBe(0);
  });
  it.each([
    [-1, 0],
    [0, -1],
    [NaN, 0],
    [0, Infinity],
  ])("rejects cost=%s subsidy=%s", (cost, subsidy) => {
    expect(() => calculateNetCost(cost, subsidy)).toThrow(FinancialInputError);
  });
});
