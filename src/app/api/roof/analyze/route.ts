// POST /api/roof/analyze — consent-gated roof photo analysis (contracts/roof-analyze-api.md).
import { assertSameOrigin, requireRole } from "@/lib/api/auth-guard";
import { ApiError } from "@/lib/api/errors";
import { logEvent } from "@/lib/api/log";
import { created, parseJsonBody, withApiHandler } from "@/lib/api/respond";
import { aiFailureToApiError } from "@/lib/ai/errors";
import { ROOF_ANALYSIS_PROMPT_VERSION } from "@/lib/ai/prompts/roof-analysis.v1";
import { analyzeRoofPhoto } from "@/lib/ai/roof-analysis";
import { insertRoofAssessment, toRoofAssessmentDto } from "@/lib/supabase/queries/roof-assessments";
import { detectFileType } from "@/lib/validation/file-signature";
import { RoofAnalyzeRequestSchema } from "@/lib/validation/roof";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ANALYZABLE = new Set(["draft", "open", "quoted"]);
const reason = (r: string) => [{ path: "reason", message: r, reason: r }];

export const POST = withApiHandler(async (request) => {
  const input = await parseJsonBody(request, RoofAnalyzeRequestSchema);
  const ctx = await requireRole(request, "household");
  assertSameOrigin(request, ctx.authVia);
  const { supabase } = ctx;

  const { data: req, error: reqError } = await supabase
    .from("household_requests")
    .select("id, status, ai_consent, roof_photo_path")
    .eq("id", input.request_id)
    .maybeSingle();
  if (reqError) throw reqError;
  if (!req) throw new ApiError("NOT_FOUND", "Request not found.");

  if (!ANALYZABLE.has(req.status)) {
    throw new ApiError("CONFLICT", "This request can no longer be analyzed.", reason("request_not_analyzable"));
  }
  // Consent is checked before any storage read or AI call.
  if (!req.ai_consent) {
    throw new ApiError("FORBIDDEN", "AI analysis needs your consent first.", reason("ai_consent_required"));
  }
  if (!req.roof_photo_path) {
    throw new ApiError("CONFLICT", "Add a roof photo first.", reason("roof_photo_missing"));
  }
  const photoPath = req.roof_photo_path;

  const { data: blob, error: dlError } = await supabase.storage.from("roof-photos").download(photoPath);
  if (dlError || !blob) throw new ApiError("NOT_FOUND", "Roof photo not found.", reason("roof_photo_missing"));
  if (blob.size > MAX_PHOTO_BYTES) {
    throw new ApiError("VALIDATION_FAILED", "The roof photo is not supported.", reason("roof_photo_unsupported"));
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mimeType = detectFileType(bytes);
  if (bytes.length > MAX_PHOTO_BYTES || (mimeType !== "image/jpeg" && mimeType !== "image/png" && mimeType !== "image/webp")) {
    throw new ApiError("VALIDATION_FAILED", "The roof photo is not supported.", reason("roof_photo_unsupported"));
  }

  const result = await analyzeRoofPhoto({ bytes, mimeType });

  if (!result.ok) {
    const failureReason = result.failure.kind === "unsupported_input" ? "provider_error" : result.failure.kind;
    const row = await insertRoofAssessment(supabase, {
      request_id: req.id,
      status: "failed",
      failure_reason: failureReason,
      model: result.meta.model || null,
      prompt_version: ROOF_ANALYSIS_PROMPT_VERSION,
      roof_photo_path: photoPath,
    });
    logEvent("roof_analysis.failed", { reason: failureReason });
    const base = aiFailureToApiError(result.failure, "Analysis unavailable — retry");
    throw new ApiError(base.code, base.message, [
      { ...base.details[0], reason: failureReason, assessment_id: row.id } as never,
    ]);
  }

  const row = await insertRoofAssessment(supabase, {
    request_id: req.id,
    status: "completed",
    observations: result.analysis.observations,
    potential_obstructions: result.analysis.potential_obstructions,
    limitations: result.analysis.limitations,
    site_survey_required: true,
    model: result.meta.model || null,
    prompt_version: ROOF_ANALYSIS_PROMPT_VERSION,
    roof_photo_path: photoPath,
  });
  logEvent("roof_analysis.completed", {});
  return created({ assessment: toRoofAssessmentDto(row, photoPath) });
});
