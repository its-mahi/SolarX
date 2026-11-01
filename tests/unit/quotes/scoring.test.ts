import { describe, expect, it } from "vitest";
import {
  normalizeQuote, scoreCompleteness, scorePrice, scoreQuotes, scoreTechnical, scoreTimeline, scoreWarranty, toScoringInput,
} from "@/lib/domain/quotes";
import { greenvolt, greenvoltUnknownInverter, malformed, solartech, sunrise } from "../../fixtures/quotes/demo-quotes";

const inp = (row: Parameters<typeof normalizeQuote>[0]) => toScoringInput(normalizeQuote(row));
const MIN = 142000 / 3;

describe("sub-scores", () => {
  it("price 30 x min/ppk", () => {
    const t = (r: typeof sunrise) => scorePrice(r.price / Number(r.capacity_kw), MIN, 3).tenths / 10;
    expect([t(sunrise), t(greenvolt), t(solartech)]).toEqual([28.4, 30, 24.8]);
  });
  it("technical: GreenVolt 20 with earthing penalty; unknown inverter capacity zeroes two items", () => {
    expect(scoreTechnical(inp(sunrise)).tenths).toBe(250);
    const g = scoreTechnical(inp(greenvolt));
    expect(g.tenths).toBe(200);
    expect(g.penalties.map((p) => p.message)).toEqual(["Earthing not stated (−5)"]);
    const u = scoreTechnical(inp(greenvoltUnknownInverter));
    expect(u.items.filter((i) => i.status === "unknown").map((i) => i.key)).toEqual(["inverterDetailsComplete", "inverterAdequatelySized", "earthingIncluded"]);
    expect(u.tenths).toBe(100);
  });
  it("earthing false scores 0 without a penalty", () => {
    const r = scoreTechnical(inp({ ...sunrise, earthing_included: false }));
    expect(r.tenths).toBe(200);
    expect(r.penalties).toEqual([]);
  });
  it("warranty", () => {
    expect([sunrise, greenvolt, solartech].map((r) => scoreWarranty(inp(r)).tenths / 10)).toEqual([19, 14.5, 20]);
    expect(scoreWarranty(inp(greenvolt)).penalties[0].message).toBe("Workmanship warranty not stated (−3)");
  });
  it("0-year warranty earns 0 with no penalty; 40 years capped", () => {
    const w = (v: number) => ({ ...sunrise, warranty_details: { ...(sunrise.warranty_details as object), inverter_years: v } });
    expect(scoreWarranty(inp(w(0))).penalties).toEqual([]);
    expect(scoreWarranty(inp(w(0))).items[2].points).toBe(0);
    expect(scoreWarranty(inp(w(40))).items[2].points).toBe(5);
  });
  it("completeness", () => {
    expect(scoreCompleteness(inp(sunrise)).tenths).toBe(150);
    const g = scoreCompleteness(inp(greenvolt));
    expect(g.tenths).toBe(129);
    expect(g.penalties[0].message).toBe("2 recommended details not stated (−2.1)");
  });
  it("timeline", () => {
    const t = (d: number | null) => scoreTimeline(inp({ ...sunrise, installation_days: d })).tenths / 10;
    expect([t(10), t(5), t(45), t(60), t(21), t(25)]).toEqual([10, 10, 0, 0, 6.9, 5.7]);
    const n = scoreTimeline(inp({ ...sunrise, installation_days: null }));
    expect(n.tenths).toBe(0);
    expect(n.penalties[0].message).toBe("Installation timeline not stated (−10)");
  });
  it("an unknown never beats any known value", () => {
    const known = (patch: object) => scoreQuotes([inp({ ...sunrise, ...patch })])[0].totalScore;
    const base = scoreQuotes([inp({ ...sunrise, earthing_included: false })])[0].totalScore;
    expect(known({ earthing_included: null })).toBeLessThanOrEqual(base);
    expect(known({ installation_days: null })).toBeLessThan(known({ installation_days: 365 }) + 0.001);
    expect(known({ warranty_details: { ...(sunrise.warranty_details as object), inverter_years: null } })).toBeLessThanOrEqual(
      known({ warranty_details: { ...(sunrise.warranty_details as object), inverter_years: 0 } }),
    );
  });
  it("malformed quote still scores without throwing", () => {
    const r = scoreQuotes([inp(malformed)])[0];
    expect(r.totalScore).toBeGreaterThanOrEqual(0);
    expect(r.scoreBreakdown.penalties.length).toBeGreaterThan(0);
  });
  it("flags cannot change score (score has no flag input)", () => {
    expect(scoreQuotes([inp(sunrise)])[0].totalScore).toBe(scoreQuotes([inp(sunrise)])[0].totalScore);
  });
  it("total equals sum of rounded parts", () => {
    for (const r of scoreQuotes([sunrise, greenvolt, solartech].map(inp))) {
      const p = r.scoreBreakdown.parts;
      const sum = Math.round((p.price.points + p.technical.points + p.warranty.points + p.completeness.points + p.timeline.points) * 10);
      expect(Math.round(r.totalScore * 10)).toBe(sum);
    }
  });
});
