import type { AdvisorFact } from "@/lib/domain/advisor/types";
import { AdvisorEvidence } from "./advisor-evidence";

type Props = {
  title: string;
  available: boolean;
  summary: string;
  points: { text: string; fact_refs: string[] }[];
  facts: Map<string, AdvisorFact>;
};

/** One advisor section: h2, summary, points each with their evidence. */
export function AdvisorSection({ title, available, summary, points, facts }: Props) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className={available ? "mt-1" : "mt-1 rounded-md bg-muted px-3 py-2 text-sm"}>{summary}</p>
      {points.length > 0 && (
        <ul className="mt-3 space-y-3 text-sm">
          {points.map((p, i) => (
            <li key={i}>
              <p>{p.text}</p>
              <AdvisorEvidence factRefs={p.fact_refs} facts={facts} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
