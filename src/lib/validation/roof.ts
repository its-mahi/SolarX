// Zod schemas for the roof analysis API (specs/008-roof-photo-analysis/contracts).
import { z } from "zod";

export const RoofAnalyzeRequestSchema = z.object({ request_id: z.string().uuid() }).strict();

const ObservationDtoSchema = z.object({
  object: z.string(),
  description: z.string(),
  potential_impact: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
});

/** Never includes failure_reason or the storage path. */
export const RoofAssessmentDtoSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  status: z.literal("completed"),
  observations: z.array(ObservationDtoSchema),
  potential_obstructions: z.array(z.string()),
  limitations: z.array(z.string()),
  site_survey_required: z.literal(true),
  model: z.string().nullable(),
  prompt_version: z.string(),
  is_current_photo: z.boolean(),
  created_at: z.string(),
});

export const RoofAssessmentStateDtoSchema = z.object({
  request: z.object({ has_roof_photo: z.boolean(), ai_consent: z.boolean(), analyzable: z.boolean() }),
  latest_completed: RoofAssessmentDtoSchema.nullable(),
  latest_attempt: z
    .object({ id: z.string(), status: z.enum(["completed", "failed"]), created_at: z.string() })
    .nullable(),
});

export type RoofAssessmentDto = z.infer<typeof RoofAssessmentDtoSchema>;
export type RoofAssessmentStateDto = z.infer<typeof RoofAssessmentStateDtoSchema>;
