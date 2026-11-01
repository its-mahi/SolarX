// POST /api/auth/signup — create an account with a role and start a session (contracts/auth-api.md).
import { assertSameOrigin, getOptionalSession } from "@/lib/api/auth-guard";
import { ApiError } from "@/lib/api/errors";
import { logEvent } from "@/lib/api/log";
import { created, parseJsonBody, withApiHandler } from "@/lib/api/respond";
import { homePathForRole } from "@/lib/auth/redirects";
import { createServerSupabase } from "@/lib/supabase/server";
import { signUpSchema } from "@/lib/validation/auth";
import type { Role } from "@/lib/validation/enums";

const DUPLICATE_MESSAGE =
  "We couldn't create an account with these details. If you already have an account, please sign in.";

export const POST = withApiHandler(async (request) => {
  assertSameOrigin(request, "cookie");
  if (await getOptionalSession()) {
    throw new ApiError("CONFLICT", "You're already signed in. Sign out first to create another account.");
  }

  const input = await parseJsonBody(request, signUpSchema);
  const { email, password, ...rest } = input;
  const metadata: Record<string, unknown> = { role: rest.role, name: rest.name, phone: rest.phone };
  if (rest.role === "vendor") {
    Object.assign(metadata, {
      company_name: rest.company_name,
      service_area: rest.service_area,
      latitude: rest.latitude ?? null,
      longitude: rest.longitude ?? null,
      service_radius_km: rest.service_radius_km,
    });
  }

  const { supabase } = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });

  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists" || /already registered/i.test(error.message)) {
      logEvent("auth.signup_failed", { role: rest.role, reason: "duplicate" });
      throw new ApiError("CONFLICT", DUPLICATE_MESSAGE);
    }
    if (error.status === 500 || error.code === "unexpected_failure") {
      // handle_new_user() rejected the role or vendor fields.
      logEvent("auth.signup_failed", { role: rest.role, reason: "data_layer_rejected" });
      throw new ApiError("VALIDATION_FAILED", "Some details could not be saved. Check your entries and try again.");
    }
    logEvent("auth.signup_failed", { role: rest.role, reason: error.code ?? "unknown" });
    throw new ApiError("INTERNAL", "We couldn't create your account right now. Please try again.");
  }

  // With confirmations disabled a session is returned; an empty identities list means the email exists.
  if (!data.user || (data.user.identities && data.user.identities.length === 0)) {
    logEvent("auth.signup_failed", { role: rest.role, reason: "duplicate" });
    throw new ApiError("CONFLICT", DUPLICATE_MESSAGE);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, role, is_demo")
    .eq("id", data.user.id)
    .maybeSingle();

  logEvent("auth.signup", { userId: data.user.id, role: rest.role });
  return created({
    profile: profile ?? { id: data.user.id, name: rest.name, role: rest.role, is_demo: false },
    redirect_to: homePathForRole(rest.role as Role),
  });
});
