// POST /api/quotes/:id/withdraw — owning vendor withdraws a submitted quote.
import { assertSameOrigin, requireRole } from "@/lib/api/auth-guard";
import { ApiError, zodDetails } from "@/lib/api/errors";
import { logEvent } from "@/lib/api/log";
import { ok, withApiHandler } from "@/lib/api/respond";
import { quoteIdParamSchema, withdrawBodySchema } from "@/lib/validation/quote";
import { mapQuoteDbError } from "../../_lib/map-quote-db-error";
import { toQuoteRecord } from "../../_lib/to-quote-record";

export const POST = withApiHandler<{ id: string }>(async (request, { params }) => {
  const ctx = await requireRole(request, "vendor");
  assertSameOrigin(request, ctx.authVia);

  const idParsed = quoteIdParamSchema.safeParse(await params);
  if (!idParsed.success) throw new ApiError("VALIDATION_FAILED", "Some fields need attention.", zodDetails(idParsed.error));

  const text = await request.text();
  if (text.trim()) {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new ApiError("VALIDATION_FAILED", "The request body must be valid JSON.");
    }
    const body = withdrawBodySchema.safeParse(raw);
    if (!body.success) throw new ApiError("VALIDATION_FAILED", "Some fields need attention.", zodDetails(body.error));
  }

  const { data, error } = await ctx.supabase.rpc("withdraw_quote", { p_quote_id: idParsed.data.id });
  if (error || !data) return mapQuoteDbError(error);

  const quote = toQuoteRecord(data);
  logEvent("quote.withdrawn", { userId: ctx.user.id, quoteId: quote.id, requestId: quote.request_id, toStatus: quote.status });
  return ok({ quote });
});
