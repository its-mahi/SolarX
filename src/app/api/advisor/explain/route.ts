// POST /api/advisor/explain: three-section explanation of a request's stored results (specs/011).
// Read-only. AI failures answer 200 with the standard summary, never 503.
import { assertSameOrigin, requireRole } from "@/lib/api/auth-guard";
import { ApiError } from "@/lib/api/errors";
import { ok, parseJsonBody, withApiHandler } from "@/lib/api/respond";
import { explainAdvisor } from "@/lib/advisor/explain-advisor";
import { getOwnRequest } from "@/lib/requests/repository";
import { advisorExplainRequestSchema } from "@/lib/validation/advisor";

export const POST = withApiHandler(async (request) => {
  const started = Date.now();
  const auth = await requireRole(request, "household");
  assertSameOrigin(request, auth.authVia);
  const body = await parseJsonBody(request, advisorExplainRequestSchema);

  const row = await getOwnRequest(auth.supabase, body.request_id);
  if (!row) throw new ApiError("NOT_FOUND", "We could not find that request.");

  const { response, issues } = await explainAdvisor({ supabase: auth.supabase, request: row, signal: request.signal });
  console.info(
    JSON.stringify({
      event: "advisor_explain",
      mode: response.mode,
      source: response.source,
      ai_status: response.ai_status,
      issue_codes: issues,
      duration_ms: Date.now() - started,
    }),
  );
  return ok(response, { headers: { "Cache-Control": "no-store" } });
});
