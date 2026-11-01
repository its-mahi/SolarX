"use client";
// Editable review of what was understood. Nothing is applied until "Use these values".
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { checkFieldValue } from "@/lib/domain/voice/field-bounds";
import type { UsageFields } from "@/lib/validation/requests";
import {
  VOICE_FIELD_KEYS,
  type VoiceFieldKey,
  type VoiceFieldNote,
  type VoiceParseResponse,
} from "@/lib/validation/voice";

const LABELS: Record<VoiceFieldKey, { label: string; unit: string }> = {
  monthly_units: { label: "Monthly electricity use", unit: "kWh/month" },
  monthly_bill: { label: "Monthly electricity bill", unit: "₹/month" },
  budget: { label: "Budget", unit: "₹" },
  preferred_capacity_kw: { label: "Preferred system size", unit: "kW" },
};

const NOTES: Record<VoiceFieldNote, string> = {
  conflict: "We heard two different values. Please enter the right one.",
  not_in_transcript: "We could not confirm this from what you said. Please enter it.",
  out_of_range: "That value looks out of range. Please check it.",
  range: "You gave a range. Please enter one value.",
  multiple_values: "You gave more than one value. Please enter one.",
  not_monthly: "That was not a monthly figure. Please enter the monthly value.",
  invalid_format: "That value is not in a usable format. Please check it.",
};

const inr = new Intl.NumberFormat("en-IN");

function parseEntry(raw: string): number | null {
  const cleaned = raw.replace(/[,\s₹]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function VoiceReviewCard({
  result,
  transcript,
  onUse,
  onDiscard,
  disabled,
}: {
  result: VoiceParseResponse;
  transcript: string;
  onUse: (values: Partial<UsageFields>) => void;
  onDiscard: () => void;
  disabled?: boolean;
}) {
  const [entries, setEntries] = useState<Record<VoiceFieldKey, string>>(() => {
    const init = {} as Record<VoiceFieldKey, string>;
    for (const k of VOICE_FIELD_KEYS) {
      const f = result.fields[k];
      init[k] = f.status === "heard" && f.value !== null ? String(f.value) : "";
    }
    return init;
  });
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  const checked = useMemo(() => {
    const out = {} as Record<VoiceFieldKey, "empty" | "ok" | "bad">;
    for (const k of VOICE_FIELD_KEYS) {
      const n = parseEntry(entries[k]);
      out[k] = entries[k].trim() === "" ? "empty" : n !== null && checkFieldValue(k, n) === "ok" ? "ok" : "bad";
    }
    return out;
  }, [entries]);
  const okCount = VOICE_FIELD_KEYS.filter((k) => checked[k] === "ok").length;
  const anyBad = VOICE_FIELD_KEYS.some((k) => checked[k] === "bad");

  function use() {
    const values: Partial<UsageFields> = {};
    for (const k of VOICE_FIELD_KEYS) {
      const n = parseEntry(entries[k]);
      if (checked[k] === "ok" && n !== null) values[k] = n;
    }
    onUse(values);
  }

  const aiNote = result.ai_status === "unavailable" || result.ai_status === "invalid_output" || result.ai_status === "not_configured";

  return (
    <section aria-labelledby="voice-review-heading" className="space-y-3 rounded-lg border bg-card p-4">
      <h3 id="voice-review-heading" ref={heading} tabIndex={-1} className="text-base font-semibold outline-none">
        Check what we understood
      </h3>
      <p className="text-sm text-muted-foreground">
        You said: <span lang={result.language.slice(0, 2)}>&ldquo;{transcript}&rdquo;</span>
      </p>
      {aiNote ? (
        <p role="note" className="text-sm">
          Only simple phrases with numbers could be understood right now. Check and fill in the rest.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {VOICE_FIELD_KEYS.map((k) => {
          const f = result.fields[k];
          const id = `voice-field-${k}`;
          const noteId = `${id}-note`;
          const message =
            checked[k] === "bad"
              ? "Enter a valid number for this field."
              : f.status === "needs_entry" && f.note && checked[k] === "empty"
                ? NOTES[f.note]
                : f.status === "not_heard" && checked[k] === "empty"
                  ? "Not heard"
                  : f.status === "heard"
                    ? `Heard${f.value !== null ? `: ${inr.format(f.value)}` : ""}`
                    : null;
          return (
            <div key={k} className="space-y-1">
              <label htmlFor={id} className="text-sm font-medium">
                {LABELS[k].label} <span className="font-normal text-muted-foreground">({LABELS[k].unit})</span>
              </label>
              <input
                id={id}
                inputMode="decimal"
                value={entries[k]}
                disabled={disabled}
                aria-invalid={checked[k] === "bad"}
                aria-describedby={noteId}
                onChange={(e) => setEntries((prev) => ({ ...prev, [k]: e.target.value }))}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <p id={noteId} className={checked[k] === "bad" ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>
                {message}
              </p>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-11 px-4" onClick={use} disabled={disabled || okCount === 0 || anyBad}>
          Use these values
        </Button>
        <Button type="button" variant="outline" className="h-11 px-4" onClick={onDiscard}>
          Discard
        </Button>
      </div>
    </section>
  );
}
