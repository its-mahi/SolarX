// Quote acceptance schemas (specs/007 data-model.md §4).
import { z } from "zod";
import { inrAmountSchema, kwCapacitySchema, latitudeSchema, longitudeSchema, uuidSchema } from "./common";

/** Explicit confirmation: anything other than `{ confirmed: true }` is rejected. */
export const acceptQuoteBodySchema = z.object({ confirmed: z.literal(true) }).strict();
export const closeRequestBodySchema = z.object({ confirmed: z.literal(true) }).strict();

export const acceptanceResultSchema = z.object({
  acceptance: z.object({
    id: uuidSchema,
    quoteId: uuidSchema,
    requestId: uuidSchema,
    householdId: uuidSchema,
    acceptedAt: z.string(),
  }),
  quote: z.object({ id: uuidSchema, status: z.literal("accepted") }),
  request: z.object({ id: uuidSchema, status: z.literal("accepted") }),
  rejectedQuoteIds: z.array(uuidSchema),
});

export const householdContactSchema = z.object({
  requestId: uuidSchema,
  name: z.string(),
  phone: z.string().nullable(),
  addressText: z.string().nullable(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  locality: z.string().nullable(),
  acceptedAt: z.string(),
});

export const acceptanceSummarySchema = z
  .object({
    quoteId: uuidSchema,
    acceptedAt: z.string(),
    vendor: z.object({ companyName: z.string(), isDemo: z.boolean(), phone: z.string().nullable() }),
    price: inrAmountSchema,
    capacityKw: kwCapacitySchema,
  })
  .nullable();

export type AcceptQuoteBody = z.infer<typeof acceptQuoteBodySchema>;
export type AcceptanceResult = z.infer<typeof acceptanceResultSchema>;
export type HouseholdContact = z.infer<typeof householdContactSchema>;
export type AcceptanceSummary = z.infer<typeof acceptanceSummarySchema>;
