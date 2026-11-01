# Data Model: Solar Financial Engine (003)

Canonical source: `docs/project-overview.md` §7. This feature owns the `solar_estimates` table
and the rule configuration (code, not a table). It reads `household_requests` (owned by 002).

## 1. Table `solar_estimates`

Migration: `supabase/migrations/20261101000300_solar_estimates.sql`

| Column | Type | Null | Default | Constraint / note |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `request_id` | `uuid` | no | — | FK → `household_requests(id)` `on delete cascade`; **UNIQUE** (1–0/1 per request) |
| `capacity_kw` | `numeric(5,2)` | no | — | `check (capacity_kw > 0 and capacity_kw <= 100)` |
| `installation_cost` | `integer` | no | — | INR; `check (installation_cost >= 0)` |
| `subsidy_estimate` | `integer` | no | — | INR; `check (subsidy_estimate >= 0)` |
| `net_cost` | `integer` | no | — | INR; `check (net_cost >= 0)` |
| `annual_generation_kwh` | `integer` | no | — | `check (annual_generation_kwh >= 0)` |
| `annual_savings_estimate` | `integer` | no | — | INR/yr; `check (annual_savings_estimate >= 0)` |
| `payback_years` | `numeric(5,1)` | **yes** | — | `NULL` when annual savings are 0; `check (payback_years is null or payback_years >= 0)` |
| `assumptions` | `jsonb` | no | `'{}'` | Shape in §2 |
| `rule_version` | `text` | no | — | e.g. `pm-surya-ghar.v1`; `check (length(rule_version) between 1 and 64)` |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | set on upsert (trigger `set_updated_at` from 001 if provided, else set explicitly in the upsert) |

All columns match overview §7. `updated_at` follows the overview's "where rows change" rule
(estimates are replaced on recalculation); it is not an extension.

**Indexes**: unique index on `request_id` (from the UNIQUE constraint). No other index needed
(all access is by `request_id`).

**Write path**: rows are inserted/updated only by `POST /api/solar/calculate` using the
server-only admin client, as `insert … on conflict (request_id) do update`.

### RLS (enabled)

| Policy | Command | Role | Rule |
|---|---|---|---|
| `solar_estimates_select_owner` | `select` | `authenticated` | `exists (select 1 from household_requests r where r.id = solar_estimates.request_id and r.user_id = auth.uid())` |
| *(none)* | `insert` / `update` / `delete` | `anon`, `authenticated` | No policy ⇒ denied. Only the service role (server) writes. |

Vendors, other households and anonymous users therefore read nothing.

## 2. `assumptions` jsonb shape (validated by Zod `solarEstimateAssumptionsSchema`)

```text
{
  inputs: { monthlyUnits: number, monthlyBill: number|null, budget: number|null,
            preferredCapacityKw: number|null },
  annualConsumptionKwh: number,
  recommendedCapacityKw: number,
  capacityBasis: "preferred" | "recommended" | "preview",
  generationKwhPerKwYear: number,
  benchmarkCostPerKw: number,
  tariffPerKwh: number,
  tariffBasis: "default" | "derived_from_bill" | "derived_from_bill_clamped",
  selfConsumptionShare: number,          // 0..1
  exportRatePerKwh: number,
  selfConsumedKwh: number,
  exportedKwh: number,
  cfaSlabs: [{ fromKw, toKw, ratePerKw }], cfaCap: number,
  illustrativeRuleKeys: string[],        // rules with verification = "illustrative"
  notes: string[]                         // fixed code-selected strings (see research R-10)
}
```

## 3. Rule configuration (code) — `src/config/rules/pm-surya-ghar.v1.ts`

`RuleSet = { version: "pm-surya-ghar.v1", name, publishedOn, rules: Record<RuleKey, Rule> }`

`Rule` fields (constitution V / plan §22): `key`, `name`, `value`, `unit`, `consumerCategory`,
`geography`, `sourceTitle`, `sourceUrl`, `effectiveDate` (ISO date or `null`), `retrievedOn`
(ISO date or `null` = "pending verification"), `verification` (`illustrative` | `verified`),
`limitations: string[]`.

| Key | Value (v1) | Unit | Category / geography | Source title (URL) | Verification |
|---|---|---|---|---|---|
| `cfa_slabs` | `[{0,2,30000},{2,3,18000}]` | ₹ per kW | Residential individual household · All India (central CFA only) | PM Surya Ghar National Portal (https://pmsuryaghar.gov.in/) | illustrative |
| `cfa_cap` | 78000 | ₹ | same | same | illustrative |
| `generation_kwh_per_kw_year` | 1400 | kWh/kW/yr | Rooftop PV · India (generic) | SURYAMIT planning assumption — verify with PM Surya Ghar portal calculator (https://pmsuryaghar.gov.in/) | illustrative |
| `benchmark_cost_per_kw` | 60000 | ₹ per kW | Residential on-grid · India (generic) | SURYAMIT planning assumption — verify with MNRE benchmark cost (https://mnre.gov.in/) | illustrative |
| `default_tariff_per_kwh` | 7.00 | ₹/kWh | Residential · generic | SURYAMIT planning assumption — verify with the state DISCOM tariff order | illustrative |
| `tariff_bounds_per_kwh` | `{min:3.00,max:12.00}` | ₹/kWh | same | same | illustrative |
| `self_consumption_share` | 0.70 | ratio | Residential · generic | SURYAMIT planning assumption | illustrative |
| `export_rate_per_kwh` | 3.00 | ₹/kWh | Residential net billing · generic | SURYAMIT planning assumption — verify DISCOM net-metering/feed-in rate | illustrative |
| `capacity_range_kw` | `{min:1,max:10}` | kW | Residential | SURYAMIT product rule | illustrative |
| `capacity_step_kw` | 0.5 | kW | Residential | SURYAMIT product rule | illustrative |

`effectiveDate` and `retrievedOn` are `null` in v1 and render as "pending verification". A rule may
be set to `verified` only with non-null `retrievedOn`, `effectiveDate` and an official `sourceUrl`
(enforced by the rule-set Zod schema test). For rules without an official URL the page shows the
MNRE / PM Surya Ghar portal link with the "planning assumption" title — never an invented URL.

## 4. Inputs read from `household_requests` (owned by 002)

`monthly_units`, `monthly_bill`, `budget`, `preferred_capacity_kw`, `user_id` (ownership).
No change to that table.

## 5. Validation rules (Zod, `src/lib/validation/solar.ts`)

| Field | Rule |
|---|---|
| `requestId` | uuid |
| `monthlyUnits` | number, finite, `> 0`, `<= 10000` (required) |
| `monthlyBill` | integer, `0..1000000`, optional/nullable |
| `budget` | integer, `0..10000000`, optional/nullable |
| `preferredCapacityKw` | number, finite, `> 0`, `<= 100`, optional/nullable |
| `capacityOverrideKw` (preview) | number, finite, within `capacity_range_kw` |

Body is a union of exactly one of: `{ requestId, capacityOverrideKw? }` (uses the stored request
inputs; saved only when `capacityOverrideKw` is absent) or `{ inputs: { monthlyUnits, monthlyBill?,
budget?, preferredCapacityKw? }, capacityOverrideKw? }` (never saved). Unknown keys are rejected
(`.strict()`).

## 6. State

`solar_estimates` has no status machine. Lifecycle: absent → created on first calculation →
replaced on each recalculation → deleted with its request (cascade).
