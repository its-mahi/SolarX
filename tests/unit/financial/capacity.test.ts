import { describe, expect, it } from "vitest";
import { activeRuleSet as rules } from "@/config/rules";
import { CAPACITY_NOTES, chooseEstimateCapacity, recommendCapacityKw } from "@/lib/domain/financial/capacity";
import { FinancialInputError } from "@/lib/domain/financial/errors";

describe("recommendCapacityKw", () => {
  it("250 units → 2.5 kW (3,000 / 1,400 = 2.14 rounded up to 0.5)", () => {
    expect(recommendCapacityKw(250, rules)).toEqual({ capacityKw: 2.5, notes: [] });
  });
  it("400 units → 3.5 kW", () => {
    expect(recommendCapacityKw(400, rules).capacityKw).toBe(3.5);
  });
  it("30 units → 1 kW with a minimum note", () => {
    const r = recommendCapacityKw(30, rules);
    expect(r.capacityKw).toBe(1);
    expect(r.notes).toEqual([CAPACITY_NOTES.raisedToMinimum]);
    expect(CAPACITY_NOTES.raisedToMinimum).toMatch(/raised to the minimum/i);
  });
  it("2,000 units → 10 kW with a capped note", () => {
    const r = recommendCapacityKw(2000, rules);
    expect(r.capacityKw).toBe(10);
    expect(r.notes).toEqual([CAPACITY_NOTES.cappedAtMaximum]);
    expect(CAPACITY_NOTES.cappedAtMaximum).toMatch(/capped/i);
  });
  it.each([0, -5, NaN, Infinity])("rejects monthly units %s", (u) => {
    expect(() => recommendCapacityKw(u, rules)).toThrow(FinancialInputError);
  });
});

describe("chooseEstimateCapacity", () => {
  it("uses a preferred capacity inside the supported range", () => {
    const c = chooseEstimateCapacity({ monthlyUnits: 250, preferredCapacityKw: 3 }, rules);
    expect(c).toMatchObject({ capacityKw: 3, recommendedCapacityKw: 2.5, basis: "preferred", notes: [] });
  });
  it.each([0.5, 12])("ignores a preferred capacity of %s kW (outside 1–10)", (kw) => {
    const c = chooseEstimateCapacity({ monthlyUnits: 250, preferredCapacityKw: kw }, rules);
    expect(c.basis).toBe("recommended");
    expect(c.capacityKw).toBe(2.5);
    expect(c.notes).toContain(CAPACITY_NOTES.preferredOutOfRange);
    expect(CAPACITY_NOTES.preferredOutOfRange).toMatch(/preferred capacity outside supported range/i);
  });
  it("uses the recommendation when no preference is given", () => {
    expect(chooseEstimateCapacity({ monthlyUnits: 250, preferredCapacityKw: null }, rules).basis).toBe("recommended");
  });
});
