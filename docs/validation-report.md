# SURYAMIT — Documentation Validation Report

> **Date**: 2026-11-01 · **Phase**: 8 (documentation validation) · **Scope**: constitution v1.0.0,
> project overview v1.1, 11 feature specs · **Result**: ✅ ready for `/speckit-analyze` and
> `/speckit-implement`. No application code exists yet.

## 1. Document inventory

| Document | Purpose | Relates to |
|---|---|---|
| `docs/project-plan.md` | User's original plan, the primary requirements input | Source for everything below |
| `docs/speckit_developmentSDLC.MD` | Spec Kit workflow guide (unchanged) | Defines the command sequence used |
| `.specify/memory/constitution.md` | Binding principles I–VIII, standards, quality gates (v1.0.0) | Every `plan.md` has a Constitution Check against it |
| `docs/project-overview.md` | Project-level spec and architecture; **canonical** roles, data model, status machines, API catalogue, decisions D-01–D-16 | Every feature spec references it instead of redefining contracts |
| `docs/team-board.html` | 4-member ownership, 5-hour swimlanes, dependency graph, handoffs | Mirrors overview §4 and §14 |
| `CLAUDE.md` | Persistent context and rules for Claude | Points to all of the above |
| `specs/NNN-*/spec.md` | What and why: user stories, FRs, success criteria, assumptions | Input to `plan.md`; FRs traced in `tasks.md` |
| `specs/NNN-*/checklists/requirements.md` | Spec quality gate from `/speckit-specify` | Gates `/speckit-implement` |
| `specs/NNN-*/plan.md` | How: technical context, Constitution Check, file structure | Input to `tasks.md` |
| `specs/NNN-*/research.md` | Decision / rationale / alternatives | Justifies `plan.md` |
| `specs/NNN-*/data-model.md` | Tables, constraints, RLS, functions, state transitions | Must match overview §7 |
| `specs/NNN-*/contracts/*.md` | Endpoint, UI-slot and AI contracts | Must match overview §8 |
| `specs/NNN-*/quickstart.md` | Manual acceptance walkthrough and test commands | Polish-phase validation |
| `specs/NNN-*/tasks.md` | Ordered `T###` tasks with file paths + Requirement Coverage table | Executed by `/speckit-implement` |

## 2. Structural checks (automated, all 11 features)

| Feature | US | FRs | Tasks | Contracts | Constitution rows | Issues |
|---|---:|---:|---:|---:|---:|---|
| 001-platform-foundation-auth | 4 | 31 | 69 | 4 | 8/8 | none |
| 002-household-solar-request | 4 | 27 | 64 | 3 | 8/8 | none |
| 003-solar-financial-engine | 3 | 30 | 49 | 2 | 8/8 | none |
| 004-vendor-request-discovery | 4 | 29 | 35 | 1 | 8/8 | none |
| 005-vendor-quote-submission | 3 | 27 | 39 | 1 | 8/8 | none |
| 006-quote-comparison-scoring | 4 | 29 | 48 | 3 | 8/8 | none |
| 007-quote-acceptance | 4 | 26 | 37 | 3 | 8/8 | none |
| 008-roof-photo-analysis | 5 | 34 | 54 | 5 | 8/8 | none |
| 009-quote-extraction-injection-defense | 4 | 26 | 38 | 4 | 8/8 | none |
| 010-voice-requirement-entry | 3 | 26 | 42 | 3 | 8/8 | none |
| 011-ai-solar-advisor | 3 | 24 | 40 | 3 | 8/8 | none |
| **Total** | **41** | **309** | **515** | **32** | — | — |

Checks performed:
- All 7 required files exist in every folder, and `contracts/` is non-empty.
- No `[NEEDS CLARIFICATION]` markers, template placeholders or `ACTION REQUIRED` blocks remain.
- Every task line matches `- [ ] T### [P?] [US#?] description`; IDs are sequential with no duplicates.
- **Every FR-### appears in its feature's `tasks.md`**, which has a Requirement Coverage table.
- Every `plan.md` Constitution Check covers Principles I–VIII with no FAIL or unjustified violation.
- Migration file names are unique per feature (`20261101000N00_*.sql`, N = 1…9) and sort in
  dependency order.

## 3. Cross-feature consistency

| Contract | Defined by | Used by | Status |
|---|---|---|---|
| Household extension slots (`RequestEstimateSlot`, `RoofAnalysisSlot`, `UsageVoiceSlot`, `RequestQuotesSlot`, `RequestAcceptanceSlot`, `AdvisorShortcutSlot`) | 002 `contracts/ui-extension-slots.md` | 003, 006, 007, 008, 010, 011 | ✅ (008 fixed, V-03) |
| `usageFieldsSchema` | 002 | 010 | ✅ |
| `QuoteForm` / `quoteFieldsSchema` | 005 | 009 (pre-fill) | ✅ |
| `scoreQuotes`, `comparison.rank` | 006 | 009 (injection test), 011 (recommendation) | ✅ |
| Shared AI client `generateStructured` + untrusted-content helpers + mock provider | 008 `contracts/ai-client.md` | 009, 010, 011 | ✅ |
| DB error codes `SM403/SM404/SM409` → API envelope | 005 data-model §4 | 007 | ✅ mapped and unit-tested |
| Non-owner → 404, wrong role → 403 | overview §8 (v1.1) | all features | ✅ |
| Demo dataset (Sharma request → quotes → assessment → injected note) | overview D-14 | 002, 005, 008, 009 | ✅ (fixed, V-02) |

### Fixes applied during validation

| ID | Problem | Fix |
|---|---|---|
| V-01 | 008 said vendors cannot see roof assessments; 004 shows vendors the latest summary (overview D-01) | 008 spec (FR-008, assumptions, out of scope), data-model and research aligned: vendors read a summary only through 004's `vendor_get_latest_roof_assessment`, never the table |
| V-02 | No spec seeded the published Sharma Residence request that 004, 005, 008 and 009 seed data depend on | 002 tasks T063 (seed request) and T064 (`scripts/seed-demo-storage.ts` uploads the demo roof photo); 002 plan updated |
| V-03 | 008's panel used its own `variant: 'wizard' \| 'page'` and an `onConsentHelp` callback that 002's `RoofAnalysisSlot` does not provide | 008 contract and tasks T033–T035, T037–T038 now implement the slot's exact props, edit only the slot body, and add an e2e placement check |
| V-04 | Agents added endpoints, columns, functions and env vars beyond overview v1.0 | Overview bumped to v1.1: 7 endpoints, `roof_assessments` columns, quote-document path, DB function table, ownership and AI error conventions, env vars, `sharp`, decisions D-11–D-16 |
| V-05 | 008 left photo metadata unstripped; the upload limit exceeded Vercel's ~4.5 MB request body | 002 downscales in the browser and strips metadata server-side; 008 assumptions updated |

## 4. Traceability: project plan → specs

| Plan item | Covered by |
|---|---|
| §3 Goal 1: request → quote → compare → accept | 002, 004, 005, 006, 007 (e2e test: 007 T034) |
| §3 Goal 2: map pin and terrace photo | 002 |
| §3 Goal 3: usage and budget | 002 (manual), 010 (voice) |
| §3 Goal 4: vendor map and quotes | 004, 005 |
| §3 Goal 5: roof obstruction analysis | 008 |
| §3 Goal 6: economics and subsidy in code | 003 (+ per-quote net cost in 006) |
| §3 Goal 7: extract, compare, flag, explain | 009, 006, 011 |
| §3 Goal 8: voice in Hindi/Gujarati | 010 |
| §3 Goal 9: architecture and scale story | overview §5, §11 |
| §7 Screens 1–7 | 001 (landing), 002 (dashboard, wizard), 006 (comparison), 004/005 (vendor), 011 (advisor), 003 (rules and sources) |
| §13 Nine prompt-injection defenses | 009 research R-01 |
| §17 Security list | constitution IV + RLS/authorization tasks in 10 of 11 features |
| §18 Financial tests (1, 2, 2.5, 3, 5 kW; negative; zero savings) | 003 unit-test tasks |
| §18 Duplicate acceptance | 007 race and second-attempt tests |
| §18 Injection cannot change ranking | 009 invariance test (+ 011 recommendation test) |
| §18 AI failure leaves flows usable | 008, 009, 010, 011 fallback tests |
| §23 Definition of Done (16 items) | All map to the features above; "demo rehearsed" is a team activity |

## 5. Open decisions for the user

Each one has a working default already written into the specs. None blocks implementation.

| # | Question | Current default | Where |
|---|---|---|---|
| Q1 | Verify CFA slabs and placeholders (1,400 kWh/kW/yr, ₹60,000/kW, ₹7/kWh, 70% self-use, ₹3/kWh export) against official sources | Marked "illustrative — verify before demo" in UI and config | 003, overview D-12 |
| Q2 | With the seeded quotes, premium SolarTech ranks first (94.8 vs SunRise 94.3, GreenVolt 83.1). Is that the demo story you want? | Keep | 005 seed, 006 |
| Q3 | Withdrawing the last quote: should the request return from `quoted` to `open`? | Stays `quoted` | 005 |
| Q4 | Demo account password stored in `supabase/seed.sql` | Allowed (fictional demo accounts only) | 001 |
| Q5 | Input ranges: India only; 1–10,000 units; budget ₹10k–₹50L; capacity 0.5–20 kW | Keep | 002 |
| Q6 | Should vendors see their own score? | Households only | 006 |
| Q7 | If a quote has no stored review yet, should the advisor trigger scoring? | Names no leading quote | 011 |
| Q8 | Gemini model, PDF support and free-tier quota | Set via `GEMINI_MODEL`; confirm on demo day | 008, 009 |
| Q9 | Should households also upload offline quotes for extraction? | Vendor-side only (D-05) | 009 |
| Q10 | Seed more open requests so the vendor map shows several markers? | One seeded request (004's test fixtures have more) | 002, 004 |

## 6. Residual risks

- **Scope versus time**: 515 tasks will not all fit in 5 hours. Build the P0 path first
  (001 → 007); P1 AI features are designed to be droppable without breaking it (constitution I).
- **Untested assumptions**: Supabase CLI and Docker for local `supabase db reset`, and Gemini
  free-tier limits, are unverified on this machine.
- **Parallel authorship**: specs were written by parallel agents against the shared overview.
  Run `/speckit-analyze` per feature before implementing it.

## 7. Recommended implementation sequence

1. **001** Foundation and auth: everyone else is blocked until the scaffold lands (target 30 min).
2. **002** Household request ∥ **003** Financial engine.
3. **004** Discovery → **005** Quotes → **006** Comparison → **007** Acceptance. **P0 demo complete.**
4. **008** Roof analysis (also ships the shared AI client).
5. **009** Extraction and injection defense ∥ **010** Voice ∥ **011** Advisor.

Per feature: set `.specify/feature.json` → `/speckit-analyze` → `/speckit-implement` →
`quickstart.md` checks → `/speckit-converge`. Team ownership: `docs/team-board.html`.
