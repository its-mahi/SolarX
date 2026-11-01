import { ROOF_PHOTO_MAX_BYTES, ROOF_PHOTO_MAX_DIMENSION, ROOF_PHOTO_MIME_TYPES } from "@/lib/validation/requests";

export const PHOTO_TOO_LARGE = "Photo must be 5 MB or smaller";
export const PHOTO_BAD_TYPE = "Upload a JPEG, PNG or WebP photo";

export type PreparedPhoto = { ok: true; file: Blob; name: string } | { ok: false; message: string };

/** Validates the chosen file, then shrinks it to at most 2048 px as JPEG (falls back to the original if it cannot be decoded). */
export async function prepareRoofPhoto(file: File): Promise<PreparedPhoto> {
  if (!(ROOF_PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) return { ok: false, message: PHOTO_BAD_TYPE };
  if (file.size > ROOF_PHOTO_MAX_BYTES) return { ok: false, message: PHOTO_TOO_LARGE };

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, ROOF_PHOTO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: true, file, name: file.name };
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size > ROOF_PHOTO_MAX_BYTES) return { ok: true, file, name: file.name };
    return { ok: true, file: blob, name: "roof.jpg" };
  } catch {
    return { ok: true, file, name: file.name };
  }
}
