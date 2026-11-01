import { describe, expect, it } from "vitest";
import { activeRuleSet as rules } from "@/config/rules";
import { FinancialInputError } from "@/lib/domain/financial/errors";
import { calculateCentralCfa } from "@/lib/domain/financial/cfa";

describe("calculateCentralCfa (illustrative rule v1)", () => {
  it.each([
    [1, 30000], // 1 kW returns ₹30,000 under the configured example rule
    [2, 60000], // 2 kW returns ₹60,000
    [2.5, 69000], // 2.5 kW returns ₹69,000
    [3, 78000], // 3 kW returns ₹78,000
    [0, 0],
    [1.5, 45000],
  ])("%s kW → ₹%s", (kw, expected) => {
    expect(calculateCentralCfa(kw, rules)).toBe(expected);
  });

  it.each([3.5, 5, 10])("capacity above 3 kW does not increase the CFA (%s kW → 78,000)", (kw) => {
    expect(calculateCentralCfa(kw, rules)).toBe(78000);
  });

  it("rejects negative capacity", () => {
    expect(() => calculateCentralCfa(-1, rules)).toThrow(FinancialInputError);
  });

  it.each([NaN, Infinity, -Infinity])("rejects %s", (kw) => {
    expect(() => calculateCentralCfa(kw, rules)).toThrow(FinancialInputError);
  });

  it("returns whole rupees", () => {
    expect(Number.isInteger(calculateCentralCfa(1.33, rules))).toBe(true);
  });

  it("honours the cap even if slabs would exceed it", () => {
    const custom = structuredClone(rules);
    custom.rules.cfa_cap.value = 50000;
    expect(calculateCentralCfa(3, custom)).toBe(50000);
  });
});
