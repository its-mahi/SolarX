// Pure role-routing helpers (research R-07). Safe to import anywhere.
import type { Role } from "@/lib/validation/enums";

export function homePathForRole(role: Role): "/household" | "/vendor" {
  return role === "household" ? "/household" : "/vendor";
}

function hasPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`);
}

/**
 * Returns `next` only when it is a same-site path inside the caller's own area (or /account);
 * otherwise the caller's home. Blocks open redirects such as //evil.com or /\evil.
 */
export function safeNextPath(next: string | null | undefined, role: Role): string {
  const home = homePathForRole(role);
  if (typeof next !== "string" || next.length === 0) return home;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return home;
  if (/^[a-z][a-z0-9+.-]*:/i.test(next) || /[\u0000-\u001f]/.test(next)) return home;
  if (hasPrefix(next, home) || hasPrefix(next, "/account")) return next;
  return home;
}
