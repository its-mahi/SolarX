// Placeholder household home. Feature 002 replaces this with the household dashboard.
import { LayoutDashboard } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function HouseholdHome() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Your dashboard</h1>
      <EmptyState
        icon={LayoutDashboard}
        title="Your dashboard is coming next"
        description="Soon you will create a solar request here and compare the quotes vendors send you."
      />
    </div>
  );
}
