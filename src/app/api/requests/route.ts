// POST /api/requests (create draft) and GET /api/requests (own list) — contracts/requests-api.md.
import { assertSameOrigin, requireRole, requireUser } from "@/lib/api/auth-guard";
import { ApiError } from "@/lib/api/errors";
import { logEvent } from "@/lib/api/log";
import { created, ok, parseJsonBody } from "@/lib/api/respond";
import { toHouseholdRequestDto } from "@/lib/requests/dto";
import { insertDraft, listOwnRequests } from "@/lib/requests/repository";
import { createRequestSchema } from "@/lib/validation/requests";
import { withNoStoreHandler } from "./_lib/handlers";
import { listOpenRequestsForVendor } from "./_vendor/list-open-requests";

export const POST = withNoStoreHandler(async (request) => {
  const { user, supabase, authVia } = await requireRole(request, "household");
  assertSameOrigin(request, authVia);
  const fields = await parseJsonBody(request, createRequestSchema);
  const row = await insertDraft(supabase, user.id, fields);
  logEvent("request.created", { requestId: row.id, userId: user.id });
  return created(toHouseholdRequestDto(row));
});

export const GET = withNoStoreHandler(async (request) => {
  const { user, profile, supabase } = await requireUser(request);
  if (profile.role === "vendor") return listOpenRequestsForVendor(request, { userId: user.id, supabase });
  if (profile.role !== "household") {
    throw new ApiError("FORBIDDEN", "This action is not available for your account type.");
  }
  const rows = await listOwnRequests(supabase);
  return ok({ items: rows.map((row) => toHouseholdRequestDto(row)) });
});
