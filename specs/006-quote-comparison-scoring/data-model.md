# Data Model: Quote Comparison and Scoring (006)

Canonical source: `docs/project-overview.md` §7. This feature owns `quote_reviews` and the
scoring configuration (code). It reads `quotes` (005), `household_requests` (002), `vendors`
(001) and `solar_estimates` (003). No columns are added to any table.

## 1. Table `quote_reviews`

Migration: `supabase/migrations/20261101000600_quote_reviews.sql`

| Column | Type | Null | Default | Constraint / note |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `quote_id` | `uuid` | no | — | FK → `quotes(id)` `on delete cascade`; **UNIQUE** (quotes 1–0/1 quote_reviews) |
| `normalized_fields` | `jsonb` | no | `'{}'` | `NormalizedQuote` (§3) incl. `platformEstimates` |
| `missing_fields` | `jsonb` | no | `'[]'` | array of recommended-item keys not stated (§4) |
| `flags` | `jsonb` | no | `'[]'` | array of `{ code, severity, message, field? }` |
| `score_breakdown` | `jsonb` | no | `'{}'` | §5 |
| `total_score` | `numeric(4,1)` | no | — | `check (total_score >= 0 and total_score <= 100)` |
| `scoring_version` | `text` | no | — | e.g. `scoring.v1`; `check (length(scoring_version) between 1 and 64)` |
| `explanation` | `text` | no | — | code-generated sentence; `check (length(explanation) <= 500)` |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | updated on each upsert |

**Indexes**: unique index on `quote_id`. Reads join `quotes` on `request_id` (index on
`quotes.request_id` is owned by 005).

**Write path**: only `POST /api/quotes/compare`, via the server-only admin client after the
ownership check, as `insert … on conflict (quote_id) do update`.

### RLS (enabled)

| Policy | Command | Role | Rule |
|---|---|---|---|
| `quote_reviews_select_request_owner` | `select` | `authenticated` | `exists (select 1 from quotes q join household_requests r on r.id = q.request_id where q.id = quote_reviews.quote_id and r.user_id = auth.uid())` |
| *(none)* | `insert`/`update`/`delete` | `anon`, `authenticated` | denied (no policy) |

Vendors (including the quote's own vendor) cannot read reviews: scores are relative to
competitors' prices and would leak them (FR-024).

## 2. Read dependencies

| Table (owner) | Columns read |
|---|---|
| `household_requests` (002) | `id`, `user_id`, `status`, `budget`, `preferred_capacity_kw` |
| `quotes` (005) | `id`, `request_id`, `vendor_id`, `price`, `capacity_kw`, `panel_details`, `inverter_details`, `warranty_details`, `installation_days`, `earthing_included`, `documentation_included`, `other_inclusions`, `exclusions`, `vendor_notes`, `source`, `status`, `created_at` |
| `vendors` (001) | `id`, `company_name`, `verification_status` (to show the "Demo" label) |
| `solar_estimates` (003) | `capacity_kw` (fallback reference for `CAPACITY_FAR_FROM_REQUEST`) |

`other_inclusions`, `exclusions` and `vendor_notes` are display-only; they never enter
`ScoringInput`.

## 3. `NormalizedQuote` (stored in `normalized_fields`)

```text
{
  quoteId, requestId, vendorId, status, submittedAt,
  price: int, capacityKw: number, pricePerKw: int,
  panel:    { brand: string|null, model: string|null, wattage: number|null,
              quantity: int|null, certifications: string[]|null, computedCapacityKw: number|null },
  inverter: { brand: string|null, model: string|null, type: string|null, capacityKw: number|null },
  warranty: { panelProductYears: number|null, panelPerformanceYears: number|null,
              inverterYears: number|null, workmanshipYears: number|null },
  installationDays: int|null,
  earthingIncluded: boolean|null, documentationIncluded: boolean|null,
  vendorText: { otherInclusions: string[]|null, exclusions: string|null, notes: string|null },  // display only
  source: "manual" | "ai_extracted",
  platformEstimates: { subsidyEstimate: int, netCostEstimate: int, ruleVersion: string }
}
```

Validation (per field, `safeParse`, failure → `null`): strings trimmed, 1..120 chars; wattage
`> 0 ≤ 1000`; quantity int `> 0 ≤ 1000`; capacities `> 0 ≤ 100`; warranty years int `≥ 0 ≤ 40` (`0` = stated "no warranty", known);
installation days int `> 0 ≤ 365`; booleans strict; certifications string array (≤ 10) — empty array → `null` (not stated). `other_inclusions` (005: string[]) is joined for display only.
`computedCapacityKw = wattage × quantity / 1000` when both known.

## 4. Recommended items (missing-field keys, fixed order)

`panelBrand, panelWattage, panelQuantity, panelCertifications, inverterBrand, inverterType,
inverterCapacity, warrantyPanelProduct, warrantyPanelPerformance, warrantyInverter,
warrantyWorkmanship, installationDays, earthingStated, documentationStated` (14).

## 5. `score_breakdown` shape

```text
{
  version: "scoring.v1",
  parts: {
    price:        { points, max: 30, reason, notCompared?: true },
    technical:    { points, max: 25, items: [{ key, points, max: 5, status: "met"|"not_met"|"unknown", reason }] },
    warranty:     { points, max: 20, items: [{ key, years|null, points, max, target }] },
    completeness: { points, max: 15, stated, total: 14 },
    timeline:     { points, max: 10, days|null }
  },
  penalties: [{ part, item, pointsForgone, message }],   // unknown values only
  total,                                                  // = sum of rounded parts
  comparison: { rank, comparedCount, tied, comparedQuoteIds }
}
```

## 6. Status interactions (read-only here)

- `quotes.status`: `submitted` and (after 007) `accepted`/`rejected` are compared/displayed;
  `withdrawn` excluded. 006 never changes any status.
- `household_requests.status`: comparison available for `open`, `quoted`, `accepted`, `closed`
  (read-only after acceptance). `draft` has no quotes.
