import { describe, expect, it } from "vitest";
import { advisorExplanationAiOutputSchema } from "@/lib/ai/schemas/advisor-explain";
import { validExplanation } from "../../fixtures/advisor/faulty-explanations";

const parse = (v: unknown) => advisorExplanationAiOutputSchema.safeParse(v);

describe("advisorExplanationAiOutputSchema", () => {
  it("accepts a well-formed output", () => {
    expect(parse(validExplanation()).success).toBe(true);
  });

  it("accepts a null leading label", () => {
    const e = validExplanation();
    e.recommendation.leading_quote_label = null;
    expect(parse(e).success).toBe(true);
  });

  const mutate = (fn: (e: ReturnType<typeof validExplanation>) => unknown) => {
    const e = validExplanation();
    return fn(e) ?? e;
  };

  it.each([
    ["extra top-level key", () => ({ ...validExplanation(), rank_override: "C" })],
    ["extra key in a point", () => mutate((e) => { (e.observed.points[0] as unknown as Record<string, unknown>).score = 1; })],
    ["missing section", () => { const { calculations: _c, ...rest } = validExplanation(); void _c; return rest; }],
    ["6 points", () => mutate((e) => { e.observed.points = Array.from({ length: 6 }, () => e.observed.points[0]); })],
    ["empty fact_refs", () => mutate((e) => { e.observed.points[0].fact_refs = []; })],
    ["7 fact_refs", () => mutate((e) => { e.observed.points[0].fact_refs = Array.from({ length: 7 }, (_, i) => `f${i}`); })],
    ["lowercase label", () => mutate((e) => { e.recommendation.leading_quote_label = "a"; })],
    ["two-letter label", () => mutate((e) => { e.recommendation.leading_quote_label = "AB"; })],
    ["over-long summary", () => mutate((e) => { e.observed.summary = "x".repeat(301); })],
    ["over-long point", () => mutate((e) => { e.observed.points[0].text = "x".repeat(281); })],
    ["control character", () => mutate((e) => { e.observed.summary = "bad\u0007text"; })],
    ["non-object", () => "not an object"],
    ["string null", () => "null"],
    ["null", () => null],
  ])("rejects %s", (_n, build) => {
    expect(parse(build()).success).toBe(false);
  });
});
