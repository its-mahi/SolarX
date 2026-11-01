import Link from "next/link";
import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { getOptionalSession } from "@/lib/api/auth-guard";
import { homePathForRole } from "@/lib/auth/redirects";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create an account · SURYAMIT" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SignUpPage({ searchParams }: Props) {
  const session = await getOptionalSession();
  const roleParam = (await searchParams).role;
  const initialRole = roleParam === "vendor" ? "vendor" : "household";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PublicHeader signedInRole={session?.profile.role ?? null} />
      <main id="main" className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold text-primary">Create your SURYAMIT account</h1>
        {session ? (
          <div className="mt-6 flex flex-col gap-4 rounded-xl border bg-card p-6">
            <p>
              You&apos;re signed in as <strong>{session.profile.name}</strong> — sign out first to create another account.
            </p>
            <Button asChild size="lg" className="w-fit">
              <Link href={homePathForRole(session.profile.role)}>Go to your dashboard</Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="mt-2 text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
            <SignUpForm initialRole={initialRole} />
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
