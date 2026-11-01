// Seeds the 004 discovery fixtures (tests/fixtures/discovery-requests.ts) through the admin client.
import { randomUUID } from "node:crypto";
import { DISCOVERY_FIXTURES, HOUSEHOLD_NAME, HOUSEHOLD_PHONE, VENDOR_BASE } from "../fixtures/discovery-requests";
import { adminClient } from "./supabase";
import { createTestUser, deleteTestUser, type TestUser } from "./users";

export type DiscoveryWorld = {
  household: TestUser;
  vendor: TestUser;
  vendorNoBase: TestUser;
  ids: Record<string, string>;
  photoPath: string;
};

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);

export async function setupDiscoveryWorld(): Promise<DiscoveryWorld> {
  const admin = adminClient();
  const [household, vendor, vendorNoBase] = await Promise.all([
    createTestUser({ role: "household", name: HOUSEHOLD_NAME }),
    createTestUser({ role: "vendor", vendor: { ...VENDOR_BASE, service_area: "Hyderabad West" } }),
    createTestUser({ role: "vendor" }),
  ]);
  await admin.from("profiles").update({ phone: HOUSEHOLD_PHONE }).eq("id", household.id);

  const ids: Record<string, string> = {};
  let photoPath = "";
  for (const f of DISCOVERY_FIXTURES) {
    const id = randomUUID();
    ids[f.key] = id;
    const path = `${household.id}/${id}/a.jpg`;
    if (f.key === "kondapur") {
      photoPath = path;
      const up = await admin.storage.from("roof-photos").upload(path, jpeg, { contentType: "image/jpeg" });
      if (up.error) throw new Error(`fixture upload failed: ${up.error.message}`);
    }
    const { error } = await admin.from("household_requests").insert({
      id, user_id: household.id, status: f.status, address_text: f.address_text, locality: f.locality,
      latitude: f.latitude, longitude: f.longitude, monthly_units: f.monthly_units, monthly_bill: f.monthly_bill,
      budget: f.budget, preferred_capacity_kw: f.preferred_capacity_kw, roof_photo_path: path,
    });
    if (error) throw new Error(`fixture insert failed: ${error.message}`);
  }
  return { household, vendor, vendorNoBase, ids, photoPath };
}

export async function teardownDiscoveryWorld(w: DiscoveryWorld | undefined) {
  if (!w) return;
  const admin = adminClient();
  await admin.storage.from("roof-photos").remove([w.photoPath]);
  await admin.from("household_requests").delete().eq("user_id", w.household.id);
  for (const u of [w.household, w.vendor, w.vendorNoBase]) await deleteTestUser(u.id);
}
