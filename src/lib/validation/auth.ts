// Auth request schemas (contracts/auth-api.md). All object schemas are strict.
import { z } from "zod";
import { DEMO_ACCOUNT_KEYS } from "@/lib/auth/demo-account-options";
import { indianPhoneSchema, latitudeSchema, longitudeSchema, trimmedText } from "./common";

export const demoSignInSchema = z.strictObject({
  account: z.enum(DEMO_ACCOUNT_KEYS),
});
export type DemoSignInInput = z.infer<typeof demoSignInSchema>;

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Use at most 254 characters")
  .pipe(z.email("Enter a valid email address"));

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use at most 72 characters");

const optionalPhone = z
  .union([indianPhoneSchema, z.literal("").transform(() => null), z.null()])
  .optional()
  .transform((v) => v ?? null);

const commonFields = {
  name: trimmedText(1, 100),
  email: emailSchema,
  password: passwordSchema,
  phone: optionalPhone,
};

const householdSignUp = z.strictObject({
  role: z.literal("household"),
  ...commonFields,
});

const vendorSignUp = z
  .strictObject({
    role: z.literal("vendor"),
    ...commonFields,
    company_name: trimmedText(2, 120),
    service_area: trimmedText(2, 200),
    latitude: latitudeSchema.nullable().optional(),
    longitude: longitudeSchema.nullable().optional(),
    service_radius_km: z.number().int("Use a whole number").min(1).max(500).optional().default(25),
  })
  .superRefine((v, ctx) => {
    const hasLat = v.latitude !== undefined && v.latitude !== null;
    const hasLng = v.longitude !== undefined && v.longitude !== null;
    if (hasLat !== hasLng) {
      ctx.addIssue({ code: "custom", path: [hasLat ? "longitude" : "latitude"], message: "Enter both latitude and longitude, or neither" });
    }
  });

export const signUpSchema = z.discriminatedUnion("role", [householdSignUp, vendorSignUp]);
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(72, "Use at most 72 characters"),
});
export type SignInInput = z.infer<typeof signInSchema>;
