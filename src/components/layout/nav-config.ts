// Role navigation. Later features append items (002 "New request", 005 "My quotes").
import { FileSearch, LayoutDashboard, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/validation/enums";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  household: [{ href: "/household", label: "Dashboard", icon: LayoutDashboard }],
  vendor: [{ href: "/vendor", label: "Open requests", icon: FileSearch }],
};
