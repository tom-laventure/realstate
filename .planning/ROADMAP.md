# Roadmap: RealState SaaS — Milestone 2

## Overview

Milestone 2 hardens the platform before expanding it. Phase 1 closes the active RBAC gap and removes all documented security/debt issues. Phase 2 builds the test suite immediately after, proving Phase 1 works. Phase 3 fixes the two broken onboarding flows that block new user activation. Phase 4 ships Google social login as a single atomic change (Lambda + button must land together). Phase 5 delivers personal calendar sync — model and job infrastructure first, then Google, Microsoft, and Apple providers in sequence.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Security Foundation** - Close RBAC gap, remove hardcoded credentials, tighten CORS/rate-limiting, fix crashes, eliminate N+1s and tech debt *(Complete 2026-05-02)*
- [x] **Phase 2: Test Suite** - Build backend and frontend test infrastructure from scratch; test every change made in Phase 1 *(Complete 2026-05-03)*
- [ ] **Phase 3: Onboarding Fixes** - Fix domain setup wizard, post-join redirect, and welcome banner
- [ ] **Phase 4: Google OAuth** - Cognito federation + intermediary callback + PreSignUp Lambda + frontend button, shipped atomically
- [ ] **Phase 5: Calendar Sync** - UserCalendarConnection model + CalendarSyncJob + Google, Microsoft, and Apple calendar providers + settings UI

## Phase Details

### Phase 1: Security Foundation
**Goal**: The platform enforces authorization server-side and contains no hardcoded credentials, injection risks, N+1 queries, or console leakage
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07, SEC-08, PERF-01, PERF-02, PERF-03, DEBT-01, DEBT-02, DEBT-03, DEBT-04, DEBT-05, DEBT-06, DEBT-07
**Success Criteria** (what must be TRUE):
  1. An agent or client role hitting any `/v1/admin/**` endpoint receives a 403 JSON response — not a 200, not a crash
  2. The login screen renders with empty email and password fields — no test credentials pre-filled
  3. A 403 response from the API causes the frontend to redirect to the dashboard and show an access-denied toast; the user remains logged in
  4. Sending more than the configured request count to `POST /v1/sessions` within the rate-limit window returns 429 responses consistently across Puma workers
  5. All 6 previously uncapped controllers reject `per_page` values above 100 and enforce the cap silently
**Plans**: 7 plans

Plans:
- [x] 01-01-PLAN.md — Install rack-attack + solid_cache gems, run migrations, set config.cache_store in environments
- [x] 01-02-PLAN.md — Create V1::Admin::BaseController, update all 13 admin controllers to inherit it
- [x] 01-03-PLAN.md — Replace CORS wildcard with BrokerageDomain proc, create rack_attack.rb initializer, add dev seeds
- [x] 01-04-PLAN.md — Fix SEC-05/06/07 bugs, add DEBT-03 enum, lower DEBT-06 log level, remove DEBT-07 Pagination concern
- [x] 01-05-PLAN.md — Fix PERF-01 EstateLike N+1, verify PERF-02, cap per_page on 7 controllers (PERF-03), migrate DEBT-04 price_numeric
- [x] 01-06-PLAN.md — Remove SEC-02 hardcoded credentials, add SEC-08 Axios 403 handler with toast
- [x] 01-07-PLAN.md — Remove DEBT-01 console.logs + ESLint rule, rename DEBT-02 usersAminView, delete DEBT-05 FilterByPopup

### Phase 2: Test Suite
**Goal**: Backend and frontend test infrastructure exists; the highest-risk paths from Phase 1 are covered by passing automated tests
**Depends on**: Phase 1
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07, TEST-08, TEST-09
**Success Criteria** (what must be TRUE):
  1. `rails test` runs without errors; a Brokerage A JWT against a Brokerage B Host header returns 403 or 404 in the tenant isolation test
  2. The admin authorization test suite confirms agent and client roles are rejected from all `/v1/admin/**` endpoints and owner/admin roles are accepted
  3. `npm run test` runs without errors; `ProtectedRoute` redirects unauthenticated users to login and `RequireRole` hides restricted UI from non-matching roles in the test suite
  4. The Google OAuth test confirms "Sign in with Google" click calls `signInWithRedirect` and the Hub event triggers session exchange with a mocked `fetchAuthSession`
**Plans**: 6 plans

Plans:
- [x] 02-01-PLAN.md — Install factory_bot_rails + shoulda-matchers, create test_helper.rb with AuthHelper + Current.reset, build 10 factory files
- [x] 02-02-PLAN.md — Tenant isolation test (TEST-02) + admin authorization tests for all 4 roles (TEST-03)
- [x] 02-03-PLAN.md — Add rating sort to GroupEstatesQuery, FilterSets cross-group safety test (TEST-04), price+rating query tests (TEST-05)
- [x] 02-04-PLAN.md — InvitationsController accept_token + validate_token integration tests (TEST-06)
- [x] 02-05-PLAN.md — Install Vitest + MSW + testing-library, create vitest.config.ts + renderWithProviders + MSW server setup (TEST-07)
- [x] 02-06-PLAN.md — GoogleSignInButton component (minimal skeleton) + ProtectedRoute/RequireRole/GoogleSignInButton tests (TEST-08, TEST-09)

### Phase 3: Onboarding Fixes
**Goal**: A new brokerage owner can complete domain setup without errors, and a new invitee lands on their brokerage workspace after accepting an invitation
**Depends on**: Phase 2
**Requirements**: ONB-01, ONB-02, ONB-03
**Success Criteria** (what must be TRUE):
  1. A brokerage owner can type a domain, see real-time format validation, save it, and see a confirmation — the wizard advances only after a successful save; a duplicate domain shows an error and does not advance
  2. A user who accepts a brokerage invitation lands on the brokerage dashboard (correct tenant domain) — not the homepage or a blank screen
  3. A new brokerage member sees a dismissible welcome banner on their first dashboard visit showing the brokerage name and their assigned groups; the banner does not reappear after dismissal
**Plans**: TBD

### Phase 4: Google OAuth
**Goal**: Users can sign in with Google; existing email/password accounts are automatically linked by email; the "Sign in with Google" button and the account-linking Lambda ship simultaneously
**Depends on**: Phase 3
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. A user on any brokerage subdomain can click "Sign in with Google", complete Google's consent screen, and land on their brokerage dashboard authenticated — the intermediary callback URL resolves the correct tenant and completes the session exchange
  2. A user with an existing email/password account who signs in with the same Google email is linked automatically — no duplicate account is created; they see their existing data
  3. A user signed in via Google sees a "Connected via Google" badge in their account settings
**Plans**: TBD
**UI hint**: yes

### Phase 5: Calendar Sync
**Goal**: Users can connect Google, Microsoft, and Apple calendars from their profile settings; EstateDate events sync automatically to connected calendars; sync failures are visible and recoverable without reconnecting
**Depends on**: Phase 4
**Requirements**: CAL-01, CAL-02, CAL-03, CAL-04, CAL-05, CAL-06, CAL-07
**Success Criteria** (what must be TRUE):
  1. The `user_calendar_connections` table exists with encrypted credential storage; the calendar management panel in user settings shows connected/disconnected/error status and last sync time for each of the three providers
  2. A user who connects Google Calendar sees new EstateDate events appear in their Google Calendar automatically; updating or deleting the EstateDate removes or updates the corresponding Google Calendar event
  3. A user who connects Microsoft Calendar via OAuth has EstateDate events synced to their Microsoft Calendar; a user who connects Apple iCloud Calendar by entering their app-specific password has EstateDate events synced via CalDAV
  4. When a calendar write fails, the provider card in settings shows a failure indicator with last error; clicking "Re-sync" re-enqueues the job without requiring the user to reconnect
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Foundation | 7/7 | Complete | 2026-05-02 |
| 2. Test Suite | 6/6 | Complete | 2026-05-03 |
| 3. Onboarding Fixes | 0/TBD | Not started | - |
| 4. Google OAuth | 0/TBD | Not started | - |
| 5. Calendar Sync | 0/TBD | Not started | - |
