import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { created, fail, ok, parseJsonBody, withApiHandler } from "@/lib/api/respond";

function jsonRequest(body: string | undefined) {
  return new Request("http://localhost:3000/api/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("envelope helpers", () => {
  it("ok returns 200 { data }", async () => {
    const res = ok({ a: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { a: 1 } });
  });

  it("created returns 201 { data }", async () => {
    const res = created({ id: "x" });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: { id: "x" } });
  });

  it("ok passes ResponseInit headers through", () => {
    const res = ok({}, { headers: { "Cache-Control": "no-store" } });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("fail returns the error envelope with details always an array", async () => {
    const res = fail("NOT_FOUND", "Not found");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Not found", details: [] } });
  });
});

describe("parseJsonBody", () => {
  const schema = z.object({ name: z.string() }).strict();

  it("returns parsed data for a valid body", async () => {
    await expect(parseJsonBody(jsonRequest('{"name":"Asha"}'), schema)).resolves.toEqual({ name: "Asha" });
  });

  it.each([
    ["malformed JSON", "{oops"],
    ["empty body", ""],
    ["unknown keys", '{"name":"Asha","role":"admin"}'],
  ])("rejects %s with VALIDATION_FAILED", async (_label, raw) => {
    const err = await parseJsonBody(jsonRequest(raw), schema).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("VALIDATION_FAILED");
  });
});

describe("withApiHandler", () => {
  it("converts thrown ApiError into the envelope", async () => {
    const handler = withApiHandler(async () => {
      throw new ApiError("FORBIDDEN", "No.");
    });
    const res = await handler(new Request("http://localhost/api/x"), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { code: "FORBIDDEN", message: "No.", details: [] } });
  });
});
