const LABELS = { low: "Low confidence", medium: "Medium confidence", high: "High confidence" } as const;

/** Confidence as text (never colour alone, never a percentage). */
export function AiConfidenceLabel({ confidence }: { confidence: "low" | "medium" | "high" }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
      {LABELS[confidence] ?? "Unknown confidence"}
    </span>
  );
}
