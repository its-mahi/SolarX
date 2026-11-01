// GET /api/quotes/mine — the calling vendor's own quote history (RLS-scoped).
import { requireRole } from "@/lib/api/auth-guard";
import { ApiError, zodDetails } from "@/lib/api/errors";
import { ok, withApiHandler } from "@/lib/api/respond";
import { myQuotesQuerySchema, type VendorQuoteHistoryItem } from "@/lib/validation/quote";
import type { RequestStatus } from "@/lib/validation/enums";
import { mapQuoteDbError } from "../_lib/map-quote-db-error";
import { toQuoteRecord } from "../_lib/to-quote-record";

export const GET = withApiHandler(async (request) => {
  const ctx = await requireRole(request, "vendor");
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = myQuotesQuerySchema.safeParse(params);
  if (!parsed.success) throw new ApiError("VALIDATION_FAILED", "Some fields need attention.", zodDetails(parsed.error));
  const { status, request_id } = parsed.data;

  let query = ctx.supabase.from("quotes").select("*").eq("vendor_id", ctx.vendor.id).order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (request_id) query = query.eq("request_id", request_id);
  const { data: rows, error } = await query;
  if (error) return mapQuoteDbError(error);

  const { data: summaries, error: sErr } = await ctx.supabase.rpc("vendor_quoted_request_summaries");
  if (sErr) return mapQuoteDbError(sErr);
  const byId = new Map((summaries ?? []).map((s) => [s.request_id, s]));

  const items: VendorQuoteHistoryItem[] = (rows ?? []).map((row) => {
    const s = byId.get(row.request_id);
    return {
      ...toQuoteRecord(row),
      request: { id: row.request_id, locality: s?.locality ?? "", status: (s?.request_status ?? "open") as RequestStatus },
    };
  });
  return ok({ items }, { headers: { "Cache-Control": "no-store" } });
});
