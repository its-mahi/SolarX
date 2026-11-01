import { describe, expect, it } from "vitest";
import { activeRuleSet } from "@/config/rules";
import { RULE_KEYS } from "@/config/rules/types";
import { ruleSetSchema } from "@/lib/validation/rules";

describe("active rule set", () => {
  it("parses with ruleSetSchema and is version pm-surya-ghar.v1", () => {
    expect(ruleSetSchema.safeParse(activeRuleSet).success).toBe(true);
    expect(activeRuleSet.version).toBe("pm-surya-ghar.v1");
  });

  it("has all 10 rule keys", () => {
    expect(RULE_KEYS).toHaveLength(10);
    for (const key of RULE_KEYS) expect(activeRuleSet.rules[key].key).toBe(key);
  });

  it("gives every rule full source metadata", () => {
    for (const rule of Object.values(activeRuleSet.rules)) {
      for (const field of ["name", "unit", "consumerCategory", "geography", "sourceTitle"] as const) {
        expect(rule[field].length, `${rule.key}.${field}`).toBeGreaterThan(0);
      }
      expect(rule.sourceUrl.startsWith("https://")).toBe(true);
      expect(["https://pmsuryaghar.gov.in/", "https://mnre.gov.in/"]).toContain(rule.sourceUrl);
      expect(rule.limitations.length).toBeGreaterThan(0);
    }
  });

  it("keeps every v1 rule illustrative and pending verification", () => {
    for (const rule of Object.values(activeRuleSet.rules)) {
      expect(rule.verification).toBe("illustrative");
      expect(rule.retrievedOn).toBeNull();
      expect(rule.limitations.join(" ")).toContain("Illustrative — verify before demo");
    }
  });

  it("rejects a verified rule without retrievedOn or effectiveDate", () => {
    const broken = structuredClone(activeRuleSet);
    broken.rules.cfa_cap.verification = "verified";
    expect(ruleSetSchema.safeParse(broken).success).toBe(false);
    broken.rules.cfa_cap.retrievedOn = "2026-11-01";
    broken.rules.cfa_cap.effectiveDate = "2026-01-01";
    expect(ruleSetSchema.safeParse(broken).success).toBe(true);
  });

  it("rejects a non-https source link and a missing rule", () => {
    const http = structuredClone(activeRuleSet);
    http.rules.cfa_cap.sourceUrl = "http://example.com/";
    expect(ruleSetSchema.safeParse(http).success).toBe(false);
    const missing = structuredClone(activeRuleSet) as unknown as { rules: Record<string, unknown> };
    delete missing.rules.cfa_cap;
    expect(ruleSetSchema.safeParse(missing).success).toBe(false);
  });
});
