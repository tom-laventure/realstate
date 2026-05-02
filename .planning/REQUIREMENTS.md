# Requirements — Milestone 2

**Project:** RealState SaaS Platform
**Updated:** 2026-04-30
**Status:** Approved

---

## v1 Requirements

### Security & Authorization

- [ ] **SEC-01**: `Admin::BaseController#require_admin!` before_action enforces owner/admin role on all `/v1/admin/**` endpoints; returns `{ error: { code: "forbidden", message: "..." } }` with HTTP 403 for any other role
- [x] **SEC-02**: User can sign in without test credentials pre-filled — remove `defaultValue` email and password from sign-in component
- [ ] **SEC-03**: CORS origin check uses a dynamic proc that validates `request.host` against `BrokerageDomain` records — supports unlimited dynamic subdomains and custom domains without a hardcoded allowlist
- [ ] **SEC-04**: `POST /v1/sessions` is rate-limited via `rack-attack` with a shared-store-aware counter (PostgreSQL-backed or Redis) to prevent brute-force across Puma workers
- [x] **SEC-05**: Dead `Group#order_estates`, `estates_ordered_by_avg_rating`, `estates_ordered_by_user_rating`, `estates_ordered_by_created_at` methods are removed (eliminate SQL injection risk from unparameterized string interpolation)
- [x] **SEC-06**: `InvitationsController` no longer crashes on create or accept — `current_user` calls replaced with `Current.user` throughout
- [x] **SEC-07**: `FilterSetsController#create` estate cleanup is group-scoped: `GroupEstate.where(group: @group, group_filter_set_id: previous_active_id)` prevents cross-group deletion
- [x] **SEC-08**: Axios interceptor handles 403 responses by redirecting to the dashboard and showing an access-denied toast — it does not log out the user (401 continues to logout as before)

### Google OAuth (Social Login)

- [ ] **AUTH-01**: Google is configured as a federated identity provider in the Cognito user pool; a fixed intermediary callback URL (e.g. `auth.realtybase.ca/oauth/callback`) receives all OAuth redirects, extracts brokerage domain from the `state` parameter, and completes the per-tenant session exchange — this is mandatory given dynamic tenant domains
- [ ] **AUTH-02**: Cognito Pre Sign-Up Lambda calls `AdminLinkProviderForUser` when a Google sign-in matches an existing email/password user; Lambda verifies `email_verified: true` on the Google claim before linking to prevent account takeover; first-link exception handled gracefully on the frontend
- [ ] **AUTH-03**: User can click "Sign in with Google" on the login screen; on success, Amplify Hub fires `signInWithRedirect`, `fetchAuthSession()` retrieves the Cognito idToken, which is exchanged at `POST /v1/sessions` for the app's HS256 JWT
- [ ] **AUTH-04**: User sees a "Connected via Google" badge in their account settings when signed in via Google federation

### Onboarding Fixes

- [ ] **ONB-01**: Brokerage owner can complete the domain setup step end-to-end: domain format is validated client-side (regex) and server-side (uniqueness); save persists a `BrokerageDomain` record; confirmation is shown before advancing to the next wizard step; wizard does not advance on save failure
- [ ] **ONB-02**: User who accepts a brokerage invitation is redirected to the brokerage workspace (correct tenant domain + dashboard) — not the homepage or a blank screen
- [ ] **ONB-03**: New brokerage member sees a dismissible welcome banner on their first dashboard visit showing the brokerage name and their assigned groups

### Calendar Sync

- [ ] **CAL-01**: `user_calendar_connections` table stores one row per user per provider (`google`, `microsoft`, `apple`) with `status`, `last_synced_at`, `last_error`, encrypted credentials (ActiveRecord Encryption for Apple app-specific password)
- [ ] **CAL-02**: User can view, connect, and disconnect calendar providers from their profile settings; each provider shows connection status (`connected`, `error`, `disconnected`) and last sync time
- [ ] **CAL-03**: User can connect Google Calendar via OAuth2; `EstateDate` create/update/delete events are synced to the connected Google Calendar automatically
- [ ] **CAL-04**: User can connect Microsoft Calendar via OAuth2 (Azure AD v2.0 + Microsoft Graph); `EstateDate` events are synced
- [ ] **CAL-05**: User can connect Apple iCloud Calendar by entering their iCloud email and an app-specific password (no OAuth — Apple CalDAV does not support OAuth2); `EstateDate` events are synced via CalDAV
- [ ] **CAL-06**: All calendar writes go through `CalendarSyncJob` (SolidQueue); the job uses a deterministic provider event ID derived from `EstateDate.id` for idempotent retries; concurrent token refresh is serialized via PostgreSQL advisory locks on `UserCalendarConnection.id`
- [ ] **CAL-07**: User sees a sync failure indicator per provider in the settings panel when a calendar write fails; a "Re-sync" button re-enqueues the job for that provider without requiring reconnection

### Test Suite

- [x] **TEST-01**: Backend test infrastructure: `factory_bot_rails` + `shoulda-matchers` installed; `AuthHelper` module mints JWTs via `TokenService.issue(user)`; `Current.reset` teardown in `ActiveSupport::TestCase` prevents `CurrentAttributes` leakage between tests
- [ ] **TEST-02**: Integration test confirms a user from Brokerage A cannot access Brokerage B data — requests with Brokerage B `Host` header and Brokerage A JWT return 403 or 404
- [ ] **TEST-03**: Integration test confirms agent/client roles receive 403 on all `/v1/admin/**` endpoints; owner/admin roles receive 200
- [ ] **TEST-04**: Integration test confirms `FilterSetsController#create` correctly moves estates and destroys previous filter set estates scoped to the correct group
- [ ] **TEST-05**: Integration tests confirm `GroupEstatesQuery` price range filtering, sort by price, and sort by rating return correct record sets
- [ ] **TEST-06**: Integration test confirms `InvitationsController#create` and `#accept_invitation` succeed without crashing (covers the `Current.user` fix)
- [ ] **TEST-07**: Frontend test infrastructure: Vitest + jsdom + MSW installed; `renderWithProviders` helper wraps components in a fresh `QueryClientProvider` per test; MSW server configured with `beforeAll`/`afterEach`/`afterAll` lifecycle
- [ ] **TEST-08**: Frontend tests confirm `ProtectedRoute` redirects unauthenticated users to login; `RequireRole` hides restricted UI from non-matching roles
- [ ] **TEST-09**: Frontend tests confirm the Google OAuth login flow: "Sign in with Google" click calls `signInWithRedirect`; Hub `signInWithRedirect` event triggers session exchange with mocked `fetchAuthSession`

### Performance

- [x] **PERF-01**: `EstateLike` N+1 eliminated — both estates index actions (dashboard + admin) bulk-compute `liked_ge_ids = EstateLike.where(user_id:, group_estate_id:).pluck(:group_estate_id).to_set` and pass it as `instance_options`
- [x] **PERF-02**: `EstateEventSerializer` N+1 eliminated — event query scope includes `.includes(rsvps: :user)` before serialization
- [x] **PERF-03**: All 6 uncapped controllers enforce `per_page = [per_page.to_i, 100].min` before passing to Pagy

### Tech Debt

- [ ] **DEBT-01**: All `console.log` statements removed from production source files; ESLint `no-console` rule added to prevent regression
- [ ] **DEBT-02**: `frontend/src/components/view/admin/usersAminView/` renamed to `usersAdminView`; all imports updated
- [x] **DEBT-03**: `BrokerageBoardCredential` has an `enum :status, { active: "active", invalid: "invalid" }` declaration (replaces string inclusion validation)
- [x] **DEBT-04**: `GroupEstatesQuery` price range filtering and sorting uses `listing_details.price_numeric` decimal column (eliminates `CAST(... AS REAL)` workaround)
- [ ] **DEBT-05**: Dead `FilterByPopup` component deleted (imports non-existent `framer-motion`)
- [x] **DEBT-06**: Brokerage domain resolution log in `BrokerageAuth` lowered from `info` to `debug`
- [x] **DEBT-07**: Unused `paginate` lambda removed from `Pagination` concern

---

## v2 (Deferred)

- Apple / Microsoft social login — only Google OAuth for this milestone
- Two-way calendar sync (requires webhooks, conflict resolution, read permissions)
- "Connect Google from profile settings" for existing email/password users (needs `adminLinkProviderForUser` from frontend — separate from PreSignUp Lambda flow)
- JWT → HttpOnly cookies migration
- Redux → Context/TanStack Query migration
- SCSS → Tailwind migration (incremental only)
- Admin directory restructure
- TanStack Query v4 → v5 upgrade
- `ActivityQuery` SQL UNION optimization
- Audit log of 403 rejections

---

## Out of Scope

- Pundit / CanCanCan — authorization stays imperative per project convention; `Admin::BaseController#require_admin!` is sufficient for current complexity
- Per-resource RBAC beyond owner/admin/member split — not required by current domain
- Multi-provider OIDC (GitHub, Facebook, etc.) — no user demand identified
- Apple CalDAV via OAuth (Apple Business Manager) — Apple does not support OAuth2 for personal CalDAV; app-specific password is the only path for iCloud

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 through SEC-08 | Phase 1: Security Foundation | Pending |
| PERF-01 through PERF-03 | Phase 1: Security Foundation | Complete |
| DEBT-01 through DEBT-07 | Phase 1: Security Foundation | Pending |
| TEST-01 through TEST-09 | Phase 2: Test Suite | Pending |
| ONB-01 through ONB-03 | Phase 3: Onboarding Fixes | Pending |
| AUTH-01 through AUTH-04 | Phase 4: Google OAuth | Pending |
| CAL-01 through CAL-07 | Phase 5: Calendar Sync | Pending |

---

*Requirements approved: 2026-04-30*
