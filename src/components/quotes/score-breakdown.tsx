import type { ScoreBreakdown as Breakdown } from "@/lib/domain/quotes";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const PARTS: { key: keyof Breakdown["parts"]; label: string }[] = [
  { key: "price", label: "Price" },
  { key: "technical", label: "Technical" },
  { key: "warranty", label: "Warranty" },
  { key: "completeness", label: "Completeness" },
  { key: "timeline", label: "Timeline" },
];

function detail(b: Breakdown, key: keyof Breakdown["parts"]): string {
  const p = b.parts;
  switch (key) {
    case "price":
      return p.price.reason;
    case "technical":
      return p.technical.items.map((i) => `${i.reason} (${fmt(i.points)}/${i.max})`).join(" ");
    case "warranty":
      return p.warranty.items.map((i) => `${i.key}: ${i.years === null ? "not stated" : `${i.years} y`} (${fmt(i.points)}/${i.max})`).join("; ");
    case "completeness":
      return `${p.completeness.stated} of ${p.completeness.total} recommended details stated.`;
    case "timeline":
      return p.timeline.days === null ? "Installation timeline not stated." : `${p.timeline.days} days.`;
  }
}

/** Keyboard-operable disclosure (native details/summary). */
export function ScoreBreakdown({ breakdown }: { breakdown: Breakdown }) {
  return (
    <details className="group rounded-lg border bg-card p-3 text-sm">
      <summary className="cursor-pointer font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        How this score was calculated
      </summary>
      <ul className="mt-3 flex flex-col gap-2">
        {PARTS.map(({ key, label }) => (
          <li key={key} className="flex flex-col gap-0.5">
            <span className="font-medium">
              {label}: {fmt(breakdown.parts[key].points)} / {breakdown.parts[key].max}
            </span>
            <span className="text-muted-foreground">{detail(breakdown, key)}</span>
          </li>
        ))}
      </ul>
      {breakdown.penalties.length > 0 ? (
        <div className="mt-3">
          <p className="font-medium">Missing-data penalties</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {breakdown.penalties.map((p) => (
              <li key={`${p.part}-${p.item}`}>{p.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </details>
  );
}
