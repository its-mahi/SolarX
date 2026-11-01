// Builds a household with a request that has the three fictional demo quotes (specs/006 fixtures), plus
// an outsider household and a vendor. Service role inserts bypass submit_quote so ids and vendors are controlled.
import { demoRows } from "../fixtures/quotes/demo-quotes";
import { createRequestWithStatus } from "./quotes";
import { adminClient } from "./supabase";
import { createTestUser, deleteTestUser, type TestUser } from "./users";

export type ComparisonWorld = {
  owner: TestUser;
  other: TestUser;
  vendors: TestUser[];
  requestId: string;
  quoteIds: string[]; // SunRise, GreenVolt, SolarTech
};

export async function setupComparisonWorld(): Promise<ComparisonWorld> {
  const admin = adminClient();
  const [owner, other, v1, v2, v3] = await Promise.all([
    createTestUser({ role: "household" }),
    createTestUser({ role: "household" }),
    createTestUser({ role: "vendor", vendor: { company_name: "SunRise Test" } }),
    createTestUser({ role: "vendor", vendor: { company_name: "GreenVolt Test" } }),
    createTestUser({ role: "vendor", vendor: { company_name: "SolarTech Test" } }),
  ]);
  const requestId = await createRequestWithStatus(owner.id, "quoted");
  const vendors = [v1, v2, v3];
  const quoteIds: string[] = [];
  const rows = demoRows();
  for (let i = 0; i < rows.length; i++) {
    const { data: vendor } = await admin.from("vendors").select("id").eq("user_id", vendors[i].id).single();
    const r = rows[i];
    const { data, error } = await admin
      .from("quotes")
      .insert({
        request_id: requestId,
        vendor_id: vendor!.id,
        price: r.price,
        capacity_kw: Number(r.capacity_kw),
        panel_details: r.panel_details as never,
        inverter_details: r.inverter_details as never,
        warranty_details: r.warranty_details as never,
        installation_days: r.installation_days!,
        earthing_included: r.earthing_included,
        documentation_included: r.documentation_included,
        other_inclusions: r.other_inclusions as never,
        exclusions: r.exclusions,
        vendor_notes: r.vendor_notes,
        created_at: `2026-11-01T09:${10 + i * 10}:00Z`,
      })
      .select("id")
      .single();
    if (error) throw new Error(`quote fixture insert failed: ${error.message}`);
    quoteIds.push(data!.id);
  }
  return { owner, other, vendors, requestId, quoteIds };
}

export async function teardownComparisonWorld(w: ComparisonWorld | undefined) {
  if (!w) return;
  await adminClient().from("household_requests").delete().eq("user_id", w.owner.id);
  for (const u of [w.owner, w.other, ...w.vendors]) await deleteTestUser(u.id);
}
