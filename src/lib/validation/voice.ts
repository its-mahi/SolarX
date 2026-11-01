// Request/response schemas for POST /api/voice/parse (specs/010 data-model §1, §2, §6).
import { z } from "zod";

export const VOICE_LANGUAGES = ["hi-IN", "gu-IN", "en-IN"] as const;
export const voiceLanguageSchema = z.enum(VOICE_LANGUAGES);
export type VoiceLanguage = z.infer<typeof voiceLanguageSchema>;

export const VOICE_FIELD_KEYS = ["monthly_units", "monthly_bill", "budget", "preferred_capacity_kw"] as const;
export const voiceFieldKeySchema = z.enum(VOICE_FIELD_KEYS);
export type VoiceFieldKey = z.infer<typeof voiceFieldKeySchema>;

export const voiceFieldStatusSchema = z.enum(["heard", "not_heard", "needs_entry"]);
export type VoiceFieldStatus = z.infer<typeof voiceFieldStatusSchema>;

export const voiceFieldSourceSchema = z.enum(["rules", "ai", "both"]);
export type VoiceFieldSource = z.infer<typeof voiceFieldSourceSchema>;

export const voiceFieldNoteSchema = z.enum([
  "conflict",
  "not_in_transcript",
  "out_of_range",
  "range",
  "multiple_values",
  "not_monthly",
  "invalid_format",
]);
export type VoiceFieldNote = z.infer<typeof voiceFieldNoteSchema>;

export const voiceAiStatusSchema = z.enum(["used", "skipped", "not_configured", "unavailable", "invalid_output"]);
export type VoiceAiStatus = z.infer<typeof voiceAiStatusSchema>;

export const voiceAiIssueKindSchema = z.enum(["range", "multiple_values", "not_monthly"]);
export type VoiceAiIssueKind = z.infer<typeof voiceAiIssueKindSchema>;

export const VOICE_TRANSCRIPT_MAX_CHARS = 500;

/**
 * Tabs and line breaks become a single space (so "bill\n2000" keeps its word break); every other
 * control character is removed; the result is trimmed.
 */
export function cleanTranscript(raw: string): string {
  return raw
    .replace(/[\t\n\r]+/g, " ")
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, "")
    .trim();
}

export const voiceParseRequestSchema = z.strictObject({
  transcript: z
    .string("Transcript is required")
    .transform(cleanTranscript)
    .pipe(
      z
        .string()
        .min(1, "Transcript is required")
        .max(VOICE_TRANSCRIPT_MAX_CHARS, `Use at most ${VOICE_TRANSCRIPT_MAX_CHARS} characters`),
    ),
  language: voiceLanguageSchema,
});
export type VoiceParseRequest = z.infer<typeof voiceParseRequestSchema>;

/** `value` non-null iff heard; `source` non-null iff heard; `note` non-null iff needs_entry. */
export const voiceFieldResultSchema = z
  .strictObject({
    status: voiceFieldStatusSchema,
    value: z.number().finite().nullable(),
    source: voiceFieldSourceSchema.nullable(),
    note: voiceFieldNoteSchema.nullable(),
  })
  .superRefine((v, ctx) => {
    const heard = v.status === "heard";
    if (heard !== (v.value !== null)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "value must be set exactly when status is heard" });
    }
    if (heard !== (v.source !== null)) {
      ctx.addIssue({ code: "custom", path: ["source"], message: "source must be set exactly when status is heard" });
    }
    if ((v.status === "needs_entry") !== (v.note !== null)) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "note must be set exactly when status is needs_entry" });
    }
  });
export type VoiceFieldResult = z.infer<typeof voiceFieldResultSchema>;

export const voiceParseResponseSchema = z.strictObject({
  fields: z.strictObject({
    monthly_units: voiceFieldResultSchema,
    monthly_bill: voiceFieldResultSchema,
    budget: voiceFieldResultSchema,
    preferred_capacity_kw: voiceFieldResultSchema,
  }),
  ai_status: voiceAiStatusSchema,
  language: voiceLanguageSchema,
});
export type VoiceParseResponse = z.infer<typeof voiceParseResponseSchema>;
