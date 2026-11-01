// Strict schema for the advisor AI output (specs/011 data-model §4). Any violation discards the
// whole output (the template is shown); valid output must still pass validateAdvisorExplanation.
import "server-only";
import { z } from "zod";

const NO_CONTROL = /^[^\u0000-\u0008\u000B-\u001F\u007F]*$/;
const text = (max: number) => z.string().trim().min(1).max(max).regex(NO_CONTROL);

const point = z.strictObject({ text: text(280), fact_refs: z.array(text(80)).min(1).max(6) });
const section = z.strictObject({ summary: text(300), points: z.array(point).max(5) });

export const advisorExplanationAiOutputSchema = z.strictObject({
  observed: section,
  calculations: section,
  recommendation: z.strictObject({
    summary: text(300),
    points: z.array(point).max(5),
    leading_quote_label: z.string().regex(/^[A-Z]$/).nullable(),
  }),
  limitations: z.array(text(200)).max(5),
});
export type AdvisorExplanationAiOutput = z.infer<typeof advisorExplanationAiOutputSchema>;
