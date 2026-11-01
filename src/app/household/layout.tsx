import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requirePageRole } from "@/lib/api/auth-guard";

export default async function HouseholdLayout({ children }: { children: ReactNode }) {
  const { profile } = await requirePageRole("household", "/household");
  return <AppShell profile={profile}>{children}</AppShell>;
}
