// Types for quote comparison (specs/006 data-model). Pure: no framework imports.
import type { RecommendedItem, TechnicalItem } from "@/config/scoring.v1";

export type QuoteStatusValue = "submitted" | "accepted" | "rejected" | "withdrawn";

/** The quote columns this feature reads (vendor free text is display-only). */
export type QuoteRowLike = {
  id: string;
  request_id: string;
  vendor_id: string;
  price: number;
  capacity_kw: number | string;
  panel_details: unknown;
  inverter_details: unknown;
  warranty_details: unknown;
  installation_days: number | null;
  earthing_included: boolean | null;
  documentation_included: boolean | null;
  other_inclusions: unknown;
  exclusions: string | null;
  vendor_notes: string | null;
  source: string;
  status: string;
  created_at: string;
};

export type NormalizedQuote = {
  quoteId: string;
  requestId: string;
  vendorId: string;
  status: QuoteStatusValue;
  submittedAt: string;
  price: number | null;
  capacityKw: number | null;
  pricePerKw: number | null;
  panel: {
    brand: string | null;
    model: string | null;
    wattage: number | null;
    quantity: number | null;
    certifications: string[] | null;
    computedCapacityKw: number | null;
  };
  inverter: { brand: string | null; model: string | null; type: string | null; capacityKw: number | null };
  warranty: {
    panelProductYears: number | null;
    panelPerformanceYears: number | null;
    inverterYears: number | null;
    workmanshipYears: number | null;
  };
  installationDays: number | null;
  earthingIncluded: boolean | null;
  documentationIncluded: boolean | null;
  /** Display only. Never reaches scoring or flags. */
  vendorText: { otherInclusions: string[] | null; exclusions: string | null; notes: string | null };
  source: "manual" | "ai_extracted";
};

/** Structured fields only: the only thing scoring and flags can see. */
export type ScoringInput = {
  quoteId: string;
  submittedAt: string;
  price: number;
  capacityKw: number;
  panel: { brand: string | null; wattage: number | null; quantity: number | null; certifications: string[] | null };
  inverter: { brand: string | null; type: string | null; capacityKw: number | null };
  warranty: { panelProduct: number | null; panelPerformance: number | null; inverter: number | null; workmanship: number | null };
  installationDays: number | null;
  earthingIncluded: boolean | null;
  documentationIncluded: boolean | null;
};

export type FlagSeverity = "warning" | "info";
export type Flag = { code: string; severity: FlagSeverity; message: string; field?: string };

export type FlagContext = {
  budget: number | null;
  referenceCapacityKw: number | null;
  /** Price per kW of every compared quote (including this one). */
  comparedPricesPerKw: number[];
};

export type Penalty = { part: PartKey; item: string; pointsForgone: number; message: string };
export type PartKey = "price" | "technical" | "warranty" | "completeness" | "timeline";

export type TechnicalItemResult = {
  key: TechnicalItem;
  points: number;
  max: number;
  status: "met" | "not_met" | "unknown";
  reason: string;
};

export type WarrantyItemResult = {
  key: "panelProduct" | "panelPerformance" | "inverter" | "workmanship";
  years: number | null;
  points: number;
  max: number;
  target: number;
};

export type ScoreBreakdown = {
  version: string;
  parts: {
    price: { points: number; max: number; reason: string; notCompared?: true };
    technical: { points: number; max: number; items: TechnicalItemResult[] };
    warranty: { points: number; max: number; items: WarrantyItemResult[] };
    completeness: { points: number; max: number; stated: number; total: number };
    timeline: { points: number; max: number; days: number | null };
  };
  penalties: Penalty[];
  total: number;
  comparison: { rank: number; comparedCount: number; tied: boolean; comparedQuoteIds: string[] };
};

/** Output of scoreQuotes (before flags/estimates). */
export type QuoteReview = {
  quoteId: string;
  rank: number;
  tied: boolean;
  totalScore: number;
  pricePerKw: number;
  scoreBreakdown: ScoreBreakdown;
};

export type PlatformEstimates = { subsidyEstimate: number; netCostEstimate: number; ruleVersion: string };

export type MissingField = RecommendedItem;

export type QuoteListItem = {
  quoteId: string;
  requestId: string;
  vendorId: string;
  status: QuoteStatusValue;
  submittedAt: string;
  normalized: NormalizedQuote;
  platformEstimates: PlatformEstimates | null;
  missingFields: MissingField[];
  flags: Flag[];
};

export type ComparedQuote = {
  rank: number;
  tied: boolean;
  quoteId: string;
  status: QuoteStatusValue;
  submittedAt: string;
  normalized: NormalizedQuote;
  platformEstimates: PlatformEstimates | null;
  missingFields: MissingField[];
  flags: Flag[];
  scoreBreakdown: ScoreBreakdown;
  totalScore: number;
  explanation: string;
};

export type ExcludedQuote = {
  quoteId: string;
  status: QuoteStatusValue;
  reason: "withdrawn" | "invalid";
  flags?: Flag[];
};

export type ComparisonResult = { compared: ComparedQuote[]; excluded: ExcludedQuote[] };

export type RequestContext = { budget: number | null; preferredCapacityKw: number | null; estimateCapacityKw: number | null };
