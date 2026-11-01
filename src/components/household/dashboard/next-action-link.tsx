import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { HouseholdRequestDto } from "@/lib/validation/requests";

export function nextActionHref(request: Pick<HouseholdRequestDto, "id" | "next_action">): string {
  const base = `/household/requests/${request.id}`;
  const { kind, step } = request.next_action;
  if (kind === "continue") return `${base}?step=${step ?? "review"}`;
  if (kind === "compare") return `${base}/quotes`;
  return base;
}

export function NextActionLink({ request }: { request: Pick<HouseholdRequestDto, "id" | "next_action"> }) {
  const { kind, label } = request.next_action;
  if (kind === "wait") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">{label}</span>
        <Button asChild variant="outline" size="lg" className="h-11">
          <Link href={nextActionHref(request)}>View request</Link>
        </Button>
      </div>
    );
  }
  return (
    <Button asChild size="lg" className="h-11 w-fit">
      <Link href={nextActionHref(request)}>{label}</Link>
    </Button>
  );
}
