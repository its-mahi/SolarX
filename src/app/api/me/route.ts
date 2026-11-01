// GET /api/me and PATCH /api/me — the caller's own profile (contracts/me-api.md).
import { assertSameOrigin, requireUser, type AuthContext } from "@/lib/api/auth-guard";
import { ApiError } from "@/lib/api/errors";
import { ok, parseJsonBody, withApiHandler } from "@/lib/api/respond";
import { homePathForRole } from "@/lib/auth/redirects";
import type { Database } from "@/lib/supabase/database.types";
import { profileUpdateSchema, vendorProfileUpdateSchema } from "@/lib/validation/profile";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type VendorUpdate = Database["public"]["Tables"]["vendors"]["Update"];

const VENDOR_COLUMNS = "id, company_name, service_area, latitude, longitude, service_radius_km, verification_status";
const NO_STORE = { headers: { "Cache-Control": "no-store" } };

async function buildMe(ctx: AuthContext) {
  const { profile, user, supabase } = ctx;
  let vendor = null;
  if (profile.role === "vendor") {
    const { data, error } = await supabase.from("vendors").select(VENDOR_COLUMNS).eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    vendor = data;
  }
  return {
    profile: {
      id: profile.id,
      email: user.email,
      name: profile.name,
      phone: profile.phone,
      role: profile.role,
      is_demo: profile.is_demo,
    },
    vendor,
    home_path: homePathForRole(profile.role),
  };
}

export const GET = withApiHandler(async (request) => {
  const ctx = await requireUser(request);
  return ok(await buildMe(ctx), NO_STORE);
});

const PROFILE_KEYS = ["name", "phone"] as const;

export const PATCH = withApiHandler(async (request) => {
  const ctx = await requireUser(request);
  assertSameOrigin(request, ctx.authVia);

  const input =
    ctx.profile.role === "vendor"
      ? await parseJsonBody(request, vendorProfileUpdateSchema)
      : await parseJsonBody(request, profileUpdateSchema);

  const profilePatch: Record<string, unknown> = {};
  const vendorPatch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if ((PROFILE_KEYS as readonly string[]).includes(key)) profilePatch[key] = value;
    else vendorPatch[key] = value;
  }
  // Keys come from the strict Zod schemas above, so they are a subset of the table columns.

  if (Object.keys(profilePatch).length > 0) {
    const { data, error } = await ctx.supabase.from("profiles").update(profilePatch as ProfileUpdate).eq("id", ctx.user.id).select("id");
    if (error) throw error.code === "42501" ? new ApiError("FORBIDDEN", "That change is not allowed.") : error;
    if (!data?.length) throw new ApiError("FORBIDDEN", "That change is not allowed.");
  }
  if (Object.keys(vendorPatch).length > 0) {
    const { data, error } = await ctx.supabase.from("vendors").update(vendorPatch as VendorUpdate).eq("user_id", ctx.user.id).select("id");
    if (error) throw error.code === "42501" ? new ApiError("FORBIDDEN", "That change is not allowed.") : error;
    if (!data?.length) throw new ApiError("FORBIDDEN", "That change is not allowed.");
  }

  const fresh = await requireUser(request);
  return ok(await buildMe(fresh), NO_STORE);
});
