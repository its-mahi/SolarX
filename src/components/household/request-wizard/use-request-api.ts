"use client";

import type { HouseholdRequestDto } from "@/lib/validation/requests";

export type ApiFailure = { ok: false; status: number; message: string; details: { path: string; message: string }[] };
export type ApiSuccess = { ok: true; data: HouseholdRequestDto };
export type ApiResult = ApiSuccess | ApiFailure;

const NETWORK: ApiFailure = {
  ok: false,
  status: 0,
  message: "We couldn't reach SURYAMIT. Check your connection and try again.",
  details: [],
};

function parse(status: number, text: string): ApiResult {
  let json: { data?: HouseholdRequestDto; error?: { message?: string; details?: ApiFailure["details"] } } = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // non-JSON body: fall through to the generic message
  }
  if (status >= 200 && status < 300 && json.data) return { ok: true, data: json.data };
  return {
    ok: false,
    status,
    message: json.error?.message ?? "Something went wrong. Please try again.",
    details: json.error?.details ?? [],
  };
}

async function send(method: string, url: string, body?: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return parse(res.status, await res.text());
  } catch {
    return NETWORK;
  }
}

export const createRequest = (fields: Record<string, unknown>) => send("POST", "/api/requests", fields);
export const patchRequest = (id: string, fields: Record<string, unknown>) => send("PATCH", `/api/requests/${id}`, fields);
export const publishRequest = (id: string) => send("POST", `/api/requests/${id}/publish`, {});

/** Uploads one photo with progress (fetch cannot report upload progress). */
export function uploadPhoto(id: string, file: Blob, name: string, onProgress: (fraction: number) => void): Promise<ApiResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/requests/${id}/photo`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => resolve(parse(xhr.status, xhr.responseText));
    xhr.onerror = () => resolve(NETWORK);
    const form = new FormData();
    form.set("file", file, name);
    xhr.send(form);
  });
}
