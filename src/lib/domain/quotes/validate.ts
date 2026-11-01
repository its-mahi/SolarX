import type { NormalizedQuote } from "./types";

export type RequiredFieldsResult = { valid: true } | { valid: false; reason: "INVALID_QUOTE"; message: string };

/** Price and capacity must be present and positive; otherwise the quote is excluded from scoring. */
export function validateRequiredFields(n: NormalizedQuote): RequiredFieldsResult {
  const ok = n.price !== null && Number.isFinite(n.price) && n.price > 0 && n.capacityKw !== null && n.capacityKw > 0;
  return ok ? { valid: true } : { valid: false, reason: "INVALID_QUOTE", message: "Price or capacity is missing or not positive." };
}
