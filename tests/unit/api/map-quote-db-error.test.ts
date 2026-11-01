import { describe, expect, it, vi } from "vitest";
import { mapQuoteDbError } from "@/app/api/quotes/_lib/map-quote-db-error";

async function run(err: unknown) {
  const res = mapQuoteDbError(err);
  const json = (await res.json()) as { error: { code: string; message: string; details: { reason?: string }[] } };
  return { status: res.status, ...json.error };
}

describe("mapQuoteDbError", () => {
  it("42501 -> FORBIDDEN 403", async () => {
    const r = await run({ code: "42501", message: "permission denied" });
    expect([r.status, r.code]).toEqual([403, "FORBIDDEN"]);
  });

  it("SM403 VENDOR_PROFILE_MISSING -> FORBIDDEN 403 with profile message", async () => {
    const r = await run({ code: "SM403", message: "VENDOR_PROFILE_MISSING" });
    expect([r.status, r.code]).toEqual([403, "FORBIDDEN"]);
    expect(r.message).toBe("Complete your vendor profile before quoting.");
  });

  it.each(["REQUEST_NOT_FOUND", "QUOTE_NOT_FOUND"])("SM404 %s -> NOT_FOUND 404", async (reason) => {
    const r = await run({ code: "SM404", message: reason });
    expect([r.status, r.code]).toEqual([404, "NOT_FOUND"]);
  });

  it.each(["REQUEST_NOT_QUOTABLE", "DUPLICATE_ACTIVE_QUOTE", "QUOTE_NOT_WITHDRAWABLE"])(
    "SM409 %s -> CONFLICT 409 with reason",
    async (reason) => {
      const r = await run({ code: "SM409", message: reason });
      expect([r.status, r.code]).toEqual([409, "CONFLICT"]);
      expect(r.details).toEqual([{ reason }]);
    },
  );

  it("23505 on the active-quote index -> DUPLICATE_ACTIVE_QUOTE", async () => {
    const r = await run({
      code: "23505",
      message: 'duplicate key value violates unique constraint "quotes_one_active_per_vendor_request"',
    });
    expect([r.status, r.code]).toEqual([409, "CONFLICT"]);
    expect(r.details).toEqual([{ reason: "DUPLICATE_ACTIVE_QUOTE" }]);
  });

  it("23514 -> VALIDATION_FAILED 400", async () => {
    const r = await run({ code: "23514", message: 'violates check constraint "quotes_price_check"' });
    expect([r.status, r.code]).toEqual([400, "VALIDATION_FAILED"]);
    expect(r.message).not.toContain("quotes_price_check");
  });

  it("SM409 with an unknown reason and unknown errors -> INTERNAL 500, no SQL text", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const err of [
      { code: "SM409", message: "SOMETHING_ELSE" },
      { code: "XX000", message: 'relation "quotes" syntax error at select * from' },
      new Error("boom"),
      null,
    ]) {
      const r = await run(err);
      expect([r.status, r.code]).toEqual([500, "INTERNAL"]);
      expect(r.message).toBe("Something went wrong. Please try again.");
    }
  });
});
