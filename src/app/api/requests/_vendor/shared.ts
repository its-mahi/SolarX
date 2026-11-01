// Helpers shared by the vendor branches of GET /api/requests and GET /api/requests/:id (004).
import "server-only";
import { ApiError } from "@/lib/api/errors";
import { logEvent } from "@/lib/api/log";
import type { RawDiscoveryRequest } from "@/lib/domain/requests/discovery";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { VendorDiscoveryContext } from "@/lib/validation/vendor-discovery";

export type VendorCaller = { userId: string; supabase: ServerSupabase };

/** The caller's own vendors row (own-row RLS), or null when it has none. */
export async function loadVendorContext(supabase: ServerSupabase, userId: string): Promise<VendorDiscoveryContext | null> {
  const { data } = await supabase
    .from("vendors")
    .select("service_area, latitude, longitude, service_radius_km")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    service_area: data.service_area,
    base_latitude: data.latitude === null ? null : Number(data.latitude),
    base_longitude: data.longitude === null ? null : Number(data.longitude),
    service_radius_km: data.service_radius_km,
  };
}

/** Maps a database function error to the shared envelope without leaking its text. */
export function mapDbError(error: { code?: string }, userId: string): never {
  if (error.code === "42501") {
    logEvent("vendor_discovery.forbidden", { userId, code: error.code });
    throw new ApiError("FORBIDDEN", "This action is not available for your account type.");
  }
  logEvent("vendor_discovery.error", { userId, code: error.code ?? "unknown" });
  throw new ApiError("INTERNAL", "Something went wrong. Please try again.");
}

type DbRow = {
  id: string;
  status: string;
  locality: string | null;
  approx_latitude: number | string;
  approx_longitude: number | string;
  monthly_units: number | null;
  budget: number | null;
  preferred_capacity_kw: number | string | null;
  has_roof_photo: boolean;
  is_demo: boolean;
  created_at: string;
};

/** Whitelists exactly the permitted columns (never spreads the database row). */
export function toRawRequest(row: DbRow): RawDiscoveryRequest {
  return {
    id: row.id,
    status: row.status === "quoted" ? "quoted" : "open",
    locality: row.locality,
    approx_latitude: Number(row.approx_latitude),
    approx_longitude: Number(row.approx_longitude),
    monthly_units: row.monthly_units,
    budget: row.budget,
    preferred_capacity_kw: row.preferred_capacity_kw === null ? null : Number(row.preferred_capacity_kw),
    has_roof_photo: row.has_roof_photo,
    is_demo: row.is_demo,
    created_at: row.created_at,
  };
}
