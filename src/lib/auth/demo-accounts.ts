// Server-only map of demo keys to the fictional seeded accounts (research R-10).
import "server-only";
import type { DemoAccountKey } from "./demo-account-options";

export const DEMO_ACCOUNT_EMAILS: Record<DemoAccountKey, string> = {
  household: "demo-household@example.com",
  "sunrise-energy": "demo-sunrise@example.com",
  "greenvolt-solar": "demo-greenvolt@example.com",
  "solartech-solutions": "demo-solartech@example.com",
};
