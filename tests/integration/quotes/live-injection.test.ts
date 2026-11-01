// Optional live check (AI_LIVE_TESTS=1 and GEMINI_API_KEY): the real model extracts equal values with and without the injection.
import { describe, expect, it } from "vitest";
import { extractQuote } from "@/lib/ai/quote-extraction";
import { QUOTE_FIELD_PATHS, getFieldValue } from "@/lib/ai/schemas/quote-extraction";
import { fixtureText } from "./_extraction-setup";

const live = process.env.AI_LIVE_TESTS === "1" && !!process.env.GEMINI_API_KEY;

describe.skipIf(!live)("live injection invariance", () => {
  it("equal values for all 13 paths", async () => {
    const a = await extractQuote({ kind: "text", text: fixtureText("clean") });
    const b = await extractQuote({ kind: "text", text: fixtureText("injected") });
    if (!a.ok || !b.ok) throw new Error("live extraction failed");
    for (const p of QUOTE_FIELD_PATHS) expect(getFieldValue(b.fields, p)).toEqual(getFieldValue(a.fields, p));
  }, 90_000);
});
