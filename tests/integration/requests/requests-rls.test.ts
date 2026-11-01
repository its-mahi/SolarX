// household_requests RLS, guard triggers and roof-photos storage policies (002 data-model.md).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";

let a: TestUser;
let b: TestUser;
let vendor: TestUser;
let draftId: string;
let openId: string;
const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });

const complete = (user: TestUser, id: string) => ({
  latitude: 17.41, longitude: 78.44, address_text: "Plot 12, Road 3", locality: "Banjara Hills",
  monthly_units: 250, budget: 150000, roof_photo_path: `${user.id}/${id}/a.jpg`,
});

beforeAll(async () => {
  [a, b, vendor] = await Promise.all([
    createTestUser({ role: "household" }),
    createTestUser({ role: "household" }),
    createTestUser({ role: "vendor" }),
  ]);
  const d = await a.client.from("household_requests").insert({ user_id: a.id }).select().single();
  expect(d.error).toBeNull();
  draftId = d.data!.id;

  // A published request prepared through the owner's own path.
  const o = await a.client.from("household_requests").insert({ user_id: a.id }).select().single();
  openId = o.data!.id;
  const up = await a.client.from("household_requests").update(complete(a, openId)).eq("id", openId);
  expect(up.error).toBeNull();
  const pub = await a.client.from("household_requests").update({ status: "open", ai_consent: true }).eq("id", openId);
  expect(pub.error).toBeNull();
});

afterAll(async () => {
  await adminClient().from("household_requests").delete().in("user_id", [a?.id, b?.id].filter(Boolean));
  for (const u of [a, b, vendor]) await deleteTestUser(u?.id);
});

describe("household_requests RLS", () => {
  it("hides rows from other users and anonymous", async () => {
    expect((await b.client.from("household_requests").select().eq("id", draftId)).data).toEqual([]);
    expect((await anonClient().from("household_requests").select()).data ?? []).toEqual([]);
    expect((await vendor.client.from("household_requests").select()).data).toEqual([]);
  });

  it("denies other users updates", async () => {
    const r = await b.client.from("household_requests").update({ locality: "Hacked" }).eq("id", draftId).select();
    expect(r.data ?? []).toEqual([]);
  });

  it("denies bad inserts", async () => {
    expect((await a.client.from("household_requests").insert({ user_id: a.id, status: "open" })).error).not.toBeNull();
    expect((await a.client.from("household_requests").insert({ user_id: a.id, roof_photo_path: "x" })).error).not.toBeNull();
    expect((await a.client.from("household_requests").insert({ user_id: b.id })).error).not.toBeNull();
    expect((await vendor.client.from("household_requests").insert({ user_id: vendor.id })).error).not.toBeNull();
  });

  it("enforces the status machine and immutable columns", async () => {
    expect((await a.client.from("household_requests").update({ status: "quoted" }).eq("id", draftId)).error).not.toBeNull();
    expect((await a.client.from("household_requests").update({ status: "draft" }).eq("id", openId)).error).not.toBeNull();
    expect((await a.client.from("household_requests").update({ user_id: b.id }).eq("id", draftId)).error).not.toBeNull();
  });

  it("rejects a photo path outside the request folder", async () => {
    const r = await a.client.from("household_requests").update({ roof_photo_path: `${a.id}/other/x.jpg` }).eq("id", draftId);
    expect(r.error).not.toBeNull();
  });

  it("refuses publishing an incomplete draft", async () => {
    const r = await a.client.from("household_requests").update({ status: "open" }).eq("id", draftId);
    expect(r.error).not.toBeNull();
  });

  it("makes published requests read-only except consent withdrawal", async () => {
    expect((await a.client.from("household_requests").update({ monthly_units: 300 }).eq("id", openId)).error).not.toBeNull();
    expect((await a.client.from("household_requests").update({ ai_consent: false }).eq("id", openId)).error).toBeNull();
    expect((await a.client.from("household_requests").update({ ai_consent: true }).eq("id", openId)).error).not.toBeNull();
  });
});

describe("roof-photos storage", () => {
  it("lets the owner upload to a draft folder and read it back", async () => {
    const path = `${a.id}/${draftId}/a.jpg`;
    expect((await a.client.storage.from("roof-photos").upload(path, jpeg, { contentType: "image/jpeg" })).error).toBeNull();
    expect((await a.client.storage.from("roof-photos").createSignedUrl(path, 60)).error).toBeNull();
    expect((await b.client.storage.from("roof-photos").createSignedUrl(path, 60)).data?.signedUrl).toBeUndefined();
    expect((await b.client.storage.from("roof-photos").download(path)).error).not.toBeNull();
    expect((await anonClient().storage.from("roof-photos").download(path)).error).not.toBeNull();
    expect((await a.client.storage.from("roof-photos").remove([path])).error).toBeNull();
  });

  it("denies uploads into another user's folder and into published requests", async () => {
    const other = await b.client.storage.from("roof-photos").upload(`${a.id}/${draftId}/b.jpg`, jpeg, { contentType: "image/jpeg" });
    expect(other.error).not.toBeNull();
    const published = await a.client.storage.from("roof-photos").upload(`${a.id}/${openId}/c.jpg`, jpeg, { contentType: "image/jpeg" });
    expect(published.error).not.toBeNull();
  });
});
