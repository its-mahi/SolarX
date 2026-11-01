// API helpers for request tests (use tests/helpers/api.ts from 001).
import { BASE_URL, apiFetch } from "./api";
import { roofJpeg } from "./images";

export type RequestDto = {
  id: string;
  status: string;
  has_roof_photo: boolean;
  roof_photo_url: string | null;
  roof_photo_url_expires_at: string | null;
  missing_publish_fields: string[];
  next_action: { kind: string; label: string; step?: string };
  ai_consent: boolean;
  [key: string]: unknown;
};

export const LOCATION_FIELDS = {
  latitude: 17.412345,
  longitude: 78.44321,
  address_text: "Plot 12, Road 3, Banjara Hills, Hyderabad 500034",
  locality: "Banjara Hills",
};
export const USAGE_FIELDS = { monthly_units: 250, monthly_bill: 2100, budget: 150000, preferred_capacity_kw: 3 };

export async function createDraftViaApi(token: string, fields: Record<string, unknown> = LOCATION_FIELDS) {
  const res = await apiFetch<RequestDto>("/api/requests", { token, method: "POST", body: fields });
  if (res.status !== 201) throw new Error(`createDraftViaApi failed: ${res.status} ${res.text}`);
  return res.json.data!;
}

export async function uploadPhotoViaApi(token: string, id: string, buffer?: Buffer, type = "image/jpeg", name = "roof.jpg") {
  const body = new FormData();
  body.set("file", new Blob([new Uint8Array(buffer ?? (await roofJpeg()))], { type }), name);
  const res = await fetch(`${BASE_URL}/api/requests/${id}/photo`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, origin: BASE_URL },
    body,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  return { status: res.status, json: json as { data?: RequestDto; error?: { code: string; message: string } }, text };
}

/** Fully filled draft (location, usage, photo), not yet published. */
export async function completeDraft(token: string) {
  const draft = await createDraftViaApi(token, { ...LOCATION_FIELDS, ...USAGE_FIELDS });
  const up = await uploadPhotoViaApi(token, draft.id);
  if (up.status !== 200) throw new Error(`completeDraft photo failed: ${up.status} ${up.text}`);
  return up.json.data!;
}

export function publishViaApi(token: string, id: string) {
  return apiFetch<RequestDto>(`/api/requests/${id}/publish`, { token, method: "POST", body: {} });
}
