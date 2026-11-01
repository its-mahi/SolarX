import { notFound } from "next/navigation";
import { RequestSummary } from "@/components/household/request-summary";
import { RequestWizard } from "@/components/household/request-wizard/request-wizard";
import { requirePageRole } from "@/lib/api/auth-guard";
import { isWizardStep } from "@/lib/domain/requests/wizard-steps";
import { dtoWithPhoto } from "@/lib/requests/present";
import { getOwnRequest } from "@/lib/requests/repository";
import { createServerSupabase } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";

export const metadata = { title: "Your solar request" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string | string[] }> };

export default async function RequestPage({ params, searchParams }: Props) {
  const [{ id }, { step }] = await Promise.all([params, searchParams]);
  await requirePageRole("household", `/household/requests/${id}`);
  if (!uuidSchema.safeParse(id).success) notFound();

  const { supabase } = await createServerSupabase();
  const row = await getOwnRequest(supabase, id);
  if (!row) notFound();
  const request = await dtoWithPhoto(supabase, row);

  if (request.status !== "draft") return <RequestSummary request={request} />;

  const wanted = Array.isArray(step) ? step[0] : step;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Your solar request</h1>
      <RequestWizard initialRequest={request} initialStep={isWizardStep(wanted) ? wanted : (request.next_action.step ?? "review")} />
    </div>
  );
}
