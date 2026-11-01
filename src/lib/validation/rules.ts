// Validates the rule set (unit-tested so a malformed edit fails CI). `verified` rules must
// record when and where they were checked (constitution V).
import { z } from "zod";
import { RULE_KEYS } from "@/config/rules/types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const ruleBase = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  value: z.unknown(),
  unit: z.string().min(1),
  consumerCategory: z.string().min(1),
  geography: z.string().min(1),
  sourceTitle: z.string().min(1),
  sourceUrl: z.url().refine((u) => u.startsWith("https://"), "Source links must use https"),
  effectiveDate: isoDate.nullable(),
  retrievedOn: isoDate.nullable(),
  verification: z.enum(["illustrative", "verified"]),
  limitations: z.array(z.string().min(1)).min(1),
});

export const ruleSchema = ruleBase.superRefine((r, ctx) => {
  if (r.verification === "verified" && (r.retrievedOn === null || r.effectiveDate === null)) {
    ctx.addIssue({ code: "custom", path: ["verification"], message: "A verified rule needs retrievedOn and effectiveDate" });
  }
});

export const ruleSetSchema = z
  .object({
    version: z.string().min(1),
    name: z.string().min(1),
    publishedOn: isoDate,
    rules: z.record(z.string(), ruleSchema),
  })
  .superRefine((set, ctx) => {
    for (const key of RULE_KEYS) {
      if (!(key in set.rules)) ctx.addIssue({ code: "custom", path: ["rules", key], message: `Missing rule ${key}` });
    }
  });
