// Direct Supabase clients for integration tests (requires `npx supabase start` + `npm run db:reset`).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env.local and run \`npx supabase start\`.`);
  return value;
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;

export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(required("NEXT_PUBLIC_SUPABASE_URL"), required("NEXT_PUBLIC_SUPABASE_ANON_KEY"), noSession);
}

export function adminClient(): SupabaseClient<Database> {
  return createClient<Database>(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), noSession);
}

/** Signs in with email + password; returns an RLS-bound client and the access token. */
export async function signInAs(email: string, password: string) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`signInAs(${email}) failed: ${error?.message ?? "no session"}`);
  return { client, accessToken: data.session.access_token, userId: data.user.id };
}

export const DEMO_PASSWORD = () => required("DEMO_ACCOUNT_PASSWORD");
