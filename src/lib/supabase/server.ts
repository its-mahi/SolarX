// Per-request Supabase client bound to the caller's JWT (anon key), so RLS applies.
// Uses `Authorization: Bearer <token>` when present (tests, tools), otherwise session cookies.
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

export type AuthVia = "cookie" | "bearer";

export function bearerToken(request?: Request): string | null {
  const header = request?.headers.get("authorization");
  const match = header ? /^Bearer\s+(.+)$/i.exec(header) : null;
  return match ? match[1].trim() : null;
}

export async function createServerSupabase(request?: Request) {
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey } = publicEnv();
  const token = bearerToken(request);

  if (token) {
    const client = createClient<Database>(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return { supabase: client, authVia: "bearer" as AuthVia, accessToken: token };
  }

  const cookieStore = await cookies();
  const client = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only; proxy.ts refreshes them.
        }
      },
    },
  });
  return { supabase: client, authVia: "cookie" as AuthVia, accessToken: null };
}

export type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>["supabase"];
