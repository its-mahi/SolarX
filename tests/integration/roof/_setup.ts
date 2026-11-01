// Shared fixtures for roof integration tests: users, a request with a photo, and a mock AI client.
import { readFileSync } from "node:fs";
import { createAiClient, setAiClientForTests } from "@/lib/ai/client";
import { createMockProvider, type MockStep } from "../../helpers/mock-ai-provider";
import { adminClient } from "../../helpers/supabase";
import type { TestUser } from "../../helpers/users";

export const jpegBytes = () => new Uint8Array(readFileSync("tests/fixtures/roof/clear-roof.jpg"));

export function installMock(steps: MockStep[]) {
  const mock = createMockProvider({ steps, model: "mock-model" });
  setAiClientForTests(
    createAiClient({ providers: [mock], config: { geminiModel: "mock-model" }, sleep: async () => {} }),
  );
  return mock;
}

export function bearerRequest(path: string, token: string | null, body?: unknown, method = body === undefined ? "GET" : "POST") {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request(`http://127.0.0.1:3000${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Creates an owner's request: draft -> photo uploaded -> published (open) with the given consent. */
export async function createRequestWithPhoto(
  user: TestUser,
  opts: { consent: boolean; bytes?: Uint8Array; publish?: boolean },
): Promise<{ id: string; path: string }> {
  const ins = await user.client.from("household_requests").insert({ user_id: user.id }).select().single();
  if (ins.error) throw ins.error;
  const id = ins.data.id;
  const path = `${user.id}/${id}/roof.jpg`;
  const up = await user.client.storage.from("roof-photos").upload(path, opts.bytes ?? jpegBytes(), { contentType: "image/jpeg" });
  if (up.error) throw up.error;
  const upd = await user.client.from("household_requests").update({
    latitude: 17.41, longitude: 78.44, address_text: "Plot 12, Road 3", locality: "Banjara Hills",
    monthly_units: 250, budget: 150000, roof_photo_path: path, ai_consent: opts.consent,
  }).eq("id", id);
  if (upd.error) throw upd.error;
  if (opts.publish !== false) {
    const pub = await user.client.from("household_requests").update({ status: "open" }).eq("id", id);
    if (pub.error) throw pub.error;
  }
  return { id, path };
}

export async function rowsFor(requestId: string) {
  const { data } = await adminClient().from("roof_assessments").select("*").eq("request_id", requestId).order("created_at");
  return data ?? [];
}
