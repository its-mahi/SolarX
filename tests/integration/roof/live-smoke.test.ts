// Optional live check: skipped unless AI_LIVE_TESTS=1 and GEMINI_API_KEY is set.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeRoofPhoto } from "@/lib/ai/roof-analysis";

const live = process.env.AI_LIVE_TESTS === "1" && !!process.env.GEMINI_API_KEY;

describe.skipIf(!live)("roof analysis live smoke", () => {
  it.each(["clear-roof.jpg", "obstructed-roof.jpg"])("analyses %s with a schema-valid result", async (file) => {
    const bytes = new Uint8Array(readFileSync(`tests/fixtures/roof/${file}`));
    const result = await analyzeRoofPhoto({ bytes, mimeType: "image/jpeg" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.analysis.limitations.length).toBeGreaterThanOrEqual(3);
  }, 40_000);
});
