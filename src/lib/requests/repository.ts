// Server data access for household_requests. Callers pass an RLS-bound Supabase client;
// authorization is enforced by RLS plus the guard triggers (data-model.md).
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/errors";
import type { Database } from "@/lib/supabase/database.types";
import type { DraftFields } from "@/lib/validation/requests";

export type RequestRow = Database["public"]["Tables"]["household_requests"]["Row"];
type Client = SupabaseClient<Database>;

const CONFLICT_MESSAGE = "This request has been published and can no longer be edited.";

/** Check/trigger violations and RLS rejections become CONFLICT; database text is never echoed. */
function fail(error: { code?: string }): never {
  if (error.code === "23514" || error.code === "23502" || error.code === "42501") {
    throw new ApiError("CONFLICT", CONFLICT_MESSAGE);
  }
  throw error;
}

export async function listOwnRequests(supabase: Client): Promise<RequestRow[]> {
  const { data, error } = await supabase
    .from("household_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) fail(error);
  return data ?? [];
}

/** Returns null when the row does not exist or is not visible to the caller. */
export async function getOwnRequest(supabase: Client, id: string): Promise<RequestRow | null> {
  const { data, error } = await supabase.from("household_requests").select("*").eq("id", id).maybeSingle();
  if (error) fail(error);
  return data;
}

export async function insertDraft(supabase: Client, userId: string, fields: DraftFields): Promise<RequestRow> {
  const { data, error } = await supabase
    .from("household_requests")
    .insert({ ...fields, user_id: userId, status: "draft" })
    .select("*")
    .single();
  if (error) fail(error);
  return data!;
}

/** Updates draft fields; null when the row is hidden or no longer a draft. */
export async function updateDraft(supabase: Client, id: string, fields: DraftFields): Promise<RequestRow | null> {
  const { data, error } = await supabase
    .from("household_requests")
    .update(fields)
    .eq("id", id)
    .eq("status", "draft")
    .select("*")
    .maybeSingle();
  if (error) fail(error);
  return data;
}

/** Consent withdrawal on any status (guard trigger allows only true -> false after publishing). */
export async function setAiConsent(supabase: Client, id: string, aiConsent: boolean): Promise<RequestRow | null> {
  const { data, error } = await supabase
    .from("household_requests")
    .update({ ai_consent: aiConsent })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) fail(error);
  return data;
}

/** Conditional draft -> open; null when the row is not a draft (caller maps to 409/404). */
export async function publishDraft(supabase: Client, id: string): Promise<RequestRow | null> {
  const { data, error } = await supabase
    .from("household_requests")
    .update({ status: "open" })
    .eq("id", id)
    .eq("status", "draft")
    .select("*")
    .maybeSingle();
  if (error) fail(error);
  return data;
}

export async function setRoofPhotoPath(supabase: Client, id: string, path: string | null): Promise<RequestRow | null> {
  const { data, error } = await supabase
    .from("household_requests")
    .update({ roof_photo_path: path })
    .eq("id", id)
    .eq("status", "draft")
    .select("*")
    .maybeSingle();
  if (error) fail(error);
  return data;
}
