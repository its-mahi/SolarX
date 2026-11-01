import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import type { VendorRequestSummary } from "@/lib/validation/vendor-discovery";
import { RequestCard } from "./request-card";

type Props = { items: VendorRequestSummary[]; truncated: boolean; filtered: boolean; search?: string; onClear?: () => void };

export function RequestList({ items, truncated, filtered, search, onClear }: Props) {
  if (items.length === 0) {
    return filtered ? (
      <EmptyState icon={SearchX} title="No requests match these filters" description="Widen or clear the filters to see more requests." action={{ label: "Clear filters", onClick: onClear }} />
    ) : (
      <EmptyState icon={SearchX} title="No open requests right now" description="No open requests right now — widen filters or check back later." />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {truncated ? <p role="status" className="text-sm text-muted-foreground">Showing first 200 — refine filters.</p> : null}
      <ul className="flex flex-col gap-3">
        {items.map((item) => <RequestCard key={item.id} item={item} search={search} />)}
      </ul>
    </div>
  );
}
