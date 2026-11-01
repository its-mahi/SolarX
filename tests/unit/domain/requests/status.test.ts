import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, isEditable, isQuotable } from "@/lib/domain/requests/status";
import { REQUEST_STATUSES } from "@/lib/validation/enums";

const ALLOWED = new Set(["draft>open", "open>quoted", "open>accepted", "quoted>accepted", "accepted>closed"]);

describe("request status machine", () => {
  for (const from of REQUEST_STATUSES) {
    for (const to of REQUEST_STATUSES) {
      const allowed = ALLOWED.has(`${from}>${to}`);
      it(`${from} -> ${to} is ${allowed ? "allowed" : "rejected"}`, () => {
        expect(canTransition(from, to)).toBe(allowed);
        if (allowed) expect(() => assertTransition(from, to)).not.toThrow();
        else expect(() => assertTransition(from, to)).toThrow();
      });
    }
  }

  it("only drafts are editable", () => {
    expect(REQUEST_STATUSES.filter(isEditable)).toEqual(["draft"]);
  });

  it("only open and quoted are quotable", () => {
    expect(REQUEST_STATUSES.filter(isQuotable)).toEqual(["open", "quoted"]);
  });
});
