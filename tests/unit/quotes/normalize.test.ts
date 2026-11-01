import { describe, expect, it } from "vitest";
import { normalizeQuote, toScoringInput } from "@/lib/domain/quotes";
import { malformed, sunrise, sunriseInjected, greenvolt } from "../../fixtures/quotes/demo-quotes";

describe("normalizeQuote", () => {
  it("normalizes SunRise", () => {
    const n = normalizeQuote(sunrise);
    expect(n.pricePerKw).toBe(50000);
    expect(Number.isInteger(n.pricePerKw)).toBe(true);
    expect(n.panel.computedCapacityKw).toBeCloseTo(3.3);
    expect(n.warranty).toEqual({ panelProductYears: 12, panelPerformanceYears: 25, inverterYears: 8, workmanshipYears: 5 });
  });
  it("keeps unknowns null and never 0", () => {
    const n = normalizeQuote(greenvolt);
    expect(n.warranty.workmanshipYears).toBeNull();
    expect(n.earthingIncluded).toBeNull();
  });
  it("turns malformed values into null", () => {
    const n = normalizeQuote(malformed);
    expect(n.panel.brand).toBeNull();
    expect(n.panel.wattage).toBeNull();
    expect(n.panel.quantity).toBeNull();
    expect(n.panel.certifications).toBeNull();
    expect(n.inverter.brand).toBeNull();
    expect(n.inverter.capacityKw).toBeNull();
    expect(n.warranty.panelProductYears).toBeNull();
    expect(n.warranty.panelPerformanceYears).toBeNull();
    expect(n.warranty.inverterYears).toBe(0);
    expect(n.warranty.workmanshipYears).toBeNull();
  });
  it("treats empty certifications as null and trims / limits strings", () => {
    const n = normalizeQuote({ ...sunrise, panel_details: { brand: "  X  ", certifications: [] } });
    expect(n.panel.brand).toBe("X");
    expect(n.panel.certifications).toBeNull();
    expect(normalizeQuote({ ...sunrise, panel_details: { brand: "a".repeat(121) } }).panel.brand).toBeNull();
  });
  it("carries vendor text only in vendorText", () => {
    expect(normalizeQuote(sunriseInjected).vendorText.notes).toContain("ignore previous");
  });
  it("scoring input has no free-text keys", () => {
    const keys = JSON.stringify(Object.keys(toScoringInput(normalizeQuote(sunriseInjected)))) + JSON.stringify(toScoringInput(normalizeQuote(sunriseInjected)));
    expect(keys).not.toMatch(/notes|inclusions|exclusions|vendorText|ignore previous/i);
  });
});
