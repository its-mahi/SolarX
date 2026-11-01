# Data Model: Voice Requirement Entry (010)

**Spec**: [spec.md](spec.md) · **Research**: [research.md](research.md)

This feature adds **no tables, columns, buckets or migrations**. All objects below are
transient DTOs and Zod schemas. The only persistent data touched is the existing
`household_requests` fields owned by 002 (overview §7), and only through 002's own save action.

| Overview §7 field (owned by 002) | Voice DTO field | Unit / type |
|---|---|---|
| `household_requests.monthly_units` | `monthly_units` | kWh per month, integer |
| `household_requests.monthly_bill` | `monthly_bill` | INR, integer |
| `household_requests.budget` | `budget` | INR, integer |
| `household_requests.preferred_capacity_kw` | `preferred_capacity_kw` | kW, decimal (≤ 1 dp, per 002 FR-009) |

Field names are identical to overview §7 so applied values map 1:1 onto 002's form.

---

## 1. Enumerations

| Name | Values | Used in |
|---|---|---|
| `VoiceLanguage` | `hi-IN` \| `gu-IN` \| `en-IN` | request body, picker |
| `VoiceFieldKey` | `monthly_units` \| `monthly_bill` \| `budget` \| `preferred_capacity_kw` | everywhere |
| `VoiceFieldStatus` | `heard` \| `not_heard` \| `needs_entry` | response |
| `VoiceFieldSource` | `rules` \| `ai` \| `both` | response (only when `heard`) |
| `VoiceFieldNote` | `conflict` \| `not_in_transcript` \| `out_of_range` \| `range` \| `multiple_values` \| `not_monthly` \| `invalid_format` | response (only when `needs_entry`) |
| `VoiceAiStatus` | `used` \| `skipped` \| `not_configured` \| `unavailable` \| `invalid_output` | response |
| `VoiceAiIssueKind` | `range` \| `multiple_values` \| `not_monthly` | AI output |

## 2. Request DTO — `voiceParseRequestSchema` (`src/lib/validation/voice.ts`)

| Field | Type | Rules |
|---|---|---|
| `transcript` | string | trimmed; control characters (except space) removed; 1–500 chars after trimming |
| `language` | `VoiceLanguage` | required |

`.strict()` — unknown keys → `400 VALIDATION_FAILED`. No `request_id`: parsing is independent of
any stored request (nothing is written).

## 3. AI output schema — `voiceParseAiOutputSchema` (`src/lib/ai/schemas/voice-parse.ts`)

```text
{
  monthly_units:          number | null   // finite, >= 0
  monthly_bill:           number | null   // finite, >= 0
  budget:                 number | null   // finite, >= 0
  preferred_capacity_kw:  number | null   // finite, >= 0
  issues: Array<{ field: VoiceFieldKey, kind: VoiceAiIssueKind }>   // max 8, default []
}
```

- `.strict()` at every level: extra keys (e.g. `submit`, `status`, `explanation`) → invalid.
- Strings, booleans, `NaN`, `Infinity`, negative numbers → invalid. The whole output is
  discarded on any violation (no partial acceptance, no repair).
- This is a *proposal*; whole-number/decimal checks and bounds are applied in the merge step.

## 4. Field limits — `checkFieldValue` (`src/lib/domain/voice/field-bounds.ts`)

Not a new rule set: `checkFieldValue(key, value)` validates each value with the matching field of
002's `usageFieldsSchema` (`src/lib/validation/requests.ts`, 002 FR-009), and classifies a failure
as `invalid_format` (not a whole number / too many decimals) or `out_of_range`. The table below is
002's FR-009, reproduced for test expectations only; 002's schema remains the source of truth.

| Field | Min | Max | Format |
|---|---|---|---|
| `monthly_units` | 1 | 10,000 | integer |
| `monthly_bill` | 0 | 1,00,000 | integer INR |
| `budget` | 10,000 | 50,00,000 | integer INR |
| `preferred_capacity_kw` | 0.5 | 20 | ≤ 1 decimal |

## 5. Internal domain types (`src/lib/domain/voice/`)

| Type | Shape | Notes |
|---|---|---|
| `NumberMention` | `{ value: number, start: number, end: number, raw: string }` | from `normalizeIndianNumbers` |
| `RuleParseResult` | `{ fields: Partial<Record<VoiceFieldKey, number>>, issues: Array<{ field, kind }>, mentions: NumberMention[] }` | from `ruleParseTranscript` |
| `AiProposal` | `voiceParseAiOutput` or `null` | null when AI skipped/failed |
| `MergedVoiceFields` | `Record<VoiceFieldKey, VoiceFieldResult>` | from `mergeVoiceParse` |

## 6. Response DTO — `voiceParseResponseSchema` (`src/lib/validation/voice.ts`)

Returned inside the success envelope `{ "data": … }` (overview §8).

| Field | Type | Notes |
|---|---|---|
| `fields` | `Record<VoiceFieldKey, VoiceFieldResult>` | always all four keys |
| `ai_status` | `VoiceAiStatus` | tells the UI whether AI contributed (FR-020) |
| `language` | `VoiceLanguage` | echoed |

`VoiceFieldResult`:

| Field | Type | Rule |
|---|---|---|
| `status` | `VoiceFieldStatus` | |
| `value` | number \| null | non-null **iff** `status = "heard"` |
| `source` | `VoiceFieldSource` \| null | non-null iff `heard` |
| `note` | `VoiceFieldNote` \| null | non-null iff `needs_entry` |

The response deliberately does **not** echo the transcript (it is already in the browser).

## 7. Client-side state (not persisted)

`VoicePanelState` (`src/components/household/voice/use-voice-capture.ts`):

```text
idle ──tap mic──> listening ──final text──> transcript_ready ──interpret──> interpreting
  ^                 │  │                          │ edit/type                 │
  │                 │  └─no speech──> empty        └──> transcript_ready        ├─ok──> review
  │                 └─error──> error(permission|no_mic|recognition)             ├─503/err──> error(ai_unavailable)
  │                                                                             └─0 heard──> empty(no_values)
  └──────── apply / discard / retry ───────────────────────────────────────────┘
unsupported (terminal for this browser: manual entry only)
language-not-supported ──> idle with language = en-IN and a notice
```

- `language`: `VoiceLanguage`, initial `hi-IN`, kept in wizard-session state (survives step
  navigation, not stored server-side). Persisting it in `sessionStorage` is allowed (wrapped in
  try/catch) but not required.
- `reviewValues`: editable copy of `heard` values; applied via 002's `UsageVoiceSlot.onSuggest`
  as a `Partial<UsageFields>`; empty values are omitted (FR-017).
- A monotonically increasing `attemptId` ensures late responses after navigation or a newer
  attempt are ignored (spec Edge Cases).

## 8. Validation rules summary (traceability)

| Rule | Where enforced | FR |
|---|---|---|
| Transcript 1–500 chars, language enum | `voiceParseRequestSchema` (server) + textarea `maxLength` | FR-008 |
| Only 4 fields, strict AI schema | `voiceParseAiOutputSchema` | FR-009, FR-014 |
| No derived/ungrounded values | `mergeVoiceParse` grounding | FR-011, FR-012 |
| Conflict/range/period → needs entry | `mergeVoiceParse`, `ruleParseTranscript` | FR-012 |
| Bounds and format | `checkFieldValue` (002 `usageFieldsSchema`) in `mergeVoiceParse` | FR-012 |
| Same validation as manual entry | 002's `usageFieldsSchema` in `checkFieldValue` + 002's form on suggest | FR-018 |
