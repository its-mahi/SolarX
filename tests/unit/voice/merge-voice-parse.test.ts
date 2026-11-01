import { describe, expect, it } from "vitest";
import { mergeVoiceParse } from "@/lib/domain/voice/merge-voice-parse";
import { ruleParseTranscript } from "@/lib/domain/voice/rule-parse-transcript";
import type { VoiceParseAiOutput } from "@/lib/ai/schemas/voice-parse";

const ai = (o: Partial<VoiceParseAiOutput>): VoiceParseAiOutput => ({
  monthly_units: null,
  monthly_bill: null,
  budget: null,
  preferred_capacity_kw: null,
  issues: [],
  ...o,
});
const merge = (t: string, a: VoiceParseAiOutput | null) => mergeVoiceParse(ruleParseTranscript(t), a);

describe("mergeVoiceParse (research R3 matrix)", () => {
  it("equal -> heard/both", () => {
    expect(merge("bill 2000", ai({ monthly_bill: 2000 })).monthly_bill).toEqual({
      status: "heard", value: 2000, source: "both", note: null,
    });
  });
  it("rules only -> heard/rules, also when AI is null", () => {
    for (const a of [null, ai({})]) {
      expect(merge("bill 2000", a).monthly_bill).toMatchObject({ status: "heard", source: "rules", value: 2000 });
    }
  });
  it("AI only and grounded -> heard/ai", () => {
    expect(merge("dedh lakh tak lagana hai", ai({ budget: 150000 })).budget).toMatchObject({
      status: "heard", source: "ai", value: 150000,
    });
  });
  it("AI only ungrounded -> needs_entry/not_in_transcript", () => {
    expect(merge("bill 2000", ai({ monthly_bill: 2000, monthly_units: 250 })).monthly_units).toEqual({
      status: "needs_entry", value: null, source: null, note: "not_in_transcript",
    });
  });
  it("AI reusing a number the rules bound to another field -> conflict", () => {
    expect(merge("bill 2000", ai({ monthly_units: 2000 })).monthly_units).toMatchObject({
      status: "needs_entry", note: "conflict",
    });
  });
  it("rule != AI -> conflict", () => {
    expect(merge("bill 2000", ai({ monthly_bill: 2500 })).monthly_bill).toMatchObject({ note: "conflict" });
  });
  it("neither -> not_heard", () => {
    expect(merge("hello", ai({})).budget).toEqual({ status: "not_heard", value: null, source: null, note: null });
  });
  it("AI issues force needs_entry", () => {
    const m = merge("budget 1 aur 1.5 lakh", ai({ budget: 150000, issues: [{ field: "budget", kind: "range" }] }));
    expect(m.budget).toMatchObject({ status: "needs_entry", note: "range" });
  });
  it("rule issues force needs_entry", () => {
    expect(merge("saal ka bill 24000", null).monthly_bill).toMatchObject({ note: "not_monthly" });
  });
  it("bounds", () => {
    expect(merge("budget 0", null).budget).toMatchObject({ status: "needs_entry", note: "out_of_range" });
    expect(merge("900 kw", null).preferred_capacity_kw).toMatchObject({ note: "out_of_range" });
    expect(merge("bill 2000.5", null).monthly_bill).toMatchObject({ note: "invalid_format" });
    expect(merge("2.55 kw", null).preferred_capacity_kw).toMatchObject({ note: "invalid_format" });
    expect(merge("2.5 kw", null).preferred_capacity_kw).toMatchObject({ status: "heard", value: 2.5 });
  });
  it("demo phrase", () => {
    const m = merge("250 units, bill 2000, budget 1,50,000, 3 kilowatt", null);
    expect(Object.values(m).map((r) => r.value)).toEqual([250, 2000, 150000, 3]);
  });
});
