import { AdvisorShortcutSlot, RequestEstimateSlot, RequestQuotesSlot } from "@/components/household/extension-slots";
import { RequestStatusBadge } from "@/components/shared/request-status-badge";
import { SlotBoundary } from "@/components/shared/slot-boundary";
import { formatDate, formatInr, formatKw, formatUnits } from "@/lib/format";
import type { HouseholdRequestDto } from "@/lib/validation/requests";
import { NextActionLink } from "./next-action-link";

export function RequestCard({ request }: { request: HouseholdRequestDto }) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label={`Request ${request.locality ?? "draft"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{request.locality ?? "Draft request"}</h2>
        <RequestStatusBadge status={request.status} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Monthly use</dt>
          <dd className="font-medium">{request.monthly_units === null ? "—" : formatUnits(request.monthly_units)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Budget</dt>
          <dd className="font-medium">{request.budget === null ? "—" : formatInr(request.budget)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Capacity</dt>
          <dd className="font-medium">{formatKw(request.preferred_capacity_kw)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Created</dt>
          <dd className="font-medium">{formatDate(request.created_at)}</dd>
        </div>
      </dl>
      <SlotBoundary name="estimate-card">
        <RequestEstimateSlot request={request} variant="card" />
      </SlotBoundary>
      <SlotBoundary name="quotes-card">
        <RequestQuotesSlot request={request} variant="card" />
      </SlotBoundary>
      <SlotBoundary name="advisor-card">
        <AdvisorShortcutSlot request={request} variant="card" />
      </SlotBoundary>
      <NextActionLink request={request} />
    </article>
  );
}
