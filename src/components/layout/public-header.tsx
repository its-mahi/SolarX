import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { homePathForRole } from "@/lib/auth/redirects";
import type { Role } from "@/lib/validation/enums";

type Props = { signedInRole?: Role | null };

export function PublicHeader({ signedInRole }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b bg-card">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3 px-4">
        <BrandLogo />
        <nav aria-label="Account" className="flex items-center gap-2">
          {signedInRole ? (
            <Button asChild size="lg">
              <Link href={homePathForRole(signedInRole)}>Go to your dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="lg">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="lg">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
