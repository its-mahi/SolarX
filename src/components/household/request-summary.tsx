// Read-only request page for published requests (and the host of five extension slots).
import {
  AdvisorShortcutSlot,
  RequestAcceptanceSlot,
  RequestEstimateSlot,
  RequestQuotesSlot,
  RoofAnalysisSlot,
} from "@/components/household/extension-slots";
import { StaticLocationMap } from "@/components/maps/static-location-map";
import { RequestStatusBadge } from "@/components/shared/request-status-badge";
import { SlotBoundary } from "@/components/shared/slot-boundary";
import { formatDate, formatInr, formatKw, formatUnits } from "@/lib/format";
import type { HouseholdRequestDto } from "@/lib/validation/requests";
import { ConsentControl } from "./consent-control";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </>
  );
}

export function RequestSummary({ request }: { request: HouseholdRequestDto }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{request.locality ?? "Your solar request"}</h1>
        <RequestStatusBadge status={request.status} />
      </div>
      <p className="-mt-3 text-sm text-muted-foreground">Created {formatDate(request.created_at)}</p>

      <SlotBoundary name="acceptance">
        <RequestAcceptanceSlot request={request} />
      </SlotBoundary>
      <SlotBoundary name="quotes-detail">
        <RequestQuotesSlot request={request} variant="detail" />
      </SlotBoundary>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-labelledby="loc-h">
        <h2 id="loc-h" className="font-semibold">
          Location
        </h2>
        {request.latitude !== null && request.longitude !== null ? <StaticLocationMap latitude={request.latitude} longitude={request.longitude} /> : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <Row label="Address" value={request.address_text ?? "—"} />
          <Row label="Locality" value={request.locality ?? "—"} />
        </dl>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-labelledby="use-h">
        <h2 id="use-h" className="font-semibold">
          Usage and budget
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <Row label="Monthly use" value={request.monthly_units === null ? "—" : formatUnits(request.monthly_units)} />
          <Row label="Monthly bill" value={request.monthly_bill === null ? "—" : formatInr(request.monthly_bill)} />
          <Row label="Budget" value={request.budget === null ? "—" : formatInr(request.budget)} />
          <Row label="Preferred capacity" value={formatKw(request.preferred_capacity_kw)} />
        </dl>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-labelledby="photo-h">
        <h2 id="photo-h" className="font-semibold">
          Roof photo
        </h2>
        {request.roof_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
          <img src={request.roof_photo_url} alt="Your roof photo" className="max-h-72 w-full rounded-lg border bg-muted object-contain" />
        ) : (
          <p className="text-sm text-muted-foreground">{request.has_roof_photo ? "Photo saved." : "No photo added."}</p>
        )}
        <ConsentControl requestId={request.id} aiConsent={request.ai_consent} />
      </section>

      <SlotBoundary name="estimate-detail">
        <RequestEstimateSlot request={request} variant="detail" />
      </SlotBoundary>
      <SlotBoundary name="roof-analysis-detail">
        <RoofAnalysisSlot requestId={request.id} hasRoofPhoto={request.has_roof_photo} aiConsent={request.ai_consent} status={request.status} variant="detail" />
      </SlotBoundary>
      <SlotBoundary name="advisor-detail">
        <AdvisorShortcutSlot request={request} variant="detail" />
      </SlotBoundary>
    </div>
  );
}
