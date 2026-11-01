import { Skeleton } from "@/components/ui/skeleton";

export default function HouseholdLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading your dashboard" className="flex flex-col gap-4">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-36 w-full rounded-xl" />
    </div>
  );
}
