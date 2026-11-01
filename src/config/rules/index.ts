// The rule set every calculation uses. To change a value, add pm-surya-ghar.v2.ts and switch here.
import { pmSuryaGharV1 } from "./pm-surya-ghar.v1";

export const activeRuleSet = pmSuryaGharV1;
export type { CfaSlab, Rule, RuleKey, RuleSet, RuleVerification, RuleValues } from "./types";
export { RULE_KEYS } from "./types";
