// "Keep an AI value only if its number appears in the transcript" (specs/010 R3).
import type { NumberMention } from "./normalize-indian-numbers";

export function isValueGrounded(value: number, mentions: readonly NumberMention[]): boolean {
  return mentions.some((m) => Math.abs(m.value - value) < 1e-9);
}
