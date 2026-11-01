// Fixtures for acceptance tests: throw-away household, vendors, requests and quotes (service role).
import { adminClient } from "./supabase";
import { createTestUser, deleteTestUser, type TestUser } from "./users";
import { createRequestWithStatus } from "./quotes";

export type AcceptanceWorld = {
  household: TestUser;
  vendors: TestUser[];
  vendorIds: string[];
  requestIds: string[];
  cleanup: () => Promise<void>;
};

export async function createWorld(vendorCount = 3): Promise<AcceptanceWorld> {
  const household = await createTestUser({ role: "household" });
  const vendors = await Promise.all(Array.from({ length: vendorCount }, () => createTestUser({ role: "vendor" })));
  const { data } = await adminClient().from("vendors").select("id,user_id").in("user_id", vendors.map((v) => v.id));
  const vendorIds = vendors.map((v) => data!.find((d) => d.user_id === v.id)!.id);
  const requestIds: string[] = [];
  return {
    household,
    vendors,
    vendorIds,
    requestIds,
    async cleanup() {
      if (requestIds.length) await adminClient().from("household_requests").delete().in("id", requestIds);
      for (const u of [household, ...vendors]) await deleteTestUser(u?.id);
    },
  };
}

/** Inserts a request plus one submitted quote per listed vendor index; returns ids. */
export async function seedRequest(
  world: AcceptanceWorld,
  opts: { status?: "open" | "quoted" | "accepted" | "closed"; vendorIdx?: number[]; quoteStatus?: string } = {},
) {
  const requestId = await createRequestWithStatus(world.household.id, opts.status ?? "quoted");
  world.requestIds.push(requestId);
  const idxs = opts.vendorIdx ?? world.vendorIds.map((_, i) => i);
  const quoteIds: string[] = [];
  for (const i of idxs) {
    const { data, error } = await adminClient()
      .from("quotes")
      .insert({
        request_id: requestId,
        vendor_id: world.vendorIds[i],
        price: 150000 + i * 1000,
        capacity_kw: 3,
        installation_days: 14,
        status: opts.quoteStatus ?? "submitted",
      })
      .select("id")
      .single();
    if (error) throw new Error(`seed quote failed: ${error.message}`);
    quoteIds.push(data.id);
  }
  return { requestId, quoteIds };
}

export async function quoteStatus(id: string): Promise<string> {
  return (await adminClient().from("quotes").select("status").eq("id", id).single()).data!.status;
}

export async function acceptanceCount(requestId: string): Promise<number> {
  const { count } = await adminClient().from("quote_acceptances").select("id", { count: "exact", head: true }).eq("request_id", requestId);
  return count ?? 0;
}

export async function snapshot(requestId: string, quoteIds: string[]) {
  const { data: req } = await adminClient().from("household_requests").select("status").eq("id", requestId).single();
  const statuses = await Promise.all(quoteIds.map(quoteStatus));
  return { request: req!.status, quotes: statuses, acceptances: await acceptanceCount(requestId) };
}

export const acceptBody = { confirmed: true } as const;
