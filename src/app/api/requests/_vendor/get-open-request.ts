// Vendor branch of GET /api/requests/:id: permitted detail of one open/quoted request (004 contract).
// The admin client is used only to read the photo path AFTER the definer function authorised this vendor.
import "server-only";
import { ApiError } from "@/lib/api/errors";
import { ok } from "@/lib/api/respond";
import { annotateDistance } from "@/lib/domain/requests/discovery";
import { signRoofPhotoUrl } from "@/lib/requests/photo";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { VendorRequestDetail } from "@/lib/validation/vendor-discovery";
import { requestIdParamSchema } from "@/lib/validation/vendor-discovery";
import { loadVendorContext, mapDbError, toRawRequest, type VendorCaller } from "./shared";

const NOT_AVAILABLE = "This request is not available.";

export async function getOpenRequestForVendor(rawId: string, { userId, supabase }: VendorCaller): Promise<Response> {
  const parsedId = requestIdParamSchema.safeParse(rawId);
  if (!parsedId.success) {
    throw new ApiError("VALIDATION_FAILED", "The request id is not valid.", [{ path: "id", message: "Must be a valid id" }]);
  }
  const id = parsedId.data;

  const { data, error } = await supabase.rpc("vendor_get_open_request", { p_request_id: id });
  if (error) mapDbError(error, userId);
  const row = data?.[0];
  if (!row) throw new ApiError("NOT_FOUND", NOT_AVAILABLE);

  let roofPhotoStatus: VendorRequestDetail["roof_photo_status"] = "none";
  let roofPhoto: VendorRequestDetail["roof_photo"] = null;
  if (row.has_roof_photo) {
    roofPhotoStatus = "unavailable";
    try {
      const { data: pathRow } = await createAdminSupabase()
        .from("household_requests")
        .select("roof_photo_path")
        .eq("id", id)
        .in("status", ["open", "quoted"])
        .maybeSingle();
      const signed = pathRow?.roof_photo_path ? await signRoofPhotoUrl(createAdminSupabase(), pathRow.roof_photo_path) : null;
      if (signed) {
        roofPhoto = { url: signed.url, expires_at: signed.expiresAt };
        roofPhotoStatus = "available";
      }
    } catch {
      // signing is best effort; the detail still renders without a photo
    }
  }

  const { data: assessmentRows, error: assessmentError } = await supabase.rpc("vendor_get_latest_roof_assessment", {
    p_request_id: id,
  });
  if (assessmentError) mapDbError(assessmentError, userId);
  const a = assessmentRows?.[0];

  const context = await loadVendorContext(supabase, userId);
  const summary = annotateDistance(toRawRequest(row), context);
  const detail: VendorRequestDetail = {
    ...summary,
    roof_photo_status: roofPhotoStatus,
    roof_photo: roofPhoto,
    roof_assessment: a
      ? {
          observations: a.observations,
          potential_obstructions: a.potential_obstructions,
          limitations: a.limitations,
          site_survey_required: a.site_survey_required,
          assessed_at: a.assessed_at,
        }
      : null,
  };
  return ok(detail);
}
