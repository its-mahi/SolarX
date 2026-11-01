import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Props = { label?: string; variant?: "page" | "inline" | "card"; className?: string };

export function LoadingState({ label = "Loading…", variant = "page", className }: Props) {
  if (variant === "inline") {
    return (
      <span role="status" aria-busy="true" className={cn("text-sm text-muted-foreground", className)}>
        {label}
      </span>
    );
  }
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn("flex w-full flex-col gap-3", variant === "page" ? "py-10" : "py-4", className)}
    >
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
