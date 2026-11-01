// POST /api/auth/demo — one-click sign-in as a fictional demo account (contracts/auth-api.md).
import { assertSameOrigin } from "@/lib/api/auth-guard";
import { ApiError } from "@/lib/api/errors";
import { logEvent } from "@/lib/api/log";
import { ok, parseJsonBody, withApiHandler } from "@/lib/api/respond";
import { DEMO_ACCOUNT_EMAILS } from "@/lib/auth/demo-accounts";
import { homePathForRole } from "@/lib/auth/redirects";
import { demoAccountsEnabled, serverEnv } from "@/lib/env.server";
import { createServerSupabase } from "@/lib/supabase/server";
import { demoSignInSchema } from "@/lib/validation/auth";
import type { Role } from "@/lib/validation/enums";

const UNAVAILABLE = "Demo account is unavailable right now. Please try again or sign in.";

export const POST = withApiHandler(async (request) => {
  if (!demoAccountsEnabled()) throw new ApiError("NOT_FOUND", "Not found.");
  // Demo sign-in always sets session cookies, so the origin check always applies.
  assertSameOrigin(request, "cookie");

  const { account } = await parseJsonBody(request, demoSignInSchema);
  const password = serverEnv().DEMO_ACCOUNT_PASSWORD;
  if (!password) {
    logEvent("auth.demo_signin_failed", { demoKey: account, reason: "password_not_configured" });
    throw new ApiError("INTERNAL", UNAVAILABLE);
  }

  const { supabase } = await createServerSupabase();
  await supabase.auth.signOut({ scope: "local" });

  const { data, error } = await supabase.auth.signInWithPassword({ email: DEMO_ACCOUNT_EMAILS[account], password });
  if (error || !data.user) {
    logEvent("auth.demo_signin_failed", { demoKey: account, reason: error?.code ?? "no_user" });
    throw new ApiError("INTERNAL", UNAVAILABLE);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, role, is_demo")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile) {
    logEvent("auth.demo_signin_failed", { demoKey: account, reason: "profile_missing" });
    throw new ApiError("INTERNAL", UNAVAILABLE);
  }

  logEvent("auth.demo_signin", { demoKey: account, userId: profile.id });
  return ok({ profile, redirect_to: homePathForRole(profile.role as Role) });
});
