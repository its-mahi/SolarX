import "server-only";
import { ApiError, type ErrorDetail } from "@/lib/api/errors";
import type { AiFailure } from "./types";

/** Maps an AI failure to the shared AI_UNAVAILABLE (503) error; carries no provider text. */
export function aiFailureToApiError(failure: AiFailure, userMessage: string): ApiError {
  const detail = {
    path: "ai",
    message: failure.kind,
    reason: failure.kind,
    retryable: failure.retryable,
  };
  return new ApiError("AI_UNAVAILABLE", userMessage, [detail as ErrorDetail]);
}
