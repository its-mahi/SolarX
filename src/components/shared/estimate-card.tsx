"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { EstimateBadge } from "@/components/shared/estimate-badge";
import { WhatIfCapacity } from "@/components/shared/what-if-capacity";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInr } from "@/lib/format";
import { ESTIMATE_DISCLAIMER, type SolarEstimateDto } from "@/lib/validation/solar";
import type { HouseholdRequestDto } from "@/lib/validation/requests";

type Props = { request: HouseholdRequestDto; variant: "review" | "detail" | "card"; showWhatIf?: boolean };

type CalcState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "ready"; estimate: SolarEstimateDto };

type Preview = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; estimate: SolarEstimateDto };

async function callCalculate(body: unknown): Promise<{ kind: "ok"; estimate: SolarEstimateDto } | { kind: "empty" } | { kind: "error" }> {
  try {
    const res = await fetch("/api/solar/calculate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 409) return { kind: "empty" };
    if (!res.ok) return { kind: "error" };
    const json = (await res.json()) as { data?: { estimate?: SolarEstimateDto } };
    return json.data?.estimate ? { kind: "ok", estimate: json.data.estimate } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

const BASIS_LABEL: Record<string, string> = {
  preferred: "your preferred size",
  recommended: "recommended for your usage",
  preview: "a size you are trying",
};
const TARIFF_LABEL: Record<string, string> = {
  default: "default tariff",
  derived_from_bill: "derived from your bill",
  derived_from_bill_clamped: "derived from your bill, limited to the supported range",
};

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 border-b py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold">{value}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
        <EstimateBadge kind="estimate" />
      </dd>
    </div>
  );
}

function paybackText(years: number | null): string {
  return years === null ? "Not applicable — no estimated savings" : `${years} years`;
}

function Figures({ e }: { e: SolarEstimateDto }) {
  return (
    <dl>
      <Row label="System size" value={`${e.capacityKw} kW`} hint={`${BASIS_LABEL[e.capacityBasis] ?? e.capacityBasis}; recommended ${e.recommendedCapacityKw} kW`} />
      <Row label="Installation cost (benchmark)" value={formatInr(e.installationCost)} />
      <Row label="Central subsidy" value={formatInr(e.subsidyEstimate)} />
      <Row label="Net cost after subsidy" value={formatInr(e.netCost)} />
      <Row label="Yearly generation" value={`${e.annualGenerationKwh.toLocaleString("en-IN")} kWh`} />
      <Row label="Yearly savings" value={formatInr(e.annualSavingsEstimate)} />
      <Row label="Payback" value={paybackText(e.paybackYears)} />
    </dl>
  );
}

function Assumptions({ e, open }: { e: SolarEstimateDto; open: boolean }) {
  const a = e.assumptions;
  return (
    <details open={open} className="rounded-lg border bg-background p-3 text-sm">
      <summary className="cursor-pointer font-medium">Assumptions behind these numbers</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
        <li>Monthly usage: {a.inputs.monthlyUnits} units ({a.annualConsumptionKwh.toLocaleString("en-IN")} kWh a year)</li>
        <li>Generation: {a.generationKwhPerKwYear} kWh per kW per year</li>
        <li>Benchmark cost: {formatInr(a.benchmarkCostPerKw)} per kW</li>
        <li>Tariff: ₹{a.tariffPerKwh}/kWh ({TARIFF_LABEL[a.tariffBasis] ?? a.tariffBasis})</li>
        <li>
          Self-consumed: {Math.round(a.selfConsumptionShare * 100)}% ({a.selfConsumedKwh.toLocaleString("en-IN")} kWh); exported{" "}
          {a.exportedKwh.toLocaleString("en-IN")} kWh at ₹{a.exportRatePerKwh}/kWh
        </li>
        <li>Central subsidy cap: {formatInr(a.cfaCap)}</li>
      </ul>
      {a.notes.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {a.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}

function Footer({ e, compact }: { e: SolarEstimateDto; compact: boolean }) {
  const illustrative = e.assumptions.illustrativeRuleKeys.length > 0;
  return (
    <div className="flex flex-col gap-2 text-xs text-muted-foreground">
      <p>
        Rule version <span className="font-medium text-foreground">{e.ruleVersion}</span>
        {illustrative ? <span className="ml-2 rounded-full border border-highlight bg-highlight/15 px-2 py-0.5 font-semibold text-foreground">Illustrative</span> : null}
        {" · "}
        <Link href="/rules" className="font-medium text-primary underline-offset-4 hover:underline">
          Rules & sources
        </Link>
      </p>
      {compact ? <p>Estimate only; subsidy is not guaranteed.</p> : <p>{ESTIMATE_DISCLAIMER}</p>}
    </div>
  );
}

/** Indicative, code-calculated estimate for one request (contracts/rules.md UI contract). */
export function EstimateCard({ request, variant, showWhatIf }: Props) {
  const { id, monthly_units, monthly_bill, budget, preferred_capacity_kw } = request;
  const inputsKey = useMemo(
    () => JSON.stringify([monthly_units, monthly_bill, budget, preferred_capacity_kw]),
    [monthly_units, monthly_bill, budget, preferred_capacity_kw],
  );
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${id}|${inputsKey}|${attempt}`;
  const [result, setResult] = useState<{ key: string; state: Exclude<CalcState, { status: "loading" }> } | null>(null);
  const [whatIf, setWhatIf] = useState<{ key: string; kw: number; preview: Preview } | null>(null);
  const withWhatIf = (showWhatIf ?? variant === "detail") && variant !== "card";
  // A result or preview computed for older inputs is treated as not yet available.
  const state: CalcState = result && result.key === requestKey ? result.state : { status: "loading" };
  const whatIfKw = whatIf && whatIf.key === requestKey ? whatIf.kw : null;
  const preview: Preview = whatIf && whatIf.key === requestKey ? whatIf.preview : { status: "idle" };

  useEffect(() => {
    let cancelled = false;
    callCalculate({ requestId: id }).then((r) => {
      if (cancelled) return;
      setResult({ key: requestKey, state: r.kind === "ok" ? { status: "ready", estimate: r.estimate } : { status: r.kind } });
    });
    return () => {
      cancelled = true;
    };
  }, [id, requestKey]);

  const choosePreview = useCallback(
    async (kw: number) => {
      setWhatIf({ key: requestKey, kw, preview: { status: "loading" } });
      const r = await callCalculate({ requestId: id, capacityOverrideKw: kw });
      setWhatIf((cur) =>
        cur && cur.key === requestKey && cur.kw === kw
          ? { ...cur, preview: r.kind === "ok" ? { status: "ready", estimate: r.estimate } : { status: "error" } }
          : cur,
      );
    },
    [id, requestKey],
  );

  const compact = variant === "card";
  const wrapper = "flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-6";
  const heading = (
    <h2 className="flex items-center gap-2 text-lg font-semibold">
      <Calculator aria-hidden className="size-5 text-solar" />
      Solar estimate
    </h2>
  );

  if (state.status === "loading") {
    return (
      <section aria-label="Solar estimate" aria-busy="true" className={wrapper}>
        {heading}
        <div role="status" className="flex flex-col gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-3/4" />
          <span className="sr-only">Calculating your estimate</span>
        </div>
      </section>
    );
  }

  if (state.status === "empty") {
    return (
      <section aria-label="Solar estimate" className={wrapper}>
        {heading}
        <p className="text-sm text-muted-foreground">Enter your monthly consumption to see an estimate.</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section aria-label="Solar estimate" className={wrapper}>
        {heading}
        <div role="alert" className="flex flex-col items-start gap-2">
          <p className="text-sm">Couldn&apos;t calculate the estimate.</p>
          <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </Button>
        </div>
      </section>
    );
  }

  const e = state.estimate;

  if (compact) {
    return (
      <section aria-label="Solar estimate" className={`${wrapper} gap-2`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {heading}
          <EstimateBadge kind="estimate" />
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <li>Size: <span className="font-semibold">{e.capacityKw} kW</span></li>
          <li>Subsidy: <span className="font-semibold">{formatInr(e.subsidyEstimate)}</span></li>
          <li>Net cost: <span className="font-semibold">{formatInr(e.netCost)}</span></li>
          <li>Payback: <span className="font-semibold">{e.paybackYears === null ? "Not applicable" : `${e.paybackYears} years`}</span></li>
        </ul>
        <Footer e={e} compact />
      </section>
    );
  }

  const p = preview.status === "ready" ? preview.estimate : null;
  return (
    <section aria-label="Solar estimate" className={wrapper}>
      {heading}
      <Figures e={e} />
      <Assumptions e={e} open />
      {withWhatIf ? (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed p-3">
          <WhatIfCapacity value={whatIfKw ?? e.capacityKw} onChange={(kw) => void choosePreview(kw)} disabled={preview.status === "loading"} />
          {preview.status === "loading" ? <p role="status" className="text-sm text-muted-foreground">Calculating preview…</p> : null}
          {preview.status === "error" ? (
            <p role="alert" className="text-sm">Couldn&apos;t calculate the preview. Try another size.</p>
          ) : null}
          {p ? (
            <div aria-label="Preview — not saved" className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Preview — not saved</p>
              <Figures e={p} />
              {p.capacityKw > 3 ? (
                <p className="text-sm text-muted-foreground">Central subsidy does not increase above 3 kW under the configured rule.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <Footer e={e} compact={false} />
    </section>
  );
}
