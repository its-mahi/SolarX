// Browser wrapper around the Web Speech API (specs/010 R2). Emits text only: no audio is
// captured, stored or forwarded by SURYAMIT. Safe to import during SSR (no top-level DOM access).
import { hasSpeechRecognition, mapRecognitionError, type RecognitionErrorKind } from "./language-support";
import type { VoiceLanguage } from "@/lib/validation/voice";

export const RECOGNITION_MAX_MS = 30_000;

type RecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};
type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionCtor = new () => RecognitionLike;

function getCtor(scope: unknown = typeof window === "undefined" ? undefined : window): RecognitionCtor | null {
  if (!hasSpeechRecognition(scope)) return null;
  const s = scope as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return s.SpeechRecognition ?? s.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(scope?: unknown): boolean {
  return getCtor(scope) !== null;
}

export type RecognitionHandlers = {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (kind: RecognitionErrorKind) => void;
  onEnd: () => void;
};

export type RecognitionSession = { stop(): void; abort(): void };

export function startRecognition(
  options: { lang: VoiceLanguage; scope?: unknown; maxMs?: number } & RecognitionHandlers,
): RecognitionSession | null {
  const Ctor = getCtor(options.scope);
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = options.lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  let finalText = "";
  let finished = false;
  let errored = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    if (!errored) {
      const text = finalText.trim();
      if (text) options.onFinal(text);
      else options.onError("no_speech");
    }
    options.onEnd();
  };

  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i += 1) {
      const r = e.results[i];
      const t = r[0]?.transcript ?? "";
      if (r.isFinal) finalText += `${finalText ? " " : ""}${t}`;
      else interim += t;
    }
    options.onInterim(`${finalText} ${interim}`.trim());
  };
  rec.onerror = (e) => {
    errored = true;
    options.onError(mapRecognitionError(e.error));
  };
  rec.onend = finish;
  // Hard stop: the browser delivers the final result on stop().
  const timer = setTimeout(() => rec.stop(), options.maxMs ?? RECOGNITION_MAX_MS);
  try {
    rec.start();
  } catch {
    errored = true;
    options.onError("recognition");
    finish();
    return null;
  }
  return {
    stop: () => rec.stop(),
    abort: () => {
      errored = true;
      clearTimeout(timer);
      rec.abort();
    },
  };
}
