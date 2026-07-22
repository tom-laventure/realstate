# RealState SaaS Platform

## Last Shipped: v1.12 — Plan Tiers & Gating (2026-07-22)

## Current Milestone: Planning next milestone

See `.planning/PLAN-TIERS.md` for v1.12's full design rationale and Key Decisions.

---

## What This Is

A multi-tenant real estate SaaS platform serving brokerages via domain-based isolation. Brokerages manage property listings, organize agents into groups, and collaborate through shared tools: comments, documents, ratings, tags, and calendar dates. The platform has a hardened security posture, Google social login, working onboarding flows, personal Google calendar sync, a backend + frontend test suite, geographic map views of listings via Mapbox GL, a main-domain admin portal with brokerage switcher and enriched per-brokerage selection cards (client count, member count, owner names), unified SaaS branding across both main-domain navbars (`DashboardNavBar` + updated `PortalNavBar`), a complete domain management system (lifecycle-tracked subdomains and custom domains, DNS verification, 301 redirect enforcement, Pro-downgrade freeze/restore), a cleanly separated Board Registrations admin UI at `/admin/boards` distinct from the Brokerage admin page, correct root-route behavior ensuring unauthenticated users always land on the login page regardless of domain, and a three-tier admin RBAC model (`owner`/`admin`/`agent`) giving the `agent` role full read-only visibility across the entire admin dashboard plus full read/write on Groups, with every mutation control and data fetch outside Groups scope correctly gated at both the frontend and backend layers. Ownership changes (promote to owner, demote/remove an owner) are now a fully owner-gated, backend-enforced API surface (`Admin::Settings::OwnersController`) separate from the generic user-management endpoints, closing the prior admin-takeover gap. A dedicated `/admin/settings` Ownership Management section gives owners a full add/remove-owner UI: a Current Owners list, a two-step Add Owner modal, and a matching three-step Remove Owner flow with a last-owner guard and self-demotion handling on both the subdomain and portal login paths. The platform now enforces a three-tier plan model (`free`/`independent`/`growth`) end to end: Free-tier brokerages are walled to the TEST board with no client invites, custom domain, or calendar sync (Phase 37), a full upgrade/downgrade lifecycle safely moves brokerages between tiers — Free → paid silently purges disposable TEST-board demo data, paid → Free freezes the custom domain and soft-suspends real board credentials and client memberships (fully preserved, not deleted), and re-upgrading automatically restores exactly what that downgrade suspended (Phase 38) — and switching between paid tiers (Independent ↔ Growth) is a pure billing event: an append-only `PlanBillingSnapshot` audit trail records the recalculated price on every paid-to-paid transition, with zero data purged, frozen, or disconnected (Phase 39).

## Core Value

Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.

---

## Requirements

### Active

(None yet — planning next milestone)

### Validated (v1.12 — Phases 36-39: Plan Tiers & Gating)

- ✓ PLAN-01: `Brokerage#plan` migrated from binary `basic`/`premium` to three-tier `free`/`independent`/`growth` — v1.12 Phase 36
- ✓ PLAN-02: Centralized `AppConstants::PLAN_TIERS` config — seat caps, prices, overage rates in one file, no duplication — v1.12 Phase 36
- ✓ PLAN-03: Config structured so a tier's price/seat-cap/overage change is a one-file edit — v1.12 Phase 36
- ✓ PLAN-04: Free-tier board-connect flow only offers the seeded TEST board — v1.12 Phase 37
- ✓ PLAN-05: Free-tier client-invite endpoints reject the request regardless of caller role — v1.12 Phase 37
- ✓ PLAN-06: Free-tier agent/staff seats are uncapped — v1.12 Phase 37
- ✓ PLAN-07: Free-tier has no calendar sync entry point in UI or API — v1.12 Phase 37
- ✓ PLAN-08: Free-tier restricted to subdomain, no custom domain — v1.12 Phase 37
- ✓ PLAN-09: Groups/comments/ratings/likes/documents/RSVP/filter-sets work identically on Free against TEST-board data — v1.12 Phase 37
- ✓ PLAN-10: Independent plan — $20/mo, 1 seat, $20/seat overage — v1.12 Phase 36
- ✓ PLAN-11: Growth plan — $79/mo, 5 seats, $16/seat overage — v1.12 Phase 36
- ✓ PLAN-12: Independent/Growth unrestricted — unlimited real boards, clients, custom domain, calendar sync — v1.12 Phase 37
- ✓ PLAN-13: 15% annual discount on Independent/Growth base price (overage excluded) — v1.12 Phase 36
- ✓ PLAN-14: Free → paid upgrade silently purges TEST-board-linked demo data — v1.12 Phase 38
- ✓ PLAN-15: Paid → Free downgrade freezes the custom domain — v1.12 Phase 38
- ✓ PLAN-16: Paid → Free downgrade soft-disconnects real board credentials (preserved, marked suspended) — v1.12 Phase 38
- ✓ PLAN-17: Paid → Free downgrade suspends client memberships (preserved, not deleted) — v1.12 Phase 38
- ✓ PLAN-18: Re-upgrade restores exactly the credentials/memberships suspended by that downgrade event — v1.12 Phase 38
- ✓ PLAN-19: Paid ↔ paid transitions are a pure billing recalculation, persisted as an append-only `PlanBillingSnapshot` — v1.12 Phase 39

### Validated (v1.11 — Phases 34-35: Ownership Management UI)

- ✓ SET-01: `/admin/settings` page with Ownership Management as the first functional section; Billing stubbed as a `# TODO` — v1.11 Phase 34
- ✓ SET-02: Owners get full Ownership Management access; admins/agents read-only; clients no access — v1.11 Phase 34
- ✓ OWN-01: Current Owners section lists all brokerage owners (name + email) — v1.11 Phase 34
- ✓ OWN-02: Add Owner action visible to owners only — v1.11 Phase 34
- ✓ OWN-03: Add Owner modal with searchable admin/agent dropdown — v1.11 Phase 34
- ✓ OWN-04: Add Owner modal displays warning copy before confirm — v1.11 Phase 34
- ✓ OWN-05: Confirming Add Owner promotes via API, invalidates owners query key — v1.11 Phase 34
- ✓ OWN-06: Each owner entry has a Remove action, visible to owners only — v1.11 Phase 35
- ✓ OWN-07: Remove Owner three-step modal (warning → role picker defaulting to admin → review/confirm) — v1.11 Phase 35
- ✓ OWN-08: Confirming demote calls the API, invalidates owners query key — v1.11 Phase 35
- ✓ OWN-09: Self-demotion allowed while ≥1 other owner remains, Redux session patched without reload — v1.11 Phase 35
- ✓ OWN-10: Last-owner Remove button disabled with explanatory tooltip — v1.11 Phase 35
- ✓ OWN-13: Add Owner modal gains a matching final review step (brings it in line with Remove Owner's pattern) — v1.11 Phase 35

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
- ✓ RBAC-01: Backend enforces agent access on all group-scoped endpoints — v1.10 Phase 30
- ✓ RBAC-02: Backend enforces read-only agent access on Users/Brokerage/Boards/Domains/Settings read endpoints — v1.10 Phase 30
- ✓ RBAC-03: Backend rejects agent (403) on all write endpoints outside Groups scope — v1.10 Phase 30
- ✓ ACCESS-01: Agent role can access the admin dashboard shell — v1.10 Phase 31 (route-level gating added so nav-hiding isn't the only enforcement — see 31-REVIEW.md CR-01)
- ✓ GROUP-01: Agent has full CRUD on groups — v1.10 Phase 31
- ✓ GROUP-02: Agent can add existing brokerage users to a group — v1.10 Phase 31
- ✓ GROUP-03: Agent can invite new (unregistered) clients to a group via email — v1.10 Phase 31
- ✓ GROUP-04: Agent can manage group filter sets — v1.10 Phase 31
- ✓ GROUP-05: Agent can manage listings within a group — v1.10 Phase 31
- ✓ ACCESS-02: Agent has read-only access to the Users list and user detail view — v1.10 Phase 32
- ✓ ACCESS-03: Agent has read-only access to Brokerage settings (info, branding, board registrations) — v1.10 Phase 32
- ✓ ACCESS-04: Agent has read-only access to Boards and board credentials — v1.10 Phase 32
- ✓ ACCESS-05: Agent has read-only access to Domains — v1.10 Phase 32
- ✓ ACCESS-06: Agent has read-only access to the brokerage Settings page — v1.10 Phase 32
- ✓ ACCESS-07: Agent is fully blocked from brokerage-level staff/agent invitations — v1.10 Phase 32 (render gate + fetch gate; gap-closed via 32-04 after UAT)
- ✓ ACCESS-08: Domain-mutation buttons gated by `manage_brokerage_settings` only — v1.10 Phase 32
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

### Validated (v1.9 — Phases 27–29: Dashboard & Navbar Enhancement — SHIPPED 2026-06-06) ✅

- ✓ DASH-03: `/dashboard` BrokerageSelection page uses full-width layout with `max-w-7xl` container and responsive `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` card grid — no narrow `max-w-sm` centered panel in main render path — v1.9 Phase 28
- ✓ DASH-04: Each brokerage card (BrokerageCard.tsx) surfaces: name (`text-xl font-semibold`), role badge (`secondary` variant, capitalized), stats line (`clientCount clients · memberCount members`), and conditional owners row (omitted entirely when empty) — v1.9 Phase 28
- ✓ DASH-05: `/dashboard` has a dedicated `DashboardNavBar` with guarded brand logo (left) + account dropdown (Account Settings → `/account`, Sign Out) — no brokerage selector, role badge, or notifications bell — v1.9 Phase 29
- ✓ DASH-06: `PortalNavBar` shows the brand logo as a clickable `<button>` (→ `/dashboard`) immediately to the left of the brokerage selector dropdown; per-brokerage trigger logo removed — v1.9 Phase 29
- ✓ DASH-07: `VITE_BRAND_LOGO_URL` is the single env-var source for the brand logo in both navbars (`DashboardNavBar`, `PortalNavBar`); declared blank in `frontend/.env.example`; conditional guard hides logo gracefully when absent — v1.9 Phase 29

### Validated (v1.8 — Root Route Fix)

- ✓ ROUTE-01: `SubdomainOnly` (DomainGuard.tsx) redirects main domain `/` → `/dashboard` → `/auth/login` for unauthenticated users — v1.8
- ✓ ROUTE-02: `PrimaryDomainRedirect` skips async `lookupDomain()` call for unauthenticated users, routing them immediately to `/auth/login` — v1.8

### Validated (v1.7 — Board Registrations Nav Separation)

- ✓ NAV-01: New `/admin/boards` route with `BoardsAdminBoard` container and boards-only context — v1.7
- ✓ NAV-02: Subdomain admin sidebar (`SideNav.tsx`) shows "Board Registrations" between "Brokerage" and "Users" — v1.7
- ✓ NAV-03: Portal admin sidebar (`PortalAdminSideNav`) shows correctly-labeled "Brokerage" then "Board Registrations" before "Users" — v1.7
- ✓ NAV-04: `/admin/brokerage` shows Brokerage Information and Branding only — v1.7
- ✓ NAV-05: `/admin/boards` shows Realtor Board Registrations table with connect/edit/delete — v1.7
- ✓ NAV-06: `useBoardsAdminContext` owns board credential fetches/mutations; zero brokerage dependency — v1.7
- ✓ NAV-07: `BrokerageAdminBoardContext` exports only brokerage state/actions — v1.7

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

### Validated (v1.11 — Phase 33: Backend Owner API & Endpoint Lockdown)

- ✓ LOCK-01: `POST /v1/admin/invitations` rejects `role: "owner"` (403) for any caller — v1.11 Phase 33
- ✓ LOCK-02: `owner` removed from the `/admin/brokerage/add-agent` role selector (frontend, defense-in-depth) — v1.11 Phase 33
- ✓ API-01: `GET /v1/admin/settings/owners` returns current owners (name + email), readable by agent+ — v1.11 Phase 33
- ✓ API-02: `GET /v1/admin/settings/owners/eligible` returns admin/agent members eligible for promotion — v1.11 Phase 33
- ✓ API-03: `POST /v1/admin/settings/owners` promotes an eligible member to owner, owner-only caller, server-side re-validation of target's current role — v1.11 Phase 33
- ✓ API-04: `PATCH /v1/admin/settings/owners/:id` demotes an owner, owner-only caller, rejects removing the brokerage's last owner — v1.11 Phase 33
- ✓ API-05: All owner-role mutations enforced server-side via DB-backed `current_membership` (never a JWT role claim) — v1.11 Phase 33

## Deferred to v1.13+

- [ ] Rethink listing access model — BrokerageEstate vs board credential JOIN (architecture carry-over from v1.6, still unaddressed after v1.12)
- [ ] S3 favicon upload outside transaction (CR-02, pre-existing from v1.1)
- [ ] Brokerage switch preserving active tab position (UX deferred at v1.4 close)
- [ ] Deep-link into admin panel with brokerage context preserved (UX deferred at v1.4 close)
- [ ] `useUsersAdminContext.tsx`'s `useMemo` missing `groupsQuery`/`invitationsQuery`/`inviteFilter` deps (32-04-REVIEW.md WR-01; currently safe by accident, adjacent to the new invitations-fetch gating logic)
- [ ] Invitations-gating hook test coverage gap: only `agent`/`admin` roles tested; missing `owner`, `staff`/`client`, and the "role not yet loaded" transient state (32-04-REVIEW.md IN-02)
- [ ] Audit log of ownership changes — who promoted/demoted whom, when (OWN-11, deferred at v1.11 close)
- [ ] Email notifications on ownership role change (OWN-12, deferred at v1.11 close)
- [ ] Full Billing management section on `/admin/settings` — payment processor integration, checkout flow, invoicing (BILL-01, stubbed as TODO placeholder since v1.11; v1.12 shipped the plan structure/gating rules only)
- [ ] Higher-seat tier(s) above Growth (PLAN-20, deferred at v1.12 close — revisit once Growth-tier brokerages consistently outgrow 5 seats)
- [ ] Plan config: code constant → DB-backed model (PLAN-21, deferred at v1.12 close — only if tweak frequency ends up requiring runtime edits without a deploy)

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
- Payment processor integration (Stripe, etc.) — separate scope from plan structure/gating, tracked under BILL-01
- MLS/RETS board count caps per paid tier — decided against; no cap on real board connections for Independent or Growth
- Per-tier calendar provider differentiation — only Google Calendar sync is live; Microsoft/Apple adapters (when activated) apply uniformly to all paid tiers
- Time-boxed trial of paid features — Free tier fills this role permanently, no separate trial mechanism
- Auto-purge of real data on paid → Free downgrade — real board/client data is frozen and restorable, never deleted, unlike Free → paid's demo-data purge

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
- **Admin RBAC:** Three-tier model — `require_owner!` / `require_admin!` / `require_agent_or_above!` (backend, `Admin::BaseController` concern) and `readTierRoles` / `ownerAdminOnly` (frontend, `RequireRole` route helpers). `agent` gets full read access across all 6 admin sections + full read/write on Groups; every other write path stays `owner`/`admin` only. Permission-gated data fetches (not just JSX) must be gated via `{ enabled }` options args driven by `usePermission`, per the ACCESS-07 pattern established in v1.10 Phase 32.
- **Ownership management:** `V1::Admin::Settings::OwnersController` (list/eligible/promote/demote) is the sole owner-role-change surface; the generic `UsersController#update`/`#destroy` reject any owner-touching transition (D-02). Frontend: `/admin/settings` Ownership Management section — `useSettingsAdminContext` Brain owns `useDemoteOwner`/`usePromoteOwner`, `currentUserId` (via unconditional `useGetCurrentUser()`), and the self-demote Redux patch. Both Add/Remove Owner dialogs are always-mounted and reset wizard state via a `useEffect` on `open` (not just on close).
- **Plan tiers:** `AppConstants::PLAN_TIERS` (`backend/app/constants/plan_tiers.rb`, explicitly required in `constants.rb` alongside `roles.rb`) is the single source of truth for seat caps, prices, and overage rates across `free`/`independent`/`growth`; `Brokerage#plan_config` (`.fetch(plan)`, no fallback — fails loud on an unrecognized value) is the model-level accessor, mirrored on the frontend by `hasPlanCapability`. `ApplyPlanTransitionJob` dispatches all three transition branches from one async job triggered by `Ops::PlanController#update`: Free→paid purges TEST-board data via `TestBoardPurgeService`, paid→Free freezes the domain and suspends board credentials/client memberships (all scoped to a single `plan_downgraded_at`/`frozen_at` event stamp so re-upgrade restores only that event's rows, per D-06), and paid↔paid persists an append-only `PlanBillingSnapshot` via `recalculate_billing!` (config always keyed by `new_plan`, overage clamped at 0, guarded against no-op and superseded/out-of-order transitions). `Brokerage#billable_seat_count` mirrors the `member_roles = %w[agent staff owner admin]` rule from `admin_brokerages_controller.rb` (excludes `client` and soft-deleted rows).
- **Shipped v1.3:** 2026-05-24 | **Shipped v1.4:** 2026-05-27 | **Shipped v1.5:** 2026-05-29 | **Shipped v1.6:** 2026-05-31 | **Shipped v1.7:** 2026-05-31 | **Shipped v1.8:** 2026-06-04 | **Shipped v1.9:** 2026-06-06 | **Shipped v1.10:** 2026-07-10 | **Shipped v1.11:** 2026-07-13 | **Shipped v1.12:** 2026-07-22

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
| `useBoardsAdminContext` is strict subset of `BrokerageAdminBoardContext` (not a refactor) | Extracts only board credential slice; brokerage context remains independent | ✓ Good — NAV-06 satisfied without coupling |
| NAV-02 fix targets `SideNav.tsx` not `AdminBoardSideNav` | `AdminBoardSideNav` was never mounted; `SideNav.tsx` is the actual subdomain admin sidebar | ✓ Good — audit caught this before milestone close |
| `BoardRegistrations` component preserved (not deleted in Plan 02) | Reused by `/admin/boards` (Plan 01); deletion would break the new boards page | ✓ Good — component reuse across two containers |
| ROUTE-01 fix targets `SubdomainOnly` (DomainGuard.tsx), not an index route in `MainDomainOnly` | `dashboard` route at `path: '/'` in Block 1 always wins over Block 2 due to React Router array-order tiebreaker — any index in `MainDomainOnly` is dead code | ✓ Good — code review caught dead-code approach before execution |
| `isAuthenticated()` guard added alongside `isMainDomain()` in `PrimaryDomainRedirect` | Unauthenticated users have no domain context; skipping `lookupDomain()` removes blank-screen flash and unnecessary API call | ✓ Good — both guards in same early-return expression |
| Inline hash derivation (no serializer) in `AdminBrokeragesController#index` — v1.9 | Payload is small; dedicated serializer adds overhead without benefit | ✓ Good — fast, local, no abstraction cost |
| `AdminBrokerage` TypeScript fields required (no `?`) — v1.9 | Endpoint always returns all three; optional would propagate nullish checks to all consumers | ✓ Good — propagates type-safety automatically |
| Button-as-card pattern for `BrokerageCard` — v1.9 | Applying card classes to `<button>` avoids invalid nesting (div > button, button > Card) while ensuring full-card keyboard interactivity | ✓ Good — accessible and HTML-valid |
| `DashboardNavBar` as standalone component (not `NavBar.tsx` with props) — v1.9 | Avoids importing notifications bell and auth hooks irrelevant to selection screen | ✓ Good — minimal surface, zero dead code |
| Plain `<button>` (not shadcn `Button`) for brand logo in `PortalNavBar` — v1.9 | `Button variant=ghost` adds horizontal padding that distorts logo proportions | ✓ Good — pixel-accurate logo sizing |
| Three-tier backend authorization: `require_agent_or_above!` widens the default, narrower `require_admin!`/`require_owner!` stack on top for write-only controllers — v1.10 | Matches existing `Admin::BaseController` concern pattern; avoids per-action allow-lists | ✓ Good — all 13 admin controllers correctly tiered, 62-assertion matrix proves it |
| Reused existing 4-permission model instead of new granular permissions — v1.10 | `access_admin_panel`/`manage_brokerage_settings`/`manage_users`/`manage_groups` + shell-level role gate already produce the desired read/write split | ✓ Good — zero new permission types needed |
| Brokerage-level staff invitations blocked entirely (no partial read-only view) — v1.10 | No UI exists for read-only invitation viewing outside the creation form itself | ✓ Good — matches ACCESS-07 exactly |
| Gate the fetch, not just the render, for permission-scoped data hooks — v1.10 Phase 32 | A `<Can>` JSX gate cannot stop an ancestor context hook's `useQuery` from firing; discovered via human UAT after 32-03 shipped render-gate-only | ✓ Good — `{ enabled }` options arg mirroring `useFetchActivityFeed` convention closes the gap at the hook boundary; reusable pattern for future permission-gated fetches |
| Owner-role enforcement via DB-backed `current_membership`, not JWT `role` claim — v1.11 Phase 33 | The JWT's role claim can go stale for up to 24h (`TokenService::EXPIRY_DURATION`); a demoted owner could otherwise retain owner privileges until token expiry | ✓ Good — `Admin::BaseController#current_membership` already re-queried the DB fresh per request; all new/edited endpoints correctly rely on it exclusively |
| All owner-role changes centralized in `Settings::OwnersController` (generic `users#update` value-rejects `role: "owner"` in both directions) — v1.11 Phase 33 | The only place carrying the last-owner invariant; letting the generic endpoint also assign/demote owner would let it bypass that guard | ✓ Good — closes the CR-02/CR-03 admin-takeover chain at its root instead of patching each bypass path individually |
| Gate the fetch, not just the render, for permission-scoped owner-list data — v1.11 Phase 34 | Reuses the `{ enabled }` options-arg pattern established in v1.10 Phase 32 (ACCESS-07 gap) | ✓ Good — reusable pattern held up across two milestones |
| `useGetCurrentUser()` called unconditionally in `useSettingsAdminContext` — v1.11 Phase 35 | `account.id` was only reliably populated on the subdomain login path; the portal/main-domain path left it empty, breaking self-demotion detection. Dedupes against the existing `['getCurrentUser']` query, so it's a cache hit where already fetched | ✓ Good — closes a traced pitfall (35-RESEARCH.md) before it could ship broken |
| Self-demote Redux patch (`updateUser`/`setActiveBrokerage`) applied directly from the trusted server response, no network round-trip — v1.11 Phase 35 | Avoids a stale-permission UX window between demote confirm and next page load; server response is already the source of truth | ✓ Good — UI updates immediately with no reload |
| Dialog wizard state reset via `useEffect` on `open` transitioning true (not only on close) — v1.11 Phase 35 (35-REVIEW.md CR-01/CR-02) | Both Remove/Add Owner dialogs are always-mounted; the parent closes them by flipping the controlled `open` prop directly on success, which never fires Radix's `onOpenChange` — resetting only in the dialog's own close handler left stale wizard state to resurface on the next open | ✓ Good — caught by code review before milestone close, fixed for both dialogs |
| Role picker in Remove Owner defaults to Admin, no forced explicit selection — v1.11 Phase 35 (35-CONTEXT.md D-03) | Deliberate, locked UX decision — surfacing all three role options at once (not a dropdown) already makes the choice visible; code review's suggestion to require explicit selection was reverted after cross-checking this decision | ✓ Good — a reminder to check locked CONTEXT.md decisions before applying review suggestions that change behavior |
| Money stored as integer cents, not float dollars — v1.12 Phase 36 | Standard Ruby money practice; Phase 39's billing recalc consumes `base_price_cents`/`overage_price_cents` directly, no float rounding surface | ✓ Good |
| `plan_config`/`PLAN_TIERS.fetch` with no fallback block — v1.12 Phase 36 (D-07) | An unrecognized plan value should raise `KeyError` loudly, not silently degrade to Free's all-false capability set | ✓ Good |
| `plan_tiers.rb` explicitly `require_relative`'d in `constants.rb` alongside `roles.rb` — v1.12 Phase 36 | `AppConstants` stopped being Zeitwerk-managed once the first file defined the module via `require_relative`; a sibling file would never autoload without the same explicit require | ✓ Good — same class of pitfall as the `DomainRedirectMiddleware` require, now a documented pattern for this codebase |
| Plan enum backfill via raw SQL, not `Brokerage.update_all` — v1.12 Phase 36 | `acts_as_paranoid`'s default scope would skip soft-deleted rows on a plain `update_all`, leaving them on the stale `basic`/`premium` values | ✓ Good |
| Gate the fetch, not just the render, for permission-scoped plan-capability data — v1.12 Phase 37 | Reuses the `{ enabled }` options-arg pattern from v1.10 Phase 32 / v1.11 Phase 34 — third milestone this exact pattern has held up | ✓ Good — now a load-bearing project-wide convention, not phase-specific |
| Calendar access gated by account-wide `any_paid_brokerage_membership?`, never `hasPlanCapability`/`brokerage.plan` — v1.12 Phase 37 (D-06) | Calendar sync is user-scoped and cross-brokerage; gating it by the currently-resolved brokerage's plan would be wrong the moment a user belongs to more than one brokerage | ✓ Good |
| `plan_downgraded_at` stored as an explicit event-marker column, not derived via `MAX(suspended_at)` — v1.12 Phase 38 (D-06) | Single source of truth lets `restore!`/`unfreeze_custom_domains!` scope strictly to rows suspended/frozen by *this* downgrade event, never reactivating an unrelated earlier suspension | ✓ Good — the same scoping gap (missing on `unfreeze_custom_domains!` at ship time) was caught and fixed by Phase 39's code review, see below |
| Re-upgrade does not restore custom-domain `is_primary` — v1.12 Phase 38 | Deliberately out of scope; owner must manually reassign primary domain after a downgrade/re-upgrade cycle | ✓ Good — documented in code, not silently dropped |
| `plan_billing_snapshots` has no `deleted_at`/`acts_as_paranoid` — v1.12 Phase 39 | Deliberate deviation from the codebase-wide soft-delete convention; append-only billing audit trail matches the `EstateDateCalendarEvent` no-soft-delete precedent | ✓ Good |
| `recalculate_billing!` fetches `PLAN_TIERS` strictly by `new_plan`, never `old_plan` — v1.12 Phase 39 | Prevents a stale-tier billing bug where a transition would price using the brokerage's previous plan | ✓ Good |
| Post-ship code review found and fixed 2 critical bugs predating Phase 39 (`downgrade!` non-idempotent against job retry; `unfreeze_custom_domains!` missing event-scoping) — v1.12 Phase 39 close | Both bugs were reachable via existing Phase 38 code paths (job retries, unrelated domain freezes) but only surfaced when Phase 39's review re-examined the whole transition job; fixed same-day with regression tests rather than deferred | ✓ Good — a reminder that "phase complete" doesn't mean "surrounding code is bug-free"; code review scope should follow the file, not just the diff |

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

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

*Last updated: 2026-07-22 after v1.12 (Plan Tiers & Gating) milestone close*
