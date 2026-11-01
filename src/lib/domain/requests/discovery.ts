// Pure discovery logic: distance, filtering, sorting (no I/O, no framework imports). 004 data-model §6.
import type { VendorDiscoveryContext, VendorRequestFilters, VendorRequestSummary } from "@/lib/validation/vendor-discovery";

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** A request as returned by the database function, before distance is known. */
export type RawDiscoveryRequest = Omit<VendorRequestSummary, "distance_km" | "within_service_area">;

function hasBase(ctx: VendorDiscoveryContext | null): ctx is VendorDiscoveryContext & { base_latitude: number; base_longitude: number } {
  return !!ctx && ctx.base_latitude !== null && ctx.base_longitude !== null;
}

export function annotateDistance(item: RawDiscoveryRequest, ctx: VendorDiscoveryContext | null): VendorRequestSummary {
  if (!hasBase(ctx)) return { ...item, distance_km: null, within_service_area: null };
  const km = haversineKm(ctx.base_latitude, ctx.base_longitude, item.approx_latitude, item.approx_longitude);
  return {
    ...item,
    distance_km: Math.round(km),
    within_service_area: ctx.service_radius_km === null ? null : km <= ctx.service_radius_km,
  };
}

/** `distance` ascending (nulls last, ties newest first); `newest` by created_at desc. */
export function sortDiscoveryResults<T extends Pick<VendorRequestSummary, "distance_km" | "created_at">>(
  items: T[],
  sort: "distance" | "newest",
): T[] {
  const byNewest = (a: T, b: T) => Date.parse(b.created_at) - Date.parse(a.created_at);
  const copy = [...items];
  if (sort === "newest") return copy.sort(byNewest);
  return copy.sort((a, b) => {
    if (a.distance_km === null && b.distance_km === null) return byNewest(a, b);
    if (a.distance_km === null) return 1;
    if (b.distance_km === null) return -1;
    return a.distance_km - b.distance_km || byNewest(a, b);
  });
}

/** Effective distance cap: explicit value, "any" disables, absent defaults to the service radius. */
export function resolveDistanceFilter(
  maxDistance: VendorRequestFilters["max_distance_km"],
  ctx: VendorDiscoveryContext | null,
): number | null {
  if (!hasBase(ctx)) return null;
  if (maxDistance === "any") return null;
  if (typeof maxDistance === "number") return maxDistance;
  return ctx.service_radius_km;
}

export function applyDiscoveryFilters(
  items: VendorRequestSummary[],
  filters: VendorRequestFilters,
  maxDistanceKm: number | null,
): VendorRequestSummary[] {
  const needle = filters.locality?.trim().toLowerCase();
  const capacityBound = filters.min_capacity_kw !== undefined || filters.max_capacity_kw !== undefined;
  return items.filter((it) => {
    if (maxDistanceKm !== null && (it.distance_km === null || it.distance_km > maxDistanceKm)) return false;
    if (needle && !(it.locality ?? "").toLowerCase().includes(needle)) return false;
    if (capacityBound) {
      if (it.preferred_capacity_kw === null) return false;
      if (filters.min_capacity_kw !== undefined && it.preferred_capacity_kw < filters.min_capacity_kw) return false;
      if (filters.max_capacity_kw !== undefined && it.preferred_capacity_kw > filters.max_capacity_kw) return false;
    }
    if (filters.min_budget !== undefined && (it.budget === null || it.budget < filters.min_budget)) return false;
    if (filters.max_budget !== undefined && (it.budget === null || it.budget > filters.max_budget)) return false;
    return true;
  });
}
