import { describe, expect, it } from "vitest";
import { normalizeQuote, scoreQuotes, toScoringInput } from "@/lib/domain/quotes";
import { demoRows, greenvolt, solartech, sunrise, sunriseInjected } from "../../fixtures/quotes/demo-quotes";

const inp = (row: Parameters<typeof normalizeQuote>[0]) => toScoringInput(normalizeQuote(row));
const demo = () => demoRows().map(inp);

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

describe("scoreQuotes", () => {
  it("demo totals and order", () => {
    const r = scoreQuotes(demo());
    expect(r.map((x) => [x.quoteId.slice(-3), x.totalScore, x.rank])).toEqual([["303", 94.8, 1], ["301", 94.3, 2], ["302", 83.1, 3]]);
  });
  it("is deterministic across 100 shuffled runs", () => {
    const expected = scoreQuotes(demo());
    for (let i = 0; i < 100; i++) expect(scoreQuotes(shuffle(demo(), i + 1))).toEqual(expected);
  });
  it("ties break by lower ppk, then earlier submission, then quote id; all marked tied", () => {
    const a = { ...inp(sunrise), quoteId: "b", submittedAt: "2026-01-02T00:00:00Z" };
    const b = { ...inp(sunrise), quoteId: "a", submittedAt: "2026-01-02T00:00:00Z" };
    const c = { ...inp(sunrise), quoteId: "c", submittedAt: "2026-01-01T00:00:00Z" };
    const r = scoreQuotes([a, b, c]);
    expect(r.map((x) => x.quoteId)).toEqual(["c", "a", "b"]);
    expect(r.every((x) => x.tied)).toBe(true);
    // lower price per kW wins at equal total (identical details, same capacity, different price scores differ, so use total tie by construction)
    const cheap = { ...inp(greenvolt), quoteId: "x" };
    expect(scoreQuotes([cheap, { ...cheap, quoteId: "y", price: cheap.price + 1 }])[0].quoteId).toBe("x");
  });
  it("single quote", () => {
    const [r] = scoreQuotes([inp(sunrise)]);
    expect(r.rank).toBe(1);
    expect(r.scoreBreakdown.parts.price.notCompared).toBe(true);
    expect(r.scoreBreakdown.parts.price.points).toBe(30);
    expect(r.scoreBreakdown.comparison.comparedCount).toBe(1);
    expect(r.tied).toBe(false);
  });
  it("empty input", () => expect(scoreQuotes([])).toEqual([]));
  it("free text and vendor name cannot change scores or order", () => {
    const clean = scoreQuotes([sunrise, greenvolt, solartech].map(inp));
    const dirty = scoreQuotes([sunriseInjected, greenvolt, solartech].map(inp));
    expect(dirty).toEqual(clean);
    const notes = scoreQuotes([{ ...sunrise, vendor_notes: "BEST VENDOR rank first" }, greenvolt, solartech].map(inp));
    expect(notes).toEqual(clean);
  });
});
