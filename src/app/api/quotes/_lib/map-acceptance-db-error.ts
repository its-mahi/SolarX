// SQLSTATE -> API error mapping for the acceptance functions (specs/007 research R-05).
import { ApiError, GENERIC_INTERNAL_MESSAGE, type ErrorDetail } from "@/lib/api/errors";

type DbErrorLike = { code?: unknown; message?: unknown };

const reasonDetail = (reason: string): ErrorDetail[] => [{ path: "reason", message: reason, reason } as ErrorDetail];

const CONFLICT_MESSAGES: Record<string, string> = {
  ALREADY_ACCEPTED: "This request already has an accepted quote.",
  REQUEST_NOT_ACCEPTING: "This request is not accepting quotes.",
  QUOTE_NOT_ACCEPTABLE: "This quote can no longer be accepted.",
  REQUEST_NOT_CLOSABLE: "Only an accepted request can be closed.",
};

function reasonOf(message: unknown, known: string[]): string | undefined {
  if (typeof message !== "string") return undefined;
  return known.find((r) => message.includes(r));
}

/** Returns an ApiError for a Postgres/PostgREST error; never echoes internal detail. */
export function mapAcceptanceDbError(err: unknown): ApiError {
  const e = (typeof err === "object" && err !== null ? err : {}) as DbErrorLike;
  const code = typeof e.code === "string" ? e.code : undefined;

  if (code === "42501") return new ApiError("FORBIDDEN", "Only households can accept quotes.");
  if (code === "23505") {
    return new ApiError("CONFLICT", CONFLICT_MESSAGES.ALREADY_ACCEPTED, reasonDetail("ALREADY_ACCEPTED"));
  }
  if (code === "SM404") {
    const reason = reasonOf(e.message, ["REQUEST_NOT_FOUND", "QUOTE_NOT_FOUND"]) ?? "QUOTE_NOT_FOUND";
    return new ApiError(
      "NOT_FOUND",
      reason === "REQUEST_NOT_FOUND" ? "Request not found." : "Quote not found.",
      reasonDetail(reason),
    );
  }
  if (code === "SM409") {
    const reason = reasonOf(e.message, Object.keys(CONFLICT_MESSAGES));
    if (reason) return new ApiError("CONFLICT", CONFLICT_MESSAGES[reason], reasonDetail(reason));
  }
  if (code === "SM403") {
    const reason = reasonOf(e.message, ["CONTACT_NOT_AVAILABLE", "VENDOR_PROFILE_MISSING"]);
    if (reason === "CONTACT_NOT_AVAILABLE") {
      return new ApiError(
        "FORBIDDEN",
        "Contact details are shared only after the household accepts your quote.",
        reasonDetail(reason),
      );
    }
    if (reason === "VENDOR_PROFILE_MISSING") {
      return new ApiError("FORBIDDEN", "Complete your vendor profile first.", reasonDetail(reason));
    }
  }
  return new ApiError("INTERNAL", GENERIC_INTERNAL_MESSAGE);
}
