# Implementation Plan: Voice Requirement Entry

**Branch**: `010-voice-requirement-entry` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-voice-requirement-entry/spec.md`

## Summary

Add a voice panel to 002's "electricity and budget" wizard step. The browser's speech
recognition (Hindi `hi-IN`, Gujarati `gu-IN`, English `en-IN`) produces a transcript on the
client; only that text goes to `POST /api/voice/parse`. The route runs a **deterministic Indian
number normalizer and rule parser** first, then (when needed and available) asks the AI, via
008's shared client, for a strict four-field JSON proposal, and finally **merges with grounding**:
an AI value is kept only if it equals a number actually present in the transcript; conflicts,
ranges, non-monthly periods and implausible values are left empty for the user to type. The
panel shows a review card; "Use these values" only copies values into 002's form state —
nothing is saved until the household uses the wizard's normal save. Every failure (unsupported
browser/language, mic denied, silence, AI down/malformed) degrades to rule-only results or
manual entry. No audio, no transcript storage, no migration.

## Technical Context

**Language/Version**: TypeScript (strict mode)

**Primary Dependencies**: Next.js + React (App Router, Route Handlers), Tailwind CSS, shadcn/ui,
Lucide, Zod; browser Web Speech API (built-in); shared AI client from 008 —
`generateStructured`, `untrustedText`, `instructionText`, `aiFailureToApiError` per
[008 ai-client.md](../008-roof-photo-analysis/contracts/ai-client.md) (Gemini, Groq text
fallback; provider/model selection, retries and logging are 008's). **No new runtime
dependencies.** Speech recognition types are declared locally in the wrapper module instead of
adding a types package.

**Storage**: None. Reads/writes no tables or buckets. Applied values persist only through 002's
existing `PATCH /api/requests/:id`.

**Testing**: Vitest (unit + integration using 008's `tests/helpers/mock-ai-provider.ts` via
`setAiClientForTests`, and 001's session test setup);
Playwright not required for this feature (speech cannot be driven reliably in CI); manual checks
in quickstart.md.

**Target Platform**: Vercel (Node runtime Route Handler); mobile-first web UI. Voice works where
the browser exposes speech recognition (Chromium-based desktop/Android); elsewhere manual entry.

**Project Type**: Web application (single Next.js app, overview §5)

**Performance Goals**: Review card or fallback within 10 s of end of speech (SC-006); rule-only
path responds in well under 1 s.

**Constraints**: Transcript ≤ 500 chars; listening ≤ 30 s; AI 8 s per attempt and 10 s overall
(abort signal); no audio leaves the
browser to SolarX; transcript never stored or logged; works with AI disabled.

**Scale/Scope**: Hackathon demo (1 household, a few dozen parses); 1 endpoint, ~6 domain/AI
modules, ~5 UI files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|---|---|---|
| I | Complete Workflow First | PASS | P1 add-on mounted through 002's `UsageVoiceSlot` (wrapped in 002's `SlotBoundary`); manual fields are always visible; no P0 path calls this feature; feature is built after the P0 flow (overview §14) |
| II | Deterministic Core, Advisory AI | PASS | AI only parses a transcript into fields (an allowed use). Number normalization, grounding, conflict detection and bounds are pure code in `src/lib/domain/voice/`. AI cannot introduce a value not spoken (grounding); unknowns stay `null`. No estimate or score is computed here |
| III | Untrusted Input & Injection Resistance | PASS | Transcript framed with 008's `untrustedText("voice transcript", …)` (nonce-tagged, delimiter-neutralised), system instructions separate, strict `.strict()` Zod output schema validated on return, malformed output discarded; request body validated with `voiceParseRequestSchema`; output space is four numbers and the route performs no writes, so injected text cannot trigger actions |
| IV | Security & Privacy by Default | PASS | Server-side auth + household role check via 001's guard; no DB access so RLS unaffected; AI key stays in 008's server-only client; no audio to SolarX; transcript not stored or logged; no personal data sent to the AI; browser speech-service disclosure shown |
| V | Transparent, Sourced Estimates | PASS (N/A) | Feature produces no estimates; field limits mirror 002 FR-009; values are user-confirmed inputs |
| VI | Targeted Mandatory Testing | PASS | Unit: number normalization cases, rule parser, merge/grounding matrix, AI schema (malformed output). Integration: route with mocked AI (success, malformed, failure → rules or 503), authorization (401/403), injection transcript, no-logging |
| VII | Graceful Degradation | PASS | AI failure/timeout/malformed → rule-only result or `AI_UNAVAILABLE` with retry + manual entry; unsupported browser/language, mic denied and silence handled; panel has idle/listening/interpreting/review/empty/error states; shared error envelope without internals |
| VIII | Hackathon-Scale Simplicity | PASS | No new dependency, no table, no service; one route, small pure modules |

**Post-design re-check (after Phase 1)**: PASS on all eight. The design adds no table or column
beyond overview §7 (none at all), uses only the catalogued endpoint `POST /api/voice/parse`
(overview §8), uses the catalogued error codes, and adds no dependency. The only new folders
(`src/lib/domain/voice/`, `src/lib/voice/`, `src/components/household/voice/`) are consistent
with overview §6's layering (pure domain / client lib / feature components).

## Project Structure

### Documentation (this feature)

```text
specs/010-voice-requirement-entry/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── voice-parse-api.md
│   ├── voice-parse-ai-output.md
│   └── wizard-voice-extension.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

Only the paths this feature creates (C) or modifies (M).

```text
src/
├── app/
│   └── api/voice/parse/route.ts                     # C  POST /api/voice/parse
├── components/household/extension-slots.tsx         # M  body of 002's UsageVoiceSlot only →
│                                                    #    <VoiceEntryPanel onSuggest disabled />
├── components/household/voice/
│   ├── voice-entry-panel.tsx                        # C  panel + state rendering, a11y live region
│   ├── voice-language-picker.tsx                    # C  hi-IN / gu-IN / en-IN picker
│   ├── voice-review-card.tsx                        # C  editable review, Use / Discard
│   ├── voice-panel-reducer.ts                       # C  pure panel state machine (data-model §7)
│   └── use-voice-capture.ts                         # C  hook wiring speech wrapper + reducer + API
├── lib/
│   ├── ai/                                          # (client owned by 008; not modified)
│   │   ├── voice-parse.ts                           # C  task service parseVoiceWithAi(): only
│   │   │                                            #    caller of generateStructured("voice_parse")
│   │   ├── prompts/voice-parse.v1.ts                # C  VOICE_PARSE_PROMPT_VERSION + _SYSTEM_INSTRUCTION
│   │   └── schemas/voice-parse.ts                   # C  voiceParseAiOutputSchema (strict) + type
│   ├── domain/voice/
│   │   ├── indian-number-lexicon.ts                 # C  number words (Latin/Devanagari/Gujarati)
│   │   ├── normalize-indian-numbers.ts              # C  transcript → NumberMention[]
│   │   ├── rule-parse-transcript.ts                 # C  keyword binding → RuleParseResult
│   │   ├── field-bounds.ts                          # C  checkFieldValue() over 002 usageFieldsSchema
│   │   └── merge-voice-parse.ts                     # C  grounded merge → MergedVoiceFields
│   ├── validation/voice.ts                          # C  request/response Zod schemas + enums
│   └── voice/
│       ├── speech-recognition.ts                    # C  client-only browser wrapper: detect, start/stop, error map
│       └── parse-voice-transcript.ts                # C  server-only orchestrator (rules → AI → merge)

tests/
├── fixtures/voice/reference-transcripts.ts          # C  ≥ 20 phrases + expected fields (SC-002)
├── unit/voice/
│   ├── normalize-indian-numbers.test.ts             # C
│   ├── rule-parse-transcript.test.ts                # C
│   ├── merge-voice-parse.test.ts                    # C
│   ├── reference-transcripts.test.ts                # C  rules-only + mocked-AI accuracy (SC-002/003)
│   ├── voice-panel-reducer.test.ts                  # C  state machine, stale-response guard
│   └── speech-recognition.test.ts                   # C  error mapping with fake recognizer
├── unit/ai/voice-parse-schema.test.ts               # C  malformed AI output
└── integration/voice/
    ├── parse-route.test.ts                          # C  route success, auth, injection, logging
    └── parse-route-fallback.test.ts                 # C  AI failure / malformed → rules or 503
```

No migration (`supabase/migrations/`) and no seed changes.

**Structure Decision**: Single Next.js app per overview §5/§6. Deterministic parsing lives in
`src/lib/domain/voice/` (pure, no I/O, per constitution layering). Browser-only speech code and
the server orchestrator live in `src/lib/voice/` (they perform I/O and so are not "domain").
Task service, prompt and AI schema follow 008's convention (`src/lib/ai/{task}.ts`,
`src/lib/ai/prompts/`, `src/lib/ai/schemas/`); 008's client files are not modified. UI lives under
`src/components/household/voice/` and plugs into 002 via its extension point
([contracts/wizard-voice-extension.md](contracts/wizard-voice-extension.md)).

## Integration Notes

- **001**: `src/lib/api/respond.ts`, `src/lib/api/errors.ts`, `src/lib/api/auth-guard.ts` for
  envelope, error codes and household-role check; Vitest setup.
- **002**: `UsageVoiceSlot` (`onSuggest`, `disabled`) in `src/components/household/extension-slots.tsx`;
  `usageFieldsSchema` / `UsageFields` from `src/lib/validation/requests.ts` (field limits);
  `formatInr` / `formatUnits` / `formatKw` from `src/lib/format.ts`; 002's Continue persists.
- **008**: `generateStructured` with `task: "voice_parse"` (already in 008's `AiTask` union),
  framing helpers, `aiFailureToApiError`, and the mock provider test helper (research R7). If
  008's contract changes, adapt only `src/lib/ai/voice-parse.ts`.

## Complexity Tracking

No constitution violations; nothing to justify.
