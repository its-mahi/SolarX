// Orchestrates one voice parse: rules first, AI only when needed, grounded merge (specs/010 R3).
import "server-only";
import { mergeVoiceParse } from "@/lib/domain/voice/merge-voice-parse";
import { ruleParseTranscript } from "@/lib/domain/voice/rule-parse-transcript";
import { parseVoiceWithAi } from "@/lib/ai/voice-parse";
import { VOICE_FIELD_KEYS, type VoiceAiStatus, type VoiceParseResponse, type VoiceParseRequest } from "@/lib/validation/voice";
import type { AiFailure } from "@/lib/ai/types";

export type VoiceParseOutcome = { response: VoiceParseResponse; failure: AiFailure | null };

export async function parseVoiceTranscript(input: VoiceParseRequest, signal?: AbortSignal): Promise<VoiceParseOutcome> {
  const rule = ruleParseTranscript(input.transcript);
  const complete = VOICE_FIELD_KEYS.every((k) => rule.fields[k] !== undefined);
  // An explicit rule issue (range, yearly...) also needs no AI: the answer is "needs entry".
  const settled = complete;

  let aiStatus: VoiceAiStatus = "skipped";
  let proposal = null;
  let failure: AiFailure | null = null;
  if (!settled) {
    const ai = await parseVoiceWithAi(input.language, input.transcript, signal);
    aiStatus = ai.aiStatus;
    proposal = ai.proposal;
    failure = ai.failure;
  }
  const fields = mergeVoiceParse(rule, proposal);
  return { response: { fields, ai_status: aiStatus, language: input.language }, failure };
}
