"use client";

import { useState } from "react";
import { FieldError } from "@/components/shared/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zodDetails } from "@/lib/api/errors";
import { FILTER_KEYS, vendorRequestFiltersSchema, type VendorDiscoveryContext } from "@/lib/validation/vendor-discovery";

export type FilterValues = Record<string, string>;
type Props = { values: FilterValues; context: VendorDiscoveryContext | null; onApply: (v: FilterValues) => void; onClear: () => void };

const CHIP_LABELS: Record<string, string> = {
  max_distance_km: "Distance", locality: "Locality", min_capacity_kw: "Min kW", max_capacity_kw: "Max kW",
  min_budget: "Min budget", max_budget: "Max budget", sort: "Sort",
};
const selectClass = "h-11 w-full rounded-lg border border-input bg-background px-2.5 text-base md:h-9 md:text-sm";
const inputClass = "h-11 md:h-9";

export function RequestFilters({ values, context, onApply, onClear }: Props) {
  const [draft, setDraft] = useState<FilterValues>(values);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const hasBase = !!context && context.base_latitude !== null;
  const radius = context?.service_radius_km ?? null;
  const distanceOptions = Array.from(new Set([5, 10, 25, 50, ...(radius ? [radius] : [])])).sort((a, b) => a - b);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned: FilterValues = {};
    for (const k of FILTER_KEYS) if (draft[k]?.trim()) cleaned[k] = draft[k].trim();
    const parsed = vendorRequestFiltersSchema.safeParse(cleaned);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const d of zodDetails(parsed.error)) next[d.path] ??= d.message;
      setErrors(next);
      return;
    }
    setErrors({});
    onApply(cleaned);
  }

  function clear() {
    setDraft({});
    setErrors({});
    onClear();
  }

  const active = FILTER_KEYS.filter((k) => k !== "sort" && values[k]);
  const field = (k: string, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`f-${k}`}>{label}</Label>
      <Input id={`f-${k}`} className={inputClass} value={draft[k] ?? ""} onChange={(e) => set(k, e.target.value)}
        aria-invalid={errors[k] ? true : undefined} aria-describedby={errors[k] ? `f-${k}-err` : undefined} {...props} />
      <FieldError id={`f-${k}-err`} message={errors[k]} />
    </div>
  );

  return (
    <form onSubmit={submit} noValidate aria-label="Filter requests" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      {!hasBase ? <p className="text-sm text-muted-foreground">Set your base location in your vendor profile to filter by distance.</p> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="f-max_distance_km">Max distance</Label>
          <select id="f-max_distance_km" className={selectClass} value={draft.max_distance_km ?? ""} disabled={!hasBase}
            onChange={(e) => set("max_distance_km", e.target.value)}>
            <option value="">{radius ? `My service radius (${radius} km)` : "Default"}</option>
            {distanceOptions.map((km) => <option key={km} value={String(km)}>{km} km</option>)}
            <option value="any">Any distance</option>
          </select>
          <FieldError id="f-max_distance_km-err" message={errors.max_distance_km} />
        </div>
        {field("locality", "Locality", { type: "text", maxLength: 100 })}
        {field("min_capacity_kw", "Min capacity (kW)", { inputMode: "decimal" })}
        {field("max_capacity_kw", "Max capacity (kW)", { inputMode: "decimal" })}
        {field("min_budget", "Min budget (₹)", { inputMode: "numeric" })}
        {field("max_budget", "Max budget (₹)", { inputMode: "numeric" })}
        <div className="flex flex-col gap-1">
          <Label htmlFor="f-sort">Sort by</Label>
          <select id="f-sort" className={selectClass} value={draft.sort ?? ""} onChange={(e) => set("sort", e.target.value)}>
            <option value="">Default</option>
            <option value="distance" disabled={!hasBase}>Nearest first</option>
            <option value="newest">Newest first</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg">Apply filters</Button>
        <Button type="button" variant="outline" size="lg" onClick={clear}>Clear filters</Button>
        {active.map((k) => (
          <span key={k} className="rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium">
            {CHIP_LABELS[k]}: {values[k]}
          </span>
        ))}
      </div>
    </form>
  );
}
