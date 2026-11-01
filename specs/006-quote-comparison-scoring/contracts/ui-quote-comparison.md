# UI contract: Quote comparison screen

**Route**: `/household/requests/[id]/quotes` · **Files**: `src/app/household/requests/[id]/quotes/page.tsx`,
`loading.tsx`, `error.tsx`; components in `src/components/quotes/`. Household only (001 guard
redirects others).

## Layout (mobile-first)

1. **Header**: request summary (capacity preference, budget), link back to the request.
2. **Score summary bar** (`ScoringDisclaimer`): weights "Price 30 · Technical 25 · Warranty 20 ·
   Completeness 15 · Timeline 10", scoring version, and the fixed disclaimer
   "Comparison score defined by SolarX for guidance only — not a government, official or
   certification rating."
3. **View toggle** (≥ md): "Cards | Table". Mobile shows cards only.
4. **`QuoteCard`** per compared quote, in API order:
   - Rank chip ("1 of 3", "Tied score" when `tied`); top quote: "Highest comparison score"
     (never "best"/"recommended"/"verified").
   - Vendor company name + "Demo" badge when `isDemo`.
   - Total score `94.3 / 100`; `ScoreBreakdown` disclosure (keyboard: Enter/Space) with each
     part's points/max, reason, items, and a "Missing-data penalties" list (e.g. "Inverter
     warranty not stated (−5)").
   - Fields with `EstimateBadge kind="vendor-confirmed"`: price, price per kW, capacity, panel,
     inverter, warranties (four separate rows), installation days, earthing, documentation.
     Unknown → "Not stated" (muted, with icon), never "0".
   - Fields with `EstimateBadge kind="estimate"`: estimated central subsidy, estimated net cost,
     with rule version and link to `/rules`.
   - `QuoteFlags`: missing items list (or "All recommended details provided") and flags with
     severity icon (warning/info), text not colour-only.
   - Vendor text (inclusions, exclusions, notes) under "As stated by the vendor" — plain text.
   - Explanation sentence.
   - `actionSlot` (filled by 007 with the accept button / status).
5. **`QuoteComparisonTable`** (≥ md): rows = fields, columns = quotes, same markers; sticky
   first column; `<th scope="col|row">`.
6. **Withdrawn / excluded** section: collapsed list, "Withdrawn by vendor" / "Incomplete quote".

## States

| State | Trigger | Shows |
|---|---|---|
| Loading | compare in flight | skeleton cards |
| Empty | `compared: []` and no excluded | "No quotes yet. Vendors near you can see your request; you'll see quotes here." |
| Empty (all withdrawn) | `compared: []`, excluded non-empty | "No active quotes" + withdrawn list |
| Success | ≥ 1 compared | as above |
| Read-only | `requestStatus` `accepted`/`closed` | statuses on cards, no accept actions (007) |
| Error | non-2xx | "Couldn't load quotes" + Retry; 404 → "Request not found" |

## Accessibility

WCAG AA contrast, visible focus, all interactive elements keyboard operable, icons have text
labels, numbers formatted `en-IN` (₹1,65,000).
