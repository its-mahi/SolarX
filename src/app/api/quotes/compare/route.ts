// POST /api/quotes/compare — score and rank the quotes of one request, save reviews (specs/006 contracts/quotes-compare.md).
import { activeRuleSet } from "@/config/rules";
import { scoringConfig } from "@/config/scoring.v1";
import { requireRole, assertSameOrigin } from "@/lib/api/auth-guard";
import { logEvent } from "@/lib/api/log";
import { ok, parseJsonBody } from "@/lib/api/respond";
import { compareQuotes } from "@/lib/domain/quotes";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { compareQuotesRequestSchema } from "@/lib/validation/quote-review";
import { withNoStoreHandler } from "../../requests/_lib/handlers";
import { loadOwnedRequest, loadQuoteBundle, vendorOf } from "../../requests/[id]/quotes/load-owned-request";

export const runtime = "nodejs";

export const POST = withNoStoreHandler(async (request) => {
  const ctx = await requireRole(request, "household");
  assertSameOrigin(request, ctx.authVia);
  const body = await parseJsonBody(request, compareQuotesRequestSchema);
  const owned = await loadOwnedRequest(ctx.supabase, body.requestId);
  const { quotes, vendors, context } = await loadQuoteBundle(ctx.supabase, owned);

  const result = compareQuotes(quotes, context, activeRuleSet, scoringConfig);

  if (result.compared.length > 0) {
    const admin = createAdminSupabase();
    const { error } = await admin.from("quote_reviews").upsert(
      result.compared.map((c) => ({
        quote_id: c.quoteId,
        normalized_fields: { ...c.normalized, platformEstimates: c.platformEstimates } as unknown as NonNullable<Json>,
        missing_fields: c.missingFields as unknown as NonNullable<Json>,
        flags: c.flags as unknown as NonNullable<Json>,
        score_breakdown: c.scoreBreakdown as unknown as NonNullable<Json>,
        total_score: c.totalScore,
        scoring_version: scoringConfig.version,
        explanation: c.explanation,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "quote_id" },
    );
    if (error) throw error;
  }
  logEvent("quotes.compared", { requestId: owned.id, code: scoringConfig.version });

  return ok({
    requestId: owned.id,
    requestStatus: owned.status,
    scoringVersion: scoringConfig.version,
    weights: scoringConfig.weights,
    disclaimer: scoringConfig.disclaimer,
    ruleVersion: activeRuleSet.version,
    compared: result.compared.map((c) => ({ ...c, vendor: vendorOf(vendors, c.normalized.vendorId) })),
    excluded: result.excluded,
  });
});
