"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { DemoBadge } from "@/components/shared/demo-badge";
import { Button } from "@/components/ui/button";
import { homePathForRole } from "@/lib/auth/redirects";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/validation/enums";
import { NAV_ITEMS } from "./nav-config";
import { UserMenu } from "./user-menu";

type Props = { profile: { name: string; role: Role; is_demo: boolean } };

export function SiteHeader({ profile }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV_ITEMS[profile.role];

  const links = items.map((item) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        onClick={() => setOpen(false)}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium",
          active ? "bg-mint text-primary" : "text-foreground hover:bg-muted",
        )}
      >
        <item.icon aria-hidden className="size-4" />
        {item.label}
      </Link>
    );
  });

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo href={homePathForRole(profile.role)} />
          {profile.is_demo ? <DemoBadge /> : null}
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {links}
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <UserMenu name={profile.name} role={profile.role} />
          <Button
            variant="ghost"
            size="icon-lg"
            className="md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden /> : <Menu aria-hidden />}
          </Button>
        </div>
      </div>
      {open ? (
        <nav id="mobile-nav" aria-label="Main" className="flex flex-col gap-1 border-t px-4 py-2 md:hidden">
          {links}
        </nav>
      ) : null}
    </header>
  );
}
