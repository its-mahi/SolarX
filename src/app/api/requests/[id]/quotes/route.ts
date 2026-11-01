// GET /api/requests/:id/quotes — normalized quotes with platform estimates (specs/006 contracts/request-quotes.md).
import { requireRole } from "@/lib/api/auth-guard";
import { ok } from "@/lib/api/respond";
import { activeRuleSet } from "@/config/rules";
import { buildQuoteList } from "@/lib/domain/quotes";
import { acceptanceSummarySchema } from "@/lib/validation/acceptance";
import { withNoStoreHandler } from "../../_lib/handlers";
import { loadOwnedRequest, loadQuoteBundle, parseRequestIdOrThrow, vendorOf } from "./load-owned-request";

export const runtime = "nodejs";

export const GET = withNoStoreHandler<{ id: string }>(async (request, { params }) => {
  const ctx = await requireRole(request, "household");
  const requestId = parseRequestIdOrThrow((await params).id);
  const owned = await loadOwnedRequest(ctx.supabase, requestId);
  const { quotes, vendors, context } = await loadQuoteBundle(ctx.supabase, owned);

  const items = buildQuoteList(quotes, activeRuleSet, context);
  const withdrawn = items.filter((i) => i.status === "withdrawn").length;

  // Spec 007: additive `acceptance` field (null until a quote is accepted). The database function
  // only returns a row to the owning household.
  const { data: acceptanceRows, error: acceptanceError } = await ctx.supabase.rpc("household_acceptance_summary", {
    p_request_id: owned.id,
  });
  if (acceptanceError) throw acceptanceError;
  const acceptanceRow = acceptanceRows?.[0];
  const acceptance = acceptanceSummarySchema.parse(
    acceptanceRow
      ? {
          quoteId: acceptanceRow.quote_id,
          acceptedAt: acceptanceRow.accepted_at,
          vendor: {
            companyName: acceptanceRow.vendor_company_name,
            isDemo: acceptanceRow.vendor_is_demo,
            phone: acceptanceRow.vendor_phone ?? null,
          },
          price: acceptanceRow.price,
          capacityKw: Number(acceptanceRow.capacity_kw),
        }
      : null,
  );

  return ok({
    requestId: owned.id,
    requestStatus: owned.status,
    quotes: items.map((i) => ({
      quoteId: i.quoteId,
      vendor: vendorOf(vendors, i.vendorId),
      status: i.status,
      submittedAt: i.submittedAt,
      normalized: i.normalized,
      platformEstimates: i.platformEstimates,
      missingFields: i.missingFields,
      flags: i.flags,
    })),
    counts: { total: items.length, active: items.length - withdrawn, withdrawn },
    acceptance,
  });
});
