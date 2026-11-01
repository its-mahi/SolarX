import { Info } from "lucide-react";

type Props = { weights: Record<"price" | "technical" | "warranty" | "completeness" | "timeline", number>; version: string; disclaimer: string };

export function ScoringDisclaimer({ weights, version, disclaimer }: Props) {
  return (
    <aside aria-label="How scores work" className="flex gap-3 rounded-xl border bg-mint/40 p-4 text-sm">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="flex flex-col gap-1">
        <p className="font-medium">
          Price {weights.price} · Technical {weights.technical} · Warranty {weights.warranty} · Completeness {weights.completeness} · Timeline{" "}
          {weights.timeline} <span className="font-normal text-muted-foreground">({version})</span>
        </p>
        <p className="text-muted-foreground">{disclaimer}</p>
      </div>
    </aside>
  );
}
