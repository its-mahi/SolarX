# Contract: `POST /api/quotes/extract`

**Owner**: 009 · **Role**: vendor · **Catalogue**: overview §8 (listed, "added")
**Route file**: `src/app/api/quotes/extract/route.ts` · **Runtime**: Node.js · `maxDuration` ≥ 35 s

Extracts quote fields from vendor-provided text or a file and returns a pre-fill for 005's quote
form. **Never creates or modifies a quote.**

## Request

`Content-Type: multipart/form-data`

| Part | Type | Rule |
|---|---|---|
| `request_id` | string | UUID |
| `text` | string | optional; trimmed length 1–20 000 |
| `file` | file | optional; JPEG, PNG or PDF; ≤ 5 MB (5 242 880 bytes) |

Exactly one of `text` / `file` is required. Zod: `QuoteExtractRequestSchema` in
`src/lib/validation/quote-extraction.ts` (fields), plus byte-level checks via
`detectFileType()` (008, `src/lib/validation/file-signature.ts`). The declared MIME type and file
extension must agree with the detected type.

## Processing order

1. Parse multipart → `400 VALIDATION_FAILED` on malformed form data.
2. Authenticate → `401 UNAUTHENTICATED`.
3. Role `vendor` → else `403 FORBIDDEN` (`role_not_allowed`); vendor profile (`vendors.user_id =
   auth.uid()`) must exist → else `403 FORBIDDEN` (`vendor_profile_required`).
4. Validate fields: both/neither input → `400` (`exactly_one_input_required`); text > 20 000 chars
   → `413 PAYLOAD_TOO_LARGE` (`text_too_long`); file > 5 MB → `413` (`file_too_large`); type not
   JPEG/PNG/PDF or mismatch → `400` (`unsupported_file_type`). **No AI call before this passes.**
5. Load the request with the user-scoped client (vendor view, RLS) → not visible → `404 NOT_FOUND`.
6. Request status `open|quoted` → else `409 CONFLICT` (`request_not_quotable`); vendor has no
   `submitted` quote on it → else `409 CONFLICT` (`active_quote_exists`).
7. `extractQuote({ kind: 'text', text } | { kind: 'file', bytes, mimeType })` → 008 shared client
   (`text` capability for pasted text, `vision` for images, `document` for PDF).
8. On AI failure → `503 AI_UNAVAILABLE` (nothing stored).
9. On success → upload source to `quote-documents/{auth.uid()}/{upload_id}/source.{ext}` with the
   user-scoped storage client (`text/plain; charset=utf-8` for pasted text) → failure →
   `500 INTERNAL`.
10. Respond `200`.

## 200 OK

```json
{
  "data": {
    "fields": {
      "vendor_name": "GreenVolt Solar (Demo)",
      "price_inr": 145000,
      "capacity_kw": 3,
      "panel_details": { "brand": "Demo PV", "wattage": 550, "quantity": 6 },
      "inverter_details": { "brand": "Demo Inverter", "type": "on-grid" },
      "warranty_details": { "panel_product_years": 12, "performance_years": 25, "inverter_years": 5 },
      "installation_days": 20,
      "earthing_included": null,
      "documentation_included": true
    },
    "prefill": {
      "price": 145000,
      "capacity_kw": 3,
      "panel_details": { "brand": "Demo PV", "wattage": 550, "quantity": 6 },
      "inverter_details": { "brand": "Demo Inverter", "type": "on-grid" },
      "warranty_details": { "panel_product_years": 12, "performance_years": 25, "inverter_years": 5 },
      "installation_days": 20,
      "earthing_included": null,
      "documentation_included": true,
      "source": "ai_extracted",
      "source_document_path": "<vendor_user_id>/<upload_id>/source.txt"
    },
    "missing_fields": ["earthing_included"],
    "discarded_fields": [],
    "document_vendor_name": "GreenVolt Solar (Demo)",
    "source_document": {
      "path": "<vendor_user_id>/<upload_id>/source.txt",
      "kind": "text",
      "mime_type": "text/plain",
      "size_bytes": 812
    },
    "model": "<configured model id>",
    "prompt_version": "quote-extraction.v1",
    "notice": "Pre-filled from your document by AI — check every value before submitting."
  }
}
```

`QuoteExtractResponseSchema` (Zod) in `src/lib/validation/quote-extraction.ts`. When every field is
`null`, the response is still 200 with all paths in `missing_fields`; the panel shows the "nothing
found" state.

## 503 AI_UNAVAILABLE

```json
{ "error": { "code": "AI_UNAVAILABLE",
  "message": "Extraction unavailable — fill in the form manually",
  "details": [{ "reason": "invalid_output", "retryable": true }] } }
```

`reason ∈ timeout | rate_limited | provider_error | invalid_output | not_configured | unsupported_input`.

## Error table

| HTTP | Code | `details[0].reason` |
|---|---|---|
| 400 | `VALIDATION_FAILED` | field issues, `exactly_one_input_required`, `unsupported_file_type` |
| 401 | `UNAUTHENTICATED` | — |
| 403 | `FORBIDDEN` | `role_not_allowed`, `vendor_profile_required` |
| 404 | `NOT_FOUND` | — |
| 409 | `CONFLICT` | `request_not_quotable`, `active_quote_exists` |
| 413 | `PAYLOAD_TOO_LARGE` | `text_too_long`, `file_too_large` |
| 503 | `AI_UNAVAILABLE` | AI failure kind |
| 500 | `INTERNAL` | — (storage upload failed) |

Error messages never include document content, extracted values or provider output.

## Logging

One `quote_extraction` line: outcome, failure kind, input kind (`text|image|pdf`), size bucket,
model, prompt version, duration. No content, values, names or paths.

## Tests

`tests/integration/quotes/extract-route.test.ts` (see tasks.md) and
`tests/integration/quotes/injection-invariance.test.ts`.
