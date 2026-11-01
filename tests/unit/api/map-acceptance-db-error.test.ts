import { describe, expect, it } from "vitest";
import { mapAcceptanceDbError } from "@/app/api/quotes/_lib/map-acceptance-db-error";

const reasonOf = (e: { details: unknown[] }) => (e.details[0] as { reason?: string } | undefined)?.reason;

describe("mapAcceptanceDbError", () => {
  it("maps 42501 to FORBIDDEN", () => {
    expect(mapAcceptanceDbError({ code: "42501", message: "x" }).code).toBe("FORBIDDEN");
  });
  it("maps SM404 to NOT_FOUND with reason", () => {
    const a = mapAcceptanceDbError({ code: "SM404", message: "QUOTE_NOT_FOUND" });
    expect([a.code, reasonOf(a)]).toEqual(["NOT_FOUND", "QUOTE_NOT_FOUND"]);
    const b = mapAcceptanceDbError({ code: "SM404", message: "REQUEST_NOT_FOUND" });
    expect([b.code, reasonOf(b), b.message]).toEqual(["NOT_FOUND", "REQUEST_NOT_FOUND", "Request not found."]);
  });
  it.each(["ALREADY_ACCEPTED", "REQUEST_NOT_ACCEPTING", "QUOTE_NOT_ACCEPTABLE", "REQUEST_NOT_CLOSABLE"])(
    "maps SM409 %s to CONFLICT",
    (reason) => {
      const e = mapAcceptanceDbError({ code: "SM409", message: `${reason}: detail` });
      expect([e.code, reasonOf(e)]).toEqual(["CONFLICT", reason]);
    },
  );
  it("maps SM403 reasons to FORBIDDEN", () => {
    const a = mapAcceptanceDbError({ code: "SM403", message: "CONTACT_NOT_AVAILABLE" });
    expect([a.code, reasonOf(a)]).toEqual(["FORBIDDEN", "CONTACT_NOT_AVAILABLE"]);
    const b = mapAcceptanceDbError({ code: "SM403", message: "VENDOR_PROFILE_MISSING" });
    expect([b.code, reasonOf(b)]).toEqual(["FORBIDDEN", "VENDOR_PROFILE_MISSING"]);
  });
  it("maps 23505 to CONFLICT ALREADY_ACCEPTED", () => {
    const e = mapAcceptanceDbError({ code: "23505", message: "duplicate key quote_acceptances_request_id_key" });
    expect([e.code, reasonOf(e)]).toEqual(["CONFLICT", "ALREADY_ACCEPTED"]);
  });
  it("maps anything else to a generic INTERNAL without leaking detail", () => {
    for (const err of [{ code: "XX000", message: "secret table detail" }, null, "boom", { code: "SM409", message: "?" }]) {
      const e = mapAcceptanceDbError(err);
      expect(e.code).toBe("INTERNAL");
      expect(e.message).not.toContain("secret");
    }
  });
});
