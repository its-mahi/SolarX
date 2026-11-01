import Link from "next/link";
import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { DemoAccountButtons } from "@/components/shared/demo-account-buttons";
import { redirectIfSignedIn } from "@/lib/api/auth-guard";
import { demoAccountsEnabled } from "@/lib/env.server";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in · SURYAMIT" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ searchParams }: Props) {
  await redirectIfSignedIn();
  const nextParam = (await searchParams).next;
  const next = typeof nextParam === "string" ? nextParam : undefined;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PublicHeader />
      <main id="main" className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold text-primary">Sign in to SURYAMIT</h1>
        <p className="mt-2 text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
        <SignInForm next={next} />
        {demoAccountsEnabled() ? (
          <section aria-labelledby="demo-heading" className="mt-8 flex flex-col gap-3">
            <h2 id="demo-heading" className="text-lg font-semibold">
              Or explore with a demo account
            </h2>
            <p className="text-sm text-muted-foreground">Fictional demo data. Vendors shown are not real or verified installers.</p>
            <DemoAccountButtons next={next} />
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
