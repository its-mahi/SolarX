// Types for the AI solar advisor (specs/011 data-model §2, §6). Pure: no framework imports.
// The advisor only reads stored, code-computed results; it never ranks or scores.

export type AdvisorMode = "no_data" | "no_quotes" | "needs_comparison" | "compare" | "accepted";
export type QuoteLabel = string; // single uppercase letter, by submission order
export type AdvisorSectionKey = "observed" | "calculations" | "recommendation";

export type AdvisorFactUnit =
  | "inr"
  | "inr_per_year"
  | "kw"
  | "kwh_per_month"
  | "kwh_per_year"
  | "inr_per_kwh"
  | "kwh_per_kw_year"
  | "years"
  | "days"
  | "points"
  | "count"
  | null;

export type AdvisorFactKind =
  | "household_input"
  | "estimate"
  | "vendor_stated"
  | "score"
  | "roof_observation"
  | "status";

export interface AdvisorFact {
  id: string;
  section: AdvisorSectionKey;
  label: string;
  value: number | string | boolean | null;
  unit: AdvisorFactUnit;
  kind: AdvisorFactKind;
}

export interface QuoteLabelEntry {
  label: QuoteLabel;
  quoteId: string;
  vendorDisplayName: string;
  isDemo: boolean;
  status: "submitted" | "accepted";
  rank: number | null;
}

export interface AdvisorFacts {
  mode: AdvisorMode;
  leadingQuoteLabel: QuoteLabel | null;
  facts: AdvisorFact[];
  /** Untrusted, photo-derived text keyed by fact id. Sent to the AI only via untrustedText. */
  roofObservationTexts: Record<string, string>;
  /** Display map for the page only; never sent to the AI. */
  quoteLabels: QuoteLabelEntry[];
}

export interface ExplanationPoint {
  text: string;
  fact_refs: string[];
}

export interface ExplanationSection {
  summary: string;
  points: ExplanationPoint[];
}

/** Shape shared by the AI output and the template (the AI schema is exactly this). */
export interface AdvisorExplanation {
  observed: ExplanationSection;
  calculations: ExplanationSection;
  recommendation: ExplanationSection & { leading_quote_label: QuoteLabel | null };
  limitations: string[];
}

export interface TemplateExplanation extends AdvisorExplanation {
  /** false: the section only tells the household what to do next (nothing computed yet). */
  available: Record<AdvisorSectionKey, boolean>;
}

export type AdvisorValidationIssue =
  | "unknown_fact_ref"
  | "wrong_leading_quote"
  | "unknown_quote_label"
  | "summary_names_other_quote"
  | "number_not_in_cited_facts"
  | "number_not_in_facts"
  | "spelled_out_number"
  | "prohibited_claim";

export type ValidationResult = { ok: true } | { ok: false; issues: AdvisorValidationIssue[] };

// ---- Loader-shaped inputs (what buildAdvisorFacts consumes) ----

export interface AdvisorRoofInput {
  state: "completed" | "failed" | "none" | "no_consent";
  isCurrentPhoto: boolean;
  observations: { object: string; description: string; potentialImpact: string; confidence: "low" | "medium" | "high" }[];
  obstructions: string[];
  limitations: string[];
  siteSurveyRequired: boolean;
}

export interface AdvisorEstimateInput {
  capacityKw: number;
  installationCost: number;
  subsidyEstimate: number;
  netCost: number;
  annualGenerationKwh: number;
  annualSavingsEstimate: number;
  paybackYears: number | null;
  ruleVersion: string;
  tariffPerKwh: number | null;
  generationKwhPerKwYear: number | null;
}

export interface AdvisorReviewInput {
  totalScore: number;
  scoringVersion: string;
  missingFields: string[];
  flags: { code: string; severity: string }[];
  parts: {
    price: { points: number; max: number; notCompared: boolean };
    technical: { points: number; max: number };
    warranty: { points: number; max: number; items: { key: string; years: number | null }[] };
    completeness: { points: number; max: number; stated: number | null; total: number | null };
    timeline: { points: number; max: number };
  };
  /** null or rank null: not scored (invalid quote). */
  comparison: { rank: number | null; comparedCount: number | null; tied: boolean; comparedQuoteIds: string[] } | null;
  pricePerKw: number | null;
  subsidyEstimate: number | null;
  netCostEstimate: number | null;
}

export interface AdvisorQuoteInput {
  id: string;
  createdAt: string;
  status: "submitted" | "accepted";
  price: number;
  capacityKw: number;
  installationDays: number | null;
  earthingIncluded: boolean | null;
  documentationIncluded: boolean | null;
  vendorDisplayName: string;
  isDemo: boolean;
  review: AdvisorReviewInput | null;
}

export interface AdvisorInputs {
  request: {
    status: string;
    monthlyUnits: number | null;
    monthlyBill: number | null;
    budget: number | null;
    preferredCapacityKw: number | null;
  };
  roof: AdvisorRoofInput;
  estimate: AdvisorEstimateInput | null;
  quotes: AdvisorQuoteInput[];
}
