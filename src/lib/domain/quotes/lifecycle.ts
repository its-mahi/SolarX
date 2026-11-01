// Pure quote lifecycle rules (specs/005 data-model §5).
import type { QuoteStatus } from "@/lib/validation/enums";

export function isActiveQuoteStatus(status: QuoteStatus): boolean {
  return status === "submitted" || status === "accepted";
}

export function canWithdrawQuote(status: QuoteStatus): boolean {
  return status === "submitted";
}
