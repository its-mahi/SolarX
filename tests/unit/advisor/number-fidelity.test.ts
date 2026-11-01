import { describe, expect, it } from "vitest";
import { allowedVariants, extractNumbers, isAllowed, isTokenAllowed } from "@/lib/domain/advisor/number-fidelity";

const values = (t: string) => extractNumbers(t).map((n) => n.value);

describe("extractNumbers", () => {
  it.each([
    ["₹1,65,000", [165000]],
    ["165000", [165000]],
    ["1,65,000.50", [165000.5]],
    ["₹1.65 lakh", [165000]],
    ["1.2 lac", [120000]],
    ["78 thousand", [78000]],
    ["2k", [2000]],
    ["1 crore", [1e7]],
    ["93.2 of 100", [93.2, 100]],
    ["25%", [25]],
    ["3 kW", [3]],
    ["3kW", [3]],
  ])("reads %s", (text, expected) => {
    expect(values(text)).toEqual(expected);
  });

  it("ignores version identifiers and the label in Quote A", () => {
    expect(values("rule pm-surya-ghar.v1 and scoring.v1, Quote A, Quote B")).toEqual([]);
  });
});

describe("allowedVariants / isAllowed", () => {
  it("contains whole, lakh and thousand forms of 165000", () => {
    const v = allowedVariants(165000);
    for (const n of [165000, 1.65, 2, 165]) expect(v).toContain(n);
  });
  it("contains 6.8 and 7 for 6.8", () => {
    const v = allowedVariants(6.8);
    expect(v).toContain(6.8);
    expect(v).toContain(7);
  });
  it("rejects values that are not roundings", () => {
    expect(isAllowed(80000, [87000])).toBe(false);
    expect(isAllowed(5, [6.8])).toBe(false);
  });
});

describe("isTokenAllowed (suffix must match the scale)", () => {
  const [lakh] = extractNumbers("₹1.65 lakh");
  const [plain] = extractNumbers("1.65");
  const [two] = extractNumbers("₹2 lakh");
  it("accepts recognised lakh forms", () => {
    expect(isTokenAllowed(lakh, [165000])).toBe(true);
    expect(isTokenAllowed(two, [165000])).toBe(true);
  });
  it("does not accept 1.65 written without a suffix for 165000", () => {
    expect(isTokenAllowed(plain, [165000])).toBe(false);
  });
  it("rejects a different amount", () => {
    expect(isTokenAllowed(lakh, [87000])).toBe(false);
  });
});
