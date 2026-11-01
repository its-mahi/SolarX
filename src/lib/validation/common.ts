// Shared Zod primitives mirroring the database CHECK constraints (data-model.md).
import { z } from "zod";

export const uuidSchema = z.uuid();

/** Money: integer rupees, never negative. */
export const inrAmountSchema = z.number().int().min(0);

/** Capacity in kW: positive, at most two decimals. */
export const kwCapacitySchema = z
  .number()
  .positive()
  .refine((v) => Math.round(v * 100) === v * 100, "Use at most two decimal places");

export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);

/**
 * Indian mobile number. Accepts "9876543210", "+91 98765 43210", "+919876543210",
 * "091-98765-43210"; first digit 6–9. Output is normalized to "+91XXXXXXXXXX".
 */
export const indianPhoneSchema = z
  .string()
  .trim()
  .transform((raw, ctx) => {
    const digits = raw.replace(/[\s\-()]/g, "");
    const match = /^(?:\+91|0?91|0)?([6-9]\d{9})$/.exec(digits);
    if (!match) {
      ctx.addIssue({ code: "custom", message: "Enter a 10-digit Indian mobile number" });
      return z.NEVER;
    }
    return `+91${match[1]}`;
  });

/** Trimmed text with an inclusive length range applied after trimming. */
export function trimmedText(min: number, max: number) {
  return z
    .string()
    .trim()
    .min(min, min === 1 ? "This field is required" : `Use at least ${min} characters`)
    .max(max, `Use at most ${max} characters`);
}
