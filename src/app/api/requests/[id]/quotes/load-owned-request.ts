// Shared by GET /api/requests/:id/quotes and POST /api/quotes/compare (kept beside the routes: src/lib/api is 001's).
// Everything is read with the caller's RLS-bound client, so a request the caller does not own simply does not exist.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/errors";
import type { QuoteRowLike, RequestContext } from "@/lib/domain/quotes";
import type { Database } from "@/lib/supabase/database.types";
import { uuidSchema } from "@/lib/validation/common";

type Client = SupabaseClient<Database>;

export type OwnedRequest = { id: string; status: string; budget: number | null; preferred_capacity_kw: number | null };
export type VendorInfo = { id: string; companyName: string; isDemo: boolean };

const QUOTE_COLUMNS =
  "id, request_id, vendor_id, price, capacity_kw, panel_details, inverter_details, warranty_details, installation_days, earthing_included, documentation_included, other_inclusions, exclusions, vendor_notes, source, status, created_at";

export function parseRequestIdOrThrow(value: unknown): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) throw new ApiError("VALIDATION_FAILED", "The request id is not valid.", [{ path: "id", message: "Must be a UUID" }]);
  return parsed.data;
}

/** The request when the caller owns it; otherwise NOT_FOUND (existence is never leaked). */
export async function loadOwnedRequest(supabase: Client, requestId: string): Promise<OwnedRequest> {
  const { data, error } = await supabase
    .from("household_requests")
    .select("id, status, budget, preferred_capacity_kw")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError("NOT_FOUND", "Request not found.");
  return data as OwnedRequest;
}

export async function loadQuoteBundle(supabase: Client, request: OwnedRequest) {
  const { data: rows, error } = await supabase.from("quotes").select(QUOTE_COLUMNS).eq("request_id", request.id);
  if (error) throw error;
  const quotes = (rows ?? []) as unknown as QuoteRowLike[];

  const vendorIds = [...new Set(quotes.map((q) => q.vendor_id))];
  const vendors = new Map<string, VendorInfo>();
  if (vendorIds.length > 0) {
    const { data, error: vErr } = await supabase.from("vendors").select("id, company_name, verification_status").in("id", vendorIds);
    if (vErr) throw vErr;
    for (const v of data ?? []) vendors.set(v.id, { id: v.id, companyName: v.company_name, isDemo: v.verification_status === "demo" });
  }

  const { data: est, error: eErr } = await supabase.from("solar_estimates").select("capacity_kw").eq("request_id", request.id).maybeSingle();
  if (eErr) throw eErr;

  const context: RequestContext = {
    budget: request.budget,
    preferredCapacityKw: request.preferred_capacity_kw === null ? null : Number(request.preferred_capacity_kw),
    estimateCapacityKw: est ? Number(est.capacity_kw) : null,
  };
  return { quotes, vendors, context };
}

export function vendorOf(vendors: Map<string, VendorInfo>, vendorId: string): VendorInfo {
  return vendors.get(vendorId) ?? { id: vendorId, companyName: "Vendor", isDemo: false };
}
