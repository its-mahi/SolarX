// GET /api/quotes/:id/source-document — short-lived signed URL for the quote's source document
// (specs/009 contracts/quote-source-document-api.md). Quote and storage RLS decide who may see it.
import { requireUser } from "@/lib/api/auth-guard";
import { ApiError, type ErrorDetail } from "@/lib/api/errors";
import { ok, withApiHandler } from "@/lib/api/respond";
import { createQuoteSourceDocumentUrl, kindFromPath, mimeFromPath } from "@/lib/supabase/queries/quote-documents";
import { uuidSchema } from "@/lib/validation/common";

export const runtime = "nodejs";

const SOURCE_DOCUMENT_LABEL = "Vendor-provided document — not verified";
const SIGNED_URL_SECONDS = 300;

export const GET = withApiHandler<{ id: string }>(async (request, { params }) => {
  const parsed = uuidSchema.safeParse((await params).id);
  if (!parsed.success) {
    throw new ApiError("VALIDATION_FAILED", "Some fields need attention.", [{ path: "id", message: "Enter a valid quote id" }]);
  }
  const ctx = await requireUser(request);

  const { data: quote } = await ctx.supabase
    .from("quotes")
    .select("id, source_document_path")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!quote) throw new ApiError("NOT_FOUND", "Quote not found.");
  if (!quote.source_document_path) {
    throw new ApiError("NOT_FOUND", "This quote has no source document.", [
      { path: "reason", message: "no_source_document", reason: "no_source_document" } as ErrorDetail,
    ]);
  }
  const signed = await createQuoteSourceDocumentUrl(ctx.supabase, quote.source_document_path, SIGNED_URL_SECONDS);
  if (!signed) throw new ApiError("NOT_FOUND", "The source document is unavailable.");

  return ok({
    url: signed.url,
    expires_at: signed.expires_at,
    kind: kindFromPath(quote.source_document_path),
    mime_type: mimeFromPath(quote.source_document_path),
    label: SOURCE_DOCUMENT_LABEL,
  });
});
