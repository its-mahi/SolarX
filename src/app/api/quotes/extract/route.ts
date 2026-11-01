// POST /api/quotes/extract — vendor-only AI extraction of a pre-fill for the quote form
// (specs/009 contracts/quotes-extract-api.md). Never creates or modifies a quote.
import { assertSameOrigin, requireUser } from "@/lib/api/auth-guard";
import { ApiError, type ErrorDetail } from "@/lib/api/errors";
import { ok, withApiHandler } from "@/lib/api/respond";
import { aiFailureToApiError } from "@/lib/ai/errors";
import { extractQuote } from "@/lib/ai/quote-extraction";
import { QUOTE_EXTRACTION_PROMPT_VERSION } from "@/lib/ai/prompts/quote-extraction.v1";
import { toQuoteFormPrefill } from "@/lib/ai/schemas/quote-extraction";
import { uploadQuoteSourceDocument, kindFromPath, mimeFromPath } from "@/lib/supabase/queries/quote-documents";
import { detectFileType } from "@/lib/validation/file-signature";
import { uuidSchema } from "@/lib/validation/common";
import {
  MAX_QUOTE_FILE_BYTES,
  MAX_QUOTE_TEXT_CHARS,
  type QuoteExtractData,
  type QuoteFileType,
} from "@/lib/validation/quote-extraction";

export const runtime = "nodejs";
export const maxDuration = 60;

const UNAVAILABLE = "Extraction unavailable — fill in the form manually";
const NOTICE = "Pre-filled from your document by AI — check every value before submitting.";
const reason = (r: string): ErrorDetail[] => [{ path: "reason", message: r, reason: r } as ErrorDetail];

const EXT_BY_TYPE: Record<QuoteFileType, { ext: "jpg" | "png" | "pdf"; names: string[] }> = {
  "image/jpeg": { ext: "jpg", names: ["jpg", "jpeg"] },
  "image/png": { ext: "png", names: ["png"] },
  "application/pdf": { ext: "pdf", names: ["pdf"] },
};

function sizeBucket(n: number): string {
  return n < 100_000 ? "<100KB" : n < 1_000_000 ? "<1MB" : "<=5MB";
}

/** Metadata-only log line: no content, values, names or paths. */
function logExtraction(fields: Record<string, string | number | null>): void {
  console.info(JSON.stringify({ event: "quote_extraction", at: new Date().toISOString(), ...fields }));
}

export const POST = withApiHandler(async (request) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError("VALIDATION_FAILED", "The request must be multipart form data.");
  }

  const ctx = await requireUser(request);
  if (ctx.profile.role !== "vendor") {
    throw new ApiError("FORBIDDEN", "This action is not available for your account type.", reason("role_not_allowed"));
  }
  const { data: vendor } = await ctx.supabase.from("vendors").select("id").eq("user_id", ctx.user.id).maybeSingle();
  if (!vendor) throw new ApiError("FORBIDDEN", "Your vendor profile is missing.", reason("vendor_profile_required"));
  assertSameOrigin(request, ctx.authVia);

  const requestId = uuidSchema.safeParse(form.get("request_id"));
  if (!requestId.success) {
    throw new ApiError("VALIDATION_FAILED", "Some fields need attention.", [{ path: "request_id", message: "Enter a valid request id" }]);
  }
  const rawText = form.get("text");
  const rawFile = form.get("file");
  const text = typeof rawText === "string" ? rawText.trim() : "";
  const file = rawFile instanceof File ? rawFile : null;
  if ((text === "") === (file === null)) {
    throw new ApiError("VALIDATION_FAILED", "Provide either pasted text or one file.", reason("exactly_one_input_required"));
  }

  let input: { kind: "text"; text: string } | { kind: "file"; bytes: Uint8Array; mimeType: QuoteFileType };
  if (file === null) {
    if (text.length > MAX_QUOTE_TEXT_CHARS) {
      throw new ApiError("PAYLOAD_TOO_LARGE", `Pasted text can be at most ${MAX_QUOTE_TEXT_CHARS} characters.`, reason("text_too_long"));
    }
    input = { kind: "text", text };
  } else {
    if (file.size > MAX_QUOTE_FILE_BYTES) {
      throw new ApiError("PAYLOAD_TOO_LARGE", "The file is too large (max 5 MB).", reason("file_too_large"));
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectFileType(bytes);
    const unsupported = new ApiError("VALIDATION_FAILED", "Upload a JPEG, PNG or PDF file.", reason("unsupported_file_type"));
    if (detected !== "image/jpeg" && detected !== "image/png" && detected !== "application/pdf") throw unsupported;
    const nameExt = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
    if (file.type !== detected || (nameExt && !EXT_BY_TYPE[detected].names.includes(nameExt))) throw unsupported;
    input = { kind: "file", bytes, mimeType: detected };
  }

  // Quotable request: visible to vendors only while open/quoted; otherwise tell apart "closed
  // after I quoted" (409) from "not visible" (404) using the vendor's own quoted-request summaries.
  const { data: open } = await ctx.supabase.rpc("vendor_get_open_request", { p_request_id: requestId.data });
  if (!open?.length) {
    const { data: mine } = await ctx.supabase.rpc("vendor_quoted_request_summaries");
    if (mine?.some((r) => r.request_id === requestId.data)) {
      throw new ApiError("CONFLICT", "This request is no longer accepting quotes.", reason("request_not_quotable"));
    }
    throw new ApiError("NOT_FOUND", "Request not found.");
  }
  const { data: active } = await ctx.supabase
    .from("quotes")
    .select("id")
    .eq("request_id", requestId.data)
    .in("status", ["submitted", "accepted"])
    .limit(1);
  if (active?.length) {
    throw new ApiError("CONFLICT", "You already have an active quote on this request.", reason("active_quote_exists"));
  }

  const inputKind = input.kind === "text" ? "text" : input.mimeType === "application/pdf" ? "pdf" : "image";
  const size = input.kind === "text" ? input.text.length : input.bytes.length;
  const result = await extractQuote(input);
  const logBase = { input_kind: inputKind, size_bucket: sizeBucket(size), model: result.meta.model, prompt_version: QUOTE_EXTRACTION_PROMPT_VERSION, duration_ms: result.meta.durationMs };

  if (!result.ok) {
    logExtraction({ outcome: "failed", failure: result.failure.kind, ...logBase });
    throw aiFailureToApiError(result.failure, UNAVAILABLE);
  }

  // The source is stored only after a successful extraction (no orphans for failed attempts).
  let path: string;
  const bytes = input.kind === "text" ? new TextEncoder().encode(input.text) : input.bytes;
  try {
    path = await uploadQuoteSourceDocument(
      ctx.supabase,
      ctx.user.id,
      bytes,
      input.kind === "text" ? "txt" : EXT_BY_TYPE[input.mimeType].ext,
      input.kind === "text" ? "text/plain" : input.mimeType,
    );
  } catch {
    logExtraction({ outcome: "storage_failed", ...logBase });
    throw new ApiError("INTERNAL", "Something went wrong. Please try again.");
  }
  logExtraction({ outcome: "ok", failure: null, ...logBase });

  const data: QuoteExtractData = {
    fields: result.fields,
    prefill: toQuoteFormPrefill(result.fields, path),
    missing_fields: result.missing_fields,
    discarded_fields: result.discarded_fields,
    document_vendor_name: result.fields.vendor_name,
    source_document: { path, kind: kindFromPath(path), mime_type: mimeFromPath(path), size_bytes: bytes.length },
    model: result.meta.model,
    prompt_version: QUOTE_EXTRACTION_PROMPT_VERSION,
    notice: NOTICE,
  };
  return ok(data);
});
