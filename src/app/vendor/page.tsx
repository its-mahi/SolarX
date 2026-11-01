// Vendor home: open-request discovery (spec 004).
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/loading-state";
import { VendorDiscovery } from "@/components/vendor/vendor-discovery";

export default function VendorHome() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Open requests</h1>
        {/* 005: quick route to the vendor's own quotes (T028) */}
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/vendor/quotes">My quotes</Link>
        </Button>
      </div>
      <Suspense fallback={<LoadingState label="Loading open requests…" />}>
        <VendorDiscovery />
      </Suspense>
    </div>
  );
}
