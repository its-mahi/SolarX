import { describe, expect, it } from "vitest";
import {
  consentWithdrawalSchema,
  createRequestSchema,
  updateDraftSchema,
  usageFieldsSchema,
} from "@/lib/validation/requests";

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => schema.safeParse(v).success;

describe("coordinates", () => {
  it("accepts India bounds and rejects outside", () => {
    expect(ok(createRequestSchema, { latitude: 6.5, longitude: 68 })).toBe(true);
    expect(ok(createRequestSchema, { latitude: 37.5, longitude: 97.5 })).toBe(true);
    for (const [latitude, longitude] of [[6.49, 78], [37.51, 78], [17, 67.99], [17, 97.51]]) {
      const r = createRequestSchema.safeParse({ latitude, longitude });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toBe("SURYAMIT currently supports locations in India");
    }
  });

  it("requires both or neither", () => {
    expect(ok(createRequestSchema, { latitude: 17 })).toBe(false);
    expect(ok(createRequestSchema, { longitude: 78 })).toBe(false);
    expect(ok(createRequestSchema, { latitude: null, longitude: null })).toBe(true);
  });
});

describe("text and numbers", () => {
  it("trims and bounds address_text and locality", () => {
    expect(ok(createRequestSchema, { address_text: "  abcd  " })).toBe(false);
    expect(ok(createRequestSchema, { address_text: "  abcde  " })).toBe(true);
    expect(createRequestSchema.parse({ address_text: "  abcde  " }).address_text).toBe("abcde");
    expect(ok(createRequestSchema, { address_text: "a".repeat(301) })).toBe(false);
    expect(ok(createRequestSchema, { locality: "a" })).toBe(false);
    expect(ok(createRequestSchema, { locality: "ab" })).toBe(true);
  });

  it("validates usage fields", () => {
    const base = { monthly_units: 250, monthly_bill: null, budget: 150000, preferred_capacity_kw: null };
    expect(ok(usageFieldsSchema, base)).toBe(true);
    for (const monthly_units of [0, 10001, 2.5]) expect(ok(usageFieldsSchema, { ...base, monthly_units })).toBe(false);
    expect(ok(usageFieldsSchema, { ...base, monthly_bill: 100001 })).toBe(false);
    expect(ok(usageFieldsSchema, { ...base, monthly_bill: 0 })).toBe(true);
    expect(ok(usageFieldsSchema, { ...base, budget: 9999 })).toBe(false);
    expect(ok(usageFieldsSchema, { ...base, budget: 5000001 })).toBe(false);
    for (const kw of [0.4, 20.1, 3.25]) expect(ok(usageFieldsSchema, { ...base, preferred_capacity_kw: kw })).toBe(false);
    for (const kw of [0.5, 3, 3.1, 20]) expect(ok(usageFieldsSchema, { ...base, preferred_capacity_kw: kw })).toBe(true);
  });
});

describe("strictness", () => {
  it("rejects protected keys", () => {
    for (const key of ["status", "user_id", "roof_photo_path", "id"]) {
      expect(ok(createRequestSchema, { [key]: "x" })).toBe(false);
      expect(ok(updateDraftSchema, { locality: "Hyderabad", [key]: "x" })).toBe(false);
    }
  });

  it("updateDraftSchema rejects {}", () => {
    expect(ok(updateDraftSchema, {})).toBe(false);
    expect(ok(updateDraftSchema, { ai_consent: true })).toBe(true);
  });

  it("consentWithdrawalSchema accepts only ai_consent false", () => {
    expect(ok(consentWithdrawalSchema, { ai_consent: false })).toBe(true);
    expect(ok(consentWithdrawalSchema, { ai_consent: true })).toBe(false);
    expect(ok(consentWithdrawalSchema, { ai_consent: false, budget: 1 })).toBe(false);
    expect(ok(consentWithdrawalSchema, {})).toBe(false);
  });
});
