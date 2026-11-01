// Throw-away users for integration tests, created through the admin API so handle_new_user() runs.
import { randomUUID } from "node:crypto";
import { adminClient, signInAs } from "./supabase";

export const TEST_PASSWORD = "test-password-123";

type VendorFields = {
  company_name?: string;
  service_area?: string;
  service_radius_km?: number;
  latitude?: number;
  longitude?: number;
};

export type TestUser = {
  id: string;
  email: string;
  password: string;
  accessToken: string;
  client: Awaited<ReturnType<typeof signInAs>>["client"];
};

export async function createTestUser(options: { role: "household" | "vendor"; name?: string; vendor?: VendorFields }): Promise<TestUser> {
  const email = `test-${options.role}-${randomUUID().slice(0, 8)}@example.com`;
  const metadata: Record<string, unknown> = { role: options.role, name: options.name ?? `Test ${options.role}` };
  if (options.role === "vendor") {
    Object.assign(metadata, { company_name: "Test Solar Co", service_area: "Hyderabad, Telangana", ...options.vendor });
  }

  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error || !data.user) throw new Error(`createTestUser failed: ${error?.message}`);

  const session = await signInAs(email, TEST_PASSWORD);
  return { id: data.user.id, email, password: TEST_PASSWORD, accessToken: session.accessToken, client: session.client };
}

export async function deleteTestUser(id: string | undefined): Promise<void> {
  if (!id) return;
  await adminClient().auth.admin.deleteUser(id);
}
