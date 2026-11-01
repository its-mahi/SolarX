# Learn the SDLC by Building a Running Dashboard (GitHub Spec Kit + Claude Code)

**Goal of this guide:** follow it top to bottom, paste each prompt in order, and at the end you have a working **Running Dashboard** web page. You learn the software development life cycle (SDLC) side by side, because every step produces a markdown file that is one SDLC artifact.

**Core idea (Spec-Driven Development):** write down *what* you want (principles, spec, plan, tasks) as markdown files first. Then Claude builds the app from those files. Code comes last.

| SDLC phase | Spec Kit command | File it produces |
|---|---|---|
| 0. Setup | `specify init` | `.claude/`, `.specify/` |
| 1. Principles / governance | `/speckit-constitution` | `.specify/memory/constitution.md` |
| 2. Requirements analysis | `/speckit-specify` | `specs/001-running-dashboard/spec.md` |
| 2b. Requirement review | `/speckit-clarify` (optional) | `spec.md` updated |
| 3. Design | `/speckit-plan` | `plan.md`, `research.md`, `data-model.md`, `quickstart.md` |
| 4. Work breakdown | `/speckit-tasks` | `tasks.md` |
| 4b. Verification | `/speckit-analyze` (optional) | consistency report |
| 5. Implementation | `/speckit-implement` | `index.html`, `style.css`, `script.js`, `assets/` |
| 6. Testing / review | manual check + `/speckit-converge` | missing work added to `tasks.md` |

> The example file contents below show what Claude will typically generate. Claude's wording will differ a little each run; the structure is what matters. You can also paste an example in yourself to skip generation.

---

## PHASE 0 – Setup (one time)

### 0.1 Install the CLI

```
uv tool install specify-cli --force --from git+https://github.com/github/spec-kit.git
```

### 0.2 Create the project

```
specify init running-dashboard --integration claude --non-interactive
```

Windows tip: if you see `UnicodeEncodeError ... charmap`, run `set PYTHONUTF8=1` (cmd) or `$env:PYTHONUTF8=1` (PowerShell) first, or use Windows Terminal.

### 0.3 Go inside and start Claude Code

```
cd running-dashboard
git init
claude
```

Always start Claude **inside** `running-dashboard`, otherwise the `/speckit-*` commands are not available. `git init` lets Spec Kit create a feature branch per spec.

Also create a root `.gitignore` containing `.claude/` so local agent files are not committed.

### 0.4 What `specify init` created (this is the "template" layer)

```
running-dashboard/
├── .claude/skills/speckit-*/SKILL.md   <- the slash commands
└── .specify/
    ├── memory/constitution.md          <- project rules (blank template now)
    ├── templates/                      <- blank forms for spec, plan, tasks, checklist
    ├── scripts/powershell/             <- helper scripts the commands run
    ├── workflows/                      <- the specify->plan->tasks->implement flow
    ├── integrations/*.manifest.json    <- install bookkeeping
    └── init-options.json, integration.json
```

| File / folder | Use | Do you edit it? |
|---|---|---|
| `.claude/skills/speckit-*/SKILL.md` | Instructions Claude follows when you type a `/speckit-*` command | No |
| `memory/constitution.md` | The project's rule book | Filled by `/speckit-constitution` |
| `templates/spec-template.md` | Blank form: User Scenarios, Requirements, Success Criteria, Assumptions | No |
| `templates/plan-template.md` | Blank form: Summary, Technical Context, Constitution Check, Project Structure | No |
| `templates/tasks-template.md` | Blank form: phases, `[ID] [P?] [Story]` task lines | No |
| `templates/checklist-template.md` | Blank form for quality checklists | No |
| `scripts/powershell/*.ps1` | Create feature folder/branch, find templates, check prerequisites | No |
| `workflows/` | Defines the full SDD cycle | No |
| `init-options.json`, `integration.json`, manifests | Records your init choices and installed files | No |

**What the templates are:** blank forms with placeholders like `[FEATURE NAME]`. Each command copies its template into `specs/001-running-dashboard/` and fills it in with your project's details. That is why you never edit templates by hand.

---

## PHASE 1 – Constitution (governance / principles)

**SDLC meaning:** before any requirements, agree on the rules every later decision must follow (tech limits, quality bar, design style).

### Prompt to paste

```
/speckit-constitution Create the constitution for "Running Dashboard", a small static web app.
Principles:
1. Simplicity first: plain HTML, CSS and vanilla JavaScript only. No frameworks, no build step, no npm dependencies.
2. Minimalist design: white background, dark navy headings and key metrics, light blue-gray secondary text, generous whitespace, minimal borders and shadows, no card-heavy layouts.
3. Self-contained: no external image URLs or CDN assets; use local assets only so nothing breaks offline.
4. Accessible and responsive: semantic HTML, keyboard-usable tabs with proper ARIA roles, readable contrast, layout works from 360px phone width up to desktop.
5. Branding: the app is always called "Running Dashboard". Never use "Strava Dashboard" anywhere in the UI, title or branding.
6. Readable code: small files, clear names, comments only where intent is not obvious.
Governance: any change that breaks a principle must be justified in the plan's Complexity Tracking section.
```

### File produced: `.specify/memory/constitution.md` (example)

```markdown
# Running Dashboard Constitution

## Core Principles

### I. Simplicity First
Use plain HTML, CSS and vanilla JavaScript only. No frameworks, no build step, no npm dependencies.

### II. Minimalist Design
White background, dark navy headings and key metrics, light blue-gray secondary text,
generous whitespace, minimal borders and shadows. Avoid card-heavy dashboards.

### III. Self-Contained
No external image URLs or CDN assets. All assets are local so the page works offline.

### IV. Accessible and Responsive
Semantic HTML, keyboard-operable tabs with ARIA roles, readable contrast,
layout works from 360px to desktop widths.

### V. Consistent Branding
The product is always "Running Dashboard". "Strava Dashboard" must never appear.

### VI. Readable Code
Small files, clear names, comments only where intent is not obvious.

## Governance
Violations of a principle must be justified in the plan's Complexity Tracking section.

**Version**: 1.0.0 | **Ratified**: 2026-10-28 | **Last Amended**: 2026-10-28
```

**Check:** open the file; no `[PLACEHOLDER]` text should remain. Learning point: the constitution is the *quality gate* later checked by `/speckit-plan`.

---

## PHASE 2 – Specification (requirements: WHAT and WHY, not HOW)

**SDLC meaning:** requirements analysis. Describe users, behaviours and success measures. **Do not mention technology here.**

### Prompt to paste

```
/speckit-specify Build a "Running Dashboard" page that shows a runner's profile, lifetime running statistics and recent activities.

Header: a slim bar across the top. Left: the app title "Running Dashboard". Right: "Welcome, Arun Gupta" and an understated "Logout" text link, aligned on the same line.

Profile (upper center, below the header): a small circular runner photo (a local placeholder is fine, never a broken external image), the name "Arun Gupta" and the location "San Jose, United States", with the text beside the photo.

Statistics: three evenly spaced, centered columns below the profile. Each has a small muted label above a large bold navy value:
- Runs: 1,825
- Total Distance: 20,061.8 km
- Total Time: 3,792h 17m

Recent Activities: a section titled "Recent Activities" below the statistics, with two understated tabs, "Run" and "Weight Training". Clicking a tab shows only that kind of activity; Run is selected by default. Run items show an orange running icon, name, date, distance, duration and pace. Weight Training items show a different (non-orange) icon, name, date, duration and number of sets.

Sample data to show:
Run: Morning Run, Oct 26, 10.2 km, 52:14, 5:07 /km; Easy Recovery Run, Oct 24, 5.0 km, 28:40, 5:44 /km; Long Run, Oct 22, 21.1 km, 1:53:05, 5:22 /km; Tempo Run, Oct 20, 8.0 km, 38:12, 4:46 /km; Evening Jog, Oct 18, 6.4 km, 35:30, 5:33 /km.
Weight Training: Upper Body Strength, Oct 25, 55m, 14 sets; Leg Day, Oct 23, 1h 05m, 18 sets; Core & Mobility, Oct 21, 30m, 10 sets; Full Body Circuit, Oct 19, 45m, 16 sets.

Look and feel: clean white, spacious, centered content, minimal borders/shadows, simple rather than card-heavy.
```

### What the command does
1. Runs `create-new-feature.ps1` to make the folder `specs/001-running-dashboard/` (and a git branch `001-running-dashboard` if git exists).
2. Copies `spec-template.md` into it as `spec.md`.
3. Fills the template from your prompt.

### File produced: `specs/001-running-dashboard/spec.md` (example, shortened)

```markdown
# Feature Specification: Running Dashboard

**Feature Branch**: `001-running-dashboard`
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See my profile and lifetime stats (Priority: P1)
A runner opens the page and immediately sees who they are and their totals.

**Why this priority**: This is the core value and works as a standalone MVP.
**Independent Test**: Open the page; header, profile and three stats are visible.

**Acceptance Scenarios**:
1. **Given** the page loads, **When** I look at the header, **Then** I see "Running Dashboard" on the left and "Welcome, Arun Gupta" plus "Logout" on the right.
2. **Given** the page loads, **When** I look below the header, **Then** I see a small circular photo, "Arun Gupta" and "San Jose, United States".
3. **Given** the page loads, **When** I look at the stats, **Then** I see Runs 1,825, Total Distance 20,061.8 km, Total Time 3,792h 17m evenly spaced.

### User Story 2 - Browse recent activities by type (Priority: P2)
**Independent Test**: Switch between tabs and confirm the list changes.

**Acceptance Scenarios**:
1. **Given** the page loads, **When** I view Recent Activities, **Then** the Run tab is selected and 5 runs are listed with an orange running icon.
2. **Given** I am on Run, **When** I click "Weight Training", **Then** only the 4 weight sessions are shown and the tab shows as selected.
3. **Given** a tab is focused, **When** I use the keyboard, **Then** I can switch tabs without a mouse.

### Edge Cases
- Photo file missing: show a neutral placeholder, never a broken-image icon.
- Narrow phone screen: stats and activity rows stay readable without horizontal scroll.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: Header MUST show the title "Running Dashboard" left and welcome text + Logout link right.
- **FR-002**: Page MUST NOT contain the words "Strava Dashboard".
- **FR-003**: Profile MUST show a small circular local photo, name and location.
- **FR-004**: Page MUST show three stats (Runs, Total Distance, Total Time) with muted label above bold value.
- **FR-005**: "Recent Activities" MUST offer two tabs, Run and Weight Training, Run selected by default.
- **FR-006**: Switching tabs MUST show only that type of activity without reloading.
- **FR-007**: Run items MUST show an orange running icon, name, date, distance, duration, pace.
- **FR-008**: Weight Training items MUST show a non-orange icon, name, date, duration, sets.

### Key Entities
- **Runner**: name, location, photo.
- **Lifetime Stats**: runs, total distance, total time.
- **Activity**: type (run or weight), name, date, duration, plus distance/pace or sets.

## Success Criteria *(mandatory)*
- **SC-001**: All header, profile and stats content is visible without scrolling on a 1280x720 screen.
- **SC-002**: Switching tabs updates the list in under 100 ms.
- **SC-003**: Layout has no horizontal scrolling at 360px width.

## Assumptions
- Data is static sample data; no real login, logout or backend.
- "Logout" is a visual link only.
```

**Check:** read `spec.md`. Does it match your intent? Edit it by hand if needed. Fixing a requirement here is cheap; fixing it in code is expensive. That is the SDLC lesson.

---

## PHASE 2b – Clarify (optional requirement review)

```
/speckit-clarify
```

Claude asks up to 5 targeted questions about vague parts (for example "what should Logout do?", "is the photo clickable?"). Answer them; Claude writes the answers back into `spec.md` under a Clarifications section. Suggested answers for this app: Logout does nothing (visual only); photo is not clickable; no pagination.

---

## PHASE 3 – Plan (design: HOW)

**SDLC meaning:** technical design. Now, and only now, choose technology. Claude checks the plan against the constitution.

### Prompt to paste

```
/speckit-plan Use plain HTML, CSS and vanilla JavaScript in three files at the project root: index.html, style.css, script.js. Put a local placeholder avatar (SVG) in assets/avatar.svg. Keep the activity sample data as a JavaScript object in script.js and render the list into the page from it. Implement tabs with buttons using role="tab", aria-selected and left/right arrow key support. Use CSS variables for the navy, blue-gray and orange colors. Use inline SVG for the icons so no icon library or external file is needed. No build tools. Test manually by opening index.html in a browser.
```

### Files produced in `specs/001-running-dashboard/`

**`plan.md`** (example, shortened):

```markdown
# Implementation Plan: Running Dashboard

## Summary
Single static page rendering profile, stats and tabbed activity lists from in-page sample data.

## Technical Context
**Language/Version**: HTML5, CSS3, JavaScript (ES2020)
**Primary Dependencies**: None
**Storage**: N/A (hardcoded sample data)
**Testing**: Manual browser check
**Target Platform**: Modern desktop and mobile browsers
**Project Type**: Static web page
**Constraints**: No build step, no external assets, works offline

## Constitution Check
- I Simplicity First: PASS (no frameworks)
- II Minimalist Design: PASS
- III Self-Contained: PASS (inline SVG icons, local avatar)
- IV Accessible and Responsive: PASS (ARIA tabs, media query)
- V Consistent Branding: PASS
- VI Readable Code: PASS

## Project Structure
specs/001-running-dashboard/ (spec.md, plan.md, research.md, data-model.md, quickstart.md, tasks.md)
index.html
style.css
script.js
assets/avatar.svg

## Complexity Tracking
No violations.
```

- **`research.md`** – short decisions with reasons (why inline SVG, why vanilla JS tabs).
- **`data-model.md`** – the shape of the sample data, e.g. `runner { name, location }`, `stats { runs, distanceKm, time }`, `activities { run: [...], weight: [...] }`.
- **`quickstart.md`** – how to run and verify: open `index.html`, then walk through the acceptance scenarios.

**Check:** the Constitution Check section must have no failures. This is design review in SDLC terms.

---

## PHASE 4 – Tasks (work breakdown)

**SDLC meaning:** turn the design into small, ordered, checkable work items.

### Prompt to paste

```
/speckit-tasks
```

### File produced: `specs/001-running-dashboard/tasks.md` (example, shortened)

```markdown
# Tasks: Running Dashboard

**Format**: `[ID] [P?] [Story] Description` ([P] = can run in parallel)

## Phase 1: Setup
- [ ] T001 Create index.html, style.css, script.js and assets/ at the project root
- [ ] T002 [P] Add assets/avatar.svg placeholder
- [ ] T003 Define CSS variables (navy, blue-gray, orange, spacing) in style.css

## Phase 2: Foundational
- [ ] T004 Page skeleton in index.html with title "Running Dashboard", viewport meta, links to css/js

## Phase 3: User Story 1 - Profile and stats (P1) MVP
- [ ] T005 [US1] Header with title left, welcome + Logout right in index.html
- [ ] T006 [US1] Profile block (circular avatar, name, location) in index.html
- [ ] T007 [US1] Three-column stats block in index.html
- [ ] T008 [US1] Style header, profile, stats in style.css

## Phase 4: User Story 2 - Activity tabs (P2)
- [ ] T009 [US2] Sample data object in script.js
- [ ] T010 [US2] Render run and weight items with inline SVG icons (orange for run) in script.js
- [ ] T011 [US2] Tab buttons with role="tab", aria-selected, click handling in script.js
- [ ] T012 [US2] Arrow-key navigation between tabs in script.js
- [ ] T013 [US2] Style tabs and activity rows in style.css

## Phase 5: Polish
- [ ] T014 Responsive rules for 360px width in style.css
- [ ] T015 Search all files to confirm "Strava" does not appear
- [ ] T016 Walk through quickstart.md checks
```

**Check:** every requirement `FR-001` to `FR-008` should be covered by at least one task.

---

## PHASE 4b – Analyze (optional verification)

```
/speckit-analyze
```

Read-only report that checks `spec.md`, `plan.md` and `tasks.md` agree (every requirement has a task, nothing in tasks that is not in the spec, nothing violating the constitution). Fix any gaps it reports before building.

---

## PHASE 5 – Implement (build the app)

**SDLC meaning:** implementation. Claude executes `tasks.md` in order and ticks each task `[x]`.

### Prompt to paste

```
/speckit-implement
```

### Files produced at the project root

```
running-dashboard/
├── index.html        <- structure: header, profile, stats, tabs, list container
├── style.css         <- colors, typography, spacing, responsive rules
├── script.js         <- sample data, rendering, tab switching, keyboard support
└── assets/avatar.svg <- local placeholder runner image
```

### Run it

Double-click `index.html`, or from a terminal:

```
start index.html
```

(or `python -m http.server 8000` and open http://localhost:8000).

---

## PHASE 6 – Test and review

### 6.1 Manual acceptance checklist (from the spec)

- [ ] Browser tab title is "Running Dashboard"
- [ ] Header: title left, "Welcome, Arun Gupta" and "Logout" right, aligned
- [ ] Profile: small circular photo, Arun Gupta, San Jose, United States
- [ ] Stats: Runs 1,825 / Total Distance 20,061.8 km / Total Time 3,792h 17m, evenly spaced
- [ ] Recent Activities shows Run tab first with 5 runs and orange icons
- [ ] Click "Weight Training": 4 sessions, non-orange icons, tab shows selected
- [ ] Arrow keys move between tabs
- [ ] Resize to 360px wide: no horizontal scrollbar
- [ ] The text "Strava" appears nowhere (use browser find / editor search)

### 6.2 Let Claude double-check the build

```
/speckit-converge
```

Claude compares the code against spec, plan and tasks and appends anything missing as new tasks. If it adds tasks, run `/speckit-implement` again.

### 6.3 If something looks wrong

Do not just patch the code. Go back up the chain:
- Wrong behaviour → fix `spec.md`, then re-run `/speckit-plan`, `/speckit-tasks`, `/speckit-implement`.
- Wrong technical choice → fix `plan.md`, then re-run `/speckit-tasks`, `/speckit-implement`.
- Small visual tweak → ask Claude directly, then update the spec if it changes a requirement.

---

## Final result and cheat sheet

```
running-dashboard/
├── .claude/                     tooling (do not commit)
├── .specify/                    templates, scripts, constitution
├── specs/001-running-dashboard/ spec.md, plan.md, research.md, data-model.md, quickstart.md, tasks.md
├── index.html
├── style.css
├── script.js
└── assets/avatar.svg
```

| Order | Command | Takes | Gives |
|---|---|---|---|
| 1 | `/speckit-constitution` | your rules | constitution.md |
| 2 | `/speckit-specify` | what you want | spec.md |
| 3 | `/speckit-clarify` (opt.) | answers | spec.md updated |
| 4 | `/speckit-plan` | tech choices | plan.md + design files |
| 5 | `/speckit-tasks` | nothing | tasks.md |
| 6 | `/speckit-analyze` (opt.) | nothing | consistency report |
| 7 | `/speckit-implement` | nothing | the working app |
| 8 | `/speckit-converge` (opt.) | nothing | gaps added to tasks.md |

**The lesson:** requirements (spec) → design (plan) → work breakdown (tasks) → build → verify. Each artifact is reviewable on its own, and the app is only as good as the files that came before it.

---

## Troubleshooting setup

| Error | Cause | Fix |
|---|---|---|
| `UnicodeEncodeError: 'charmap' codec can't encode` | Windows console encoding | Set `PYTHONUTF8=1` or use Windows Terminal |
| `No matching release asset found for claude` | Old pinned version (v0.4.1) had no template download | Install the latest version (Phase 0.1) |
| `'pwsh' (PowerShell 7+) not found` with `--offline` | Old offline mode needs PowerShell 7 | Upgrade spec-kit or install PowerShell 7 |
| `No such option: --ai` / `--no-git` | Removed in newer versions | Use `--integration claude` |
| `/speckit-*` commands not found | Claude started outside the project | `cd running-dashboard`, then `claude` |
