// POST /api/quotes/:id/accept — rules, authorization, validation (specs/007 T009).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";
import { adminClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { acceptBody, createWorld, seedRequest, snapshot, type AcceptanceWorld } from "../../helpers/acceptance";

let w: AcceptanceWorld;
let other: TestUser;
const accept = (token: string | undefined, id: string, body: unknown = acceptBody) =>
  apiFetch(`/api/quotes/${id}/accept`, { method: "POST", token, body });
const hh = () => w.household.accessToken;

beforeAll(async () => {
  w = await createWorld(3);
  other = await createTestUser({ role: "household" });
});
afterAll(async () => {
  await w.cleanup();
  await deleteTestUser(other?.id);
});

async function expectUnchanged(requestId: string, quoteIds: string[], run: () => Promise<{ status: number; text: string; json: { error?: { details?: unknown[]; code?: string } } }>) {
  const before = await snapshot(requestId, quoteIds);
  const res = await run();
  expect(await snapshot(requestId, quoteIds)).toEqual(before);
  expect(res.text).not.toMatch(/SM40\d|plpgsql|stack|at \w+ \(|select |SQLSTATE/i);
  return res;
}

describe("accept rules", () => {
  it("withdrawn quote -> 409 QUOTE_NOT_ACCEPTABLE", async () => {
    const { requestId, quoteIds } = await seedRequest(w, { status: "quoted", vendorIdx: [0, 1] });
    await adminClient().from("quotes").update({ status: "withdrawn" }).eq("id", quoteIds[0]);
    const res = await expectUnchanged(requestId, quoteIds, () => accept(hh(), quoteIds[0]));
    expect(res.status).toBe(409);
    expect(res.json.error!.code).toBe("CONFLICT");
    expect(res.json.error!.details).toEqual([{ path: "reason", message: "QUOTE_NOT_ACCEPTABLE", reason: "QUOTE_NOT_ACCEPTABLE" }]);
  });

  it("rejected quote on an open request -> 409 QUOTE_NOT_ACCEPTABLE", async () => {
    const { requestId, quoteIds } = await seedRequest(w, { status: "open", vendorIdx: [0, 1] });
    await adminClient().from("quotes").update({ status: "rejected" }).eq("id", quoteIds[0]);
    const res = await expectUnchanged(requestId, quoteIds, () => accept(hh(), quoteIds[0]));
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.json.error!.details)).toContain("QUOTE_NOT_ACCEPTABLE");
  });

  it("rejected quote after another acceptance, repeat accept, and closed request -> 409", async () => {
    const { requestId, quoteIds } = await seedRequest(w, { status: "quoted", vendorIdx: [0, 1] });
    expect((await accept(hh(), quoteIds[0])).status).toBe(200);
    const again = await expectUnchanged(requestId, quoteIds, () => accept(hh(), quoteIds[0]));
    expect(again.status).toBe(409);
    expect(JSON.stringify(again.json.error!.details)).toContain("ALREADY_ACCEPTED");
    const rej = await expectUnchanged(requestId, quoteIds, () => accept(hh(), quoteIds[1]));
    expect(rej.status).toBe(409);
    await adminClient().from("household_requests").update({ status: "closed" }).eq("id", requestId);
    const closed = await expectUnchanged(requestId, quoteIds, () => accept(hh(), quoteIds[1]));
    expect(closed.status).toBe(409);
  });

  it("non-owner household -> 404 (same as unknown quote); vendor -> 403; anonymous -> 401", async () => {
    const { requestId, quoteIds } = await seedRequest(w, { status: "quoted", vendorIdx: [0, 1] });
    const nonOwner = await expectUnchanged(requestId, quoteIds, () => accept(other.accessToken, quoteIds[0]));
    expect(nonOwner.status).toBe(404);
    const unknown = await accept(hh(), "22222222-2222-4222-8222-222222222222");
    expect(unknown.status).toBe(404);
    expect(nonOwner.json).toEqual(unknown.json);
    expect((await expectUnchanged(requestId, quoteIds, () => accept(w.vendors[0].accessToken, quoteIds[0]))).status).toBe(403);
    expect((await expectUnchanged(requestId, quoteIds, () => accept(undefined, quoteIds[0]))).status).toBe(401);
  });

  it("rejects bad bodies and ids with 400 and changes nothing", async () => {
    const { requestId, quoteIds } = await seedRequest(w, { status: "quoted", vendorIdx: [0] });
    for (const body of [{}, { confirmed: false }, { confirmed: true, extra: 1 }, { confirmed: "true" }]) {
      const res = await expectUnchanged(requestId, quoteIds, () => accept(hh(), quoteIds[0], body));
      expect(res.status).toBe(400);
    }
    expect((await accept(hh(), "not-a-uuid")).status).toBe(400);
  });

  it("direct rpc by a vendor JWT fails and changes nothing", async () => {
    const { requestId, quoteIds } = await seedRequest(w, { status: "quoted", vendorIdx: [0] });
    const before = await snapshot(requestId, quoteIds);
    const { error } = await w.vendors[0].client.rpc("accept_quote", { p_quote_id: quoteIds[0] });
    expect(error).not.toBeNull();
    expect(await snapshot(requestId, quoteIds)).toEqual(before);
  });
});
