// Client-side shape of POST /api/quotes/compare (specs/006 contracts/quotes-compare.md).
import type { ComparedQuote, ExcludedQuote } from "@/lib/domain/quotes";

export type VendorSummary = { id: string; companyName: string; isDemo: boolean };
export type ComparedQuoteView = ComparedQuote & { vendor: VendorSummary };

export type ComparisonData = {
  requestId: string;
  requestStatus: "draft" | "open" | "quoted" | "accepted" | "closed";
  scoringVersion: string;
  weights: { price: number; technical: number; warranty: number; completeness: number; timeline: number };
  disclaimer: string;
  ruleVersion: string;
  compared: ComparedQuoteView[];
  excluded: ExcludedQuote[];
};

/** Hook for spec 007: returns the node shown in a card's `actionSlot` (e.g. the accept button). */
export type RenderQuoteAction = (quote: ComparedQuoteView, comparison: ComparisonData) => React.ReactNode;
