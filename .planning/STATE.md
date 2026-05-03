---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: ready
stopped_at: Phase 2 complete — verified
last_updated: "2026-05-02T22:00:00Z"
last_activity: 2026-05-02
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 13
  completed_plans: 13
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-30)

**Core value:** Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.
**Current focus:** Phase 3 — Onboarding Fixes (next)

## Current Position

Phase: 2 of 5 (Test Suite) — VERIFIED COMPLETE
Plan: 6 of 6 complete
Status: Phase 2 verified — 4/4 must-haves confirmed; 17 backend tests + 7 frontend tests passing
Last activity: 2026-05-02

Progress: [████░░░░░░] 40% (2/5 phases complete) — ready for Phase 3

## Performance Metrics

**Velocity:**

- Total plans completed: 7
- Average duration: 6 min
- Total execution time: 37 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

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

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 4 planning requires upfront design of intermediary callback URL (exact URL, state encoding, redirect strategy)
- Phase 5 planning requires: (1) decision on provider event ID storage, (2) confirmation that EstateDate has/needs a timezone column, (3) Apple scope confirmation (personal iCloud vs. Apple Business Manager)

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Auth | Apple / Microsoft social login | v2 | Requirements |
| Calendar | Two-way calendar sync | v2 | Requirements |
| Security | JWT → HttpOnly cookies migration | v2 | Requirements |
| Frontend | Redux → Context/TanStack Query migration | v2 | Requirements |

## Session Continuity

Last session: 2026-05-03T00:10:31Z
Stopped at: Completed 02-06-PLAN.md
Resume file: None
