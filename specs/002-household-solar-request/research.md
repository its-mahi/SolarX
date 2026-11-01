# Research: Household Solar Request

No NEEDS CLARIFICATION remained in Technical Context. Decisions:

## R-01 Map pin with Leaflet + OpenStreetMap

- **Decision**: `react-leaflet` `MapContainer` + OSM standard tiles
  (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) with the required "© OpenStreetMap
  contributors" attribution. The picker is a client-only component loaded via `next/dynamic`
  with `ssr: false` (Leaflet touches `window`). The marker uses an `L.divIcon` built from a Lucide
  `MapPin` SVG, avoiding Leaflet's default-icon asset path problem under bundlers. Default centre
  Hyderabad (17.3850, 78.4867), zoom 12; pin placed by map click or drag. Latitude/longitude
  number inputs (6 decimals) and a "Use my location" button (`navigator.geolocation`, 10 s
  timeout) are always shown as the keyboard-accessible alternative and as the fallback when
  tiles fail.
- **Rationale**: Fixed stack (overview §10); no API key; accessible fallback satisfies FR-002 /
  SC-007 and constitution VII.
- **Alternatives considered**: Google Maps / Mapbox (keys, cost, not in stack); MapLibre GL
  (heavier, WebGL).

## R-02 No geocoding or address search

- **Decision**: The household types `address_text` and `locality`. No Nominatim or other
  geocoder.
- **Rationale**: Avoids a third-party API with usage limits and an extra failure mode; the pin
  already gives coordinates and locality is short to type.
- **Alternatives considered**: Nominatim reverse geocoding to pre-fill locality (usage-policy
  limits, extra latency) — possible post-MVP.

## R-03 When the draft is created; wizard state in the URL

- **Decision**: `/household/requests/new` holds step-1 values locally; pressing Continue calls
  `POST /api/requests` with the location fields, then `router.replace('/household/requests/{id}?step=photo')`.
  Every later step PATCHes on Continue. `/household/requests/[id]` renders the wizard for drafts
  at `?step=` (if valid) or `firstIncompleteStep()`, and the read-only summary otherwise.
- **Rationale**: The photo path needs a `request_id` (`roof-photos/{user_id}/{request_id}/…`);
  creating the row after step 1 avoids empty drafts from people who just open the page; the URL
  makes resume (US4) and reload trivial.
- **Alternatives considered**: Create on wizard open (orphan empty drafts); save only at publish
  (loses progress, photo path problem).

## R-04 Photo upload path and size limits

- **Decision**: Browser resizes the selected image with a canvas to ≤ 2048 px on the longest
  side and re-encodes it as JPEG (quality 0.85), after first rejecting files > 5 MB or of a
  non-allowed type. If the browser cannot decode the file (rare), the original is sent unchanged
  and the server limits still apply.
  The result is sent as `multipart/form-data` field `file` to `POST /api/requests/:id/photo`.
  The server enforces ≤ 5 MB (`PAYLOAD_TOO_LARGE`), sniffs the type, re-encodes and uploads.
- **Rationale**: Vercel serverless functions reject request bodies above 4.5 MB before our code
  runs (and without our envelope); resizing keeps typical phone photos at 0.3–1.5 MB. Routing
  through the server lets us validate and strip metadata (R-05), which a direct-to-storage
  signed upload would skip.
- **Alternatives considered**: `createSignedUploadUrl` direct upload (bypasses server
  validation/EXIF stripping; would need a second "confirm" call); raising limits (not possible on
  Vercel functions).

## R-05 Server-side validation and metadata stripping with `sharp`

- **Decision**: `processRoofPhoto(buffer)`: (1) magic-byte sniff — JPEG `FF D8 FF`, PNG
  `89 50 4E 47 0D 0A 1A 0A`, WebP `RIFF????WEBP`; anything else → `VALIDATION_FAILED`
  "Upload a JPEG, PNG or WebP photo"; the client-supplied MIME type and filename are ignored.
  (2) `sharp(buffer, { failOn: 'error' }).rotate().resize({ width: 2048, height: 2048, fit:
  'inside', withoutEnlargement: true })` and re-encode to the sniffed format (JPEG q85, PNG,
  WebP q85). `sharp` drops EXIF/XMP/ICC metadata unless `withMetadata()` is called, so GPS,
  device and timestamp data are removed; `.rotate()` first bakes in orientation. Decode failure →
  `VALIDATION_FAILED` "This image could not be read". Route runs with `export const runtime =
  'nodejs'`.
- **Rationale**: Vendors see the roof photo (D-01) but must never learn the exact location
  (constitution IV, §9.6); phone photos routinely carry GPS EXIF. Server-side stripping is the
  only enforcement that cannot be bypassed. `sharp` is the standard, prebuilt-binary image
  library supported on Vercel.
- **Alternatives considered**: Rely on browser canvas re-encode only (bypassable by calling the
  API directly); `exifr` to *detect* GPS and reject (still needs a parser, worse UX);
  `file-type` package for sniffing (a dependency for a 10-line check).

## R-06 Storage layout, policies and signed URLs

- **Decision**: Private bucket `roof-photos` created in the 002 migration with
  `file_size_limit = 5242880` and `allowed_mime_types = {image/jpeg,image/png,image/webp}`.
  Object key `{user_id}/{request_id}/{uuid}.{jpg|png|webp}`; `roof_photo_path` stores this key
  (bucket-relative). Uploads/deletes use the caller's RLS-bound client; `storage.objects`
  policies allow the owner to SELECT objects in their `{user_id}/` folder and INSERT/DELETE only
  when folder 2 is one of their **draft** requests. Replacement order: upload new → conditional
  row update (`status = 'draft'`) → best-effort delete of the old key (on row-update failure the
  new object is deleted). Signed URLs: `createSignedUrl(path, 600)` issued only in owner detail
  responses.
- **Rationale**: Matches overview §7 paths/limits and constitution IV (private + signed ≤ 10 min);
  defence in depth at bucket, policy and server levels.
- **Alternatives considered**: Public bucket with unguessable names (violates IV); storing photos
  in Postgres (bloat).

## R-07 Status enforcement and idempotent publish

- **Decision**: `src/lib/domain/requests/status.ts` encodes the canonical machine
  (`draft→open`, `open→quoted`, `open→accepted`, `quoted→accepted`, `accepted→closed`;
  `open→accepted` included because overview §9.3 allows acceptance from `open`). The publish
  handler: load (RLS) → `assertTransition('draft' → 'open')` → `getMissingPublishFields()` →
  `UPDATE … SET status = 'open' WHERE id = $1 AND status = 'draft' RETURNING *`; zero rows →
  `CONFLICT`. The `household_requests_guard_update` trigger independently rejects illegal
  transitions and any non-consent change to non-draft rows by non-privileged sessions, and a
  table CHECK forbids non-draft rows lacking publish-required fields.
- **Rationale**: Deterministic logic in code (II) plus data-layer enforcement (IV); the
  conditional update makes concurrent publishes safe without explicit locks.
- **Alternatives considered**: A Postgres RPC for publish (unnecessary — a single-row conditional
  update is already atomic); app-only checks (bypassable via direct client access).

## R-08 404 vs 403 for other users' requests

- **Decision**: Another household (or anyone RLS hides the row from) gets `404 NOT_FOUND`;
  vendors calling household-only operations get `403 FORBIDDEN` (role check happens before the
  lookup); anonymous gets `401 UNAUTHENTICATED`.
- **Rationale**: Overview §8 allows `NOT_FOUND` for absent records; not disclosing existence of
  other households' requests is the privacy-preserving choice; RLS naturally yields "no row".
- **Alternatives considered**: 403 for non-owners (reveals that an id exists).

## R-09 AI consent semantics

- **Decision**: `ai_consent boolean NOT NULL DEFAULT false`. Drafts: may be set true/false via
  PATCH. Non-draft: PATCH accepts only `{ "ai_consent": false }` (withdrawal); `true` →
  `CONFLICT` "Consent can only be given before publishing". No consent timestamp column is added
  (overview §7 has none); the change is logged as `request.ai_consent_changed`.
- **Rationale**: Constitution IV ("explicit consent"); withdrawal must always be possible; 008
  checks the flag at analysis time, so withdrawal immediately blocks new analyses.
- **Alternatives considered**: `ai_consent_at` column (would extend §7; not needed for MVP).

## R-10 Extension slots instead of feature flags or plugin registries

- **Decision**: One file `src/components/household/extension-slots.tsx` exports six slot
  components that initially return `null`; host components render them inside `SlotBoundary`.
  Later features edit only the body of their slot to render their own component. Props are
  frozen in `extension-slot-types.ts`.
- **Rationale**: Zero runtime machinery, type-checked contracts, trivially mergeable (each team
  edits a different function), and the wizard/dashboard are never rewritten.
- **Alternatives considered**: Dynamic registry/context of plugins (over-engineered for 4
  people/5 hours); hard-coding later features into 002 pages (forces rewrites and merge
  conflicts).

## R-11 Form state

- **Decision**: Controlled React state per step + `safeParse` with the shared Zod schemas for
  inline errors; server `details[].path` mapped to fields. No form library.
- **Rationale**: Four small forms; avoids adding `react-hook-form` (VIII).
- **Alternatives considered**: shadcn `Form` with `react-hook-form` (extra dependency).

## R-12 Formatting

- **Decision**: `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR',
  maximumFractionDigits: 0 })` → "₹1,50,000"; units as "250 units (kWh)/month"; kW with one
  decimal.
- **Rationale**: FR-026, overview money/units conventions; no dependency.

## R-13 Test data for images

- **Decision**: `tests/helpers/images.ts` generates images at test time with `sharp` (a solid
  1200×800 "roof" image; a JPEG carrying GPS EXIF via `withExif`; a 6 MB payload; a text file
  renamed `.jpg`; a truncated JPEG). The e2e test writes a generated JPEG to a temp file for the
  file chooser.
- **Rationale**: No binary fixtures to conflict with 008's roof images in `tests/fixtures/`;
  deterministic GPS-stripping assertion (SC-004).
- **Alternatives considered**: Committed fixture photos (binary churn, ownership overlap with 008).
