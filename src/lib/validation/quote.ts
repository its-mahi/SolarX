// Quote schemas (specs/005 data-model §2, contracts/quotes.md). Mirrors the quotes table CHECKs.
// Vendor free text is untrusted: it is trimmed and length-limited, never interpreted.
import { z } from "zod";
import { uuidSchema, trimmedText } from "./common";
import { QUOTE_SOURCES, QUOTE_STATUSES, quoteSourceSchema, quoteStatusSchema } from "./enums";
import type { QuoteSource, QuoteStatus, RequestStatus } from "./enums";

export { QUOTE_SOURCES, QUOTE_STATUSES, quoteSourceSchema, quoteStatusSchema };

export const QUOTE_LIMITS = {
  priceMin: 1000,
  priceMax: 10_000_000,
  capacityMaxKw: 100,
  daysMin: 1,
  daysMax: 365,
  warrantyMaxYears: 40,
  wattageMax: 1000,
  quantityMax: 1000,
  shortTextMax: 100,
  certificationMax: 60,
  certificationsMax: 10,
  inclusionMax: 200,
  inclusionsMax: 20,
  longTextMax: 2000,
} as const;

export const INVERTER_TYPES = ["on-grid", "hybrid", "off-grid"] as const;
export const inverterTypeSchema = z.enum(INVERTER_TYPES);
export type InverterType = z.infer<typeof inverterTypeSchema>;

/** Optional trimmed text: empty or whitespace-only becomes null. */
function nullableText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .nullable()
    .transform((v) => (v === "" ? null : v));
}

function nullableInt(min: number, max: number, message: string) {
  return z.number().int("Use a whole number").min(min, message).max(max, message).nullable();
}

/** Positive kW, at most two decimals (tolerant of float noise such as 1.1 * 100). */
const capacityKwSchema = z
  .number("Enter a number")
  .gt(0, "Capacity must be more than 0 kW")
  .max(QUOTE_LIMITS.capacityMaxKw, `Capacity can be at most ${QUOTE_LIMITS.capacityMaxKw} kW`)
  .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, "Use at most two decimal places");

export const panelDetailsSchema = z.strictObject({
  brand: nullableText(QUOTE_LIMITS.shortTextMax).default(null),
  model: nullableText(QUOTE_LIMITS.shortTextMax).default(null),
  wattage: nullableInt(1, QUOTE_LIMITS.wattageMax, `Use 1 to ${QUOTE_LIMITS.wattageMax} Wp`).default(null),
  quantity: nullableInt(1, QUOTE_LIMITS.quantityMax, `Use 1 to ${QUOTE_LIMITS.quantityMax} panels`).default(null),
  technology: nullableText(QUOTE_LIMITS.shortTextMax).default(null),
  certifications: z
    .array(trimmedText(1, QUOTE_LIMITS.certificationMax))
    .max(QUOTE_LIMITS.certificationsMax, `Add at most ${QUOTE_LIMITS.certificationsMax} certifications`)
    .default([]),
});

export const inverterDetailsSchema = z.strictObject({
  brand: nullableText(QUOTE_LIMITS.shortTextMax).default(null),
  model: nullableText(QUOTE_LIMITS.shortTextMax).default(null),
  type: inverterTypeSchema.nullable().default(null),
  capacity_kw: capacityKwSchema.nullable().default(null),
});

const warrantyYears = () =>
  nullableInt(0, QUOTE_LIMITS.warrantyMaxYears, `Use 0 to ${QUOTE_LIMITS.warrantyMaxYears} years`).default(null);

/** Product and performance warranty are deliberately separate keys. */
export const warrantyDetailsSchema = z.strictObject({
  panel_product_years: warrantyYears(),
  performance_years: warrantyYears(),
  inverter_years: warrantyYears(),
  workmanship_years: warrantyYears(),
});

/** Reusable form content (also the target of 009's extraction pre-fill). */
export const quoteFieldsSchema = z.strictObject({
  price: z
    .number("Enter the total price in rupees")
    .int("Use a whole number of rupees")
    .min(QUOTE_LIMITS.priceMin, `Price must be at least ₹${QUOTE_LIMITS.priceMin.toLocaleString("en-IN")}`)
    .max(QUOTE_LIMITS.priceMax, `Price can be at most ₹${QUOTE_LIMITS.priceMax.toLocaleString("en-IN")}`),
  capacity_kw: capacityKwSchema,
  panel_details: panelDetailsSchema,
  inverter_details: inverterDetailsSchema,
  warranty_details: warrantyDetailsSchema,
  installation_days: z
    .number("Enter the number of days")
    .int("Use a whole number of days")
    .min(QUOTE_LIMITS.daysMin, `Use ${QUOTE_LIMITS.daysMin} to ${QUOTE_LIMITS.daysMax} days`)
    .max(QUOTE_LIMITS.daysMax, `Use ${QUOTE_LIMITS.daysMin} to ${QUOTE_LIMITS.daysMax} days`),
  earthing_included: z.boolean().nullable(),
  documentation_included: z.boolean().nullable(),
  other_inclusions: z
    .array(trimmedText(1, QUOTE_LIMITS.inclusionMax))
    .max(QUOTE_LIMITS.inclusionsMax, `Add at most ${QUOTE_LIMITS.inclusionsMax} inclusions`),
  exclusions: nullableText(QUOTE_LIMITS.longTextMax).optional().default(null),
  vendor_notes: nullableText(QUOTE_LIMITS.longTextMax).optional().default(null),
});
export type QuoteFields = z.output<typeof quoteFieldsSchema>;
export type QuoteFieldsInput = z.input<typeof quoteFieldsSchema>;

/** POST /api/quotes body. Strict: status, source and vendor_id cannot be supplied. */
export const quoteSubmissionSchema = quoteFieldsSchema.extend({ request_id: uuidSchema });
export type QuoteSubmission = z.output<typeof quoteSubmissionSchema>;

export const myQuotesQuerySchema = z.strictObject({
  status: quoteStatusSchema.optional(),
  request_id: uuidSchema.optional(),
});
export type MyQuotesQuery = z.infer<typeof myQuotesQuerySchema>;

export const quoteIdParamSchema = z.strictObject({ id: uuidSchema });

/** POST /api/quotes/:id/withdraw body: none; an empty object is accepted, any key is rejected. */
export const withdrawBodySchema = z.strictObject({});

export type QuoteRecord = QuoteFields & {
  id: string;
  request_id: string;
  source: QuoteSource;
  status: QuoteStatus;
  created_at: string;
  updated_at: string;
};

export type VendorQuoteHistoryItem = QuoteRecord & {
  request: { id: string; locality: string; status: RequestStatus };
};
