// Maps database errors from submit_quote / withdraw_quote to the shared envelope
// (specs/005 data-model §4 error-mapping table). Never echoes SQL text.
import { GENERIC_INTERNAL_MESSAGE, HTTP_STATUS, type ErrorCode } from "@/lib/api/errors";
import { logEvent } from "@/lib/api/log";

export const QUOTE_CONFLICT_REASONS = ["REQUEST_NOT_QUOTABLE", "DUPLICATE_ACTIVE_QUOTE", "QUOTE_NOT_WITHDRAWABLE"] as const;
export type QuoteConflictReason = (typeof QUOTE_CONFLICT_REASONS)[number];

const CONFLICT_MESSAGES: Record<QuoteConflictReason, string> = {
  REQUEST_NOT_QUOTABLE: "This request is no longer accepting quotes.",
  DUPLICATE_ACTIVE_QUOTE: "You already have an active quote on this request. Withdraw it to submit a new one.",
  QUOTE_NOT_WITHDRAWABLE: "Only a submitted quote can be withdrawn.",
};

type DbErrorLike = { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };

function text(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function build(code: ErrorCode, message: string, details: Record<string, string>[] = []): Response {
  return Response.json({ error: { code, message, details } }, { status: HTTP_STATUS[code] });
}

function reasonOf(err: DbErrorLike): string | undefined {
  const haystack = `${text(err.message)} ${text(err.details)} ${text(err.hint)}`;
  return [
    "VENDOR_PROFILE_MISSING",
    "REQUEST_NOT_FOUND",
    "QUOTE_NOT_FOUND",
    ...QUOTE_CONFLICT_REASONS,
  ].find((r) => haystack.includes(r));
}

export function mapQuoteDbError(err: unknown): Response {
  const e: DbErrorLike = typeof err === "object" && err !== null ? (err as DbErrorLike) : {};
  const code = text(e.code);
  const reason = reasonOf(e);

  if (code === "42501") return build("FORBIDDEN", "You don't have permission to do that.");
  if (code === "SM403") {
    return build("FORBIDDEN", "Complete your vendor profile before quoting.");
  }
  if (code === "SM404") {
    const message = reason === "QUOTE_NOT_FOUND" ? "Quote not found." : "Request not found.";
    return build("NOT_FOUND", message);
  }
  if (code === "SM409") {
    const r = QUOTE_CONFLICT_REASONS.find((x) => x === reason);
    if (r) return build("CONFLICT", CONFLICT_MESSAGES[r], [{ reason: r }]);
  }
  if (code === "23505" && `${text(e.message)} ${text(e.details)}`.includes("quotes_one_active_per_vendor_request")) {
    return build("CONFLICT", CONFLICT_MESSAGES.DUPLICATE_ACTIVE_QUOTE, [{ reason: "DUPLICATE_ACTIVE_QUOTE" }]);
  }
  if (code === "23514") return build("VALIDATION_FAILED", "Some fields are outside the allowed range.");

  logEvent("api.internal_error", { reason: code || "unknown" });
  return build("INTERNAL", GENERIC_INTERNAL_MESSAGE);
}
