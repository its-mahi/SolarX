// Demo seed (specs/005 T034): the three Sharma request quotes.
import { describe, expect, it } from "vitest";
import { adminClient } from "../../helpers/supabase";

const DEMO_REQUEST = "d0000000-0000-4000-8000-000000000201";

describe("005 demo quotes", () => {
  it("has the three vendors' submitted quotes with the intended strengths and gaps", async () => {
    const { data } = await adminClient()
      .from("quotes")
      .select("*, vendors(company_name)")
      .eq("request_id", DEMO_REQUEST)
      .eq("status", "submitted");
    const by = Object.fromEntries((data ?? []).map((q) => [(q.vendors as unknown as { company_name: string }).company_name, q]));
    expect(Object.keys(by).sort()).toEqual(["GreenVolt Solar", "SolarTech Solutions", "SunRise Energy"]);
    expect(data).toHaveLength(3);

    const prices = (data ?? []).map((q) => q.price);
    expect(by["GreenVolt Solar"].price).toBe(Math.min(...prices));
    expect(by["GreenVolt Solar"].earthing_included).toBeNull();
    const days = (data ?? []).map((q) => q.installation_days);
    expect(by["SolarTech Solutions"].installation_days).toBe(Math.min(...days));

    const sun = by["SunRise Energy"];
    expect(sun.earthing_included).toBe(true);
    expect(sun.documentation_included).toBe(true);
    expect(Object.values(sun.warranty_details as Record<string, unknown>).every((v) => v !== null)).toBe(true);
    expect(sun.price).toBe(165000);
  });

  it("moved the demo request out of open", async () => {
    const { data } = await adminClient().from("household_requests").select("status").eq("id", DEMO_REQUEST).single();
    expect(["quoted", "accepted"]).toContain(data!.status);
  });
});
