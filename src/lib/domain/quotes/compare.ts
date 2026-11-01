// Orchestrates normalize → validate → score → flag → estimate → explain (specs/006 contracts).
import { activeRuleSet, type RuleSet } from "@/config/rules";
import { scoringConfig, type ScoringConfig } from "@/config/scoring.v1";
import { calculateCentralCfa, calculateNetCost } from "@/lib/domain/financial";
import { buildExplanation } from "./explanation";
import { computeFlags, invalidQuoteFlag } from "./flags";
import { detectMissingFields } from "./missing-fields";
import { normalizeQuote, toScoringInput } from "./normalize";
import { scoreQuotes } from "./scoring";
import type {
  ComparedQuote,
  ComparisonResult,
  ExcludedQuote,
  FlagContext,
  NormalizedQuote,
  PlatformEstimates,
  QuoteListItem,
  QuoteRowLike,
  RequestContext,
  ScoringInput,
} from "./types";
import { validateRequiredFields } from "./validate";

function estimatesFor(n: NormalizedQuote, rules: RuleSet): PlatformEstimates | null {
  if (n.price === null || n.price < 0 || n.capacityKw === null || n.capacityKw <= 0) return null;
  const subsidyEstimate = calculateCentralCfa(n.capacityKw, rules);
  return { subsidyEstimate, netCostEstimate: calculateNetCost(n.price, subsidyEstimate), ruleVersion: rules.version };
}

const byTimeThenId = (a: { submittedAt: string; quoteId: string }, b: { submittedAt: string; quoteId: string }) =>
  a.submittedAt < b.submittedAt ? -1 : a.submittedAt > b.submittedAt ? 1 : a.quoteId < b.quoteId ? -1 : a.quoteId > b.quoteId ? 1 : 0;

type Prepared = { normalized: NormalizedQuote; input: ScoringInput | null; compared: boolean };

function prepare(rows: QuoteRowLike[]): Prepared[] {
  return rows.map((row) => {
    const normalized = normalizeQuote(row);
    const valid = validateRequiredFields(normalized).valid;
    return { normalized, input: valid ? toScoringInput(normalized) : null, compared: valid && normalized.status !== "withdrawn" };
  });
}

function flagContext(request: RequestContext, prepared: Prepared[]): FlagContext {
  return {
    budget: request.budget,
    referenceCapacityKw: request.preferredCapacityKw ?? request.estimateCapacityKw ?? null,
    comparedPricesPerKw: prepared.filter((p) => p.compared).map((p) => p.input!.price / p.input!.capacityKw),
  };
}

/** Normalized list with estimates, missing items and flags; no scoring. Withdrawn quotes are kept. */
export function buildQuoteList(
  rows: QuoteRowLike[],
  rules: RuleSet = activeRuleSet,
  request: RequestContext = { budget: null, preferredCapacityKw: null, estimateCapacityKw: null },
  config: ScoringConfig = scoringConfig,
): QuoteListItem[] {
  const prepared = prepare(rows);
  const ctx = flagContext(request, prepared);
  return prepared
    .map((p): QuoteListItem => ({
      quoteId: p.normalized.quoteId,
      requestId: p.normalized.requestId,
      vendorId: p.normalized.vendorId,
      status: p.normalized.status,
      submittedAt: p.normalized.submittedAt,
      normalized: p.normalized,
      platformEstimates: estimatesFor(p.normalized, rules),
      missingFields: p.input ? detectMissingFields(p.input) : [],
      flags: p.input ? computeFlags(p.input, ctx, config) : [invalidQuoteFlag()],
    }))
    .sort(byTimeThenId);
}

/** Scores the non-withdrawn, valid quotes of one request. Free text is unreachable (ScoringInput only). */
export function compareQuotes(
  rows: QuoteRowLike[],
  request: RequestContext,
  rules: RuleSet = activeRuleSet,
  config: ScoringConfig = scoringConfig,
): ComparisonResult {
  const prepared = prepare(rows);
  const ctx = flagContext(request, prepared);
  const comparedPrepared = prepared.filter((p) => p.compared);
  const reviews = scoreQuotes(comparedPrepared.map((p) => p.input!), config);
  const byId = new Map(comparedPrepared.map((p) => [p.normalized.quoteId, p]));
  const minPpk = reviews.length ? Math.min(...reviews.map((r) => r.pricePerKw)) : 0;

  const compared: ComparedQuote[] = reviews.map((review) => {
    const p = byId.get(review.quoteId)!;
    const missingFields = detectMissingFields(p.input!);
    return {
      rank: review.rank,
      tied: review.tied,
      quoteId: review.quoteId,
      status: p.normalized.status,
      submittedAt: p.normalized.submittedAt,
      normalized: p.normalized,
      platformEstimates: estimatesFor(p.normalized, rules),
      missingFields,
      flags: computeFlags(p.input!, ctx, config),
      scoreBreakdown: review.scoreBreakdown,
      totalScore: review.totalScore,
      explanation: buildExplanation(review, { minPricePerKw: minPpk, missingCount: missingFields.length }),
    };
  });

  const excluded: ExcludedQuote[] = prepared
    .filter((p) => !p.compared)
    .map((p): ExcludedQuote =>
      p.normalized.status === "withdrawn"
        ? { quoteId: p.normalized.quoteId, status: p.normalized.status, reason: "withdrawn" }
        : { quoteId: p.normalized.quoteId, status: p.normalized.status, reason: "invalid", flags: [invalidQuoteFlag()] },
    )
    .sort((a, b) => (a.quoteId < b.quoteId ? -1 : 1));

  return { compared, excluded };
}
