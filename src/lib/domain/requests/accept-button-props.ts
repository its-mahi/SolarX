// Pure helper that derives AcceptQuoteButton props for a quote card (used by 006's comparison view).
import type { QuoteStatus, RequestStatus } from "@/lib/validation/enums";
import { canAcceptQuote } from "./acceptance";

export type AcceptableQuote = { id: string; status: QuoteStatus; price: number; capacityKw: number; vendorName: string };

export function acceptButtonProps(
  requestStatus: RequestStatus,
  quote: AcceptableQuote,
  allQuotes: readonly { id: string; status: QuoteStatus }[],
  estimatedNetCost: number | null,
) {
  return {
    quoteId: quote.id,
    quoteStatus: quote.status,
    canAccept: canAcceptQuote(requestStatus, quote.status),
    vendorName: quote.vendorName,
    price: quote.price,
    capacityKw: quote.capacityKw,
    estimatedNetCost,
    otherActiveCount: allQuotes.filter((q) => q.id !== quote.id && q.status === "submitted").length,
  };
}
