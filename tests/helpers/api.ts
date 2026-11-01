// Calls the running Next.js app (`npm run dev`) from integration tests.
// 127.0.0.1, not localhost: another local app on [::1]:3000 would otherwise answer IPv6-first lookups.
export const BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";

type Options = {
  token?: string;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  origin?: string | null;
  cookie?: string;
};

export type ApiResult<T = unknown> = {
  status: number;
  json: { data?: T; error?: { code: string; message: string; details: { path: string; message: string }[] } };
  text: string;
  headers: Headers;
};

export async function apiFetch<T = unknown>(path: string, options: Options = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.cookie) headers.cookie = options.cookie;
  if (options.origin !== null) headers.origin = options.origin ?? BASE_URL;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers,
    body: options.body === undefined ? undefined : typeof options.body === "string" ? options.body : JSON.stringify(options.body),
    redirect: "manual",
  });
  const text = await res.text();
  let json: ApiResult<T>["json"] = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  return { status: res.status, json, text, headers: res.headers };
}

/** Joins Set-Cookie headers into a Cookie request header (for cookie-authenticated calls). */
export function cookieHeaderFrom(headers: Headers): string {
  return headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}
