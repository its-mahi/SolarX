# Contract: Household UI Routes and Extension Slots

## Routes

| Path | Access | Renders | States |
|---|---|---|---|
| `/household` | household | Dashboard: heading, "New request" button, `RequestList` of `RequestCard`s | `loading.tsx` skeleton; empty state "Create your solar request"; error state with retry |
| `/household/requests/new` | household | `RequestWizard` with no request, step `location` | — |
| `/household/requests/[id]` | owner household | draft → `RequestWizard` at `?step=` (valid) or first incomplete step; otherwise `RequestSummary` | `loading.tsx`; `not-found.tsx` for unknown/others' ids |
| `/household/requests/[id]/quotes` | — | **not created by 002** (006 owns) | — |

Navigation: `nav-config.ts` household items become Dashboard (`/household`) and New request
(`/household/requests/new`).

## Wizard behaviour

| Step (`?step=`) | Fields | On Continue |
|---|---|---|
| `location` | map pin, latitude, longitude, "Use my location", address, locality | new → `POST /api/requests` then replace URL with `/household/requests/{id}?step=photo`; existing → `PATCH` |
| `photo` | file chooser (`accept="image/jpeg,image/png,image/webp"`, `capture="environment"`), preview, replace, AI-consent checkbox, `RoofAnalysisSlot` | upload happens on file selection (`POST …/photo`, progress bar); consent saved via `PATCH { ai_consent }`; Continue requires no pending upload |
| `usage` | monthly units, monthly bill (optional), budget, preferred capacity (optional), `UsageVoiceSlot` | `PATCH` usage fields |
| `review` | grouped summary + Edit links, photo, consent, missing list, `PrivacyNotice`, `RequestEstimateSlot`, `RoofAnalysisSlot` | "Publish" (disabled while `missing_publish_fields` non-empty) → `PublishDialog` confirm → `POST …/publish` → `router.replace('/household/requests/{id}')` + success toast "Your request is live. Vendors can now send quotes." |

Back navigation never discards saved data. Every save shows a pending state on the button;
failures show an inline `ErrorState`/toast with retry and keep local values. A `409` on any save
redirects to the read-only request page with "This request has been published and can no longer
be edited".

AI consent copy: "Allow SURYAMIT to send this roof photo to an AI service to describe visible
obstructions (optional). The photo is only used for this analysis. You can withdraw consent at
any time."

Privacy notice copy (review + publish dialog): "Vendors will see: your approximate location
(about 1 km), locality, monthly units, budget, preferred capacity and roof photo. Vendors will
not see your exact address, map pin, name or phone number unless you accept their quote."

## Slot contract

File: `src/components/household/extension-slots.tsx` (implementations) and
`src/components/household/extension-slot-types.ts` (types). Every slot initially returns `null`.
Hosts wrap each slot in `<SlotBoundary name="…">` (error boundary + `Suspense`): a throwing slot
renders nothing (logged to console in development only).

```text
type SlotVariant = 'review' | 'detail' | 'card' | 'photo-step'

RequestEstimateSlot     { request: HouseholdRequestDto; variant: 'review' | 'detail' | 'card' }        → 003
RoofAnalysisSlot        { requestId: string; hasRoofPhoto: boolean; aiConsent: boolean;
                          status: RequestStatus; variant: 'photo-step' | 'review' | 'detail' }         → 008
UsageVoiceSlot          { onSuggest: (values: Partial<UsageFields>) => void; disabled: boolean }      → 010
RequestQuotesSlot       { request: HouseholdRequestDto; variant: 'detail' | 'card' }                    → 006
RequestAcceptanceSlot   { request: HouseholdRequestDto }                                                → 007
AdvisorShortcutSlot     { request: HouseholdRequestDto; variant: 'detail' | 'card' }                    → 011
```

`UsageFields` = `z.infer<typeof usageFieldsSchema>` (`monthly_units`, `monthly_bill`, `budget`,
`preferred_capacity_kw`).

### Placement

| Host | Slots (top → bottom) |
|---|---|
| Dashboard `RequestCard` | `RequestEstimateSlot(card)`, `RequestQuotesSlot(card)`, `AdvisorShortcutSlot(card)` |
| Wizard photo step | `RoofAnalysisSlot(photo-step)` under the preview |
| Wizard usage step | `UsageVoiceSlot` above the consumption field |
| Wizard review step | `RequestEstimateSlot(review)`, `RoofAnalysisSlot(review)` |
| `RequestSummary` | `RequestAcceptanceSlot`, `RequestQuotesSlot(detail)`, `RequestEstimateSlot(detail)`, `RoofAnalysisSlot(detail)`, `AdvisorShortcutSlot(detail)` |

### Rules for slot owners

1. Edit only your slot's function body in `extension-slots.tsx` (import your component there).
2. Do not change prop types; if more data is needed, fetch it inside your component via your own
   Route Handler using `request.id`.
3. `UsageVoiceSlot.onSuggest` values must already pass `usageFieldsSchema.partial()`; the host
   highlights suggested fields ("Suggested — please check") and saves only on Continue.
4. Slots must implement their own loading/error states and must not block the host's primary
   action (Continue / Publish / Compare).
5. Estimates rendered in `RequestEstimateSlot` must follow constitution V (assumptions, rule
   version, source, "indicative" wording).

## Request status badge (`src/components/shared/request-status-badge.tsx`)

| Status | Label | Style |
|---|---|---|
| draft | Draft | neutral outline |
| open | Open — awaiting quotes | mint background, forest text |
| quoted | Quotes received | solar-green |
| accepted | Quote accepted | forest green solid |
| closed | Closed | muted |

Props `{ status: RequestStatus }`; reused by 004 for vendor views.
