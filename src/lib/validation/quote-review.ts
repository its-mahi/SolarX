// Defensive per-field parsers for stored quote jsonb plus the comparison request schemas (specs/006 R-02).
// A bad field becomes null (unknown); it never throws and never defaults to 0.
import { z } from "zod";
import { uuidSchema } from "./common";

export const compareQuotesRequestSchema = z.strictObject({ requestId: uuidSchema });
export const requestIdParamSchema = uuidSchema;

const text = z.string().trim().min(1).max(120);
const wattage = z.number().finite().gt(0).max(1000);
const quantity = z.number().int().gt(0).max(1000);
const capacity = z.number().finite().gt(0).max(100);
const warrantyYears = z.number().int().min(0).max(40);
const days = z.number().int().gt(0).max(365);
const certs = z.array(z.string().trim().min(1).max(120)).min(1).max(10);
const bool = z.boolean();

function parse<T>(schema: z.ZodType<T>, value: unknown): T | null {
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}

export const parseText = (v: unknown) => parse(text, v);
export const parseWattage = (v: unknown) => parse(wattage, v);
export const parseQuantity = (v: unknown) => parse(quantity, v);
export const parseCapacityKw = (v: unknown) => parse(capacity, v);
export const parseWarrantyYears = (v: unknown) => parse(warrantyYears, v);
export const parseInstallationDays = (v: unknown) => parse(days, v);
export const parseCertifications = (v: unknown) => parse(certs, v);
export const parseBoolean = (v: unknown) => parse(bool, v);

export function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
