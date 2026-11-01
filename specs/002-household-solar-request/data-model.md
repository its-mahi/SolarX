# Data Model: Household Solar Request

Migration: `supabase/migrations/20261101000200_household_requests.sql`.
Canonical source: `docs/project-overview.md` §7. Columns are exactly those of §7 plus the
universal `id`/`created_at`/`updated_at`; **no extension to §7**. Uses helpers from 001:
`public.set_updated_at()`, `public.current_user_role()`, `public.is_privileged_session()`.

## Table `household_requests`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | no | — | `REFERENCES profiles(id) ON DELETE CASCADE` |
| `address_text` | `text` | yes (draft) | — | `CHECK (address_text IS NULL OR char_length(btrim(address_text)) BETWEEN 5 AND 300)` |
| `latitude` | `numeric(9,6)` | yes (draft) | — | `CHECK (latitude BETWEEN -90 AND 90)` |
| `longitude` | `numeric(9,6)` | yes (draft) | — | `CHECK (longitude BETWEEN -180 AND 180)` |
| `locality` | `text` | yes (draft) | — | `CHECK (locality IS NULL OR char_length(btrim(locality)) BETWEEN 2 AND 100)` |
| `monthly_units` | `integer` | yes (draft) | — | `CHECK (monthly_units BETWEEN 1 AND 10000)` (kWh/month) |
| `monthly_bill` | `integer` | yes | — | `CHECK (monthly_bill BETWEEN 0 AND 100000)` (₹) |
| `budget` | `integer` | yes (draft) | — | `CHECK (budget BETWEEN 10000 AND 5000000)` (₹) |
| `preferred_capacity_kw` | `numeric(4,1)` | yes | — | `CHECK (preferred_capacity_kw BETWEEN 0.5 AND 20)` |
| `roof_photo_path` | `text` | yes (draft) | — | `CHECK (roof_photo_path IS NULL OR roof_photo_path LIKE user_id::text || '/' || id::text || '/%')` (bucket-relative key) |
| `ai_consent` | `boolean` | no | `false` | — |
| `status` | `text` | no | `'draft'` | `CHECK (status IN ('draft','open','quoted','accepted','closed'))` |
| `created_at` | `timestamptz` | no | `now()` | — |
| `updated_at` | `timestamptz` | no | `now()` | maintained by `set_updated_at` |

Table constraints:

- `household_requests_location_pair_chk`: `(latitude IS NULL) = (longitude IS NULL)`.
- `household_requests_publish_complete_chk`: `status = 'draft' OR (latitude IS NOT NULL AND
  longitude IS NOT NULL AND address_text IS NOT NULL AND locality IS NOT NULL AND monthly_units
  IS NOT NULL AND budget IS NOT NULL AND roof_photo_path IS NOT NULL)` — overview §9.1 at the
  data layer.

India bounding box (latitude 6.5–37.5, longitude 68–97.5) is enforced in the Zod schema, not in
the table, so that the data layer stays geography-neutral.

Indexes:

- `household_requests_user_created_idx ON (user_id, created_at DESC)` — dashboard list.
- `household_requests_status_idx ON (status)` — discovery of `open`/`quoted` requests (004).

## Triggers

| Trigger | Timing | Function | Rule |
|---|---|---|---|
| `household_requests_set_updated_at` | BEFORE UPDATE | `set_updated_at()` | — |
| `household_requests_guard_insert` | BEFORE INSERT | `household_requests_guard_insert()` | Non-privileged sessions: `NEW.status` must be `draft`, `NEW.roof_photo_path` must be `NULL`, `NEW.user_id = auth.uid()` and `current_user_role() = 'household'`. |
| `household_requests_guard_update` | BEFORE UPDATE | `household_requests_guard_update()` | Always: `id`, `user_id`, `created_at` immutable; if `NEW.status <> OLD.status` the pair must be one of the allowed transitions below, else `RAISE` (`check_violation`). Non-privileged sessions additionally: if `OLD.status = 'draft'` the only allowed status change is → `open`; if `OLD.status <> 'draft'` then `NEW.status = OLD.status` and every column except `ai_consent`/`updated_at` must be unchanged, and `ai_consent` may only change `true → false`. |

Errors raised by triggers are mapped by the Route Handlers to `CONFLICT` (status/immutability)
and never echoed to clients.

## State transitions (canonical, overview §7 + §9.3)

```text
draft ──publish (002, owner)──────────────> open
open ──first quote (005, privileged RPC)──> quoted
open | quoted ──accept (007, RPC)─────────> accepted
accepted ──close (007, owner/RPC)─────────> closed
```

| From → To | Allowed | Performed by |
|---|---|---|
| draft → open | yes | 002 `POST /api/requests/:id/publish` (owner, readiness check) |
| open → quoted | yes | 005 |
| open → accepted, quoted → accepted | yes | 007 |
| accepted → closed | yes | 007 (D-10) |
| anything else (e.g. open → draft, draft → quoted, closed → *) | no | — |

Editability: only `draft` rows are editable (all draft fields, `ai_consent`). Non-draft rows:
only `ai_consent` withdrawal (`true → false`).

## Publish readiness (domain, `src/lib/domain/requests/publish-readiness.ts`)

`PUBLISH_REQUIRED_FIELDS = ['location', 'address_text', 'locality', 'monthly_units', 'budget', 'roof_photo']`
where `location` means both `latitude` and `longitude`. `getMissingPublishFields(request)`
returns the missing subset in that order; each maps to its wizard step via `stepForField`
(`location`/`address_text`/`locality` → `location`; `roof_photo` → `photo`; `monthly_units`/`budget`
→ `usage`).

## Next action (domain, `src/lib/domain/requests/next-action.ts`)

| Status | `kind` | Label | Target |
|---|---|---|---|
| draft | `continue` | Continue request | `/household/requests/{id}?step={firstIncompleteStep}` |
| open | `wait` | Waiting for vendor quotes | `/household/requests/{id}` |
| quoted | `compare` | Compare quotes | `/household/requests/{id}/quotes` (page by 006) |
| accepted | `next_steps` | View next steps | `/household/requests/{id}` |
| closed | `view` | View request | `/household/requests/{id}` |

The domain function returns `{ kind, label, step? }`; the UI builds the href.

## RLS on `household_requests`

| Policy | Command | To | Rule |
|---|---|---|---|
| `household_requests_select_own` | SELECT | authenticated | `user_id = auth.uid()` |
| `household_requests_insert_own` | INSERT | authenticated | `WITH CHECK (user_id = auth.uid() AND public.current_user_role() = 'household' AND status = 'draft' AND roof_photo_path IS NULL)` |
| `household_requests_update_own` | UPDATE | authenticated | `USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())` (+ guard trigger) |
| — | DELETE | — | none (drafts are not deletable in MVP) |

No vendor policy is created here. 004 must provide vendor access through an approximate view
(2-decimal rounding, locality, no `address_text`, no owner identity) via a SECURITY DEFINER
function or server-side admin access after authorization.

## Storage bucket `roof-photos` (private)

Created in the 002 migration:
`INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
('roof-photos', 'roof-photos', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])`
(idempotent `ON CONFLICT DO NOTHING`).

Object key: `{user_id}/{request_id}/{uuid}.{jpg|png|webp}`.

| Policy on `storage.objects` | Command | Rule (all require `bucket_id = 'roof-photos'`) |
|---|---|---|
| `roof_photos_owner_select` | SELECT | `(storage.foldername(name))[1] = auth.uid()::text` |
| `roof_photos_owner_insert_draft` | INSERT | folder 1 = `auth.uid()` AND `EXISTS (SELECT 1 FROM public.household_requests r WHERE r.id::text = (storage.foldername(name))[2] AND r.user_id = auth.uid() AND r.status = 'draft')` |
| `roof_photos_owner_delete_draft` | DELETE | same as insert |
| — | UPDATE | none (no overwrite; new key per upload) |

Access for display: signed URLs with 600 s expiry (`createSignedUrl`). Vendor access (004) and
AI access (008, only with `ai_consent = true`) are issued server-side after those features'
authorization checks.

## Validation schemas (`src/lib/validation/requests.ts`)

| Schema | Fields and rules |
|---|---|
| `locationFieldsSchema` | `latitude` 6.5–37.5, `longitude` 68–97.5 (both or neither), `address_text` trimmed 5–300, `locality` trimmed 2–100 |
| `usageFieldsSchema` | `monthly_units` int 1–10000; `monthly_bill` int 0–100000 or null; `budget` int 10000–5000000; `preferred_capacity_kw` 0.5–20, multiple of 0.1, or null |
| `draftFieldsSchema` | all fields of the two above, each optional and nullable, plus `ai_consent` boolean; `.strict()` |
| `createRequestSchema` | `draftFieldsSchema` (may be empty `{}`) |
| `updateDraftSchema` | `draftFieldsSchema` with at least one key |
| `consentWithdrawalSchema` | `{ ai_consent: z.literal(false) }` `.strict()` |
| constants | `ROOF_PHOTO_MAX_BYTES = 5 * 1024 * 1024`, `ROOF_PHOTO_MIME_TYPES = ['image/jpeg','image/png','image/webp']`, `ROOF_PHOTO_MAX_DIMENSION = 2048`, `INDIA_BOUNDS` |

`status`, `user_id`, `roof_photo_path`, `id` and timestamps are never accepted from clients
(strict schemas reject them as unknown keys).

## DTO returned to the owner — `HouseholdRequestDto`

`id`, `status`, `address_text`, `locality`, `latitude`, `longitude`, `monthly_units`,
`monthly_bill`, `budget`, `preferred_capacity_kw`, `ai_consent`, `has_roof_photo`,
`roof_photo_url` (signed, detail responses only, else `null`), `roof_photo_url_expires_at`,
`missing_publish_fields`, `next_action { kind, label, step }`, `created_at`, `updated_at`.
`roof_photo_path` is not returned.
