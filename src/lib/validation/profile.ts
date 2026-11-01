// PATCH /api/me body schemas (contracts/me-api.md). Strict: protected keys are unknown keys.
import { z } from "zod";
import { indianPhoneSchema, latitudeSchema, longitudeSchema, trimmedText } from "./common";

const phoneOrNull = z.union([indianPhoneSchema, z.literal("").transform(() => null), z.null()]);

const profileFields = {
  name: trimmedText(1, 100).optional(),
  phone: phoneOrNull.optional(),
};

const atLeastOne = (v: Record<string, unknown>) => Object.values(v).some((x) => x !== undefined);

export const profileUpdateSchema = z
  .strictObject(profileFields)
  .refine(atLeastOne, { message: "Change at least one field" });
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export const vendorProfileUpdateSchema = z
  .strictObject({
    ...profileFields,
    company_name: trimmedText(2, 120).optional(),
    service_area: trimmedText(2, 200).optional(),
    latitude: latitudeSchema.nullable().optional(),
    longitude: longitudeSchema.nullable().optional(),
    service_radius_km: z.number().int("Use a whole number").min(1, "Use 1 to 500 km").max(500, "Use 1 to 500 km").optional(),
  })
  .refine(atLeastOne, { message: "Change at least one field" })
  .superRefine((v, ctx) => {
    if ((v.latitude === undefined) !== (v.longitude === undefined) || (v.latitude === null) !== (v.longitude === null)) {
      ctx.addIssue({ code: "custom", path: ["longitude"], message: "Enter both latitude and longitude, or neither" });
    }
  });
export type VendorProfileUpdateInput = z.infer<typeof vendorProfileUpdateSchema>;
