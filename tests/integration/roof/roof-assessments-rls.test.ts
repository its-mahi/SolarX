// roof_assessments RLS (local Supabase).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { createRequestWithPhoto } from "./_setup";

let a: TestUser;
let b: TestUser;
let vendor: TestUser;
let consented: { id: string; path: string };
let unconsented: { id: string; path: string };

const row = (requestId: string, path: string, extra: Record<string, unknown> = {}) => ({
  request_id: requestId,
  status: "completed" as const,
  limitations: ["a", "b", "c"],
  prompt_version: "roof-analysis.v1",
  roof_photo_path: path,
  ...extra,
});

beforeAll(async () => {
  [a, b, vendor] = await Promise.all([
    createTestUser({ role: "household" }),
    createTestUser({ role: "household" }),
    createTestUser({ role: "vendor" }),
  ]);
  consented = await createRequestWithPhoto(a, { consent: true });
  unconsented = await createRequestWithPhoto(a, { consent: false });
});
afterAll(async () => {
  await adminClient().from("household_requests").delete().in("user_id", [a?.id, b?.id].filter(Boolean));
  for (const u of [a, b, vendor]) await deleteTestUser(u?.id);
});

describe("roof_assessments RLS", () => {
  it("owner can insert with consent and read; others and vendors see nothing", async () => {
    const ins = await a.client.from("roof_assessments").insert(row(consented.id, consented.path)).select().single();
    expect(ins.error).toBeNull();
    expect((await a.client.from("roof_assessments").select().eq("request_id", consented.id)).data).toHaveLength(1);
    expect((await b.client.from("roof_assessments").select().eq("request_id", consented.id)).data).toEqual([]);
    expect((await vendor.client.from("roof_assessments").select()).data).toEqual([]);
  });

  it("denies insert without consent, for non-owners and for vendors", async () => {
    expect((await a.client.from("roof_assessments").insert(row(unconsented.id, unconsented.path))).error).not.toBeNull();
    expect((await b.client.from("roof_assessments").insert(row(consented.id, consented.path))).error).not.toBeNull();
    expect((await vendor.client.from("roof_assessments").insert(row(consented.id, consented.path))).error).not.toBeNull();
  });

  it("is immutable for the owner (no update or delete)", async () => {
    const rows = (await a.client.from("roof_assessments").select().eq("request_id", consented.id)).data!;
    const upd = await a.client.from("roof_assessments").update({ model: "x" }).eq("id", rows[0].id).select();
    expect(upd.data ?? []).toEqual([]);
    await a.client.from("roof_assessments").delete().eq("id", rows[0].id);
    expect((await adminClient().from("roof_assessments").select().eq("id", rows[0].id)).data).toHaveLength(1);
  });

  it("enforces table constraints", async () => {
    const bad = [
      row(consented.id, consented.path, { site_survey_required: false }),
      row(consented.id, consented.path, { limitations: ["only one"] }),
      row(consented.id, consented.path, { status: "failed" }),
      row(consented.id, consented.path, { status: "failed", failure_reason: "bogus", limitations: [] }),
    ];
    for (const r of bad) expect((await adminClient().from("roof_assessments").insert(r)).error).not.toBeNull();
  });
});
