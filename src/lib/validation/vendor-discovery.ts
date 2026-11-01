// Vendor request discovery: filter schema, id param and response shapes (004 data-model §5, §6).
import { z } from "zod";
import { uuidSchema } from "./common";

export const requestIdParamSchema = uuidSchema;

/** Query-string values arrive as strings; blank means "not set". Non-numeric text stays a string so Zod rejects it. */
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const numeric = (v: unknown) => {
  const b = blankToUndefined(v);
  if (typeof b === "string") {
    const n = Number(b);
    return Number.isNaN(n) ? b : n;
  }
  return b;
};

const optionalNumber = (min: number, max: number, label: string) =>
  z.preprocess(
    numeric,
    z
      .number(`${label} must be a number`)
      .min(min, `${label} must be at least ${min}`)
      .max(max, `${label} must be at most ${max}`)
      .optional(),
  );

const optionalInt = (min: number, max: number, label: string) =>
  z.preprocess(
    numeric,
    z
      .number(`${label} must be a number`)
      .int(`${label} must be a whole number`)
      .min(min, `${label} must be at least ${min}`)
      .max(max, `${label} must be at most ${max}`)
      .optional(),
  );

const maxDistance = z.preprocess(
  (v) => {
    const b = blankToUndefined(v);
    return b === "any" ? "any" : numeric(b);
  },
  z
    .union([
      z.literal("any"),
      z
        .number("Distance must be a number or \"any\"")
        .gt(0, "Distance must be more than 0 km")
        .max(500, "Distance must be at most 500 km"),
    ])
    .optional(),
);

export const vendorRequestFiltersSchema = z
  .object({
    max_distance_km: maxDistance,
    locality: z.preprocess(
      blankToUndefined,
      z.string().trim().min(1, "Locality is required").max(100, "Locality must be at most 100 characters").optional(),
    ),
    min_capacity_kw: optionalNumber(0, 100, "Capacity"),
    max_capacity_kw: optionalNumber(0, 100, "Capacity"),
    min_budget: optionalInt(0, 10_000_000, "Budget"),
    max_budget: optionalInt(0, 10_000_000, "Budget"),
    sort: z.preprocess(blankToUndefined, z.enum(["distance", "newest"]).optional()),
  })
  .superRefine((v, ctx) => {
    if (v.min_capacity_kw !== undefined && v.max_capacity_kw !== undefined && v.min_capacity_kw > v.max_capacity_kw) {
      ctx.addIssue({ code: "custom", path: ["min_capacity_kw"], message: "must be ≤ max_capacity_kw" });
    }
    if (v.min_budget !== undefined && v.max_budget !== undefined && v.min_budget > v.max_budget) {
      ctx.addIssue({ code: "custom", path: ["min_budget"], message: "must be ≤ max_budget" });
    }
  });

export type VendorRequestFilters = z.infer<typeof vendorRequestFiltersSchema>;

export const FILTER_KEYS = [
  "max_distance_km",
  "locality",
  "min_capacity_kw",
  "max_capacity_kw",
  "min_budget",
  "max_budget",
  "sort",
] as const;

/** Picks the known filter params from URLSearchParams (unknown params are ignored). */
export function filtersInputFromSearchParams(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of FILTER_KEYS) {
    const value = params.get(key);
    if (value !== null) out[key] = value;
  }
  return out;
}

const roofObservationsSchema = z.unknown();

export const vendorRequestSummarySchema = z.object({
  id: z.string(),
  status: z.enum(["open", "quoted"]),
  locality: z.string().nullable(),
  approx_latitude: z.number(),
  approx_longitude: z.number(),
  distance_km: z.number().nullable(),
  within_service_area: z.boolean().nullable(),
  monthly_units: z.number().nullable(),
  budget: z.number().nullable(),
  preferred_capacity_kw: z.number().nullable(),
  has_roof_photo: z.boolean(),
  is_demo: z.boolean(),
  created_at: z.string(),
});
export type VendorRequestSummary = z.infer<typeof vendorRequestSummarySchema>;

export const vendorRoofAssessmentSchema = z.object({
  observations: roofObservationsSchema,
  potential_obstructions: roofObservationsSchema,
  limitations: roofObservationsSchema,
  site_survey_required: z.boolean(),
  assessed_at: z.string(),
});
export type VendorRoofAssessment = z.infer<typeof vendorRoofAssessmentSchema>;

export const vendorRequestDetailSchema = vendorRequestSummarySchema.extend({
  roof_photo_status: z.enum(["available", "unavailable", "none"]),
  roof_photo: z.object({ url: z.string(), expires_at: z.string() }).nullable(),
  roof_assessment: vendorRoofAssessmentSchema.nullable(),
});
export type VendorRequestDetail = z.infer<typeof vendorRequestDetailSchema>;

export type VendorDiscoveryContext = {
  service_area: string | null;
  base_latitude: number | null;
  base_longitude: number | null;
  service_radius_km: number | null;
};
