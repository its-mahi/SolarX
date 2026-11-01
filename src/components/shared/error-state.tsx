"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { title?: string; message?: string; onRetry?: () => void; className?: string };

/** Recoverable error. Never renders technical detail (constitution VII). */
export function ErrorState({
  title = "Something went wrong",
  message = "Please try again. If the problem continues, refresh the page.",
  onRetry,
  className,
}: Props) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-10 text-center", className)}>
      <TriangleAlert aria-hidden className="size-8 text-destructive" />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-prose text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button size="lg" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
