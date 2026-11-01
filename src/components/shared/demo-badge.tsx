import { cn } from "@/lib/utils";

/** "Demo" pill: solar-yellow outline with dark text for AA contrast (FR-015). Never says "verified". */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border-2 border-highlight bg-highlight/15 px-2 py-0.5 text-xs font-semibold text-foreground",
        className,
      )}
    >
      Demo
    </span>
  );
}
