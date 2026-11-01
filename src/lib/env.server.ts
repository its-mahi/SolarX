// Server-only environment. Importing this from a Client Component fails the build.
import "server-only";
import { z } from "zod";

const booleanFlag = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DEMO_ACCOUNTS_ENABLED: booleanFlag,
  DEMO_ACCOUNT_PASSWORD: z.string().min(8).optional(),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  GROQ_MODEL: z.string().optional(),
  AI_TIMEOUT_MS: z.string().optional(),
  AI_MAX_RETRIES: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Parsed lazily so pages that never need secrets do not fail when they are absent. */
export function serverEnv(): ServerEnv {
  return serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DEMO_ACCOUNTS_ENABLED: process.env.DEMO_ACCOUNTS_ENABLED,
    DEMO_ACCOUNT_PASSWORD: process.env.DEMO_ACCOUNT_PASSWORD || undefined,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || undefined,
    GROQ_API_KEY: process.env.GROQ_API_KEY || undefined,
    GEMINI_MODEL: process.env.GEMINI_MODEL || undefined,
    GROQ_MODEL: process.env.GROQ_MODEL || undefined,
    AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS || undefined,
    AI_MAX_RETRIES: process.env.AI_MAX_RETRIES || undefined,
  });
}

/** Demo toggle without requiring the service-role key (used by the landing page). */
export function demoAccountsEnabled(): boolean {
  return booleanFlag.parse(process.env.DEMO_ACCOUNTS_ENABLED || undefined);
}
