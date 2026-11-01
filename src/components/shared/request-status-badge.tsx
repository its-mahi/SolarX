import { cn } from "@/lib/utils";
import type { RequestStatus } from "@/lib/validation/enums";

const BADGES: Record<RequestStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border border-border bg-transparent text-foreground" },
  open: { label: "Open — awaiting quotes", className: "bg-secondary text-primary" },
  quoted: { label: "Quotes received", className: "bg-accent text-accent-foreground" },
  accepted: { label: "Quote accepted", className: "bg-primary text-primary-foreground" },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground" },
};

export function RequestStatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  const { label, className: style } = BADGES[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", style, className)}>
      {label}
    </span>
  );
}
