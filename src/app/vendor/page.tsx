// Placeholder vendor home. Feature 004 replaces this with open-request discovery.
import { FileSearch } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function VendorHome() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Open requests</h1>
      <EmptyState
        icon={FileSearch}
        title="Open requests are coming next"
        description="Soon you will see households near your service area and send them structured quotes."
      />
    </div>
  );
}
