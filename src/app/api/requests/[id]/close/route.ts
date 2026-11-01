// POST /api/requests/:id/close — owning household closes an accepted request (specs/007 D-10).
import { assertSameOrigin, requireRole } from "@/lib/api/auth-guard";
import { logEvent } from "@/lib/api/log";
import { ok, parseJsonBody } from "@/lib/api/respond";
import { closeRequestBodySchema } from "@/lib/validation/acceptance";
import { mapAcceptanceDbError } from "@/app/api/quotes/_lib/map-acceptance-db-error";
import { parseRequestId, withNoStoreHandler } from "../../_lib/handlers";

export const POST = withNoStoreHandler<{ id: string }>(async (request, ctx) => {
  const { user, supabase, authVia } = await requireRole(request, "household");
  assertSameOrigin(request, authVia);
  const id = await parseRequestId(ctx);
  await parseJsonBody(request, closeRequestBodySchema);

  const { data, error } = await supabase.rpc("close_request", { p_request_id: id });
  if (error || !data) throw mapAcceptanceDbError(error);

  logEvent("request.closed", { userId: user.id, requestId: id, fromStatus: "accepted", toStatus: "closed" });
  return ok({ request: { id: data.id, status: data.status, updatedAt: data.updated_at } });
});
