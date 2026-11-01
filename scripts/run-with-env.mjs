// Runs a Node script with the variables of an env file added to its environment.
// Usage: node scripts/run-with-env.mjs <env-file> <script> [args...]
// Used by `npm run build:test` / `start:test` so the test server talks to the LOCAL Supabase even when
// .env.local points at the shared cloud project. (Node's --env-file flag cannot be used here: Next.js
// forwards it to its build workers, where it is rejected.) Variables already in the environment, and
// those from .env.local, do not override these because Next never overrides existing process variables.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";

const [envFile, script, ...args] = process.argv.slice(2);
if (!envFile || !script) {
  console.error("Usage: node scripts/run-with-env.mjs <env-file> <script> [args...]");
  process.exit(2);
}

const parsed = dotenv.parse(readFileSync(envFile));
const child = spawn(process.execPath, [script, ...args], { stdio: "inherit", env: { ...process.env, ...parsed } });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
