"use client";
// Wires the Web Speech wrapper, the panel reducer and POST /api/voice/parse. Only the transcript
// text is sent to the server; no audio is captured by this app.
import { useCallback, useEffect, useReducer, useRef } from "react";
import { startRecognition, isSpeechRecognitionSupported, type RecognitionSession } from "@/lib/voice/speech-recognition";
import { DEFAULT_VOICE_LANGUAGE, isVoiceLanguage } from "@/lib/voice/language-support";
import { VOICE_TRANSCRIPT_MAX_CHARS, voiceParseResponseSchema, type VoiceLanguage } from "@/lib/validation/voice";
import { initialVoiceState, voicePanelReducer } from "./voice-panel-reducer";

const STORAGE_KEY = "suryamit.voice.language";

function readStoredLanguage(): VoiceLanguage {
  try {
    const v = window.sessionStorage.getItem(STORAGE_KEY);
    return isVoiceLanguage(v) ? v : DEFAULT_VOICE_LANGUAGE;
  } catch {
    return DEFAULT_VOICE_LANGUAGE;
  }
}

export function useVoiceCapture() {
  const [state, dispatch] = useReducer(voicePanelReducer, undefined, () => initialVoiceState());
  const session = useRef<RecognitionSession | null>(null);
  const abort = useRef<AbortController | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    const stored = readStoredLanguage();
    if (stored !== DEFAULT_VOICE_LANGUAGE) dispatch({ type: "set_language", language: stored });
    if (!isSpeechRecognitionSupported()) dispatch({ type: "unsupported" });
    return () => {
      session.current?.abort();
      abort.current?.abort();
    };
  }, []);

  const setLanguage = useCallback((language: VoiceLanguage) => {
    dispatch({ type: "set_language", language });
    try {
      window.sessionStorage.setItem(STORAGE_KEY, language);
    } catch {
      /* storage unavailable: the choice just is not remembered */
    }
  }, []);

  const start = useCallback(() => {
    dispatch({ type: "start_listening" });
    session.current = startRecognition({
      lang: stateRef.current.language,
      onInterim: (text) => dispatch({ type: "interim", text }),
      onFinal: (text) => dispatch({ type: "final", text: text.slice(0, VOICE_TRANSCRIPT_MAX_CHARS) }),
      onError: (kind) => dispatch({ type: "recognition_error", kind }),
      onEnd: () => {
        session.current = null;
      },
    });
    if (!session.current && stateRef.current.supported) {
      // start() threw synchronously; onError already reported it.
    }
  }, []);

  const stop = useCallback(() => session.current?.stop(), []);

  const editTranscript = useCallback((text: string) => dispatch({ type: "edit_transcript", text }), []);

  const interpret = useCallback(async () => {
    const current = stateRef.current;
    const transcript = current.transcript.trim();
    if (!transcript || current.phase === "listening" || current.phase === "interpreting") return;
    dispatch({ type: "interpret" });
    const attemptId = current.attemptId + 1;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    try {
      const res = await fetch("/api/voice/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript, language: current.language }),
        signal: controller.signal,
      });
      const json: unknown = await res.json().catch(() => null);
      if (res.status === 503) return dispatch({ type: "parse_failure", attemptId, kind: "ai_unavailable" });
      const parsed = res.ok ? voiceParseResponseSchema.safeParse((json as { data?: unknown } | null)?.data) : null;
      if (!parsed?.success) return dispatch({ type: "parse_failure", attemptId, kind: "request_failed" });
      dispatch({ type: "parse_success", attemptId, result: parsed.data });
    } catch {
      if (!controller.signal.aborted) dispatch({ type: "parse_failure", attemptId, kind: "request_failed" });
    }
  }, []);

  const reset = useCallback(() => {
    session.current?.abort();
    abort.current?.abort();
    dispatch({ type: "reset" });
  }, []);

  return { state, setLanguage, start, stop, editTranscript, interpret, reset };
}
