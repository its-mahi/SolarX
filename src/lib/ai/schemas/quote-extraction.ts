// Quote extraction output handling (specs/009 contracts/quote-extraction-output.md).
// Stage A: envelope must be a JSON object (unknown keys stripped, every value unchecked).
// Stage B: each field is validated on its own; an invalid value becomes null and is reported.
// Stage C: missing_fields is computed here; the model's own list is never read.
import "server-only";
import { z } from "zod";
import { INVERTER_TYPES, QUOTE_LIMITS } from "@/lib/validation/quote";

export const QUOTE_FIELD_PATHS = [
  "price_inr",
  "capacity_kw",
  "panel_details.brand",
  "panel_details.wattage",
  "panel_details.quantity",
  "inverter_details.brand",
  "inverter_details.type",
  "warranty_details.panel_product_years",
  "warranty_details.performance_years",
  "warranty_details.inverter_years",
  "installation_days",
  "earthing_included",
  "documentation_included",
] as const;
export type QuoteFieldPath = (typeof QUOTE_FIELD_PATHS)[number];

/** Every key is accepted as-is; anything else (rank, score, recommended, ...) is stripped by Zod. */
export const QuoteExtractionEnvelopeSchema = z.object({
  vendor_name: z.unknown().optional(),
  price_inr: z.unknown().optional(),
  capacity_kw: z.unknown().optional(),
  panel_details: z.unknown().optional(),
  inverter_details: z.unknown().optional(),
  warranty_details: z.unknown().optional(),
  installation_days: z.unknown().optional(),
  earthing_included: z.unknown().optional(),
  documentation_included: z.unknown().optional(),
  missing_fields: z.unknown().optional(),
});
export type QuoteExtractionEnvelope = z.output<typeof QuoteExtractionEnvelopeSchema>;

export interface QuoteExtractionFields {
  vendor_name: string | null;
  price_inr: number | null;
  capacity_kw: number | null;
  panel_details: { brand: string | null; wattage: number | null; quantity: number | null };
  inverter_details: { brand: string | null; type: string | null };
  warranty_details: {
    panel_product_years: number | null;
    performance_years: number | null;
    inverter_years: number | null;
  };
  installation_days: number | null;
  earthing_included: boolean | null;
  documentation_included: boolean | null;
}

type Check = (v: unknown) => boolean;
const isInt = (min: number, max: number): Check => (v) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const isText = (max: number): Check => (v) => typeof v === "string" && v.trim().length >= 1 && v.trim().length <= max;
const isBool: Check = (v) => typeof v === "boolean";
const isCapacity: Check = (v) =>
  typeof v === "number" &&
  Number.isFinite(v) &&
  v > 0 &&
  v <= QUOTE_LIMITS.capacityMaxKw &&
  Math.abs(Math.round(v * 100) - v * 100) < 1e-6;
const isInverterType: Check = (v) => typeof v === "string" && (INVERTER_TYPES as readonly string[]).includes(v);

const RULES: Record<QuoteFieldPath, Check> = {
  price_inr: isInt(QUOTE_LIMITS.priceMin, QUOTE_LIMITS.priceMax),
  capacity_kw: isCapacity,
  "panel_details.brand": isText(80),
  "panel_details.wattage": isInt(1, QUOTE_LIMITS.wattageMax),
  "panel_details.quantity": isInt(1, 500),
  "inverter_details.brand": isText(80),
  "inverter_details.type": isInverterType,
  "warranty_details.panel_product_years": isInt(0, QUOTE_LIMITS.warrantyMaxYears),
  "warranty_details.performance_years": isInt(0, QUOTE_LIMITS.warrantyMaxYears),
  "warranty_details.inverter_years": isInt(0, QUOTE_LIMITS.warrantyMaxYears),
  installation_days: isInt(QUOTE_LIMITS.daysMin, QUOTE_LIMITS.daysMax),
  earthing_included: isBool,
  documentation_included: isBool,
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function read(envelope: QuoteExtractionEnvelope, path: string): { present: boolean; value: unknown; badParent: boolean } {
  const [head, tail] = path.split(".");
  const top = (envelope as Record<string, unknown>)[head];
  if (tail === undefined) return { present: top !== undefined && top !== null, value: top, badParent: false };
  if (top === undefined || top === null) return { present: false, value: undefined, badParent: false };
  if (!isPlainObject(top)) return { present: true, value: undefined, badParent: true };
  const v = top[tail];
  return { present: v !== undefined && v !== null, value: v, badParent: false };
}

function normalise(path: QuoteFieldPath, value: unknown): unknown {
  return typeof value === "string" && path !== "inverter_details.type" ? value.trim() : value;
}

export function sanitizeQuoteExtraction(envelope: QuoteExtractionEnvelope): {
  fields: QuoteExtractionFields;
  discarded_fields: string[];
} {
  const discarded: string[] = [];
  const out: Record<QuoteFieldPath, unknown> = {} as Record<QuoteFieldPath, unknown>;
  for (const path of QUOTE_FIELD_PATHS) {
    const { present, value, badParent } = read(envelope, path);
    if (badParent) {
      out[path] = null;
      discarded.push(path);
    } else if (!present) {
      out[path] = null;
    } else if (RULES[path](value)) {
      out[path] = normalise(path, value);
    } else {
      out[path] = null;
      discarded.push(path);
    }
  }
  const vendorName = envelope.vendor_name;
  const g = <T>(p: QuoteFieldPath) => out[p] as T | null;
  const fields: QuoteExtractionFields = {
    vendor_name: isText(120)(vendorName) ? (vendorName as string).trim() : null,
    price_inr: g("price_inr"),
    capacity_kw: g("capacity_kw"),
    panel_details: { brand: g("panel_details.brand"), wattage: g("panel_details.wattage"), quantity: g("panel_details.quantity") },
    inverter_details: { brand: g("inverter_details.brand"), type: g("inverter_details.type") },
    warranty_details: {
      panel_product_years: g("warranty_details.panel_product_years"),
      performance_years: g("warranty_details.performance_years"),
      inverter_years: g("warranty_details.inverter_years"),
    },
    installation_days: g("installation_days"),
    earthing_included: g("earthing_included"),
    documentation_included: g("documentation_included"),
  };
  return { fields, discarded_fields: discarded };
}

export function getFieldValue(fields: QuoteExtractionFields, path: QuoteFieldPath): unknown {
  const [head, tail] = path.split(".");
  const top = (fields as unknown as Record<string, unknown>)[head];
  return tail === undefined ? top : (top as Record<string, unknown>)[tail];
}

/** Paths whose value is null after sanitising. Deterministic: the model's list is ignored. */
export function computeMissingFields(fields: QuoteExtractionFields): QuoteFieldPath[] {
  return QUOTE_FIELD_PATHS.filter((p) => getFieldValue(fields, p) === null);
}

export interface QuoteFormPrefill {
  price: number | null;
  capacity_kw: number | null;
  panel_details: { brand: string | null; wattage: number | null; quantity: number | null };
  inverter_details: { brand: string | null; type: string | null };
  warranty_details: {
    panel_product_years: number | null;
    performance_years: number | null;
    inverter_years: number | null;
  };
  installation_days: number | null;
  earthing_included: boolean | null;
  documentation_included: boolean | null;
  source: "ai_extracted";
  source_document_path: string;
}

/** vendor_name is informational only and never part of the prefill. */
export function toQuoteFormPrefill(fields: QuoteExtractionFields, sourceDocumentPath: string): QuoteFormPrefill {
  return {
    price: fields.price_inr,
    capacity_kw: fields.capacity_kw,
    panel_details: { ...fields.panel_details },
    inverter_details: { ...fields.inverter_details },
    warranty_details: { ...fields.warranty_details },
    installation_days: fields.installation_days,
    earthing_included: fields.earthing_included,
    documentation_included: fields.documentation_included,
    source: "ai_extracted",
    source_document_path: sourceDocumentPath,
  };
}

const nullableNumber = { type: ["number", "null"] };
const nullableString = { type: ["string", "null"] };
const nullableBool = { type: ["boolean", "null"] };

/** Hint for the provider's JSON mode; the sanitiser above remains the authority. */
export const QUOTE_EXTRACTION_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    vendor_name: nullableString,
    price_inr: nullableNumber,
    capacity_kw: nullableNumber,
    panel_details: {
      type: "object",
      properties: { brand: nullableString, wattage: nullableNumber, quantity: nullableNumber },
    },
    inverter_details: {
      type: "object",
      properties: { brand: nullableString, type: { type: ["string", "null"], enum: [...INVERTER_TYPES, null] } },
    },
    warranty_details: {
      type: "object",
      properties: {
        panel_product_years: nullableNumber,
        performance_years: nullableNumber,
        inverter_years: nullableNumber,
      },
    },
    installation_days: nullableNumber,
    earthing_included: nullableBool,
    documentation_included: nullableBool,
    missing_fields: { type: "array", items: { type: "string" } },
  },
};
