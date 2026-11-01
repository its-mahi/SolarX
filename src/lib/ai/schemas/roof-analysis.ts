import "server-only";
import { z } from "zod";

export const STANDARD_ROOF_LIMITATIONS = [
  "A single image cannot establish exact roof dimensions",
  "Shading at different times of day is unknown",
  "Structural condition cannot be assessed",
] as const;

const ObservationSchema = z.object({
  object: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(300),
  potential_impact: z.string().trim().min(1).max(200),
  confidence: z.enum(["low", "medium", "high"]),
});

/** Unknown keys (root and observation) are stripped by Zod's default object behaviour. */
export const RoofAnalysisOutputSchema = z.object({
  observations: z.array(ObservationSchema).max(12),
  potential_obstructions: z.array(z.string().trim().min(1).max(60)).max(12),
  limitations: z.array(z.string().trim().min(1).max(300)).max(10),
  site_survey_required: z.boolean(),
});

export type RoofAnalysisOutput = z.output<typeof RoofAnalysisOutputSchema>;
export type RoofObservation = z.output<typeof ObservationSchema>;

export interface NormalizedRoofAnalysis {
  observations: RoofObservation[];
  potential_obstructions: string[];
  limitations: string[];
  site_survey_required: true;
}

export function normalizeRoofAnalysis(output: RoofAnalysisOutput): NormalizedRoofAnalysis {
  const seen = new Set<string>();
  const limitations: string[] = [];
  for (const l of [...STANDARD_ROOF_LIMITATIONS, ...output.limitations]) {
    const key = l.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    limitations.push(l);
  }
  return {
    observations: output.observations,
    potential_obstructions: output.potential_obstructions,
    limitations,
    site_survey_required: true,
  };
}

/** Hint for the provider's JSON mode; Zod remains the authority. */
export const ROOF_ANALYSIS_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    observations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          object: { type: "string" },
          description: { type: "string" },
          potential_impact: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["object", "description", "potential_impact", "confidence"],
      },
    },
    potential_obstructions: { type: "array", items: { type: "string" } },
    limitations: { type: "array", items: { type: "string" } },
    site_survey_required: { type: "boolean" },
  },
  required: ["observations", "potential_obstructions", "limitations", "site_survey_required"],
};
