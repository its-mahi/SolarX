// Number extraction and "recognised rounding" rules for the advisor fidelity check
// (specs/011 R5 step 4). Pure. Rounding is decimal-safe (no binary float drift).

export type ExtractedNumber = {
  /** The digits as written (commas removed), before any lakh/thousand multiplier. */
  raw: number;
  /** Multiplier from the suffix: 1 (none/percent), 1e3, 1e5, 1e7. */
  scale: number;
  /** raw * scale */
  value: number;
  source: string;
};

const TOLERANCE = 1e-9;
const SCALES: Record<string, number> = { lakh: 1e5, lac: 1e5, crore: 1e7, thousand: 1e3, k: 1e3, percent: 1, "%": 1 };

// A number not glued to a preceding letter (ignores v1, scoring.v1, A1), with optional suffix.
const NUMBER_RE = /(?<![A-Za-z])(\d+(?:,\d+)*(?:\.\d+)?)(?:\s*(lakh|lac|crore|thousand|percent)\b|(k)(?![A-Za-z])|(%))?/gi;

export function extractNumbers(text: string): ExtractedNumber[] {
  const out: ExtractedNumber[] = [];
  for (const m of text.matchAll(NUMBER_RE)) {
    const raw = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(raw)) continue;
    const suffix = (m[2] ?? m[3] ?? m[4] ?? "").toLowerCase();
    const scale = suffix ? SCALES[suffix] : 1;
    out.push({ raw, scale, value: raw * scale, source: m[0] });
  }
  return out;
}

/** Decimal-safe rounding to d places. */
export function roundTo(x: number, d: number): number {
  const s = String(x);
  if (s.includes("e")) return Number(x.toFixed(d));
  return Number(`${Math.round(Number(`${s}e${d}`))}e-${d}`);
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Rounded forms of x in units of `scale` (scale 1: the value itself). */
function roundedForms(x: number, scale: number): number[] {
  if (scale > 1 && Math.abs(x) < 1000) return [];
  const v = scale === 1 ? x : x / scale;
  return [v, roundTo(v, 0), roundTo(v, 1), roundTo(v, 2)];
}

/** Loose set of every recognised form of x: itself, roundings, lakh/thousand/crore forms. */
export function allowedVariants(x: number): number[] {
  const out = roundedForms(x, 1);
  const abs = Math.abs(x);
  if (abs >= 1000) out.push(...roundedForms(x, 1e3));
  if (abs >= 1000) out.push(...roundedForms(x, 1e5));
  if (abs >= 1e7) out.push(...roundedForms(x, 1e7));
  return out;
}

/** Loose check: is n one of the recognised forms of any value? */
export function isAllowed(n: number, values: number[]): boolean {
  return values.some((x) => allowedVariants(x).some((v) => near(v, n)));
}

/** Strict check for an extracted token: its suffix must match the scale used to round the value. */
export function isTokenAllowed(token: ExtractedNumber, values: number[]): boolean {
  return values.some((x) => roundedForms(x, token.scale).some((v) => near(v, token.raw)));
}
