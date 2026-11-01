import { ShieldCheck } from "lucide-react";

/** What vendors can and cannot see (contracts/ui-extension-slots.md). */
export function PrivacyNotice() {
  return (
    <div className="flex gap-3 rounded-lg border bg-secondary/40 p-4 text-sm">
      <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
      <p>
        <strong>Vendors will see:</strong> your approximate location (about 1 km), locality, monthly units, budget, preferred capacity
        and roof photo. <strong>Vendors will not see</strong> your exact address, map pin, name or phone number unless you accept
        their quote.
      </p>
    </div>
  );
}
