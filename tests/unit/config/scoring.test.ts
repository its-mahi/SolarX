import { describe, expect, it } from "vitest";
import { RECOMMENDED_ITEMS, scoringConfig as c } from "@/config/scoring.v1";

describe("scoring.v1 config", () => {
  it("has version and weights summing to 100", () => {
    expect(c.version).toBe("scoring.v1");
    expect(c.weights).toEqual({ price: 30, technical: 25, warranty: 20, completeness: 15, timeline: 10 });
    expect(Object.values(c.weights).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("technical 5 x 5 and warranty 6+6+5+3", () => {
    expect(c.technical.items.length * c.technical.pointsPerItem).toBe(c.weights.technical);
    const w = c.warranty;
    expect(w.panelProduct.points + w.panelPerformance.points + w.inverter.points + w.workmanship.points).toBe(c.weights.warranty);
  });
  it("has 14 recommended items in fixed order and the exact disclaimer", () => {
    expect(RECOMMENDED_ITEMS).toHaveLength(14);
    expect(RECOMMENDED_ITEMS[0]).toBe("panelBrand");
    expect(RECOMMENDED_ITEMS[13]).toBe("documentStated".replace("documentStated", "documentationStated"));
    expect(c.disclaimer).toBe("Comparison score defined by SolarX for guidance only — not a government, official or certification rating.");
  });
});
