# Data Model: Roof Photo Analysis

**Feature**: 008-roof-photo-analysis | **Canonical source**: `docs/project-overview.md` §7

## Entity: `roof_assessments` (owned by 008)

One row per analysis attempt that reached the AI stage. Relationship (overview §7):
`household_requests 1–N roof_assessments`. Rows are immutable (no `updated_at`).

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `request_id` | uuid | no | — | FK → `household_requests(id)` `on delete cascade` |
| `status` | text | no | — | `check (status in ('completed','failed'))` |
| `observations` | jsonb | no | `'[]'` | Array of Observation (below); `'[]'` when `failed` |
| `potential_obstructions` | jsonb | no | `'[]'` | Array of strings; `'[]'` when `failed` |
| `limitations` | jsonb | no | `'[]'` | Array of strings; ≥ 3 when `completed` |
| `site_survey_required` | boolean | no | `true` | Always `true` (set by code, never by AI) |
| `model` | text | yes | — | Model identifier from `meta.model`; null if no provider was reached (`not_configured`); `'demo-seed'` for seed data |
| `prompt_version` | text | no | — | e.g. `roof-analysis.v1` |
| `failure_reason` | text | yes | — | **Extension to overview §7.** `check (failure_reason in ('timeout','rate_limited','provider_error','invalid_output','not_configured'))` |
| `roof_photo_path` | text | no | — | **Extension to overview §7.** Snapshot of `household_requests.roof_photo_path` analysed (FR-021) |
| `created_at` | timestamptz | no | `now()` | |

**Table constraints**

- `check ((status = 'failed') = (failure_reason is not null))`
- `check (status = 'failed' or jsonb_array_length(limitations) >= 3)`
- `check (status = 'completed' or (observations = '[]'::jsonb and potential_obstructions = '[]'::jsonb))`
- `check (site_survey_required = true)`
- Index: `roof_assessments_request_created_idx on (request_id, created_at desc)`

**Row Level Security** (enabled)

| Policy | Command | Rule |
|---|---|---|
| `roof_assessments_select_owner` | SELECT | `exists (select 1 from household_requests r where r.id = request_id and r.user_id = auth.uid())` |
| `roof_assessments_insert_owner_consented` | INSERT | `with check (exists (select 1 from household_requests r where r.id = request_id and r.user_id = auth.uid() and r.ai_consent = true))` |
| — | UPDATE / DELETE | No policy (denied). Rows disappear only via cascade when the request is deleted. |

Vendors have no table policy, so they cannot query assessments directly. Their only access is the read-only summary returned by 004's SECURITY DEFINER function `vendor_get_latest_roof_assessment` (open/quoted requests, latest `completed` row, no `failure_reason`, model or photo path) (FR-008, D-01).

### Observation (JSON element of `observations`)

| Field | Type | Rule |
|---|---|---|
| `object` | string | 1–60 chars, e.g. "water tank" |
| `description` | string | 1–300 chars |
| `potential_impact` | string | 1–200 chars |
| `confidence` | enum | `low` \| `medium` \| `high` |

Limits: `observations` ≤ 12 items; `potential_obstructions` ≤ 12 items × 1–60 chars;
`limitations` ≤ 10 AI items × 1–300 chars (+ 3 standard ones added by code).

### Standard limitations (code constant, `src/lib/ai/schemas/roof-analysis.ts`)

1. "A single image cannot establish exact roof dimensions"
2. "Shading at different times of day is unknown"
3. "Structural condition cannot be assessed"

## Read-only use of other features' entities

| Entity (owner) | Columns read | Purpose |
|---|---|---|
| `household_requests` (002) | `id`, `user_id`, `status`, `ai_consent`, `roof_photo_path` | ownership, state rule, consent gate, photo location |
| `profiles` (001) | `role` | role check (via 001's auth guard) |
| Storage `roof-photos` (002) | object at `roof_photo_path` (`{user_id}/{request_id}/…`) | downloaded server-side with the user's session; JPEG/PNG/WebP ≤ 5 MB |

No changes to 002's tables or bucket.

## State and lifecycle

```text
(attempt requested)
   ├─ refused (auth / role / status / consent / photo checks) ──> no row
   └─ AI stage reached ──> AI ok + schema valid ──> row status = completed
                       └─> timeout | rate_limited | provider_error | invalid_output | not_configured
                                                    ──> row status = failed (failure_reason set)
```

**Display selection** (FR-020, D-09): `latest_completed` = newest row with `status = 'completed'`;
`latest_attempt` = newest row of any status. If `latest_attempt.status = 'failed'`, the panel shows
the unavailable notice plus `latest_completed` (if any) labelled with its date.
**Stale photo** (FR-021): `latest_completed.roof_photo_path ≠ household_requests.roof_photo_path`.

## Seed data (extends `supabase/seed.sql`)

One `completed` row for the demo household's request: `model = 'demo-seed'`,
`prompt_version = 'roof-analysis.v1'`, observations "water tank" (medium) and "staircase room"
(high), `potential_obstructions = ["water tank","staircase room"]`, the 3 standard limitations,
`roof_photo_path` = the demo request's photo path. Labelled "Demo" in the UI.
