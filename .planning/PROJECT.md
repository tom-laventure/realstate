# RealState SaaS Platform

## What This Is

A multi-tenant real estate SaaS platform serving brokerages via domain-based isolation. Brokerages manage property listings, organize agents into groups, and collaborate through shared tools: comments, documents, ratings, tags, and calendar dates. The platform has a hardened security posture, Google social login, working onboarding flows, personal Google calendar sync, a backend + frontend test suite, geographic map views of listings via Mapbox GL, a main-domain admin portal with brokerage switcher, and a complete domain management system: lifecycle-tracked subdomains and custom domains (Pro), automated DNS verification and health monitoring, 301 redirect enforcement, Pro-downgrade freeze/restore, and a polished role-gated Domains admin UI.

## Core Value

Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.

## Current State: Between Milestones (v1.6 Complete)

**Shipped v1.6:** 2026-05-31 — Domain Management v2
**Next:** v1.7 — to be defined via `/gsd-new-milestone`

---

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
- ✓ Admin can update credentials for an existing board registration — v1.3 Phase 14 (BOARD-07)
- ✓ Board Registrations table has per-row delete/edit actions — v1.3 Phase 14 (BOARD-08)
- ✓ SEED-01–04: Single TEST board; 100 NV listings with real coords; no pre-attached BrokerageEstate rows — v1.3 Phase 11
- ✓ BOARD-01/02: `is_test_board` column + serializer; TEST board seeded — v1.3 Phase 11
- ✓ BOARD-03/04: Board connect auto-inserts BrokerageEstate rows; test boards bypass RETS validation — v1.3 Phase 12
- ✓ BOARD-05: `ConnectBoardDialog` test-board bypass step with blue info notice — v1.3 Phase 13
- ✓ BOARD-06/07/08: Board credential soft-delete + update CRUD; 5-column table with per-row actions — v1.3 Phase 14
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
- ✓ DMOD-01–14: Full `brokerage_domains` lifecycle schema, backend API (5 actions), slot logic, public lookup — v1.5 Phases 19–20
- ✓ DINT-01–04: `PrimaryDomainRedirect` guard; `InvitationMailer` primary domain; `BrokerageAuth` routable scope; `DomainsController#check` status_active scope — v1.5 Phases 19–21
- ✓ DUI-01–09: Full Domains admin page with status cards, phase-out countdowns, slot management, Pro gate, all domain actions — v1.5 Phase 21

### Validated (v1.6 — Domain Management v2)

- ✓ DVER-01: "Verify now" button on pending/phasing-out domains; on-demand verify endpoint with synchronous DNS check — v1.6 Phase 24
- ✓ DVER-02: Background verification polling every 30 minutes for unverified and phasing-out domains — v1.6 Phase 22
- ✓ DVER-03: Domain card shows last-checked timestamp and verification state — v1.6 Phase 24
- ✓ DVER-04: Verification failure shows plain-language explanation — v1.6 Phase 24
- ✓ DVER-05: First-to-verify wins via pessimistic lock in `DomainVerificationJob` — v1.6 Phase 22
- ✓ DHLT-01: Active custom domains checked every 30 minutes for valid CNAME — v1.6 Phase 22
- ✓ DHLT-02: After 3 consecutive failed checks, domain auto-moves to Phasing out — v1.6 Phase 22
- ✓ DHLT-03/04: Owner email notification on health failure; primary-domain failure calls out subdomain fallback — v1.6 Phase 22
- ✓ DHLT-05: `HEALTH_CHECK_INTERVAL` and `PHASE_OUT_DURATION` as named constants — v1.6 Phase 22
- ✓ DLCX-01: Verification success before decommission restores domain to Active, clears `phase_out_at` — v1.6 Phase 22
- ✓ DLCX-02: Rescue confirmation shown on dashboard when phasing-out domain is rescued — v1.6 Phase 24
- ✓ DLCX-03: Delete triggers phase-out; dialog shows decommission date — v1.6 Phase 24
- ✓ DLCX-04: Deleting primary requires selecting replacement first; subdomain pre-selected — v1.6 Phase 24
- ✓ DUIV-01–06: Domain card list with role-gated controls, lock icon tooltip, primary badge, status badges — v1.6 Phase 24
- ✓ DADD-01–04: 4-step add wizard; conditional primary preference step; pending card appears immediately; 7-day auto-remove with day-5 warning — v1.6 Phases 22/24
- ✓ DPRI-01–04: Active-domain-only primary eligibility; Owner-only set-primary action; 301 redirect middleware at Rack layer; system emails embed primary domain — v1.6 Phases 22/23/24
- ✓ DPRD-01–06: Pro downgrade freezes all custom domains; frozen domains redirect to subdomain; subdomain auto-promoted to primary; frozen badge + upgrade CTA; owner email notification; re-upgrade restores frozen domains — v1.6 Phases 22/23/24

### Active (v1.7+)

*(To be defined via `/gsd-new-milestone`)*

- [ ] Rethink listing access model — BrokerageEstate vs board credential JOIN (architecture carry-over)
- [ ] S3 favicon upload outside transaction (CR-02, pre-existing, carry to v1.7)
- [ ] Brokerage switch preserving active tab position (UX deferred at v1.4 close)
- [ ] Deep-link into admin panel with brokerage context preserved (UX deferred at v1.4 close)

### Out of Scope

- Apple / Microsoft social login — only Google OAuth; separate auth milestone when demand warrants
- JWT → HttpOnly cookies migration — architectural change requiring significant backend/frontend coordination; separate security milestone
- Redux → Context migration — 3 slices, low-risk but high churn; separate cleanup milestone
- SCSS → Tailwind migration — incremental only; do not migrate proactively
- Admin directory restructure (`adminBoard/` vs `view/admin/`) — separate refactor milestone
- TanStack Query v4 → v5 upgrade — breaking API changes; separate upgrade milestone
- `ActivityQuery` SQL UNION optimization — acceptable at current scale
- `User#current_brokerage_membership` job-context fix — low impact; documented constraint
- Multi-domain round-robin / load balancing — not needed at current scale; future milestone
- Server-side 301 at the Caddy/proxy layer — Rack middleware satisfies the requirement; proxy-layer is a future infrastructure milestone
- Deeper conflict resolution for simultaneous domain claims — first-to-verify sufficient

---

## Context

- **Stack:** Ruby 4.0.2 / Rails 7.1 JSON API + Vite/React 18 SPA. Monorepo with `backend/` and `frontend/` as separate git repos.
- **Auth:** AWS Cognito + Amplify for identity; custom HS256 JWT (`TokenService`) issued on sign-in, stored in `localStorage`. Google OAuth federated identity via Cognito + PreSignUp Lambda. `CognitoAuth` concern verifies per-request.
- **Multi-tenancy:** `BrokerageAuth` concern resolves `Current.brokerage` from Host header (subdomain path) or `X-Brokerage-Id` header (main-domain path). All queries must scope to `Current.brokerage`.
- **Main domain portal:** `/dashboard/*` and `/create/*` routes coexist on the main domain. `LoginSuccessful` + `Login.tsx` both perform domain-aware post-sign-in routing. `activeBrokerage` Redux slice stores the active portal brokerage context. `AdminDomainShell` delegates to `PortalAdminShell` (main domain) or `AppShellAdmin` (subdomain) based on `isMainDomain()`.
- **Domain management:** `BrokerageDomain` with string enum status (`active`, `phasing_out`, `decommissioned`, `pending`, `frozen`), `PHASE_OUT_DURATION = 30.days`, `HEALTH_CHECK_INTERVAL = 30.minutes`. `DomainVerificationJob` + `DomainHealthJob` run every 30 minutes via SolidQueue recurring jobs. `DomainRedirectMiddleware` at Rack layer handles 301 redirects from non-primary domains. `Ops::PlanController` handles Pro downgrade/upgrade via `freeze_custom_domains!`/`unfreeze_custom_domains!`. Domain list UI uses role-gated `DomainCard` + 4-step `AddDomainWizard`.
- **Soft deletes:** `acts_as_paranoid` on all user-facing models. Every query must call `.without_deleted`; joins require explicit `where(table: { deleted_at: nil })`. Note: `BrokerageDomain` does NOT include `acts_as_paranoid` — plain status scopes are correct.
- **Test suite:** Backend: Minitest 6.0.3 (Ruby 4.0.0) — `Minitest::Mock` and `.stub` removed; use `FakeJob` subclass pattern for DNS/job testing. Frontend: Vitest 4.x + MSW 2.x.
- **Calendar sync:** `UserCalendarConnection` (encrypted credentials) + `EstateDateCalendarEvent` + `CalendarSyncJob` (SolidQueue, advisory lock). Google adapter active; Microsoft (HTTParty/Graph API) and Apple (CalDAV via calendav) adapters built but inactive — activate by expanding `PROVIDERS` constant.
- **Map:** Mapbox GL JS (`react-map-gl/mapbox`). `VITE_MAPBOX_TOKEN` required in frontend env. `GeocodingService` calls Nominatim (`NOMINATIM_USER_AGENT` required in backend env). `geocode:backfill` rake task backfills existing listings.
- **Background jobs:** SolidQueue (DB-backed, no Redis). Recurring jobs defined in `recurring.yml`. Migrations must be applied on Render.com via `rails db:migrate`.
- **Board management:** TEST board (`is_test_board: true`) is the only seeded board; connecting auto-inserts `BrokerageEstate` rows; test boards bypass RETS validation.
- **Shipped v1.3:** 2026-05-24 | **Shipped v1.4:** 2026-05-27 | **Shipped v1.5:** 2026-05-29 | **Shipped v1.6:** 2026-05-31

---

## Constraints

- **Tech Stack:** Must use existing Rails + React stack; no new backend framework introductions
- **Auth Provider:** Google OAuth must integrate via Cognito federated identity to maintain single token issuance point
- **Calendar APIs:** Google Calendar (REST), Apple Calendar (CalDAV), Microsoft (Graph API) — each requires per-user OAuth tokens stored server-side
- **Soft Deletes:** Every new query must call `.without_deleted`; joined models must add explicit `deleted_at: nil` where clauses. `BrokerageDomain` is paranoid-free — use plain status scopes.
- **Serializer N+1:** New collection endpoints must bulk-compute per-record data in the controller; serializers must never query per-record
- **Testing:** Backend uses Minitest 6.0.3 (Ruby 4.0.0); no `Minitest::Mock` or `.stub` — use `FakeJob` subclass pattern. Frontend uses `@testing-library/react`.
- **Middleware registration:** Middleware loaded at boot time before Zeitwerk must use `require_relative` in `application.rb`, not rely on autoload

---

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
| `MainDomainOnly` concern — duplicate Origin extraction vs shared helper | Separate concerns have different semantics; sharing couples orthogonal security boundaries | ✓ Good — duplication is deliberate |
| Frontend guards are UX-only; backend 403 is the real security boundary | JavaScript guards can be bypassed; API layer is the trust boundary | ✓ Good — Phase 7 closes the gap with a proper server-side check |
| Mapbox GL instead of Google Maps for map panels | Phase 9 CONTEXT.md established Mapbox as project standard | ✓ Good — consistent across group dashboard map and listing detail map |
| `hasFitBoundsRef` guard — fitBounds only on initial load | Without guard, every filter change re-centers the map, disrupting user pan/zoom state | ✓ Good — UX stays stable across filter interactions |
| Controlled AlertDialog for delete (outside Radix tree) | AlertDialogTrigger inside DropdownMenuItem causes portal/focus conflicts | ✓ Good — delete flow works reliably with `deleteTarget` state pointer |
| `main_domain_request?` reuses `extract_domain_from_request` | No URI.parse duplication — single source of truth for host extraction | ✓ Good — consistent domain detection across BrokerageAuth and MainDomainOnly |
| `AdminBrokeragesController` excludes BrokerageAuth | Cross-brokerage endpoint by design; no single brokerage context applies | ✓ Good — MainDomainOnly + CognitoAuth only |
| `useFetchAdminBrokerages` is imperative (not useQuery) | `LoginSuccessful` is a fire-once lifecycle component that navigates away on completion | ✓ Good — satisfies CLAUDE.md "through a hook" rule without TanStack overhead |
| `setToken` before `fetchAdminBrokerages` in sign-in flows | Axios interceptor reads `localStorage auth_token`; reversed order causes 401 | ✓ Good — critical ordering constraint for both LoginSuccessful and Login.tsx |
| `Login.tsx` deviation catch — email/password bypasses `LoginSuccessful` | `CreateAccount` → `signIn.ts` → `onAuthenticated()` never mounts `LoginSuccessful`; must extend both sign-in paths | ✓ Good — both paths now perform domain-aware routing |
| `phase_out!` sets 30-day window; max 2 phasing-out per type | Soft transition window; bounded number prevents unbounded lock-out | ✓ Good — slot block enforced at controller level |
| `PrimaryDomainRedirect` uses `window.location.replace` | Back-button to phasing-out domain creates redirect loop; replace() prevents history entry | ✓ Good |
| `lookupDomain` uses BASE axios (no auth token) | Public endpoint is unauthenticated by design | ✓ Good |
| `AdminDomainShell` single-route delegation | One route definition avoids React Router path conflicts from domain-guarded duplicate /admin/ blocks | ✓ Good |
| `RequireRole` isMainDomain() bypass before isUserLoaded check | `account.id` never populated on main domain; isUserLoaded always false | ✓ Good |
| `PHASE_OUT_DURATION` constant at model class level | Visible, centralized, used by `phase_out!` instead of inline 30.days | ✓ Good |
| `pending`/`frozen` enum values require no migration | String enum in Rails — adding values to the hash is model-only, no ALTER TYPE needed | ✓ Good |
| `DomainRedirectMiddleware` uses `insert_before ActionDispatch::Static` | Places after Rack::Cors (position 2) so CORS OPTIONS requests are handled before redirect logic | ✓ Good |
| In-memory `.find` on `.includes()` collection for primary lookup | Avoids second AR query per redirected request — eager-loaded collection handles N+1 in hot path | ✓ Good |
| `unfreeze_custom_domains!` uses `verified` flag to determine restore target | `verified:true → active`, `verified:false → pending`; avoids tracking pre-freeze status separately | ✓ Good |
| `alias_method :create, :update` in `Ops::PlanController` | Enables POST alongside PATCH/PUT for JSON ops endpoint without duplicate action code | ✓ Good |
| `verify` action uses synchronous `dns_resolves?` inline | Frontend `useVerifyDomain` expects direct `{ verified }` response; mirrors onboarding verify pattern | ✓ Good |
| `FakeJob` subclass for DNS testing in Minitest 6 | Minitest 6.0.3 (Ruby 4.0.0) removed `Minitest::Mock` and `.stub` — test subclass overrides `cname_resolves_to_subdomain?` directly | ✓ Good — canonical pattern for this codebase |
| `useVerifyDomain` uses `onMutate` snapshot for rescue detection | Captures previousStatus before mutation fires; avoids relying solely on response data | ✓ Good |
| `DomainCard` drives verify spinner from `actions.verifyingDomainId` (not hook) | Component → Context → Hook pattern; card holds no network state per CLAUDE.md | ✓ Good |
| Pending domain destroy: immediate decommission, no phase-out | Pending domains have no live traffic — slot checks and phase-out period do not apply | ✓ Good |
| `require_relative` in application.rb for `DomainRedirectMiddleware` | Zeitwerk autoload not yet active when application.rb runs — class must be resolvable at middleware registration time | ✓ Good |

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-05-31 — v1.6 complete (Domain Management v2 shipped)*
