// Small fetch helper for the acceptance endpoints (specs/007 contracts). Never caches or stores responses.
export type ClientResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

const FALLBACK = "Something went wrong. Please try again.";

async function request<T>(url: string, init: RequestInit): Promise<ClientResult<T>> {
  try {
    const res = await fetch(url, { ...init, cache: "no-store", credentials: "same-origin" });
    const body = (await res.json().catch(() => null)) as
      | { data?: T; error?: { message?: string } }
      | null;
    if (res.ok && body && body.data !== undefined) return { ok: true, data: body.data };
    return { ok: false, status: res.status, message: body?.error?.message ?? FALLBACK };
  } catch {
    return { ok: false, status: 0, message: "Network problem. Check your connection and try again." };
  }
}

const post = <T>(url: string) =>
  request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmed: true }),
  });

export const acceptQuote = <T = unknown>(quoteId: string) => post<T>(`/api/quotes/${quoteId}/accept`);
export const closeRequest = <T = unknown>(requestId: string) => post<T>(`/api/requests/${requestId}/close`);
export const fetchHouseholdContact = <T = unknown>(quoteId: string) =>
  request<T>(`/api/quotes/${quoteId}/contact`, { method: "GET" });
