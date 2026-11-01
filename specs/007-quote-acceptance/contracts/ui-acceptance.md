# UI contract: Acceptance, next steps, vendor outcome

All components live in existing feature folders and are mounted through extension points defined
by 002 (slots), 005 (quote history) and 006 (`QuoteCard.actionSlot`).

## 1. `AcceptQuoteButton` + `AcceptQuoteDialog` — `src/components/quotes/accept-quote-button.tsx`, `src/components/quotes/accept-quote-dialog.tsx`

- Rendered by `QuoteComparisonView` (006) into each card's `actionSlot` when
  `canAcceptQuote(requestStatus, quote.status)` is true; otherwise the slot shows the status badge
  ("Accepted", "Not selected", "Withdrawn").
- Dialog (shadcn `AlertDialog`): title "Accept {vendor}'s quote?"; body lists price (vendor-confirmed),
  capacity, estimated net cost (`EstimateBadge` "estimate"), "The other {n} active quote(s) will be
  declined.", "This cannot be undone in SURYAMIT."; buttons **Cancel** (default focus) and
  **Accept quote**. Escape/overlay click cancels.
- On confirm: `POST /api/quotes/:id/accept {confirmed:true}`; confirm button shows a spinner and is
  disabled (no double submit); dialog cannot be dismissed while pending.
- Success: close dialog, toast "Quote accepted", re-run compare (read-only view), focus moves to the
  page heading; household request page shows next steps.
- 409: toast with the server message, refresh to current state. Other errors: inline error in the
  dialog with **Try again**.

## 2. `AcceptedNextSteps` — `src/components/household/accepted-next-steps.tsx`

Rendered by 002's `RequestAcceptanceSlot` (request page top, when `accepted`/`closed`), using the
`acceptance` field of `GET /api/requests/:id/quotes`.

- Heading "Quote accepted" (or "Request closed").
- Vendor company name (+ "Demo" badge), phone as `tel:` link or "Phone not provided", accepted price
  and capacity (vendor-confirmed), acceptance date (`en-IN`).
- Ordered next steps (FR-013) with the official portal link `https://pmsuryaghar.gov.in/`
  (`rel="noopener noreferrer"`) and the line "Subsidy is decided and paid under the official
  scheme; SURYAMIT does not guarantee it."
- **Mark as closed** button (only when `accepted`) → `CloseRequestDialog`.
- States: loading skeleton, error with Retry; renders nothing for other statuses.

## 3. `CloseRequestDialog` — `src/components/household/close-request-dialog.tsx`

Confirmation "Close this request? It will become read-only." → `POST /api/requests/:id/close
{confirmed:true}`; pending/disabled; success refreshes the page (`router.refresh()`); 409 shows
the server message.

## 4. Dashboard card — `RequestQuotesSlot` card variant (006 slot body, extended by 007)

When `request.status` is `accepted`/`closed`: "Accepted — {vendor company}" and a "View next steps"
link to the request page (002 shows the status badge and next-action link).

## 5. Vendor quote history — inside 005's `src/components/quotes/quote-history.tsx`

- `QuoteOutcomeNotice` (`src/components/quotes/quote-outcome-notice.tsx`): `accepted` → "Accepted
  by the household — arrange a site survey"; `rejected` → "Not selected — the household accepted
  another quote"; others → nothing.
- `AcceptedQuoteContact` (`src/components/quotes/accepted-quote-contact.tsx`): button
  "View household contact" (accepted only) → dialog fetching `GET /api/quotes/:id/contact`;
  shows name, phone (`tel:`), address, locality, coordinates with an OpenStreetMap link; states
  loading / error (403 message shown verbatim) / success. Data is not cached in client storage.

## Accessibility

All dialogs trap focus and restore it on close; buttons have text labels; status is conveyed by
text and icon, not colour alone; WCAG AA contrast; works at 375 px width.
