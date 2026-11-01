// Task service for voice transcript interpretation (specs/010). The only caller of
// generateStructured for task "voice_parse". Naming matches 008's contract (ai-client.md):
// generateStructured, untrustedText, instructionText, aiFailureToApiError from ./index.
import "server-only";
import { generateStructured } from "./client";
import { instructionText, untrustedText } from "./untrusted";
import { voiceParseAiOutputSchema, type VoiceParseAiOutput } from "./schemas/voice-parse";
import { VOICE_PARSE_PROMPT_VERSION, VOICE_PARSE_SYSTEM_INSTRUCTION } from "./prompts/voice-parse.v1";
import type { AiFailure } from "./types";
import type { VoiceAiStatus, VoiceLanguage } from "@/lib/validation/voice";

export type VoiceAiOutcome =
  | { proposal: VoiceParseAiOutput; aiStatus: "used"; failure: null }
  | { proposal: null; aiStatus: Exclude<VoiceAiStatus, "used" | "skipped">; failure: AiFailure | null };

const OVERALL_TIMEOUT_MS = 10_000;

/** Never throws for AI failures; the transcript is framed as untrusted data. */
export async function parseVoiceWithAi(
  language: VoiceLanguage,
  transcript: string,
  signal?: AbortSignal,
): Promise<VoiceAiOutcome> {
  const overall = AbortSignal.timeout(OVERALL_TIMEOUT_MS);
  try {
    const result = await generateStructured({
      task: "voice_parse",
      promptVersion: VOICE_PARSE_PROMPT_VERSION,
      systemInstruction: VOICE_PARSE_SYSTEM_INSTRUCTION,
      capability: "text",
      schema: voiceParseAiOutputSchema,
      input: [
        instructionText(`Language hint: ${language}`),
        untrustedText("voice transcript", transcript, { maxChars: 500 }),
      ],
      timeoutMs: 8000,
      signal: signal ? AbortSignal.any([signal, overall]) : overall,
    });
    if (result.ok) return { proposal: result.data, aiStatus: "used", failure: null };
    const kind = result.error.kind;
    const aiStatus = kind === "not_configured" ? "not_configured" : kind === "invalid_output" ? "invalid_output" : "unavailable";
    return { proposal: null, aiStatus, failure: result.error };
  } catch {
    return { proposal: null, aiStatus: "unavailable", failure: { kind: "provider_error", retryable: true } };
  }
}
