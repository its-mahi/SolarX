import { describe, expect, it } from "vitest";
import { activeRuleSet } from "@/config/rules";
import { buildQuoteList, compareQuotes } from "@/lib/domain/quotes";
import { DEMO_CONTEXT, demoRows, greenvolt, invalidPrice, solartech, sunrise, withdrawn } from "../../fixtures/quotes/demo-quotes";

describe("buildQuoteList", () => {
  const list = buildQuoteList([solartech, withdrawn, greenvolt, sunrise], activeRuleSet, DEMO_CONTEXT);
  it("orders by submittedAt then id and keeps withdrawn with status", () => {
    expect(list.map((i) => i.quoteId.slice(-3))).toEqual(["301", "3f3", "302", "303"]);
    expect(list.filter((i) => i.status === "withdrawn")).toHaveLength(1);
    const times = list.map((i) => i.submittedAt);
    expect([...times].sort()).toEqual(times);
  });
  it("platform estimates", () => {
    const e = (s: string) => list.find((i) => i.quoteId.endsWith(s))!.platformEstimates;
    expect(e("301")).toMatchObject({ subsidyEstimate: 78000, netCostEstimate: 87000, ruleVersion: "pm-surya-ghar.v1" });
    expect(e("302")).toMatchObject({ subsidyEstimate: 78000, netCostEstimate: 64000 });
    expect(e("303")).toMatchObject({ subsidyEstimate: 78000, netCostEstimate: 111000 });
  });
  it("includes missing fields and flags", () => {
    const g = list.find((i) => i.quoteId.endsWith("302"))!;
    expect(g.missingFields).toEqual(["warrantyWorkmanship", "earthingStated"]);
    expect(g.flags.map((f) => f.code)).toContain("MISSING_EARTHING_STATED");
  });
});

describe("compareQuotes", () => {
  it("demo result matches research R-11", () => {
    const r = compareQuotes(demoRows(), DEMO_CONTEXT);
    expect(r.compared.map((c) => [c.rank, c.totalScore])).toEqual([[1, 94.8], [2, 94.3], [3, 83.1]]);
    expect(r.excluded).toEqual([]);
    expect(r.compared[2].flags.map((f) => f.code)).toEqual(["MISSING_WARRANTY_WORKMANSHIP", "MISSING_EARTHING_STATED"]);
  });
  it("withdrawn and invalid go to excluded and out of the price minimum", () => {
    const cheapWithdrawn = { ...withdrawn, price: 30000 };
    const r = compareQuotes([...demoRows(), cheapWithdrawn, invalidPrice], DEMO_CONTEXT);
    expect(r.compared).toHaveLength(3);
    expect(r.excluded.map((e) => e.reason).sort()).toEqual(["invalid", "withdrawn"]);
    expect(r.compared.map((c) => c.totalScore)).toEqual([94.8, 94.3, 83.1]);
    expect(r.excluded.find((e) => e.reason === "invalid")?.flags?.[0].code).toBe("INVALID_QUOTE");
  });
  it("no quotes", () => expect(compareQuotes([], DEMO_CONTEXT)).toEqual({ compared: [], excluded: [] }));
});
