import { CheckCircle2, CircleSlash } from "lucide-react";
import type { QuoteStatus } from "@/lib/validation/enums";

/** Vendor-facing outcome of a quote. Renders nothing for submitted/withdrawn. */
export function QuoteOutcomeNotice({ status }: { status: QuoteStatus }) {
  if (status === "accepted") {
    return (
      <p className="flex items-start gap-2 text-sm font-medium text-primary">
        <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
        Accepted by the household — arrange a site survey
      </p>
    );
  }
  if (status === "rejected") {
    return (
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <CircleSlash aria-hidden className="mt-0.5 size-4 shrink-0" />
        Not selected — the household accepted another quote
      </p>
    );
  }
  return null;
}
