// Storage helpers for the private quote-documents bucket (specs/009). Callers pass the
// user-scoped client so storage RLS applies; object names are {vendor_user_id}/{upload_id}/source.{ext}.
import "server-only";
import { randomUUID } from "node:crypto";
import type { ServerSupabase } from "@/lib/supabase/server";
import { QUOTE_DOCUMENT_PATH_RE } from "@/lib/validation/quote-extraction";

export const QUOTE_DOCUMENTS_BUCKET = "quote-documents";
export type QuoteDocumentExt = "jpg" | "png" | "pdf" | "txt";
export type QuoteDocumentKind = "text" | "image" | "pdf";

export function isOwnedDocumentPath(path: string, userId: string): boolean {
  return QUOTE_DOCUMENT_PATH_RE.test(path) && path.split("/")[0] === userId;
}

export function kindFromPath(path: string): QuoteDocumentKind {
  const ext = path.slice(path.lastIndexOf(".") + 1);
  return ext === "txt" ? "text" : ext === "pdf" ? "pdf" : "image";
}

export function mimeFromPath(path: string): string {
  const ext = path.slice(path.lastIndexOf(".") + 1);
  return ext === "txt" ? "text/plain" : ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg";
}

export async function uploadQuoteSourceDocument(
  client: ServerSupabase,
  vendorUserId: string,
  bytes: Uint8Array,
  ext: QuoteDocumentExt,
  contentType: string,
): Promise<string> {
  const path = `${vendorUserId}/${randomUUID()}/source.${ext}`;
  const { error } = await client.storage.from(QUOTE_DOCUMENTS_BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error("quote document upload failed");
  return path;
}

/** True when the object is visible to the caller (storage RLS: own folder). */
export async function quoteDocumentExists(client: ServerSupabase, path: string): Promise<boolean> {
  const slash = path.lastIndexOf("/");
  const { data, error } = await client.storage
    .from(QUOTE_DOCUMENTS_BUCKET)
    .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 5 });
  if (error || !data) return false;
  return data.some((o) => o.name === path.slice(slash + 1));
}

export async function createQuoteSourceDocumentUrl(
  client: ServerSupabase,
  path: string,
  expiresInSeconds = 300,
): Promise<{ url: string; expires_at: string } | null> {
  const { data, error } = await client.storage.from(QUOTE_DOCUMENTS_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return { url: data.signedUrl, expires_at: new Date(Date.now() + expiresInSeconds * 1000).toISOString() };
}
