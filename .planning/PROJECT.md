# RealState SaaS Platform

## Current Milestone: v1.5 — Domain Management

**Goal:** Give brokerage admins full control over their domains — a Domains admin page to view, edit, and manage their subdomain and optional custom domain (Pro), designate a primary domain, and understand phase-out timelines for retiring domains.

**Target features:**
- Domain schema: extend `brokerage_domains` with `domain_type`, `status`, `is_primary`, `phase_out_at`
- Domain lifecycle: 30-day phase-out period; max 2 phasing-out domains per type; force-decommission escape hatch
- Primary domain: any active domain can be promoted; system links (emails) use primary; non-primary domains redirect to primary on app init
- Domain validation: uniqueness across all non-decommissioned records, slug format + reserved-word list, Pro-tier gate on custom domains
- Domains admin page UI: status cards, phase-out countdowns, primary toggle, Pro upgrade prompt

---

## What This Is

A multi-tenant real estate SaaS platform serving brokerages via domain-based isolation. Brokerages manage property listings, organize agents into groups, and collaborate through shared tools: comments, documents, ratings, tags, and calendar dates. The platform has a hardened security posture, Google social login, working onboarding flows, personal Google calendar sync, a backend + frontend test suite, geographic map views of listings via Mapbox GL, and a main-domain admin portal where brokerage admins can manage all their brokerages in one place with a nav-bar brokerage switcher.

## Core Value

Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.

## Milestone: v1.4 — Main Domain Admin Portal — SHIPPED 2026-05-27 ✅

**Goal:** Give brokerage admins a main-domain portal where they can manage all their brokerages in one place — without relying on individual subdomain URLs. ✓ Complete.

**Delivered:**
- BrokerageAuth extended: resolves `Current.brokerage` from `X-Brokerage-Id` header on main-domain requests; 400 if absent — Phase 15
- `GET /v1/account/admin_brokerages` endpoint: cross-brokerage admin/owner membership list — Phase 15
- Main domain routing: `/dashboard/*` alongside `/create/*`; auth route promoted to top-level for cross-domain accessibility — Phase 16
- Sign-in routing: `LoginSuccessful` + `Login.tsx` both extended with domain-aware post-sign-in routing — ≥1 admin → /dashboard, 0 → /no-access — Phase 16
- Brokerage selection screen: per-brokerage cards; single-brokerage auto-redirect with anti-flash guard; `PortalShell` D-12 URL validation + D-13 empty-Redux re-fetch — Phase 17
- Post-create redirect: `SuccessStep` sends to `https://{VITE_MAIN_DOMAIN}/dashboard/:brokerageId` — Phase 17
- Portal landing page: `PortalNavBar` brokerage switcher + role badge; 4-section admin suite grid — Phase 18
- Domain-adaptive admin shell: `AdminDomainShell` delegates to `PortalAdminShell` (main domain) or `AppShellAdmin` (subdomain) — Phase 18

---

## Milestone: v1.3 — Test Board & Board Management — SHIPPED 2026-05-24 ✅

**Goal:** Replace multi-board seed data with a single TEST board (real North Vancouver addresses + coords), add a test board connect flow that skips RETS credentials and auto-associates listings, and add delete/edit CRUD to the Board Registrations table. ✓ Complete.

**Delivered:**
- Seeder overhaul: single "TEST" board replaces REBGV/FVREB/CADREB; 100 listings with real NV addresses + hardcoded lat/lng — Phase 11
- Auto-associate listings on board connect: `POST /v1/admin/board_credentials` bulk-inserts `BrokerageEstate` rows — Phase 12
- Test board connect flow: `ConnectBoardDialog` detects `is_test_board` → skips credentials step, shows blue info notice — Phase 13
- Board credential CRUD: soft-delete + credential-update per row in Board Registrations table — Phase 14

---

## Milestone: v1.2 — Listing Map View — SHIPPED 2026-05-18 ✅

**Goal:** Give agents a geographic view of their listings — an interactive Mapbox panel on the group dashboard (filter-synced, clustered) and a location map on each individual listing detail page. ✓ Complete.

**Delivered:**
- lat/lng columns on `listing_details` via `GeocodingService` + `GeocodeListingsJob` + geocode:backfill rake task — Phase 8
- Group dashboard Mapbox panel with filter-synced pins, use-supercluster clustering, popup cards — Phase 9
- Individual listing detail: `EstateLocationMap` single-pin Mapbox component between summary card and section tabs — Phase 10

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
- ✓ lat/lng (`decimal(10,6)`) + `geocoding_failed` on `listing_details`; `GeocodingService` (Nominatim) + `GeocodeListingsJob` + `geocode:backfill` rake task — v1.2 (MAP-01)
- ✓ Group dashboard Mapbox GL map panel with filter-synced pins, use-supercluster clustering, popup cards — v1.2 (MAP-02, MAP-03, MAP-05, MAP-06)
- ✓ Individual listing detail page `EstateLocationMap` — single-pin Mapbox, conditional on coordinates — v1.2 (MAP-04)
- ✓ Admin can delete a board credential (soft delete, row removed from table) — v1.3 Phase 14 (BOARD-06)
- ✓ Admin can update credentials for an existing board registration (test board re-verify / real board re-enter RETS) — v1.3 Phase 14 (BOARD-07)
- ✓ Board Registrations table has per-row delete/edit actions — v1.3 Phase 14 (BOARD-08)

### Validated (v1.3 additions)

- ✓ SEED-01–04: Single TEST board; 100 NV listings with real coords; no pre-attached BrokerageEstate rows — v1.3 Phase 11
- ✓ BOARD-01/02: `is_test_board` column + serializer; TEST board seeded — v1.3 Phase 11
- ✓ BOARD-03/04: Board connect auto-inserts BrokerageEstate rows; test boards bypass RETS validation — v1.3 Phase 12
- ✓ BOARD-05: `ConnectBoardDialog` test-board bypass step with blue info notice — v1.3 Phase 13
- ✓ BOARD-06/07/08: Board credential soft-delete + update CRUD; 5-column table with per-row actions — v1.3 Phase 14

### Validated (v1.4 additions)

- ✓ BE-01: `GET /v1/account/admin_brokerages` returns brokerage list (id, name, role) for authenticated user's admin/owner memberships — v1.4 Phase 15
- ✓ BE-02: `BrokerageAuth` resolves `Current.brokerage` from `X-Brokerage-Id` header on main-domain requests — v1.4 Phase 15
- ✓ BE-03: Main-domain `/v1/admin/**` requests without `X-Brokerage-Id` header return HTTP 400 — v1.4 Phase 15
- ✓ PORTAL-01: `/dashboard/*` routes exist on main domain alongside `/create/*` — v1.4 Phase 16
- ✓ AUTH-05: Main-domain sign-in with ≥1 admin role routes to `/dashboard` — v1.4 Phase 16
- ✓ AUTH-06: Main-domain sign-in with 0 admin roles routes to `/no-access` with clear message — v1.4 Phase 16
- ✓ AUTH-07: Unauthenticated user accessing `/dashboard/*` is redirected to sign-in — v1.4 Phase 16
- ✓ BROK-01: `BrokerageSelection` screen renders admin brokerage cards; auto-redirects on single brokerage; handles empty-Redux recovery via fetch — v1.4 Phase 17
- ✓ BROK-02: Single-brokerage auto-redirect to `/dashboard/:brokerageId` with no flash — v1.4 Phase 17
- ✓ ONB-04: Post-create wizard redirect to `https://{MAIN_DOMAIN}/dashboard/:brokerageId` via `SuccessStep` — v1.4 Phase 17
- ✓ PORTAL-02: Board registrations, user management, group management, and settings reachable from main-domain dashboard — v1.4 Phase 18
- ✓ PORTAL-03: Active brokerage name and user role displayed in dashboard nav bar — v1.4 Phase 18
- ✓ BROK-03: Brokerage switcher dropdown in nav bar switches active context without page navigation — v1.4 Phase 18
- ✓ BROK-04: Switching brokerage via nav dropdown updates all admin panel data to the selected brokerage — v1.4 Phase 18

### Active (v1.5 — Domain Management)

- [ ] **DMOD-01**: `brokerage_domains` schema extended with `domain_type`, `status`, `is_primary`, `phase_out_at`
- [ ] **DMOD-02**: Data migration backfills existing rows as subdomain / active / is_primary: true
- [ ] **DMOD-03**: Uniqueness check covers all non-decommissioned records; errors don't reveal owning brokerage
- [ ] **DMOD-04**: Subdomain slug validated for format + reserved-word list
- [ ] **DMOD-05**: Custom domain endpoints require `plan == 'premium'`
- [ ] **DMOD-06**: `GET /v1/admin/domains` — full domain list with lifecycle fields
- [ ] **DMOD-07**: `PATCH /v1/admin/domains/subdomain` — edit subdomain with phase-out of old
- [ ] **DMOD-08**: `POST /v1/admin/domains/custom` — add custom domain (Pro only) with phase-out of replaced
- [ ] **DMOD-09**: `DELETE /v1/admin/domains/:id` — phase out an active custom domain
- [ ] **DMOD-10**: `PATCH /v1/admin/domains/:id/set_primary` — promote active domain to primary
- [ ] **DMOD-11**: Phase-out warning when action results in exactly 2 phasing-out domains
- [ ] **DMOD-12**: Phase-out blocked when 2 phasing-out domains already exist (returns `earliest_slot_available_at`)
- [ ] **DMOD-13**: `GET /v1/domains/lookup?domain=X` — public endpoint returning primary domain
- [ ] **DMOD-14**: `DELETE /v1/admin/domains/:id` on phasing-out domain → immediate decommission
- [ ] **DINT-01**: Frontend app-init redirect guard for non-primary domains
- [ ] **DINT-02**: `InvitationMailer` uses `is_primary: true` domain
- [ ] **DINT-03**: `BrokerageAuth` resolves by status (active/phasing_out), not verified flag
- [ ] **DINT-04**: `V1::DomainsController#check` (Caddy) updated to filter by `status: active`
- [ ] **DUI-01**: `/admin/domains` route + "Domains" nav item on both sidebars
- [ ] **DUI-02**: Domain cards: name, type badge, status badge, phase-out countdown
- [ ] **DUI-03**: Primary badge + "Set as primary" action for active domains
- [ ] **DUI-04**: Subdomain edit form with client-side validation
- [ ] **DUI-05**: Custom domain add/remove (Pro only)
- [ ] **DUI-06/07**: Phase-out slot warning and blocked state with dates
- [ ] **DUI-08**: Non-Pro locked section with upgrade prompt
- [ ] **DUI-09**: Phasing-out domain "Remove now" with confirmation dialog

**Carry-forward (deferred to v1.6+):**
- [ ] DNS verification for custom domains (DINT knowledge gap documented)
- [ ] CR-02: S3 favicon upload outside transaction — orphaned on DB failure
- [ ] Brokerage switch data refresh preserving active tab position (UX polish — deferred from v1.4)
- [ ] Deep-link into specific admin panel by URL (e.g. `/dashboard/boards`) with brokerage context preserved
- [ ] Microsoft Calendar sync (CAL-04) — adapter built in v1.0
- [ ] Apple CalDAV sync (CAL-05) — adapter built in v1.0

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
- **Multi-tenancy:** `BrokerageAuth` concern resolves `Current.brokerage` from Host header (subdomain path) or `X-Brokerage-Id` header (main-domain path). All queries must scope to `Current.brokerage`.
- **Main domain portal:** `/dashboard/*` and `/create/*` routes coexist on the main domain. `LoginSuccessful` + `Login.tsx` both perform domain-aware post-sign-in routing. `activeBrokerage` Redux slice stores the active portal brokerage context. `AdminDomainShell` delegates to `PortalAdminShell` (main domain) or `AppShellAdmin` (subdomain) based on `isMainDomain()`.
- **Soft deletes:** `acts_as_paranoid` on all user-facing models. Every query must call `.without_deleted`; joins require explicit `where(table: { deleted_at: nil })`.
- **Test suite:** 17 backend integration tests (Minitest) + 7 frontend unit tests (Vitest 4.x + MSW 2.x). Covers tenant isolation, RBAC, FilterSets, GroupEstatesQuery, InvitationsController, ProtectedRoute, RequireRole, GoogleSignInButton.
- **Calendar sync:** `UserCalendarConnection` (encrypted credentials) + `EstateDateCalendarEvent` + `CalendarSyncJob` (SolidQueue, advisory lock). Google adapter active; Microsoft (HTTParty/Graph API) and Apple (CalDAV via calendav) adapters built but inactive — activate by expanding `PROVIDERS` constant.
- **Map:** Mapbox GL JS (`react-map-gl/mapbox`). `VITE_MAPBOX_TOKEN` required in frontend env. `GeocodingService` calls Nominatim (`NOMINATIM_USER_AGENT` required in backend env). `geocode:backfill` rake task backfills existing listings.
- **Background jobs:** SolidQueue (DB-backed, no Redis). Migrations for calendar/geocoding tables must be applied on Render.com environment via `rails db:migrate`.
- **Board management:** TEST board (`is_test_board: true`) is the only seeded board; connecting via `POST /v1/admin/board_credentials` bulk-inserts `BrokerageEstate` rows; test boards bypass RETS validation. Board Registrations table has per-row edit/delete CRUD.
- **Shipped v1.3:** 2026-05-24
- **Shipped v1.4:** 2026-05-27

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
| Mapbox GL instead of Google Maps for map panels | Phase 9 CONTEXT.md established Mapbox as project standard; Google Maps requires billing + Map ID setup overhead | ✓ Good — consistent across group dashboard map and listing detail map |
| `react-map-gl/mapbox` entry point (not `react-map-gl`) | Mapbox GL JS v3 requires the mapbox-specific bundle; generic entry point produces runtime errors | ✓ Good — both Phase 9 and Phase 10 use same import path |
| `hasFitBoundsRef` guard — fitBounds only on initial load | Without guard, every filter change re-centers the map, disrupting user pan/zoom state | ✓ Good — UX stays stable across filter interactions |
| Custom Marker child with `stopPropagation()` | Childless Mapbox `<Marker>` doesn't reliably forward click events through react-map-gl v8 | ✓ Good — pin click popup works reliably |
| Controlled AlertDialog for delete (outside Radix tree) | AlertDialogTrigger inside DropdownMenuItem causes portal/focus conflicts across Radix contexts | ✓ Good — delete flow works reliably with `deleteTarget` state pointer |
| `useUpdateBoardCredential` no onError — propagates to dialog | Dialog uses `mutateAsync` to display inline serverError; toast-only failure feedback is insufficient for form re-entry | ✓ Good — inline error shown in EditBoardCredentialDialog catch block |
| `main_domain_request?` reuses `extract_domain_from_request` | No URI.parse duplication — single source of truth for host extraction | ✓ Good — consistent domain detection across BrokerageAuth and MainDomainOnly |
| `AdminBrokeragesController` excludes BrokerageAuth | Cross-brokerage endpoint by design; no single brokerage context applies | ✓ Good — MainDomainOnly + CognitoAuth only; `skip_brokerage_membership? = true` defense-in-depth |
| `useFetchAdminBrokerages` is imperative (not useQuery) | `LoginSuccessful` is a fire-once lifecycle component that navigates away on completion; a useQuery would be orphaned by unmount | ✓ Good — satisfies CLAUDE.md "through a hook" rule without TanStack overhead |
| `setToken` before `fetchAdminBrokerages` in sign-in flows | Axios interceptor reads `localStorage auth_token`; reversed order causes 401 | ✓ Good — critical ordering constraint for both LoginSuccessful and Login.tsx |
| `Login.tsx` deviation catch — email/password bypasses `LoginSuccessful` | `CreateAccount` → `signIn.ts` → `onAuthenticated()` never mounts `LoginSuccessful`; must extend both sign-in paths | ✓ Good — both paths now perform domain-aware routing |
| `activeBrokerage` Redux state is in-memory only | Never persisted to localStorage/sessionStorage; token already in localStorage covers auth; brokerage context is session state | ✓ Good — T-17-01 accepted; PortalShell D-13 handles empty Redux on page reload |
| `AdminDomainShell` single-route delegation | One route definition avoids React Router path conflicts from domain-guarded duplicate /admin/ blocks | ✓ Good — avoids path conflicts, subdomain AdminShell unchanged |
| `RequireRole` isMainDomain() bypass before isUserLoaded check | `account.id` never populated on main domain (no NavBar calling useGetCurrentUser); isUserLoaded always false | ✓ Good — portal access validated upstream by PortalShell brokerage validation |

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

Last updated: 2026-05-27 — Phase 19 complete (domain schema & auth integration)

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
*Last updated: 2026-05-27 after v1.4 milestone*
