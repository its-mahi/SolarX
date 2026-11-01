import { describe, expect, it } from "vitest";
import { canAcceptQuote, canCloseRequest, quoteOutcomeLabel } from "@/lib/domain/requests/acceptance";
import { QUOTE_STATUSES, REQUEST_STATUSES } from "@/lib/validation/enums";

describe("canAcceptQuote", () => {
  for (const r of REQUEST_STATUSES) {
    for (const q of QUOTE_STATUSES) {
      const expected = (r === "open" || r === "quoted") && q === "submitted";
      it(`request ${r} + quote ${q} -> ${expected}`, () => {
        expect(canAcceptQuote(r, q)).toBe(expected);
      });
    }
  }
});

describe("canCloseRequest", () => {
  it("is true only for accepted", () => {
    for (const r of REQUEST_STATUSES) expect(canCloseRequest(r)).toBe(r === "accepted");
  });
});

describe("quoteOutcomeLabel", () => {
  it("labels accepted and rejected only", () => {
    expect(quoteOutcomeLabel("accepted")).toMatch(/^Accepted/);
    expect(quoteOutcomeLabel("rejected")).toBe("Not selected — the household accepted another quote");
    expect(quoteOutcomeLabel("submitted")).toBeNull();
    expect(quoteOutcomeLabel("withdrawn")).toBeNull();
  });
});
