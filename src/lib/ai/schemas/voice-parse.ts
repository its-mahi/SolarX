// Strict schema for the voice-parse AI proposal (specs/010 data-model §3). The whole output is
// discarded on any violation; valid output is still only a proposal (see mergeVoiceParse).
import "server-only";
import { z } from "zod";
import { voiceAiIssueKindSchema, voiceFieldKeySchema } from "@/lib/validation/voice";

const proposedNumber = z.number().finite().min(0).nullable();

export const voiceParseAiOutputSchema = z.strictObject({
  monthly_units: proposedNumber,
  monthly_bill: proposedNumber,
  budget: proposedNumber,
  preferred_capacity_kw: proposedNumber,
  issues: z
    .array(z.strictObject({ field: voiceFieldKeySchema, kind: voiceAiIssueKindSchema }))
    .max(8)
    .default([]),
});
export type VoiceParseAiOutput = z.infer<typeof voiceParseAiOutputSchema>;
