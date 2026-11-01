import { describe, expect, it } from "vitest";
import { checkFieldValue } from "@/lib/domain/voice/field-bounds";
import { isValueGrounded } from "@/lib/domain/voice/grounding";
import {
  hasSpeechRecognition,
  isTransientRecognitionError,
  mapRecognitionError,
  resolveVoiceLanguage,
} from "@/lib/voice/language-support";
import { voiceFieldResultSchema, voiceParseRequestSchema } from "@/lib/validation/voice";

describe("checkFieldValue", () => {
  it.each([
    ["monthly_units", 1, "ok"], ["monthly_units", 0, "out_of_range"], ["monthly_units", 10001, "out_of_range"],
    ["monthly_units", 1.5, "invalid_format"], ["monthly_bill", 0, "ok"], ["monthly_bill", 100000, "ok"],
    ["monthly_bill", 100001, "out_of_range"], ["budget", 9999, "out_of_range"], ["budget", 5000000, "ok"],
    ["preferred_capacity_kw", 0.5, "ok"], ["preferred_capacity_kw", 0.4, "out_of_range"],
    ["preferred_capacity_kw", 20, "ok"], ["preferred_capacity_kw", 2.25, "invalid_format"],
    ["budget", Number.NaN, "invalid_format"],
  ] as const)("%s %d -> %s", (k, v, r) => expect(checkFieldValue(k, v)).toBe(r));
});

describe("isValueGrounded", () => {
  it("matches only numbers present", () => {
    const mentions = [{ value: 2000, start: 0, end: 4, raw: "2000" }];
    expect(isValueGrounded(2000, mentions)).toBe(true);
    expect(isValueGrounded(250, mentions)).toBe(false);
    expect(isValueGrounded(1, [])).toBe(false);
  });
});

describe("language support", () => {
  it("detects constructors without touching globals", () => {
    expect(hasSpeechRecognition({})).toBe(false);
    expect(hasSpeechRecognition(undefined)).toBe(false);
    expect(hasSpeechRecognition({ webkitSpeechRecognition: function () {} })).toBe(true);
    expect(hasSpeechRecognition({ SpeechRecognition: function () {} })).toBe(true);
  });
  it("maps recognition errors", () => {
    expect(mapRecognitionError("not-allowed")).toBe("permission");
    expect(mapRecognitionError("service-not-allowed")).toBe("permission");
    expect(mapRecognitionError("no-speech")).toBe("no_speech");
    expect(mapRecognitionError("audio-capture")).toBe("no_mic");
    expect(mapRecognitionError("language-not-supported")).toBe("language_unsupported");
    expect(mapRecognitionError("network")).toBe("recognition");
    expect(mapRecognitionError(undefined)).toBe("recognition");
  });
  it("treats only silence, network and abort as transient (restartable) recognition errors", () => {
    for (const code of ["no-speech", "network", "aborted"]) expect(isTransientRecognitionError(code)).toBe(true);
    for (const code of ["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported", "bad-grammar", undefined])
      expect(isTransientRecognitionError(code)).toBe(false);
  });
  it("resolves languages", () => {
    expect(resolveVoiceLanguage("gu-IN")).toBe("gu-IN");
    expect(resolveVoiceLanguage("fr-FR")).toBe("hi-IN");
  });
});

describe("voice request/response schemas", () => {
  it("cleans and bounds the transcript", () => {
    const ok = voiceParseRequestSchema.safeParse({ transcript: "  bill\n2000\u0000 ", language: "hi-IN" });
    expect(ok.success && ok.data.transcript).toBe("bill 2000");
    expect(voiceParseRequestSchema.safeParse({ transcript: "   ", language: "hi-IN" }).success).toBe(false);
    expect(voiceParseRequestSchema.safeParse({ transcript: "a".repeat(501), language: "hi-IN" }).success).toBe(false);
    expect(voiceParseRequestSchema.safeParse({ transcript: "a".repeat(500), language: "hi-IN" }).success).toBe(true);
    expect(voiceParseRequestSchema.safeParse({ transcript: "a", language: "fr-FR" }).success).toBe(false);
    expect(voiceParseRequestSchema.safeParse({ transcript: "a", language: "hi-IN", x: 1 }).success).toBe(false);
  });
  it("enforces the heard/needs_entry invariants", () => {
    const p = (v: unknown) => voiceFieldResultSchema.safeParse(v).success;
    expect(p({ status: "heard", value: 1, source: "rules", note: null })).toBe(true);
    expect(p({ status: "heard", value: null, source: "rules", note: null })).toBe(false);
    expect(p({ status: "needs_entry", value: null, source: null, note: "conflict" })).toBe(true);
    expect(p({ status: "needs_entry", value: null, source: null, note: null })).toBe(false);
    expect(p({ status: "not_heard", value: null, source: null, note: null })).toBe(true);
    expect(p({ status: "not_heard", value: 3, source: null, note: null })).toBe(false);
  });
});
