import Link from "next/link";
import { renderDisclaimers, type AdvisorDisclaimer } from "@/lib/domain/advisor/disclaimers";

/** Always rendered. Uses the response's texts, or the static list while loading. */
export function AdvisorDisclaimers({ disclaimers }: { disclaimers?: AdvisorDisclaimer[] }) {
  const items = disclaimers ?? renderDisclaimers(null);
  return (
    <section aria-labelledby="advisor-disclaimers" className="rounded-xl border border-border bg-muted/50 p-4 text-sm">
      <h2 id="advisor-disclaimers" className="font-semibold">
        Please note
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {items.map((d) => (
          <li key={d.code}>{d.text}</li>
        ))}
      </ul>
      <p className="mt-2">
        <Link href="/rules" className="font-medium text-primary underline underline-offset-2">
          See how estimates are calculated
        </Link>
      </p>
    </section>
  );
}
