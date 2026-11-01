// Vendor branch of GET /api/requests: privacy-safe list of open/quoted requests (004 contract).
import "server-only";
import { ApiError, zodDetails } from "@/lib/api/errors";
import { ok } from "@/lib/api/respond";
import {
  annotateDistance,
  applyDiscoveryFilters,
  resolveDistanceFilter,
  sortDiscoveryResults,
} from "@/lib/domain/requests/discovery";
import { filtersInputFromSearchParams, vendorRequestFiltersSchema } from "@/lib/validation/vendor-discovery";
import { loadVendorContext, mapDbError, toRawRequest, type VendorCaller } from "./shared";

export const MAX_ITEMS = 200;

export async function listOpenRequestsForVendor(request: Request, { userId, supabase }: VendorCaller): Promise<Response> {
  const parsed = vendorRequestFiltersSchema.safeParse(filtersInputFromSearchParams(new URL(request.url).searchParams));
  if (!parsed.success) throw new ApiError("VALIDATION_FAILED", "Some filters need attention.", zodDetails(parsed.error));
  const filters = parsed.data;

  const { data, error } = await supabase.rpc("vendor_list_open_requests");
  if (error) mapDbError(error, userId);

  const context = await loadVendorContext(supabase, userId);
  const maxDistance = resolveDistanceFilter(filters.max_distance_km, context);
  const hasBase = !!context && context.base_latitude !== null && context.base_longitude !== null;
  const sort = filters.sort === "distance" && !hasBase ? "newest" : (filters.sort ?? (hasBase ? "distance" : "newest"));

  const annotated = (data ?? []).map((row) => annotateDistance(toRawRequest(row), context));
  const matched = sortDiscoveryResults(applyDiscoveryFilters(annotated, filters, maxDistance), sort);

  const applied: Record<string, unknown> = { sort };
  if (maxDistance !== null) applied.max_distance_km = maxDistance;
  if (filters.locality) applied.locality = filters.locality;
  for (const key of ["min_capacity_kw", "max_capacity_kw", "min_budget", "max_budget"] as const) {
    if (filters[key] !== undefined) applied[key] = filters[key];
  }

  return ok({
    items: matched.slice(0, MAX_ITEMS),
    vendor_context: context,
    applied_filters: applied,
    truncated: matched.length > MAX_ITEMS,
  });
}
