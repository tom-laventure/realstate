# RealState SaaS Platform

## What This Is

A multi-tenant real estate SaaS platform serving brokerages via domain-based isolation. Brokerages manage property listings, organize agents into groups, and collaborate through shared tools: comments, documents, ratings, tags, and calendar dates. The platform has a hardened security posture, Google social login, working onboarding flows, personal Google calendar sync, and a backend + frontend test suite.

## Core Value

Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.

## Current Milestone: v1.2 — Listing Map View

**Goal:** Give agents a geographic view of their listings — an interactive Google Maps panel on the group dashboard (filter-synced) and a location map on each individual listing detail page.

**Target features:**
- lat/lng columns on `listing_details`; populated from RETS/MLS feed on import, geocoded from address as fallback
- Group dashboard: Google Maps panel with pins for all group listings, live-synced to active filter
- Individual listing detail: embedded map showing the property location
- Pin clustering: nearby/same-building listings grouped into a cluster pin, expandable to individual cards
- Popup card on pin click: hero photo, address, price, bed/bath/sqft, "View details" link

## Milestone: v1.1 Domain Access Control — SHIPPED 2026-05-16

**Goal:** Enforce strict domain-based routing — main domain serves only the brokerage creation flow; brokerage subdomains never expose `/create`. ✓ Complete.

**Delivered:**
- Frontend domain guard (configurable `VITE_MAIN_DOMAIN`, main domain shows only `/create/*`, subdomains redirect `/create` → `/`) — Phase 6
- Backend onboarding guard (all `/v1/onboarding/*` endpoints require main-domain origin, 403 otherwise) — Phase 7
- Configurable main domain via env vars on both frontend and backend (ready for `realtybase.ca → app.realtybase.ca` migration)

## Requirements

### Validated

- ✓ Multi-tenant brokerage isolation via domain → `BrokerageDomain` resolution — existing
- ✓ User authentication via AWS Cognito (email/password) + HS256 JWT — existing
- ✓ Property listing management backed by RETS/MLS board credentials — existing
- ✓ Group-based listing organization with `GroupEstate` pivot model — existing
- ✓ Per-listing engagement: ratings, comments, documents, dates, likes, rejections — existing
- ✓ Notification fanout to group members via SolidQueue background jobs — existing
- ✓ Admin dashboard: user management, group management, invitations — existing
- ✓ Role-based UI guards (`ProtectedRoute`, `RequireRole`, `Can`) — existing
- ✓ Filter sets with listing filtering and preview counts — existing
- ✓ S3 document storage, CloudFront CDN for photos — existing
- ✓ Brokerage creation wizard and invitation-based join flow — existing
- ✓ Server-side RBAC via `Admin::BaseController#require_admin!` on all 13 admin controllers — v1.0 (SEC-01)
- ✓ Hardcoded test credentials removed from sign-in component — v1.0 (SEC-02)
- ✓ CORS restricted to brokerage domain allowlist via `BrokerageDomain` proc — v1.0 (SEC-03)
- ✓ `POST /v1/sessions` rate-limited via rack-attack — v1.0 (SEC-04)
- ✓ SQL injection risk removed from `Group#order_estates` — v1.0 (SEC-05)
- ✓ `InvitationsController` crash fixed — v1.0 (SEC-06)
- ✓ `FilterSetsController#create` scoped to current group — v1.0 (SEC-07)
- ✓ Frontend 403 handler with toast + redirect — v1.0 (SEC-08)
- ✓ `EstateLike` N+1 eliminated — v1.0 (PERF-01)
- ✓ `per_page` cap at 100 across all controllers — v1.0 (PERF-03)
- ✓ Backend test suite: 17 integration tests (tenant isolation, RBAC, FilterSets, GroupEstatesQuery, InvitationsController) — v1.0 (TEST-01–06)
- ✓ Frontend test suite: Vitest 4.x + MSW 2.x, 7 unit tests (ProtectedRoute, RequireRole, GoogleSignInButton) — v1.0 (TEST-07–09)
- ✓ Domain wizard: client-side + server-side validation, save, confirmation, wizard gate — v1.0 (ONB-01)
- ✓ Post-invite redirect to correct brokerage workspace via `group.uid` — v1.0 (ONB-02)
- ✓ Dismissible welcome banner on first dashboard visit — v1.0 (ONB-03)
- ✓ Google OAuth federation via Cognito + PreSignUp Lambda with `AdminLinkProviderForUser` — v1.0 (AUTH-01/02)
- ✓ "Sign in with Google" button + intermediary callback + Cognito idToken exchange — v1.0 (AUTH-03)
- ✓ "Connected via Google" badge in account settings — v1.0 (AUTH-04)
- ✓ `user_calendar_connections` table with AR Encryption + `EstateDateCalendarEvent` pivot — v1.0 (CAL-01)
- ✓ Calendar settings panel: Google provider card with connect/disconnect/resync — v1.0 (CAL-02)
- ✓ Google Calendar sync via `CalendarSyncJob` with advisory lock and deterministic event IDs — v1.0 (CAL-03, CAL-06)
- ✓ Sync failure indicator + Re-sync button in calendar settings — v1.0 (CAL-07)
- ✓ Frontend domain guard: `VITE_MAIN_DOMAIN`-based routing, main domain → only `/create/*`, subdomain `/create` → `/` — v1.1 (DOM-01, DOM-02, DOM-03)
- ✓ Backend onboarding guard: `MainDomainOnly` concern rejects non-main-domain origins on all `/v1/onboarding/*` with HTTP 403 — v1.1 (DOM-04, DOM-05)

### Active (v1.2 requirements)

- [ ] **MAP-01**: lat/lng columns added to `listing_details`; populated from RETS/MLS feed, geocoded as fallback
- [ ] **MAP-02**: Group dashboard renders Google Maps panel showing pins for all listings in the group
- [ ] **MAP-03**: Group dashboard map updates pins in real time when active filter changes
- [ ] **MAP-04**: Individual listing detail page shows embedded Google Maps with the property location pinned
- [ ] **MAP-05**: Nearby listings are clustered into a single cluster pin on the group map; expanding the cluster reveals individual listing cards
- [ ] **MAP-06**: Clicking a pin opens a popup card showing hero photo, address, price, bed/bath/sqft, and a "View details" link

**Deferred from v1.0/v1.1:**
- [ ] Microsoft Calendar sync (CAL-04) — adapter built in v1.0, activate by expanding `PROVIDERS` + `providerOrder`
- [ ] Apple CalDAV sync (CAL-05) — adapter built in v1.0, activate by expanding `PROVIDERS` + `providerOrder`
- [ ] Two-way calendar sync — requires webhooks and conflict resolution
- [ ] Expanded test coverage: context hooks, calendar UI states
- [ ] CR-01: `BrokerageDomain.exists?` missing `.active` scope in `DomainsController#check` — deferred to v1.3
- [ ] CR-02: S3 favicon upload outside transaction — orphaned on DB failure — deferred to v1.3

### Out of Scope

- Apple / Microsoft social login — only Google OAuth for this milestone; others in a future auth milestone
- JWT → HttpOnly cookies migration — architectural change requiring significant backend/frontend coordination; separate security milestone
- Redux → Context migration — 3 slices, low-risk but high churn; separate cleanup milestone
- SCSS → Tailwind migration — incremental only; do not migrate proactively in this milestone
- Admin directory restructure (`adminBoard/` vs `view/admin/`) — separate refactor milestone
- TanStack Query v4 → v5 upgrade — breaking API changes; separate upgrade milestone
- `ActivityQuery` SQL UNION optimization — performance improvement deferred; acceptable at current scale
- `User#current_brokerage_membership` job-context fix — low impact; document constraint and defer

## Context

- **Stack:** Ruby 4.0.2 / Rails 7.1 JSON API + Vite/React 18 SPA. Monorepo with `backend/` and `frontend/` as separate git repos.
- **Auth:** AWS Cognito + Amplify for identity; custom HS256 JWT (`TokenService`) issued on sign-in, stored in `localStorage`. Google OAuth federated identity via Cognito + PreSignUp Lambda. `CognitoAuth` concern verifies per-request.
- **Multi-tenancy:** `BrokerageAuth` concern resolves `Current.brokerage` from Host header on every request. All queries must scope to `Current.brokerage`.
- **Soft deletes:** `acts_as_paranoid` on all user-facing models. Every query must call `.without_deleted`; joins require explicit `where(table: { deleted_at: nil })`.
- **Test suite:** 17 backend integration tests (Minitest) + 7 frontend unit tests (Vitest 4.x + MSW 2.x). Covers tenant isolation, RBAC, FilterSets, GroupEstatesQuery, InvitationsController, ProtectedRoute, RequireRole, GoogleSignInButton.
- **Calendar sync:** `UserCalendarConnection` (encrypted credentials) + `EstateDateCalendarEvent` + `CalendarSyncJob` (SolidQueue, advisory lock). Google adapter active; Microsoft (HTTParty/Graph API) and Apple (CalDAV via calendav) adapters built but inactive — activate by expanding `PROVIDERS` constant.
- **Background jobs:** SolidQueue (DB-backed, no Redis). Migrations for calendar tables must be applied on Render.com environment via `rails db:migrate`.
- **Shipped v1.0:** 2026-05-13

## Constraints

- **Tech Stack:** Must use existing Rails + React stack; no new backend framework introductions
- **Auth Provider:** Google OAuth must integrate via Cognito federated identity (not a direct OAuth implementation) to maintain single token issuance point
- **Calendar APIs:** Google Calendar (REST), Apple Calendar (CalDAV), Microsoft (Graph API) — each requires per-user OAuth tokens stored server-side
- **Soft Deletes:** Every new query must call `.without_deleted`; joined models must add explicit `deleted_at: nil` where clauses
- **Serializer N+1:** New collection endpoints must bulk-compute per-record data in the controller; serializers must never query per-record
- **Testing:** Backend uses Minitest (not RSpec); Frontend uses `@testing-library/react`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| `Admin::BaseController#require_admin!` — imperative, no gem | Consistent with existing imperative auth pattern; no additional dependency | ✓ Good — all 13 admin controllers enforcing RBAC |
| Google OAuth via Cognito federated identity | Keeps token issuance centralized in `TokenService`; avoids parallel auth path | ✓ Good — single idToken exchange at `POST /v1/sessions` |
| Fixed intermediary callback URL (`auth.realtybase.ca`) | Multi-tenant subdomains can't receive OAuth redirects directly | ✓ Good — customState brokerage encoding works across tenants |
| PreSignUp Lambda ships atomically with button | Button without Lambda = broken flow; Lambda without button = dead code | ✓ Good — shipped together in Phase 4 |
| Per-user `UserCalendarConnection` with AR Encryption | Calendar tokens are personal; Apple credentials need encryption at rest | ✓ Good — encryption transparent via AR Encryption |
| `CalendarSyncJob` with advisory lock on connection ID | Concurrent token refresh races cause invalid_grant errors | ✓ Good — advisory lock serializes refresh per connection |
| Microsoft + Apple adapters built but not exposed (v1.0) | Google verified working; Microsoft/Apple require more external setup | ✓ Good — activate by expanding PROVIDERS constant, no code changes needed |
| Fix onboarding bugs in-place (not rewrite) | Flows exist; specific steps are broken — surgical fixes preferred | ✓ Good — minimal churn, all ONB requirements satisfied |

| `MainDomainOnly` concern — duplicate Origin extraction vs shared helper | Separate concerns have different semantics; sharing couples orthogonal security boundaries | ✓ Good — duplication is deliberate per research guidance |
| Frontend guards are UX-only; backend 403 is the real security boundary (decision 06-01) | JavaScript guards can be bypassed; API layer is the trust boundary | ✓ Good — Phase 7 closes the gap with a proper server-side check |

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

Last updated: 2026-05-16 — v1.1 milestone complete

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-16 — milestone v1.2 started*
