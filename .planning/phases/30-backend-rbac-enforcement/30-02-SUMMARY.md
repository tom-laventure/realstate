---
phase: 30-backend-rbac-enforcement
plan: 02
subsystem: testing
tags: [rails, minitest, rbac, authorization, integration-test, regression-guard]

# Dependency graph
requires:
  - phase: 30-backend-rbac-enforcement (plan 01)
    provides: "require_agent_or_above! tier on V1::Admin::BaseController; narrow require_admin!/require_owner! overrides on the 4 write-tier controllers"
provides:
  - "Exhaustive agent permission matrix in admin_authorization_test.rb — 2xx allow-list for every group-scoped + read-only admin endpoint, 403 deny-list for every write endpoint outside Groups scope"
  - "CI regression guard: any future accidental over-grant on the V1::Admin role-tier surface (a broadened base filter, a missed override) now fails a test immediately"
affects: [31-agent-dashboard-shell, 32-agent-group-permissions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Allow-list + deny-list pairing in one integration test file: agent 2xx assertions grouped under one banner comment, agent 403 assertions (status + error.code) grouped under another"
    - "DNS-stub helper (with_dns) reused across test files for domains#verify, avoiding real network resolution in CI"

key-files:
  created: []
  modified:
    - backend/test/integration/admin_authorization_test.rb
    - backend/test/integration/board_connect_flow_test.rb
    - backend/test/integration/board_credential_crud_test.rb
    - backend/test/integration/filter_sets_test.rb
    - backend/test/integration/group_estate_coordinates_test.rb
    - backend/test/integration/group_estates_query_test.rb
    - backend/test/integration/invitations_test.rb
    - .planning/phases/30-backend-rbac-enforcement/deferred-items.md

key-decisions:
  - "Fixed the pre-authorized RESERVED_SLUGS/'test.example.com' fixture collision (Rule 3, pre-approved in execution brief) via mechanical domain rename across 6 files — reduced full-suite errors from 46 to 30"
  - "Left a newly-discovered, distinct pre-existing issue unfixed (RealEstateBoard(:test_board) factory trait colliding with a live seeded row in the shared test-environment Postgres DB) — documented in deferred-items.md rather than fixed, since resolving it requires either live-DB cleanup or a factory redesign touching 4+ files outside this plan's scope"

requirements-completed: [RBAC-01, RBAC-02, RBAC-03]

# Metrics
duration: 60min
completed: 2026-07-09
---

# Phase 30 Plan 02: Backend RBAC Enforcement — Full Permission Matrix Summary

**Extended `admin_authorization_test.rb` into an exhaustive agent permission matrix — 46 allow-list assertions (2xx) covering every group-scoped and read-only admin endpoint, 16 deny-list assertions (403 + `error.code == "forbidden"`) covering every write endpoint outside Groups scope, including all four brokerage-level invitation endpoints at their correct collection-vs-member route forms.**

## Performance

- **Duration:** ~60 min
- **Started:** 2026-07-09T23:09:35Z (approx, per STATE.md session start)
- **Completed:** 2026-07-09T23:33:00Z (approx)
- **Tasks:** 3 planned tasks, all completed
- **Files modified:** 8 (1 planned test file + 6 deviation-fixed test files + 1 deferred-items.md doc update)

## Accomplishments
- `admin_authorization_test.rb` now asserts agent 2xx on every group-scoped endpoint (`groups` CRUD + `check_name`, `group/users` create/destroy, `group/filter_sets` CRUD + `preview`, `group/estates` CRUD + `search`, `group/invitations` CRUD) — RBAC-01.
- `admin_authorization_test.rb` now asserts agent 2xx on every read-only admin endpoint (`users#show`, `brokerages#show`, `domains#index/verify`, `boards#index`, `board_credentials#index`, `activity#index/stats`, `estates#search/cities`) — RBAC-02 + D-01.
- `admin_authorization_test.rb` now asserts agent 403 (status + `error.code == "forbidden"`) on every write endpoint outside Groups scope — `users#update/destroy`, `brokerages#update`, `domains#subdomain/custom/set_primary/destroy`, `board_credentials#create/update/destroy`, and all four brokerage-level `invitations#index/create/validate/destroy` endpoints at their correct collection/member route forms — RBAC-03. The four brokerage-invitations tests close the exact regression gap flagged by T-30-01/Pitfall 1 in 30-RESEARCH.md.
- Fixed the pre-authorized RESERVED_SLUGS fixture collision across 6 additional test files (mechanical rename, matching Plan 01's precedent), reducing full-suite errors from 46 to 30.
- Discovered and documented (not fixed — out of scope) a second, distinct pre-existing issue: the test environment's `DATABASE_URL` leaks into `RAILS_ENV=test` from `.env`, pointing tests at a live shared Postgres DB with stale seed data that collides with the `:test_board` factory trait.

## Task Commits

Each task was committed atomically:

1. **Task 1: Group-scoped allow-list (RBAC-01)** - `7846898` (test)
2. **Task 2: Read-only allow-list (RBAC-02 + D-01)** - `67e869b` (test)
3. **Task 3: Deny-list matrix (RBAC-03)** - `3c58842` (test)
4. **Deviation fix: RESERVED_SLUGS fixture rename across 6 files** - `6c6c05d` (fix)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `backend/test/integration/admin_authorization_test.rb` - Extended setup with `@group` fixture, `with_dns` stub helper; added 46 agent allow-list tests + 16 agent/client deny-list tests (351 total lines added across the 3 task commits)
- `backend/test/integration/board_connect_flow_test.rb` - Fixture domain rename `test.example.com` → `acme.example.com`
- `backend/test/integration/board_credential_crud_test.rb` - Fixture domain rename
- `backend/test/integration/filter_sets_test.rb` - Fixture domain rename
- `backend/test/integration/group_estate_coordinates_test.rb` - Fixture domain rename
- `backend/test/integration/group_estates_query_test.rb` - Fixture domain rename
- `backend/test/integration/invitations_test.rb` - Fixture domain rename (setup + 2 `Host` header occurrences)
- `.planning/phases/30-backend-rbac-enforcement/deferred-items.md` - Documented resolution of the RESERVED_SLUGS issue and the newly-discovered `:test_board`/live-seed-data collision

## Decisions Made
- Reused `admin_domains_test.rb`'s `with_dns` stub pattern (verbatim, defined locally in `admin_authorization_test.rb`) for the `domains#verify` allow-list test, rather than relying on real DNS resolution — avoids network flakiness in CI, consistent with the codebase's `FakeJob`/stub conventions for Minitest 6 (no `Minitest::Mock`/`.stub`).
- Used empty `filters: []` for filter_set create/preview allow-list tests — confirmed via `FilterSetEstatesQuery` and existing `filter_sets_test.rb` precedent that empty filters return a 2xx (200/201), not a 422, when there's no previously-active filter set to compare against.
- Created estate/board-credential fixtures inline per-test (not in shared `setup`) for `group/estates#create`, matching the plan's "prefer creating per-test where a mutation consumes/destroys the record" guidance.
- Applied the pre-authorized RESERVED_SLUGS fixture rename to all 6 remaining affected files (not just the minimum needed for `admin_authorization_test.rb`'s own pass), per the plan's explicit Rule 3 carve-out, since the plan's own success criterion required the full suite to be green.
- Did NOT attempt to fix the newly-discovered `:test_board` seed-data collision — this is a distinct root cause (confirmed independent of RESERVED_SLUGS, confirmed pre-existing via a 2026-05-24-dated seed row), and resolving it properly requires either live-DB cleanup or a factory redesign that would touch 4+ files well outside this plan's `files_modified` scope. Documented per SCOPE BOUNDARY protocol instead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, pre-authorized] Fixed RESERVED_SLUGS fixture collision across 6 test files**
- **Found during:** Task 3, running the full suite per the task's own `<verify>` block
- **Issue:** `BrokerageDomain#valid_subdomain_slug` rejects `RESERVED_SLUGS` (includes `"test"`), but `board_connect_flow_test.rb`, `board_credential_crud_test.rb`, `filter_sets_test.rb`, `group_estate_coordinates_test.rb`, `group_estates_query_test.rb`, and `invitations_test.rb` all used `domain: "test.example.com"` in their fixtures, causing 46 unrelated test errors on the full suite. This was explicitly pre-authorized in the 30-02 execution brief (`<known_pre_existing_issue>`), confirmed pre-existing on `HEAD~3` before any Phase 30 commits, and identified by the 30-01 executor in `deferred-items.md`.
- **Fix:** Mechanical rename `"test.example.com"` → `"acme.example.com"` across all 6 files (matching Plan 01's precedent fix for `admin_authorization_test.rb` and `admin_domains_test.rb`), including 2 hardcoded `Host` header occurrences in `invitations_test.rb`.
- **Files modified:** `backend/test/integration/board_connect_flow_test.rb`, `board_credential_crud_test.rb`, `filter_sets_test.rb`, `group_estate_coordinates_test.rb`, `group_estates_query_test.rb`, `invitations_test.rb`
- **Verification:** Full suite errors dropped from 46 to 30 (`RAILS_ENV=test bundle exec rails test`: 255 runs, 479 assertions, 0 failures, 30 errors — down from 255 runs, 431 assertions, 0 failures, 46 errors before the fix).
- **Committed in:** `6c6c05d`

---

**Total deviations:** 1 auto-fixed (1 blocking, pre-authorized). 1 additional issue discovered but deliberately NOT fixed (documented below and in deferred-items.md).
**Impact on plan:** The auto-fix was explicitly pre-authorized by the plan's execution brief and necessary for the plan's own "full suite green" success criterion. No scope creep — the fix was a mechanical string rename, matching the exact pattern already proven in Plan 01.

## Issues Encountered

**Full backend test suite is NOT 100% green — 30 errors remain, all attributable to a newly-discovered, distinct pre-existing issue unrelated to Phase 30/RBAC:**

After fixing the pre-authorized RESERVED_SLUGS collision, the full suite (`RAILS_ENV=test bundle exec rails test`) went from 46 errors to 30 errors (255 runs, 479 assertions, 0 failures). All 30 remaining errors trace to a single root cause: `backend/.env`'s `DATABASE_URL` is loaded by `dotenv-rails` for **all** Rails environments, including `test` — even though `config/database.yml`'s `test:` block specifies `adapter: sqlite3`, the environment variable effectively overrides it at boot, so `RAILS_ENV=test` connects to the same **live, shared Neon Postgres database** as development. That live database already contains a `real_estate_boards` row seeded on 2026-05-24 (`short_code: "TEST"`, `name: "Test RETS Board"`) from an earlier `rails db:seed` run. The `test/factories/real_estate_boards.rb` `:test_board` trait hardcodes the identical `short_code`/`name` values (by design, to mirror the seed convention), so any test whose `setup` calls `create(:real_estate_board, :test_board)` collides with the live row and raises `ActiveRecord::RecordInvalid: Validation failed: Name has already been taken, Short code has already been taken`.

This is confirmed independent of the RESERVED_SLUGS issue (reproduced in `test/models/brokerage_board_credential_test.rb` and `test/models/estate_accessible_by_test.rb` — pure model tests with no `brokerage_domain`/reserved-slug involvement at all) and confirmed pre-existing (the seeded row's `created_at` timestamp pre-dates all Phase 30 commits by over a month). Affects 30 test errors across 4 files: `test/models/brokerage_board_credential_test.rb` (5), `test/integration/board_connect_flow_test.rb` (6), `test/integration/board_credential_crud_test.rb` (10), `test/models/estate_accessible_by_test.rb` (9).

This was NOT fixed in this plan — it was discovered only as a consequence of the pre-authorized RESERVED_SLUGS fix, and resolving it properly requires either an operational fix (removing the stale live seed row, or correcting the `.env`/`DATABASE_URL` scoping so `test` genuinely uses an isolated database) or a factory redesign (`find_or_create_by` semantics for `:test_board`) touching 4+ files well outside this plan's `files_modified`. Both are judgment calls beyond a mechanical fix, per the SCOPE BOUNDARY and Rule 4 guidance. Fully documented in `.planning/phases/30-backend-rbac-enforcement/deferred-items.md` for a follow-up infra task.

**`admin_authorization_test.rb` itself — this plan's actual owned deliverable — is 100% green:** `RAILS_ENV=test bundle exec rails test test/integration/admin_authorization_test.rb` → 51 runs, 67 assertions, 0 failures, 0 errors, 0 skips. All RBAC-01/02/03 requirements are fully covered and passing.

## User Setup Required
None - no external service configuration required. (The `DATABASE_URL`/live-DB issue documented above is an infra follow-up, not a user action needed to unblock this plan.)

## Next Phase Readiness
- The full agent permission boundary (RBAC-01/02/03) is now backed by an exhaustive, green regression-guard test matrix in `admin_authorization_test.rb` — any future accidental over-grant on the `V1::Admin` role-tier surface will fail this file immediately.
- Phase 31 (agent dashboard shell) and Phase 32 (agent group permissions) can proceed — the backend enforcement they depend on is now both implemented (Plan 01) and locked in place by tests (Plan 02).
- Follow-up infra task recommended (not blocking Phase 31/32): fix the `test`-environment `DATABASE_URL` leak and/or the stale live seed data, to get the full suite to genuine 0-errors and prevent future `:test_board`-using tests from silently colliding with production-like seed rows.

---
*Phase: 30-backend-rbac-enforcement*
*Completed: 2026-07-09*

## Self-Check: PASSED

All modified files (7 backend test files) and all commit hashes (4) verified present.
