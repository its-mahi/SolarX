// SC-004: server secrets never reach the browser bundle. Run after `npm run build`.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const STATIC_DIR = join(process.cwd(), ".next", "static");
const SECRET_NAMES = ["SUPABASE_SERVICE_ROLE_KEY", "DEMO_ACCOUNT_PASSWORD", "GEMINI_API_KEY", "GROQ_API_KEY"] as const;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe("client bundle", () => {
  it.skipIf(!existsSync(STATIC_DIR))("contains none of the server-only secret values", () => {
    const secrets: [string, string][] = [];
    for (const name of SECRET_NAMES) {
      const value = process.env[name];
      if (value && value.length >= 8) secrets.push([name, value]);
    }
    expect(secrets.length).toBeGreaterThan(0);

    const leaks: string[] = [];
    for (const file of walk(STATIC_DIR)) {
      if (!/\.(js|css|html|json|txt|map)$/.test(file)) continue;
      const content = readFileSync(file, "utf8");
      for (const [name, value] of secrets) if (content.includes(value)) leaks.push(`${name} in ${file}`);
    }
    expect(leaks).toEqual([]);
  });
});
