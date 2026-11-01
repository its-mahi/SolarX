"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { Role } from "@/lib/validation/enums";

type Props = { name: string; role: Role };

export function UserMenu({ name, role }: Props) {
  const router = useRouter();

  async function signOut() {
    // Local scope: demo accounts are shared, so signing out must not end other people's sessions.
    const { error } = await createBrowserSupabase().auth.signOut({ scope: "local" });
    if (error) {
      toast.error("We couldn't sign you out. Please try again.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="lg" className="max-w-[14rem] gap-2" aria-label={`Account menu for ${name}`}>
          <UserRound aria-hidden />
          <span className="truncate">{name}</span>
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-semibold">{name}</span>
          <span className="text-xs font-normal text-muted-foreground">{role === "household" ? "Household" : "Vendor"}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserRound aria-hidden /> Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut}>
          <LogOut aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
