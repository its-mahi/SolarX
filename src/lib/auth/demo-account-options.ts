// Client-safe list of demo accounts: keys, labels and roles only (no emails, no passwords).
import type { Role } from "@/lib/validation/enums";

export const DEMO_ACCOUNT_KEYS = ["household", "sunrise-energy", "greenvolt-solar", "solartech-solutions"] as const;
export type DemoAccountKey = (typeof DEMO_ACCOUNT_KEYS)[number];

export const DEMO_ACCOUNT_OPTIONS: { key: DemoAccountKey; label: string; role: Role }[] = [
  { key: "household", label: "Try as demo household — Sharma Residence", role: "household" },
  { key: "sunrise-energy", label: "Demo vendor — SunRise Energy", role: "vendor" },
  { key: "greenvolt-solar", label: "Demo vendor — GreenVolt Solar", role: "vendor" },
  { key: "solartech-solutions", label: "Demo vendor — SolarTech Solutions", role: "vendor" },
];
