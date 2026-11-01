"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";

type Props = { value: number; onChange: (kw: number) => void; min?: number; max?: number; step?: number; disabled?: boolean };

/** Labelled, keyboard-operable system-size picker for unsaved what-if previews. */
export function WhatIfCapacity({ value, onChange, min = 1, max = 10, step = 0.5, disabled }: Props) {
  const id = useId();
  const options: number[] = [];
  for (let kw = min; kw <= max + 1e-9; kw += step) options.push(Math.round(kw * 100) / 100);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Try a different system size</Label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full max-w-48 rounded-lg border border-input bg-background px-3 text-sm focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {options.map((kw) => (
          <option key={kw} value={kw}>
            {kw} kW
          </option>
        ))}
      </select>
    </div>
  );
}
