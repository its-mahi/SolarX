// GET /api/rules is public. Needs `npm run dev`.
import { describe, expect, it } from "vitest";
import { apiFetch } from "../../helpers/api";

type RulesData = {
  version: string;
  rules: Record<string, unknown>[];
  cfaExamples: { capacityKw: number; cfa: number }[];
  officialReferences: { title: string; url: string }[];
  disclaimer: string;
};

describe("GET /api/rules", () => {
  it("is public and returns the full rule set", async () => {
    const res = await apiFetch<RulesData>("/api/rules");
    expect(res.status).toBe(200);
    const data = res.json.data!;
    expect(data.version).toBe("pm-surya-ghar.v1");
    expect(data.rules).toHaveLength(10);
    for (const rule of data.rules) {
      for (const field of ["key", "name", "value", "unit", "consumerCategory", "geography", "sourceTitle", "sourceUrl", "verification", "limitations"]) {
        expect(rule, `rule missing ${field}`).toHaveProperty(field);
      }
      expect(rule).toHaveProperty("effectiveDate");
      expect(rule).toHaveProperty("retrievedOn");
    }
  });

  it("computes the CFA examples from the domain code", async () => {
    const { json } = await apiFetch<RulesData>("/api/rules");
    expect(json.data!.cfaExamples).toEqual([
      { capacityKw: 1, cfa: 30000 },
      { capacityKw: 1.5, cfa: 45000 },
      { capacityKw: 2, cfa: 60000 },
      { capacityKw: 2.5, cfa: 69000 },
      { capacityKw: 3, cfa: 78000 },
      { capacityKw: 5, cfa: 78000 },
    ]);
  });

  it("lists the official portals and the disclaimer, and is cacheable", async () => {
    const res = await apiFetch<RulesData>("/api/rules");
    const urls = res.json.data!.officialReferences.map((r) => r.url);
    expect(urls).toEqual(expect.arrayContaining(["https://pmsuryaghar.gov.in/", "https://mnre.gov.in/", "https://www.myscheme.gov.in/"]));
    expect(res.json.data!.disclaimer).toMatch(/does not guarantee/i);
    expect(res.headers.get("cache-control")).toContain("max-age=300");
  });
});
