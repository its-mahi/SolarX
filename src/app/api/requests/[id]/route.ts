// GET and PATCH /api/requests/:id — contracts/requests-api.md.
import { assertSameOrigin, requireUser } from "@/lib/api/auth-guard";
import { ApiError } from "@/lib/api/errors";
import { logEvent } from "@/lib/api/log";
import { ok, parseJsonBody } from "@/lib/api/respond";
import { getOwnRequest, setAiConsent, updateDraft } from "@/lib/requests/repository";
import { consentWithdrawalSchema, updateDraftSchema } from "@/lib/validation/requests";
import { z } from "zod";
import { dtoWithPhoto, parseRequestId, PUBLISHED_MESSAGE, withNoStoreHandler } from "../_lib/handlers";
import { getOpenRequestForVendor } from "../_vendor/get-open-request";

const anyObject = z.record(z.string(), z.unknown());

export const GET = withNoStoreHandler<{ id: string }>(async (request, ctx) => {
  const { user, profile, supabase } = await requireUser(request);
  if (profile.role === "vendor") return getOpenRequestForVendor((await ctx.params).id, { userId: user.id, supabase });
  if (profile.role !== "household") {
    throw new ApiError("FORBIDDEN", "This action is not available for your account type.");
  }
  const id = await parseRequestId(ctx);
  const row = await getOwnRequest(supabase, id);
  if (!row) throw new ApiError("NOT_FOUND", "Request not found");
  return ok(await dtoWithPhoto(supabase, row));
});

export const PATCH = withNoStoreHandler<{ id: string }>(async (request, ctx) => {
  const { user, profile, supabase, authVia } = await requireUser(request);
  if (profile.role !== "household") {
    throw new ApiError("FORBIDDEN", "This action is not available for your account type.");
  }
  assertSameOrigin(request, authVia);
  const id = await parseRequestId(ctx);
  const row = await getOwnRequest(supabase, id);
  if (!row) throw new ApiError("NOT_FOUND", "Request not found");

  if (row.status === "draft") {
    const fields = await parseJsonBody(request, updateDraftSchema);
    const updated = await updateDraft(supabase, id, fields);
    if (!updated) throw new ApiError("CONFLICT", PUBLISHED_MESSAGE);
    if (fields.ai_consent !== undefined && fields.ai_consent !== row.ai_consent) {
      logEvent("request.ai_consent_changed", {
        requestId: id,
        userId: user.id,
        reason: fields.ai_consent ? "granted" : "withdrawn",
      });
    }
    return ok(await dtoWithPhoto(supabase, updated));
  }

  // Published requests: the only allowed change is withdrawing AI consent.
  const raw = await parseJsonBody(request, anyObject);
  if (raw.ai_consent === true) throw new ApiError("CONFLICT", "Consent can only be given before publishing");
  const parsed = consentWithdrawalSchema.safeParse(raw);
  if (!parsed.success) throw new ApiError("CONFLICT", PUBLISHED_MESSAGE);
  const updated = await setAiConsent(supabase, id, false);
  if (!updated) throw new ApiError("NOT_FOUND", "Request not found");
  if (row.ai_consent) logEvent("request.ai_consent_changed", { requestId: id, userId: user.id, reason: "withdrawn" });
  return ok(await dtoWithPhoto(supabase, updated));
});
