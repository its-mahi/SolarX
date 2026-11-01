/* eslint-disable @typescript-eslint/no-explicit-any -- loosely typed fake recogniser events */
// Pause and restart behaviour of the capture (specs/010 R1, R2): a pause must not end the
// capture or lose text; the browser ending a session by itself restarts it transparently.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RECOGNITION_MAX_MS,
  RECOGNITION_RESTART_BASE_MS,
  RECOGNITION_RESTART_MAX_DELAY_MS,
  RECOGNITION_STOP_GRACE_MS,
  startRecognition,
} from "@/lib/voice/speech-recognition";

type Segment = [text: string, isFinal: boolean];

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  static startThrows = 0; // how many upcoming start() calls throw
  static endOnStop = true; // real browsers fire `end` after stop(); false simulates one that does not
  lang = "";
  interimResults = false;
  continuous = false;
  maxAlternatives = 0;
  onresult: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  stopped = false;
  aborted = false;
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    if (FakeRecognition.startThrows > 0) {
      FakeRecognition.startThrows -= 1;
      throw new Error("InvalidStateError");
    }
    this.started = true;
  }
  stop() {
    this.stopped = true;
    if (FakeRecognition.endOnStop) this.end();
  }
  abort() {
    this.aborted = true;
    this.onerror?.({ error: "aborted" });
    this.onend?.();
  }
  /** The browser reports the whole results list of this session, as Chrome does. */
  say(...segments: Segment[]) {
    this.onresult?.({
      resultIndex: 0,
      results: segments.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal })),
    });
  }
  fail(error: string) {
    this.onerror?.({ error });
  }
  end() {
    this.onend?.();
  }
}

const scope = { webkitSpeechRecognition: FakeRecognition };
const all = () => FakeRecognition.instances;
const latest = () => FakeRecognition.instances[FakeRecognition.instances.length - 1];

function handlers() {
  return { onInterim: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() };
}
type Handlers = ReturnType<typeof handlers>;
const lastInterim = (h: Handlers) => h.onInterim.mock.calls[h.onInterim.mock.calls.length - 1]?.[0];

function begin(extra: { maxMs?: number; maxRestarts?: number; maxChars?: number } = {}) {
  const h = handlers();
  const session = startRecognition({ lang: "en-IN", scope, ...extra, ...h });
  if (!session) throw new Error("recognition did not start");
  return { h, session };
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeRecognition.instances = [];
  FakeRecognition.startThrows = 0;
  FakeRecognition.endOnStop = true;
});
afterEach(() => vi.useRealTimers());

describe("pause inside one browser session", () => {
  it("keeps listening and showing live text through a pause of several seconds", () => {
    const { h } = begin();
    latest().say(["two hundred fifty units", true], [" and budget", false]);
    expect(lastInterim(h)).toBe("two hundred fifty units and budget");

    vi.advanceTimersByTime(5_000); // the user pauses; nothing ends the capture
    expect(h.onFinal).not.toHaveBeenCalled();
    expect(h.onError).not.toHaveBeenCalled();
    expect(h.onEnd).not.toHaveBeenCalled();

    latest().say(["two hundred fifty units", true], [" and budget one lakh", true], [" fifty thousand", false]);
    expect(lastInterim(h)).toBe("two hundred fifty units and budget one lakh fifty thousand");
    expect(all()).toHaveLength(1);
  });

  it("does not repeat text when a browser reports cumulative results", () => {
    const { h } = begin();
    latest().say(["hello", true], ["hello world", true], ["hello world how are you", true]);
    expect(lastInterim(h)).toBe("hello world how are you");
  });
});

describe("the browser ends the session by itself", () => {
  it("restarts after a pause and keeps the text accumulated so far", () => {
    const { h, session } = begin();
    const first = latest();
    first.say(["two hundred fifty units", true]);
    first.end(); // Chrome ended the session although the user did not press Stop

    expect(h.onFinal).not.toHaveBeenCalled();
    expect(h.onError).not.toHaveBeenCalled();
    expect(h.onEnd).not.toHaveBeenCalled();
    expect(all()).toHaveLength(1); // backing off, not yet restarted
    vi.advanceTimersByTime(RECOGNITION_RESTART_BASE_MS);
    expect(all()).toHaveLength(2);
    expect(latest()).toMatchObject({ started: true, lang: "en-IN", continuous: true, interimResults: true });

    // Interim then final results of the new session add to the earlier text.
    latest().say([" and budget", false]);
    expect(lastInterim(h)).toBe("two hundred fifty units and budget");
    latest().say([" and budget one lakh fifty thousand", true]);
    expect(lastInterim(h)).toBe("two hundred fifty units and budget one lakh fifty thousand");

    session.stop();
    expect(h.onFinal).toHaveBeenCalledTimes(1);
    expect(h.onFinal).toHaveBeenCalledWith("two hundred fifty units and budget one lakh fifty thousand");
    expect(h.onError).not.toHaveBeenCalled();
    expect(h.onEnd).toHaveBeenCalledTimes(1);
  });

  it("keeps interim words that were not yet final when the session ended", () => {
    const { h, session } = begin();
    latest().say(["two hundred", false]);
    latest().end();
    vi.advanceTimersByTime(RECOGNITION_RESTART_BASE_MS);
    latest().say(["fifty units", true]);
    session.stop();
    expect(h.onFinal).toHaveBeenCalledWith("two hundred fifty units");
  });

  it.each(["no-speech", "network", "aborted"])("treats %s after speech as a pause and restarts", (code) => {
    const { h, session } = begin();
    latest().say(["budget one lakh", true]);
    latest().fail(code);
    latest().end();
    expect(h.onError).not.toHaveBeenCalled();
    vi.advanceTimersByTime(RECOGNITION_RESTART_BASE_MS);
    expect(all()).toHaveLength(2);
    session.stop();
    expect(h.onFinal).toHaveBeenCalledWith("budget one lakh");
  });

  it("reports no_speech and does not restart when nothing was ever said", () => {
    const { h } = begin();
    latest().fail("no-speech");
    latest().end();
    expect(h.onError).toHaveBeenCalledTimes(1);
    expect(h.onError).toHaveBeenCalledWith("no_speech");
    expect(h.onFinal).not.toHaveBeenCalled();
    expect(h.onEnd).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(all()).toHaveLength(1);
  });

  it("backs off between restarts and caps them, then keeps the text", () => {
    const { h } = begin(); // default cap: 5 restarts without new speech
    latest().say(["bill two thousand", true]);
    const delays = [RECOGNITION_RESTART_BASE_MS, 500, 1_000, 2_000, RECOGNITION_RESTART_MAX_DELAY_MS];
    delays.forEach((delay, i) => {
      latest().end();
      vi.advanceTimersByTime(delay - 1);
      expect(all()).toHaveLength(i + 1);
      vi.advanceTimersByTime(1);
      expect(all()).toHaveLength(i + 2);
    });
    expect(h.onFinal).not.toHaveBeenCalled();

    latest().end(); // sixth end in a row without speech: give up
    expect(h.onFinal).toHaveBeenCalledTimes(1);
    expect(h.onFinal).toHaveBeenCalledWith("bill two thousand");
    expect(h.onError).not.toHaveBeenCalled();
    expect(h.onEnd).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(all()).toHaveLength(6);
  });

  it("gives up with a recognition error when it keeps failing without ever hearing speech", () => {
    const { h } = begin();
    for (let i = 0; i < 6; i += 1) {
      latest().fail("network");
      latest().end();
      vi.advanceTimersByTime(RECOGNITION_RESTART_MAX_DELAY_MS);
    }
    expect(all()).toHaveLength(6);
    expect(h.onError).toHaveBeenCalledTimes(1);
    expect(h.onError).toHaveBeenCalledWith("recognition");
    expect(h.onFinal).not.toHaveBeenCalled();
    expect(h.onEnd).toHaveBeenCalledTimes(1);
  });

  it("resets the restart count whenever new speech arrives", () => {
    const { h } = begin({ maxRestarts: 2 });
    latest().say(["one", true]);
    for (let i = 0; i < 4; i += 1) {
      latest().end();
      vi.advanceTimersByTime(RECOGNITION_RESTART_MAX_DELAY_MS);
      latest().say([`word ${i}`, true]); // speech in the restarted session
    }
    expect(all()).toHaveLength(5);
    expect(h.onFinal).not.toHaveBeenCalled();
    expect(h.onEnd).not.toHaveBeenCalled();
  });

  it("survives start() throwing during a restart, up to the cap", () => {
    const { h } = begin();
    latest().say(["budget one lakh", true]);
    latest().end();
    FakeRecognition.startThrows = 100;
    for (let i = 0; i < 6; i += 1) vi.advanceTimersByTime(RECOGNITION_RESTART_MAX_DELAY_MS);
    expect(all()).toHaveLength(6); // first session + 5 failed restarts
    expect(h.onFinal).toHaveBeenCalledTimes(1);
    expect(h.onFinal).toHaveBeenCalledWith("budget one lakh");
    expect(h.onError).not.toHaveBeenCalled();
    expect(h.onEnd).toHaveBeenCalledTimes(1);
  });
});

describe("real errors stop the capture", () => {
  it.each([
    ["not-allowed", "permission"],
    ["service-not-allowed", "permission"],
    ["audio-capture", "no_mic"],
    ["language-not-supported", "language_unsupported"],
    ["bad-grammar", "recognition"],
  ])("%s ends it with %s, releases the microphone and never restarts", (code, kind) => {
    const { h } = begin();
    latest().say(["budget one lakh", false]);
    const rec = latest();
    rec.fail(code);
    rec.end(); // a late `end` from the browser must be ignored

    expect(h.onError).toHaveBeenCalledTimes(1);
    expect(h.onError).toHaveBeenCalledWith(kind);
    expect(h.onFinal).not.toHaveBeenCalled();
    expect(h.onEnd).toHaveBeenCalledTimes(1);
    expect(rec.aborted).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(all()).toHaveLength(1);
    expect(lastInterim(h)).toBe("budget one lakh"); // the text heard so far was already delivered
  });
});

describe("stopping", () => {
  it("Stop ends the capture without a restart", () => {
    const { h, session } = begin();
    latest().say(["two hundred fifty units", true]);
    session.stop();
    expect(latest().stopped).toBe(true);
    expect(h.onFinal).toHaveBeenCalledWith("two hundred fifty units");
    expect(h.onEnd).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(all()).toHaveLength(1);
    session.stop(); // idempotent
    expect(h.onFinal).toHaveBeenCalledTimes(1);
  });

  it("Stop while a restart is pending finishes at once with the text so far", () => {
    const { h, session } = begin();
    latest().say(["budget one lakh", true]);
    latest().end();
    session.stop();
    expect(h.onFinal).toHaveBeenCalledWith("budget one lakh");
    expect(h.onEnd).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(all()).toHaveLength(1);
  });

  it("releases the microphone even if the browser never fires end after stop()", () => {
    FakeRecognition.endOnStop = false;
    const { h, session } = begin();
    latest().say(["two hundred fifty units", true]);
    session.stop();
    expect(h.onFinal).not.toHaveBeenCalled();
    vi.advanceTimersByTime(RECOGNITION_STOP_GRACE_MS);
    expect(h.onFinal).toHaveBeenCalledWith("two hundred fifty units");
    expect(latest().aborted).toBe(true);
    expect(h.onEnd).toHaveBeenCalledTimes(1);
  });

  it("stopping with nothing said reports no_speech", () => {
    const { h, session } = begin();
    session.stop();
    expect(h.onError).toHaveBeenCalledWith("no_speech");
    expect(h.onFinal).not.toHaveBeenCalled();
  });
});

describe("limits", () => {
  it("the 30 s limit counts the whole capture, restarts included", () => {
    const { h } = begin();
    latest().say(["one", true]);
    latest().end();
    vi.advanceTimersByTime(RECOGNITION_RESTART_BASE_MS);
    expect(all()).toHaveLength(2);
    vi.advanceTimersByTime(RECOGNITION_MAX_MS - RECOGNITION_RESTART_BASE_MS - 1);
    expect(latest().stopped).toBe(false);
    vi.advanceTimersByTime(1);
    expect(latest().stopped).toBe(true);
    expect(h.onFinal).toHaveBeenCalledWith("one");
    expect(h.onEnd).toHaveBeenCalledTimes(1);
  });

  it("the time limit reached while a restart is pending finishes with the text so far", () => {
    const { h } = begin({ maxMs: 100 });
    latest().say(["one", true]);
    latest().end();
    vi.advanceTimersByTime(100);
    expect(h.onFinal).toHaveBeenCalledWith("one");
    vi.advanceTimersByTime(60_000);
    expect(all()).toHaveLength(1);
  });

  it("stops listening at the transcript character limit", () => {
    const { h } = begin({ maxChars: 20 });
    latest().say(["one two three four five six", false]);
    expect(lastInterim(h)).toBe("one two three four f");
    expect(latest().stopped).toBe(true);
    expect(h.onFinal).toHaveBeenCalledWith("one two three four f");
    expect(h.onEnd).toHaveBeenCalledTimes(1);
  });
});

describe("releasing the microphone", () => {
  it("abort (unmount) releases it and silences every callback", () => {
    const { h, session } = begin();
    const rec = latest();
    rec.say(["budget one lakh", false]);
    session.abort();
    expect(rec.aborted).toBe(true);
    expect(h.onEnd).toHaveBeenCalledTimes(1);

    rec.say(["late words", true]);
    rec.fail("network");
    rec.end();
    vi.advanceTimersByTime(60_000);
    expect(h.onFinal).not.toHaveBeenCalled();
    expect(h.onError).not.toHaveBeenCalled();
    expect(all()).toHaveLength(1);
    session.abort();
    expect(h.onEnd).toHaveBeenCalledTimes(1);
  });

  it("abort while a restart is pending cancels the restart and the time limit", () => {
    const { h, session } = begin();
    latest().say(["budget one lakh", true]);
    latest().end();
    session.abort();
    vi.advanceTimersByTime(60_000);
    expect(all()).toHaveLength(1);
    expect(h.onFinal).not.toHaveBeenCalled();
    expect(h.onError).not.toHaveBeenCalled();
    expect(h.onEnd).toHaveBeenCalledTimes(1);
  });

  it("returns null and reports a recognition error when start() throws at the beginning", () => {
    FakeRecognition.startThrows = 1;
    const h = handlers();
    expect(startRecognition({ lang: "en-IN", scope, ...h })).toBeNull();
    expect(h.onError).toHaveBeenCalledWith("recognition");
    expect(h.onEnd).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(all()).toHaveLength(1);
  });
});
