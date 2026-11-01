# Contract: `GET /api/quotes/:id/source-document`

**Owner**: 009 · **Roles**: household owning the quote's request; vendor owning the quote
**Catalogue**: **Extension to overview §8** (research R-14) · **Route file**:
`src/app/api/quotes/[id]/source-document/route.ts`

Issues a short-lived signed URL for the source document of a quote (plan §13 defense 7).

## Request

Path param `id`: `z.string().uuid()` → `400 VALIDATION_FAILED`.

## Processing

1. Authenticate → `401`.
2. Load the quote with the user-scoped client. RLS (005/006) makes it visible only to the owning
   vendor and the household owning the request → otherwise `404 NOT_FOUND`.
3. `source_document_path` null → `404 NOT_FOUND` (`no_source_document`).
4. `createSignedUrl(source_document_path, 300)` on bucket `quote-documents` with the user-scoped
   storage client (storage RLS: `quote_documents_009_vendor_select` /
   `quote_documents_009_household_select`) → failure → `404 NOT_FOUND`.
5. Respond.

## 200 OK

```json
{
  "data": {
    "url": "https://…signed…",
    "expires_at": "2026-11-01T10:05:00Z",
    "kind": "text",
    "mime_type": "text/plain",
    "label": "Vendor-provided document — not verified"
  }
}
```

`kind` derived from the file extension (`txt → text`, `pdf → pdf`, `jpg|png → image`).
`QuoteSourceDocumentResponseSchema` in `src/lib/validation/quote-extraction.ts`.

## Errors

| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_FAILED` | `id` not a UUID |
| 401 | `UNAUTHENTICATED` | no session |
| 404 | `NOT_FOUND` | quote not visible to caller, no source document, or object missing |

Other vendors and other households get `404` (no existence leak).

## Viewer behaviour (`src/components/quotes/source-document-viewer.tsx`)

- Fetches a new URL every time it opens; never caches URLs beyond `expires_at`.
- `image` → `<img alt="Vendor quotation image">`; `pdf` → "Open PDF" link, new tab,
  `rel="noopener noreferrer"`; `text` → fetch body and render inside `<pre>` as a text node
  (no Markdown/HTML rendering, no auto-linking).
- Always shows the label "Vendor-provided document — not verified" and the note "Scores are
  calculated only from the structured quote fields."
- States: loading, success, error ("Document unavailable — try again").

## Tests

`tests/integration/quotes/source-document-route.test.ts`: owning household → 200 with URL and
`expires_at` ≤ now + 600 s; owning vendor → 200; other household → 404; other vendor → 404;
manual quote → 404 `no_source_document`; unauthenticated → 401.
