# Implementation Plan: Roof Photo Analysis (Consent-Gated AI Observations)

**Branch**: `008-roof-photo-analysis` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-roof-photo-analysis/spec.md`

## Summary

A household that owns a request with a roof photo and `ai_consent = true` calls
`POST /api/roof/analyze`. The Route Handler validates the body (Zod), authenticates, checks role
and ownership, re-checks consent, request status and the photo, downloads the private photo
server-side with the user's session, and sends only the image plus a fixed, versioned prompt to
a vision-capable model through the **shared AI client** in `src/lib/ai/`. The client applies
timeouts, bounded retry with back-off, untrusted-content framing and Zod validation, and returns
a discriminated `AiResult` instead of throwing. Valid output is normalised by code (standard
limitations merged, `site_survey_required` forced to `true`, unknown keys dropped) and stored as
a `completed` row in `roof_assessments`; anything else is stored as `failed` with a
`failure_reason` and the API returns `503 AI_UNAVAILABLE`. A household-only
`GET /api/requests/:id/roof-assessment` returns the newest completed and newest attempt so the
`RoofAnalysisPanel` can render all UX states. The panel mounts in feature 002's wizard and
request-page extension points.

This feature also delivers the shared AI client contract (`contracts/ai-client.md`) reused by
009, 010 and 011: `generateStructured()`, `untrustedText()`, `untrustedFile()`, `trustedJson()`,
`aiFailureToApiError()`, the `AiProvider` adapter interface (Gemini primary, Groq optional text
fallback) and a scripted mock provider for tests.

## Technical Context

**Language/Version**: TypeScript (strict mode), Node.js runtime for Route Handlers (not Edge, so
the provider SDK and binary image handling work)

**Primary Dependencies**: Next.js + React (App Router, Route Handlers), Supabase JS client (via
001's `src/lib/supabase/server.ts`), Zod, Tailwind + shadcn/ui + Lucide. **New runtime
dependencies (named per constitution VIII)**: `@google/genai` (official Google Gen AI SDK, Gemini
adapter); `server-only` (build-time guard that keeps `src/lib/ai/` out of client bundles);
`groq-sdk` (official Groq SDK) — **optional**, installed only if the Groq text fallback task is
done.

**Storage**: Supabase PostgreSQL — new table `roof_assessments` (migration
`supabase/migrations/20261101000800_roof_assessments.sql`); Supabase Storage private bucket
`roof-photos` (read-only use; created by 002)

**Testing**: Vitest (unit + integration with a scripted mock `AiProvider`; no live AI calls);
optional live smoke test gated by `AI_LIVE_TESTS=1`. Playwright not required for this feature
(UI component tests are optional per constitution VI); manual UI checks are in `quickstart.md`.

**Target Platform**: Vercel (Node.js serverless functions) + Supabase; mobile-first browsers

**Project Type**: Single Next.js web application (UI + Route Handlers)

**Performance Goals**: Result or "analysis unavailable — retry" within 30 s (SC-002); per-attempt
timeout 20 s default; one retry at most for transient errors when budget remains

**Constraints**: AI keys server-only; photo never public; only the image + fixed prompt leave the
server; output Zod-validated; failures non-fatal; logs contain no content or personal data;
model name from env, confirmed on demo day

**Scale/Scope**: Hackathon demo (1 demo household, a handful of analyses); 1 table, 2 endpoints,
1 panel, shared AI client (~10 small modules)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | How this plan complies |
|---|---|---|---|
| I | Complete Workflow First | PASS | Feature is P1 and starts after P0 (overview §14). The panel is an optional slot; 002's wizard and publish never wait on or require an assessment. AI failure returns 503 and the wizard continues (FR-022). |
| II | Deterministic Core, Advisory AI | PASS | AI only describes visible observations. Output has no numeric fields; measurements, capacity and subsidy statements are dropped (FR-012). `site_survey_required` and standard limitations are set by code. No assessment value feeds estimates, scores or ranking (FR-017). |
| III | Untrusted Input & Prompt Injection | PASS | Photo wrapped by `untrustedFile()`; fixed system instruction in `src/lib/ai/prompts/roof-analysis.v1.ts`; JSON output requested against a declared schema; Zod validation in `src/lib/ai/schemas/roof-analysis.ts`; malformed → `failed`, never shown. Request body validated with Zod. |
| IV | Security & Privacy by Default | PASS | Owner-only Route Handler check + RLS on `roof_assessments` (select/insert owner; insert also requires `ai_consent = true`). Consent re-checked server-side before any AI call. Photo downloaded with the user's session from the private bucket; no signed URL is created for the provider. Keys in server env only; `server-only` import guard. No name/address/coordinates sent. Logs contain outcome metadata only. |
| V | Transparent, Sourced Estimates | PASS | Not an estimate feature. Panel labels output "AI observations — not measurements", shows confidence as words with "not a guarantee", and keeps it visually distinct from estimates (FR-015, FR-016). |
| VI | Targeted Mandatory Testing | PASS | Required tests before implementation: malformed AI JSON rejection, unknowns stay unknown, provider failure non-fatal, consent enforcement, authorization (route + RLS), AI client retry/timeout/fallback. Mock provider; no live calls in CI. |
| VII | Graceful Degradation | PASS | Every `AiFailure` kind → `503 AI_UNAVAILABLE` with "Analysis unavailable — retry"; panel implements empty, consent-missing, ready, loading, success, error states; errors use 001's envelope with no provider output. |
| VIII | Hackathon-Scale Simplicity | PASS | Synchronous call inside the Route Handler; no queue, cache or worker. Three new dependencies named above, one optional. Small single-purpose modules. |

**Post-design re-check (after Phase 1)**: PASS on all eight. The design adds two items beyond the
overview — `GET /api/requests/:id/roof-assessment` and the `roof_assessments` columns
`failure_reason` and `roof_photo_path` — both labelled "Extension to overview §7/§8" and needed
by FR-018/FR-020/FR-021. They do not redefine any existing entity, enum or path, so no Complexity
Tracking entry is required; the overview should be updated to list them (see research.md R-12).

## Project Structure

### Documentation (this feature)

```text
specs/008-roof-photo-analysis/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── ai-client.md                 # shared AI client interface (used by 009/010/011)
│   ├── roof-analyze-api.md          # POST /api/roof/analyze
│   ├── roof-assessment-get-api.md   # GET /api/requests/:id/roof-assessment (extension)
│   ├── roof-analysis-output.md      # AI output schema + normalisation rules
│   └── roof-analysis-panel.md       # UI extension-point contract with 002
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

Only paths this feature creates (C) or modifies (M). Everything else is owned by 001/002.

```text
src/
├── app/
│   ├── api/
│   │   ├── roof/analyze/route.ts                         # C  POST /api/roof/analyze
│   │   └── requests/[id]/roof-assessment/route.ts        # C  GET latest assessment (extension)
│   └── household/requests/
│       ├── new/page.tsx                                  # M  mount panel in 002 wizard slot
│       └── [id]/page.tsx                                 # M  mount panel in 002 request-page slot
├── components/household/
│   ├── roof-analysis-panel.tsx                           # C  client component, all UX states
│   ├── roof-assessment-view.tsx                          # C  observations/obstructions/limitations
│   └── ai-confidence-label.tsx                           # C  low/medium/high → words + qualifier
├── lib/
│   ├── ai/                                               # C  shared AI client (owned by 008)
│   │   ├── index.ts                                      #    public exports
│   │   ├── config.ts                                     #    env: keys, models, timeouts, retries
│   │   ├── types.ts                                      #    AiTask, AiInputPart, AiResult, AiFailure…
│   │   ├── client.ts                                     #    generateStructured(), retry/back-off, fallback
│   │   ├── untrusted.ts                                  #    untrustedText/untrustedFile/trustedJson framing
│   │   ├── json.ts                                       #    safe JSON extraction from model text
│   │   ├── errors.ts                                     #    aiFailureToApiError() → AI_UNAVAILABLE
│   │   ├── log.ts                                        #    metadata-only AI call logging
│   │   ├── roof-analysis.ts                              #    analyzeRoofPhoto() task service
│   │   ├── providers/gemini.ts                           #    AiProvider adapter (vision + text + pdf)
│   │   ├── providers/groq.ts                             #    AiProvider adapter (text only, optional)
│   │   ├── prompts/preamble.ts                           #    shared untrusted-data system preamble
│   │   ├── prompts/roof-analysis.v1.ts                   #    roof prompt + ROOF_ANALYSIS_PROMPT_VERSION
│   │   └── schemas/roof-analysis.ts                      #    Zod output schema + normaliser + limits
│   ├── validation/roof.ts                                # C  request body + DTO Zod schemas
│   ├── validation/file-signature.ts                      # C  detectFileType() magic bytes (reused by 009)
│   └── supabase/queries/roof-assessments.ts              # C  insert/select helpers (user-scoped client)

.env.example                                              # M  add GEMINI_MODEL, GROQ_MODEL, AI_TIMEOUT_MS, AI_MAX_RETRIES
package.json                                              # M  add @google/genai, server-only (+ optional groq-sdk)

supabase/
├── migrations/20261101000800_roof_assessments.sql        # C  table, check constraints, index, RLS
└── seed.sql                                              # M  one "Demo" completed assessment

tests/
├── helpers/mock-ai-provider.ts                           # C  scripted AiProvider for all AI features
├── fixtures/roof/
│   ├── clear-roof.jpg                                    # C  demo image (fictional)
│   ├── obstructed-roof.jpg                               # C  demo image (water tank, staircase room)
│   └── ai-outputs.ts                                     # C  valid / malformed / over-reaching outputs
├── unit/ai/
│   ├── client.test.ts                                    # C  retry, timeout, fallback, never throws
│   ├── untrusted.test.ts                                 # C  framing + delimiter neutralisation
│   ├── json.test.ts                                      # C  code fences, non-JSON
│   └── roof-analysis-schema.test.ts                      # C  malformed rejection, unknowns dropped
└── integration/roof/
    ├── analyze-route.test.ts                             # C  consent, authz, failure, success
    ├── roof-assessment-get-route.test.ts                 # C  latest selection, authz
    ├── roof-assessments-rls.test.ts                      # C  RLS select/insert policies
    └── live-smoke.test.ts                                # C  optional, skipped unless AI_LIVE_TESTS=1
```

**Structure Decision**: Single Next.js application per overview §6. The shared AI client lives in
`src/lib/ai/` with `prompts/` and `schemas/` subfolders as the overview prescribes; task-level
services (`roof-analysis.ts` here, `quote-extraction.ts` in 009) sit beside the client. Database
access uses the user-scoped Supabase server client from 001 so RLS applies to every query.

## Complexity Tracking

No constitution violations. Not required.
