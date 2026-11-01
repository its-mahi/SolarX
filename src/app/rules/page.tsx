import type { Metadata } from "next";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { activeRuleSet } from "@/config/rules";
import { PublicHeader } from "@/components/layout/public-header";
import { SiteHeader } from "@/components/layout/site-header";
import { getOptionalSession } from "@/lib/api/auth-guard";
import { SiteFooter } from "@/components/layout/site-footer";
import { RulesTable } from "@/components/shared/rules-table";
import { calculateCentralCfa } from "@/lib/domain/financial";
import { CFA_EXAMPLE_CAPACITIES, OFFICIAL_REFERENCES } from "@/lib/rules-content";
import { ESTIMATE_DISCLAIMER } from "@/lib/validation/solar";

export const metadata: Metadata = { title: "Rules & sources · SURYAMIT" };

export default async function RulesPage() {
  const session = await getOptionalSession();
  const rules = Object.values(activeRuleSet.rules);
  const anyIllustrative = rules.some((r) => r.verification === "illustrative");
  const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {session ? (
        <SiteHeader
          profile={{ name: session.profile.name, role: session.profile.role, is_demo: session.profile.is_demo }}
        />
      ) : (
        <PublicHeader />
      )}
      <main id="main" className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-8 px-4 py-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-primary md:text-3xl">Rules &amp; sources</h1>
          <p className="max-w-prose text-muted-foreground">
            Every estimate in SURYAMIT is calculated by code from the rules below. {activeRuleSet.name}, version{" "}
            <strong className="font-semibold text-foreground">{activeRuleSet.version}</strong>.
          </p>
        </header>

        {anyIllustrative ? (
          <div role="note" className="flex gap-3 rounded-xl border-2 border-highlight bg-highlight/15 p-4">
            <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
            <p className="text-sm">
              <strong>Illustrative baseline — verify before demo.</strong> These values are planning placeholders, not
              official figures. They show as &quot;Pending verification&quot; until someone checks them against the official
              sources.
            </p>
          </div>
        ) : null}

        <section aria-labelledby="rules-heading" className="flex flex-col gap-3">
          <h2 id="rules-heading" className="text-xl font-semibold">
            All rules
          </h2>
          <RulesTable rules={rules} />
        </section>

        <section aria-labelledby="cfa-heading" className="flex flex-col gap-3">
          <h2 id="cfa-heading" className="text-xl font-semibold">
            Central subsidy examples
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground">Calculated from the same rules, so this table always matches the estimates.</p>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full max-w-md text-left text-sm">
              <caption className="sr-only">Illustrative central subsidy by system size</caption>
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    System size
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Illustrative central subsidy
                  </th>
                </tr>
              </thead>
              <tbody>
                {CFA_EXAMPLE_CAPACITIES.map((kw) => (
                  <tr key={kw} className="border-t">
                    <th scope="row" className="px-3 py-2 font-medium">
                      {kw} kW
                    </th>
                    <td className="px-3 py-2">{rupees(calculateCentralCfa(kw, activeRuleSet))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="refs-heading" className="flex flex-col gap-3">
          <h2 id="refs-heading" className="text-xl font-semibold">
            Official sources
          </h2>
          <ul className="flex flex-col gap-2">
            {OFFICIAL_REFERENCES.map((ref) => (
              <li key={ref.url}>
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
                >
                  {ref.title}
                  <ExternalLink aria-hidden className="size-3.5" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <p className="max-w-prose rounded-xl border bg-card p-4 text-sm">{ESTIMATE_DISCLAIMER}</p>
      </main>
      <SiteFooter />
    </div>
  );
}
