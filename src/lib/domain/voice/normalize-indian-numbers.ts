// Deterministic Indian-number normalizer (specs/010 research R4). Pure: no I/O, no AI.
// Finds every numeric mention (digits in Latin/Devanagari/Gujarati, Indian or Western grouping,
// number words, lakh/crore/hazaar multipliers, sava/dedh/dhai/saade/paune fractions, "2k").
import { isQuantityWord, lookupNumberWord, type WordEntry } from "./indian-number-lexicon";

export type NumberMention = {
  value: number;
  /** Offsets into `normalizeTranscriptText(text)`. */
  start: number;
  end: number;
  raw: string;
};

const DEVANAGARI_ZERO = 0x0966;
const GUJARATI_ZERO = 0x0ae6;

/** NFC, and Devanagari/Gujarati digits mapped to 0-9 (character for character, so offsets hold). */
export function normalizeTranscriptText(text: string): string {
  return text.normalize("NFC").replace(/[०-९૦-૯]/g, (ch) => {
    const code = ch.charCodeAt(0);
    return String(code >= GUJARATI_ZERO ? code - GUJARATI_ZERO : code - DEVANAGARI_ZERO);
  });
}

const INDIAN_GROUPED = /\d{1,2}(?:,\d{2})*,\d{3}(?!\d|,\d)/y;
const WESTERN_GROUPED = /\d{1,3}(?:,\d{3})+(?!\d|,\d)/y;
const PLAIN = /\d+(?:\.\d+)?/y;
const WORD = /[\p{L}\p{M}]+/uy;
const SEPARATOR = /^[\s-]*$/;
const LETTER = /[\p{L}\p{M}]/u;

type Element =
  | { kind: "num"; value: number; start: number; end: number; digit: boolean; tens: boolean; ambiguous: boolean }
  | { kind: "mult"; value: number; start: number; end: number }
  | { kind: "frac"; frac: number; start: number; end: number };

function sticky(re: RegExp, text: string, at: number): string | null {
  re.lastIndex = at;
  const m = re.exec(text);
  return m ? m[0] : null;
}

function scan(text: string): Element[] {
  const out: Element[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch >= "0" && ch <= "9") {
      const raw = sticky(INDIAN_GROUPED, text, i) ?? sticky(WESTERN_GROUPED, text, i) ?? sticky(PLAIN, text, i)!;
      const end = i + raw.length;
      out.push({ kind: "num", value: Number(raw.replace(/,/g, "")), start: i, end, digit: true, tens: false, ambiguous: false });
      i = end;
      // "2k" = 2,000: k right after the digits and not the start of a longer word (kw, kwh).
      if ((text[i] === "k" || text[i] === "K") && !LETTER.test(text[i + 1] ?? "")) {
        out.push({ kind: "mult", value: 1000, start: i, end: i + 1 });
        i += 1;
      }
      continue;
    }
    const word = LETTER.test(ch) ? sticky(WORD, text, i) : null;
    if (word) {
      const end = i + word.length;
      const entry: WordEntry | undefined = lookupNumberWord(word);
      if (entry?.kind === "num") {
        out.push({ kind: "num", value: entry.value, start: i, end, digit: false, tens: !!entry.tens, ambiguous: !!entry.ambiguous });
      } else if (entry?.kind === "mult") {
        out.push({ kind: "mult", value: entry.value, start: i, end });
      } else if (entry?.kind === "frac") {
        out.push({ kind: "frac", frac: entry.frac, start: i, end });
      }
      i = end;
      continue;
    }
    i += 1;
  }
  return out;
}

type Builder = {
  start: number;
  end: number;
  total: number;
  current: number;
  lastBig: number;
  last: "num" | "mult" | "frac";
  lastTens: boolean;
  lastDigit: boolean;
  pendingFrac: number | null;
  hasDigit: boolean;
  hasMult: boolean;
  onlyAmbiguous: boolean;
  invalid: boolean;
};

function open(el: Element): Builder {
  return {
    start: el.start,
    end: el.end,
    total: 0,
    current: 0,
    lastBig: Infinity,
    last: "frac",
    lastTens: false,
    lastDigit: false,
    pendingFrac: null,
    hasDigit: false,
    hasMult: false,
    onlyAmbiguous: true,
    invalid: false,
  };
}

const clean = (n: number) => Math.round(n * 1e6) / 1e6;

export function normalizeIndianNumbers(input: string): NumberMention[] {
  const text = normalizeTranscriptText(input);
  const elements = scan(text);
  const mentions: NumberMention[] = [];
  let b: Builder | null = null;

  const flush = () => {
    if (!b) return;
    const done = b;
    b = null;
    if (done.invalid || done.pendingFrac !== null) return;
    const value = clean(done.total + done.current);
    if (!Number.isFinite(value) || value < 0) return;
    if (done.onlyAmbiguous && !done.hasDigit && !done.hasMult) {
      // A lone "do"/"be"/"one" is a number only when a quantity word follows ("do kilowatt").
      const next = /^\s+([\p{L}\p{M}]+)/u.exec(text.slice(done.end));
      if (!next || !isQuantityWord(next[1])) return;
    }
    mentions.push({ value, start: done.start, end: done.end, raw: text.slice(done.start, done.end) });
  };

  for (const el of elements) {
    if (b && !SEPARATOR.test(text.slice(b.end, el.start))) flush();

    if (el.kind === "num") {
      if (b && b.last === "num") {
        const tensPlusUnit = b.lastTens && !b.lastDigit && !el.digit && el.value >= 1 && el.value < 10;
        if (!tensPlusUnit) flush();
      }
      if (b && b.last === "frac" && b.pendingFrac === null) flush();
      b ??= open(el);
      b.current += el.value + (b.pendingFrac ?? 0);
      b.pendingFrac = null;
      b.last = "num";
      b.lastTens = el.tens;
      b.lastDigit = el.digit;
      b.hasDigit ||= el.digit;
      b.onlyAmbiguous &&= el.ambiguous;
    } else if (el.kind === "frac") {
      if (b && (b.last === "num" || b.last === "frac")) flush();
      b ??= open(el);
      b.pendingFrac = el.frac;
      b.last = "frac";
      b.onlyAmbiguous = false;
    } else {
      b ??= open(el);
      b.hasMult = true;
      b.onlyAmbiguous = false;
      if (b.pendingFrac !== null) {
        if (b.current === 0) b.current = 1 + b.pendingFrac;
        else b.invalid = true;
        b.pendingFrac = null;
      }
      if (b.last === "mult") {
        b.invalid = true; // "lakh hazaar", "sau sau"
      } else if (el.value === 100) {
        b.current = (b.current || 1) * 100;
      } else if (el.value >= b.lastBig) {
        b.invalid = true; // "hazaar lakh": scales must decrease
      } else {
        b.total += (b.current || 1) * el.value;
        b.current = 0;
        b.lastBig = el.value;
      }
      b.last = "mult";
    }
    if (b) b.end = el.end;
  }
  flush();
  return mentions;
}
