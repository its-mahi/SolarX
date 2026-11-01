// Response envelope helpers and the handler wrapper used by every Route Handler.
import type { z, ZodType } from "zod";
import { ApiError, errorResponse, toErrorResponse, zodDetails, type ErrorCode, type ErrorDetail } from "./errors";

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ data }, { ...init, status: 200 });
}

export function created<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ data }, { ...init, status: 201 });
}

export function fail(code: ErrorCode, message: string, details: ErrorDetail[] = []): Response {
  return errorResponse(code, message, details);
}

export type RouteContext<P = Record<string, string | string[]>> = { params: Promise<P> };

/** Wraps a handler so any thrown value becomes the standard error envelope. */
export function withApiHandler<P = Record<string, string | string[]>>(
  handler: (req: Request, ctx: RouteContext<P>) => Promise<Response>,
) {
  return async (req: Request, ctx: RouteContext<P>): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

/** Reads and validates a JSON body. Throws ApiError(VALIDATION_FAILED) on bad JSON or schema failure. */
export async function parseJsonBody<S extends ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    const text = await req.text();
    if (!text.trim()) throw new SyntaxError("empty body");
    raw = JSON.parse(text);
  } catch {
    throw new ApiError("VALIDATION_FAILED", "The request body must be valid JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("VALIDATION_FAILED", "Some fields need attention.", zodDetails(parsed.error));
  }
  return parsed.data;
}
