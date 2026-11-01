// POST /api/requests/:id/photo — upload or replace the roof photo of a draft (contracts/request-photo-api.md).
import { assertSameOrigin, requireRole } from "@/lib/api/auth-guard";
import { ApiError } from "@/lib/api/errors";
import { logEvent } from "@/lib/api/log";
import { ok } from "@/lib/api/respond";
import { deleteRoofPhoto, processRoofPhoto, sniffImageType, storeRoofPhoto } from "@/lib/requests/photo";
import { getOwnRequest, setRoofPhotoPath } from "@/lib/requests/repository";
import { ROOF_PHOTO_MAX_BYTES } from "@/lib/validation/requests";
import { dtoWithPhoto, parseRequestId, PUBLISHED_MESSAGE, withNoStoreHandler } from "../../_lib/handlers";

export const runtime = "nodejs";

export const POST = withNoStoreHandler<{ id: string }>(async (request, ctx) => {
  const { user, supabase, authVia } = await requireRole(request, "household");
  assertSameOrigin(request, authVia);
  const id = await parseRequestId(ctx);

  const row = await getOwnRequest(supabase, id);
  if (!row) throw new ApiError("NOT_FOUND", "Request not found");
  if (row.status !== "draft") throw new ApiError("CONFLICT", PUBLISHED_MESSAGE);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError("VALIDATION_FAILED", "Choose a photo to upload", [{ path: "file", message: "Choose a photo to upload" }]);
  }
  const extra = Array.from(form.keys()).filter((key) => key !== "file");
  if (extra.length > 0) throw new ApiError("VALIDATION_FAILED", "Only a photo can be uploaded here.");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new ApiError("VALIDATION_FAILED", "Choose a photo to upload", [{ path: "file", message: "Choose a photo to upload" }]);
  }
  if (file.size > ROOF_PHOTO_MAX_BYTES) throw new ApiError("PAYLOAD_TOO_LARGE", "Photo must be 5 MB or smaller");

  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) throw new ApiError("VALIDATION_FAILED", "Upload a JPEG, PNG or WebP photo", [{ path: "file", message: "Upload a JPEG, PNG or WebP photo" }]);

  const processed = await processRoofPhoto(bytes, type);
  const key = await storeRoofPhoto(supabase, user.id, id, processed);

  const updated = await setRoofPhotoPath(supabase, id, key).catch(async (err) => {
    await deleteRoofPhoto(supabase, key);
    throw err;
  });
  if (!updated) {
    await deleteRoofPhoto(supabase, key);
    throw new ApiError("CONFLICT", PUBLISHED_MESSAGE);
  }
  await deleteRoofPhoto(supabase, row.roof_photo_path);
  logEvent("request.photo_uploaded", { requestId: id });
  return ok(await dtoWithPhoto(supabase, updated));
});
