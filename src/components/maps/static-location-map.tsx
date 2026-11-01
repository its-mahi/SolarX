"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const Inner = dynamic(() => import("./static-location-map-inner").then((m) => m.StaticLocationMapInner), {
  ssr: false,
  loading: () => <Skeleton className="h-48 w-full" />,
});

/** Non-interactive map with one pin (owner views only; vendors never get exact coordinates). */
export function StaticLocationMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  return (
    <div role="img" aria-label="Map showing the pin for your location" className="overflow-hidden rounded-lg border">
      <Inner latitude={latitude} longitude={longitude} />
    </div>
  );
}
