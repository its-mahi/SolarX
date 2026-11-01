// GET /api/requests/:id/roof-assessment — state for the roof panel (contracts/roof-assessment-get-api.md).
import { requireRole } from "@/lib/api/auth-guard";
import { ApiError } from "@/lib/api/errors";
import { ok, withApiHandler } from "@/lib/api/respond";
import { getRoofAssessmentState } from "@/lib/supabase/queries/roof-assessments";
import { uuidSchema } from "@/lib/validation/common";

export const runtime = "nodejs";

export const GET = withApiHandler<{ id: string }>(async (request, { params }) => {
  const ctx = await requireRole(request, "household");
  const parsed = uuidSchema.safeParse((await params).id);
  if (!parsed.success) throw new ApiError("VALIDATION_FAILED", "The request id is not valid.", [{ path: "id", message: "Must be a UUID" }]);

  const { data: req, error } = await ctx.supabase
    .from("household_requests")
    .select("id, status, ai_consent, roof_photo_path")
    .eq("id", parsed.data)
    .maybeSingle();
  if (error) throw error;
  if (!req) throw new ApiError("NOT_FOUND", "Request not found.");

  return ok(await getRoofAssessmentState(ctx.supabase, req.id, req), { headers: { "Cache-Control": "no-store" } });
});
