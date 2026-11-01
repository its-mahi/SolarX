"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { FILTER_KEYS, type VendorDiscoveryContext, type VendorRequestSummary } from "@/lib/validation/vendor-discovery";
import { RequestFilters, type FilterValues } from "./request-filters";
import { RequestList } from "./request-list";

const VendorRequestsMap = dynamic(() => import("@/components/maps/vendor-requests-map"), {
  ssr: false,
  loading: () => <LoadingState label="Loading map…" variant="card" />,
});

type Payload = { items: VendorRequestSummary[]; vendor_context: VendorDiscoveryContext | null; truncated: boolean };
type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; data: Payload };

export function VendorDiscovery() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [mapFailed, setMapFailed] = useState(false);
  const [filterError, setFilterError] = useState(false);

  const filterValues = useMemo(() => {
    const v: FilterValues = {};
    for (const k of FILTER_KEYS) {
      const val = params.get(k);
      if (val) v[k] = val;
    }
    return v;
  }, [params]);
  const filterQuery = useMemo(() => new URLSearchParams(filterValues).toString(), [filterValues]);
  const view = params.get("view") === "map" ? "map" : "list";

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/requests${filterQuery ? `?${filterQuery}` : ""}`, { cache: "no-store" });
      if (res.status === 400) {
        setFilterError(true);
        setState((s) => (s.kind === "ready" ? s : { kind: "error" }));
        return;
      }
      if (!res.ok) throw new Error("load");
      setFilterError(false);
      const json = (await res.json()) as { data: Payload };
      setState({ kind: "ready", data: json.data });
    } catch {
      setState({ kind: "error" });
    }
  }, [filterQuery]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/param change
    void load();
  }, [load]);

  const push = (values: FilterValues, nextView = view) => {
    const q = new URLSearchParams(values);
    if (nextView === "map") q.set("view", "map");
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname);
  };

  const context = state.kind === "ready" ? state.data.vendor_context : null;
  const filtered = Object.keys(filterValues).some((k) => k !== "sort");

  return (
    <div className="flex flex-col gap-4">
      <RequestFilters key={filterQuery} values={filterValues} context={context} onApply={(v) => push(v)} onClear={() => push({})} />

      <div role="group" aria-label="View" className="flex gap-2">
        <Button type="button" size="lg" variant={view === "list" ? "default" : "outline"} aria-pressed={view === "list"} onClick={() => push(filterValues, "list")}>List</Button>
        <Button type="button" size="lg" variant={view === "map" ? "default" : "outline"} aria-pressed={view === "map"} onClick={() => push(filterValues, "map")}>Map</Button>
      </div>

      {filterError ? <p role="alert" className="text-sm text-destructive">Those filters are not valid. Showing the previous results.</p> : null}

      {state.kind === "loading" ? <LoadingState label="Loading open requests…" /> : null}
      {state.kind === "error" ? <ErrorState onRetry={() => { setState({ kind: "loading" }); void load(); }} message="We could not load open requests. Please try again." /> : null}
      {state.kind === "ready" ? (
        view === "map" && !mapFailed ? (
          <div className="flex flex-col gap-2">
            <p role="status" className="text-sm text-muted-foreground">{state.data.items.length} request(s) on the map</p>
            <VendorRequestsMap items={state.data.items} context={state.data.vendor_context} onTileError={() => setMapFailed(true)} />
          </div>
        ) : (
          <>
            {view === "map" ? (
              <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
                Map unavailable — switch to list.
                <Button size="lg" variant="outline" onClick={() => { setMapFailed(false); push(filterValues, "list"); }}>Show list</Button>
              </div>
            ) : null}
            <RequestList items={state.data.items} truncated={state.data.truncated} filtered={filtered} search={filterQuery}
              onClear={() => push({})} />
          </>
        )
      ) : null}
    </div>
  );
}
