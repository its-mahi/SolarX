import type { ReactNode } from "react";
import type { Role } from "@/lib/validation/enums";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type Props = { profile: { name: string; role: Role; is_demo: boolean }; children: ReactNode };

export function AppShell({ profile, children }: Props) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader profile={{ name: profile.name, role: profile.role, is_demo: profile.is_demo }} />
      <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 md:py-8">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
