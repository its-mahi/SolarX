// POST /api/quotes — vendor submits a structured quote (specs/005 contracts/quotes.md).
import { assertSameOrigin, requireRole } from "@/lib/api/auth-guard";
import { logEvent } from "@/lib/api/log";
import { created, parseJsonBody, withApiHandler } from "@/lib/api/respond";
// 009: optional source / source_document_path (ai_extracted quotes) accepted alongside 005's fields.
import { isOwnedDocumentPath, quoteDocumentExists } from "@/lib/supabase/queries/quote-documents";
import { ApiError } from "@/lib/api/errors";
import { quoteSubmissionWithSourceSchema as quoteSubmissionSchema } from "@/lib/validation/quote-extraction";
import { mapQuoteDbError } from "./_lib/map-quote-db-error";
import { toQuoteRecord } from "./_lib/to-quote-record";

export const POST = withApiHandler(async (request) => {
  const ctx = await requireRole(request, "vendor");
  assertSameOrigin(request, ctx.authVia);
  const input = await parseJsonBody(request, quoteSubmissionSchema);

  // 009: a referenced source document must be the vendor's own and must exist.
  const sourcePath = input.source_document_path ?? null;
  if (sourcePath !== null) {
    if (!isOwnedDocumentPath(sourcePath, ctx.user.id)) {
      throw new ApiError("FORBIDDEN", "You can only reference your own documents.", [
        { path: "reason", message: "source_document_not_owned", reason: "source_document_not_owned" } as never,
      ]);
    }
    if (!(await quoteDocumentExists(ctx.supabase, sourcePath))) {
      throw new ApiError("VALIDATION_FAILED", "The source document could not be found.", [
        { path: "source_document_path", message: "source_document_missing", reason: "source_document_missing" } as never,
      ]);
    }
  }

  const { data, error } = await ctx.supabase.rpc("submit_quote", {
    p_request_id: input.request_id,
    p_price: input.price,
    p_capacity_kw: input.capacity_kw,
    p_panel_details: input.panel_details,
    p_inverter_details: input.inverter_details,
    p_warranty_details: input.warranty_details,
    p_installation_days: input.installation_days,
    p_earthing_included: input.earthing_included as boolean,
    p_documentation_included: input.documentation_included as boolean,
    p_other_inclusions: input.other_inclusions,
    p_exclusions: input.exclusions as string,
    p_vendor_notes: input.vendor_notes as string,
    p_source: input.source ?? "manual",
    p_source_document_path: sourcePath as string,
  });
  if (error || !data) return mapQuoteDbError(error);

  const quote = toQuoteRecord(data);
  logEvent("quote.submitted", { userId: ctx.user.id, quoteId: quote.id, requestId: quote.request_id, toStatus: quote.status });
  return created({ quote, request_status: "quoted" });
});
