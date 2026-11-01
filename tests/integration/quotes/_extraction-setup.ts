// Shared helpers for 009 integration tests: in-process route calls with a mock AI provider.
import { readFileSync } from "node:fs";
import { createAiClient, setAiClientForTests } from "@/lib/ai/client";
import { POST as extractPost } from "@/app/api/quotes/extract/route";
import { GET as sourceDocGet } from "@/app/api/quotes/[id]/source-document/route";
import { createMockProvider, type MockStep } from "../../helpers/mock-ai-provider";
import { adminClient } from "../../helpers/supabase";

export const fixtureText = (name: "clean" | "injected") => readFileSync(`tests/fixtures/quotes/greenvolt-quote-${name}.txt`, "utf8");
export const fixturePdf = () => new Uint8Array(readFileSync("tests/fixtures/quotes/greenvolt-quote-injected.pdf"));
export const jpeg = () => new Uint8Array(readFileSync("tests/fixtures/roof/clear-roof.jpg"));

export function installMock(steps: MockStep[] | Parameters<typeof createMockProvider>[0]["steps"], extra: { name?: "gemini" | "groq"; supports?: ("text" | "vision" | "document")[] } = {}) {
  const mock = createMockProvider({ steps, model: "mock-model", ...extra });
  setAiClientForTests(createAiClient({ providers: [mock], config: { geminiModel: "mock-model", maxRetries: 0 }, sleep: async () => {} }));
  return mock;
}
export const resetMock = () => setAiClientForTests(null);

export function extractCall(token: string | null, fields: Record<string, string | File | undefined>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) form.set(k, v);
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return extractPost(new Request("http://127.0.0.1:3000/api/quotes/extract", { method: "POST", headers, body: form }), { params: Promise.resolve({}) });
}

export function sourceDocCall(token: string | null, id: string) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return sourceDocGet(new Request(`http://127.0.0.1:3000/api/quotes/${id}/source-document`, { headers }), { params: Promise.resolve({ id }) });
}

export const file = (bytes: Uint8Array | string, name: string, type: string) => new File([bytes as BlobPart], name, { type });

export async function removeObjects(paths: string[]) {
  if (paths.length) await adminClient().storage.from("quote-documents").remove(paths);
}

export async function listFolder(userId: string): Promise<string[]> {
  const admin = adminClient().storage.from("quote-documents");
  const { data: dirs } = await admin.list(userId);
  const out: string[] = [];
  for (const d of dirs ?? []) {
    const { data: files } = await admin.list(`${userId}/${d.name}`);
    for (const f of files ?? []) out.push(`${userId}/${d.name}/${f.name}`);
  }
  return out;
}
