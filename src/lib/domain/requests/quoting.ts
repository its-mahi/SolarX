// Pure mirror of the submit_quote status rules (specs/005 data-model §5). No I/O.
import type { RequestStatus } from "@/lib/validation/enums";

export function isQuotableRequestStatus(status: RequestStatus): boolean {
  return status === "open" || status === "quoted";
}

/** Request status after a vendor quote is stored: open -> quoted, quoted stays quoted. */
export function requestStatusAfterQuote(status: RequestStatus): "quoted" {
  if (!isQuotableRequestStatus(status)) {
    throw new Error(`Request in status ${status} cannot receive quotes`);
  }
  return "quoted";
}
