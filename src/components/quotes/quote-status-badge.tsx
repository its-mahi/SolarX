import { cn } from "@/lib/utils";
import type { QuoteStatus } from "@/lib/validation/enums";

const BADGES: Record<QuoteStatus, { label: string; className: string }> = {
  submitted: { label: "Submitted", className: "bg-secondary text-primary" },
  accepted: { label: "Accepted", className: "bg-primary text-primary-foreground" },
  rejected: { label: "Not selected", className: "bg-muted text-muted-foreground" },
  withdrawn: { label: "Withdrawn", className: "border border-border bg-transparent text-foreground" },
};

/** Colour plus text label, never colour alone. */
export function QuoteStatusBadge({ status, className }: { status: QuoteStatus; className?: string }) {
  const { label, className: style } = BADGES[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", style, className)}>
      {label}
    </span>
  );
}
