import { describe, expect, it } from "vitest";
import { buildAdvisorFacts, factsForPrompt, labelQuotes } from "@/lib/domain/advisor/build-advisor-facts";
import { QUOTE_IDS, SCENARIOS, VENDOR_NAMES, demoEstimate, quote, review } from "../../fixtures/advisor/advisor-scenarios";

const fact = (s: string, id: string) => buildAdvisorFacts(SCENARIOS[s]).facts.find((f) => f.id === id);

describe("buildAdvisorFacts", () => {
  it("copies stored values exactly (compare_demo)", () => {
    const f = buildAdvisorFacts(SCENARIOS.compare_demo);
    const v = (id: string) => f.facts.find((x) => x.id === id)?.value;
    expect(v("estimate.net_cost")).toBe(demoEstimate.netCost);
    expect(v("estimate.subsidy_estimate")).toBe(78000);
    expect(v("estimate.payback_years")).toBe(6.8);
    expect(v("quote.A.total_score")).toBe(93.2);
    expect(v("quote.B.total_score")).toBe(92.0);
    expect(v("quote.C.total_score")).toBe(70.9);
    expect(v("quote.C.missing")).toBe("earthing, installation time");
    expect(v("scoring.max_total")).toBe(100);
    expect(v("roof.observation.0.object")).toBe("water tank");
  });

  it("labels quotes by submission order, not rank", () => {
    const shuffled = [...SCENARIOS.compare_demo.quotes].reverse();
    expect(labelQuotes(shuffled).map((l) => [l.label, l.quote.id])).toEqual([
      ["A", QUOTE_IDS.A],
      ["B", QUOTE_IDS.B],
      ["C", QUOTE_IDS.C],
    ]);
    // a lower-ranked quote submitted first still gets label A
    const f = buildAdvisorFacts({
      ...SCENARIOS.compare_demo,
      quotes: [
        quote("A", { review: review({ score: 70, rank: 2, ids: [QUOTE_IDS.A, QUOTE_IDS.B] }) }),
        quote("B", { review: review({ score: 90, rank: 1, ids: [QUOTE_IDS.A, QUOTE_IDS.B] }) }),
      ],
    });
    expect(f.leadingQuoteLabel).toBe("B");
  });

  it.each([
    ["compare_demo", "compare", "A"],
    ["no_quotes", "no_quotes", null],
    ["needs_comparison", "needs_comparison", null],
    ["accepted", "accepted", "B"],
    ["single_quote", "compare", "A"],
    ["tied", "compare", "A"],
    ["invalid_quote_excluded", "compare", "A"],
    ["no_data", "no_data", null],
    ["no_estimate", "compare", "A"],
  ])("%s -> mode %s, leading %s", (name, mode, leading) => {
    const f = buildAdvisorFacts(SCENARIOS[name]);
    expect(f.mode).toBe(mode);
    expect(f.leadingQuoteLabel).toBe(leading);
  });

  it("an excluded quote never leads and is marked excluded", () => {
    const f = buildAdvisorFacts(SCENARIOS.invalid_quote_excluded);
    expect(f.leadingQuoteLabel).toBe("A");
    expect(f.facts.find((x) => x.id === "quote.C.excluded")?.value).toBe(true);
    expect(f.facts.find((x) => x.id === "quote.C.total_score")).toBeUndefined();
  });

  it("a stale comparison (withdrawn quote still in comparedQuoteIds) needs a new comparison", () => {
    const f = buildAdvisorFacts({
      ...SCENARIOS.compare_demo,
      quotes: SCENARIOS.compare_demo.quotes.slice(0, 2), // C withdrawn; reviews still list C
    });
    expect(f.mode).toBe("needs_comparison");
    expect(f.leadingQuoteLabel).toBeNull();
  });

  it("zero savings: payback fact is null", () => {
    expect(fact("zero_savings", "estimate.payback_years")?.value).toBeNull();
  });

  it("roof states are explicit facts", () => {
    expect(fact("no_roof_consent", "roof.status")?.value).toBe("no_consent");
    expect(fact("roof_failed", "roof.status")?.value).toBe("failed");
    expect(fact("roof_stale_photo", "roof.is_current_photo")?.value).toBe(false);
  });

  it("facts contain no vendor names, notes or personal data; names only in the display map", () => {
    const f = buildAdvisorFacts(SCENARIOS.compare_demo);
    const serialised = JSON.stringify([f.facts, f.roofObservationTexts]);
    for (const name of Object.values(VENDOR_NAMES)) expect(serialised).not.toContain(name);
    expect(serialised).not.toMatch(/ignore previous|vendor_notes|address|phone/i);
    expect(f.quoteLabels.map((q) => q.vendorDisplayName)).toEqual(Object.values(VENDOR_NAMES));
  });

  it("prompt facts exclude photo-derived free text", () => {
    const f = buildAdvisorFacts(SCENARIOS.compare_demo);
    const ids = factsForPrompt(f).map((x) => x.id);
    expect(ids.some((id) => id.endsWith(".text") || id === "roof.obstructions" || id.endsWith(".object") && id.startsWith("roof."))).toBe(false);
    expect(Object.keys(f.roofObservationTexts).length).toBeGreaterThan(0);
  });

  it("compare_demo and compare_demo_injected give deep-equal facts", () => {
    expect(buildAdvisorFacts(SCENARIOS.compare_demo_injected)).toEqual(buildAdvisorFacts(SCENARIOS.compare_demo));
  });
});
