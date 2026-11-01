import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: vi.fn() }));

import { __setSupabaseFactoryForTests, assertSameOrigin, requireRole, requireUser } from "@/lib/api/auth-guard";
import { ApiError } from "@/lib/api/errors";

type Row = Record<string, unknown> | null;

function stubFactory(opts: { user?: { id: string; email: string } | null; profile?: Row; vendor?: Row }) {
  const tables: Record<string, Row> = { profiles: opts.profile ?? null, vendors: opts.vendor ?? null };
  const client = {
    auth: {
      getUser: async () =>
        opts.user ? { data: { user: opts.user }, error: null } : { data: { user: null }, error: { message: "no session" } },
    },
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: tables[table], error: null }),
      };
      return chain;
    },
  };
  return (async () => ({ supabase: client, authVia: "cookie", accessToken: null })) as never;
}

const req = (init?: RequestInit) => new Request("http://localhost:3000/api/x", init);

afterEach(() => {
  __setSupabaseFactoryForTests(null);
  vi.restoreAllMocks();
});

describe("requireUser / requireRole", () => {
  it("throws UNAUTHENTICATED when there is no session", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    __setSupabaseFactoryForTests(stubFactory({ user: null }));
    await expect(requireUser(req())).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("throws UNAUTHENTICATED when the profile row is missing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    __setSupabaseFactoryForTests(stubFactory({ user: { id: "u1", email: "a@example.com" }, profile: null }));
    await expect(requireUser(req())).rejects.toBeInstanceOf(ApiError);
  });

  it("throws FORBIDDEN when a household calls a vendor-only action", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    __setSupabaseFactoryForTests(
      stubFactory({ user: { id: "u1", email: "a@example.com" }, profile: { id: "u1", role: "household", name: "A", is_demo: false } }),
    );
    await expect(requireRole(req(), "vendor")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns the vendor row for vendors", async () => {
    __setSupabaseFactoryForTests(
      stubFactory({
        user: { id: "v1", email: "v@example.com" },
        profile: { id: "v1", role: "vendor", name: "V", is_demo: false },
        vendor: { id: "vend1", user_id: "v1", company_name: "V Solar" },
      }),
    );
    const ctx = await requireRole(req(), "vendor");
    expect(ctx.vendor.company_name).toBe("V Solar");
  });
});

describe("assertSameOrigin", () => {
  it("rejects a cookie POST from a foreign origin", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = req({ method: "POST", headers: { origin: "https://evil.example" } });
    expect(() => assertSameOrigin(r, "cookie")).toThrow(ApiError);
  });

  it("rejects a cookie POST with no Origin header", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertSameOrigin(req({ method: "PATCH" }), "cookie")).toThrow(ApiError);
  });

  it("accepts a same-origin cookie POST", () => {
    const r = req({ method: "POST", headers: { origin: "http://localhost:3000" } });
    expect(() => assertSameOrigin(r, "cookie")).not.toThrow();
  });

  it("skips the check for bearer-token requests and safe methods", () => {
    expect(() => assertSameOrigin(req({ method: "POST", headers: { origin: "https://evil.example" } }), "bearer")).not.toThrow();
    expect(() => assertSameOrigin(req({ method: "GET" }), "cookie")).not.toThrow();
  });
});
