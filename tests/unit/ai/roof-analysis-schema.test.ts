import { describe, expect, it } from "vitest";
import { normalizeRoofAnalysis, RoofAnalysisOutputSchema, STANDARD_ROOF_LIMITATIONS } from "@/lib/ai/schemas/roof-analysis";
import { extractJsonObject } from "@/lib/ai/json";
import * as f from "../../fixtures/roof/ai-outputs";

const parse = (v: unknown) => RoofAnalysisOutputSchema.safeParse(v);

describe("RoofAnalysisOutputSchema", () => {
  it("accepts valid outputs", () => {
    expect(parse(f.validObstructed).success).toBe(true);
    expect(parse(f.validEmpty).success).toBe(true);
    const fenced = extractJsonObject(f.fencedJson);
    expect(fenced.ok && parse(fenced.value).success).toBe(true);
  });

  it("rejects malformed outputs", () => {
    for (const bad of [f.badConfidence, f.badConfidenceWord, f.wrongTypes, f.tooMany, f.tooLong]) {
      expect(parse(bad).success).toBe(false);
    }
    expect(extractJsonObject(f.notJson).ok).toBe(false);
    expect(parse({ ...f.validObstructed, potential_obstructions: ["x".repeat(61)] }).success).toBe(false);
    expect(parse({ ...f.validObstructed, limitations: Array(11).fill("a") }).success).toBe(false);
    expect(parse({ ...f.validObstructed, site_survey_required: "yes" }).success).toBe(false);
  });

  it("strips over-reaching keys so unknowns stay unknown", () => {
    const r = parse(f.overReaching);
    expect(r.success).toBe(true);
    const out = JSON.stringify(r.success ? r.data : {});
    for (const k of ["roof_area_sqm", "capacity_kw", "shading_hours", "area_m2"]) expect(out).not.toContain(k);
  });
});

describe("normalizeRoofAnalysis", () => {
  it("puts standard limitations first, dedupes, forces survey flag", () => {
    const r = parse(f.surveyFalse);
    const n = normalizeRoofAnalysis(r.success ? r.data : (undefined as never));
    expect(n.site_survey_required).toBe(true);
    expect(n.limitations).toEqual([...STANDARD_ROOF_LIMITATIONS]);
    const v = parse({ ...f.validObstructed, limitations: ["shading at different times of day is unknown", "Extra"] });
    const n2 = normalizeRoofAnalysis(v.success ? v.data : (undefined as never));
    expect(n2.limitations).toEqual([...STANDARD_ROOF_LIMITATIONS, "Extra"]);
  });
});
