/* eslint-disable @typescript-eslint/no-explicit-any -- loosely typed fakes and JSON bodies */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isSpeechRecognitionSupported, startRecognition } from "@/lib/voice/speech-recognition";

class Fake {
  static last: Fake;
  lang = "";
  interimResults = false;
  continuous = true;
  maxAlternatives = 0;
  onresult: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  onend: (() => void) | null = null;
  stopped = false;
  constructor() {
    Fake.last = this;
  }
  start() {}
  stop() {
    this.stopped = true;
    this.onend?.();
  }
  abort() {}
}
const scope = { webkitSpeechRecognition: Fake };
const result = (text: string, isFinal: boolean) => ({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal })] });

function handlers() {
  return { onInterim: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("speech recognition wrapper", () => {
  it("detects support", () => {
    expect(isSpeechRecognitionSupported({})).toBe(false);
    expect(isSpeechRecognitionSupported(scope)).toBe(true);
    expect(startRecognition({ lang: "hi-IN", scope: {}, ...handlers() })).toBeNull();
  });

  it("configures the recogniser and emits interim then final text", () => {
    const h = handlers();
    startRecognition({ lang: "gu-IN", scope, ...h });
    expect(Fake.last).toMatchObject({ lang: "gu-IN", interimResults: true, continuous: false, maxAlternatives: 1 });
    Fake.last.onresult!(result("do hazaar", false));
    expect(h.onInterim).toHaveBeenCalledWith("do hazaar");
    Fake.last.onresult!(result("do hazaar", true));
    Fake.last.onend!();
    expect(h.onFinal).toHaveBeenCalledWith("do hazaar");
    expect(h.onEnd).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["not-allowed", "permission"],
    ["service-not-allowed", "permission"],
    ["no-speech", "no_speech"],
    ["audio-capture", "no_mic"],
    ["network", "recognition"],
    ["aborted", "recognition"],
    ["language-not-supported", "language_unsupported"],
  ])("maps %s to %s", (code, kind) => {
    const h = handlers();
    startRecognition({ lang: "hi-IN", scope, ...h });
    Fake.last.onerror!({ error: code });
    Fake.last.onend!();
    expect(h.onError).toHaveBeenCalledTimes(1);
    expect(h.onError).toHaveBeenCalledWith(kind);
    expect(h.onFinal).not.toHaveBeenCalled();
  });

  it("an empty final result is no_speech", () => {
    const h = handlers();
    startRecognition({ lang: "hi-IN", scope, ...h });
    Fake.last.onend!();
    expect(h.onError).toHaveBeenCalledWith("no_speech");
  });

  it("stops after 30 seconds", () => {
    startRecognition({ lang: "hi-IN", scope, ...handlers() });
    vi.advanceTimersByTime(29_999);
    expect(Fake.last.stopped).toBe(false);
    vi.advanceTimersByTime(2);
    expect(Fake.last.stopped).toBe(true);
  });
});
