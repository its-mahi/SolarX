import type { VendorRoofAssessment } from "@/lib/validation/vendor-discovery";
import { formatPosted } from "./format";

/** Renders unknown JSON (strings or objects) as plain text lines; never as HTML. */
function lines(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(lines);
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const parts = ["object", "description", "potential_impact", "confidence"]
      .filter((k) => typeof o[k] === "string")
      .map((k) => (k === "confidence" ? `confidence: ${o[k]}` : String(o[k])));
    return parts.length ? [parts.join(" — ")] : [];
  }
  return [String(value)];
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="list-disc pl-5 text-sm">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  );
}

export function RoofAssessmentSummary({ assessment }: { assessment: VendorRoofAssessment | null }) {
  return (
    <section aria-labelledby="roof-assessment-heading" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h3 id="roof-assessment-heading" className="text-base font-semibold">Roof assessment</h3>
      {assessment ? (
        <>
          <p className="text-sm text-muted-foreground">AI-generated visible observations — not a site survey; confidence is not a guarantee.</p>
          <Section title="Observations" items={lines(assessment.observations)} />
          <Section title="Potential obstructions" items={lines(assessment.potential_obstructions)} />
          <Section title="Limitations" items={lines(assessment.limitations)} />
          {assessment.site_survey_required ? <p className="text-sm font-medium">A site survey is required before finalising a design.</p> : null}
          <p className="text-xs text-muted-foreground">Assessed {formatPosted(assessment.assessed_at)}</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No roof assessment available.</p>
      )}
    </section>
  );
}
