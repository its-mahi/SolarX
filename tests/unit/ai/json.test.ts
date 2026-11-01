import { describe, expect, it } from "vitest";
import { extractJsonObject } from "@/lib/ai/json";

describe("extractJsonObject", () => {
  it("accepts plain and fenced objects", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ ok: true, value: { a: 1 } });
  });
  it("rejects prose, arrays, multiple objects and empty", () => {
    expect(extractJsonObject('Sure! {"a":1}').ok).toBe(false);
    expect(extractJsonObject("[1]").ok).toBe(false);
    expect(extractJsonObject('{"a":1}{"b":2}').ok).toBe(false);
    expect(extractJsonObject("").ok).toBe(false);
  });
});
