// Browser wrapper around the Web Speech API (specs/010 R1, R2). Emits text only: no audio is
// captured, stored or forwarded by SolarX. Safe to import during SSR (no top-level DOM access).
//
// Why this is more than a thin wrapper: with `continuous = false` Chrome ends the session after
// about a second of silence, so a short pause ended the capture. The capture is therefore
// `continuous = true`, and when the browser still ends a session by itself (silence, network
// hiccup) a new session is started transparently while the text so far is kept. The capture
// ends only on Stop, the 30 s limit, the character limit or a real error.
import {
  hasSpeechRecognition,
  isTransientRecognitionError,
  mapRecognitionError,
  type RecognitionErrorKind,
} from "./language-support";
import { VOICE_TRANSCRIPT_MAX_CHARS, type VoiceLanguage } from "@/lib/validation/voice";

export const RECOGNITION_MAX_MS = 30_000;
/** Consecutive browser-ended sessions without any new speech before the capture gives up. */
export const RECOGNITION_MAX_RESTARTS = 5;
export const RECOGNITION_RESTART_BASE_MS = 250;
export const RECOGNITION_RESTART_MAX_DELAY_MS = 2_000;
/** After stop() the browser must fire `end`; if it never does, the microphone is released anyway. */
export const RECOGNITION_STOP_GRACE_MS = 2_000;

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

export type RecognitionOptions = {
  lang: VoiceLanguage;
  scope?: unknown;
  /** Hard limit for the whole capture, restarts included. */
  maxMs?: number;
  maxRestarts?: number;
  maxChars?: number;
} & RecognitionHandlers;

const joinText = (...parts: string[]) =>
  parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ");

type SessionResultText = { finalText: string; interimText: string };

/**
 * Rebuilds one session's text from the whole `results` list (not only from `resultIndex`), so
 * the text is the same however the browser batches events. Some Android builds report each
 * result as the cumulative sentence so far; a segment that is just the start of the next one is
 * dropped so the text is not repeated.
 */
function readSessionResults(results: RecognitionEventLike["results"]): SessionResultText {
  const segments: { text: string; isFinal: boolean }[] = [];
  for (let i = 0; i < results.length; i += 1) {
    const text = (results[i][0]?.transcript ?? "").trim();
    if (text) segments.push({ text, isFinal: results[i].isFinal });
  }
  const kept = segments.filter(
    (s, i) => !(i + 1 < segments.length && segments[i + 1].text.toLowerCase().startsWith(s.text.toLowerCase())),
  );
  return {
    finalText: joinText(...kept.filter((s) => s.isFinal).map((s) => s.text)),
    interimText: joinText(...kept.filter((s) => !s.isFinal).map((s) => s.text)),
  };
}

/**
 * Starts a capture. Calls `onInterim` with the full text so far (finals from every session plus
 * the live interim words), and at the end exactly one of `onFinal(text)` or `onError(kind)`,
 * followed by `onEnd()`. Returns null when the browser has no speech recognition or start() throws.
 */
export function startRecognition(options: RecognitionOptions): RecognitionSession | null {
  const found = getCtor(options.scope);
  if (!found) return null;
  const Ctor: RecognitionCtor = found;
  const maxChars = options.maxChars ?? VOICE_TRANSCRIPT_MAX_CHARS;
  const maxRestarts = options.maxRestarts ?? RECOGNITION_MAX_RESTARTS;

  let current: RecognitionLike | null = null;
  let committed = ""; // text of sessions that have already ended
  let session: SessionResultText = { finalText: "", interimText: "" };
  let sessionError: string | null = null;
  let lastErrorKind: RecognitionErrorKind | null = null;
  let restartsWithoutSpeech = 0;
  let stopRequested = false;
  let finished = false;
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  let stopTimer: ReturnType<typeof setTimeout> | undefined;

  const fullText = () => joinText(committed, session.finalText, session.interimText);
  const clearTimers = () => {
    clearTimeout(limitTimer);
    clearTimeout(restartTimer);
    clearTimeout(stopTimer);
    restartTimer = undefined;
  };
  // Detach first so a late event from a released recogniser can never reach the caller.
  const release = (rec: RecognitionLike | null) => {
    if (!rec) return;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    try {
      rec.abort();
    } catch {
      /* already stopped */
    }
  };
  const commitSession = () => {
    committed = fullText();
    session = { finalText: "", interimText: "" };
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimers();
    release(current);
    current = null;
    commitSession();
    const text = committed.slice(0, maxChars).trim();
    if (text) options.onFinal(text);
    else options.onError(lastErrorKind ?? "no_speech");
    options.onEnd();
  };

  // A real failure: report it once and stop. The text heard so far was already delivered through
  // onInterim, so the caller still has it.
  const fail = (kind: RecognitionErrorKind) => {
    if (finished) return;
    finished = true;
    clearTimers();
    release(current);
    current = null;
    options.onError(kind);
    options.onEnd();
  };

  const requestStop = () => {
    if (finished || stopRequested) return;
    stopRequested = true;
    clearTimeout(restartTimer);
    restartTimer = undefined;
    if (!current) return finish(); // between restarts: nothing is running that could flush text
    // The browser delivers the last result and `end` after stop(); the timer is a safety net so
    // the microphone is released even if `end` never arrives.
    stopTimer = setTimeout(finish, RECOGNITION_STOP_GRACE_MS);
    try {
      current.stop();
    } catch {
      finish();
    }
  };

  const emit = () => {
    const text = fullText();
    if (text.length >= maxChars) {
      options.onInterim(text.slice(0, maxChars));
      requestStop(); // the transcript limit is reached: stop listening instead of dropping words
    } else {
      options.onInterim(text);
    }
  };

  const onSessionEnded = () => {
    if (finished) return;
    if (stopRequested) return finish();
    // The browser ended the session although the user did not stop: pauses and network
    // hiccups must not end the capture. Silence from the very start is the user's "no speech".
    if (sessionError === "no-speech" && !committed.trim()) return finish();
    if (restartsWithoutSpeech >= maxRestarts) return finish();
    restartsWithoutSpeech += 1;
    const delay = Math.min(
      RECOGNITION_RESTART_BASE_MS * 2 ** (restartsWithoutSpeech - 1),
      RECOGNITION_RESTART_MAX_DELAY_MS,
    );
    restartTimer = setTimeout(() => {
      restartTimer = undefined;
      if (finished || stopRequested) return;
      if (!beginSession()) {
        lastErrorKind = "recognition";
        onSessionEnded();
      }
    }, delay);
  };

  function beginSession(): boolean {
    let rec: RecognitionLike | null = null;
    try {
      rec = new Ctor();
      rec.lang = options.lang;
      rec.interimResults = true;
      rec.continuous = true; // false would end the session after ~1 s of silence
      rec.maxAlternatives = 1;
      const mine = rec;
      rec.onresult = (e) => {
        if (mine !== current) return;
        restartsWithoutSpeech = 0;
        lastErrorKind = null;
        session = readSessionResults(e.results);
        emit();
      };
      rec.onerror = (e) => {
        if (mine !== current) return;
        sessionError = e.error ?? null;
        lastErrorKind = mapRecognitionError(e.error);
        if (!isTransientRecognitionError(e.error)) fail(lastErrorKind);
        // Transient: `end` follows and decides between restarting and finishing.
      };
      rec.onend = () => {
        if (mine !== current) return;
        current = null;
        commitSession();
        onSessionEnded();
      };
      session = { finalText: "", interimText: "" };
      sessionError = null;
      current = rec;
      rec.start();
      return true;
    } catch {
      if (rec) release(rec);
      current = null;
      return false;
    }
  }

  // The 30 s limit covers the whole capture, restarts included.
  const limitTimer = setTimeout(requestStop, options.maxMs ?? RECOGNITION_MAX_MS);
  if (!beginSession()) {
    lastErrorKind = "recognition";
    finish();
    return null;
  }
  return {
    stop: requestStop,
    abort: () => {
      if (finished) return;
      finished = true;
      clearTimers();
      release(current);
      current = null;
      options.onEnd();
    },
  };
}
