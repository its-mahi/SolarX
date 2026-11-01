import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ComparisonWithAccept } from "@/components/quotes/comparison-with-accept";
import { requirePageRole } from "@/lib/api/auth-guard";
import { formatInr, formatKw } from "@/lib/format";
import { getOwnRequest } from "@/lib/requests/repository";
import { createServerSupabase } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";

export const metadata = { title: "Compare quotes" };

type Props = { params: Promise<{ id: string }> };

export default async function QuoteComparisonPage({ params }: Props) {
  const { id } = await params;
  await requirePageRole("household", `/household/requests/${id}/quotes`);
  if (!uuidSchema.safeParse(id).success) notFound();

  const { supabase } = await createServerSupabase();
  const request = await getOwnRequest(supabase, id);
  if (!request || request.status === "draft") notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href={`/household/requests/${id}`} className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
          <ArrowLeft aria-hidden className="size-4" />
          Back to your request
        </Link>
        <h1 className="text-2xl font-semibold">Compare quotes</h1>
        <p className="text-sm text-muted-foreground">
          {request.locality ?? "Your request"} · Budget {request.budget === null ? "not set" : formatInr(request.budget)} · Preferred capacity{" "}
          {request.preferred_capacity_kw === null ? "not set" : formatKw(Number(request.preferred_capacity_kw))}
        </p>
      </div>
      <ComparisonWithAccept requestId={id} />
    </div>
  );
}
