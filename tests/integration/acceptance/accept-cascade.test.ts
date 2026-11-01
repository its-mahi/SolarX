// POST /api/quotes/:id/accept — status cascade (specs/007 T008).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { adminClient } from "../../helpers/supabase";
import { acceptBody, createWorld, quoteStatus, seedRequest, type AcceptanceWorld } from "../../helpers/acceptance";

let w: AcceptanceWorld;
type Res = { acceptance: { quoteId: string; requestId: string; householdId: string }; quote: { status: string }; request: { status: string }; rejectedQuoteIds: string[] };
const accept = (id: string) => apiFetch<Res>(`/api/quotes/${id}/accept`, { method: "POST", token: w.household.accessToken, body: acceptBody });

beforeAll(async () => {
  w = await createWorld(3);
});
afterAll(async () => {
  await w.cleanup();
});

describe("accept cascade", () => {
  it("accepts A, rejects B, leaves withdrawn C, request accepted, one acceptance row", async () => {
    const { requestId, quoteIds } = await seedRequest(w, { status: "quoted", vendorIdx: [0, 1] });
    const { data: c } = await adminClient()
      .from("quotes")
      .insert({ request_id: requestId, vendor_id: w.vendorIds[2], price: 140000, capacity_kw: 3, installation_days: 10, status: "withdrawn" })
      .select("id")
      .single();
    const [a, b] = quoteIds;

    const res = await accept(a);
    expect(res.status).toBe(200);
    expect(res.json.data!.rejectedQuoteIds).toEqual([b]);
    expect(res.json.data!.quote.status).toBe("accepted");
    expect(res.json.data!.request.status).toBe("accepted");
    expect(await quoteStatus(a)).toBe("accepted");
    expect(await quoteStatus(b)).toBe("rejected");
    expect(await quoteStatus(c!.id)).toBe("withdrawn");
    const { data: req } = await adminClient().from("household_requests").select("status").eq("id", requestId).single();
    expect(req!.status).toBe("accepted");
    const { data: rows } = await adminClient().from("quote_acceptances").select("*").eq("request_id", requestId);
    expect(rows).toHaveLength(1);
    expect(rows![0]).toMatchObject({ quote_id: a, request_id: requestId, household_id: w.household.id });

    // vendors see the new statuses through GET /api/quotes/mine
    const mine = await apiFetch<{ items: { id: string; status: string }[] }>("/api/quotes/mine", { token: w.vendors[0].accessToken });
    expect(mine.json.data!.items.find((q) => q.id === a)?.status).toBe("accepted");
    const mine1 = await apiFetch<{ items: { id: string; status: string }[] }>("/api/quotes/mine", { token: w.vendors[1].accessToken });
    expect(mine1.json.data!.items.find((q) => q.id === b)?.status).toBe("rejected");
  });

  it("accepts from an open request (quote inserted by fixture)", async () => {
    const { requestId, quoteIds } = await seedRequest(w, { status: "open", vendorIdx: [0] });
    const res = await accept(quoteIds[0]);
    expect(res.status).toBe(200);
    expect(res.json.data!.rejectedQuoteIds).toEqual([]);
    const { data: req } = await adminClient().from("household_requests").select("status").eq("id", requestId).single();
    expect(req!.status).toBe("accepted");
  });
});
