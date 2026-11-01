// Server-side identity, role and origin checks (constitution IV, contracts/shared-conventions.md).
// Every Route Handler calls requireUser/requireRole; role layouts call requirePageRole.
import "server-only";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { homePathForRole } from "@/lib/auth/redirects";
import { createServerSupabase, type AuthVia, type ServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { Role } from "@/lib/validation/enums";
import { ApiError } from "./errors";
import { logEvent } from "./log";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type VendorRow = Database["public"]["Tables"]["vendors"]["Row"];

export type Profile = Omit<ProfileRow, "role"> & { role: Role };
export type Vendor = Omit<VendorRow, "verification_status"> & { verification_status: "unverified" | "demo" };

export type AuthContext = {
  user: { id: string; email: string };
  profile: Profile;
  supabase: ServerSupabase;
  authVia: AuthVia;
};

type SupabaseFactory = typeof createServerSupabase;
let supabaseFactory: SupabaseFactory = createServerSupabase;

/** Test seam: replace the client factory (unit tests only). */
export function __setSupabaseFactoryForTests(factory: SupabaseFactory | null) {
  supabaseFactory = factory ?? createServerSupabase;
}

async function loadIdentity(request?: Request): Promise<AuthContext | null> {
  const { supabase, authVia, accessToken } = await supabaseFactory(request);
  const { data, error } = accessToken
    ? await supabase.auth.getUser(accessToken)
    : await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, phone, role, is_demo, created_at, updated_at")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile) return null;

  return {
    user: { id: data.user.id, email: data.user.email ?? "" },
    profile: profile as Profile,
    supabase,
    authVia,
  };
}

/** Signed-in user with a profile, or ApiError(UNAUTHENTICATED). */
export async function requireUser(request: Request): Promise<AuthContext> {
  const ctx = await loadIdentity(request);
  if (!ctx) {
    logEvent("auth.unauthenticated", { reason: "no_session_or_profile" });
    throw new ApiError("UNAUTHENTICATED", "Please sign in to continue.");
  }
  return ctx;
}

export async function requireRole(request: Request, role: "household"): Promise<AuthContext>;
export async function requireRole(request: Request, role: "vendor"): Promise<AuthContext & { vendor: Vendor }>;
export async function requireRole(request: Request, role: Role): Promise<AuthContext & { vendor?: Vendor }> {
  const ctx = await requireUser(request);
  if (ctx.profile.role !== role) {
    logEvent("auth.forbidden", { userId: ctx.user.id, role: ctx.profile.role, reason: `requires_${role}` });
    throw new ApiError("FORBIDDEN", "This action is not available for your account type.");
  }
  if (role === "vendor") {
    const { data: vendor } = await ctx.supabase.from("vendors").select("*").eq("user_id", ctx.user.id).maybeSingle();
    if (!vendor) {
      logEvent("auth.forbidden", { userId: ctx.user.id, role, reason: "vendor_profile_missing" });
      throw new ApiError("FORBIDDEN", "Your vendor profile is missing.");
    }
    return { ...ctx, vendor: vendor as Vendor };
  }
  return ctx;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function allowedOrigins(request: Request): Set<string> {
  const origins = new Set<string>([new URL(request.url).origin]);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
    origins.add(`${proto}://${host}`);
  }
  return origins;
}

/** Cookie-authenticated mutations must come from our own origin (CSRF, research R-08). */
export function assertSameOrigin(request: Request, authVia: AuthVia): void {
  if (authVia === "bearer" || !MUTATING.has(request.method.toUpperCase())) return;
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins(request).has(origin)) {
    logEvent("auth.forbidden", { reason: "cross_site_request" });
    throw new ApiError("FORBIDDEN", "This request was blocked for your security.");
  }
}

/**
 * For server pages/layouts: the signed-in profile (+ vendor row), or null.
 * Reading cookies makes the calling route dynamic; Next.js internal errors are re-thrown so
 * pages that depend on the session are never prerendered at build time.
 */
export async function getOptionalSession(): Promise<{ profile: Profile; email: string; vendor: Vendor | null } | null> {
  await cookies();
  try {
    const ctx = await loadIdentity();
    if (!ctx) return null;
    let vendor: Vendor | null = null;
    if (ctx.profile.role === "vendor") {
      const { data } = await ctx.supabase.from("vendors").select("*").eq("user_id", ctx.user.id).maybeSingle();
      vendor = (data as Vendor | null) ?? null;
    }
    return { profile: ctx.profile, email: ctx.user.email, vendor };
  } catch (err) {
    unstable_rethrow(err);
    logEvent("auth.session_lookup_failed", { reason: err instanceof Error ? err.name : typeof err });
    return null;
  }
}

/** Role layouts: anonymous → /login, wrong role → own home. Returns the profile. */
export async function requirePageRole(role: Role, nextPath?: string) {
  const session = await getOptionalSession();
  if (!session) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  }
  if (session.profile.role !== role) {
    redirect(homePathForRole(session.profile.role));
  }
  return session;
}

/** Any signed-in user (e.g. /account); anonymous → /login. */
export async function requirePageUser(nextPath?: string) {
  const session = await getOptionalSession();
  if (!session) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  return session;
}

/** Login page: signed-in users go straight to their home. */
export async function redirectIfSignedIn(): Promise<void> {
  const session = await getOptionalSession();
  if (session) redirect(homePathForRole(session.profile.role));
}
