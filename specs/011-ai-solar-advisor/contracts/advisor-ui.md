# Contract: Advisor UI — page, panel and 002 `AdvisorShortcutSlot`

## 1. Advisor page

**Route**: `/household/requests/[id]/advisor` → `src/app/household/requests/[id]/advisor/page.tsx`
(server component) + `loading.tsx`.

- Guarded with 001's `requirePageRole("household")` (anonymous → `/login?next=…`; vendor →
  their home).
- Renders a back link to the request page and `<AdvisorPanel requestId={id} />`.
- Page title: "Solar advisor"; one `h1`, sections as `h2`.

## 2. `AdvisorPanel` (`src/components/advisor/advisor-panel.tsx`, client)

| State | Shown |
|---|---|
| loading | skeleton of three sections + "Preparing your summary…" (`aria-busy`) |
| success | source badge ("AI explanation" / "Standard summary"), fallback note when `ai_status ≠ used` with Retry, three `AdvisorSection`s, quote legend (Quote A — SunRise Energy (Demo)…), limitations, `AdvisorDisclaimers` |
| empty (`mode = no_data`) | the three sections with `available: false` and next-action links (finish request / add usage) + disclaimers |
| error (non-2xx) | "We couldn't load the advisor. Retry." + link back; 404 → "Request not found" |

- "Refresh explanation" button re-posts; previous content stays until the new response arrives.
- Next action always visible: link to the comparison page (`/household/requests/[id]/quotes`)
  when `mode ∈ {compare, needs_comparison}`; to the request page otherwise.

## 3. `AdvisorSection` and evidence

- `AdvisorSection` (`advisor-section.tsx`): `h2` title, summary paragraph, list of points; each
  point followed by `AdvisorEvidence` for its `fact_refs`.
- `AdvisorEvidence` (`advisor-evidence.tsx`): chips "Label: value unit" rendered **from `facts`**
  with 002's `formatInr`/`formatKw`/`formatUnits`; estimates carry 003's `EstimateBadge kind="estimate"`;
  vendor-stated values carry `EstimateBadge kind="vendor-confirmed"`; roof confidence shown as
  words via 008's `AiConfidenceLabel` (never as a guarantee).

## 4. `AdvisorDisclaimers` (`advisor-disclaimers.tsx`)

Always rendered (all states except hard error), listing the 5 disclaimers from the response (or
the static list from `src/lib/domain/advisor/disclaimers.ts` while loading/empty), plus a link
to `/rules`.

## 5. 002 `AdvisorShortcutSlot`

**Provider**: 002 — `AdvisorShortcutSlot` in `src/components/household/extension-slots.tsx`,
props `{ request: HouseholdRequestDto }` (`extension-slot-types.ts`), rendered on the dashboard
request card and on the request page inside 002's `SlotBoundary`.

**Rule (002)**: slot owners change only the slot body; 011 replaces it with:

```text
AdvisorShortcutSlot({ request }) → <AdvisorShortcutCard request={request} />
```

`AdvisorShortcutCard` (`src/components/advisor/advisor-shortcut-card.tsx`): Lucide icon, title
"Ask the advisor", status line from `request.status`:

| `status` | Line |
|---|---|
| `draft` | "Finish your request to get full advice" |
| `open` | "Roof and cost summary ready — waiting for quotes" |
| `quoted` | "Quotes received — see what they mean" |
| `accepted`, `closed` | "See advice on your chosen quote" |

Whole card is one `Link` to `/household/requests/{id}/advisor` (keyboard focusable, visible focus
ring, ≥ 44 px target). No data fetching; never throws for unknown statuses (falls back to "Open
the advisor").
