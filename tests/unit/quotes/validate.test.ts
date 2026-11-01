import { describe, expect, it } from "vitest";
import { normalizeQuote, validateRequiredFields } from "@/lib/domain/quotes";
import { invalidPrice, sunrise } from "../../fixtures/quotes/demo-quotes";

describe("validateRequiredFields", () => {
  it("accepts demo quotes", () => expect(validateRequiredFields(normalizeQuote(sunrise)).valid).toBe(true));
  it.each([
    ["price 0", invalidPrice],
    ["price negative", { ...sunrise, price: -5 }],
    ["capacity 0", { ...sunrise, capacity_kw: 0 }],
    ["capacity null", { ...sunrise, capacity_kw: null as never }],
    ["price NaN", { ...sunrise, price: Number.NaN }],
  ])("rejects %s", (_n, row) => {
    const r = validateRequiredFields(normalizeQuote(row));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("INVALID_QUOTE");
  });
});
