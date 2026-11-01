import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const root = join(process.cwd(), "src");
const files = walk(root).map((p) => ({ rel: relative(root, p), src: readFileSync(p, "utf8") }));

describe("AI boundary", () => {
  it("provider SDKs are imported only under src/lib/ai/providers", () => {
    for (const f of files.filter((x) => /from ["'](@google\/genai|groq-sdk)["']/.test(x.src))) {
      expect(f.rel.startsWith("lib/ai/providers/")).toBe(true);
    }
  });
  it("no client component imports @/lib/ai", () => {
    for (const f of files.filter((x) => /^\s*["']use client["']/m.test(x.src))) {
      expect(f.src).not.toMatch(/@\/lib\/ai/);
    }
  });
  it("no NEXT_PUBLIC variable exposes AI config", () => {
    for (const f of files) expect(f.src).not.toMatch(/NEXT_PUBLIC_\w*(GEMINI|GROQ|AI_)/);
  });
  it("domain code does not import the AI client", () => {
    for (const f of files.filter((x) => x.rel.startsWith("lib/domain/"))) {
      expect(f.src).not.toMatch(/@\/lib\/ai|roof_assessments/);
    }
  });
  it("every module in src/lib/ai imports server-only", () => {
    for (const f of files.filter((x) => x.rel.startsWith("lib/ai/"))) {
      expect(f.src).toContain('import "server-only"');
    }
  });
});
