# Contract: `GET /api/rules`

**Feature**: 003 · **Overview §8**: listed (added) · **Role**: public (anonymous allowed) ·
**File**: `src/app/api/rules/route.ts`

Returns the active rule set and a CFA example table computed by the domain code. No database
access. Response may be cached (`Cache-Control: public, max-age=300`).

## Request

No body, no query parameters. Any query parameters are ignored.

## Success `200`

```json
{
  "data": {
    "version": "pm-surya-ghar.v1",
    "name": "PM Surya Ghar — illustrative baseline",
    "rules": [
      {
        "key": "cfa_slabs",
        "name": "Central financial assistance (CFA) per kW",
        "value": [{ "fromKw": 0, "toKw": 2, "ratePerKw": 30000 }, { "fromKw": 2, "toKw": 3, "ratePerKw": 18000 }],
        "unit": "INR per kW",
        "consumerCategory": "Residential — individual household",
        "geography": "All India (central assistance only; state top-ups not included)",
        "sourceTitle": "PM Surya Ghar: Muft Bijli Yojana — National Portal",
        "sourceUrl": "https://pmsuryaghar.gov.in/",
        "effectiveDate": null,
        "retrievedOn": null,
        "verification": "illustrative",
        "limitations": ["Illustrative baseline from the product plan — verify before demo", "Does not establish eligibility"]
      }
    ],
    "cfaExamples": [
      { "capacityKw": 1, "cfa": 30000 }, { "capacityKw": 1.5, "cfa": 45000 }, { "capacityKw": 2, "cfa": 60000 },
      { "capacityKw": 2.5, "cfa": 69000 }, { "capacityKw": 3, "cfa": 78000 }, { "capacityKw": 5, "cfa": 78000 }
    ],
    "officialReferences": [
      { "title": "PM Surya Ghar National Portal", "url": "https://pmsuryaghar.gov.in/" },
      { "title": "Ministry of New and Renewable Energy", "url": "https://mnre.gov.in/" },
      { "title": "MyScheme", "url": "https://www.myscheme.gov.in/" }
    ],
    "disclaimer": "Estimates only. Subsidy eligibility, approval and payment are decided under the official PM Surya Ghar scheme; SolarX does not guarantee them."
  }
}
```

## Errors

| Code | HTTP | When |
|---|---|---|
| `INTERNAL` | 500 | Rule set fails its own schema validation at runtime (should be caught by unit tests) |

## Authorization rule

None — public per overview §3 ("Anonymous: view rules and sources page").

---

# UI contract: Rules and sources page — `/rules`

**File**: `src/app/rules/page.tsx` (+ `src/app/rules/loading.tsx`, `src/app/rules/error.tsx`).
Public. Renders `activeRuleSet` directly (same data as the API).

- Header: rule set name and version, "Illustrative baseline — verify before demo" banner while any
  rule is `illustrative`.
- One row/card per rule: name, value + unit, consumer category, geography, source title as a link
  (opens in new tab, `rel="noopener noreferrer"`), effective date, retrieval date or "Pending
  verification", verification badge, limitations list.
- CFA examples table (from `cfaExamples`).
- Official references list and the disclaimer.
- States: loading skeleton; error with "Retry" (`reset()`); no empty state (rule set is static).
- Accessible: semantic table with `<th scope>` on ≥ md, stacked cards on mobile; AA contrast.

# UI contract: Estimate card — `EstimateCard`

**File**: `src/components/shared/estimate-card.tsx` · rendered through 002's
`RequestEstimateSlot` (in `src/components/household/extension-slots.tsx`; host pages and prop
types are 002's and stay unchanged — 003 only fills the slot body). The slot appears on the wizard
review step (`variant="review"`), the request page (`"detail"`) and the dashboard request card
(`"card"`).

Props: `{ request: HouseholdRequestDto; variant: "review" | "detail" | "card"; showWhatIf?: boolean }`
(`HouseholdRequestDto` from 002's `src/lib/validation/requests.ts`). The card derives an internal
`inputsKey` from `monthly_units`, `monthly_bill`, `budget` and `preferred_capacity_kw`; a change
triggers recalculation. `variant="card"` is compact (capacity, subsidy, net cost, payback, version,
"Estimate" badge, link to details); `"review"`/`"detail"` show everything below; what-if is shown on
`"detail"` only.

- Calls `POST /api/solar/calculate { requestId }` on mount / `inputsKey` change.
- Shows: capacity (+ recommended and basis), benchmark installation cost, subsidy estimate, net
  cost, annual generation, annual savings, payback ("Not applicable — no estimated savings" when
  `null`), each with the shared `EstimateBadge` ("Estimate").
- Assumptions disclosure (expanded list of `assumptions`), notes, rule version, link to `/rules`,
  "Illustrative" marker when `illustrativeRuleKeys` is non-empty, the disclaimer.
- What-if (`showWhatIf`): `WhatIfCapacity` select (1–10 kW, 0.5 steps) → preview call with
  `capacityOverrideKw`; preview panel labelled "Preview — not saved"; shows the "no extra central
  subsidy above 3 kW" note when the selected capacity > 3.
- States: loading (skeleton), empty (`409` → "Enter your monthly consumption to see an estimate"),
  success, error ("Couldn't calculate the estimate" + Retry).

`EstimateBadge` (`src/components/shared/estimate-badge.tsx`): `{ kind: "estimate" | "vendor-confirmed" }`
— reused by 006 to distinguish platform estimates from vendor-confirmed values.
