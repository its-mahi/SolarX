// Deterministic keyword parser (specs/010 research R3 step 1b, R5). Pure: no I/O, no AI.
// A number is assigned to a field only when a field keyword sits in the same clause with no
// other number between them. Anything ambiguous (ties, ranges, repeated values, yearly figures,
// corrections) is left empty and reported as an issue. Nothing is guessed.
import type { VoiceAiIssueKind, VoiceFieldKey } from "@/lib/validation/voice";
import { VOICE_FIELD_KEYS } from "@/lib/validation/voice";
import { normalizeIndianNumbers, normalizeTranscriptText, type NumberMention } from "./normalize-indian-numbers";

export type RuleIssue = { field: VoiceFieldKey; kind: VoiceAiIssueKind };
export type RuleParseResult = {
  fields: Partial<Record<VoiceFieldKey, number>>;
  issues: RuleIssue[];
  mentions: NumberMention[];
};

const KEYWORDS: Record<VoiceFieldKey, string[]> = {
  monthly_units: [
    "kilowatt[\\s-]*hours?", "kwh", "units?", "yunit", "यूनिट्स", "यूनिट", "यूनिटें", "युनिट", "યુનિટ્સ", "યુનિટ",
  ],
  monthly_bill: ["bijli bill", "light bill", "bill", "बिल", "બિલ"],
  budget: ["budget", "kharcha", "बजट", "खर्च", "ખર્ચ", "બજેટ"],
  preferred_capacity_kw: ["kilowatts?", "kilo watts?", "kw", "kv", "किलोवाट", "કિલોવોટ"],
};
const NOT_LETTER_BEFORE = "(?<![\\p{L}\\p{M}])";
const NOT_LETTER_AFTER = "(?![\\p{L}\\p{M}])";

type Hit = { field: VoiceFieldKey; start: number; end: number };

function findKeywords(text: string): Hit[] {
  const hits: Hit[] = [];
  const lower = text.toLowerCase(); // same length for these scripts
  for (const field of VOICE_FIELD_KEYS) {
    for (const kw of KEYWORDS[field]) {
      const re = new RegExp(`${NOT_LETTER_BEFORE}(?:${kw})${NOT_LETTER_AFTER}`, "gu");
      for (const m of lower.matchAll(re)) hits.push({ field, start: m.index, end: m.index + m[0].length });
    }
  }
  // Longest match wins where hits overlap ("kilowatt hour" over "kilowatt", "light bill" over "bill").
  hits.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const kept: Hit[] = [];
  for (const h of hits) if (!kept.some((k) => h.start < k.end && k.start < h.end)) kept.push(h);
  return kept.sort((a, b) => a.start - b.start);
}

const CLAUSE_BREAK = /[,.;|।!?\n]|(?<![\p{L}\p{M}])(?:और|aur|ane|and|અને)(?![\p{L}\p{M}])/u;
const CURRENCY = /(?<![\p{L}\p{M}])(?:rs|inr)\.?|₹/giu;

function sameClause(text: string, a: number, b: number): boolean {
  if (a >= b) return true;
  return !CLAUSE_BREAK.test(text.slice(a, b).replace(CURRENCY, " "));
}

const RANGE_CONNECTOR = /^\s*(?:-|–|—|to|se|से|થી|ya|या|or|અથવા)\s*$/iu;
const CORRECTION_GAP =
  /^[\s,.]*(?:(?:no|nahi|nahin|nahee|नहीं|नही|ના|actually|sorry|matlab|मतलब|i mean|wait|rather|बल्कि)[\s,.]*)+$/iu;
const YEARLY =
  /(?<![\p{L}\p{M}])(?:saal|saalana|salana|saal ka|varsh|varsha|year|yearly|annual|annually|annum|yr|साल|सालाना|वर्ष|વર્ષ|વાર્ષિક)(?![\p{L}\p{M}])/iu;

function clauseBounds(text: string, at: number): [number, number] {
  let s = at;
  while (s > 0 && !CLAUSE_BREAK.test(text.slice(s - 1, s))) s -= 1;
  let e = at;
  while (e < text.length && !CLAUSE_BREAK.test(text.slice(e, e + 1))) e += 1;
  return [s, e];
}

export function ruleParseTranscript(input: string): RuleParseResult {
  const text = normalizeTranscriptText(input);
  const mentions = normalizeIndianNumbers(text);
  const hits = findKeywords(text);
  const issues: RuleIssue[] = [];
  const addIssue = (field: VoiceFieldKey, kind: VoiceAiIssueKind) => {
    if (!issues.some((i) => i.field === field && i.kind === kind)) issues.push({ field, kind });
  };

  const consumed = new Set<number>(); // mention indexes already used by a range
  const bound = new Map<number, VoiceFieldKey>(); // mention index -> field
  const usedHits = new Set<number>();
  const blocked = new Set<number>(); // mentions left unassigned because of a tie

  // Gap between a mention (or mention group) and a keyword; null if not same clause or a number sits between.
  const candidate = (first: number, last: number, hitIndex: number): number | null => {
    const hit = hits[hitIndex];
    const lo = mentions[first];
    const hi = mentions[last];
    if (hit.end <= lo.start) {
      if (!sameClause(text, hit.end, lo.start)) return null;
      if (mentions.some((m, i) => (i < first || i > last) && m.start >= hit.end && m.end <= lo.start)) return null;
      return lo.start - hit.end;
    }
    if (hit.start >= hi.end) {
      if (!sameClause(text, hi.end, hit.start)) return null;
      if (mentions.some((m, i) => (i < first || i > last) && m.start >= hi.end && m.end <= hit.start)) return null;
      return hit.start - hi.end;
    }
    return null;
  };

  // 1. Ranges: "1 se 1.5 lakh budget".
  for (let i = 0; i + 1 < mentions.length; i++) {
    if (!RANGE_CONNECTOR.test(text.slice(mentions[i].end, mentions[i + 1].start))) continue;
    let best: { gap: number; h: number } | null = null;
    let tie = false;
    hits.forEach((_, h) => {
      const gap = candidate(i, i + 1, h);
      if (gap === null) return;
      if (!best || gap < best.gap) {
        best = { gap, h };
        tie = false;
      } else if (gap === best.gap) tie = true;
    });
    consumed.add(i);
    consumed.add(i + 1);
    const found = best as { gap: number; h: number } | null;
    if (found && !tie) addIssue(hits[found.h].field, "range");
    i += 1;
  }

  // 2. Greedy one-to-one binding by smallest gap; ties are left unassigned.
  const pairs: Array<{ m: number; h: number; gap: number }> = [];
  mentions.forEach((_, m) => {
    if (consumed.has(m)) return;
    hits.forEach((__, h) => {
      const gap = candidate(m, m, h);
      if (gap !== null) pairs.push({ m, h, gap });
    });
  });
  pairs.sort((a, b) => a.gap - b.gap);
  for (let p = 0; p < pairs.length; p++) {
    const pair = pairs[p];
    if (bound.has(pair.m) || blocked.has(pair.m) || usedHits.has(pair.h)) continue;
    const tied = pairs.some(
      (o) => o !== pair && o.gap === pair.gap && !bound.has(o.m) && !usedHits.has(o.h) && (o.m === pair.m || o.h === pair.h),
    );
    if (tied) {
      // Ambiguous: neither side may bind to anything else; the field stays empty.
      blocked.add(pair.m);
      usedHits.add(pair.h);
      continue;
    }
    bound.set(pair.m, hits[pair.h].field);
    usedHits.add(pair.h);
  }

  // 3. Period: yearly figures for units/bill are not monthly.
  for (const [m, field] of [...bound]) {
    if (field !== "monthly_units" && field !== "monthly_bill") continue;
    const [s, e] = clauseBounds(text, mentions[m].start);
    if (YEARLY.test(text.slice(s, e))) {
      bound.delete(m);
      addIssue(field, "not_monthly");
    }
  }

  // 4. Corrections: "bill 2000, no, 2500" leaves the field empty.
  for (let i = 0; i + 1 < mentions.length; i++) {
    if (!CORRECTION_GAP.test(text.slice(mentions[i].end, mentions[i + 1].start))) continue;
    const field = bound.get(i) ?? bound.get(i + 1);
    if (!field) continue;
    bound.delete(i);
    bound.delete(i + 1);
    addIssue(field, "multiple_values");
  }

  // 5. Collect per field.
  const values = new Map<VoiceFieldKey, Set<number>>();
  for (const [m, field] of bound) {
    if (!values.has(field)) values.set(field, new Set());
    values.get(field)!.add(mentions[m].value);
  }
  const fields: Partial<Record<VoiceFieldKey, number>> = {};
  for (const [field, set] of values) {
    if (set.size > 1) addIssue(field, "multiple_values");
    else if (!issues.some((i) => i.field === field)) fields[field] = [...set][0];
  }
  for (const i of issues) delete fields[i.field];
  return { fields, issues, mentions };
}
