// Plausibility bounds for voice-entered fields. The limits have one source of truth: the
// per-field shape of 002's `usageFieldsSchema` (specs/010 data-model §4 = 002 FR-009).
import type { VoiceFieldKey } from "@/lib/validation/voice";
import { usageFieldsSchema } from "@/lib/validation/requests";

export type FieldCheck = "ok" | "out_of_range" | "invalid_format";

export function checkFieldValue(key: VoiceFieldKey, value: number): FieldCheck {
  if (!Number.isFinite(value)) return "invalid_format";
  const result = usageFieldsSchema.shape[key].safeParse(value);
  if (result.success) return "ok";
  // Format problems (fractions of a rupee, extra decimals) win over range problems.
  const rangeOnly = result.error.issues.every((i) => i.code === "too_small" || i.code === "too_big");
  return rangeOnly ? "out_of_range" : "invalid_format";
}
