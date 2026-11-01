// Grounded merge of rule-parser and AI proposal (specs/010 research R3). Pure.
// Conflicts are never resolved by picking a side; ungrounded AI values never reach the user.
import {
  VOICE_FIELD_KEYS,
  type VoiceAiIssueKind,
  type VoiceFieldKey,
  type VoiceFieldNote,
  type VoiceFieldResult,
} from "@/lib/validation/voice";
import { checkFieldValue } from "./field-bounds";
import { isValueGrounded } from "./grounding";
import type { RuleParseResult } from "./rule-parse-transcript";

/** Structural twin of `VoiceParseAiOutput` (domain code must not import src/lib/ai). */
export type AiProposal = Record<VoiceFieldKey, number | null> & {
  issues: Array<{ field: VoiceFieldKey; kind: VoiceAiIssueKind }>;
};

export type MergedVoiceFields = Record<VoiceFieldKey, VoiceFieldResult>;

const heard = (value: number, source: "rules" | "ai" | "both"): VoiceFieldResult => ({
  status: "heard",
  value,
  source,
  note: null,
});
const needsEntry = (note: VoiceFieldNote): VoiceFieldResult => ({ status: "needs_entry", value: null, source: null, note });
const notHeard = (): VoiceFieldResult => ({ status: "not_heard", value: null, source: null, note: null });

const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;

export function mergeVoiceParse(rule: RuleParseResult, ai: AiProposal | null): MergedVoiceFields {
  const out = {} as MergedVoiceFields;
  for (const key of VOICE_FIELD_KEYS) {
    const issue = rule.issues.find((i) => i.field === key) ?? ai?.issues.find((i) => i.field === key);
    if (issue) {
      out[key] = needsEntry(issue.kind);
      continue;
    }
    const r = rule.fields[key] ?? null;
    const a = ai?.[key] ?? null;
    let result: VoiceFieldResult;
    if (r !== null && a !== null) {
      result = same(r, a) ? heard(r, "both") : needsEntry("conflict");
    } else if (r !== null) {
      result = heard(r, "rules");
    } else if (a !== null) {
      if (!isValueGrounded(a, rule.mentions)) {
        result = needsEntry("not_in_transcript");
      } else if (
        // The only number with this value was bound to a different field by the rules: the AI
        // would be reusing it for a second field (e.g. bill 2000 -> units 2000). Do not guess.
        rule.mentions.filter((m) => same(m.value, a)).length === 1 &&
        VOICE_FIELD_KEYS.some((k) => k !== key && rule.fields[k] !== undefined && same(rule.fields[k]!, a))
      ) {
        result = needsEntry("conflict");
      } else {
        result = heard(a, "ai");
      }
    } else {
      result = notHeard();
    }
    if (result.status === "heard") {
      const check = checkFieldValue(key, result.value!);
      if (check !== "ok") result = needsEntry(check);
    }
    out[key] = result;
  }
  return out;
}
