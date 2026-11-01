"use client";

import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { VendorDiscoveryContext, VendorRequestSummary } from "@/lib/validation/vendor-discovery";
import { formatDistance, formatInr, formatKw } from "@/components/vendor/format";

type Props = { items: VendorRequestSummary[]; context: VendorDiscoveryContext | null; onTileError?: () => void };

/** Spreads identical approximate positions slightly so every marker stays reachable. */
function spread(items: VendorRequestSummary[]) {
  const seen = new Map<string, number>();
  return items.map((it) => {
    const key = `${it.approx_latitude},${it.approx_longitude}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    const angle = n * 2.4;
    const r = n === 0 ? 0 : 0.0015 * Math.sqrt(n);
    return { it, pos: [it.approx_latitude + r * Math.cos(angle), it.approx_longitude + r * Math.sin(angle)] as [number, number] };
  });
}

export default function VendorRequestsMap({ items, context, onTileError }: Props) {
  const base: [number, number] | null =
    context && context.base_latitude !== null && context.base_longitude !== null ? [context.base_latitude, context.base_longitude] : null;
  const first = items[0];
  const center: [number, number] = base ?? (first ? [first.approx_latitude, first.approx_longitude] : [17.4, 78.45]);
  const markers = spread(items);

  return (
    <div role="region" aria-label="Map of open requests" className="h-[60vh] min-h-72 w-full overflow-hidden rounded-xl border">
      <MapContainer center={center} zoom={base ? 10 : 11} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{ tileerror: () => onTileError?.() }}
        />
        {base && context?.service_radius_km ? (
          <Circle center={base} radius={context.service_radius_km * 1000} pathOptions={{ color: "#166534", fillOpacity: 0.06 }} />
        ) : null}
        {base ? (
          <CircleMarker center={base} radius={9} pathOptions={{ color: "#1e3a8a", fillColor: "#3b82f6", fillOpacity: 1 }}>
            <Popup>Your base location</Popup>
          </CircleMarker>
        ) : null}
        {markers.map(({ it, pos }) => (
          <CircleMarker key={it.id} center={pos} radius={8} pathOptions={{ color: "#14532d", fillColor: "#eab308", fillOpacity: 0.95 }} className="request-marker">
            <Popup>
              <div className="flex flex-col gap-1 text-sm">
                <strong>{it.locality ?? "Locality not provided"}</strong>
                <span>{formatDistance(it.distance_km)} · {formatKw(it.preferred_capacity_kw)}</span>
                <span>Budget {formatInr(it.budget)}</span>
                <Link href={`/vendor/requests/${it.id}`} className="font-semibold underline">View details</Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
