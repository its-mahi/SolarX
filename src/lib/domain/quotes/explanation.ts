// Deterministic explanation sentence (specs/006 R-08). Fixed templates; no vendor text, no AI.
import type { QuoteReview } from "./types";

export type ExplanationContext = { minPricePerKw: number; missingCount: number };

export function buildExplanation(review: QuoteReview, context: ExplanationContext): string {
  const { rank, comparedCount } = review.scoreBreakdown.comparison;
  const parts: string[] = [];
  parts.push(comparedCount === 1 ? "Only quote received." : rank === 1 ? "Highest comparison score." : `Rank ${rank} of ${comparedCount}.`);

  if (review.pricePerKw <= context.minPricePerKw) parts.push("Lowest price per kW.");
  else {
    const pct = Math.round((review.pricePerKw / context.minPricePerKw - 1) * 100);
    parts.push(pct === 0 ? "Price per kW within 1% of the lowest." : `Price per kW ${pct}% above the lowest.`);
  }

  parts.push(
    context.missingCount === 0
      ? "All recommended details provided."
      : `${context.missingCount} recommended ${context.missingCount === 1 ? "detail" : "details"} not stated.`,
  );

  const unknowns = review.scoreBreakdown.penalties.filter((p) => p.part !== "completeness");
  if (unknowns.length > 0) {
    const largest = unknowns.reduce((a, b) => (b.pointsForgone > a.pointsForgone ? b : a));
    parts.push(`${largest.message}.`);
  }
  return parts.join(" ").slice(0, 500);
}
