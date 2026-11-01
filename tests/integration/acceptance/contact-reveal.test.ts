// GET /api/quotes/:id/contact (specs/007 T022).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { adminClient } from "../../helpers/supabase";
import { acceptBody, createWorld, seedRequest, type AcceptanceWorld } from "../../helpers/acceptance";

let w: AcceptanceWorld;
let quoteIds: string[];
const contact = (token: string | undefined, id: string) => apiFetch<Record<string, unknown>>(`/api/quotes/${id}/contact`, { token });

beforeAll(async () => {
  w = await createWorld(3);
  ({ quoteIds } = await seedRequest(w, { status: "quoted" }));
  await adminClient().from("profiles").update({ phone: "+919876543210" }).eq("id", w.household.id);
});
afterAll(async () => {
  await w.cleanup();
});

describe("contact reveal", () => {
  it("is refused before acceptance with the exact message", async () => {
    const res = await contact(w.vendors[0].accessToken, quoteIds[0]);
    expect(res.status).toBe(403);
    expect(res.json.error!.code).toBe("FORBIDDEN");
    expect(res.json.error!.message).toBe("Contact details are shared only after the household accepts your quote.");
    expect(res.text).not.toContain("+919876543210");
  });

  it("reveals to the accepted vendor only", async () => {
    const acc = await apiFetch(`/api/quotes/${quoteIds[0]}/accept`, { method: "POST", token: w.household.accessToken, body: acceptBody });
    expect(acc.status).toBe(200);

    const ok = await contact(w.vendors[0].accessToken, quoteIds[0]);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(ok.json.data).toMatchObject({
      name: "Test household",
      phone: "+919876543210",
      addressText: "Plot 12, Road 3",
      latitude: 17.41,
      longitude: 78.44,
      locality: "Test Locality",
    });
    expect(ok.json.data!.acceptedAt).toBeTruthy();

    // rejected vendor: 403
    const rej = await contact(w.vendors[1].accessToken, quoteIds[1]);
    expect(rej.status).toBe(403);
    expect(rej.text).not.toContain("+919876543210");
    // vendor asking for another vendor's quote: 404
    expect((await contact(w.vendors[1].accessToken, quoteIds[0])).status).toBe(404);
    // household 403, anonymous 401, bad id 400
    expect((await contact(w.household.accessToken, quoteIds[0])).status).toBe(403);
    expect((await contact(undefined, quoteIds[0])).status).toBe(401);
    expect((await contact(w.vendors[0].accessToken, "nope")).status).toBe(400);
  });

  it("withdrawn quote's vendor gets 403; direct rpc by a non-accepted vendor returns no data", async () => {
    const { quoteIds: q2 } = await seedRequest(w, { status: "quoted", vendorIdx: [0, 1] });
    await adminClient().from("quotes").update({ status: "withdrawn" }).eq("id", q2[1]);
    expect((await contact(w.vendors[1].accessToken, q2[1])).status).toBe(403);
    const r = await w.vendors[1].client.rpc("accepted_household_contact", { p_quote_id: q2[1] });
    expect(r.error).not.toBeNull();
    expect(r.data ?? null).toBeNull();
  });
});
