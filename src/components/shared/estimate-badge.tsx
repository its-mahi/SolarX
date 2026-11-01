import { BadgeCheck, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { kind: "estimate" | "vendor-confirmed"; className?: string };

/** Marks a value as a platform estimate or a vendor-confirmed figure (icon + text, never colour alone). */
export function EstimateBadge({ kind, className }: Props) {
  const isEstimate = kind === "estimate";
  const Icon = isEstimate ? Calculator : BadgeCheck;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
        isEstimate ? "border-highlight bg-highlight/15 text-foreground" : "border-primary bg-mint text-primary",
        className,
      )}
    >
      <Icon aria-hidden className="size-3" />
      {isEstimate ? "Estimate" : "Vendor-confirmed"}
    </span>
  );
}
