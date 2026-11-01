import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError, HTTP_STATUS, toErrorResponse, type ErrorCode } from "@/lib/api/errors";

async function body(res: Response) {
  return (await res.json()) as { error: { code: string; message: string; details: unknown[] } };
}

describe("HTTP_STATUS", () => {
  const expected: Record<ErrorCode, number> = {
    VALIDATION_FAILED: 400,
    UNAUTHENTICATED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    PAYLOAD_TOO_LARGE: 413,
    AI_UNAVAILABLE: 503,
    INTERNAL: 500,
  };

  it.each(Object.entries(expected))("%s maps to %i", async (code, status) => {
    expect(HTTP_STATUS[code as ErrorCode]).toBe(status);
    const res = toErrorResponse(new ApiError(code as ErrorCode, "msg"));
    expect(res.status).toBe(status);
    expect((await body(res)).error.code).toBe(code);
  });
});

describe("toErrorResponse", () => {
  it("maps a ZodError to VALIDATION_FAILED with path/message details", async () => {
    const schema = z.object({ name: z.string().min(1), vendor: z.object({ radius: z.number() }) });
    const parsed = schema.safeParse({ name: "", vendor: { radius: "x" } });
    expect(parsed.success).toBe(false);
    const res = toErrorResponse(parsed.error);
    expect(res.status).toBe(400);
    const { error } = await body(res);
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.details).toEqual(
      expect.arrayContaining([
        { path: "name", message: expect.any(String) },
        { path: "vendor.radius", message: expect.any(String) },
      ]),
    );
  });

  it("maps a JSON SyntaxError to VALIDATION_FAILED", async () => {
    let err: unknown;
    try {
      JSON.parse("{not json");
    } catch (e) {
      err = e;
    }
    const res = toErrorResponse(err);
    expect(res.status).toBe(400);
    expect((await body(res)).error.code).toBe("VALIDATION_FAILED");
  });

  it("maps Postgres unique violation 23505 to CONFLICT without echoing the DB message", async () => {
    const res = toErrorResponse({ code: "23505", message: 'duplicate key value violates unique constraint "profiles_pkey"' });
    expect(res.status).toBe(409);
    const { error } = await body(res);
    expect(error.code).toBe("CONFLICT");
    expect(error.message).not.toMatch(/duplicate key|profiles_pkey/);
  });

  it("maps unknown errors to INTERNAL with a generic message and no stack or SQL", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = toErrorResponse(new Error("db exploded at SELECT * FROM profiles"));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/SELECT|exploded|at .*\(|stack/i);
    const { error } = JSON.parse(text);
    expect(error).toEqual({ code: "INTERNAL", message: "Something went wrong. Please try again.", details: [] });
    spy.mockRestore();
  });
});
