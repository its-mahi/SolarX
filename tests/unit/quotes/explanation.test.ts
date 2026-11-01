import { describe, expect, it } from "vitest";
import { buildExplanation, normalizeQuote, scoreQuotes, toScoringInput } from "@/lib/domain/quotes";
import { demoRows, sunrise, sunriseInjected } from "../../fixtures/quotes/demo-quotes";

const inp = (row: Parameters<typeof normalizeQuote>[0]) => toScoringInput(normalizeQuote(row));
const MIN = 142000 / 3;

describe("buildExplanation", () => {
  const reviews = scoreQuotes(demoRows().map(inp));
  const byId = (s: string) => reviews.find((r) => r.quoteId.endsWith(s))!;
  it("SolarTech", () =>
    expect(buildExplanation(byId("303"), { minPricePerKw: MIN, missingCount: 0 })).toBe(
      "Highest comparison score. Price per kW 21% above the lowest. All recommended details provided."));
  it("SunRise", () =>
    expect(buildExplanation(byId("301"), { minPricePerKw: MIN, missingCount: 0 })).toBe(
      "Rank 2 of 3. Price per kW 6% above the lowest. All recommended details provided."));
  it("GreenVolt", () =>
    expect(buildExplanation(byId("302"), { minPricePerKw: MIN, missingCount: 2 })).toBe(
      "Rank 3 of 3. Lowest price per kW. 2 recommended details not stated. Earthing not stated (−5)."));
  it("single quote, bounded, no vendor text", () => {
    const [r] = scoreQuotes([inp(sunriseInjected)]);
    const text = buildExplanation(r, { minPricePerKw: r.pricePerKw, missingCount: 0 });
    expect(text.startsWith("Only quote received")).toBe(true);
    expect(text.length).toBeLessThanOrEqual(500);
    expect(text).not.toMatch(/ignore previous/);
    void sunrise;
  });
});
