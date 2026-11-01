// Request/response schemas for POST /api/solar/calculate (contracts/solar-calculate.md).
import { z } from "zod";
import { uuidSchema } from "./common";

export const ESTIMATE_DISCLAIMER =
  "Estimates only. Subsidy eligibility, approval and payment are decided under the official PM Surya Ghar scheme; SURYAMIT does not guarantee them.";

export const estimateInputsSchema = z.strictObject({
  monthlyUnits: z.number("Enter a number").gt(0, "Must be greater than 0").lte(10000, "Must be 10,000 or less"),
  monthlyBill: z.number().int("Use a whole number").min(0, "Must be 0 or more").max(1_000_000, "Must be 1,000,000 or less").nullable().optional(),
  budget: z.number().int("Use a whole number").min(0, "Must be 0 or more").max(10_000_000, "Must be 10,000,000 or less").nullable().optional(),
  preferredCapacityKw: z.number().gt(0, "Must be greater than 0").lte(100, "Must be 100 or less").nullable().optional(),
});

/** Exactly one of `requestId` (stored inputs) or `inputs` (never saved). */
export const calculateRequestSchema = z
  .strictObject({
    requestId: uuidSchema.optional(),
    inputs: estimateInputsSchema.optional(),
    capacityOverrideKw: z.number("Enter a number").optional(),
  })
  .superRefine((v, ctx) => {
    const hasId = v.requestId !== undefined;
    const hasInputs = v.inputs !== undefined;
    if (hasId === hasInputs) {
      ctx.addIssue({ code: "custom", path: [], message: "Send either requestId or inputs, not both and not neither" });
    }
  });
export type CalculateRequest = z.infer<typeof calculateRequestSchema>;

export const solarEstimateAssumptionsSchema = z.object({
  inputs: z.object({
    monthlyUnits: z.number(),
    monthlyBill: z.number().nullable(),
    budget: z.number().nullable(),
    preferredCapacityKw: z.number().nullable(),
  }),
  annualConsumptionKwh: z.number(),
  recommendedCapacityKw: z.number(),
  capacityBasis: z.enum(["preferred", "recommended", "preview"]),
  generationKwhPerKwYear: z.number(),
  benchmarkCostPerKw: z.number(),
  tariffPerKwh: z.number(),
  tariffBasis: z.enum(["default", "derived_from_bill", "derived_from_bill_clamped"]),
  selfConsumptionShare: z.number().min(0).max(1),
  exportRatePerKwh: z.number(),
  selfConsumedKwh: z.number(),
  exportedKwh: z.number(),
  cfaSlabs: z.array(z.object({ fromKw: z.number(), toKw: z.number(), ratePerKw: z.number() })),
  cfaCap: z.number(),
  illustrativeRuleKeys: z.array(z.string()),
  notes: z.array(z.string()),
});

export const solarEstimateSchema = z.object({
  requestId: z.string().nullable(),
  capacityKw: z.number(),
  recommendedCapacityKw: z.number(),
  capacityBasis: z.enum(["preferred", "recommended", "preview"]),
  installationCost: z.number().int(),
  subsidyEstimate: z.number().int(),
  netCost: z.number().int(),
  annualGenerationKwh: z.number().int(),
  annualSavingsEstimate: z.number().int(),
  paybackYears: z.number().nullable(),
  ruleVersion: z.string(),
  assumptions: solarEstimateAssumptionsSchema,
  updatedAt: z.string().optional(),
});
export type SolarEstimateDto = z.infer<typeof solarEstimateSchema>;
