// Public API of the quote comparison domain (specs/006). Pure: no Next.js, Supabase or React imports.
export { scoreQuotes, scorePrice, scoreTechnical, scoreWarranty, scoreCompleteness, scoreTimeline } from "./scoring";
export { computeFlags, invalidQuoteFlag } from "./flags";
export { detectMissingFields, MISSING_LABELS } from "./missing-fields";
export { normalizeQuote, toScoringInput } from "./normalize";
export { validateRequiredFields } from "./validate";
export { buildExplanation } from "./explanation";
export { buildQuoteList, compareQuotes } from "./compare";
export type * from "./types";
