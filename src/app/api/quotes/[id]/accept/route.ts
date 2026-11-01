// POST /api/quotes/:id/accept — owning household accepts one quote (specs/007 contracts/acceptance.md).
import { assertSameOrigin, requireRole } from "@/lib/api/auth-guard";
import { ApiError, zodDetails } from "@/lib/api/errors";
import { logEvent } from "@/lib/api/log";
import { ok, parseJsonBody, withApiHandler } from "@/lib/api/respond";
import { acceptQuoteBodySchema, acceptanceResultSchema } from "@/lib/validation/acceptance";
import { quoteIdParamSchema } from "@/lib/validation/quote";
import { mapAcceptanceDbError } from "../../_lib/map-acceptance-db-error";

export const POST = withApiHandler<{ id: string }>(async (request, { params }) => {
  const ctx = await requireRole(request, "household");
  assertSameOrigin(request, ctx.authVia);

  const idParsed = quoteIdParamSchema.safeParse(await params);
  if (!idParsed.success) throw new ApiError("VALIDATION_FAILED", "Some fields need attention.", zodDetails(idParsed.error));
  await parseJsonBody(request, acceptQuoteBodySchema);

  const { data, error } = await ctx.supabase.rpc("accept_quote", { p_quote_id: idParsed.data.id });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) throw mapAcceptanceDbError(error);

  const result = acceptanceResultSchema.parse({
    acceptance: {
      id: row.acceptance_id,
      quoteId: row.quote_id,
      requestId: row.request_id,
      householdId: row.household_id,
      acceptedAt: row.accepted_at,
    },
    quote: { id: row.quote_id, status: "accepted" },
    request: { id: row.request_id, status: "accepted" },
    rejectedQuoteIds: row.rejected_quote_ids ?? [],
  });

  logEvent("quote.accepted", {
    userId: ctx.user.id,
    requestId: result.request.id,
    quoteId: result.quote.id,
    fromStatus: "submitted",
    toStatus: "accepted",
  });
  for (const id of result.rejectedQuoteIds) {
    logEvent("quote.rejected", { requestId: result.request.id, quoteId: id, fromStatus: "submitted", toStatus: "rejected" });
  }
  logEvent("request.accepted", { requestId: result.request.id, toStatus: "accepted" });
  return ok(result);
});
