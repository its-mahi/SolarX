import Link from "next/link";
import { notFound } from "next/navigation";
import { AdvisorPanel } from "@/components/advisor/advisor-panel";
import { requirePageRole } from "@/lib/api/auth-guard";
import { uuidSchema } from "@/lib/validation/common";

export const metadata = { title: "Solar advisor" };

export default async function AdvisorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageRole("household", `/household/requests/${id}/advisor`);
  if (!uuidSchema.safeParse(id).success) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/household/requests/${id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-2">
        Back to your request
      </Link>
      <h1 className="text-2xl font-semibold">Solar advisor</h1>
      <p className="text-sm text-muted-foreground">
        A plain-language summary of your roof, your estimate and your quotes. Every number comes from SolarX&apos;s calculations.
      </p>
      <AdvisorPanel requestId={id} />
    </div>
  );
}
