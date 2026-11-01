// Pure helpers for speech-language support (specs/010 research R2). No DOM access: callers pass
// the global scope in, so these are safe during SSR and trivially testable.
import { voiceLanguageSchema, type VoiceLanguage } from "@/lib/validation/voice";

export const VOICE_LANGUAGE_FALLBACK: VoiceLanguage = "en-IN";
export const DEFAULT_VOICE_LANGUAGE: VoiceLanguage = "hi-IN";

export const VOICE_LANGUAGE_LABELS: Record<VoiceLanguage, string> = {
  "hi-IN": "Hindi (हिन्दी)",
  "gu-IN": "Gujarati (ગુજરાતી)",
  "en-IN": "English (India)",
};

export function isVoiceLanguage(value: unknown): value is VoiceLanguage {
  return voiceLanguageSchema.safeParse(value).success;
}

/** The speech API exposes no language list, so an unsupported language falls back to English. */
export function resolveVoiceLanguage(value: unknown): VoiceLanguage {
  return isVoiceLanguage(value) ? value : DEFAULT_VOICE_LANGUAGE;
}

export function hasSpeechRecognition(scope: unknown): boolean {
  if (typeof scope !== "object" || scope === null) return false;
  const s = scope as Record<string, unknown>;
  return typeof s.SpeechRecognition === "function" || typeof s.webkitSpeechRecognition === "function";
}

export type RecognitionErrorKind = "permission" | "no_speech" | "no_mic" | "recognition" | "language_unsupported";

export function mapRecognitionError(code: unknown): RecognitionErrorKind {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "permission";
    case "no-speech":
      return "no_speech";
    case "audio-capture":
      return "no_mic";
    case "language-not-supported":
      return "language_unsupported";
    default:
      return "recognition";
  }
}
