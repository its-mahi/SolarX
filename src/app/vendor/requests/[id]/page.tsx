import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RequestDetail } from "@/components/vendor/request-detail";

export default async function VendorRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  // `from` is the dashboard query string only; keep just known-safe characters.
  const query = typeof from === "string" && /^[\w=&.%,-]*$/.test(from) ? from : "";
  return (
    <div className="flex flex-col gap-4">
      <Link href={`/vendor${query ? `?${query}` : ""}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline underline-offset-4">
        <ArrowLeft aria-hidden className="size-4" /> Back to open requests
      </Link>
      <RequestDetail requestId={id} />
    </div>
  );
}
