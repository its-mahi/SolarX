// POST /api/auth/demo (contracts/auth-api.md). Needs: supabase start, db:reset, npm run dev
// with DEMO_ACCOUNTS_ENABLED=true. The "disabled" case runs only when DEMO_DISABLED_BASE_URL
// points at a second server started with DEMO_ACCOUNTS_ENABLED=false.
import { describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";

const cases = [
  { account: "household", name: "Sharma Residence", role: "household", redirect: "/household" },
  { account: "sunrise-energy", name: "SunRise Energy", role: "vendor", redirect: "/vendor" },
  { account: "greenvolt-solar", name: "GreenVolt Solar", role: "vendor", redirect: "/vendor" },
  { account: "solartech-solutions", name: "SolarTech Solutions", role: "vendor", redirect: "/vendor" },
] as const;

type DemoData = { profile: { id: string; name: string; role: string; is_demo: boolean }; redirect_to: string };

describe("POST /api/auth/demo", () => {
  it.each(cases)("signs in as $account", async ({ account, name, role, redirect }) => {
    const res = await apiFetch<DemoData>("/api/auth/demo", { body: { account } });
    expect(res.status).toBe(200);
    expect(res.json.data?.profile).toMatchObject({ name, role, is_demo: true });
    expect(res.json.data?.redirect_to).toBe(redirect);
    expect(res.headers.getSetCookie().some((c) => c.startsWith("sb-"))).toBe(true);
    const password = process.env.DEMO_ACCOUNT_PASSWORD;
    if (password) expect(res.text).not.toContain(password);
  });

  it("rejects an unknown account key with VALIDATION_FAILED", async () => {
    const res = await apiFetch("/api/auth/demo", { body: { account: "admin" } });
    expect(res.status).toBe(400);
    expect(res.json.error?.code).toBe("VALIDATION_FAILED");
  });

  it("rejects a cross-site request with FORBIDDEN", async () => {
    const res = await apiFetch("/api/auth/demo", { body: { account: "household" }, origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(res.json.error?.code).toBe("FORBIDDEN");
  });

  it.skipIf(!process.env.DEMO_DISABLED_BASE_URL)("returns NOT_FOUND when demo access is disabled", async () => {
    const base = process.env.DEMO_DISABLED_BASE_URL!;
    const res = await fetch(`${base}/api/auth/demo`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ account: "household" }),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });
});
