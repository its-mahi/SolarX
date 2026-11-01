import { describe, expect, it } from "vitest";
import { isQuotableRequestStatus, requestStatusAfterQuote } from "@/lib/domain/requests/quoting";
import { REQUEST_STATUSES } from "@/lib/validation/enums";

describe("quoting rules", () => {
  it("is quotable only for open and quoted", () => {
    for (const s of REQUEST_STATUSES) expect(isQuotableRequestStatus(s)).toBe(s === "open" || s === "quoted");
  });
  it("moves open to quoted and keeps quoted", () => {
    expect(requestStatusAfterQuote("open")).toBe("quoted");
    expect(requestStatusAfterQuote("quoted")).toBe("quoted");
  });
  it("throws for draft, accepted, closed", () => {
    for (const s of ["draft", "accepted", "closed"] as const) expect(() => requestStatusAfterQuote(s)).toThrow();
  });
});
