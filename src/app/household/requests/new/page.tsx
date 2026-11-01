import type { Metadata } from "next";
import { RequestWizard } from "@/components/household/request-wizard/request-wizard";

export const metadata: Metadata = { title: "New solar request" };

export default function NewRequestPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">New solar request</h1>
      <RequestWizard initialRequest={null} />
    </div>
  );
}
