# Data Model: Platform Foundation and Authentication

Migration: `supabase/migrations/20261101000100_platform_foundation_auth.sql`.
Canonical source: `docs/project-overview.md` §7. This feature owns `profiles` and `vendors` and
the shared SQL helpers below. Columns match §7 exactly; nothing is added to §7's column lists
beyond the universal `id`/`created_at`/`updated_at` convention.

Enumerations are stored as `text` with `CHECK` constraints (values exactly as overview §7) and
mirrored in `src/lib/validation/enums.ts`.

## Shared SQL helpers (reused by every later migration)

| Object | Kind | Behaviour |
|---|---|---|
| `public.set_updated_at()` | trigger function | `NEW.updated_at := now()`; attach `BEFORE UPDATE` on any table with `updated_at`. |
| `public.current_user_role()` | SQL function, `STABLE`, `SECURITY DEFINER`, `search_path = ''` | Returns `profiles.role` for `auth.uid()`, or `NULL` when anonymous / no profile. Used in RLS policies (e.g. `current_user_role() = 'household'`). `EXECUTE` granted to `authenticated`. |
| `public.is_privileged_session()` | SQL function, `STABLE` | `true` when `current_user` is `postgres`/`supabase_admin` or the JWT role is `service_role`; used by guard triggers so seed/admin can set protected columns. |
| `public.handle_new_user()` | trigger function on `auth.users` `AFTER INSERT`, `SECURITY DEFINER`, `search_path = ''` | Creates the profile (and vendor profile) from `raw_user_meta_data` — see below. |

## Table `profiles`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, `REFERENCES auth.users(id) ON DELETE CASCADE` | equals the account id |
| `name` | `text` | `NOT NULL`, `CHECK (char_length(btrim(name)) BETWEEN 1 AND 100)` | display name |
| `phone` | `text` | `NULL`, `CHECK (phone IS NULL OR phone ~ '^\+91[6-9][0-9]{9}$')` | stored normalized to `+91XXXXXXXXXX` |
| `role` | `text` | `NOT NULL`, `CHECK (role IN ('household','vendor'))` | fixed at sign-up |
| `is_demo` | `boolean` | `NOT NULL DEFAULT false` | set only by seed |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | trigger `set_updated_at` |

Indexes: PK only (lookups are by `id`); `profiles_role_idx (role)` for later admin/analytics
queries is **not** created (not needed in MVP).

Triggers:
- `profiles_set_updated_at` `BEFORE UPDATE` → `set_updated_at()`.
- `profiles_guard_update` `BEFORE UPDATE` → raises `insufficient_privilege` if `NEW.id`,
  `NEW.role` or `NEW.is_demo` differ from `OLD` and `NOT is_privileged_session()`.

RLS (`ENABLE ROW LEVEL SECURITY`; no policy = deny):

| Policy | Command | Role | Rule |
|---|---|---|---|
| `profiles_select_own` | SELECT | authenticated | `id = auth.uid()` |
| `profiles_update_own` | UPDATE | authenticated | `USING (id = auth.uid()) WITH CHECK (id = auth.uid())` |
| — | INSERT | — | none (rows created only by `handle_new_user()`) |
| — | DELETE | — | none (cascade from `auth.users` only) |

Later features add narrowly scoped SELECT policies (e.g. 007: vendor may read the household's
`name`/`phone` after their quote is accepted). Anonymous users have no access.

## Table `vendors`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK `DEFAULT gen_random_uuid()` | referenced by `quotes.vendor_id` (005) |
| `user_id` | `uuid` | `NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE` | one vendor profile per vendor |
| `company_name` | `text` | `NOT NULL`, `CHECK (char_length(btrim(company_name)) BETWEEN 2 AND 120)` | |
| `service_area` | `text` | `NOT NULL`, `CHECK (char_length(btrim(service_area)) BETWEEN 2 AND 200)` | free text, e.g. "Hyderabad, Telangana" |
| `latitude` | `numeric(9,6)` | `NULL`, `CHECK (latitude BETWEEN -90 AND 90)` | base location |
| `longitude` | `numeric(9,6)` | `NULL`, `CHECK (longitude BETWEEN -180 AND 180)` | base location |
| `service_radius_km` | `integer` | `NOT NULL DEFAULT 25`, `CHECK (service_radius_km BETWEEN 1 AND 500)` | |
| `verification_status` | `text` | `NOT NULL DEFAULT 'unverified'`, `CHECK (verification_status IN ('unverified','demo'))` | |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | trigger `set_updated_at` |

Table constraints: `vendors_location_pair_chk CHECK ((latitude IS NULL) = (longitude IS NULL))`.
Index: unique index on `user_id` (from `UNIQUE`).

Triggers:
- `vendors_set_updated_at` `BEFORE UPDATE` → `set_updated_at()`.
- `vendors_guard_write` `BEFORE INSERT OR UPDATE` → raises if the owning profile's role is not
  `vendor`; on UPDATE raises if `user_id` or `verification_status` change and
  `NOT is_privileged_session()`.

RLS:

| Policy | Command | Role | Rule |
|---|---|---|---|
| `vendors_select_authenticated` | SELECT | authenticated | `true` — business details are visible to signed-in users (needed by 006 quote display and 004 service areas). Contains no personal name/phone. |
| `vendors_update_own` | UPDATE | authenticated | `USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())` |
| — | INSERT / DELETE | — | none (insert via `handle_new_user()`; delete via cascade) |

## `handle_new_user()` behaviour

Input: `NEW.raw_user_meta_data` with keys `name`, `phone`, `role`, and for vendors
`company_name`, `service_area`, `latitude`, `longitude`, `service_radius_km`.

1. If `role` is not `household` or `vendor` → `RAISE EXCEPTION` (sign-up fails, no account).
2. Insert `profiles(id = NEW.id, name, phone, role, is_demo = false)` — `is_demo` from metadata is
   ignored.
3. If `role = 'vendor'`: if `company_name` or `service_area` is missing → `RAISE EXCEPTION`;
   else insert `vendors(user_id = NEW.id, company_name, service_area, latitude, longitude,
   coalesce(service_radius_km, 25), verification_status = 'unverified')`.
4. All table `CHECK` constraints apply; any violation aborts the whole sign-up transaction.

## State and lifecycle

- **Profile**: created at sign-up → name/phone editable by owner → deleted only with the account.
  `role` and `is_demo` never change after creation (except by privileged seed).
- **Vendor profile**: created at vendor sign-up with `verification_status = 'unverified'`;
  seed sets demo vendors to `demo`. No transitions are available to users (verification
  workflow is out of scope).

## Relationships

`auth.users 1—1 profiles` · `profiles 1—0/1 vendors` (only when `role = 'vendor'`) ·
`profiles 1—N household_requests` (002) · `vendors 1—N quotes` (005).

## Seed (`supabase/seed.sql`, section "001")

Four `auth.users` + `auth.identities` rows (fixed UUIDs, `example.com` emails, bcrypt password
equal to `DEMO_ACCOUNT_PASSWORD`), followed by
`UPDATE profiles SET is_demo = true WHERE id IN (…)` and
`UPDATE vendors SET verification_status = 'demo', latitude/longitude/service_radius_km = …`.
Values in [research.md R-10](research.md). The file ends with clearly marked empty sections
`-- 002 …` through `-- 011 …` for later features to append to.

## Application-side validation (mirrors the constraints)

`src/lib/validation/common.ts`: `uuidSchema`, `inrAmountSchema` (integer ≥ 0),
`kwCapacitySchema` (positive, ≤ 2 decimals), `latitudeSchema` (−90..90), `longitudeSchema`
(−180..180), `indianPhoneSchema` (accepts `9876543210`, `+91 98765 43210`, `+919876543210`;
outputs `+919876543210`), `trimmedText(min, max)`.

`src/lib/validation/auth.ts` / `profile.ts`: see [contracts/auth-api.md](contracts/auth-api.md)
and [contracts/me-api.md](contracts/me-api.md). All object schemas are `.strict()`.
