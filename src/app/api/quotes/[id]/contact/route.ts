// GET /api/quotes/:id/contact — household contact, revealed only to the vendor whose quote was accepted (D-01).
import { requireRole } from "@/lib/api/auth-guard";
import { ApiError, zodDetails } from "@/lib/api/errors";
import { logEvent } from "@/lib/api/log";
import { ok, withApiHandler } from "@/lib/api/respond";
import { householdContactSchema } from "@/lib/validation/acceptance";
import { quoteIdParamSchema } from "@/lib/validation/quote";
import { mapAcceptanceDbError } from "../../_lib/map-acceptance-db-error";

const handler = withApiHandler<{ id: string }>(async (request, { params }) => {
  const ctx = await requireRole(request, "vendor");

  const idParsed = quoteIdParamSchema.safeParse(await params);
  if (!idParsed.success) throw new ApiError("VALIDATION_FAILED", "Some fields need attention.", zodDetails(idParsed.error));

  const { data, error } = await ctx.supabase.rpc("accepted_household_contact", { p_quote_id: idParsed.data.id });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) throw mapAcceptanceDbError(error);

  const contact = householdContactSchema.parse({
    requestId: row.request_id,
    name: row.household_name,
    phone: row.household_phone ?? null,
    addressText: row.address_text ?? null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    locality: row.locality ?? null,
    acceptedAt: row.accepted_at,
  });

  logEvent("contact.revealed", { userId: ctx.user.id, quoteId: idParsed.data.id, requestId: contact.requestId });
  return ok(contact);
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const res = await handler(request, context);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
