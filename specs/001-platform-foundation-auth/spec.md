# Feature Specification: Platform Foundation and Authentication

**Feature Branch**: `001-platform-foundation-auth`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Project bootstrap and platform foundation for SURYAMIT: landing page; sign-up with role (household or vendor) and sign-in; one-click demo accounts (1 household 'Sharma Residence', 3 vendors SunRise Energy / GreenVolt Solar / SolarTech Solutions, all labelled Demo); profiles and vendor profiles with access rules; role-based routing (household → household area, vendor → vendor area); app shell with SURYAMIT visual identity; shared response envelope, error codes and authorization guard; shared base validation vocabulary; demo seed skeleton. Every later feature depends on this."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Try SURYAMIT instantly with a demo account (Priority: P1)

A judge, teammate or first-time visitor opens SURYAMIT, reads what the product does on the
landing page, and with a single click enters as the demo household ("Sharma Residence") or as
one of the three demo vendors (SunRise Energy, GreenVolt Solar, SolarTech Solutions). They land
in the area for that role, see a clear "Demo" label, see who they are signed in as, and can sign
out and switch to another demo account in seconds.

**Why this priority**: The whole hackathon demo (request → quote → compare → accept) is
performed by switching between the demo household and demo vendors. Without instant, reliable
demo entry nothing else can be shown. The landing page is also the first screen judges see.

**Independent Test**: From a fresh browser, open the landing page, click "Try as demo
household", confirm arrival in the household area with a "Demo" label and the name "Sharma
Residence"; sign out; click "Try as demo vendor — GreenVolt Solar", confirm arrival in the vendor
area labelled "Demo". Delivers value on its own: the product shell is demonstrable.

**Acceptance Scenarios**:

1. **Given** an anonymous visitor, **When** they open the landing page, **Then** they see the
   SURYAMIT name, the core promise ("Understand your roof. Compare your options. Choose solar
   with confidence."), a short "how it works" sequence (publish request → receive quotes →
   compare → accept), separate entry points for households and vendors, sign-in and sign-up
   links, and the demo account options.
2. **Given** demo access is enabled, **When** the visitor chooses "Try as demo household",
   **Then** they are signed in as "Sharma Residence" and taken to the household area without
   typing any credentials.
3. **Given** demo access is enabled, **When** the visitor chooses one of the three demo vendors,
   **Then** they are signed in as that vendor and taken to the vendor area.
4. **Given** a signed-in demo user, **When** any authenticated page is shown, **Then** a visible
   "Demo" label, the account display name and the role are shown in the app header.
5. **Given** a signed-in user, **When** they choose "Sign out", **Then** their session ends, they
   return to the landing page, and pressing Back does not reveal protected content.
6. **Given** demo access is disabled by configuration, **When** the landing page is shown,
   **Then** no demo options are displayed and a direct demo sign-in attempt is refused.
7. **Given** the demo sign-in cannot complete (e.g. demo accounts not present), **When** the
   visitor clicks a demo option, **Then** a clear error message with a retry option is shown and
   the landing page remains usable.

---

### User Story 2 - Each role stays in its own area (Priority: P1)

Households and vendors only ever see the area, data and actions intended for their role.
Anonymous visitors are sent to sign in before reaching any protected area, and come back to
where they wanted to go after signing in. Any attempt to reach the other role's area, or to read
or change someone else's account data, is refused by the server — not merely hidden in the
interface.

**Why this priority**: Constitution IV makes server-side and data-layer authorization
mandatory; every later feature (requests, quotes, acceptance) relies on this guard being
correct. A leak here undermines the privacy promises made to households.

**Independent Test**: Sign in as the demo household and try to open the vendor area and the
vendor-only operations; sign in as a demo vendor and try the reverse; as anonymous, open a
protected page; as user A, try to read or change user B's profile. All are refused with the
standard error format and no data is disclosed.

**Acceptance Scenarios**:

1. **Given** an anonymous visitor, **When** they open any household or vendor page, **Then** they
   are redirected to sign-in and, after a successful sign-in, returned to that page if it belongs
   to their role (otherwise to their role's home).
2. **Given** a signed-in household, **When** they open any vendor page, **Then** they are
   redirected to the household home and no vendor content is rendered.
3. **Given** a signed-in vendor, **When** they open any household page, **Then** they are
   redirected to the vendor home and no household content is rendered.
4. **Given** an anonymous caller, **When** they call any protected server operation, **Then** the
   response is the standard error with code `UNAUTHENTICATED`.
5. **Given** a signed-in user of the wrong role, **When** they call a role-restricted server
   operation, **Then** the response is the standard error with code `FORBIDDEN`.
6. **Given** two signed-in users A and B, **When** A tries to read or change B's profile or
   vendor profile by any route (including directly against the data layer), **Then** nothing is
   returned or changed.
7. **Given** a signed-in user, **When** they try to change their own role or demo flag, or a
   vendor tries to change its own verification status, **Then** the change is refused.
8. **Given** a sign-in link with a "return to" address pointing to another website, **When** the
   user signs in, **Then** they are taken to their role home, never to the external address.

---

### User Story 3 - Create an account with a role and sign in (Priority: P2)

A real household or solar vendor creates an account by choosing their role, entering name,
email, password and optionally a phone number. A vendor also enters company name and service
area, and optionally a base location and service radius. After sign-up they are signed in and
taken to their role's area. Returning users sign in with email and password.

**Why this priority**: The demo works with seeded accounts, so self-service sign-up is second
to the demo path; it is still needed to show a credible two-sided marketplace and is part of the
P0 foundation.

**Independent Test**: Sign up a new household and a new vendor with valid details; confirm each
lands in its own area and its profile shows the entered details; sign out and sign back in with
the same credentials; try invalid inputs and confirm field-level errors.

**Acceptance Scenarios**:

1. **Given** the sign-up page, **When** a visitor selects "Household", enters a name, valid
   email and a password of at least 8 characters, **Then** an account is created with role
   household and they arrive in the household area.
2. **Given** the sign-up page, **When** a visitor selects "Vendor" and also enters company name
   and service area, **Then** an account and a vendor profile with verification status
   "unverified" are created and they arrive in the vendor area.
3. **Given** the sign-up page, **When** required fields are missing or invalid (bad email, short
   password, vendor without company name, phone in an invalid format), **Then** the account is
   not created and each problem is shown next to its field.
4. **Given** an email already registered, **When** someone signs up with it, **Then** the account
   is not created and a neutral message suggests signing in instead.
5. **Given** an existing account, **When** the user enters the correct email and password on the
   sign-in page, **Then** they are signed in and routed to their role's home.
6. **Given** wrong credentials, **When** the user tries to sign in, **Then** a single generic
   message ("Email or password is incorrect") is shown without revealing which field was wrong.
7. **Given** a signed-in user, **When** they reload the page or open a new tab, **Then** they
   remain signed in until they sign out or the session expires.

---

### User Story 4 - View and update my own profile (Priority: P3)

A signed-in user views their profile and updates their display name and phone. A vendor also
updates company name, service area, base location and service radius, which later features use
for request discovery and quote display.

**Why this priority**: Useful for credibility and for vendor discovery accuracy, but the demo
accounts are pre-filled, so the end-to-end flow works without it.

**Independent Test**: Sign in as a demo vendor, open the profile page, change the service radius
and company name, save, reload and see the new values; try to save an invalid radius and see a
field error.

**Acceptance Scenarios**:

1. **Given** a signed-in household, **When** they open their profile, **Then** they see name,
   email, phone and role, and can change name and phone.
2. **Given** a signed-in vendor, **When** they change company name, service area, base location
   or service radius with valid values and save, **Then** the new values are stored and shown.
3. **Given** invalid values (empty company name, radius outside 1–500 km, location outside
   valid coordinate ranges), **When** they save, **Then** nothing is changed and field errors
   are shown.
4. **Given** a demo account, **When** its profile is shown, **Then** it is labelled "Demo" and a
   demo vendor is never shown as verified.

---

### Edge Cases

- Demo accounts are missing from the environment (seed not applied): demo click shows an error
  state with guidance; regular sign-in and sign-up still work.
- A user's session expires while a page is open: the next protected action returns
  `UNAUTHENTICATED` and the interface sends them to sign-in, then back.
- An account exists in the identity system but has no profile record (partial failure): the user
  is treated as not fully registered, shown an error state, and no protected area is rendered.
- A visitor signs up while already signed in: they are shown their current account and asked to
  sign out first.
- A request body is not valid JSON, is empty, or contains unexpected fields: the server responds
  `VALIDATION_FAILED` without processing it.
- A state-changing request is sent from another website using the user's session: it is refused.
- Sign-up with role values other than household or vendor (e.g. "admin") through any route,
  including bypassing the sign-up page: refused.
- Very long or script-like input in name or company name: length-limited, stored as plain text
  and always displayed escaped.
- The service is unreachable or an unexpected error occurs: the user sees a friendly error with
  retry; no technical detail is shown.
- Narrow phone screen (360 px wide): landing, sign-in, sign-up and the app shell remain fully
  usable without horizontal scrolling.

## Requirements *(mandatory)*

### Functional Requirements

**Landing page and visual identity**

- **FR-001**: The system MUST provide a public landing page that presents the SURYAMIT name, the
  core promise, a "how it works" sequence (publish request → receive quotes → compare → accept),
  distinct entry points for households and vendors, sign-in and sign-up links, and (when
  enabled) the demo account options.
- **FR-002**: All pages MUST share one consistent SURYAMIT visual identity: deep forest green
  primary, solar green accent, mint, warm off-white and restrained solar yellow supporting
  colours; Inter or Geist typography; text contrast meeting WCAG 2.1 AA.
- **FR-003**: All pages delivered by this feature MUST be mobile-first and usable from 360 px
  width upwards with no horizontal scrolling.
- **FR-004**: Every authenticated page MUST be framed by a common app shell showing the product
  name, role-appropriate navigation, the signed-in account's display name and role, a "Demo"
  label for demo accounts, a sign-out action, and a footer link to the rules-and-sources page
  with an "estimates only, not a government service" note.

**Sign-up and sign-in**

- **FR-005**: Visitors MUST be able to create an account by choosing exactly one role
  (household or vendor) and entering name (1–100 characters), email, password (at least 8
  characters) and an optional phone number (Indian mobile format, 10 digits, optional +91).
- **FR-006**: Vendor sign-up MUST additionally require company name (2–120 characters) and
  service area description (2–200 characters), and MAY include a base location (latitude and
  longitude, both or neither) and a service radius in km (1–500, default 25).
- **FR-007**: The system MUST validate every sign-up, sign-in and profile input on the server,
  reject any unexpected fields, and return field-level error details for each invalid field.
- **FR-008**: The system MUST refuse any account role other than household or vendor, through
  every route (including attempts that bypass the sign-up page), and MUST NOT allow a user to
  change their role after sign-up.
- **FR-009**: A newly created vendor profile MUST start with verification status "unverified";
  only platform-controlled seed data may set status "demo"; no user can change their own
  verification status or demo flag.
- **FR-010**: Sign-up with an already registered email MUST NOT create an account and MUST
  show a neutral message suggesting sign-in.
- **FR-011**: Registered users MUST be able to sign in with email and password; failed attempts
  MUST show one generic message that does not reveal whether the email exists.
- **FR-012**: After sign-up or sign-in the system MUST route households to the household home
  and vendors to the vendor home, honouring a requested "return to" page only if it is an
  internal page belonging to the user's role.
- **FR-013**: Sessions MUST persist across page reloads and tabs until sign-out or expiry; users
  MUST be able to sign out from every authenticated page, returning to the landing page.

**Demo accounts**

- **FR-014**: The system MUST offer one-click access to exactly four fictional demo accounts:
  household "Sharma Residence" (Hyderabad, Telangana) and vendors "SunRise Energy", "GreenVolt
  Solar" and "SolarTech Solutions" (each serving Hyderabad), without the visitor typing
  credentials.
- **FR-015**: Demo accounts, demo vendor names and demo data MUST be visibly labelled "Demo"
  wherever shown, and demo vendors MUST never be presented as real or verified installers.
- **FR-016**: Demo credentials MUST never be displayed to, or delivered to, the browser; demo
  access MUST be switchable off by configuration, in which case demo options are hidden and demo
  sign-in is refused.
- **FR-017**: The demo accounts and their base data MUST be re-creatable to a known starting
  state with a single reset operation, and later features MUST be able to extend the same demo
  dataset.

**Access control and privacy**

- **FR-018**: Anonymous visitors requesting a household or vendor page MUST be redirected to
  sign-in and, after signing in, returned per FR-012.
- **FR-019**: A household MUST NOT be able to open vendor pages and a vendor MUST NOT be able to
  open household pages; such attempts redirect to the user's own home without rendering any of
  the other role's content.
- **FR-020**: Every protected server operation MUST verify on the server that the caller is
  signed in (else `UNAUTHENTICATED`), has the required role and owns the target record (else
  `FORBIDDEN`, or `NOT_FOUND` where revealing existence would leak information).
- **FR-021**: Access rules MUST also be enforced at the data layer for account data: a user can
  read and update only their own profile; personal name and phone are never readable by other
  users (later features may grant narrowly scoped exceptions such as post-acceptance contact
  reveal); vendor business details (company name, service area, base location, service radius,
  verification status) are readable by signed-in users but editable only by the owning vendor.
- **FR-022**: The system MUST refuse state-changing requests that originate from other websites
  using a signed-in user's session.
- **FR-023**: Privileged credentials (data-service administrative key, AI provider keys, demo
  account password) MUST exist only on the server and never appear in anything delivered to the
  browser.
- **FR-024**: The system MUST log sign-up, sign-in failure categories, demo sign-in and
  authorization refusals by event type and user identifier only, never passwords, tokens,
  phone numbers or other unnecessary personal data.

**Profile**

- **FR-025**: Signed-in users MUST be able to view their own profile (name, email, phone, role,
  demo label) and update name and phone; vendors MUST additionally be able to update company
  name, service area, base location and service radius, under the same validation as FR-005
  and FR-006.

**Shared platform conventions (used by every later feature)**

- **FR-026**: Every server response MUST use one envelope: success carries `data`; failure
  carries `error` with a machine-readable `code`, a human-readable `message` and a `details`
  list. The codes are exactly: `VALIDATION_FAILED` (400), `UNAUTHENTICATED` (401), `FORBIDDEN`
  (403), `NOT_FOUND` (404), `CONFLICT` (409), `PAYLOAD_TOO_LARGE` (413), `AI_UNAVAILABLE` (503),
  `INTERNAL` (500).
- **FR-027**: Error messages MUST never include stack traces, query text, provider responses or
  secrets; unexpected failures MUST be returned as `INTERNAL` with a generic message.
- **FR-028**: The shared vocabulary — roles (`household`, `vendor`), request statuses (`draft`,
  `open`, `quoted`, `accepted`, `closed`), quote statuses (`submitted`, `accepted`, `rejected`,
  `withdrawn`), vendor verification statuses (`unverified`, `demo`), quote sources (`manual`,
  `ai_extracted`) and roof assessment statuses (`completed`, `failed`) — MUST be defined once
  and reused by every feature without redefinition.
- **FR-029**: Every screen delivered by this feature MUST implement loading, empty (where a list
  or data can be absent), success and error states, and the platform MUST provide reusable
  versions of these states for later features.
- **FR-030**: All form fields MUST have visible labels, be fully keyboard operable, show a
  visible focus indicator, and announce validation errors to assistive technologies.
- **FR-031**: Interface copy MUST be in English, clear and reassuring, and MUST avoid
  exaggerated AI claims or any implication of guaranteed subsidy.

### Key Entities *(include if feature involves data)*

- **Account (identity)**: The sign-in identity (email, password, session) managed by the
  platform's identity service. One per person.
- **Profile**: The person's platform record linked 1:1 to the account: display name, optional
  phone, role (household or vendor, fixed at sign-up), and demo flag. Owner: this feature.
- **Vendor Profile**: Business details for a vendor account (exactly one per vendor profile):
  company name, service area description, optional base location, service radius in km, and
  verification status (`unverified` or `demo`). Owner: this feature; read by discovery,
  quoting and comparison features.
- **Demo Account Set**: The four fictional seeded accounts (one household, three vendors) with
  fixed identities so that later features can attach demo data to them.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the landing page, a visitor reaches the demo household home or a demo vendor
  home in one click and in under 5 seconds on a typical broadband connection.
- **SC-002**: A first-time household or vendor completes sign-up and reaches their home in under
  2 minutes.
- **SC-003**: In the automated test suite, 100% of attempts to open the other role's area, to
  call operations without the required role, or to read or modify another user's profile are
  refused with no data disclosed.
- **SC-004**: A scan of everything delivered to the browser finds 0 occurrences of privileged
  keys or the demo password.
- **SC-005**: 100% of error responses produced in the test suite match the shared envelope and
  contain no stack traces, query text or secrets.
- **SC-006**: Landing, sign-in, sign-up, profile and app shell pages render without horizontal
  scrolling at 360 px width and pass an automated WCAG AA contrast check.
- **SC-007**: A single reset operation restores all four demo accounts to their starting state
  in under 1 minute, and switching between demo household and demo vendor takes under 10 seconds.

## Assumptions

- **Authentication method** (D-07): email + password, plus one-click demo accounts. No social
  login, magic links, password reset or email verification flow in the MVP; the environment is
  configured so that a new account is usable immediately after sign-up.
- **Demo credentials**: all four demo accounts share one server-side secret password; demo
  emails use a reserved example domain; demo phone numbers are obviously fictional.
- **Default service radius** for vendors is 25 km when not provided (product default, not
  stated in the plan).
- **Phone format**: Indian mobile numbers (10 digits starting 6–9, optional +91 prefix); phone is
  optional for both roles.
- **Return-to handling**: only internal pages of the user's own role are honoured; everything
  else falls back to the role home.
- **Duplicate email**: answered with a neutral message; the MVP accepts the small account
  enumeration risk inherent in sign-up flows.
- **Placeholder homes**: this feature delivers minimal household and vendor home pages inside
  the app shell; feature 002 replaces the household home with the dashboard and feature 004
  replaces the vendor home.
- **Rules page link**: the footer links to the rules-and-sources page delivered by feature 003;
  until then the link may lead to a simple "coming soon" state.
- **Dependencies**: none (this is the base feature). Every other feature
  (`002-household-solar-request` through `011-ai-solar-advisor`) depends on this one and must not
  re-create project-wide scaffolding, clients, the response envelope, the authorization guard or
  the shared vocabulary.
- **Out of scope**: admin role and console, vendor verification workflow, password reset,
  email change, account deletion, social/OTP login, multi-factor authentication, rate limiting
  beyond what the identity service provides, Hindi/Gujarati interface copy, analytics.
