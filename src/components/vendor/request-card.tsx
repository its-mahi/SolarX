import Link from "next/link";
import { DemoBadge } from "@/components/shared/demo-badge";
import type { VendorRequestSummary } from "@/lib/validation/vendor-discovery";
import { formatDistance, formatInr, formatKw, formatPosted } from "./format";

export function RequestCard({ item, search = "" }: { item: VendorRequestSummary; search?: string }) {
  return (
    <li className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">{item.locality ?? "Locality not provided"}</h3>
        {item.is_demo ? <DemoBadge /> : null}
        {item.status === "quoted" ? (
          <span className="inline-flex rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">Has quotes</span>
        ) : null}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <div><dt className="text-muted-foreground">Distance</dt><dd className="font-medium">{formatDistance(item.distance_km)}</dd></div>
        <div><dt className="text-muted-foreground">Monthly units</dt><dd className="font-medium">{item.monthly_units ?? "Not provided"}</dd></div>
        <div><dt className="text-muted-foreground">Budget</dt><dd className="font-medium">{formatInr(item.budget)}</dd></div>
        <div><dt className="text-muted-foreground">Preferred capacity</dt><dd className="font-medium">{formatKw(item.preferred_capacity_kw)}</dd></div>
      </dl>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">Posted {formatPosted(item.created_at)}</span>
        <Link
          href={`/vendor/requests/${item.id}${search ? `?from=${encodeURIComponent(search)}` : ""}`}
          className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4"
        >
          View details<span className="sr-only"> for {item.locality ?? "this request"}</span>
        </Link>
      </div>
    </li>
  );
}
