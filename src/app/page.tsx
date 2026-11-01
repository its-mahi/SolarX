import Link from "next/link";
import { ClipboardList, Home, Scale, ShieldCheck, Store, Sun, Users } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { DemoAccountButtons } from "@/components/shared/demo-account-buttons";
import { Button } from "@/components/ui/button";
import { getOptionalSession } from "@/lib/api/auth-guard";
import { homePathForRole } from "@/lib/auth/redirects";
import { demoAccountsEnabled } from "@/lib/env.server";

const STEPS = [
  { icon: ClipboardList, title: "Publish your request", text: "Pin your home, add a terrace photo, your monthly units and budget." },
  { icon: Users, title: "Receive vendor quotes", text: "Vendors near you send structured quotations in one format." },
  { icon: Scale, title: "Compare clearly", text: "See price, components, warranty and estimated net cost side by side." },
  { icon: ShieldCheck, title: "Accept with confidence", text: "Choose one quote. Estimates are shown with their sources." },
];

export default async function LandingPage() {
  const session = await getOptionalSession();
  const role = session?.profile.role ?? null;
  const showDemo = demoAccountsEnabled();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PublicHeader signedInRole={role} />

      <main id="main" className="flex-1">
        <section className="border-b bg-card">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-12 md:py-16">
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-mint px-3 py-1 text-sm font-medium text-primary">
              <Sun aria-hidden className="size-4 text-solar" /> Rooftop solar under PM Surya Ghar
            </p>
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-balance text-primary md:text-5xl">
              Understand your roof. Compare your options. Choose solar with confidence.
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              SolarX helps households under PM Surya Ghar get comparable rooftop-solar quotations from vendors, with
              transparent, code-calculated estimates.
            </p>
            <div className="flex flex-wrap gap-3">
              {role ? (
                <Button asChild size="lg" className="h-11 px-5">
                  <Link href={homePathForRole(role)}>Go to your dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" className="h-11 px-5">
                    <Link href="/signup">Get started</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-11 px-5">
                    <Link href="/login">Sign in</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="how-it-works" className="mx-auto max-w-[1200px] px-4 py-12">
          <h2 id="how-it-works" className="text-2xl font-semibold text-foreground">
            How it works
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-2 rounded-xl border bg-card p-5">
                <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">{i + 1}</span>
                  <step.icon aria-hidden className="size-5 text-solar" />
                </span>
                <h3 className="font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Who SolarX is for" className="mx-auto grid max-w-[1200px] gap-4 px-4 pb-12 md:grid-cols-2">
          <article className="flex flex-col gap-3 rounded-xl border bg-card p-6">
            <Home aria-hidden className="size-7 text-solar" />
            <h2 className="text-xl font-semibold">For households</h2>
            <p className="text-muted-foreground">
              Describe your home and electricity use once, then compare vendor quotes with estimated subsidy and payback.
            </p>
            <div className="mt-auto flex flex-wrap gap-2">
              <Button asChild size="lg">
                <Link href="/signup?role=household">Sign up as a household</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </article>
          <article className="flex flex-col gap-3 rounded-xl border bg-card p-6">
            <Store aria-hidden className="size-7 text-solar" />
            <h2 className="text-xl font-semibold">For vendors</h2>
            <p className="text-muted-foreground">
              Find households near your service area who have already shared their roof, usage and budget, and send a
              structured quote.
            </p>
            <div className="mt-auto flex flex-wrap gap-2">
              <Button asChild size="lg">
                <Link href="/signup?role=vendor">Sign up as a vendor</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </article>
        </section>

        {showDemo ? (
          <section aria-labelledby="demo-heading" className="border-t bg-mint/50">
            <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-10">
              <h2 id="demo-heading" className="text-xl font-semibold">
                Explore with demo accounts
              </h2>
              <p className="text-sm text-muted-foreground">
                Fictional demo data. Vendors shown are not real or verified installers.
              </p>
              <DemoAccountButtons />
            </div>
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  );
}
