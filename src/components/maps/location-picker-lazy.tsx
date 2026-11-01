"use client";

import dynamic from "next/dynamic";
import { LoadingState } from "@/components/shared/loading-state";

export const LocationPickerLazy = dynamic(() => import("./location-picker").then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <LoadingState label="Loading map…" variant="card" />,
});
