# Data Model: Vendor Request Discovery

**Feature**: `004-vendor-request-discovery` | **Date**: 2026-11-01
**Canonical source**: `docs/project-overview.md` §7. This feature creates **no tables** and changes
no existing columns, enums or RLS policies. It adds read-only projections.

## 1. Tables read (owned elsewhere)

| Table | Owner | Columns this feature reads | Exposed to vendor? |
|---|---|---|---|
| `household_requests` | 002 | `id`, `status`, `locality`, `latitude`, `longitude`, `monthly_units`, `budget`, `preferred_capacity_kw`, `roof_photo_path`, `user_id`, `created_at` | Only `id`, `status`, `locality`, `monthly_units`, `budget`, `preferred_capacity_kw`, `created_at`; `latitude`/`longitude` only as `round(…, 2)`; `roof_photo_path` → boolean `has_roof_photo` only; `user_id` → only `profiles.is_demo` of the owner |
| `profiles` | 001 | `id`, `role`, `is_demo` | `is_demo` (of the request owner) only. Never `name`, `phone` |
| `vendors` | 001 | `user_id`, `company_name`, `service_area`, `latitude`, `longitude`, `service_radius_km` | The caller's **own** row only (vendor context) via 001's own-row RLS |
| `roof_assessments` | 008 | `request_id`, `status`, `observations`, `potential_obstructions`, `limitations`, `site_survey_required`, `created_at` | Latest `completed` row's listed columns only; never `model`, `prompt_version` |

Never exposed to vendors (FR-005): `household_requests.address_text`, exact `latitude`/`longitude`,
`user_id`, `monthly_bill`, `ai_consent`, `roof_photo_path`; `profiles.name`, `profiles.phone`.

## 2. Extension to overview §7 — database functions (migration `20261101000400_vendor_request_discovery.sql`)

All three functions: `LANGUAGE plpgsql`, `STABLE`, `SECURITY DEFINER`,
`SET search_path = public, pg_temp`; `REVOKE ALL ... FROM public, anon`;
`GRANT EXECUTE ... TO authenticated`. Each begins with the **vendor guard**:

```text
IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'vendor')
THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
```

### 2.1 `vendor_list_open_requests()` → `SETOF` row type `vendor_request_view`

| Output column | Type | Derivation |
|---|---|---|
| `id` | uuid | `hr.id` |
| `status` | text | `hr.status::text` — always `open` or `quoted` |
| `locality` | text (nullable) | `hr.locality` |
| `approx_latitude` | numeric(5,2) | `round(hr.latitude::numeric, 2)` |
| `approx_longitude` | numeric(5,2) | `round(hr.longitude::numeric, 2)` |
| `monthly_units` | integer | `hr.monthly_units` |
| `budget` | integer (INR) | `hr.budget` |
| `preferred_capacity_kw` | numeric (nullable) | `hr.preferred_capacity_kw` |
| `has_roof_photo` | boolean | `hr.roof_photo_path IS NOT NULL` |
| `is_demo` | boolean | `p.is_demo` of the owner (`profiles p ON p.id = hr.user_id`) |
| `created_at` | timestamptz | `hr.created_at` |

Filter: `WHERE hr.status IN ('open','quoted')`. Order: `hr.created_at DESC`. No limit in SQL (the
200-row cap is applied after domain filtering, FR-004).

### 2.2 `vendor_get_open_request(p_request_id uuid)` → same columns as 2.1, zero or one row

Same projection with `AND hr.id = p_request_id`. Zero rows ⇒ the API returns `404 NOT_FOUND`
(covers draft, accepted, closed and nonexistent alike — FR-012).

### 2.3 `vendor_get_latest_roof_assessment(p_request_id uuid)` → zero or one row

| Output column | Type |
|---|---|
| `observations` | jsonb |
| `potential_obstructions` | jsonb |
| `limitations` | jsonb |
| `site_survey_required` | boolean |
| `assessed_at` | timestamptz (`ra.created_at`) |

Logic: vendor guard → `IF to_regclass('public.roof_assessments') IS NULL THEN RETURN; END IF;` →
return the newest `ra` with `ra.request_id = p_request_id AND ra.status = 'completed'` **and** an
`EXISTS` check that the request is `open`/`quoted`. (D-09: 1-N assessments, latest shown.)

### 2.4 Index

`CREATE INDEX IF NOT EXISTS household_requests_status_idx ON public.household_requests (status);`
(supports the status filter; overview §7 / plan §10 recommend a status index — skipped if 002
already created one with this name).

## 3. RLS posture (unchanged by this feature)

| Table | Vendor policy added by 004 | Effective vendor access |
|---|---|---|
| `household_requests` | **None (deliberate)** — see research R1 | Direct `select` returns 0 rows; reads only via 2.1/2.2 |
| `roof_assessments` | None | Reads only via 2.3 |
| `storage.objects` (`roof-photos`) | None | Download only through a server-issued signed URL (≤ 600 s) |
| `vendors` | None (001 provides own-row read) | Own row only |

## 4. Server-side read (not browser-callable)

The vendor detail module uses 001's admin client to run
`select roof_photo_path from household_requests where id = :id and status in ('open','quoted')`
**only after** 2.2 returned a row for the calling vendor, then signs it with 600 s expiry. The path
is never serialised into a response or log.

## 5. API projections (TypeScript types in `src/lib/validation/vendor-discovery.ts`)

- **VendorRequestSummary** = §2.1 columns + `distance_km: number | null` (integer km, computed from
  the vendor base to the approximate location) + `within_service_area: boolean | null`.
- **VendorRequestDetail** = VendorRequestSummary +
  `roof_photo_status: 'available' | 'unavailable' | 'none'` +
  `roof_photo: { url: string; expires_at: string } | null` +
  `roof_assessment: { observations; potential_obstructions; limitations; site_survey_required; assessed_at } | null`.
- **VendorDiscoveryContext** = `{ service_area: string | null; base_latitude: number | null;
  base_longitude: number | null; service_radius_km: number | null }` (the caller's own vendor row).

## 6. Filter validation rules (`vendorRequestFiltersSchema`)

| Param | Type | Rule |
|---|---|---|
| `max_distance_km` | number or `"any"` | `0 < x ≤ 500`; absent ⇒ vendor's `service_radius_km` if base + radius known, else no filter; `"any"` ⇒ no filter |
| `locality` | string | trimmed, 1–100 chars; case-insensitive *contains*; null locality never matches |
| `min_capacity_kw`, `max_capacity_kw` | number | `0 ≤ x ≤ 100`; `min ≤ max`; inclusive; when either is set, rows with null `preferred_capacity_kw` are excluded |
| `min_budget`, `max_budget` | integer INR | `0 ≤ x ≤ 10,000,000`; `min ≤ max`; inclusive |
| `sort` | enum | `distance` \| `newest`; default `distance` if vendor base known, else `newest`; `distance` without a base falls back to `newest` |

All filters combine with logical AND. Unknown params are ignored; malformed known params ⇒
`400 VALIDATION_FAILED` with `details[]` naming the field.

## 7. State transitions

Read-only. Visibility follows the canonical `household_requests` machine (overview §7):

```text
draft (hidden) ──publish──> open (visible) ──first quote──> quoted (visible) ──accept──> accepted (hidden) ──close──> closed (hidden)
```

A request disappears from the vendor list and detail as soon as it leaves `open`/`quoted`.
