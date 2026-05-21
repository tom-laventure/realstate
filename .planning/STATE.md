---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Listing Map View
status: archived
stopped_at: v1.2 archived 2026-05-21
last_updated: "2026-05-21T00:00:00.000Z"
last_activity: 2026-05-21 -- v1.2 milestone archived, tagged v1.2
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 7
  completed_plans: 7
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-16)

**Core value:** Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.
**Current focus:** v1.2 archived — planning next milestone

## Current Position

Phase: 10 (complete)
Plan: 10-01 (complete)
Status: v1.2 archived — ready for next milestone
Last activity: 2026-05-21

## Performance Metrics

**Velocity:**

- Total plans completed: 13
- Average duration: 6 min
- Total execution time: 37 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 8 | 2 | - | - |
| 09 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 06-frontend-domain-routing-guards P01 | 2min | 3 tasks | 7 files |
| Phase 04-google-oauth P01 | 4min | 2 tasks | 4 files |
| Phase 04-google-oauth P02 | 2 | - tasks | - files |
| Phase 04-google-oauth P03 | 1min | 2 tasks | 3 files |
| Phase 04-google-oauth P04 | 2min | 2 tasks | 5 files |
| Phase 05-calendar-sync P01 | 8min | 3 tasks | 8 files |
| Phase 05-calendar-sync P02 | 2min | 2 tasks | 3 files |
| Phase 05-calendar-sync P03 | 5min | 2 tasks | 3 files |
| Phase 05-calendar-sync P04 | 7min | 2 tasks | 4 files |
| Phase 05-calendar-sync P05 | 5min | 2 tasks | 2 files |
| Phase 08-geocoding-data-layer P01 | 2min | 2 tasks | 4 files |
| Phase 08-geocoding-data-layer P02 | 11min | 3 tasks | 5 files |
| Phase 09-group-dashboard-map P01 | 10min | 2 tasks | 3 files |
| Phase 09-group-dashboard-map P02 | 8min | 3 tasks | 6 files |
| Phase 09-group-dashboard-map P03 | 4min | 1 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- 06-01: DomainGuard as root guard components wrapping route subtrees (not bootstrap-time router split) — follows ProtectedRoute Outlet pattern with named exports
- 06-01: isMainDomain() is UX enforcement only — documented in source comments; Phase 7 adds backend 403 as the real security boundary
- 06-01: VITE_MAIN_DOMAIN=localhost in gitignored .env for local dev; .env.example committed with placeholder value
- 06-01: Test pattern for domain guards: vi.stubEnv('VITE_MAIN_DOMAIN', ...) + vi.stubGlobal('location', { hostname: ... }) with afterEach cleanup
- Roadmap: Google OAuth ships atomically — PreSignUp Lambda and "Sign in with Google" button must land in the same phase; never button without Lambda
- Roadmap: Fixed intermediary callback URL strategy required for Phase 4 — multi-tenant subdomain conflict must be designed before planning begins
- Roadmap: Phase 5 provider event ID storage model (columns on EstateDate vs. join table) and EstateDate timezone column existence must be resolved at Phase 5 planning time
- 01-01: cache_store set in environment files (not initializers) — rack_attack.rb loads before solid_cache.rb alphabetically; environment files guarantee correct store before any initializer runs
- 01-01: solid_cache:install:migrations used (not solid_cache:install) — avoids creating unwanted config/cache.yml
- 01-01: solid_cache uses same PostgreSQL DB as app (no separate database.yml entry)
- 01-02: V1::Admin::BaseController namespace matches v1/admin/ path for Rails autoloading
- 01-02: include BrokerageAuth before CognitoAuth — BrokerageAuth included do registers resolve_brokerage before authenticate_cognito_user! runs
- 01-02: Owner-only actions use skip_before_action :require_admin! + before_action :require_owner! pattern (D-04)
- 01-02: InvitationsController validate_token is fully public — skips both authenticate_cognito_user! and require_admin! (D-14)
- 01-03: CORS proc uses BrokerageDomain.exists?(domain:) — column is domain not host (D-05)
- 01-03: rack-attack throttle uses req.ip (X-Forwarded-For aware) not req.env["REMOTE_ADDR"] (D-15)
- 01-03: Dev domain seeds use insert_all with unique_by: :domain for idempotency (D-06)
- [Phase ?]: D-15: Rails 7.1 enum positional API uses prefix: (no underscore), not _prefix:
- [Phase ?]: D-16: BrokerageBoardCredential enum uses prefix: :credential to namespace predicates (credential_active?, credential_invalid?) — avoids conflict with AR built-in invalid?
- [Phase ?]: D-17: Pagination concern deleted — ApplicationController is now empty; all pagination via Pagy::Backend in BaseController
- 01-05: D-18: liked_ge_ids bulk-computed via EstateLike.where(user_id:, group_estate_id:).pluck.to_set — matches rejected_ge_ids pattern; passed in instance_options to serializer
- 01-05: D-19: price sort uses price_numeric NULLS LAST only — secondary list_price fallback removed; price_numeric is the canonical decimal field
- 01-05: D-20: filter_by_price_per_sqft CAST(price AS REAL) left unchanged — that is a computed ratio (price/sqft) not covered by DEBT-04 scope
- 01-06: D-21: router.navigate('/') used instead of window.location.href for generic 403 redirect — preserves React tree so toast renders
- 01-06: D-22: Generic 403 branch comes AFTER no-access 403 branch — no-access redirect takes priority when next_step field is present
- 01-06: D-23: No clearToken() call on generic 403 — authorization failure does not invalidate identity; user stays logged in
- 02-01: Factory traits use do..end blocks — Ruby 4.0 raises SyntaxError on inline brace syntax after bare method call (trait :owner { role { 'owner' } } is ambiguous)
- 02-01: AuthHelper resets Current in ensure block — guards against JWT-minting side effects leaking into assertion phase
- 02-05: "type": "module" added to frontend/package.json — required for Vitest 4.x ESM compatibility (std-env is ESM-only; omitting it causes ERR_REQUIRE_ESM on startup)
- 02-05: passWithNoTests: true in vitest.config.ts — Vitest 4.x exits 1 on empty suite; plan requires exit 0 before any test files exist
- 02-05: MSW onUnhandledRequest: 'warn' chosen over 'error' during initial infrastructure setup; switch to 'error' once all test requests are handled
- 02-02: No deviations — tenant isolation and admin authorization integration tests written exactly as planned; both files pass on first run (7 runs, 0 failures)
- 02-03: GroupEstatesQuery#call returns Estate records (not GroupEstate) — test assertions use .id not .estate_id; accessible_by scope requires BrokerageEstate fixtures in tests
- 02-03: acts_as_paranoid destroy_all sets deleted_at — assert without_deleted.count == 0 after soft-delete, not with_deleted.count
- 02-03: FilterSets create with empty filters returns 422 when replacing active set — test accepts [201, 422] and checks data state not HTTP status
- 02-04: accept_token invalid-token response is 410 Gone (not 404/422) — controller renders status: :gone; test asserts [404, 410, 422]
- 02-06: vi.hoisted used for mock function declarations in vi.mock factories — vi.mock calls are hoisted before const declarations; plain const variables cause ReferenceError
- 02-06: execArgv: ['--experimental-require-module'] in vitest.config.ts — Node 22.9+ flag enables require() of ESM; jsdom 27.x → cssstyle → @asamuzakjp/css-color → @csstools/css-calc (ESM-only) causes ERR_REQUIRE_ESM without this flag
- 03-02: next_step = group.uid (D-09) — UUID is canonical public identifier; group.id.to_s was integer string which has no router match
- 03-02: dashboard sentinel (D-10/D-11/D-12) — backend returns "dashboard" for brokerage-level invitations; frontend guards nextStep !== 'dashboard' before interpolating into path; both flows use absolute leading-slash navigation
- 03-03: D-14: welcomed_at nullable datetime; NULL = banner not dismissed; no backfill (existing users will see banner on first load)
- 03-03: D-15: BrokerageMembership.without_deleted.find_by! in dismiss_welcome — soft-deleted memberships get 404 not stale update
- 03-03: D-16: show_welcome_banner boolean only in serializer — raw welcomed_at timestamp not exposed (T-03-03-03 accept)
- 03-03: BrokerageMembership lacked acts_as_paranoid — deleted_at + index added in same migration; model updated with acts_as_paranoid to enable .without_deleted scope required by plan
- 03-04: D-17: bannerHydrated guard — bannerVisible defaults false until profile resolves; prevents banner flash for users who have already dismissed
- 03-04: D-18: Optimistic dismiss — setBannerVisible(false) immediately + fire-and-forget dismissMutation.mutate() (no toast, no await, no confirmation)
- 03-04: D-19: CLAUDE.md compliance — brokerage name and group names both flow via dedicated TanStack hooks (useFetchDashboardBrokerage + useFetchAccountGroups); no inline useQuery
- 03-04: D-20: WelcomeBanner is purely presentational — zero internal state, zero hooks
- 03-05: D-21: Option A chosen (HomepageContext) over Option B (AppShell) for banner — AppShell is layout-only; injecting data hooks there violates separation of concerns
- 03-05: D-22: Both HomepageContext and GeneralDashboardContext use identical four-hook chain for banner — consistent pattern, easy to maintain
- [Phase ?]: 04-01: CORS origin uses source == https://auth.realtybase.ca exact full-origin string — not host-only (D-06 compliance)
- [Phase ?]: 04-01: JWT.decode(token, nil, false) used for Cognito RS256 idToken in OAuth path — project-established pattern from CognitoService
- [Phase ?]: 04-01: email_verified checked before find_or_initialize_by in OAuth path — prevents account takeover via unverified email (T-04-01-01 mitigation)
- [Phase ?]: 04-02: ProviderAttributeName 'email' for DestinationUser lookup — 'username' fails on email-alias Cognito pools (UserNotFoundException)
- [Phase ?]: 04-02: email_verified evaluated as string === 'true' — Cognito userAttributes are strings not booleans
- [Phase ?]: 04-02: AliasExistsException swallowed as no-op; all other SDK errors propagate to Cognito sign-up rejection
- [Phase ?]: 04-03: Hub.listen('signInWithRedirect') approach for customState — avoids Amplify raw state param prefix format parsing entirely
- [Phase ?]: 04-03: endsWith('.realtybase.ca') guard in callback page — open redirector prevention for OAuth state param injection
- [Phase ?]: 04-03: Amplify loaded via jsDelivr CDN in static callback page — CDN failure is denial-of-service, not security risk (T-04-03-04 accepted)
- 05-01: with_advisory_lock downgraded to ~> 5.3 from ~> 7.5 — version 7.x requires activerecord >= 7.2; 5.3.0 compatible with Rails 7.1.4 (requires activerecord >= 6.1); API is identical
- 05-01: omniauth-azure-activedirectory-v2 is deprecated (post-install warns to switch to omniauth-entra-id) — kept per plan spec; rename is out-of-scope for Phase 05
- 05-01: credentials_hash rescues JSON::ParserError returning {} — prevents raw credential values in error paths (T-05-01-02 mitigation)
- 05-02: GoogleCalendarAdapter receives pre-decrypted credentials Hash — no token refresh in adapter; CalendarSyncJob owns refresh with advisory lock (CAL-06)
- 05-02: OAuth2 state nonce (SecureRandom.hex(32)) stored in Rails.cache with 10-min TTL; single-use (deleted on first read); user_id taken from cache not params (T-05-02-03)
- 05-02: refresh_token preserved from existing UserCalendarConnection when Google does not re-issue on re-auth (prompt: consent only re-issues on first authorization)
- 05-04: routes.rb calendar OAuth path bug fixed — namespace :google sub-namespace generated wrong controller path v1/account/calendar/google/google_oauth#authorize; flat route get "google/authorize", to: "google_oauth#authorize" resolves to correct v1/account/calendar/google_oauth#authorize
- 05-04: Apple CalDAV create returns event URL as external_event_id — CalendarSyncJob (Plan 05) must persist sync() return value when action='create' for Apple provider
- 05-04: Resync uses find_by (no bang, no status filter) — error-state connections proceed to enqueue jobs (CAL-07 design); nil returns 404, disconnected returns 422
- 05-05: CalendarSyncJob find_by!(user_id:, provider:) without status filter — error-state connections retried correctly (BLOCKER 4 fix); ConnectionNotActiveError discards disconnected connections separately
- 05-05: action values are 'create' and 'destroy' only — no 'update' (EstateEventsController routes confirm only: [:index, :create, :destroy]; D-06 'update' mention was artifact)
- 05-05: update_columns used for conn.status=error and last_error updates — skips AR callbacks/validations (safe for error state fields)
- 05-06: ProviderCard renders generic error copy — raw lastError field never interpolated into DOM (T-05-06-03 mitigation)
- 05-06: Apple type=password input (T-05-06-01) — value not stored beyond form session, never logged
- 05-06: Google/Microsoft connect hooks use useMutation (not useQuery) — OAuth authorize GET treated as mutation due to window.location.href side effect in onSuccess
- 05-06: CalendarContext co-located in containers/account/ as parallel hook to AccountContext — not extending it (D-08)
- [Phase 08-01]: decimal(10,6) for lat/lng — not float; preserves ~0.1m precision exactly as stored
- [Phase 08-01]: geocoding_failed uses null: false + default: false — PostgreSQL >=11 metadata-only migration; existing rows get false automatically
- [Phase 08-01]: EstateSerializer required no changes — ListingDetailSerializer already wired as listing_detail association; appending attributes flows to both index and show
- 08-02: WebMock used for HTTP stubbing in geocoding tests — project uses minitest 6.x (no Object#stub); WebMock already in test group Gemfile
- 08-02: run_after_discard_procs(nil) used in after_discard test — Rails 7.1 private method; run_callbacks(:discard) is minitest 5.x pattern, not applicable
- 08-02: assert_in_delta for lat/lng job test — decimal(10,6) rounds to 6 decimal places; test values must match column precision
- 08-02: Estate dependent: :destroy hard-destroys listing_detail on soft-delete — cannot reload listing_detail after estate.destroy in tests
- 09-01: coordinates action uses .select() projection — e.bedrooms/e.full_bathrooms required (not e.beds/e.baths model method aliases); emitted as beds/baths in JSON
- 09-01: UserGroup.create! required in integration test setup — set_group joins user_groups for membership check; plan only specified BrokerageEstate + GroupEstate

### Pending Todos

None yet.

### Blockers/Concerns

None — Milestone 2 complete.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Auth | Apple / Microsoft social login | v2 | Requirements |
| Calendar | Two-way calendar sync | v2 | Requirements |
| Security | JWT → HttpOnly cookies migration | v2 | Requirements |
| Frontend | Redux → Context/TanStack Query migration | v2 | Requirements |

## Session Continuity

Last session: 2026-05-21T00:00:00Z
Stopped at: v1.2 archived — run /gsd-new-milestone to start v1.3
Resume file: .planning/ROADMAP.md
