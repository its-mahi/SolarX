import "server-only";
import type { AiCallMeta, AiFailureKind } from "./types";

/** One metadata-only line per AI call: never input, output, keys, paths or user ids. */
export function logAiCall(meta: AiCallMeta, outcome: "ok" | AiFailureKind): void {
  const line = JSON.stringify({
    event: "ai.call",
    at: new Date().toISOString(),
    task: meta.task,
    provider: meta.provider,
    model: meta.model,
    promptVersion: meta.promptVersion,
    outcome,
    attempts: meta.attempts,
    durationMs: meta.durationMs,
  });
  if (outcome === "ok") console.info(line);
  else console.warn(line);
}
