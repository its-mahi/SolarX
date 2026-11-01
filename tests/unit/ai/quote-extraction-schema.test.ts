import { describe, expect, it } from "vitest";
import {
  computeMissingFields,
  QUOTE_FIELD_PATHS,
  QuoteExtractionEnvelopeSchema,
  sanitizeQuoteExtraction,
  toQuoteFormPrefill,
} from "@/lib/ai/schemas/quote-extraction";
import { extractJsonObject } from "@/lib/ai/json";
import * as out from "../../fixtures/quotes/extraction-outputs";

const run = (v: unknown) => {
  const env = QuoteExtractionEnvelopeSchema.parse(v);
  const s = sanitizeQuoteExtraction(env);
  return { ...s, missing: computeMissingFields(s.fields) };
};

describe("envelope", () => {
  it("rejects non-object outputs", () => {
    expect(extractJsonObject(out.notJson).ok).toBe(false);
    for (const text of [out.arrayRoot, out.stringRoot]) {
      const j = extractJsonObject(text);
      const ok = j.ok && QuoteExtractionEnvelopeSchema.safeParse(j.value).success;
      expect(ok).toBe(false);
    }
  });
});

describe("field rules", () => {
  it("keeps valid values", () => {
    const r = run(out.greenvoltValid);
    expect(r.fields).toEqual(out.GREENVOLT_EXPECTED_FIELDS);
    expect(r.discarded_fields).toEqual([]);
    expect(r.missing).toEqual(["earthing_included"]);
  });

  it.each([
    ["price_inr", "1.45 lakh"], ["price_inr", -5], ["price_inr", 145000.5], ["price_inr", 0],
    ["capacity_kw", "3kW"], ["capacity_kw", 500], ["capacity_kw", 0], ["capacity_kw", 3.456],
    ["installation_days", "2 weeks"], ["installation_days", 0],
    ["earthing_included", "yes"], ["documentation_included", 1],
  ])("discards %s = %j", (key, value) => {
    const r = run({ ...out.greenvoltValid, [key]: value });
    expect(r.discarded_fields).toEqual([key]);
    expect((r.fields as unknown as Record<string, unknown>)[key]).toBeNull();
  });

  it.each([
    ["panel_details", "wattage", "550W"], ["panel_details", "wattage", 5000], ["panel_details", "quantity", 6.5],
    ["panel_details", "brand", {}], ["inverter_details", "brand", "x".repeat(300)],
    ["inverter_details", "type", "grid-tied"], ["inverter_details", "type", "ON-GRID"],
    ["warranty_details", "performance_years", 300], ["warranty_details", "inverter_years", "25 years"],
  ])("discards %s.%s = %j", (group, key, value) => {
    const base = out.greenvoltValid as unknown as Record<string, Record<string, unknown>>;
    const r = run({ ...out.greenvoltValid, [group]: { ...base[group], [key]: value } });
    expect(r.discarded_fields).toEqual([`${group}.${key}`]);
  });

  it("partialInvalid discards exactly three paths and keeps the rest", () => {
    const r = run(out.partialInvalid);
    expect(r.discarded_fields.sort()).toEqual(["capacity_kw", "inverter_details.type", "price_inr"]);
    expect(r.fields.price_inr).toBeNull();
    expect(r.fields.installation_days).toBe(20);
    expect(r.fields.panel_details.brand).toBe("Demo PV");
  });

  it("nestedNotObject discards the three panel paths", () => {
    const r = run(out.nestedNotObject);
    expect(r.discarded_fields).toEqual(["panel_details.brand", "panel_details.wattage", "panel_details.quantity"]);
  });

  it("allNull has 13 missing and nothing discarded", () => {
    const r = run(out.allNull);
    expect(r.missing).toHaveLength(13);
    expect(r.discarded_fields).toEqual([]);
  });

  it("ignores the model's own missing_fields", () => {
    expect(run(out.lyingMissingList).missing).toEqual(["earthing_included"]);
    expect(run(out.greenvoltAdversarial).missing).toEqual(["earthing_included"]);
  });

  it("drops unknown keys", () => {
    const r = run(out.greenvoltAdversarial);
    expect(JSON.stringify(r.fields)).not.toMatch(/rank|score|recommended|verified|priority/);
    expect(r.fields).toEqual(out.GREENVOLT_EXPECTED_FIELDS);
  });
});

describe("prefill", () => {
  it("maps price_inr to price, excludes vendor_name, sets source", () => {
    const { fields } = run(out.greenvoltValid);
    const p = toQuoteFormPrefill(fields, "u/v/source.txt");
    expect(p.price).toBe(145000);
    expect(p.source).toBe("ai_extracted");
    expect(p.source_document_path).toBe("u/v/source.txt");
    expect(p).not.toHaveProperty("vendor_name");
    expect(QUOTE_FIELD_PATHS).toHaveLength(13);
  });
});
