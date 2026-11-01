import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { HouseholdRequestDto } from "@/lib/validation/requests";

const LINES: Record<string, string> = {
  draft: "Finish your request to get full advice",
  open: "Roof and cost summary ready — waiting for quotes",
  quoted: "Quotes received — see what they mean",
  accepted: "See advice on your chosen quote",
  closed: "See advice on your chosen quote",
};

export function advisorShortcutStatusLine(status: string): string {
  return Object.prototype.hasOwnProperty.call(LINES, status) ? LINES[status] : "Open the advisor";
}

/** Whole card is one link; no data fetching. */
export function AdvisorShortcutCard({ request }: { request: Pick<HouseholdRequestDto, "id" | "status"> }) {
  return (
    <Link
      href={`/household/requests/${request.id}/advisor`}
      className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-mint/40 px-3 py-2 text-sm outline-none transition-colors hover:bg-mint focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Sparkles aria-hidden className="size-4 shrink-0 text-primary" />
      <span className="flex flex-col">
        <span className="font-semibold">Ask the advisor</span>
        <span className="text-muted-foreground">{advisorShortcutStatusLine(request.status)}</span>
      </span>
    </Link>
  );
}
