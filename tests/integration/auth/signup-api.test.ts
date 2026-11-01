// POST /api/auth/signup and data-layer bypass attempts. Needs supabase + `npm run dev`.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { adminClient, anonClient } from "../../helpers/supabase";
import { deleteTestUser } from "../../helpers/users";

const created: string[] = [];
const email = (tag: string) => `signup-${tag}-${randomUUID().slice(0, 8)}@example.com`;

afterAll(async () => {
  await Promise.all(created.map(deleteTestUser));
});

type SignUpData = { profile: { id: string; role: string; is_demo: boolean }; redirect_to: string };

describe("POST /api/auth/signup", () => {
  it("creates a household, sets a session cookie and redirects to /household", async () => {
    const res = await apiFetch<SignUpData>("/api/auth/signup", {
      body: { role: "household", name: "Asha Rao", email: email("h"), password: "solar-2026!" },
    });
    expect(res.status).toBe(201);
    expect(res.json.data?.redirect_to).toBe("/household");
    expect(res.json.data?.profile).toMatchObject({ role: "household", is_demo: false });
    expect(res.headers.getSetCookie().some((c) => c.startsWith("sb-"))).toBe(true);
    created.push(res.json.data!.profile.id);
  });

  it("creates a vendor with an unverified vendor row and default radius 25", async () => {
    const res = await apiFetch<SignUpData>("/api/auth/signup", {
      body: {
        role: "vendor",
        name: "Ravi Kumar",
        email: email("v"),
        password: "solar-2026!",
        company_name: "Ravi Solar Works",
        service_area: "Warangal, Telangana",
      },
    });
    expect(res.status).toBe(201);
    const id = res.json.data!.profile.id;
    created.push(id);
    const { data } = await adminClient().from("vendors").select("verification_status, service_radius_km").eq("user_id", id).single();
    expect(data).toEqual({ verification_status: "unverified", service_radius_km: 25 });
  });

  it("returns a neutral CONFLICT for a duplicate email", async () => {
    const address = email("dup");
    const first = await apiFetch<SignUpData>("/api/auth/signup", {
      body: { role: "household", name: "First", email: address, password: "solar-2026!" },
    });
    created.push(first.json.data!.profile.id);
    const second = await apiFetch("/api/auth/signup", {
      body: { role: "household", name: "Second", email: address, password: "solar-2026!" },
    });
    expect(second.status).toBe(409);
    expect(second.json.error?.code).toBe("CONFLICT");
    expect(second.json.error?.message).toMatch(/couldn't create an account/i);
  });

  it("returns field details for an invalid body", async () => {
    const res = await apiFetch("/api/auth/signup", {
      body: { role: "vendor", name: "", email: "not-an-email", password: "short" },
    });
    expect(res.status).toBe(400);
    const paths = res.json.error?.details.map((d) => d.path) ?? [];
    expect(paths).toEqual(expect.arrayContaining(["name", "email", "password", "company_name", "service_area"]));
  });
});

describe("direct identity-service bypass attempts (anon key)", () => {
  it("rejects metadata role 'admin'", async () => {
    const { data, error } = await anonClient().auth.signUp({
      email: email("admin"),
      password: "solar-2026!",
      options: { data: { role: "admin", name: "Mallory" } },
    });
    if (data.user) created.push(data.user.id);
    expect(error).not.toBeNull();
  });

  it("rejects a vendor without company_name", async () => {
    const { data, error } = await anonClient().auth.signUp({
      email: email("nocompany"),
      password: "solar-2026!",
      options: { data: { role: "vendor", name: "No Co", service_area: "Hyderabad" } },
    });
    if (data.user) created.push(data.user.id);
    expect(error).not.toBeNull();
  });

  it("ignores metadata is_demo: true", async () => {
    const { data, error } = await anonClient().auth.signUp({
      email: email("isdemo"),
      password: "solar-2026!",
      options: { data: { role: "household", name: "Eve", is_demo: true } },
    });
    expect(error).toBeNull();
    created.push(data.user!.id);
    const { data: profile } = await adminClient().from("profiles").select("is_demo").eq("id", data.user!.id).single();
    expect(profile?.is_demo).toBe(false);
  });
});
