# Data Model: Quote Acceptance (007)

Canonical source: `docs/project-overview.md` §7. This feature owns `quote_acceptances` and the
acceptance/close/contact database functions. It changes statuses of `quotes` (005) and
`household_requests` (002) only through its SECURITY DEFINER functions. No columns are added to
any existing table.

Migration: `supabase/migrations/20261101000700_quote_acceptances.sql`

## 1. Table `quote_acceptances`

| Column | Type | Null | Default | Constraint / note |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `quote_id` | `uuid` | no | — | FK → `quotes(id)` `on delete cascade`; **UNIQUE** `quote_acceptances_quote_id_key` |
| `request_id` | `uuid` | no | — | FK → `household_requests(id)` `on delete cascade`; **UNIQUE** `quote_acceptances_request_id_key` (D-03) |
| `household_id` | `uuid` | no | — | FK → `profiles(id)` `on delete cascade` |
| `accepted_at` | `timestamptz` | no | `now()` | |
| `created_at` | `timestamptz` | no | `now()` | |

Immutable after insert (no `updated_at`; no update policy). All columns match overview §7.
Consistency of `quote_id ↔ request_id` (the quote belongs to the request) is guaranteed by
`accept_quote`, which derives `request_id` from the quote.

**Indexes**: the two unique indexes above; `quote_acceptances_household_id_idx (household_id)`.

### RLS (enabled)

| Policy | Command | Role | USING |
|---|---|---|---|
| `quote_acceptances_select_household` | SELECT | authenticated | `household_id = auth.uid()` |
| `quote_acceptances_select_accepted_vendor` | SELECT | authenticated | `exists (select 1 from quotes q join vendors v on v.id = q.vendor_id where q.id = quote_acceptances.quote_id and v.user_id = auth.uid())` |
| *(none)* | INSERT / UPDATE / DELETE | anon, authenticated | denied; inserts only inside `accept_quote` |

## 2. Status transitions (canonical, overview §7)

```text
household_requests:  open ──accept_quote──> accepted ──close_request──> closed
                     quoted ──accept_quote──> accepted
quotes:              submitted ──accept_quote (chosen)──> accepted
                     submitted ──accept_quote (others on same request)──> rejected
                     withdrawn ──(unchanged by accept_quote)
```

Guards (inside the functions, under `FOR UPDATE` locks, request row locked before quote rows):

| Transition | Allowed when | Otherwise |
|---|---|---|
| quote → accepted | caller owns request; request `open`/`quoted`; no acceptance exists; quote `submitted` | `SM404` / `SM409 ALREADY_ACCEPTED` / `SM409 REQUEST_NOT_ACCEPTING` / `SM409 QUOTE_NOT_ACCEPTABLE` |
| other quotes → rejected | same transaction, `status = 'submitted'` only | withdrawn untouched |
| request → accepted | same transaction | — |
| request → closed | caller owns request; request `accepted` | `SM404 REQUEST_NOT_FOUND` / `SM409 REQUEST_NOT_CLOSABLE` |

## 3. Extension to overview §7 — database functions

All: `LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = public, pg_temp`,
`REVOKE ALL ON FUNCTION … FROM public, anon`, `GRANT EXECUTE … TO authenticated`.
Household guard: `auth.uid()` present and `profiles.role = 'household'` else `42501`.
Vendor guard: as 005 (`42501`; `SM403 VENDOR_PROFILE_MISSING`).

| Function | Returns | Purpose |
|---|---|---|
| `accept_quote(p_quote_id uuid)` | `table(acceptance_id uuid, quote_id uuid, request_id uuid, household_id uuid, accepted_at timestamptz, rejected_quote_ids uuid[])` | Atomic acceptance and cascade (research R-01) |
| `close_request(p_request_id uuid)` | `household_requests` row (`id, status, updated_at` used) | `accepted → closed` (R-06) |
| `accepted_household_contact(p_quote_id uuid)` *(STABLE)* | `table(request_id uuid, household_name text, household_phone text, address_text text, latitude double precision, longitude double precision, locality text, accepted_at timestamptz)` | Contact reveal to the accepted vendor only (R-07) |
| `household_acceptance_summary(p_request_id uuid)` *(STABLE)* | `table(quote_id uuid, accepted_at timestamptz, vendor_company_name text, vendor_is_demo boolean, vendor_phone text, price integer, capacity_kw numeric)` — zero rows when none | Accepted summary for the owning household (R-08) |

Column types follow the owning features' migrations (`latitude`/`longitude` as defined by 002).

## 4. Validation (Zod, `src/lib/validation/acceptance.ts`)

| Schema | Shape |
|---|---|
| `acceptQuoteBodySchema` | `{ confirmed: z.literal(true) }` `.strict()` |
| `closeRequestBodySchema` | `{ confirmed: z.literal(true) }` `.strict()` |
| path params | `quoteIdParamSchema` (005) / `{ id: uuid }` |
| `acceptanceResultSchema` | `{ acceptance: { id, quoteId, requestId, householdId, acceptedAt }, quote: { id, status: 'accepted' }, request: { id, status: 'accepted' }, rejectedQuoteIds: uuid[] }` |
| `householdContactSchema` | `{ requestId, name, phone: string|null, addressText: string|null, latitude, longitude, locality: string|null, acceptedAt }` |
| `acceptanceSummarySchema` | `{ quoteId, acceptedAt, vendor: { companyName, isDemo, phone: string|null }, price, capacityKw } \| null` |

Enums come from 001's `src/lib/validation/enums.ts` (`REQUEST_STATUSES`, `QUOTE_STATUSES`).

## 5. Data shown per role after acceptance

| Viewer | Sees |
|---|---|
| Owning household | Acceptance summary incl. vendor company name and phone; all quotes' final statuses |
| Accepted vendor | Its quote `accepted`; household name, phone, address text, exact coordinates, locality (on demand) |
| Rejected / withdrawn vendors | Own quote status only; no contact; request hidden from discovery (004) |
| Anyone else | Nothing |
