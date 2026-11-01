import { describe, expect, it } from "vitest";
import { advisorExplanationAiOutputSchema } from "@/lib/ai/schemas/advisor-explain";
import { buildAdvisorFacts } from "@/lib/domain/advisor/build-advisor-facts";
import { buildTemplateExplanation } from "@/lib/domain/advisor/template-explanation";
import { validateAdvisorExplanation } from "@/lib/domain/advisor/validate-explanation";
import { FAULTY, MUST_PASS, validExplanation } from "../../fixtures/advisor/faulty-explanations";
import { SCENARIOS } from "../../fixtures/advisor/advisor-scenarios";

const facts = buildAdvisorFacts(SCENARIOS.compare_demo);

describe("validateAdvisorExplanation", () => {
  it("accepts the base valid output", () => {
    expect(validateAdvisorExplanation(validExplanation(), facts)).toEqual({ ok: true });
  });

  it.each(FAULTY)("rejects: $name", ({ output, expected }) => {
    if (expected === "schema") {
      expect(advisorExplanationAiOutputSchema.safeParse(output).success).toBe(false);
      return;
    }
    const parsed = advisorExplanationAiOutputSchema.parse(output);
    const result = validateAdvisorExplanation(parsed, facts);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContain(expected);
  });

  it.each(MUST_PASS)("accepts: $name", ({ output }) => {
    expect(validateAdvisorExplanation(output, facts)).toEqual({ ok: true });
  });

  it("handles negation: not guaranteed passes, guaranteed fails", () => {
    const ok = validExplanation();
    ok.limitations.push("Subsidy is not guaranteed.");
    expect(validateAdvisorExplanation(ok, facts).ok).toBe(true);
    const bad = validExplanation();
    bad.limitations.push("Subsidy is guaranteed.");
    expect(validateAdvisorExplanation(bad, facts).ok).toBe(false);
  });

  it("rejects a 'best quote' claim", () => {
    const bad = validExplanation();
    bad.recommendation.points[0].text = "Quote A is the best quote.";
    const r = validateAdvisorExplanation(bad, facts);
    expect(!r.ok && r.issues).toContain("prohibited_claim");
  });

  it("requires no leading label when none is decided (needs_comparison)", () => {
    const f = buildAdvisorFacts(SCENARIOS.needs_comparison);
    const e = validExplanation();
    const r = validateAdvisorExplanation(e, f);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues).toContain("wrong_leading_quote");
  });

  it("property: the template always passes the validator", () => {
    for (const [name, inputs] of Object.entries(SCENARIOS)) {
      const f = buildAdvisorFacts(inputs);
      const t = buildTemplateExplanation(f);
      const result = validateAdvisorExplanation(t, f);
      expect(result, name).toEqual({ ok: true });
    }
  });
});
