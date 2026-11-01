import { describe, expect, it } from "vitest";
import { voiceParseAiOutputSchema } from "@/lib/ai/schemas/voice-parse";

const good = { monthly_units: 250, monthly_bill: 2000, budget: 150000, preferred_capacity_kw: 3, issues: [] };
const parse = (v: unknown) => voiceParseAiOutputSchema.safeParse(v);

describe("voiceParseAiOutputSchema", () => {
  it("accepts the well-formed example and nulls", () => {
    expect(parse(good).success).toBe(true);
    expect(parse({ ...good, monthly_units: null }).success).toBe(true);
  });
  it("defaults issues to []", () => {
    const rest: Record<string, unknown> = { ...good };
    delete rest.issues;
    const r = parse(rest);
    expect(r.success && r.data.issues).toEqual([]);
  });
  it("accepts a valid issue", () => {
    expect(parse({ ...good, issues: [{ field: "budget", kind: "range" }] }).success).toBe(true);
  });
  it.each([
    ["extra top-level key", { ...good, submit: true }],
    ["extra key in issues", { ...good, issues: [{ field: "budget", kind: "range", why: "x" }] }],
    ["string number", { ...good, budget: "150000" }],
    ["boolean", { ...good, budget: true }],
    ["negative", { ...good, budget: -1 }],
    ["NaN", { ...good, budget: Number.NaN }],
    ["Infinity", { ...good, budget: Number.POSITIVE_INFINITY }],
    ["missing key", { monthly_units: 1, monthly_bill: 1, budget: 1, issues: [] }],
    ["unknown issue kind", { ...good, issues: [{ field: "budget", kind: "weird" }] }],
    ["too many issues", { ...good, issues: Array.from({ length: 9 }, () => ({ field: "budget", kind: "range" })) }],
    ["array", []],
    ["null", null],
    ["string", "{}"],
  ])("rejects %s", (_name, value) => {
    expect(parse(value).success).toBe(false);
  });
});
