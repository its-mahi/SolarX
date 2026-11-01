// Pure acceptance rules (specs/007 research R-09). The database function remains the authority.
import type { QuoteStatus, RequestStatus } from "@/lib/validation/enums";
import { canTransition } from "./status";

/** A quote can be accepted only while it is `submitted` and the request can move to `accepted`. */
export function canAcceptQuote(requestStatus: RequestStatus, quoteStatus: QuoteStatus): boolean {
  return quoteStatus === "submitted" && canTransition(requestStatus, "accepted");
}

/** Only an accepted request can be closed. */
export function canCloseRequest(requestStatus: RequestStatus): boolean {
  return canTransition(requestStatus, "closed");
}

/** Vendor-facing outcome text; null when there is nothing to say (submitted, withdrawn). */
export function quoteOutcomeLabel(quoteStatus: QuoteStatus): string | null {
  if (quoteStatus === "accepted") return "Accepted by the household — arrange a site survey";
  if (quoteStatus === "rejected") return "Not selected — the household accepted another quote";
  return null;
}
