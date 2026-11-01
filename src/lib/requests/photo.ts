// Roof photo handling: type sniffing, resize + metadata stripping (sharp), private storage.
import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { ApiError } from "@/lib/api/errors";
import type { Database } from "@/lib/supabase/database.types";
import { detectFileType } from "@/lib/validation/file-signature";
import { ROOF_PHOTO_MAX_DIMENSION } from "@/lib/validation/requests";

export const ROOF_PHOTO_BUCKET = "roof-photos";
export const SIGNED_URL_TTL_SECONDS = 600;

export type RoofPhotoType = "image/jpeg" | "image/png" | "image/webp";
export type ProcessedPhoto = { data: Buffer; contentType: RoofPhotoType; ext: "jpg" | "png" | "webp" };

type Client = SupabaseClient<Database>;

/** Detects JPEG/PNG/WebP from magic bytes; anything else (text, GIF, PDF) is null. */
export function sniffImageType(bytes: Uint8Array): RoofPhotoType | null {
  const type = detectFileType(bytes);
  return type === "image/jpeg" || type === "image/png" || type === "image/webp" ? type : null;
}

const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

/** Auto-rotates, fits inside 2048x2048 and re-encodes in the same format without any metadata. */
export async function processRoofPhoto(input: Buffer, type: RoofPhotoType): Promise<ProcessedPhoto> {
  try {
    const pipeline = sharp(input, { failOn: "truncated" })
      .rotate()
      .resize({ width: ROOF_PHOTO_MAX_DIMENSION, height: ROOF_PHOTO_MAX_DIMENSION, fit: "inside", withoutEnlargement: true });
    const encoded =
      type === "image/jpeg" ? pipeline.jpeg({ quality: 85 }) : type === "image/png" ? pipeline.png() : pipeline.webp({ quality: 85 });
    const data = await encoded.toBuffer();
    return { data, contentType: type, ext: EXTENSIONS[type] };
  } catch {
    throw new ApiError("VALIDATION_FAILED", "This image could not be read");
  }
}

/** Uploads to `{user_id}/{request_id}/{uuid}.{ext}` with the RLS-bound client; returns the key. */
export async function storeRoofPhoto(client: Client, userId: string, requestId: string, photo: ProcessedPhoto): Promise<string> {
  const key = `${userId}/${requestId}/${randomUUID()}.${photo.ext}`;
  const { error } = await client.storage.from(ROOF_PHOTO_BUCKET).upload(key, photo.data, { contentType: photo.contentType, upsert: false });
  if (error) throw error;
  return key;
}

/** Best effort: never throws. */
export async function deleteRoofPhoto(client: Client, key: string | null): Promise<void> {
  if (!key) return;
  try {
    await client.storage.from(ROOF_PHOTO_BUCKET).remove([key]);
  } catch {
    // an orphaned object is harmless; it stays private
  }
}

export async function signRoofPhotoUrl(client: Client, key: string): Promise<{ url: string; expiresAt: string } | null> {
  const { data, error } = await client.storage.from(ROOF_PHOTO_BUCKET).createSignedUrl(key, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return { url: data.signedUrl, expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString() };
}
