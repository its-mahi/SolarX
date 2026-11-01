import { ShieldCheck } from "lucide-react";

export function PrivacyNotice() {
  return (
    <p className="flex items-start gap-2 rounded-lg border bg-secondary/50 p-3 text-sm">
      <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>Exact address and contact details are shared only if the household accepts your quote. Location shown is approximate (≈1 km).</span>
    </p>
  );
}
