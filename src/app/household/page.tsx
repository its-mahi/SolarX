import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { RequestList } from "@/components/household/dashboard/request-list";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Your dashboard" };

export default function HouseholdHome() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Your dashboard</h1>
        <Button asChild size="lg" className="h-11">
          <Link href="/household/requests/new">
            <PlusCircle aria-hidden />
            New request
          </Link>
        </Button>
      </div>
      <RequestList />
    </div>
  );
}
