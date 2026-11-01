# Contract: Integration with 005 (quote form and submission) and 006 (comparison)

**Owner**: 009 · These are the minimal changes 009 makes inside files owned by 005 and 006. They
must not change those features' existing behaviour for manual quotes or their scoring.

## A. 005 quote form — `src/components/vendor/quote-form.tsx`

Assumed (005): a reusable client component driven by 005's Zod `QuoteInputSchema`
(`src/lib/validation/quotes.ts`). 009 requires these optional props:

```ts
interface QuoteFormExtractionProps {
  prefill?: QuoteFormPrefill;         // from POST /api/quotes/extract → data.prefill
  missingFields?: string[];           // highlight as "Not found in your document — please fill in"
  discardedFields?: string[];         // highlight as "Value could not be read — please check"
}
```

- When `prefill` is set: values populate the fields; hidden `source = 'ai_extracted'` and
  `source_document_path` are submitted; a banner reads "Pre-filled from your document by AI —
  check every value before submitting." with a "Clear and enter manually" action that resets the
  form and sets `source = 'manual'`, `source_document_path = null`.
- Without `prefill`: unchanged (`source = 'manual'`).
- All fields stay editable; nothing auto-submits.

## B. 005 quote validation — `src/lib/validation/quotes.ts`

Add a refinement to 005's submit schema:

- `source = 'ai_extracted'` ⇒ `source_document_path` matches
  `^[0-9a-f-]{36}/[0-9a-f-]{36}/source\.(jpg|png|pdf|txt)$`.
- `source = 'manual'` ⇒ `source_document_path` is `null` or absent.

## C. 005 submit handler — `POST /api/quotes` in `src/app/api/quotes/route.ts`

After 005's existing validation and authorization, when `source_document_path` is present:

1. The first path segment MUST equal `auth.uid()` → else `403 FORBIDDEN`
   (`source_document_not_owned`).
2. The object MUST exist in `quote-documents` (checked with the user-scoped storage client) → else
   `400 VALIDATION_FAILED` (`source_document_missing`).

The DB check `quotes_ai_extracted_requires_document` (data-model §1) backs this up. No other change
to 005's handler; extracted quotes are inserted by 005's normal code path.

## D. Vendor request page — `src/app/vendor/requests/[id]/page.tsx`

Mount `QuoteExtractionPanel` (`src/components/vendor/quote-extraction-panel.tsx`) above 005's quote
form when the vendor can quote. The panel calls `onPrefill({ prefill, missing_fields,
discarded_fields, source_document })`; the page passes those to `QuoteForm`.

```ts
interface QuoteExtractionPanelProps {
  requestId: string;
  onPrefill: (result: QuoteExtractResponse['data']) => void;
  disabled?: boolean;   // true while the form is submitting
}
```

Panel states: idle (tabs "Paste text" / "Upload file", helper "JPEG, PNG or PDF up to 5 MB, or up
to 20,000 characters"), validating, extracting (spinner, "this can take up to 30 seconds", action
disabled), success (summary "{n} fields pre-filled · {m} not found · {k} could not be read", the
document vendor name "Name in document: … (for your information only)", link to view own source),
nothing found, unavailable ("Extraction unavailable — fill in the form manually", pasted text kept,
Retry), error (size/type message).

## E. 006 comparison — `GET /api/requests/:id/quotes` and `src/components/quotes/quote-card.tsx`

- The list response MUST include `source` (`manual|ai_extracted`) for each quote (add if 006 does
  not already return it). The storage path is not needed by the browser.
- `QuoteCard`: when `source = 'ai_extracted'`, show a neutral marker "AI-extracted from vendor
  document" and a `SourceDocumentButton` ("View source document") that opens
  `SourceDocumentViewer` (`src/components/quotes/source-document-viewer.tsx`).
- The marker and button MUST NOT affect score display, order, or any visual emphasis of ranking.

## F. 006 scoring — `src/lib/domain/quotes/` (read-only for 009)

009 changes nothing. The injection test imports 006's exported scoring function and input type
(assumed `scoreQuotes(quotes, config)` with `config` from `src/config/scoring.v1.ts`; adapt the
import to 006's actual export names).
