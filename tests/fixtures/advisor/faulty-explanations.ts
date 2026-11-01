// Faulty and must-pass AI outputs for the fidelity check (specs/011 contracts/advisor-explain-ai-output.md).
// Written against the compare_demo scenario (leading Quote A).
import type { AdvisorExplanation, AdvisorValidationIssue } from "@/lib/domain/advisor/types";

export const validExplanation = (): AdvisorExplanation => ({
  observed: {
    summary: "One photo shows a water tank and a staircase room on the terrace.",
    points: [
      {
        text: "A water tank may shade part of the roof (medium confidence, from one photo).",
        fact_refs: ["roof.observation.0.object", "roof.observation.0.confidence"],
      },
    ],
  },
  calculations: {
    summary: "An indicative 3 kW system is estimated to cost ₹1,65,000 before subsidy.",
    points: [
      {
        text: "The estimated central subsidy is ₹78,000, so the estimated net cost is ₹87,000.",
        fact_refs: ["estimate.subsidy_estimate", "estimate.net_cost"],
      },
    ],
  },
  recommendation: {
    summary: "Quote A has the highest comparison score (93.2 of 100).",
    leading_quote_label: "A",
    points: [{ text: "Quote C has the lowest price at ₹1,45,000 but did not state earthing.", fact_refs: ["quote.C.price", "quote.C.missing"] }],
  },
  limitations: ["Roof observations come from a single photo.", "All amounts are estimates."],
});

function patched(fn: (e: AdvisorExplanation) => void): AdvisorExplanation {
  const e = validExplanation();
  fn(e);
  return e;
}

export const FAULTY: { name: string; output: unknown; expected: AdvisorValidationIssue | "schema" }[] = [
  { name: "wrong net cost", expected: "number_not_in_cited_facts", output: patched((e) => { e.calculations.points[0].text = "The estimated central subsidy is ₹78,000, so the estimated net cost is ₹80,000."; }) },
  { name: "computed difference", expected: "number_not_in_cited_facts", output: patched((e) => { e.recommendation.points[0] = { text: "Quote C is ₹15,000 cheaper than Quote A.", fact_refs: ["quote.C.price", "quote.A.price"] }; }) },
  { name: "wrong leading label", expected: "wrong_leading_quote", output: patched((e) => { e.recommendation.leading_quote_label = "C"; }) },
  { name: "summary names other quote", expected: "summary_names_other_quote", output: patched((e) => { e.recommendation.summary = "Quote C is the one to choose."; }) },
  { name: "non-existent Quote D", expected: "unknown_quote_label", output: patched((e) => { e.recommendation.points[0].text = "Quote D has a good warranty."; }) },
  { name: "guaranteed subsidy", expected: "prohibited_claim", output: patched((e) => { e.calculations.points[0].text = "Your subsidy of ₹78,000 is guaranteed."; }) },
  { name: "verified vendor", expected: "prohibited_claim", output: patched((e) => { e.recommendation.points[0].text = "Quote C is a verified vendor."; }) },
  { name: "official score", expected: "prohibited_claim", output: patched((e) => { e.recommendation.points[0].text = "Quote C has an official score."; }) },
  { name: "spelled-out amount", expected: "spelled_out_number", output: patched((e) => { e.calculations.summary = "The system costs about one lakh rupees before subsidy."; }) },
  { name: "unknown fact ref", expected: "unknown_fact_ref", output: patched((e) => { e.calculations.points[0].fact_refs = ["estimate.magic"]; }) },
  { name: "wrong payback", expected: "number_not_in_cited_facts", output: patched((e) => { e.calculations.points.push({ text: "Payback is about 5 years.", fact_refs: ["estimate.payback_years"] }); }) },
  { name: "year in summary", expected: "number_not_in_facts", output: patched((e) => { e.observed.summary = "In 2026 the photo shows a water tank."; }) },
  { name: "extra key rank_override", expected: "schema", output: { ...validExplanation(), rank_override: "C" } },
];

export const MUST_PASS: { name: string; output: AdvisorExplanation }[] = [
  { name: "lakh form", output: patched((e) => { e.calculations.summary = "An indicative 3 kW system is estimated to cost ₹1.65 lakh before subsidy."; e.calculations.points[0].text = "The estimated central subsidy is ₹78 thousand, so the estimated net cost is ₹87,000."; }) },
  { name: "about 7 years", output: patched((e) => { e.calculations.points.push({ text: "Payback is about 7 years.", fact_refs: ["estimate.payback_years"] }); }) },
  { name: "93.2 of 100", output: patched((e) => { e.recommendation.points.push({ text: "Quote A scores 93.2 of 100.", fact_refs: ["quote.A.total_score", "scoring.max_total"] }); }) },
  { name: "negated claim", output: patched((e) => { e.limitations.push("Subsidy is not guaranteed."); }) },
];
