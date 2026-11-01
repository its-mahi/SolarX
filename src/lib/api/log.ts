// Structured, privacy-safe logging (constitution IV, research R-13).
const ALLOWED_KEYS = new Set([
  "userId",
  "role",
  "requestId",
  "quoteId",
  "fromStatus",
  "toStatus",
  "code",
  "demoKey",
  "reason",
]);

const WARN_EVENTS = /(failed|forbidden|unauthenticated|error)$/;

/** Writes one JSON line; every key outside the allowlist is dropped. Event names: `<area>.<action>`. */
export function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (ALLOWED_KEYS.has(key) && value !== undefined) safe[key] = value;
  }
  const line = JSON.stringify({ event, at: new Date().toISOString(), ...safe });
  if (WARN_EVENTS.test(event)) console.warn(line);
  else console.info(line);
}
