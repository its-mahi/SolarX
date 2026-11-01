import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { adminClient } from "../../helpers/supabase";
import { createTestUser, deleteTestUser, type TestUser } from "../../helpers/users";
import { completeDraft, createDraftViaApi, publishViaApi, uploadPhotoViaApi } from "../../helpers/requests";
import { jpegWithGps, oversizedJpeg, roofJpeg, roofPng, roofWebp, textAsJpeg, truncatedJpeg } from "../../helpers/images";

let user: TestUser;

beforeAll(async () => {
  user = await createTestUser({ role: "household" });
});
afterAll(async () => {
  const admin = adminClient();
  await admin.from("household_requests").delete().eq("user_id", user.id);
  const { data } = await admin.storage.from("roof-photos").list(user.id);
  for (const folder of data ?? []) {
    const { data: files } = await admin.storage.from("roof-photos").list(`${user.id}/${folder.name}`);
    await admin.storage.from("roof-photos").remove((files ?? []).map((f) => `${user.id}/${folder.name}/${f.name}`));
  }
  await deleteTestUser(user?.id);
});

async function storedKey(id: string) {
  const { data } = await adminClient().from("household_requests").select("roof_photo_path").eq("id", id).single();
  return data!.roof_photo_path!;
}

describe("POST /api/requests/:id/photo", () => {
  it("accepts JPEG, PNG and WebP", async () => {
    const draft = await createDraftViaApi(user.accessToken);
    for (const [buf, type, name] of [
      [await roofJpeg(), "image/jpeg", "a.jpg"],
      [await roofPng(), "image/png", "a.png"],
      [await roofWebp(), "image/webp", "a.webp"],
    ] as const) {
      const res = await uploadPhotoViaApi(user.accessToken, draft.id, buf, type, name);
      expect(res.status, name).toBe(200);
      expect(res.json.data!.has_roof_photo).toBe(true);
      expect(res.json.data!.roof_photo_url).toBeTruthy();
    }
  });

  it("stores an object without GPS or device metadata", async () => {
    const draft = await createDraftViaApi(user.accessToken);
    const res = await uploadPhotoViaApi(user.accessToken, draft.id, await jpegWithGps());
    expect(res.status).toBe(200);
    const { data, error } = await adminClient().storage.from("roof-photos").download(await storedKey(draft.id));
    expect(error).toBeNull();
    const bytes = Buffer.from(await data!.arrayBuffer());
    expect((await sharp(bytes).metadata()).exif).toBeUndefined();
    expect(bytes.includes(Buffer.from("TestMake"))).toBe(false);
    expect(bytes.includes(Buffer.from("GPS"))).toBe(false);
  });

  it("replaces the previous photo and deletes the old object", async () => {
    const draft = await createDraftViaApi(user.accessToken);
    await uploadPhotoViaApi(user.accessToken, draft.id);
    const first = await storedKey(draft.id);
    await uploadPhotoViaApi(user.accessToken, draft.id, await roofPng(), "image/png", "b.png");
    const second = await storedKey(draft.id);
    expect(second).not.toBe(first);
    expect(second.startsWith(`${user.id}/${draft.id}/`)).toBe(true);
    const old = await adminClient().storage.from("roof-photos").download(first);
    expect(old.error).not.toBeNull();
  });

  it("refuses oversized, fake, truncated and missing files", async () => {
    const draft = await createDraftViaApi(user.accessToken);
    const big = await oversizedJpeg();
    expect(big.length).toBeGreaterThan(5 * 1024 * 1024);
    const tooLarge = await uploadPhotoViaApi(user.accessToken, draft.id, big);
    expect(tooLarge.status).toBe(413);
    expect(tooLarge.json.error!.code).toBe("PAYLOAD_TOO_LARGE");

    const fake = await uploadPhotoViaApi(user.accessToken, draft.id, textAsJpeg());
    expect(fake.status).toBe(400);
    expect(fake.json.error!.message).toBe("Upload a JPEG, PNG or WebP photo");

    const truncated = await uploadPhotoViaApi(user.accessToken, draft.id, await truncatedJpeg());
    expect(truncated.status).toBe(400);

    const none = await fetch(`${process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000"}/api/requests/${draft.id}/photo`, {
      method: "POST",
      headers: { authorization: `Bearer ${user.accessToken}` },
      body: new FormData(),
    });
    expect(none.status).toBe(400);

    const { data } = await adminClient().from("household_requests").select("roof_photo_path").eq("id", draft.id).single();
    expect(data!.roof_photo_path).toBeNull();
  });

  it("refuses an upload to a published request", async () => {
    const complete = await completeDraft(user.accessToken);
    expect((await publishViaApi(user.accessToken, complete.id)).status).toBe(200);
    const res = await uploadPhotoViaApi(user.accessToken, complete.id);
    expect(res.status).toBe(409);
    expect(res.json.error!.code).toBe("CONFLICT");
  });
});
