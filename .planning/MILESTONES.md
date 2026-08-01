# Milestones

## v1.14 Marketing Landing Site (Shipped: 2026-08-01)

**Phases completed:** 5 phases, 15 plans, 37 tasks

**Key accomplishments:**

- Astro 7.1.6 + Tailwind v4.3.3 (via @tailwindcss/vite) project skeleton scaffolded at `landing/`, independently buildable from its own lockfile with zero coupling to `frontend/`/`backend/`.
- landing/ now renders a Slate-styled placeholder page through a shared BaseLayout.astro shell, with the fully-merged Slate design tokens statically copied from frontend/ and a complete, independent Vercel deploy config.
- All four Phase 42 ROADMAP success criteria confirmed true via automated dev-server/build/git-tracking assertions plus human-approved visual confirmation that the Slate palette (dark slate-blue primary/sidebar, off-white background) renders correctly with a clean browser console — closing Phase 42 with zero open defects.
- Installed `@lucide/astro`, centralized all CTA/legal URLs in `consts.ts`, added an optional `noindex` prop to `BaseLayout.astro`, and built `SiteHeader`/`SiteFooter` shared chrome components — all wired to the single-source-of-truth constants.
- Built the four home-page content sections (Hero, ValueProp, FeatureGrid, ClosingCTA) and composed them into the real `/` marketing page, replacing Phase 42's proof-of-tokens scaffold — verified 1 h1 / 3 h2 / 0 h3, zero client JS, and exactly 4 Get Started + 2 Log in absolute-HTTPS touchpoints in the built HTML.
- Placeholder `/privacy` (13 sections) and `/terms` (14 sections) routes with a shared `LegalNotice` pending-review banner, `noindex` robots meta, and zero hardcoded pricing facts on the Terms page.
- Zero-defect goal-backward gate: full production build, whole-site dead-link/design-contract/accessibility sweep, and human-approved live click-through — no source fixes needed, phase closed clean.
- @astrojs/sitemap wired to a hardcoded `https://realtybase.ca` apex, filtered to exactly one home-page URL, plus a static robots.txt pointing crawlers at the generated sitemap index — with all four of this phase's npm dependencies pinned at their audited exact versions.
- Programmatic 1200x630 Slate-on-wordmark OG share image generated via satori + resvg-js, committed as a static asset with a vendored OFL Lato font for offline reproducibility
- BaseLayout.astro extended into the site's single SEO/analytics integration point (canonical + full OG/Twitter blocks + env-aware noindex + `<Analytics />`), with per-page descriptions and six D-03-schema `track()` call sites wired across four components
- Positively verified SEO-01/02/03/04 and ANALYTICS-01's verifiable half against real four-environment build output, with human sign-off on the OG share image and explicit acceptance of the Vercel Hobby-tier custom-event limitation.
- New Vercel project `realstate` (Root Directory `landing`) deployed commit `e723e3b` of `tom-laventure/realstate`; build log and live HTTP fetch of `https://realstate-flax-five.vercel.app` both independently confirm Astro output with correct CTAs, robots/sitemap/OG assets, and zero CRA/Amplify markers.
- All six in-scope Vercel project settings confirmed correct, both live CTAs human-verified to navigate cross-origin, and DEPLOY-02 closed with a four-criteria roll-up citing named evidence from across both plans in this phase.
- Wrote a complete 234-line, 8-section human-executable runbook for cutting `realtybase.ca` over from the `frontend` Vercel project to `realstate`, naming the one confirmed backend finding (`google_oauth_controller.rb:77`) with its exact trigger condition and fix, a status-unscoped `BrokerageDomain` production re-check, TTL guidance, a detach-then-attach Vercel sequence, DNS/post-cutover verification, rollback, and a findings-snapshot appendix — with zero DNS, Vercel, database, or source-code changes executed.
- Task 1's automated sweep proved the plan 46-01 runbook satisfies every locked decision D-01 through D-09 and all four ROADMAP Phase 46 success criteria on the first run (zero FAIL lines, zero edits needed); Task 2's developer review confirmed the document is genuinely executable and returned the plan's "approved" resume-signal with no issues raised — closing DEPLOY-03 and Phase 46.

---

## v1.13 Onboarding & Self-Service Plan Management (Shipped: 2026-07-26)

**Phases completed:** 2 phases, 8 plans, 16 tasks

**Key accomplishments:**

- New `GET /v1/onboarding/plan_tiers` endpoint serving `AppConstants::PLAN_TIERS` as the frontend's drift-proof data source, plus removal of the retired "Growth requires custom_domain" backend validation.
- Widened `CreateBrokeragePlan` to the real 3-tier union from one source of truth, fixed the wizard's `submit()` custom_domain gate off the retired `premium` literal, built a 3-way `PlanBadge`, and shipped the plan-tiers fetch stack (type/api/hook) that Plan 03's UI will consume.
- Rebuilt the plan-selection step into a real 3-card fetch (Free/Independent/Growth, price/seat/flag-derived features, Growth recommended, loading/error states) and replaced DomainStep's isPremium-gated required custom-domain field with a plan-based Yes/No ownership toggle where a custom domain is optional for every tier.
- Human UAT sign-off: brokerage-creation wizard verified end-to-end for all three real tiers (Free/Independent/Growth), including the previously-broken Growth-with-no-custom-domain path
- New brokerage-scoped `PATCH /v1/admin/settings/plan` endpoint that flips `Current.brokerage.plan` and enqueues the real `ApplyPlanTransitionJob` cascade, gated by DB-backed owner-role re-validation.
- Owner-gated `manage_plan` RBAC permission, shared `PlanTier` type, an Axios call + TanStack mutation targeting the real `PATCH /v1/admin/settings/plan` endpoint, and a `useSettingsAdminContext` extension exposing plan state and a branching `handlePlanChange` action (downgrade opens a dialog; upgrade/lateral mutates immediately).
- Built the "Plan" section UI on `/admin/settings` — a Tabs-based 3-way segmented selector, an AlertDialog downgrade confirmation, and a Card wrapper section, all wired to the Plan 02 Brain state/actions and rendered below Ownership Management.
- Human UAT sign-off: owner-editable Plan section on /admin/settings verified end-to-end — upgrade/lateral changes apply immediately with a toast, paid→free downgrade gates behind a confirmation dialog, admin/agent see a disabled read-only selector, and a direct non-owner API call is rejected 403

**Audit:** `.planning/milestones/v1.13-MILESTONE-AUDIT.md` — 8/8 requirements satisfied, all cross-phase integration wired, one non-blocking tech-debt item found (plan-tier type duplicated 4x across frontend).

**Known deferred items at close:** 1 (see STATE.md Deferred Items) — pre-existing architecture todo (`arch-brokerage-listing-access.md`), unrelated to v1.13 scope, acknowledged and re-deferred to v1.14+.

---

## v1.12 Plan Tiers & Gating (Shipped: 2026-07-22)

**Phases completed:** 4 phases, 14 plans, 33 tasks

**Key accomplishments:**

- Centralized `AppConstants::PLAN_TIERS` config constant (free/independent/growth pricing, seat caps, and capability flags) plus a fail-loud `Brokerage#plan_config` accessor — the single source of truth every later gating and billing rule in Phases 37-39 reads from.
- Migrated `Brokerage#plan` from the binary `basic`/`premium` enum to the three-tier `free`/`independent`/`growth` enum via a raw-SQL backfill migration with an orphan-check guard, flipped the model validation, and rewired both the admin custom-domain gate and onboarding signup validation to read from the config-driven `plan_config`/`PLAN_TIERS` accessor instead of comparing plan-name string literals.
- Three server-side Free-tier gates (board list filter, real-board connect reject, client-invite reject) added directly to existing admin controllers, reusing Phase 36's canonical `plan_required` 403 shape, with two new integration test files (9 assertions) proving Free-tier restriction and Independent/Growth non-regression.
- User-scoped `any_paid_brokerage_membership?` predicate gates Google calendar authorize and Apple calendar connect with 403 `plan_required` for fully-Free users, and exposes a `calendar_sync_available` boolean on the connections index for frontend banner logic — fully TDD'd against the real backend test suite.
- Three new Minitest integration test files locking in Free-tier's uncapped seats, the Phase-36 custom-domain gate (plus its paid-tier non-restriction counterpart), and plan-agnostic engagement features — zero application code changed.
- Frontend `hasPlanCapability` RBAC-style helper mirroring backend `PLAN_TIERS`, plus a reusable `FreeTierBanner` info-notice component matching the UI-SPEC visual contract — both fully unit tested, no consumers wired yet.
- Wired `FreeTierBanner` + `hasPlanCapability` (Plan 04's contracts) into three brokerage-scoped admin surfaces — Board Registrations, the client-invite form in AddUserToGroupView (hidden entirely on Free per D-04), and the Domains page — each gated in its container hook and consumed as a prop by the pure presentational component, with a passing RTL test per surface.
- Account Calendar tab now reads the backend's user-scoped `calendar_sync_available` boolean and swaps the provider-card grid for a FreeTierBanner when a fully-Free user has no paid membership anywhere, while keeping the tab and its heading/intro text visible in both states.
- Migration adding suspended_at (indexed) to brokerage_memberships/brokerage_board_credentials plus brokerages.plan_downgraded_at, a third `suspended` enum value on BrokerageBoardCredential#status, and Invitation#revoked_at-style suspend!/restore!/suspended? methods on BrokerageMembership
- `TestBoardPurgeService.call!(brokerage:)` hard-deletes all TEST-board-linked demo data (BrokerageEstate + GroupEstate tree + orphaned calendar events) for one brokerage via paranoia's `really_destroy!`, leaving real-board data and other brokerages fully untouched.
- `ApplyPlanTransitionJob` dispatches all four plan-transition side-effect cascades (TEST-board purge on upgrade, domain-freeze + credential/membership-suspend on downgrade, event-scoped restore on re-upgrade) from a single async job, mirroring `SendInvitationEmailJob`'s shape and satisfying D-06's "restore only this downgrade's suspensions" invariant.
- CognitoAuth now rejects suspended client memberships with a distinct 403 (D-09); board_credentials#index excludes suspended credentials (D-07); board_credentials#update/#destroy treat a suspended credential as nonexistent, closing the reactivation hole where an admin could PATCH a frozen real-board credential back to active (T-38-10)
- `Ops::PlanController#update` now accepts `{plan: "<target>"}`, validates it against the tier allowlist, flips `brokerage.plan`, and enqueues `ApplyPlanTransitionJob(id, old_plan, new_plan)` — replacing the old two-valued boolean `freeze:` param with the three-tier trigger the Plan 03 cascade job needs.
- Filled in the paid<->paid branch of ApplyPlanTransitionJob with a pure billing recalculation that persists an append-only PlanBillingSnapshot keyed by the new plan's config, with overage clamped at zero and client/soft-deleted memberships excluded from the seat count.
- Post-ship code review (Phase 39 close) found and fixed 2 critical pre-existing bugs in the Phase 38 transition job: `downgrade!` non-idempotent against job retry/redelivery, and `unfreeze_custom_domains!` missing event-scoping (could reactivate an unrelated frozen domain).

**Known deferred items at close:** 1 (see STATE.md Deferred Items — architecture: rethink listing access model, carried from v1.10, re-acknowledged here)

### Archive

- Roadmap: [milestones/v1.12-ROADMAP.md](milestones/v1.12-ROADMAP.md)
- Requirements: [milestones/v1.12-REQUIREMENTS.md](milestones/v1.12-REQUIREMENTS.md)
- Tag: `v1.12`

---

## v1.11 Brokerage Ownership Management (Shipped: 2026-07-13)

**Phases completed:** 3 phases, 11 plans, 23 tasks

**Key accomplishments:**

- Closed the CR-02/CR-03 admin-takeover chain by locking down owner-role transitions on `UsersController#update`/`#destroy` and rejecting owner-role invitations on `InvitationsController#create`, backed by 10 new integration tests.
- New `V1::Admin::Settings::OwnersController` ships the four owner-management endpoints (list owners, list eligible admin/agent members, promote, demote-with-last-owner-guard), all mutation paths gated by the DB-backed `current_membership` helper — no JWT role-claim trust anywhere.
- Removed the "Owner" option from the `/admin/brokerage/add-agent` role selector and its RolePermissions description, closing the UX-layer accidental-owner-assignment path (LOCK-02).
- TypeScript types, owner-exclusive `manage_ownership` RBAC permission, centralized query keys, three Axios API modules, and three TanStack Query hooks wired to the shipped Phase 33 owner endpoints.
- Replaced the bare `/admin/settings` stub with a live Ownership Management card (Current Owners list + owner-gated Add Owner modal with searchable combobox, D-04 warning callout, and TOCTOU-aware error toast) wired through a new Context brain consuming the Plan 34-01 hooks.
- Human verification confirmed the owner/admin/agent role split renders correctly on `/admin/settings` and that the promote endpoint's owner-only boundary is enforced server-side (403 on a direct admin JWT call), not just by hiding the Add Owner button.
- Demote-owner data trio (types, PATCH API module, TanStack mutation hook) plus a hand-authored Radix RadioGroup primitive and shared StepDots indicator, all built TDD-first against a mocked PATCH /v1/admin/settings/owners/:id endpoint.
- Three-step RemoveOwnerDialog (warning -> RadioGroup role picker -> destructive confirm) plus a gated, last-owner-aware Remove button on CurrentOwnersList — both presentational and prop-driven for Plan 04's Brain wiring.
- Retrofitted `AddOwnerDialog.tsx` from a single-screen promote form into a two-step decision-then-review flow, matching the Remove Owner dialog's shape, with the `usePromoteOwner` API contract left completely unchanged.
- Wired useDemoteOwner mutation, demoteTarget dialog state, currentUserId, and a self-demote Redux session patch through useSettingsAdminContext, OwnershipManagementSection, and SettingsAdminBoard — closing the end-to-end Remove Owner flow.
- Owner confirmed the full Remove Owner flow and Add Owner review-step retrofit work end-to-end against the live backend, on both login paths.

---

## v1.10 — Agent Admin Permissions

**Shipped:** 2026-07-10
**Phases:** 3 (30–32) | **Plans:** 9
**Timeline:** 2026-07-09 → 2026-07-10 (2 days)

### Delivered

Extended the `agent` role from group-scoped work into full brokerage-wide admin visibility. Backend RBAC gained a third authorization tier (`require_agent_or_above!`) so agents pass read/group-scoped admin endpoints while every other write endpoint continues to 403 them, backed by an exhaustive 62-assertion allow/deny permission-matrix test suite (Phase 30). The admin dashboard shell opened to agents on both subdomain and main-domain surfaces, unlocking full CRUD on groups, filter sets, group members/invitations, and group listings (Phase 31). Visibility then widened from "groups only" to all six admin sections — Users, Brokerage, Boards, Domains, Settings — at a strict read tier: every mutation control gated behind `manage_users`/`manage_brokerage_settings`, with brokerage-level staff invitations fully blocked at both the route and UI layer (Phase 32). Human UAT caught a two-layer gap — a JSX-only permission gate couldn't stop an ancestor hook's data fetch, so agents still triggered a (correctly-403'd but user-visible) invitations request on `/admin/users` — closed by gap-closure plan 32-04, which gated the fetch itself via the same `usePermission` primitive. All 16 requirements delivered and human-UAT-approved.

### Key Accomplishments

1. `Admin::BaseController` third `require_agent_or_above!` tier propagated to 13 admin controllers, narrower `require_admin!`/`require_owner!` stacked on the 4 write-only controllers — RBAC-01/02/03
2. 62-assertion agent permission matrix (46 allow-list 2xx + 16 deny-list 403) in `admin_authorization_test.rb` — full regression coverage for the new tier
3. Admin dashboard shell + full group CRUD (groups, filter sets, members, invitations, listings) unlocked for agent with zero new UI — reused existing `ROLE_PERMISSIONS`/`RequireRole` gates — ACCESS-01, GROUP-01–05
4. Six-section read-tier admin access (`readTierRoles` route helper) + full nav expansion, with every mutation control gated behind `manage_users`/`manage_brokerage_settings` — ACCESS-02–06, ACCESS-08
5. ACCESS-07 "no view" closed at both layers: `<Can>` JSX render gate (32-03) + `{ enabled }` fetch gate on `useFetchBrokerageInvitations` driven by `usePermission('manage_users')` (32-04) — established a reusable pattern for permission-gated data hooks
6. Human UAT round-trip: 2 issues reported → root-caused → gap-closure plan executed with TDD (RED/GREEN) → re-verified → both approved live

### Known Deferred Items at Close: 4

| Category | Item | Status |
|----------|------|--------|
| Architecture | Rethink listing access model — BrokerageEstate vs board credential JOIN | Carry to v1.11 |
| CR-02 | S3 favicon upload outside transaction | Pre-existing; carry to v1.11 |
| UX | Brokerage switch preserving active tab position | Carry to v1.11 |
| UX | Deep-link into admin panel with brokerage context preserved | Carry to v1.11 |

### Archive

- Roadmap: [milestones/v1.10-ROADMAP.md](milestones/v1.10-ROADMAP.md)
- Requirements: [milestones/v1.10-REQUIREMENTS.md](milestones/v1.10-REQUIREMENTS.md)
- Tag: `v1.10`

---

## v1.9 — Dashboard & Navbar Enhancement

**Shipped:** 2026-06-06
**Phases:** 3 (27–29) | **Plans:** 5
**Timeline:** 2026-06-05 → 2026-06-06 (2 days)

### Delivered

Full enrichment of the main-domain brokerage selection flow and SaaS branding unification. Backend: `GET /v1/account/admin_brokerages` extended with two-query bulk membership strategy returning `client_count`, `member_count`, and `owners` per brokerage — no N+1, empty-guard protected (Phase 27). TypeScript `AdminBrokerage` interface extended with three required fields (`clientCount`, `memberCount`, `owners[]`) to match (Phase 27). Frontend: `BrokerageSelection` rewritten from a narrow `max-w-sm` centered panel to a full-width `max-w-7xl` responsive card grid; `BrokerageCard` extracted as a keyboard-focusable button-as-card component surfacing all six brokerage data points; single-brokerage auto-redirect fires synchronously without flash (Phase 28). New `DashboardNavBar` component: brand logo (conditionally rendered from `VITE_BRAND_LOGO_URL`) on left, account dropdown (Account Settings + Sign Out) on right — wired into both the loading and main grid paths in `BrokerageSelection` (Phase 29-01). `PortalNavBar` updated: clickable brand logo (`<button>` wrapping `<img>`) added left of brokerage switcher dropdown; per-brokerage trigger logo removed; favicon hook preserved (Phase 29-02). All 7 DASH requirements delivered.

### Key Accomplishments

1. `AdminBrokeragesController#index`: two-query bulk strategy (`filter_map` → scoped `BrokerageMembership` query → `group_by` in Ruby) returns 6 fields per brokerage in one response — DASH-01
2. `AdminBrokerage` TypeScript interface: `clientCount`, `memberCount`, `owners[]` added as required fields — compile-time safety for all downstream consumers — DASH-02
3. `BrokerageCard.tsx` + `BrokerageSelection.tsx` rewrite: full-width grid, responsive layout, role badge, stats line, conditional owners row — DASH-03/04
4. `DashboardNavBar.tsx`: standalone 69-line navbar; sign-out mirrors `PortalNavBar` exactly; `VITE_BRAND_LOGO_URL` guard — DASH-05
5. `PortalNavBar.tsx`: plain `<button>` brand logo (→ `/dashboard`) left of switcher; per-brokerage trigger logo removed — DASH-06/07

### Known Deferred Items at Close: 4

| Category | Item | Status |
|----------|------|--------|
| Architecture | Rethink listing access model — BrokerageEstate vs board credential JOIN | Carry to v1.10 |
| CR-02 | S3 favicon upload outside transaction | Pre-existing; carry to v1.10 |
| UX | Brokerage switch preserving active tab position | Carry to v1.10 |
| UX | Deep-link into admin panel with brokerage context preserved | Carry to v1.10 |

### Archive

- Roadmap: [milestones/v1.9-ROADMAP.md](milestones/v1.9-ROADMAP.md)
- Requirements: [milestones/v1.9-REQUIREMENTS.md](milestones/v1.9-REQUIREMENTS.md)
- Tag: `v1.9`

---

## v1.8 — Root Route Fix

**Shipped:** 2026-06-04
**Phases:** 1 (26) | **Plans:** 1
**Timeline:** 2026-06-03 → 2026-06-04 (2 days)

### Delivered

Two surgical frontend-only fixes for root route edge cases. `SubdomainOnly` (DomainGuard.tsx) updated with a pathname check: main domain at `/` now renders `<Navigate to="/dashboard" replace />` instead of `<NotFound />`, routing unauthenticated users through the `ProtectedRoute` wrapper to `/auth/login`. `PrimaryDomainRedirect` extended with an `isAuthenticated()` early-return guard alongside the existing `isMainDomain()` check, eliminating the `lookupDomain()` API call and blank-screen flash for unauthenticated subdomain visitors. Initial PLAN.md approach (index route in `MainDomainOnly`) was dead code caught by code review before execution.

### Key Accomplishments

1. `DomainGuard.tsx` (`SubdomainOnly`): pathname check redirects main domain `/` → `/dashboard` instead of NotFound — ROUTE-01
2. `PrimaryDomainRedirect.tsx`: `isAuthenticated()` guard short-circuits async domain lookup for unauthenticated users — ROUTE-02
3. Code review caught dead-code approach (unreachable index route in Block 2) before execution; corrected to Block 1 fix

### Known Deferred Items at Close: 4

| Category | Item | Status |
|----------|------|--------|
| Architecture | Rethink listing access model — BrokerageEstate vs board credential JOIN | Carry to v1.9 |
| CR-02 | S3 favicon upload outside transaction | Pre-existing; carry to v1.9 |
| UX | Brokerage switch preserving active tab position | Carry to v1.9 |
| UX | Deep-link into admin panel with brokerage context preserved | Carry to v1.9 |

### Archive

- Roadmap: [milestones/v1.8-ROADMAP.md](milestones/v1.8-ROADMAP.md)
- Requirements: [milestones/v1.8-REQUIREMENTS.md](milestones/v1.8-REQUIREMENTS.md)
- Tag: `v1.8`

---

## v1.7 — Board Registrations Nav Separation

**Shipped:** 2026-05-31
**Phases:** 1 (25) | **Plans:** 3
**Timeline:** 2026-05-31 (single day)

### Delivered

Board Registrations extracted from `BrokerageAdminBoard` into a dedicated `/admin/boards` route with its own `useBoardsAdminContext` (board credential fetches/mutations, zero brokerage dependency). `/admin/brokerage` trimmed to Brokerage Information and Branding only. Both admin sidebars updated: subdomain `SideNav.tsx` and main-domain `PortalAdminSideNav` now show "Board Registrations" between "Brokerage" and "Users". Portal nav mislabeled first item corrected from "Board Registrations" to "Brokerage". All 7 NAV requirements satisfied.

### Key Accomplishments

1. `useBoardsAdminContext.ts` — boards-only context hook: `useFetchBoardCredentials`, `useFetchBoards`, 3 credential mutations; zero `useFetchBrokerage` dependency — NAV-06
2. `BoardsAdminBoard.tsx` + route registration in `admin.tsx` — self-contained `/admin/boards` container rendering full `BoardRegistrations` with all 7 props — NAV-01, NAV-05
3. `BrokerageAdminBoardContext.ts` trimmed — board hooks and handlers removed; context exports only `{ brokerage, isLoading, error }` + `handleUpdateBrokerage` — NAV-07
4. `SideNav.tsx` (subdomain) + `PortalAdminSideNav.tsx` (portal) updated — `ClipboardList`-icon Board Registrations nav item inserted at index 1 in both sidebars; portal mislabel fixed — NAV-02, NAV-03
5. Audit caught orphaned `AdminBoardSideNav` component before milestone close — fixed by targeting `SideNav.tsx` directly

### Archive

- Roadmap: [milestones/v1.7-ROADMAP.md](milestones/v1.7-ROADMAP.md)
- Requirements: [milestones/v1.7-REQUIREMENTS.md](milestones/v1.7-REQUIREMENTS.md)
- Audit: [milestones/v1.7-MILESTONE-AUDIT.md](milestones/v1.7-MILESTONE-AUDIT.md)
- Tag: `v1.7`

---

## v1.6 — Domain Management v2

**Shipped:** 2026-05-31
**Phases:** 3 (22–24) | **Plans:** 11
**Timeline:** 2026-05-30 → 2026-05-31 (2 days)

### Delivered

DNS verification & health monitoring backend: `consecutive_failures` + `last_checked_at` columns, `pending`/`frozen` enum values, `PHASE_OUT_DURATION`/`HEALTH_CHECK_INTERVAL` constants, `freeze_domain!`/`unfreeze_domain!` methods; `DomainVerificationJob` + `DomainHealthJob` SolidQueue recurring jobs (30-min CNAME polling, 3-failure auto-phase-out, 7-day unverified auto-remove); `DomainMailer` with 3 templates (health_failure, downgrade_notice, unverified_warning); `Ops::PlanController` freeze/unfreeze endpoint; pending domain creation + pending destroy branch (Phase 22). `DomainRedirectMiddleware` Rack middleware: 301 from non-primary active/phasing-out/frozen domains; eager-loaded collection for N+1-free primary lookup; DPRI-03 mailer integration tests proving all system emails embed primary domain (Phase 23). Domain UI overhaul: `DomainCard` (5 status variants, role-gated controls), `DomainCardList` (STATUS_ORDER sort, gated Add button), 4-step `AddDomainWizard` (conditional primary preference, live CNAME display), on-demand verify endpoint with rescue detection, delete dialogs for primary vs non-primary domains; header status legend + help popover with registrar guidance (Phase 24). All 34 requirements delivered.

### Key Accomplishments

1. `DomainVerificationJob` + `DomainHealthJob`: 30-min SolidQueue recurring jobs; pessimistic lock for first-to-verify race condition; `FakeJob` subclass for Minitest 6 DNS testing — DVER-02, DVER-05, DHLT-01/02
2. `DomainMailer` 3-template owner notification system with `BrokerageMembership.without_deleted` dispatch guard — DHLT-03/04, DADD-04
3. `Ops::PlanController` + `freeze_custom_domains!`/`unfreeze_custom_domains!`: Pro downgrade/upgrade domain lifecycle; `verified` flag drives restore target (active vs pending) — DPRD-01/03/05/06
4. `DomainRedirectMiddleware`: Rack-layer 301 for non-primary/frozen domains; `insert_before ActionDispatch::Static`; in-memory primary lookup via eager-loaded `.includes()` — DPRI-04, DPRD-02
5. `POST /v1/admin/domains/:id/verify`: synchronous on-demand DNS check + `set_primary_on_verify` promotion + frozen-domain inclusion in all list scopes — DVER-01
6. Phase 24 Domain UI: 5-status `DomainCard`, 4-step `AddDomainWizard`, `useVerifyDomain` rescue detection, `DeletePrimaryDomainDialog` replacement flow — DUIV-01–06, DADD-01–03, DLCX-02–04, DPRD-04

### Known Deferred Items at Close: 1

| Category | Item | Status |
|----------|------|--------|
| Architecture | Rethink listing access model — BrokerageEstate vs board credential JOIN | Carry to v1.7 |

### Archive

- Roadmap: [milestones/v1.6-ROADMAP.md](milestones/v1.6-ROADMAP.md)
- Requirements: [milestones/v1.6-REQUIREMENTS.md](milestones/v1.6-REQUIREMENTS.md)
- Tag: `v1.6`

---

## v1.5 — Domain Management

**Shipped:** 2026-05-29
**Phases:** 3 (19–21) | **Plans:** 10
**Timeline:** 2026-05-27 → 2026-05-29 (3 days)

### Delivered

Domain schema: 4 lifecycle columns added to `brokerage_domains` (`domain_type`, `status`, `is_primary`, `phase_out_at`), SQL backfill, partial unique index on non-decommissioned domains; `BrokerageDomain` model with string-backed enums, `RESERVED_SLUGS`, routable scope, slug validations; `BrokerageAuth` and `DomainsController#check` updated to status-based scopes (Phase 19). Full domain management backend: `phase_out!/decommission!` lifecycle helpers, `phasing_out_count_for` slot counter, `BrokerageDomainSerializer`; rebuilt `V1::Admin::DomainsController` with 5 owner-gated actions (index, subdomain, custom, destroy, set_primary), Pro-tier gate, slot-block/warning logic, 21 integration tests; public `GET /v1/domains/lookup`; `InvitationMailer` updated to `is_primary: true` with 3 mailer tests (Phase 20). Full Domains admin page: `PrimaryDomainRedirect` layout-route guard with `window.location.replace`; 4 admin API modules + 5 TanStack mutation hooks; `DomainsAdminView` with live status cards, type/status/countdown badges, primary badge, slot management, Pro gate, edit/add/remove/set-primary actions; "Domains" nav wired into both sidebars; UAT passed 6/7 + 2 bugs fixed (Phase 21). All 27 requirements delivered.

### Key Accomplishments

1. `brokerage_domains` lifecycle schema: atomic migration with SQL backfill + partial unique index `WHERE status != 'decommissioned'` — DMOD-01/02/03
2. `BrokerageDomain` model: string enums + `RESERVED_SLUGS` + routable scope + slug validation; `BrokerageAuth` → `.routable`; `DomainsController#check` → `.status_active` — DMOD-04, DINT-03, DINT-04
3. Full admin domains REST API: 5 actions with slot-block/warning logic + Pro gate + 21 integration tests — DMOD-05–12, DMOD-14
4. Public `GET /v1/domains/lookup` (unauthenticated) + `InvitationMailer` `is_primary: true` fix — DMOD-13, DINT-02
5. `PrimaryDomainRedirect` layout-route guard using `window.location.replace` + `lookupDomain` BASE axios — DINT-01
6. Full Domains admin page: status cards, phase-out countdowns, slot management, Pro gate, all 9 DUI requirements — DUI-01–09

### Known Deferred Items at Close: 1

| Category | Item | Status |
|----------|------|--------|
| Domains | DNS verification for custom domains | Known gap; v1.6 milestone |

### Archive

- Roadmap: [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md)
- Requirements: [milestones/v1.5-REQUIREMENTS.md](milestones/v1.5-REQUIREMENTS.md)
- Tag: `v1.5`

---

## v1.4 — Main Domain Admin Portal

**Shipped:** 2026-05-27
**Phases:** 4 (15–18) | **Plans:** 11
**Timeline:** 2026-05-24 → 2026-05-27 (3 days)

### Delivered

Backend: `BrokerageAuth` extended with X-Brokerage-Id header resolution for main-domain requests; `GET /v1/account/admin_brokerages` endpoint returning cross-brokerage admin/owner membership list (Phase 15). Frontend routing: `/dashboard/*` route tree alongside `/create/*`; `LoginSuccessful` and `Login` both extended with domain-aware post-sign-in routing — ≥1 admin role → /dashboard, 0 roles → /no-access; `NoAccess` screen with Amplify signOut + clearToken (Phase 16). Brokerage selection: `activeBrokerage` Redux slice; `BrokerageSelection` screen with single-brokerage auto-redirect anti-flash guard; `PortalShell` with D-12 URL param validation and D-13 empty-Redux re-fetch; `SuccessStep` wizard redirect to main domain (Phase 17). Full portal: `PortalNavBar` brokerage switcher dropdown + role badge; `PortalShell` 4-section admin landing page; Axios X-Brokerage-Id interceptor injection; `RequireRole` isMainDomain() bypass; `AdminDomainShell` domain-adaptive shell delegating to `PortalAdminShell` on main domain and `AppShellAdmin` on subdomain (Phase 18). All 14 requirements validated.

### Key Accomplishments

1. `BrokerageAuth` X-Brokerage-Id branch: `main_domain_request?` reuses `extract_domain_from_request`; `.to_i` injection-safe; 400 on missing header — BE-02, BE-03
2. `V1::Account::AdminBrokeragesController` with `MainDomainOnly + CognitoAuth`, cross-brokerage design, 4 integration tests — BE-01
3. `useFetchAdminBrokerages` imperative hook (not useQuery) + `Login.tsx` deviation catch: email/password sign-in bypasses `LoginSuccessful` — PORTAL-01, AUTH-05, AUTH-06, AUTH-07
4. `activeBrokerage` Redux slice + `BrokerageSelection` anti-flash guard + `PortalShell` D-13 re-fetch pattern — BROK-01, BROK-02, ONB-04
5. `PortalNavBar` brokerage DropdownMenu switcher with dispatch-then-navigate ordering; null guard when activeBrokerage is null — PORTAL-03, BROK-03, BROK-04
6. `AdminDomainShell` single-route domain-adaptive delegation: avoids React Router path conflicts from domain-guarded duplicate /admin/ blocks — PORTAL-02

### Known Deferred Items at Close: 4

| Category | Item | Status |
|----------|------|--------|
| CAL-04 | Microsoft Calendar sync | Adapter built, activate by expanding PROVIDERS |
| CAL-05 | Apple CalDAV sync | Adapter built, activate by expanding PROVIDERS |
| CR-01 | `BrokerageDomain.exists?` missing `.active` scope | Pre-existing since v1.1 |
| CR-02 | S3 favicon upload outside transaction | Pre-existing since v1.1 |

### Archive

- Roadmap: [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md)
- Requirements: [milestones/v1.4-REQUIREMENTS.md](milestones/v1.4-REQUIREMENTS.md)
- Tag: `v1.4`

---

## v1.3 — Test Board & Board Management

**Shipped:** 2026-05-24
**Phases:** 4 | **Plans:** 11
**Timeline:** 2026-05-21 → 2026-05-24 (3 days)

### Delivered

Seed overhaul: single TEST board replaces REBGV/FVREB/CADREB; 100 real North Vancouver listings with hardcoded lat/lng, seeded without pre-attached BrokerageEstate rows (Phase 11). Board connect flow: `POST /v1/admin/board_credentials` bulk-inserts `BrokerageEstate` rows idempotently; test boards bypass RETS validation; `Estate#accessible_by` restructured for test-board estate visibility (Phase 12). Frontend connect dialog: `ConnectBoardDialog` test-board-info step skips credentials, shows blue info notice, handles server errors (Phase 13). Board credential CRUD: DELETE + PATCH backend endpoints with IDOR scoping, 10 integration tests; `EditBoardCredentialDialog` + 5-column Board Registrations table with per-row ⋯ dropdown and AlertDialog delete confirmation (Phase 14). All 12 requirements validated.

### Key Accomplishments

1. `is_test_board boolean null: false default: false` column + `test_boards`/`real_boards` scopes + serializer exposure — BOARD-01/02
2. `NV_LISTINGS` constant with 100 real North Vancouver addresses; per-street lat bands guarantee all 100 unique — SEED-01/02/03/04
3. `BrokerageEstate.insert_all unique_by: [:brokerage_id, :estate_id]` on board connect; `Estate#accessible_by` restructured — BOARD-03/04
4. `ConnectBoardDialog` test-board-info bypass step with blue info notice and server error handling — BOARD-05
5. `DELETE`/`PATCH /v1/admin/board_credentials/:id` with IDOR scoping, 10 integration tests, acts_as_paranoid soft delete — BOARD-06/07
6. `EditBoardCredentialDialog` + 5-column `BoardRegistrations` with DropdownMenu and controlled AlertDialog — BOARD-08

### Known Deferred Items at Close: 4

| Category | Item | Status |
|----------|------|--------|
| CAL-04 | Microsoft Calendar sync | Adapter built, activate by expanding PROVIDERS |
| CAL-05 | Apple CalDAV sync | Adapter built, activate by expanding PROVIDERS |
| CR-01 | `BrokerageDomain.exists?` missing `.active` scope | Pre-existing; address in v1.4 |
| CR-02 | S3 favicon upload outside transaction | Pre-existing; address in v1.4 |

### Archive

- Roadmap: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)
- Requirements: [milestones/v1.3-REQUIREMENTS.md](milestones/v1.3-REQUIREMENTS.md)
- Tag: `v1.3`

---

## v1.2 — Listing Map View

**Shipped:** 2026-05-18
**Phases:** 3 | **Plans:** 7
**Timeline:** 2026-05-16 → 2026-05-18 (2 days)

### Delivered

Geocoding pipeline seeded listing coordinates from Nominatim (OpenStreetMap) with retry/discard job semantics and a backfill rake task (Phase 8). Interactive Mapbox GL map panel on the group dashboard with filter-synced pins, use-supercluster proximity clustering, single-pin and cluster popups (Phase 9). Single-pin location map on individual listing detail pages, conditional on coordinates, placed outside the tab system (Phase 10). All 6 MAP requirements validated.

### Key Accomplishments

1. `decimal(10,6)` lat/lng + `geocoding_failed` on `listing_details` — zero-downtime PostgreSQL metadata-only migration — MAP-01
2. `GeocodingService` (Nominatim) + `GeocodeListingsJob` (retry/after_discard) + idempotent `geocode:backfill` rake task — MAP-01
3. `GET /v1/dashboard/groups/:id/estates/coordinates` — filter-synced, null-coord-excluding lightweight projection endpoint — MAP-02/03
4. `GroupMapPanel` with use-supercluster clustering, `keepPreviousData`, custom Marker child, `fitBounds` on first load only — MAP-02/03/05
5. `GroupMapPinPopup` + `GroupMapClusterPopup` with hero photo, price, address, bed/bath/sqft, "View details" links — MAP-06
6. `EstateLocationMap` single-pin Mapbox component on listing detail page; absent when listing has no coordinates — MAP-04

### Known Deferred Items at Close: 0

No items deferred at milestone close.

### Archive

- Roadmap: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- Requirements: [milestones/v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md)
- Tag: `v1.2`

---

## v1.1 — Domain Access Control

**Shipped:** 2026-05-16
**Phases:** 2 | **Plans:** 2
**Timeline:** 2026-05-13 → 2026-05-16 (3 days)

### Delivered

Full-stack domain enforcement: frontend `DomainGuard` React components enforce main-domain-only (`/create`) and subdomain-only routes via `VITE_MAIN_DOMAIN` env var (Phase 6). Backend `MainDomainOnly` Rails concern rejects non-main-domain requests on all four `/v1/onboarding/*` endpoints with HTTP 403 before Cognito auth runs (Phase 7). Both layers read domain config from env vars — no hardcoded strings. All 5 DOM requirements validated.

### Key Accomplishments

1. `isMainDomain()` utility + `SubdomainOnly`/`MainDomainOnly` guard components wired into React router — DOM-01/02/03
2. `NotFound` page per UI-SPEC — renders on all non-`/create` routes from main domain
3. `MainDomainOnly` Rails concern: Origin-first extraction, `URI::InvalidURIError` rescue, `APP_BASE_DOMAIN` env config — DOM-04/05
4. Guard runs before Cognito auth — wrong-domain requests return 403, not 401 (correct security ordering)
5. 22 backend integration tests (17 prior + 5 new), 0 failures; 8 frontend unit tests (all passing)
6. Code review surfaced 2 pre-existing critical issues (soft-delete filter gap, S3 orphan) — logged for v1.2

### Known Deferred Items at Close: 2

| Category | Item | Status |
|----------|------|--------|
| CR-01 | `BrokerageDomain.exists?` missing `.active` scope in `DomainsController#check` | Pre-existing; address in v1.2 |
| CR-02 | S3 favicon upload outside transaction — orphaned on DB failure | Pre-existing; address in v1.2 |

### Archive

- Roadmap: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- Requirements: [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md)
- Tag: `v1.1`

---

## v1.0 — Security, OAuth & Calendar

**Shipped:** 2026-05-13
**Phases:** 5 | **Plans:** 30
**Timeline:** 2026-04-29 → 2026-05-13 (14 days)

### Delivered

Server-side RBAC enforcement, rack-attack rate limiting, CORS hardening, N+1 fixes, and tech debt cleanup (Phase 1) — followed immediately by a backend + frontend test suite proving the fixes (Phase 2). Onboarding flows fixed: domain wizard, post-invite redirect, and welcome banner (Phase 3). Google social login shipped atomically with PreSignUp Lambda account linking and intermediary callback page (Phase 4). Google Calendar sync with advisory-lock job, encrypted credential storage, and settings UI (Phase 5).

### Key Accomplishments

1. `Admin::BaseController#require_admin!` closed the RBAC gap across all 13 admin controllers — SEC-01
2. Backend integration test suite: 17 tests covering tenant isolation, RBAC, FilterSets, GroupEstatesQuery, InvitationsController
3. Frontend test suite: Vitest 4.x + MSW 2.x, 7 tests covering ProtectedRoute, RequireRole, GoogleSignInButton
4. Google OAuth federation via Cognito + PreSignUp Lambda with `AdminLinkProviderForUser` email linking
5. `CalendarSyncJob` with PostgreSQL advisory lock, deterministic event IDs, and token refresh — wired to EstateEventsController fan-out
6. Calendar settings UI: CalendarTab + ProviderCard + CalendarContext, Google provider connected and verified

### Known Deferred Items at Close: 2

| Category | Item | Status |
|----------|------|--------|
| CAL-04 | Microsoft Calendar sync | Adapter built, activate in v2 by expanding PROVIDERS |
| CAL-05 | Apple CalDAV sync | Adapter built, activate in v2 by expanding PROVIDERS |

### Archive

- Roadmap: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- Requirements: [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)
- Tag: `v1.0`
