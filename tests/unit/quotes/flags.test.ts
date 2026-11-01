import { describe, expect, it } from "vitest";
import { computeFlags, normalizeQuote, toScoringInput, type FlagContext } from "@/lib/domain/quotes";
import { greenvolt, solartech, sunrise } from "../../fixtures/quotes/demo-quotes";

const ctx: FlagContext = { budget: 150000, referenceCapacityKw: 3, comparedPricesPerKw: [50000, 47333, 57273] };
const flags = (row: Parameters<typeof normalizeQuote>[0], c = ctx) => computeFlags(toScoringInput(normalizeQuote(row)), c);
const codes = (row: Parameters<typeof normalizeQuote>[0], c = ctx) => flags(row, c).map((f) => f.code);
const panel = (extra: object) => ({ ...sunrise, panel_details: { ...(sunrise.panel_details as object), ...extra } });

describe("computeFlags", () => {
  it("SunRise and SolarTech: ABOVE_BUDGET only", () => {
    expect(codes(sunrise)).toEqual(["ABOVE_BUDGET"]);
    expect(codes(solartech)).toEqual(["ABOVE_BUDGET"]);
  });
  it("GreenVolt: MISSING_* flags", () => {
    expect(codes(greenvolt)).toEqual(["MISSING_WARRANTY_WORKMANSHIP", "MISSING_EARTHING_STATED"]);
  });
  it("earthing / documentation false", () => {
    expect(codes({ ...sunrise, earthing_included: false, documentation_included: false })).toEqual([
      "EARTHING_NOT_INCLUDED", "DOCUMENTATION_NOT_INCLUDED", "ABOVE_BUDGET",
    ]);
  });
  it("CAPACITY_MISMATCH above 10% but not at exactly 10%", () => {
    expect(codes(panel({ wattage: 400, quantity: 5 }), { ...ctx, budget: null })).toContain("CAPACITY_MISMATCH"); // 2.0 vs 3.3
    expect(codes({ ...panel({ wattage: 450, quantity: 6 }), capacity_kw: 3 }, { ...ctx, budget: null })).not.toContain("CAPACITY_MISMATCH"); // 2.7 vs 3 = exactly 10%
  });
  it("INVERTER_UNDERSIZED at 0.79 but not 0.80", () => {
    const inv = (kw: number, cap: number) => ({ ...sunrise, capacity_kw: cap, inverter_details: { ...(sunrise.inverter_details as object), capacity_kw: kw } });
    expect(codes(inv(2.37, 3))).toContain("INVERTER_UNDERSIZED");
    expect(codes(inv(2.4, 3))).not.toContain("INVERTER_UNDERSIZED");
  });
  it("ABOVE_BUDGET not when equal", () => {
    expect(codes({ ...sunrise, price: 150000 })).not.toContain("ABOVE_BUDGET");
    expect(codes({ ...sunrise, price: 165000 })).toContain("ABOVE_BUDGET");
  });
  it("UNUSUALLY_LOW_PRICE needs >= 2 compared quotes", () => {
    const low = { ...sunrise, price: 90000 };
    expect(codes(low, { ...ctx, budget: null })).toContain("UNUSUALLY_LOW_PRICE");
    expect(codes(low, { ...ctx, budget: null, comparedPricesPerKw: [27272] })).not.toContain("UNUSUALLY_LOW_PRICE");
  });
  it("CAPACITY_FAR_FROM_REQUEST uses the reference, none when absent", () => {
    expect(codes({ ...sunrise, capacity_kw: 6 }, { ...ctx, budget: null })).toContain("CAPACITY_FAR_FROM_REQUEST");
    expect(codes({ ...sunrise, capacity_kw: 6 }, { ...ctx, budget: null, referenceCapacityKw: null })).not.toContain("CAPACITY_FAR_FROM_REQUEST");
  });
  it("severities", () => {
    const f = flags({ ...greenvolt, earthing_included: false });
    expect(f.find((x) => x.code === "EARTHING_NOT_INCLUDED")?.severity).toBe("warning");
    expect(flags(sunrise).find((x) => x.code === "ABOVE_BUDGET")?.severity).toBe("info");
  });
});
