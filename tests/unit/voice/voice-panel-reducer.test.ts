import { describe, expect, it } from "vitest";
import { initialVoiceState, voicePanelReducer as r, type VoicePanelState } from "@/components/household/voice/voice-panel-reducer";
import type { VoiceFieldResult, VoiceParseResponse } from "@/lib/validation/voice";

const nh: VoiceFieldResult = { status: "not_heard", value: null, source: null, note: null };
const heard: VoiceFieldResult = { status: "heard", value: 5, source: "rules", note: null };
const resp = (f: VoiceFieldResult = heard): VoiceParseResponse => ({
  language: "hi-IN",
  ai_status: "used",
  fields: { monthly_units: f, monthly_bill: nh, budget: nh, preferred_capacity_kw: nh },
});
const run = (s: VoicePanelState, ...actions: Parameters<typeof r>[1][]) => actions.reduce(r, s);

describe("voice panel reducer", () => {
  it("idle -> listening -> transcript_ready -> interpreting -> review", () => {
    let s = run(initialVoiceState(), { type: "start_listening" });
    expect(s.phase).toBe("listening");
    s = run(s, { type: "interim", text: "bill" }, { type: "final", text: "bill 2000" });
    expect(s).toMatchObject({ phase: "transcript_ready", transcript: "bill 2000" });
    s = run(s, { type: "interpret" });
    expect(s.phase).toBe("interpreting");
    s = run(s, { type: "parse_success", attemptId: s.attemptId, result: resp() });
    expect(s.phase).toBe("review");
    expect(run(s, { type: "reset" }).phase).toBe("idle");
  });

  it("ignores a response from an older attempt", () => {
    let s = run(initialVoiceState(), { type: "start_listening" }, { type: "final", text: "x 1" }, { type: "interpret" });
    const old = s.attemptId;
    s = run(s, { type: "edit_transcript", text: "x 2" });
    s = { ...s, phase: "transcript_ready" };
    s = run(s, { type: "interpret" });
    const after = run(s, { type: "parse_success", attemptId: old, result: resp() });
    expect(after.phase).toBe("interpreting");
  });

  it("all not_heard result becomes the empty state", () => {
    const s = run(initialVoiceState(), { type: "start_listening" }, { type: "final", text: "hi" }, { type: "interpret" });
    expect(run(s, { type: "parse_success", attemptId: s.attemptId, result: resp(nh) })).toMatchObject({ phase: "empty", empty: "no_values" });
  });

  it("maps recognition errors", () => {
    const l = run(initialVoiceState(), { type: "start_listening" });
    expect(run(l, { type: "recognition_error", kind: "permission" })).toMatchObject({ phase: "error", error: "permission" });
    expect(run(l, { type: "recognition_error", kind: "no_speech" })).toMatchObject({ phase: "empty", empty: "no_speech" });
  });

  it("language_unsupported falls back to English with a notice", () => {
    const s = run(initialVoiceState("gu-IN"), { type: "start_listening" }, { type: "recognition_error", kind: "language_unsupported" });
    expect(s).toMatchObject({ phase: "idle", language: "en-IN", languageNotice: "gu-IN" });
  });

  it("editing the transcript from review returns to transcript_ready; interpret again gets a new attempt", () => {
    let s = run(initialVoiceState(), { type: "start_listening" }, { type: "final", text: "a 1" }, { type: "interpret" });
    s = run(s, { type: "parse_success", attemptId: s.attemptId, result: resp() }, { type: "edit_transcript", text: "a 2" });
    expect(s).toMatchObject({ phase: "transcript_ready", result: null });
    const before = s.attemptId;
    expect(run(s, { type: "interpret" }).attemptId).toBe(before + 1);
  });

  it("allows typing a transcript when speech is unsupported, and cannot start listening", () => {
    let s = run(initialVoiceState(), { type: "unsupported" });
    expect(run(s, { type: "start_listening" }).phase).toBe("unsupported");
    s = run(s, { type: "edit_transcript", text: "bill 2000" }, { type: "interpret" });
    expect(s.phase).toBe("interpreting");
    s = run(s, { type: "parse_failure", attemptId: s.attemptId, kind: "ai_unavailable" }, { type: "reset" });
    expect(s.phase).toBe("unsupported");
  });
});
