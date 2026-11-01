// POST /api/requests/:id/publish — draft -> open (contracts/requests-api.md).
import { assertSameOrigin, requireRole } from "@/lib/api/auth-guard";
import { ApiError } from "@/lib/api/errors";
import { logEvent } from "@/lib/api/log";
import { ok } from "@/lib/api/respond";
import { getMissingPublishFields } from "@/lib/domain/requests/publish-readiness";
import { canTransition } from "@/lib/domain/requests/status";
import { getOwnRequest, publishDraft } from "@/lib/requests/repository";
import type { RequestStatus } from "@/lib/validation/enums";
import { dtoWithPhoto, parseRequestId, withNoStoreHandler } from "../../_lib/handlers";

const MISSING_MESSAGES = {
  location: "Pick your location on the map",
  address_text: "Enter your address",
  locality: "Enter your locality",
  monthly_units: "Enter your monthly electricity units",
  budget: "Enter your budget",
  roof_photo: "Add a roof photo",
} as const;

export const POST = withNoStoreHandler<{ id: string }>(async (request, ctx) => {
  const { user, supabase, authVia } = await requireRole(request, "household");
  assertSameOrigin(request, authVia);
  const id = await parseRequestId(ctx);

  const text = await request.text();
  if (text.trim()) {
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new ApiError("VALIDATION_FAILED", "The request body must be valid JSON.");
    }
    if (typeof body !== "object" || body === null || Array.isArray(body) || Object.keys(body).length > 0) {
      throw new ApiError("VALIDATION_FAILED", "This action does not take a body.");
    }
  }

  const row = await getOwnRequest(supabase, id);
  if (!row) throw new ApiError("NOT_FOUND", "Request not found");
  if (!canTransition(row.status as RequestStatus, "open")) {
    throw new ApiError("CONFLICT", "This request is already published");
  }
  const missing = getMissingPublishFields(row);
  if (missing.length > 0) {
    throw new ApiError(
      "VALIDATION_FAILED",
      "Complete the missing items before publishing.",
      missing.map((path) => ({ path, message: MISSING_MESSAGES[path] })),
    );
  }
  const published = await publishDraft(supabase, id);
  if (!published) throw new ApiError("CONFLICT", "This request is already published");
  logEvent("request.published", { requestId: id, userId: user.id, fromStatus: "draft", toStatus: "open" });
  return ok(await dtoWithPhoto(supabase, published));
});
