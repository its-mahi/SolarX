import { describe, expect, it } from "vitest";
import { canWithdrawQuote, isActiveQuoteStatus } from "@/lib/domain/quotes/lifecycle";
import { QUOTE_STATUSES } from "@/lib/validation/enums";

describe("quote lifecycle", () => {
  it("active statuses are submitted and accepted", () => {
    for (const s of QUOTE_STATUSES) expect(isActiveQuoteStatus(s)).toBe(s === "submitted" || s === "accepted");
  });
  it("only submitted quotes can be withdrawn", () => {
    for (const s of QUOTE_STATUSES) expect(canWithdrawQuote(s)).toBe(s === "submitted");
  });
});
