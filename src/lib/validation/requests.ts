// Request/response schemas for the household request API (002 data-model.md, contracts/requests-api.md).
import { z } from "zod";
import { inrAmountSchema, trimmedText, uuidSchema } from "./common";
import { requestStatusSchema } from "./enums";

export const INDIA_BOUNDS = { latMin: 6.5, latMax: 37.5, lngMin: 68, lngMax: 97.5 } as const;
const INDIA_MESSAGE = "SURYAMIT currently supports locations in India";

export const ROOF_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const ROOF_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ROOF_PHOTO_MAX_DIMENSION = 2048;

const indiaLatitude = z
  .number("Enter a number")
  .min(INDIA_BOUNDS.latMin, INDIA_MESSAGE)
  .max(INDIA_BOUNDS.latMax, INDIA_MESSAGE);
const indiaLongitude = z
  .number("Enter a number")
  .min(INDIA_BOUNDS.lngMin, INDIA_MESSAGE)
  .max(INDIA_BOUNDS.lngMax, INDIA_MESSAGE);

const wholeNumber = (min: number, max: number) =>
  z.number("Enter a number").int("Use a whole number").min(min, `Must be ${min} or more`).max(max, `Must be ${max} or less`);

const capacityKw = z
  .number("Enter a number")
  .min(0.5, "Must be 0.5 kW or more")
  .max(20, "Must be 20 kW or less")
  .refine((v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9, "Use steps of 0.1 kW");

const bothOrNeither = (v: { latitude?: unknown; longitude?: unknown }, ctx: z.RefinementCtx) => {
  const hasLat = v.latitude !== undefined && v.latitude !== null;
  const hasLng = v.longitude !== undefined && v.longitude !== null;
  if (hasLat !== hasLng) {
    ctx.addIssue({
      code: "custom",
      path: [hasLat ? "longitude" : "latitude"],
      message: "Latitude and longitude must be given together",
    });
  }
};

export const locationFieldsSchema = z
  .strictObject({
    latitude: indiaLatitude,
    longitude: indiaLongitude,
    address_text: trimmedText(5, 300),
    locality: trimmedText(2, 100),
  });

export const usageFieldsSchema = z.strictObject({
  monthly_units: wholeNumber(1, 10000),
  monthly_bill: wholeNumber(0, 100000).nullable(),
  budget: wholeNumber(10000, 5000000),
  preferred_capacity_kw: capacityKw.nullable(),
});
export type UsageFields = z.infer<typeof usageFieldsSchema>;

const draftShape = {
  latitude: indiaLatitude.nullable(),
  longitude: indiaLongitude.nullable(),
  address_text: trimmedText(5, 300).nullable(),
  locality: trimmedText(2, 100).nullable(),
  monthly_units: usageFieldsSchema.shape.monthly_units.nullable(),
  monthly_bill: usageFieldsSchema.shape.monthly_bill,
  budget: usageFieldsSchema.shape.budget.nullable(),
  preferred_capacity_kw: usageFieldsSchema.shape.preferred_capacity_kw,
  ai_consent: z.boolean(),
};

export const draftFieldsSchema = z.strictObject(draftShape).partial().superRefine(bothOrNeither);
export type DraftFields = z.infer<typeof draftFieldsSchema>;

export const createRequestSchema = draftFieldsSchema;

export const updateDraftSchema = draftFieldsSchema.refine((v) => Object.keys(v).length > 0, {
  message: "Provide at least one field to update",
});

export const consentWithdrawalSchema = z.strictObject({ ai_consent: z.literal(false) });

export const requestIdParamSchema = z.object({ id: uuidSchema });

/** Response shape for the owner (contracts/requests-api.md). `roof_photo_path` is never exposed. */
export const householdRequestDtoSchema = z.object({
  id: uuidSchema,
  status: requestStatusSchema,
  address_text: z.string().nullable(),
  locality: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  monthly_units: inrAmountSchema.nullable(),
  monthly_bill: inrAmountSchema.nullable(),
  budget: inrAmountSchema.nullable(),
  preferred_capacity_kw: z.number().nullable(),
  ai_consent: z.boolean(),
  has_roof_photo: z.boolean(),
  roof_photo_url: z.string().nullable(),
  roof_photo_url_expires_at: z.string().nullable(),
  missing_publish_fields: z.array(z.enum(["location", "address_text", "locality", "monthly_units", "budget", "roof_photo"])),
  next_action: z.object({
    kind: z.enum(["continue", "wait", "compare", "next_steps", "view"]),
    label: z.string(),
    step: z.enum(["location", "photo", "usage", "review"]).optional(),
  }),
  created_at: z.string(),
  updated_at: z.string(),
});
export type HouseholdRequestDto = z.infer<typeof householdRequestDtoSchema>;
