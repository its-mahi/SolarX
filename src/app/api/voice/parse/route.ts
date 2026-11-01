// POST /api/voice/parse: transcript -> candidate usage fields (specs/010 contracts/voice-parse-api.md).
// Stateless: no database or storage access; the transcript and values are never logged.
import { assertSameOrigin, requireRole } from "@/lib/api/auth-guard";
import { ApiError } from "@/lib/api/errors";
import { ok, parseJsonBody, withApiHandler } from "@/lib/api/respond";
import { aiFailureToApiError } from "@/lib/ai/errors";
import { parseVoiceTranscript } from "@/lib/voice/parse-voice-transcript";
import { VOICE_FIELD_KEYS, voiceParseRequestSchema } from "@/lib/validation/voice";

const UNAVAILABLE_MESSAGE = "Voice analysis is unavailable right now. Please retry or type your values.";

export const POST = withApiHandler(async (request) => {
  const started = Date.now();
  const body = await parseJsonBody(request, voiceParseRequestSchema);
  const auth = await requireRole(request, "household");
  assertSameOrigin(request, auth.authVia);

  const { response, failure } = await parseVoiceTranscript(body, request.signal);
  const statuses = VOICE_FIELD_KEYS.map((k) => response.fields[k].status);
  const heard = statuses.filter((s) => s === "heard").length;
  const needsEntry = statuses.filter((s) => s === "needs_entry").length;
  console.info(
    JSON.stringify({
      event: "voice_parse",
      ai_status: response.ai_status,
      heard_count: heard,
      needs_entry_count: needsEntry,
      duration_ms: Date.now() - started,
    }),
  );

  const aiDown = response.ai_status === "unavailable" || response.ai_status === "invalid_output" || response.ai_status === "not_configured";
  if (aiDown && heard === 0 && needsEntry === 0) {
    if (failure) throw aiFailureToApiError(failure, UNAVAILABLE_MESSAGE);
    throw new ApiError("AI_UNAVAILABLE", UNAVAILABLE_MESSAGE, [
      { path: "ai", message: "not_configured", reason: "not_configured", retryable: false } as never,
    ]);
  }
  return ok(response, { headers: { "Cache-Control": "no-store" } });
});
