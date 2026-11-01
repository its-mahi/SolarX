# Contract: UI Routes, Redirects and App Shell

## Routes delivered by 001

| Path | Access | Content | States |
|---|---|---|---|
| `/` | public | Landing: hero with core promise, "How it works" (4 steps), household and vendor entry cards, demo buttons (when enabled), sign-in/up links, footer | success; demo-click loading + error toast |
| `/login` | public (signed-in users are redirected to their home) | Email + password form; `?next=` honoured via `safeNextPath` | idle, submitting, error |
| `/signup` | public (signed-in users see "You're signed in as … — sign out first") | Role radio (Household / Vendor), common fields, vendor fields revealed when Vendor chosen | idle, submitting, field errors, error |
| `/account` | any signed-in user | Own profile view + edit form (vendor fields for vendors), Demo label | loading, success toast, field errors, error |
| `/household` | household | Placeholder home inside AppShell ("Your dashboard is coming next") — **replaced by 002** | — |
| `/vendor` | vendor | Placeholder home inside AppShell — **replaced by 004** | — |

## Redirect rules

| Situation | Result |
|---|---|
| Anonymous → `/household/**`, `/vendor/**`, `/account` | `302 /login?next=<path>` (middleware) |
| Household → `/vendor/**` | redirect `/household` (vendor layout) |
| Vendor → `/household/**` | redirect `/vendor` (household layout) |
| Signed-in → `/login` | redirect to `homePathForRole(role)` |
| After sign-in/up/demo | `safeNextPath(next, role)` |

`safeNextPath(next, role)` returns `next` only if it starts with exactly one `/`, contains no
`\`, no scheme, and starts with `/household` (household), `/vendor` (vendor) or `/account`;
else `homePathForRole(role)` (`/household` or `/vendor`).

## App shell (`src/components/layout/app-shell.tsx`)

Props: `{ profile: { name, role, is_demo }, children }`.

- Header: Sun icon + "SolarX" wordmark linking to role home; role nav from `nav-config.ts`;
  `DemoBadge` when `is_demo`; `UserMenu` (name, role label "Household"/"Vendor", "Account",
  "Sign out").
- Mobile (< 768 px): nav collapses into a menu button; all items reachable by keyboard.
- Footer: link "Rules & sources" → `/rules` (003), text "SolarX shows estimates only. It is not
  a government service and does not guarantee subsidy."
- Main content max width 1200 px, 16 px side gutter on mobile.

`nav-config.ts` exports `NAV_ITEMS: Record<Role, { href: string; label: string; icon: LucideIcon }[]>`.
001 ships `household: [{ '/household', 'Dashboard' }]` and `vendor: [{ '/vendor', 'Open requests' }]`;
later features append items (e.g. 002 "New request", 005 "My quotes").

## Shared state components (`src/components/shared/`)

| Component | Props | Use |
|---|---|---|
| `LoadingState` | `{ label?: string; variant?: 'page' \| 'inline' \| 'card' }` | skeletons + `aria-busy` |
| `EmptyState` | `{ icon?, title, description?, action?: { label, href \| onClick } }` | empty lists |
| `ErrorState` | `{ title?, message?, onRetry?: () => void }` | recoverable errors; never shows technical detail |
| `DemoBadge` | `{ className? }` | "Demo" pill (solar-yellow outline, readable text) |
| `FieldError` | `{ id, message? }` | `role="alert"` text linked via `aria-describedby` |
| `DemoAccountButtons` | `{ next?: string }` | four labelled demo buttons calling `POST /api/auth/demo` |

## Landing copy (English)

- Hero: "Understand your roof. Compare your options. Choose solar with confidence."
- Sub: "SolarX helps households under PM Surya Ghar get comparable rooftop-solar quotations
  from vendors, with transparent, code-calculated estimates."
- How it works: 1 Publish your request · 2 Receive vendor quotes · 3 Compare clearly · 4 Accept
  with confidence.
- Demo section heading: "Explore with demo accounts" + note "Fictional demo data. Vendors shown
  are not real or verified installers."
