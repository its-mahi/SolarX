// Pure state machine for the voice panel (specs/010 data-model §7). No I/O.
import type { RecognitionErrorKind } from "@/lib/voice/language-support";
import { DEFAULT_VOICE_LANGUAGE, VOICE_LANGUAGE_FALLBACK } from "@/lib/voice/language-support";
import type { VoiceLanguage, VoiceParseResponse } from "@/lib/validation/voice";

export type VoicePhase =
  | "idle"
  | "listening"
  | "transcript_ready"
  | "interpreting"
  | "review"
  | "empty"
  | "error"
  | "unsupported";

export type VoiceErrorKind = RecognitionErrorKind | "ai_unavailable" | "request_failed";
export type VoiceEmptyKind = "no_speech" | "no_values";

export type VoicePanelState = {
  phase: VoicePhase;
  language: VoiceLanguage;
  transcript: string;
  attemptId: number;
  result: VoiceParseResponse | null;
  error: VoiceErrorKind | null;
  empty: VoiceEmptyKind | null;
  languageNotice: VoiceLanguage | null;
  supported: boolean;
};

export type VoicePanelAction =
  | { type: "unsupported" }
  | { type: "set_language"; language: VoiceLanguage }
  | { type: "start_listening" }
  | { type: "interim"; text: string }
  | { type: "final"; text: string }
  | { type: "recognition_error"; kind: RecognitionErrorKind }
  | { type: "edit_transcript"; text: string }
  | { type: "interpret" }
  | { type: "parse_success"; attemptId: number; result: VoiceParseResponse }
  | { type: "parse_failure"; attemptId: number; kind: "ai_unavailable" | "request_failed" }
  | { type: "reset" };

export function initialVoiceState(language: VoiceLanguage = DEFAULT_VOICE_LANGUAGE): VoicePanelState {
  return { phase: "idle", language, transcript: "", attemptId: 0, result: null, error: null, empty: null, languageNotice: null, supported: true };
}

const NO_VALUES = (r: VoiceParseResponse) => Object.values(r.fields).every((f) => f.status === "not_heard");

export function voicePanelReducer(state: VoicePanelState, action: VoicePanelAction): VoicePanelState {
  switch (action.type) {
    case "unsupported":
      return { ...state, phase: "unsupported", supported: false };
    case "set_language":
      return { ...state, language: action.language, languageNotice: null };
    case "start_listening":
      if (!state.supported) return state;
      return { ...state, phase: "listening", transcript: "", result: null, error: null, empty: null, languageNotice: null, attemptId: state.attemptId + 1 };
    case "interim":
      return state.phase === "listening" ? { ...state, transcript: action.text } : state;
    case "final":
      if (state.phase !== "listening") return state;
      return { ...state, phase: "transcript_ready", transcript: action.text };
    case "recognition_error":
      if (action.kind === "language_unsupported") {
        return { ...state, phase: "idle", language: VOICE_LANGUAGE_FALLBACK, languageNotice: state.language, error: null };
      }
      if (action.kind === "no_speech") return { ...state, phase: "empty", empty: "no_speech", error: null };
      return { ...state, phase: "error", error: action.kind, empty: null };
    case "edit_transcript": {
      const phase: VoicePhase =
        state.phase === "transcript_ready" || state.phase === "review" || state.phase === "empty" || state.phase === "error"
          ? "transcript_ready"
          : state.phase;
      return { ...state, transcript: action.text, phase, result: phase === "transcript_ready" ? null : state.result, empty: null, error: null };
    }
    case "interpret":
      if (!state.transcript.trim() || state.phase === "listening" || state.phase === "interpreting") return state;
      return { ...state, phase: "interpreting", result: null, error: null, empty: null, attemptId: state.attemptId + 1 };
    case "parse_success":
      if (action.attemptId !== state.attemptId || state.phase !== "interpreting") return state;
      if (NO_VALUES(action.result)) return { ...state, phase: "empty", empty: "no_values", result: null };
      return { ...state, phase: "review", result: action.result };
    case "parse_failure":
      if (action.attemptId !== state.attemptId || state.phase !== "interpreting") return state;
      return { ...state, phase: "error", error: action.kind };
    case "reset":
      return { ...initialVoiceState(state.language), attemptId: state.attemptId, phase: state.supported ? "idle" : "unsupported", supported: state.supported };
  }
}
