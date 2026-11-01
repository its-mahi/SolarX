import { describe, expect, it } from "vitest";
import { calculateRequestSchema } from "@/lib/validation/solar";

const id = "2b9e5c1a-3c7e-4d8f-9a10-0b1c2d3e4f50";
const ok = (v: unknown) => calculateRequestSchema.safeParse(v).success;
const paths = (v: unknown) => {
  const r = calculateRequestSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("calculateRequestSchema", () => {
  it("accepts a requestId", () => {
    expect(ok({ requestId: id })).toBe(true);
    expect(ok({ requestId: id, capacityOverrideKw: 5 })).toBe(true);
  });
  it("accepts inputs", () => {
    expect(ok({ inputs: { monthlyUnits: 250 } })).toBe(true);
    expect(ok({ inputs: { monthlyUnits: 250, monthlyBill: null, budget: 150000, preferredCapacityKw: 3 } })).toBe(true);
  });
  it("rejects an invalid uuid", () => {
    expect(ok({ requestId: "nope" })).toBe(false);
  });
  it.each([undefined, 0, -5, 10001, "250", NaN])("rejects monthlyUnits %s", (monthlyUnits) => {
    expect(ok({ inputs: { monthlyUnits } })).toBe(false);
  });
  it("reports the field path for invalid inputs", () => {
    expect(paths({ inputs: { monthlyUnits: -5 } })).toContain("inputs.monthlyUnits");
  });
  it.each([-1, 1000001, 12.5])("rejects monthlyBill %s", (monthlyBill) => {
    expect(ok({ inputs: { monthlyUnits: 250, monthlyBill } })).toBe(false);
  });
  it("rejects a negative budget", () => {
    expect(ok({ inputs: { monthlyUnits: 250, budget: -1 } })).toBe(false);
  });
  it.each([0, 101])("rejects preferredCapacityKw %s", (preferredCapacityKw) => {
    expect(ok({ inputs: { monthlyUnits: 250, preferredCapacityKw } })).toBe(false);
  });
  it("rejects unknown keys", () => {
    expect(ok({ requestId: id, extra: 1 })).toBe(false);
    expect(ok({ inputs: { monthlyUnits: 250, role: "x" } })).toBe(false);
  });
  it("rejects both requestId and inputs, or neither", () => {
    expect(ok({ requestId: id, inputs: { monthlyUnits: 250 } })).toBe(false);
    expect(ok({})).toBe(false);
  });
});
