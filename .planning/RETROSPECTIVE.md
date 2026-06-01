# Retrospective

## Milestone: v1.7 — Board Registrations Nav Separation

**Shipped:** 2026-05-31
**Phases:** 1 (25) | **Plans:** 3 | **Timeline:** 1 day (2026-05-31)

### What Was Built

1. `useBoardsAdminContext.ts` — boards-only context hook extracting the board credential slice from `BrokerageAdminBoardContext`: 5 board hooks, 3 board handlers, zero brokerage dependency (Plan 25-01)
2. `BoardsAdminBoard.tsx` + `/admin/boards` route registration in `admin.tsx` — self-contained container with loading guard, wires all 7 `BoardRegistrations` props from context (Plan 25-01)
3. `BrokerageAdminBoardContext.ts` trimmed — all 5 board hooks, `boardType` import, `isConnectBoardOpen` state, 3 board handlers removed; context now exports only `{ brokerage, isLoading, error }` + `handleUpdateBrokerage`; `BoardRegistrations` import + JSX render removed from `BrokerageAdminBoard.tsx` (Plan 25-02)
4. `SideNav.tsx` (subdomain) + `PortalAdminSideNav.tsx` (portal) — `ClipboardList`-icon "Board Registrations" nav item inserted at index 1 in both sidebars; portal nav mislabeled first item corrected from "Board Registrations" to "Brokerage" (Plan 25-03 + audit fix)

### What Worked

- **Subset extraction pattern** — `useBoardsAdminContext` as a strict subset of `BrokerageAdminBoardContext` (identical hook calls, no added logic) made the split clean and zero-risk. No shared state, no coordination required.
- **Audit caught a real gap** — `AdminBoardSideNav` was implemented correctly but never mounted anywhere. `SideNav.tsx` (the actual subdomain admin sidebar) was the right fix target. Without the audit, NAV-02 would have shipped as invisible functionality.
- **`BoardRegistrations` component reuse** — preserving the component file (only removing the import+render from the brokerage page) let both pages share it without duplication.

### What Was Inefficient

- **REQUIREMENTS.md checkboxes again** — NAV-02 and NAV-03 remained `[ ]` throughout execution; updated only at milestone close. Same 8-milestone pattern.
- **`AdminBoardSideNav` was the wrong target** — the plan specified updating `AdminBoardSideNav.tsx`, but the component was never wired into the app. Should have traced the component mounting chain before writing the plan (AppShellAdmin → SideNav, not AdminBoardSideNav).

### Patterns Established

- **Sidebar fix goes to `SideNav.tsx`** — for subdomain admin nav changes, the correct file is `src/components/sidenav/SideNav.tsx` (mounted by `AppShellAdmin`), not `AdminBoardSideNav.tsx` (orphaned component never used). Future nav changes must trace the mounting chain first.
- **Context subset extraction** — when splitting a page, extract the new context as a strict subset (same hook imports, same return shape subset). Do not introduce new logic during extraction; refactor separately.

### Key Lessons

- **Trace component mounting before planning nav changes** — `AdminBoardSideNav` was a dead component. The correct fix target (`SideNav.tsx`) was discoverable by searching `AppShellAdmin` imports. Add "grep for mounting location" to the RESEARCH step for any nav-related plan.
- **Audit-then-complete is the right sequence** — the audit caught the NAV-02 wiring gap before archiving. The 2-minute fix (`SideNav.tsx` + one import) was trivial; shipping without it would have been a UX bug.

### Cost Observations

- Sessions: 1 (single day)
- Model: Claude Sonnet 4.6 throughout
- Notable: 3 plans in ~15 minutes of execution time; smallest milestone to date; audit added ~10 minutes and caught a real bug

---

## Milestone: v1.6 — Domain Management v2

**Shipped:** 2026-05-31
**Phases:** 3 (22–24) | **Plans:** 11 | **Timeline:** 2 days (2026-05-30 → 2026-05-31)

### What Was Built

1. DNS verification & health monitoring backend: `consecutive_failures` + `last_checked_at` columns, `pending`/`frozen` enum values, `PHASE_OUT_DURATION`/`HEALTH_CHECK_INTERVAL` constants, `freeze_domain!`/`unfreeze_domain!` methods; `BrokerageDomainSerializer` updated to 10 fields (Phase 22-01)
2. `DomainMailer` with 3 ERB templates (`health_failure`, `downgrade_notice`, `unverified_warning`); owner-gated dispatch via `BrokerageMembership.without_deleted` (Phase 22-02)
3. `Ops::PlanController` + `freeze_custom_domains!`/`unfreeze_custom_domains!`; pending domain creation (D-08) + pending destroy branch; `DomainVerificationJob` + `DomainHealthJob` SolidQueue recurring jobs; `FakeJob` subclass pattern for Minitest 6 DNS testing (Phases 22-03 → 22-05)
4. `DomainRedirectMiddleware` Rack middleware: 301 from non-primary active/phasing-out/frozen domains; `insert_before ActionDispatch::Static`; eager-loaded primary lookup; DPRI-03 mailer integration tests (Phase 23)
5. `POST /v1/admin/domains/:id/verify` on-demand endpoint + `set_primary_on_verify` migration + frozen-domain inclusion in all list scopes (Phase 24-01)
6. Frontend: `DomainCard` (5-status variants, role-gated controls), `DomainCardList` (STATUS_ORDER sort), 4-step `AddDomainWizard` (conditional primary preference, live CNAME display), `useVerifyDomain` with rescue detection, delete dialogs for primary vs non-primary; status legend + help popover in header (Phases 24-02 → 24-04)

### What Worked

- **`FakeJob` subclass pattern** — Minitest 6.0.3 (Ruby 4.0.0) removed `Minitest::Mock` and `.stub`. The FakeJob subclass override was the cleanest solution and is now a canonical testing pattern for this codebase. Discovered early in Phase 22-05 and reused across Phase 24 tests.
- **Synchronous `verify` action pattern** — using `dns_resolves?` inline in the controller (rather than enqueuing a job and polling) gave the frontend a direct `{ verified }` response. Simple, testable, and mirrors the existing onboarding verify pattern. No state machine complexity needed.
- **`unfreeze_custom_domains!` using the `verified` flag** — restoring to `active` vs `pending` based on the existing `verified` column avoided any need to track pre-freeze status separately. The flag already captures the right state.
- **Rack middleware positioned correctly** — `insert_before ActionDispatch::Static` placed the redirect middleware after Rack::Cors. CORS OPTIONS preflight requests are handled correctly; no double-middleware bugs.
- **2-day velocity** — 11 plans across 3 phases in 2 days. The domain model was well-understood from v1.5; v1.6 added depth (jobs, mailers, middleware, UI) without requiring re-learning the data layer.

### What Was Inefficient

- **REQUIREMENTS.md checkbox sync** — seventh consecutive milestone with this gap. The traceability table in REQUIREMENTS.md still showed "Pending" for all Phase 24 requirements at close, despite all work being complete. The fix remains the same: update checkboxes at phase-close SUMMARY time, not milestone-close time.
- **Phase 24 had more surface area than estimated** — 4 plans covered backend endpoint, frontend types, components, and wiring. Plan 24-04 (context wiring + delete dialogs) was the heaviest; splitting off the context brain into its own plan earlier would have made each plan more focused.

### Patterns Established

- **`FakeJob` subclass for DNS testing**: `class FakeJob < RealJob; def cname_resolves_to_subdomain?(...) = false; end` — canonical for Minitest 6 in this codebase; no module prepend, no teardown complexity
- **`alias_method :create, :update` for dual-method endpoints**: enables POST alongside PATCH/PUT without duplicating action code — use for operational/JSON-ops endpoints
- **`require_relative` for middleware in application.rb**: any middleware loaded at boot time (before Zeitwerk autoload) must use `require_relative`; Zeitwerk is not yet active at middleware registration
- **Rescue detection via `onMutate` snapshot**: capture `previousStatus` before mutation fires; compare in `onSuccess` to detect state change (phasing_out → active = rescue)
- **Domain UI header pattern**: status legend (badge + description row) + help popover (HelpCircle icon inline with h1) — established for any complex admin page with multiple status types

### Key Lessons

- **REQUIREMENTS.md sync is now a 7-milestone pattern** — this will not self-resolve. The intervention must happen at the workflow level: add a `## Requirements covered` section to the PLAN.md template and check off REQ-IDs as part of SUMMARY generation.
- **`BrokerageDomain` is not paranoid** — unlike every other user-facing model, `BrokerageDomain` does not include `acts_as_paranoid`. Plain status scopes (`where(status: ...)`) are correct. Do not add `.without_deleted` to `BrokerageDomain` queries. Document this exception explicitly in CLAUDE.md.
- **Minitest 6 stub incompatibility is now a known constraint** — Ruby 4.0.0 ships with Minitest 6.0.3 which removed `Minitest::Mock` and `.stub`. Every test that needs to stub DNS, HTTP, or job behavior must use a subclass override pattern. Add this to CLAUDE.md testing constraints.

### Cost Observations

- Sessions: ~2 across 2 days
- Model: Claude Sonnet 4.6 throughout
- Notable: 11 plans in 2 days at 5.5 plans/day — fastest milestone to date; domain model familiarity from v1.5 and v1.6 Phase 22 removed all exploratory overhead from Phases 23–24

---

## Milestone: v1.5 — Domain Management

**Shipped:** 2026-05-29
**Phases:** 3 (19–21) | **Plans:** 10 | **Timeline:** 3 days (2026-05-27 → 2026-05-29)

### What Was Built

1. `brokerage_domains` lifecycle schema: 4 columns (`domain_type`, `status`, `is_primary`, `phase_out_at`), SQL backfill, partial unique index `WHERE status != 'decommissioned'`; `BrokerageDomain` model enums + `RESERVED_SLUGS` + routable scope + slug validations; `BrokerageAuth` + `DomainsController#check` updated to status-based scopes (Phase 19)
2. Domain backend API: `phase_out!/decommission!` lifecycle helpers, `phasing_out_count_for`, `BrokerageDomainSerializer`; rebuilt `V1::Admin::DomainsController` with 5 actions + 21 integration tests + Pro-tier gate + slot-block/warning logic; public `GET /v1/domains/lookup` (9 tests); `InvitationMailer` → `is_primary: true` (3 mailer tests) (Phase 20)
3. Frontend redirect guard: `PrimaryDomainRedirect` layout-route using `window.location.replace`, `lookupDomain` BASE axios, Vitest coverage (Phase 21)
4. Full Domains admin page: `DomainsAdminView` + `useDomainsAdminContext` brain; `DomainCard` with type/status/countdown badges; `SubdomainCardEditForm` with `validateSlug`; `FreeSlotAccordion` + `SlotBanner` slot management; `RemoveNowDialog`; `CustomDomainsProGate`; "Domains" nav in both sidebars; UAT 6/7 passed + 2 bugs fixed (Phase 21)

### What Worked

- **Phase 20 backend was highly modular** — splitting into lifecycle foundation (20-01), controller rebuild (20-02), and public endpoint + mailer (20-03) allowed each plan to complete independently without merge conflicts. The 3-wave approach was well-calibrated to the actual dependency graph.
- **`window.location.replace` for redirect guard** — the decision to use `replace()` over `window.location.href =` eliminated the back-button redirect loop before it could become a bug. UAT test 7 validated this directly.
- **UAT caught two important bugs** — missing Domains card in the PortalShell 2×2 grid and `isPrimary` badge showing on phasing-out domains. Both were concrete functional bugs that test suite couldn't catch; human verification was essential.
- **Pro-tier gate + slot logic co-located in controller** — keeping `phasing_out_count_for` on the model and slot checking in the controller (not in a query object) kept the API layer readable and testable; 21 integration tests verified all edge cases.

### What Was Inefficient

- **REQUIREMENTS.md checkbox sync** — sixth consecutive milestone with the same gap. Phase 20 completed all 11 DMOD/DINT requirements but zero checkboxes were updated. The fix is clear and has been stated five times: update at phase close in `/gsd-execute-phase`. This is now the recurring issue of the project.
- **Phase 21 UAT needed a second pass** — two bugs found in UAT required immediate fixes before milestone close. Both were testable behaviors (card presence, badge conditional logic) that could have been caught in Phase 21 code review. Review was completed but these were missed.
- **No milestone audit** — third consecutive milestone without `gsd-audit-milestone`. Human UAT covered the main flows; cross-phase integration gaps remain unaudited.

### Patterns Established

- **Lifecycle state machine in model**: `phase_out!` and `decommission!` as named transitions on the model; slot counting (`phasing_out_count_for(type)`) on the parent model — not in the controller
- **Partial unique index pattern**: `WHERE status != 'decommissioned'` allows reusing domain names after decommission without a separate deleted_at guard
- **`window.location.replace` for transparent redirect guards**: prevents history pollution; use over `href =` whenever the redirect should be invisible to back-button navigation
- **BASE axios for public endpoints**: unauthenticated API calls use BASE axios instance (no auth token); authenticated calls use the default Axios instance

### Key Lessons

- **REQUIREMENTS.md sync is now a 6-milestone pattern** — the lesson is concrete: the workflow change must happen at `/gsd-execute-phase` level, not documentation. Adding a post-SUMMARY step to mark requirements checked would close this gap permanently.
- **Slot-block/warning logic is a good candidate for model-level helpers** — `phasing_out_count_for` on `Brokerage` makes the controller thin and the logic testable in isolation. Expand this pattern for any future resource-constrained operations.
- **UAT before milestone close is non-negotiable for UI features** — both v1.4 and v1.5 found functional bugs in UAT that passed code review. Keep UAT as a required step before every milestone close with UI changes.

### Cost Observations

- Sessions: ~3 across 3 days
- Model: Claude Sonnet 4.6 throughout
- Notable: 10 plans in 3 days at ~3.3 plans/day; consistent velocity with previous milestones; Phase 20 backend plans were thorough (21 integration tests)

---

## Milestone: v1.4 — Main Domain Admin Portal

**Shipped:** 2026-05-27
**Phases:** 4 (15–18) | **Plans:** 11 | **Timeline:** 3 days (2026-05-24 → 2026-05-27)

### What Was Built

1. `BrokerageAuth` X-Brokerage-Id branch; `GET /v1/account/admin_brokerages` cross-brokerage endpoint with `MainDomainOnly + CognitoAuth`; 8 integration tests covering BE-01–03 (Phase 15)
2. `useFetchAdminBrokerages` imperative hook; `NoAccess` screen; `LoginSuccessful` + `Login.tsx` domain-aware post-sign-in routing; portal routes in `main.tsx`; auth promoted to top-level router array (Phase 16)
3. `activeBrokerage` Redux slice; `BrokerageSelection` screen with anti-flash guard; `PortalShell` with D-12/D-13 patterns; `SuccessStep` wizard redirect to main domain (Phase 17)
4. Axios X-Brokerage-Id interceptor injection; `RequireRole` isMainDomain() bypass; `PortalNavBar` brokerage switcher; `PortalShell` real landing page with 4 admin section cards; `AdminDomainShell` domain-adaptive delegation (Phase 18)

### What Worked

- **Login.tsx deviation caught fast** — Phase 16 human verification (Scenario C) revealed that email/password sign-in bypasses `LoginSuccessful` entirely. The test was specific enough to catch it; the fix was targeted and clean. This is the value of scenario-level human verification, not just "did the build pass."
- **Redux store for brokerage context** — using Redux for `activeBrokerage` meant `PortalNavBar`, `PortalShell`, and the Axios interceptor could all read the same state without prop drilling or additional API calls. The D-13 pattern (re-fetch on empty Redux on page reload) handled the edge case cleanly.
- **`AdminDomainShell` single-route pattern** — delegating to either `PortalAdminShell` or `AppShellAdmin` from one route definition avoided React Router path conflicts from domain-guarded duplicate /admin/ blocks. Straightforward solution to a subtle router constraint.
- **`isMainDomain()` bypass BEFORE `isUserLoaded` in RequireRole** — pre-execution analysis identified that `account.id` is never populated on the main domain; placing the bypass first prevented the blank-panel trap before execution began.
- **Wave-based parallel planning worked cleanly** — Plan 18-03 (PortalNavBar) and 18-01 (Axios interceptor) ran in Wave 1 in parallel; both were independent and completed without merge conflicts.

### What Was Inefficient

- **REQUIREMENTS.md checkbox sync** — fifth consecutive milestone with the same gap. 7 of 14 requirements were unchecked at milestone close despite being implemented weeks earlier. The fix is clear: update checkboxes at each phase close, not just at milestone close. Still not on the phase-close checklist.
- **Phase 18 plan count growth** — started at 4 plans (2 waves), ended at 5 plans (3 waves) after `AdminDomainShell` was added as Wave 3. The domain-adaptive shell requirement was discoverable earlier during Phase 18 planning; a discuss step would have caught it.
- **No milestone audit** — proceeding without `gsd-audit-milestone` for the second consecutive milestone. Human UAT covered the main flows; cross-phase integration gaps remain unaudited.

### Patterns Established

- **Cross-brokerage endpoint module order**: `include MainDomainOnly` first, `include CognitoAuth` second, no BrokerageAuth + `skip_brokerage_membership? = true` defense-in-depth
- **Imperative hook for fire-once lifecycle components**: thin hook returning the API function directly for `useEffect` fire-once patterns (vs. useQuery for reactive data)
- **`setToken` before API calls in sign-in flows**: axios interceptor reads `localStorage auth_token`; reversed order → 401. Document this ordering constraint explicitly.
- **D-13 empty-Redux re-fetch pattern**: check `adminBrokerages.length === 0` on mount, re-fetch via hook, show accessible spinner, validate on resolve — handles page reload without extra state
- **Domain-adaptive shell delegation**: `isMainDomain()` called directly in render (stable per page lifecycle, no hook needed); delegate to correct shell component

### Key Lessons

- **REQUIREMENTS.md sync is a persistent gap across five milestones** — the lesson is now five iterations old. The correct fix: add checkbox updates to the SUMMARY.md generation step in `/gsd-execute-phase`, not just at milestone close.
- **Both sign-in paths need the same domain-aware logic** — any feature that hooks into post-sign-in behavior must be wired into both `LoginSuccessful.tsx` (OAuth/hosted-UI) and `Login.tsx` (email/password). These paths are always both active. Add this to the new-feature checklist.
- **Redux is worth the overhead for cross-component shared state** — the `activeBrokerage` slice was used by 5+ components across 4 phases. The upfront cost of Plan 17-01 paid off immediately in Plans 17-02, 17-03, 18-01, 18-03, and 18-04.

### Cost Observations

- Sessions: ~3 across 3 days
- Model: Claude Sonnet 4.6 throughout
- Notable: 11 plans in 3 days at ~3.7 plans/day; consistent with v1.3 velocity; most plans completed in 2–10 minutes

---

## Milestone: v1.3 — Test Board & Board Management

**Shipped:** 2026-05-24
**Phases:** 4 | **Plans:** 11 | **Timeline:** 3 days (2026-05-21 → 2026-05-24)

### What Was Built

1. `is_test_board` column + `test_boards`/`real_boards` scopes; seed overhaul: single TEST board, 100 NV listings with hardcoded unique coordinates, no pre-attached BrokerageEstate rows
2. Board connect backend: conditional RETS validation, `BrokerageEstate.insert_all` idempotency, `Estate#accessible_by` scope restructure (outer JOIN removed, `is_test_board` filter moved inside EXISTS)
3. Fixed pre-existing AR Encryption bug: `encrypts :rets_username_ciphertext` (column name) — had prevented all BrokerageBoardCredential saves since initial implementation
4. `ConnectBoardDialog` test-board-info step: bypass credentials, blue notice, server error handling (mirrored from credentials step pattern)
5. `DELETE`/`PATCH /v1/admin/board_credentials/:id` with IDOR scoping + 10 integration tests; `EditBoardCredentialDialog` + 5-column `BoardRegistrations` with controlled `AlertDialog`

### What Worked

- **AR Encryption bug surfaced immediately** — Plan 12-01 unit tests required actual DB saves; the first test run caught the `PG::NotNullViolation` immediately. Without the test suite, this bug would have reached production.
- **Controlled AlertDialog pattern** — choosing `open` prop + `deleteTarget` state (outside the Radix dropdown tree) at the start of Phase 14 avoided the portal/focus conflict discovered during prior work
- **Per-street lat band strategy** — the coordinate uniqueness bug (76 of 100 unique) was caught during seed verification in Phase 11. The systematic band approach (49.3200 + 0.0001 steps per street) is a reusable pattern for future seed files needing unique numeric values
- **`Estate#accessible_by` scope restructure** — identifying that the outer `JOIN + merge` would drop all test-board estates before EXISTS ran was critical pre-12-03 analysis; fixing it in one targeted plan kept scope clean

### What Was Inefficient

- **REQUIREMENTS.md checkbox sync** — same gap as v1.0, v1.1, v1.2: 6 of 12 requirements were unchecked at milestone close even though all work was done. The REQUIREMENTS.md was not updated at each phase close. This is the fourth consecutive milestone with the same issue.
- **No milestone audit** — proceeding without `gsd-audit-milestone` means cross-phase integration was verified through human UAT only, not automated checks

### Patterns Established

- **AR Encryption + `_ciphertext` column naming**: `encrypts :rets_username_ciphertext` (column name), expose friendly accessor manually — settled pattern for this codebase
- **Controlled `AlertDialog` outside Radix dropdown tree**: `open` prop + single `deleteTarget` state pointer — canonical pattern when trigger is inside `DropdownMenuItem`
- **Fire-and-forget delete + propagating update hook pair**: `useDeleteBoardCredential` (mutate + onError toast) vs `useUpdateBoardCredential` (mutateAsync, no onError — dialog catches rejection)
- **Per-street lat band uniqueness**: base lat per street (N × 0.0010 increment) + 0.0001 step per entry — guarantees N×M unique values without exceeding 4 decimal places
- **`db:seed:replant` for neondb**: neondb connection proxy prevents `db:reset`; `replant` tests identical code path

### Key Lessons

- **REQUIREMENTS.md sync is a persistent gap** — four consecutive milestones with the same issue. The fix is to update REQUIREMENTS.md checkboxes at each phase close, not just at milestone close. Worth adding to the phase-close checklist explicitly.
- **Integration tests are the best bug detector** — the AR Encryption bug had been silently present since Phase 1; model unit tests in Phase 12-01 caught it in minutes. Every new model with complex associations should get unit tests at creation time.
- **Test-board bypass scope is fragile** — `is_test_board? || Rails.env.development?` is a workaround for the test environment; a more principled approach would separate test-board logic from dev-environment logic

### Cost Observations

- Sessions: 3–4 across 3 days
- Model: Claude Sonnet 4.6 throughout
- Notable: 11 plans in 3 days; most plans executed in 2–5 minutes; AR Encryption fix was the longest single investigation (~20 minutes including root cause analysis)

---

## Milestone: v1.2 — Listing Map View

**Shipped:** 2026-05-18
**Phases:** 3 | **Plans:** 7 | **Timeline:** 2 days (2026-05-16 → 2026-05-18)

### What Was Built

1. Nominatim geocoding pipeline — `GeocodingService` + `GeocodeListingsJob` (retry/discard) + `geocode:backfill` rake task; `decimal(10,6)` lat/lng columns on `listing_details`
2. `GET /coordinates` endpoint — filter-forwarding, null-coord-excluding lightweight projection; 6 integration tests
3. `GroupMapPanel` (react-map-gl + use-supercluster, clustering, popups) wired into GeneralDashboard with `keepPreviousData` filter sync
4. `EstateLocationMap` single-pin listing detail map — conditional on coordinates, outside tab system

### What Worked

- **Mapbox migration mid-phase** — discovering that Mapbox was the better fit (Plan 03 revision) before Plan 04 executed avoided a painful rewrite; CONTEXT.md made the rationale clear for Phase 10 to follow
- **Custom Marker child pattern** — react-map-gl v8 childless Marker click issue was caught during human verification and fixed immediately; the fix is now documented in the SUMMARY as a reusable pattern
- **`fitBounds` guard** — identifying the re-centering UX problem early (RESEARCH.md Pitfall) and solving it with a simple ref avoided a latent user complaint
- **Phase 10 followed Phase 9 patterns exactly** — same entry point, same cooperativeGestures, same fill-primary pin; zero new decisions needed

### What Was Inefficient

- REQUIREMENTS.md checkbox sync — MAP-02/03/05/06 were never checked off during Phase 9 close; required manual reconciliation at milestone archive (same lesson as v1.0, still not resolved)
- Google Maps libs installed in Plan 03, then migrated to Mapbox in Plan 03 revised — adding one exploratory research step before Plan 03 would have caught this before any npm installs

### Patterns Established

- `react-map-gl/mapbox` entry point (not `react-map-gl`) — always use for Mapbox GL JS v3 compatibility
- Custom `<button>` child on `<Marker>` with `e.stopPropagation()` — required for reliable click events in react-map-gl v8
- `hasFitBoundsRef` + `fitBounds` on first load only — standard pattern for map panels that filter-sync
- `hero_image_url || images[0]` fallback in coordinates SELECT — defensive against seed data gaps

### Key Lessons

- REQUIREMENTS.md checkbox sync needs to happen at each phase close, not just at milestone close — the same gap appeared in v1.0 and v1.2; worth adding a reminder to the phase close checklist
- Migration from one mapping library to another mid-phase is cheap when done before implementation starts, expensive after — spike/research should explicitly evaluate library fit before installation
- `decimal(10,6)` for coordinates is settled — this is the project standard; no need to revisit

### Cost Observations

- Sessions: 3–4 across 2 days
- Model: Claude Sonnet 4.6 throughout
- Notable: 2 days for 7 plans including human verification; fast because Phase 9's patterns made Phase 10 a copy-and-simplify exercise

---

## Milestone: v1.1 — Domain Access Control

**Shipped:** 2026-05-16
**Phases:** 2 | **Plans:** 2 | **Timeline:** 3 days (2026-05-13 → 2026-05-16)

### What Was Built

1. `isMainDomain()` + `DomainGuard` React components — `SubdomainOnly`/`MainDomainOnly` route wrappers, NotFound page, env-driven config
2. `MainDomainOnly` Rails concern — Origin-first extraction, ENV.fetch config, fires before Cognito auth, 5 integration tests

### What Worked

- Single-plan phases kept execution fast and reviewable — no cross-plan dependencies to coordinate
- Planning artifacts (RESEARCH.md, PATTERNS.md, code examples in PLAN.md) let executor work without codebase exploration
- Code review caught 2 pre-existing critical bugs surfaced by touching those files — good habit to keep

### What Was Inefficient

- Milestone had only 2 plans — could have been batched into one phase if scoped together earlier

### Patterns Established

- Guard ordering rule: `include MainDomainOnly` before `include CognitoAuth` — domain check fires before auth
- Frontend guard pattern: named exports, Outlet pass-through, no default exports
- Code review generates CR/WR/IN findings even for small phases — useful for catching pre-existing issues

### Key Lessons

- UX guards (frontend) and security boundaries (backend) must be treated as separate concerns with explicit handoff documentation; Phase 6 decision 06-01 made this explicit
- Small milestones close fast but may not justify full research/discuss overhead; consider lighter-weight planning for single-phase milestones

---

## Milestone: v1.0 — Security, OAuth & Calendar

**Shipped:** 2026-05-13
**Phases:** 5 | **Plans:** 30 | **Timeline:** 14 days (2026-04-29 → 2026-05-13)

### What Was Built

1. `Admin::BaseController#require_admin!` closed the RBAC gap across all 13 admin controllers; rack-attack rate limiting; BrokerageDomain CORS proc; N+1 elimination; per_page caps; tech debt cleanup (console.log, rename, dead component)
2. 17 backend integration tests (Minitest) + 7 frontend unit tests (Vitest 4.x + MSW 2.x) — tenant isolation, RBAC, FilterSets, GroupEstatesQuery, InvitationsController, ProtectedRoute, RequireRole, GoogleSignInButton
3. Domain wizard end-to-end; post-invite redirect to correct brokerage workspace; dismissible welcome banner
4. Google OAuth via Cognito federation + PreSignUp Lambda with `AdminLinkProviderForUser` + static intermediary callback page + "Sign in with Google" button + "Connected via Google" badge
5. `UserCalendarConnection` (AR Encryption) + `EstateDateCalendarEvent` + `CalendarSyncJob` (advisory lock, deterministic IDs) + Google Calendar adapter + CalendarTab settings UI

### What Worked

- **Wave-based parallel planning** — multi-plan phases ran in parallel waves (e.g., Phase 5 had 5 waves) without coordination overhead
- **Atomic "button + Lambda" constraint** — enforcing Phase 4 to ship GoogleSignInButton and PreSignUp Lambda together prevented a broken intermediate state
- **Fixed intermediary callback URL** — designing the `auth.realtybase.ca` strategy before Phase 4 planning eliminated the multi-tenant OAuth redirect problem entirely
- **Advisory lock pattern for CalendarSyncJob** — solved concurrent token refresh races upfront; no retries needed after deployment

### What Was Inefficient

- REQUIREMENTS.md checkboxes were never kept in sync with delivery — PROJECT.md Validated section became the live tracker, making the archive step require manual reconciliation
- The `04-05-SUMMARY.md` extra file in Phase 4 (5 summaries for 4 plans) suggests a stray file that should have been cleaned up at phase close
- Calendar migrations not applied to Render.com — required a separate out-of-band step after Phase 5 Plans were complete; could have been caught earlier with a deployment checklist

### Patterns Established

- `PROVIDERS = %w[google].freeze` + `providerOrder = ['google']` as the single activation point for new calendar providers — activate Microsoft/Apple by expanding these two constants
- `CalendarContext` co-located in `containers/account/` as a parallel hook to `AccountContext` — not extending it (separation of concerns)
- `useMutation` for OAuth authorize GET (not `useQuery`) — OAuth redirects are side effects, not data fetches
- Advisory lock on `UserCalendarConnection.id` for token refresh serialization

### Key Lessons

- Scope deferred work explicitly at the activation point (PROVIDERS constant) rather than just "not implementing it" — makes future activation a 1-line change, not a discovery task
- REQUIREMENTS.md needs a lightweight sync step at each phase close, not just at milestone close — consider a `gsd-check-requirements` pass after each plan
- Static OAuth callback pages (no React, just Amplify CDN) work well for the intermediary callback pattern — worth reusing for future provider additions

### Cost Observations

- Sessions: multiple across 14 days
- Model: Claude Sonnet 4.6 throughout
- Notable: wave-based parallel execution kept single-session context manageable; most phases completed in under 10 minutes per plan

---

## Cross-Milestone Trends

| Metric | v1.0 | v1.1 | v1.2 | v1.3 | v1.4 | v1.5 | v1.6 |
|--------|------|------|------|------|------|------|------|
| Phases | 5 | 2 | 3 | 4 | 4 | 3 | 3 |
| Plans | 30 | 2 | 7 | 11 | 11 | 10 | 11 |
| Days | 14 | 3 | 2 | 3 | 3 | 3 | 2 |
| Avg plans/day | 2.1 | 0.7 | 3.5 | 3.7 | 3.7 | 3.3 | 5.5 |
| Deferred items at close | 2 | 2 | 0 | 4 | 4 | 1 | 1 |
| REQUIREMENTS.md sync gap | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

**Trend:** Velocity peaked at 5.5 plans/day in v1.6 — domain model familiarity from v1.5 eliminated exploratory overhead. REQUIREMENTS.md checkbox sync gap is now seven consecutive milestones — fix must be at the workflow level (PLAN.md template, not milestone-close checklist). Deferred items trending down (4 → 1 → 1). Both sign-in paths (`LoginSuccessful` + `Login.tsx`) require the same domain-aware logic — established as new-feature checklist rule.
