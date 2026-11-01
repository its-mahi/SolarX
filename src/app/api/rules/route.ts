// GET /api/rules — public rule set plus a CFA example table computed by the domain code.
import { activeRuleSet } from "@/config/rules";
import { calculateCentralCfa } from "@/lib/domain/financial";
import { withApiHandler, ok } from "@/lib/api/respond";
import { ESTIMATE_DISCLAIMER } from "@/lib/validation/solar";
import { ruleSetSchema } from "@/lib/validation/rules";
import { OFFICIAL_REFERENCES } from "@/lib/rules-content";

const EXAMPLE_CAPACITIES = [1, 1.5, 2, 2.5, 3, 5] as const;

export const GET = withApiHandler(async () => {
  ruleSetSchema.parse(activeRuleSet); // a malformed rule set surfaces as INTERNAL, never as bad data
  return ok(
    {
      version: activeRuleSet.version,
      name: activeRuleSet.name,
      rules: Object.values(activeRuleSet.rules),
      cfaExamples: EXAMPLE_CAPACITIES.map((capacityKw) => ({ capacityKw, cfa: calculateCentralCfa(capacityKw, activeRuleSet) })),
      officialReferences: OFFICIAL_REFERENCES,
      disclaimer: ESTIMATE_DISCLAIMER,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
});
