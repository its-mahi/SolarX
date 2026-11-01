import { describe, expect, it } from "vitest";
import { detectMissingFields, normalizeQuote, toScoringInput } from "@/lib/domain/quotes";
import { greenvolt, malformed, solartech, sunrise } from "../../fixtures/quotes/demo-quotes";

const missing = (row: Parameters<typeof normalizeQuote>[0]) => detectMissingFields(toScoringInput(normalizeQuote(row)));

describe("detectMissingFields", () => {
  it("none for SunRise and SolarTech", () => {
    expect(missing(sunrise)).toEqual([]);
    expect(missing(solartech)).toEqual([]);
  });
  it("GreenVolt misses workmanship and earthing in fixed order", () => {
    expect(missing(greenvolt)).toEqual(["warrantyWorkmanship", "earthingStated"]);
  });
  it("earthing false is stated; 0-year warranty is stated; empty certifications is missing", () => {
    expect(missing({ ...sunrise, earthing_included: false })).toEqual([]);
    expect(missing({ ...sunrise, warranty_details: { ...(sunrise.warranty_details as object), inverter_years: 0 } })).toEqual([]);
    expect(missing({ ...sunrise, panel_details: { ...(sunrise.panel_details as object), certifications: [] } })).toEqual(["panelCertifications"]);
  });
  it("malformed fixture lists each malformed item", () => {
    expect(missing(malformed)).toEqual([
      "panelBrand", "panelWattage", "panelQuantity", "panelCertifications",
      "inverterBrand", "inverterType", "inverterCapacity",
      "warrantyPanelProduct", "warrantyPanelPerformance", "warrantyWorkmanship",
      "installationDays", "earthingStated", "documentationStated",
    ]);
  });
});
