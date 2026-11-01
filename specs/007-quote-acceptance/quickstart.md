# Quickstart: Quote Acceptance (007)

Validation guide only. Contracts: [contracts/](contracts/) · Data: [data-model.md](data-model.md) ·
Decisions: [research.md](research.md).

## Prerequisites

- 001 (auth, demo accounts: 1 household + 3 vendors, `requireRole`, `logEvent`), 002 (requests,
  status module, `RequestAcceptanceSlot`), 003 (estimates), 004 (discovery), 005 (quotes, quote
  history, demo quotes), 006 (comparison screen with `actionSlot`, `GET /api/requests/:id/quotes`)
  implemented and migrated.
- Demo request published by the demo household with the three demo quotes submitted.

## Run

```bash
npx supabase start
npx supabase db reset          # includes 20261101000700_quote_acceptances.sql
npm run dev
```

## Automated checks

```bash
npm run test -- tests/unit/requests/acceptance.test.ts
npm run test -- tests/integration/acceptance        # race, withdrawn/rejected, non-owner, cascade, close, contact
npm run test -- tests/integration/rls/quote-acceptances.test.ts
npx playwright test tests/e2e/request-quote-compare-accept.spec.ts
npm run lint && npm run typecheck
```

## Manual acceptance walkthrough

| # | Scenario (spec) | Steps | Expected |
|---|---|---|---|
| 1 | US1-1, US1-2 | Household → Compare quotes → "Accept quote" on SunRise → Escape | Dialog shows SunRise, ₹1,65,000, 3.3 kW, est. net ₹87,000, "other 2 quotes will be declined", "cannot be undone"; Cancel focused; Escape closes, nothing changes |
| 2 | US1-3, US2-3 | Accept SunRise → confirm | Toast "Quote accepted"; SunRise "Accepted", GreenVolt and SolarTech "Not selected"; no accept buttons |
| 3 | US2-1, US2-4 | Open the request page | Next steps panel: SunRise, phone, ₹1,65,000, 3.3 kW, date, five steps, portal link, "not guaranteed" line |
| 4 | US2-2 | Open dashboard | Card shows "Accepted — SunRise Energy" + "View next steps" |
| 5 | US1-4 | In devtools: `POST /api/quotes/<SolarTech id>/accept {"confirmed":true}` | 409 `ALREADY_ACCEPTED` |
| 6 | US1-6 | On a fresh request, vendor withdraws a quote, then household calls accept on it | 409 `QUOTE_NOT_ACCEPTABLE` |
| 7 | US1-7 | Accept via API as vendor / second household / signed out | 403 / 404 / 401, nothing changes |
| 8 | US1-8 | Fresh request; double-click Accept in the dialog | Button disabled after first click; one acceptance |
| 9 | US3-1 | Sign in as SunRise → My quotes | "Accepted by the household…"; "View household contact" shows name, phone, address, location |
| 10 | US3-2, US3-3 | Sign in as GreenVolt → My quotes; call `GET /api/quotes/<GreenVolt id>/contact` | "Not selected…"; 403 `CONTACT_NOT_AVAILABLE` |
| 11 | US3-4 | Household calls `GET /api/quotes/<id>/contact` | 403 |
| 12 | US4-1 | Request page → Mark as closed → confirm | Status "Closed"; panel remains; no actions |
| 13 | US4-2, US4-3 | `POST /api/requests/<quoted id>/close`; repeat on the closed one | 409 `REQUEST_NOT_CLOSABLE` both |
| 14 | FR-023 | Inspect server logs | Only ids/statuses; no names, phones, addresses or coordinates |

## Done when

All automated checks pass (the race test passes 50/50 iterations), rows 1–14 pass, and the e2e
test runs green on a clean `db reset`.
