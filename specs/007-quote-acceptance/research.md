# Research: Quote Acceptance (007)

**Date**: 2026-11-01 · **Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

Conventions inherited from 001/002/004/005 specs: route pipeline
`parse → Zod (.strict()) → requireRole → assertSameOrigin (cookie POST) → act → ok()/toErrorResponse()`;
privileged writes through `SECURITY DEFINER` Postgres functions with
`SET search_path = public, pg_temp`, `REVOKE ALL … FROM public, anon`, `GRANT EXECUTE … TO authenticated`;
custom SQLSTATEs `SM403`/`SM404`/`SM409` with a reason in the message; `logEvent` with allowlisted keys.

## R-01 Atomic acceptance as one SECURITY DEFINER function

- **Decision**: `public.accept_quote(p_quote_id uuid)` (plpgsql, SECURITY DEFINER), called with the
  caller's JWT client from the route. Steps, all in the function's single transaction:
  1. Household guard: `auth.uid()` not null and `profiles.role = 'household'`, else `42501`.
  2. `select request_id from quotes where id = p_quote_id` (no lock) → none ⇒ `SM404 QUOTE_NOT_FOUND`.
  3. `select … from household_requests where id = v_request_id FOR UPDATE` — **request lock first**;
     `user_id <> auth.uid()` ⇒ `SM404 QUOTE_NOT_FOUND` (do not reveal another household's data).
  4. Request `accepted`/`closed` or an acceptance row exists ⇒ `SM409 ALREADY_ACCEPTED`;
     any other status not in (`open`,`quoted`) ⇒ `SM409 REQUEST_NOT_ACCEPTING`.
  5. `select … from quotes where id = p_quote_id FOR UPDATE`; `status <> 'submitted'` ⇒
     `SM409 QUOTE_NOT_ACCEPTABLE` (message includes current status).
  6. `update quotes set status='accepted'` (chosen); `update quotes set status='rejected' where
     request_id = v_request_id and id <> p_quote_id and status = 'submitted' returning id`;
     `update household_requests set status='accepted'`; `insert into quote_acceptances (quote_id,
     request_id, household_id) … returning *`.
  7. Return `(acceptance_id, quote_id, request_id, household_id, accepted_at, rejected_quote_ids uuid[])`.
  Unique violation `23505` on either unique index ⇒ mapped to `CONFLICT ALREADY_ACCEPTED`
  (backstop if a code path ever skips step 4).
- **Rationale**: Overview §5 rule 5 and §9.3; constitution VI atomicity. Locking the request row
  serialises every acceptance for that request, so two concurrent attempts (same or different
  quotes) cannot both pass step 4: the second waits, then sees `accepted` (READ COMMITTED
  `FOR UPDATE` returns the latest committed version) and raises `SM409`. Consistent with 005's
  `submit_quote`/`withdraw_quote` style; 002's guard trigger treats definer RPCs as privileged.
- **Alternatives considered**: (a) Multi-statement writes from the route with the admin client —
  not atomic across HTTP round-trips. (b) SERIALIZABLE isolation with retry — more complex, retries
  needed in the route. (c) Relying only on the unique index — prevents duplicates but not a
  half-applied cascade or accepting a withdrawn quote.

## R-02 Lock ordering and interaction with 005

- **Decision**: Always lock request → quote. 005's `submit_quote` locks the request then inserts;
  `withdraw_quote` locks only the quote. 007 never locks a quote before its request.
- **Rationale**: No lock cycle ⇒ no deadlock. Outcomes: submit before accept ⇒ the new quote is
  rejected by the cascade; submit after ⇒ `REQUEST_NOT_QUOTABLE`. Withdraw before accept ⇒ accept
  sees `withdrawn` ⇒ `QUOTE_NOT_ACCEPTABLE`; accept before withdraw ⇒ withdraw sees `accepted` ⇒
  `QUOTE_NOT_WITHDRAWABLE`. The cascade `UPDATE … WHERE status = 'submitted'` re-evaluates rows
  changed concurrently, so a quote withdrawn mid-cascade stays `withdrawn`.
- **Alternatives considered**: Advisory locks keyed by request id (extra mechanism, same effect).

## R-03 `quote_acceptances` constraints (D-03)

- **Decision**: `UNIQUE (quote_id)` and `UNIQUE (request_id)`; FKs to `quotes`, `household_requests`
  and `profiles` with `on delete cascade`; row is immutable (no `updated_at`, no update policy).
- **Rationale**: Overview §7 and D-03 — the database itself guarantees one acceptance per request.
- **Alternatives considered**: Partial unique index on `quotes (request_id) where status='accepted'`
  (also useful, but it is 005's table; the acceptance table is the canonical guard).

## R-04 Confirmation flag in the API

- **Decision**: Body `{ "confirmed": true }` (`z.literal(true)`, strict). Anything else ⇒ 400.
- **Rationale**: FR-003 — protects against accidental or scripted one-click acceptance; the UI
  dialog sets it only on confirm.
- **Alternatives considered**: Empty body (no server-side evidence of confirmation); idempotency
  key (unneeded: a repeat is a 409 by rule).

## R-05 Error mapping (`src/app/api/quotes/_lib/map-acceptance-db-error.ts`)

| SQLSTATE / reason | API code | HTTP | Message |
|---|---|---|---|
| `42501` | `FORBIDDEN` | 403 | "Only households can accept quotes." |
| `SM404 QUOTE_NOT_FOUND` / `REQUEST_NOT_FOUND` | `NOT_FOUND` | 404 | "Quote not found." / "Request not found." |
| `SM409 ALREADY_ACCEPTED` | `CONFLICT` | 409 | "This request already has an accepted quote." |
| `SM409 REQUEST_NOT_ACCEPTING` | `CONFLICT` | 409 | "This request is not accepting quotes." |
| `SM409 QUOTE_NOT_ACCEPTABLE` | `CONFLICT` | 409 | "This quote can no longer be accepted (status: withdrawn)." |
| `SM409 REQUEST_NOT_CLOSABLE` | `CONFLICT` | 409 | "Only an accepted request can be closed." |
| `SM403 CONTACT_NOT_AVAILABLE` | `FORBIDDEN` | 403 | "Contact details are shared only after the household accepts your quote." |
| `23505` (acceptance unique indexes) | `CONFLICT` | 409 | "This request already has an accepted quote." |
| other | `INTERNAL` | 500 | generic |

`details: [{ reason }]` carries the reason code. 005's mapper is not modified.

## R-06 Closing (D-10)

- **Decision**: `public.close_request(p_request_id uuid)` SECURITY DEFINER: household guard; lock
  request `FOR UPDATE`; missing or not owned ⇒ `SM404 REQUEST_NOT_FOUND`; status ≠ `accepted` ⇒
  `SM409 REQUEST_NOT_CLOSABLE`; `update … set status='closed'`. Exposed as
  **`POST /api/requests/:id/close`** with body `{ "confirmed": true }`.
- **Rationale**: Overview §8 has no endpoint for `accepted → closed`; 002's `PATCH` only edits
  draft fields. A dedicated action endpoint mirrors `/publish`. **Extension to overview §8.**
- **Alternatives considered**: `PATCH /api/requests/:id {status}` (mixes status changes into a
  draft-field endpoint owned by 002; weakens its guard).

## R-07 Contact reveal (D-01)

- **Decision**: `public.accepted_household_contact(p_quote_id uuid)` STABLE SECURITY DEFINER: vendor
  guard (`42501`, `SM403 VENDOR_PROFILE_MISSING` as in 005); quote must belong to the caller's
  vendor ⇒ else `SM404 QUOTE_NOT_FOUND`; quote `status = 'accepted'` AND an acceptance row exists ⇒
  else `SM403 CONTACT_NOT_AVAILABLE`; returns only `request_id, household_name, household_phone,
  address_text, latitude, longitude, locality, accepted_at`. Exposed as
  **`GET /api/quotes/:id/contact`** (vendor). **Extension to overview §8.**
- **Rationale**: 004 deliberately grants vendors no `SELECT` on `household_requests`, and 001's
  `profiles` policy is select-own; adding broad RLS policies would risk recursive policies
  (`household_requests` ↔ `quotes`) and full-row exposure. A definer function returns exactly the
  permitted columns to exactly the accepted vendor, matching 004/005's pattern. Accepted requests
  are hidden from 004's discovery, so a dedicated endpoint is needed.
- **Alternatives considered**: Extending `GET /api/quotes/mine` (005) with contact fields (puts PII
  in a list response); RLS policies on `profiles`/`household_requests` for the accepted vendor
  (recursion and column-exposure risk).

## R-08 Household's accepted summary

- **Decision**: `public.household_acceptance_summary(p_request_id uuid)` STABLE SECURITY DEFINER:
  household guard; request must be owned by the caller (else returns no row); returns
  `quote_id, accepted_at, vendor_company_name, vendor_is_demo, vendor_phone, price, capacity_kw`.
  The data is delivered as an additive `acceptance` field on 006's
  `GET /api/requests/:id/quotes` (owner household), consumed by `RequestAcceptanceSlot` and the
  dashboard card (`RequestQuotesSlot` card variant).
- **Rationale**: The vendor phone lives in `profiles` (select-own RLS), so a definer function is
  needed; reusing 006's owner-only endpoint avoids another endpoint.
- **Alternatives considered**: New `GET /api/requests/:id/acceptance` endpoint (one more route for
  the same data); RLS policy on `profiles` for the accepting household (recursion risk).

## R-09 Domain helpers

- **Decision**: `src/lib/domain/requests/acceptance.ts`: `canAcceptQuote(requestStatus, quoteStatus)`,
  `canCloseRequest(requestStatus)`, `quoteOutcomeLabel(quoteStatus)` built on 002's
  `canTransition` from `src/lib/domain/requests/status.ts`. Used by the UI to show/hide actions
  and unit-tested; the database function remains the authority.
- **Rationale**: Constitution layering (status rules in `src/lib/domain/requests/`).

## R-10 UI

- **Decision**: `AcceptQuoteButton` + `AcceptQuoteDialog` (shadcn `AlertDialog`; Cancel default
  focus; confirm disabled while pending) in `src/components/quotes/`, injected via 006's
  `QuoteCard.actionSlot` from `QuoteComparisonView`. `AcceptedNextSteps` and `CloseRequestDialog`
  in `src/components/household/`, rendered by 002's `RequestAcceptanceSlot`. Dashboard card:
  `RequestQuotesSlot` card variant shows "Accepted — {vendor}". Vendor: `QuoteOutcomeNotice` and
  `AcceptedQuoteContact` (dialog fetching the contact on demand) rendered inside 005's
  `src/components/quotes/quote-history.tsx`.
- **Rationale**: Uses the extension points the other features defined; no host page rewrites.

## R-11 Logging

- **Decision**: After a successful RPC, `logEvent('quote.accepted', {userId, requestId, quoteId,
  fromStatus:'submitted', toStatus:'accepted'})`, one `logEvent('quote.rejected', {requestId,
  quoteId, fromStatus:'submitted', toStatus:'rejected'})` per rejected id,
  `logEvent('request.accepted', {requestId, toStatus:'accepted'})`, `logEvent('request.closed', …)`,
  `logEvent('contact.revealed', {userId, quoteId, requestId})`. Never contact fields.
- **Rationale**: Constitution IV ("logs record status changes and errors only").

## R-12 Tests

- **Decision**:
  - Integration (Vitest + local Supabase, demo users): race — `Promise.all` of two accept calls
    (different quotes, and same quote) from two clients of the owning household, repeated 50 times
    with fresh fixtures, asserting exactly one 200 / one 409, one accepted quote, one acceptance
    row; withdrawn and rejected quote ⇒ 409; non-owner household ⇒ 404, vendor ⇒ 403, anon ⇒ 401,
    with nothing changed; cascade correctness incl. a pre-withdrawn quote staying `withdrawn`;
    DB-level duplicate insert ⇒ `23505`; close and contact rules; RLS on `quote_acceptances`.
  - Unit: `acceptance.ts` helpers.
  - E2E (Playwright): full request → quote → compare → accept flow, owned by 007 because it
    completes P0.
- **Rationale**: Constitution VI, plan §18 end-to-end list.

## R-13 Dependencies

- **Decision**: No new runtime dependency (shadcn `AlertDialog`, `Dialog`, `Button`, `Badge`,
  `Alert` already added by 001/005).
