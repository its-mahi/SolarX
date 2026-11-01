// Fixed advisor disclaimers (FR-019, specs/011 data-model §7).
export type AdvisorDisclaimerCode =
  | "estimates_only"
  | "no_subsidy_guarantee"
  | "site_survey_required"
  | "score_not_official"
  | "ai_may_err";

export const ADVISOR_DISCLAIMER_CODES: readonly AdvisorDisclaimerCode[] = [
  "estimates_only",
  "no_subsidy_guarantee",
  "site_survey_required",
  "score_not_official",
  "ai_may_err",
];

export const ADVISOR_DISCLAIMERS: Record<AdvisorDisclaimerCode, string> = {
  estimates_only: "All amounts are indicative estimates based on rule version {rule_version}, not quotes or final prices.",
  no_subsidy_guarantee: "Subsidy is not guaranteed. Eligibility and payment are decided through the official PM Surya Ghar process.",
  site_survey_required: "A site survey by the installer is required before final design and price.",
  score_not_official: "Comparison score defined by SURYAMIT for guidance only — not a government, official or certification rating.",
  ai_may_err: "Explanations may be written by AI and can be imperfect. All numbers come from SURYAMIT's calculations and the vendors' quotes.",
};

export type AdvisorDisclaimer = { code: AdvisorDisclaimerCode; text: string };

export function renderDisclaimers(ruleVersion: string | null): AdvisorDisclaimer[] {
  return ADVISOR_DISCLAIMER_CODES.map((code) => ({
    code,
    text: ADVISOR_DISCLAIMERS[code].replace("{rule_version}", ruleVersion ?? "shown on the rules page"),
  }));
}
