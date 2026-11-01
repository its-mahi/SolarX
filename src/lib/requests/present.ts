// Owner DTO with a fresh signed roof photo URL (600 s), shared by Route Handlers and pages.
import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { toHouseholdRequestDto } from "./dto";
import { signRoofPhotoUrl } from "./photo";
import type { RequestRow } from "./repository";

export async function dtoWithPhoto(supabase: ServerSupabase, row: RequestRow) {
  const signed = row.roof_photo_path ? await signRoofPhotoUrl(supabase, row.roof_photo_path) : null;
  return toHouseholdRequestDto(row, { signedUrl: signed?.url ?? null, signedUrlExpiresAt: signed?.expiresAt ?? null });
}
