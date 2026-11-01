// Vendor quote page. Works by URL; spec 004's request detail links here.
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteSubmission } from "@/components/quotes/quote-submission";
import { RequestStatusBadge } from "@/components/shared/request-status-badge";
import { requirePageRole } from "@/lib/api/auth-guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { quoteIdParamSchema } from "@/lib/validation/quote";
import type { RequestStatus } from "@/lib/validation/enums";

export const dynamic = "force-dynamic";

export default async function VendorQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const parsed = quoteIdParamSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const { id } = parsed.data;
  await requirePageRole("vendor", `/vendor/requests/${id}/quote`);

  const { supabase } = await createServerSupabase();
  const { data } = await supabase.rpc("vendor_get_open_request", { p_request_id: id });
  const row = data?.[0];
  if (!row) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href={`/vendor/requests/${id}`} className="text-sm text-primary underline-offset-4 hover:underline">
          Back to request
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Send a quote</h1>
          <RequestStatusBadge status={row.status as RequestStatus} />
        </div>
      </div>
      <QuoteSubmission
        requestId={id}
        request={{
          locality: row.locality,
          monthly_units: row.monthly_units,
          budget_inr: row.budget,
          preferred_capacity_kw: row.preferred_capacity_kw === null ? null : Number(row.preferred_capacity_kw),
        }}
      />
    </div>
  );
}
