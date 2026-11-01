import { DemoBadge } from "@/components/shared/demo-badge";
import type { RoofAssessmentDto } from "@/lib/validation/roof";
import { AiConfidenceLabel } from "./ai-confidence-label";

/** Renders stored AI observations. All AI text is rendered as plain text nodes. */
export function RoofAssessmentView({ assessment, compact = false }: { assessment: RoofAssessmentDto; compact?: boolean }) {
  const date = new Date(assessment.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" });
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">AI observations — not measurements</p>
        {assessment.model === "demo-seed" && <DemoBadge />}
      </div>

      {assessment.observations.length > 0 ? (
        <ul className="space-y-2">
          {assessment.observations.map((o, i) => (
            <li key={i} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{o.object}</span>
                <AiConfidenceLabel confidence={o.confidence} />
              </div>
              {!compact && <p className="mt-1 text-muted-foreground">{o.description}</p>}
              <p className="mt-1">
                <span className="text-muted-foreground">Potential impact: </span>
                {o.potential_impact}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p>No obvious obstructions were visible in this photo.</p>
      )}

      {assessment.potential_obstructions.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Potential obstructions">
          {assessment.potential_obstructions.map((o, i) => (
            <li key={i} className="rounded-full border border-border px-2 py-0.5 text-xs">{o}</li>
          ))}
        </ul>
      )}

      <div>
        <p className="font-medium">Limitations</p>
        <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
          {assessment.limitations.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </div>

      <p className="rounded-lg border border-highlight bg-highlight/15 p-3">
        A vendor site survey is still required to confirm roof space, shading and structure.
      </p>
      <p className="text-xs text-muted-foreground">AI confidence is an indication, not a guarantee.</p>
      <p className="text-xs text-muted-foreground">
        {date} · {assessment.model ?? "unknown model"} · {assessment.prompt_version}
      </p>
    </div>
  );
}
