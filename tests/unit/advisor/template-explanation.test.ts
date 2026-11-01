import { describe, expect, it } from "vitest";
import { buildAdvisorFacts } from "@/lib/domain/advisor/build-advisor-facts";
import { buildTemplateExplanation } from "@/lib/domain/advisor/template-explanation";
import { formatInr } from "@/lib/format";
import { SCENARIOS, VENDOR_NAMES } from "../../fixtures/advisor/advisor-scenarios";

const tpl = (name: string) => {
  const facts = buildAdvisorFacts(SCENARIOS[name]);
  return { facts, t: buildTemplateExplanation(facts) };
};
const text = (name: string) => {
  const { t } = tpl(name);
  return [t.observed, t.calculations, t.recommendation].flatMap((s) => [s.summary, ...s.points.map((p) => p.text)]).concat(t.limitations).join("\n");
};

describe("buildTemplateExplanation", () => {
  it.each(Object.keys(SCENARIOS))("%s: every point cites existing facts; no banned words or vendor names", (name) => {
    const { facts, t } = tpl(name);
    const ids = new Set(facts.facts.map((f) => f.id));
    for (const s of [t.observed, t.calculations, t.recommendation]) {
      expect(s.summary.length).toBeGreaterThan(0);
      for (const p of s.points) {
        expect(p.fact_refs.length).toBeGreaterThan(0);
        for (const r of p.fact_refs) expect(ids.has(r)).toBe(true);
      }
    }
    expect(text(name)).not.toMatch(/\b(best|guarantee\w*|verified|official)\b/i);
    for (const v of Object.values(VENDOR_NAMES)) expect(text(name)).not.toContain(v);
  });

  it("compare_demo: amounts equal stored values; names only the leading quote in the summary", () => {
    const { t } = tpl("compare_demo");
    expect(t.calculations.summary).toContain(formatInr(165000));
    expect(t.calculations.points.map((p) => p.text).join(" ")).toContain(formatInr(87000));
    expect(t.recommendation.summary).toContain("Quote A has the highest comparison score (93.2 of 100)");
    expect(t.recommendation.summary).not.toMatch(/Quote [BC]/);
    expect(t.recommendation.leading_quote_label).toBe("A");
    expect(t.observed.summary).toContain("water tank");
  });

  it("no roof assessment explains why and requires a site survey; other sections remain", () => {
    for (const [name, why] of [["no_roof_consent", /not allowed/], ["roof_failed", /could not be completed/]] as const) {
      const { t } = tpl(name);
      expect(t.available.observed).toBe(false);
      expect(t.observed.summary).toMatch(why);
      expect(t.observed.summary).toMatch(/site survey/);
      expect(t.available.calculations).toBe(true);
    }
  });

  it("stale photo is stated", () => {
    expect(tpl("roof_stale_photo").t.observed.summary).toMatch(/previous photo/);
  });

  it("no estimate: says what to complete first", () => {
    const { t } = tpl("no_estimate");
    expect(t.available.calculations).toBe(false);
    expect(t.calculations.summary).toMatch(/monthly electricity use and budget/);
  });

  it("zero savings: payback not available, never infinite", () => {
    const s = text("zero_savings");
    expect(s).toMatch(/payback is not available/);
    expect(s).not.toMatch(/infinit|NaN|null/i);
  });

  it("no quotes / needs comparison name no quote and give a next action", () => {
    const nq = tpl("no_quotes").t.recommendation;
    expect(nq.summary).toMatch(/No quotes have arrived/);
    expect(nq.leading_quote_label).toBeNull();
    const nc = tpl("needs_comparison").t.recommendation;
    expect(nc.summary).toMatch(/Open the comparison/);
    expect(nc.summary).not.toMatch(/Quote [A-Z]/);
    expect(nc.leading_quote_label).toBeNull();
  });

  it("accepted presents the accepted quote and no other as the lead", () => {
    const { t } = tpl("accepted");
    expect(t.recommendation.summary).toMatch(/You accepted Quote B/);
    expect(t.recommendation.leading_quote_label).toBe("B");
  });

  it("single quote and ties are described honestly", () => {
    expect(tpl("single_quote").t.recommendation.summary).toMatch(/only scored quote/);
    expect(tpl("tied").t.recommendation.summary).toMatch(/tied/i);
  });

  it("excluded quote is mentioned as left out, never recommended", () => {
    const { t } = tpl("invalid_quote_excluded");
    expect(t.recommendation.points.map((p) => p.text).join(" ")).toMatch(/Quote C could not be scored/);
    expect(t.recommendation.summary).not.toMatch(/Quote C/);
  });

  it("no_data: all three sections are next-action messages", () => {
    const { t } = tpl("no_data");
    expect(t.available).toEqual({ observed: false, calculations: false, recommendation: false });
  });
});
