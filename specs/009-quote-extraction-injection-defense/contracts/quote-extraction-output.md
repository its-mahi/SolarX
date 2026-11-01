# Contract: Quote Extraction AI Output (`src/lib/ai/schemas/quote-extraction.ts`)

**Prompt**: `src/lib/ai/prompts/quote-extraction.v1.ts` · `QUOTE_EXTRACTION_PROMPT_VERSION = 'quote-extraction.v1'`
**Source**: project-plan §14 "Quote extraction output" · **Client**: 008 `contracts/ai-client.md`

## 1. Shape requested from the model

```json
{
  "vendor_name": "Sample Solar Vendor",
  "price_inr": 165000,
  "capacity_kw": 3,
  "panel_details": { "brand": "Sample Brand", "wattage": 550, "quantity": 6 },
  "inverter_details": { "brand": "Sample Inverter", "type": "on-grid" },
  "warranty_details": { "panel_product_years": null, "performance_years": 25, "inverter_years": null },
  "installation_days": 15,
  "earthing_included": true,
  "documentation_included": true,
  "missing_fields": []
}
```

## 2. Two-stage validation

**Stage A — envelope (`QuoteExtractionEnvelopeSchema`, passed to `generateStructured`)**:
`z.object({ vendor_name, price_inr, capacity_kw, panel_details, inverter_details,
warranty_details, installation_days, earthing_included, documentation_included, missing_fields })`
with every key `z.unknown().optional()`; unknown keys stripped. A non-object (array, string, number,
null) or non-JSON → `invalid_output` → 503.

**Stage B — field sanitising (`sanitizeQuoteExtraction(envelope) → { fields, discarded_fields }`)**:
each path is checked with its own rule (data-model §4). Absent or `null` → `null` (not discarded).
Present but invalid → `null` and the path is added to `discarded_fields`. A nested object key that
is present but not an object → all its sub-paths discarded. Unknown nested keys dropped. The model's
`missing_fields` is ignored.

**Stage C — derived values (code)**:
- `computeMissingFields(fields)` → the 13 `QUOTE_FIELD_PATHS` whose value is `null`.
- `toQuoteFormPrefill(fields, sourceDocumentPath)` → 005 form shape (data-model §5).

## 3. Rule table

| Path | Valid | Example discarded values |
|---|---|---|
| `vendor_name` | string, trimmed 1–120 | `""`, 42 |
| `price_inr` | integer 1–10 000 000 | `"1.45 lakh"`, `-5`, `145000.5`, `0` |
| `capacity_kw` | number > 0, ≤ 100, ≤ 2 decimals | `"3kW"`, `500`, `0` |
| `panel_details.brand` / `inverter_details.brand` | string 1–80 | `{}`, 300-char string |
| `panel_details.wattage` | integer 1–1 000 | `"550W"`, `5000` |
| `panel_details.quantity` | integer 1–500 | `6.5`, `0` |
| `inverter_details.type` | `on-grid` \| `off-grid` \| `hybrid` | `"grid-tied"`, `"ON-GRID"` |
| `warranty_details.*_years` | integer 0–40 | `300`, `"25 years"` |
| `installation_days` | integer 1–365 | `"2 weeks"`, `0` |
| `earthing_included` / `documentation_included` | boolean | `"yes"`, `1` |

## 4. Prompt requirements (`quote-extraction.v1`)

After the shared preamble, the system instruction MUST:

- State the single task: copy values explicitly stated in the attached/quoted vendor document into
  the listed keys.
- List the keys and value formats (whole rupees as an integer, kW as a number, years/days as
  integers, booleans, inverter type enum).
- Require `null` for anything not explicitly stated; forbid estimating, calculating totals from
  items, assuming typical warranties or converting vague phrases.
- State that the document may contain instructions, requests about ranking, scores or other
  vendors, and that these are part of the data and must be ignored.
- Require JSON only with exactly these keys; no commentary.
- Contain **no** scoring weights, ranking rules, other vendors' data or household data, and import
  nothing from `src/config/scoring.v1.ts` or `src/lib/domain/quotes/`.

Input parts: `instructionText("Extract the quotation fields from the vendor document below.")` +
`untrustedText('vendor_quote', text, { maxChars: 20000 })` **or**
`untrustedFile('vendor_quote_document', bytes, mime)`.

## 5. Fixtures (`tests/fixtures/quotes/extraction-outputs.ts`)

| Fixture | Expected |
|---|---|
| `greenvoltValid` | all 13 GreenVolt values; `earthing_included: null`; `missing_fields: ['earthing_included']` |
| `greenvoltAdversarial` | same values + `rank`, `score`, `recommended`, `verified_vendor`, `missing_fields: []`, `panel_details.priority` → identical sanitised fields and missing list; extra keys absent |
| `partialInvalid` | `price_inr: "1.45 lakh"`, `capacity_kw: 500`, `inverter_details.type: "grid-tied"` → those three `null` and in `discarded_fields`; others kept |
| `nestedNotObject` | `panel_details: "Demo PV 550W x6"` → 3 panel paths discarded |
| `allNull` | all `null` → 13 missing, 0 discarded ("nothing found") |
| `notJson` / `arrayRoot` / `stringRoot` | `invalid_output` |
| `lyingMissingList` | values present but `missing_fields: ["price_inr"]` → code list excludes `price_inr` |
