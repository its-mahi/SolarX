import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requirePageRole } from "@/lib/api/auth-guard";

export default async function VendorLayout({ children }: { children: ReactNode }) {
  const { profile } = await requirePageRole("vendor", "/vendor");
  return <AppShell profile={profile}>{children}</AppShell>;
}
