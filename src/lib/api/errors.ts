// Shared error vocabulary and mapping (overview §8, contracts/shared-conventions.md).
import { ZodError } from "zod";
import { logEvent } from "./log";

export type ErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "AI_UNAVAILABLE"
  | "INTERNAL";

export const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  AI_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export type ErrorDetail = { path: string; message: string };

export const GENERIC_INTERNAL_MESSAGE = "Something went wrong. Please try again.";

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details: ErrorDetail[];

  constructor(code: ErrorCode, message: string, details: ErrorDetail[] = []) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

export function errorBody(code: ErrorCode, message: string, details: ErrorDetail[] = []) {
  return { error: { code, message, details } };
}

export function errorResponse(code: ErrorCode, message: string, details: ErrorDetail[] = []): Response {
  return Response.json(errorBody(code, message, details), { status: HTTP_STATUS[code] });
}

export function zodDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

function postgresCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return undefined;
}

/** Maps any thrown value to the standard envelope. Never echoes internal detail. */
export function toErrorResponse(err: unknown): Response {
  if (err instanceof ApiError) return errorResponse(err.code, err.message, err.details);
  if (err instanceof ZodError) {
    return errorResponse("VALIDATION_FAILED", "Some fields need attention.", zodDetails(err));
  }
  if (err instanceof SyntaxError) {
    return errorResponse("VALIDATION_FAILED", "The request body must be valid JSON.");
  }
  if (postgresCode(err) === "23505") {
    return errorResponse("CONFLICT", "This conflicts with an existing record.");
  }
  logEvent("api.internal_error", { reason: err instanceof Error ? err.name : typeof err });
  return errorResponse("INTERNAL", GENERIC_INTERNAL_MESSAGE);
}
