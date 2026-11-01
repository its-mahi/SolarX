import { describe, expect, it } from "vitest";
import { normalizeIndianNumbers } from "@/lib/domain/voice/normalize-indian-numbers";

const values = (s: string) => normalizeIndianNumbers(s).map((m) => m.value);

describe("normalizeIndianNumbers: single-value cases", () => {
  const cases: Array<[string, number]> = [
    ["1,50,000", 150000],
    ["150000", 150000],
    ["1,500,000", 1500000],
    ["1.5 lakh", 150000],
    ["1.5 lac", 150000],
    ["dedh lakh", 150000],
    ["डेढ़ लाख", 150000],
    ["દોઢ લાખ", 150000],
    ["dhai lakh", 250000],
    ["ढाई लाख", 250000],
    ["અઢી લાખ", 250000],
    ["sava lakh", 125000],
    ["सवा लाख", 125000],
    ["paune do lakh", 175000],
    ["ek lakh pachaas hazaar", 150000],
    ["one lakh fifty thousand", 150000],
    ["do hazaar", 2000],
    ["दो हज़ार", 2000],
    ["દો હજાર".replace("દો", "બે"), 2000],
    ["બે હજાર", 2000],
    ["saadhe teen sau", 350],
    ["१,५०,०००", 150000],
    ["૩", 3],
    ["2k", 2000],
    ["₹2,000", 2000],
    ["Rs. 2000", 2000],
    ["1 crore", 10000000],
    ["250 units", 250],
    ["twenty five", 25],
    ["do sau pachaas hazaar", 250000],
    ["do hazaar paanch sau", 2500],
    ["teen", 3],
    ["तीन", 3],
    ["2.5", 2.5],
  ];
  it.each(cases)("%s -> %d", (input, expected) => {
    expect(values(input)).toEqual([expected]);
  });
});

describe("normalizeIndianNumbers: multiple mentions and spans", () => {
  it("treats 25,00 as two mentions", () => {
    expect(values("25,00")).toEqual([25, 0]);
  });
  it("reports value and span", () => {
    const text = "mera bill 2,000 hai";
    const [m] = normalizeIndianNumbers(text);
    expect(m.value).toBe(2000);
    expect(text.slice(m.start, m.end)).toBe("2,000");
    expect(m.raw).toBe("2,000");
  });
  it("splits adjacent numbers that do not compose", () => {
    expect(values("2000 2500")).toEqual([2000, 2500]);
    expect(values("1 se 1.5 lakh")).toEqual([1, 150000]);
  });
  it("does not read kw or kwh as thousands", () => {
    expect(values("3kw")).toEqual([3]);
    expect(values("250kwh")).toEqual([250]);
  });
});

describe("normalizeIndianNumbers: malformed and ambiguous input", () => {
  it("returns nothing for empty or number-free text", () => {
    expect(values("")).toEqual([]);
    expect(values("   ")).toEqual([]);
    expect(values("mujhe solar chahiye")).toEqual([]);
  });
  it("drops invalid compositions instead of guessing", () => {
    expect(values("lakh hazaar")).toEqual([]);
    expect(values("ek hazaar do lakh")).toEqual([]);
    expect(values("sava")).toEqual([]);
  });
  it("ignores a lone ambiguous word unless a quantity word follows", () => {
    expect(values("what do you mean")).toEqual([]);
    expect(values("do kilowatt")).toEqual([2]);
    expect(values("ke saath")).toEqual([]);
  });
  it("never returns negative or non-finite values", () => {
    for (const m of normalizeIndianNumbers("paune lakh 9".repeat(3))) {
      expect(Number.isFinite(m.value)).toBe(true);
      expect(m.value).toBeGreaterThanOrEqual(0);
    }
  });
});
