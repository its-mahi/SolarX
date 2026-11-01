import { afterEach, describe, expect, it } from "vitest";
import { createAiClient, setAiClientForTests } from "@/lib/ai/client";
import { analyzeRoofPhoto } from "@/lib/ai/roof-analysis";
import { createMockProvider } from "../../helpers/mock-ai-provider";
import * as f from "../../fixtures/roof/ai-outputs";

afterEach(() => setAiClientForTests(null));
const run = (steps: Parameters<typeof createMockProvider>[0]["steps"], configured = true) => {
  const mock = createMockProvider({ steps, configured });
  setAiClientForTests(createAiClient({ providers: [mock], config: { geminiModel: "m", maxRetries: 0 }, sleep: async () => {} }));
  return { mock, p: analyzeRoofPhoto({ bytes: new Uint8Array([1]), mimeType: "image/jpeg" }) };
};

describe("analyzeRoofPhoto", () => {
  it("returns normalised analysis and sends only instruction + framed photo", async () => {
    const { mock, p } = run([{ json: f.surveyFalse }]);
    const r = await p;
    expect(r.ok && r.analysis.site_survey_required).toBe(true);
    expect(r.ok && r.analysis.limitations.length).toBe(3);
    expect(mock.calls[0].parts.map((x) => x.kind)).toEqual(["text", "text", "file"]);
    expect(r.meta.promptVersion).toBe("roof-analysis.v1");
  });
  it("maps failures", async () => {
    expect(await run([{ text: f.notJson }]).p).toMatchObject({ ok: false, failure: { kind: "invalid_output" } });
    expect(await run([{ json: f.tooMany }]).p).toMatchObject({ ok: false });
    expect(await run([{ json: f.validObstructed }], false).p).toMatchObject({ ok: false, failure: { kind: "not_configured" } });
  });
});
