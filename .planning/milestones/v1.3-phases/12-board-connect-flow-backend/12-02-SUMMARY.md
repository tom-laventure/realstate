---
phase: 12-board-connect-flow-backend
plan: "02"
subsystem: api
tags: [rails, activerecord, integration-test, minitest, factorybot, insert_all]

# Dependency graph
requires:
  - phase: 12-01
    provides: BrokerageBoardCredential conditional validations; RealEstateBoard :test_board factory trait; AR Encryption fix

provides:
  - POST /v1/admin/board_credentials accepts TEST board with blank credentials (BOARD-04 controller layer)
  - POST /v1/admin/board_credentials bulk-inserts BrokerageEstate rows idempotently (BOARD-03)
  - GET /v1/admin/boards returns both real and test boards (Phase 13 prerequisite)
  - 6 integration tests proving BOARD-03 + BOARD-04 end-to-end

affects: [12-03, 13-board-connect-flow-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BrokerageEstate.insert_all with unique_by: [:brokerage_id, :estate_id] for idempotent bulk association"
    - "board.is_test_board? || Rails.env.development? guard for RETS auth bypass"
    - "Integration test: worktree requires .bundle/config and config/master.key symlinks to resolve vendor/bundle and AR Encryption credentials"

key-files:
  created:
    - backend/test/integration/board_connect_flow_test.rb
  modified:
    - backend/app/controllers/v1/admin/boards_controller.rb
    - backend/app/controllers/v1/admin/board_credentials_controller.rb
    - backend/app/services/rets_auth_service.rb

key-decisions:
  - "12-02-A: insert_all inside if credential.save block — BrokerageEstate rows only created after successful credential save; prevents orphan rows on model validation failure"
  - "12-02-B: board.estates.without_deleted.pluck(:id) — Estate has acts_as_paranoid; soft-deleted estates must not appear in BrokerageEstate rows (CLAUDE.md requirement)"
  - "12-02-C: unique_by: [:brokerage_id, :estate_id] column array (not index name string) — matches the composite unique index and makes re-connect idempotent"

patterns-established:
  - "Idempotent bulk association insert: insert_all with unique_by on composite unique index silently skips duplicates"

requirements-completed:
  - BOARD-03
  - BOARD-04

# Metrics
duration: 11min
completed: 2026-05-23
---

# Phase 12 Plan 02: Controller + Integration Test Layer Summary

**BoardCredentialsController widened to accept TEST board with blank credentials, bulk-insert BrokerageEstate via insert_all idempotency guard, and BoardsController returning all active boards — proven by 6 integration tests (6 runs, 19 assertions, 0 failures)**

## Performance

- **Duration:** 11 min
- **Started:** 2026-05-23T22:36:33Z
- **Completed:** 2026-05-23T22:47:00Z
- **Tasks:** 3
- **Files modified:** 4 (3 modified, 1 created)

## Accomplishments
- `POST /v1/admin/board_credentials` now accepts the TEST board with blank credentials — returns 201 and bulk-inserts one `BrokerageEstate` row per estate on the board
- Bulk insert is idempotent — `insert_all unique_by: [:brokerage_id, :estate_id]` silently skips duplicates on re-connect
- `GET /v1/admin/boards` now returns both real and test boards (Phase 13 connect dialog prerequisite)
- 6 integration tests prove BOARD-03 (bulk insert + idempotency), BOARD-04 (test-board RETS bypass), real-board 422 regression, 404 for unknown board, and boards index widening

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen BoardsController#index** - `fbae50c` (feat)
2. **Task 2: Update BoardCredentialsController#create** - `ceeaa40` (feat)
3. **Rule 1 fix: Extend RetsAuthService rescue to catch SocketError** - `ae0777c` (fix)
4. **Task 3: Integration tests** - `5000512` (test)

## Files Created/Modified
- `backend/app/controllers/v1/admin/boards_controller.rb` - Removed `.real_boards` scope; GET /v1/admin/boards now returns `RealEstateBoard.active.order(:name)` including TEST boards
- `backend/app/controllers/v1/admin/board_credentials_controller.rb` - Three changes: (1) drop `.real_boards` from board lookup, (2) `board.is_test_board? || Rails.env.development?` RETS bypass, (3) `BrokerageEstate.insert_all` after credential save
- `backend/app/services/rets_auth_service.rb` - Added `SocketError` to rescue clause (Rule 1 deviation fix)
- `backend/test/integration/board_connect_flow_test.rb` - 6 integration tests for BOARD-03 and BOARD-04

## Decisions Made
- `12-02-A`: `BrokerageEstate.insert_all` inside `if credential.save` block — ensures estate association rows are only created after the credential record persists successfully. If `credential.save` returns false (e.g., real board with blank credentials), no `BrokerageEstate` rows are created.
- `12-02-B`: `board.estates.without_deleted.pluck(:id)` — `Estate` has `acts_as_paranoid` (CLAUDE.md requirement). Soft-deleted estates must never appear in `BrokerageEstate` rows.
- `12-02-C`: `unique_by: [:brokerage_id, :estate_id]` as column array — matches `index_brokerage_estates_on_brokerage_id_and_estate_id` composite unique index. Passing column array (not the index name string) is the correct Rails insert_all API.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extended RetsAuthService rescue to catch SocketError**
- **Found during:** Task 3 (integration tests)
- **Issue:** `RetsAuthService#call` rescues `HTTParty::Error, Net::OpenTimeout, Net::ReadTimeout` but not `SocketError`. When the real board's `rets_endpoint` (`rets<N>.example.com`) has no DNS record in test env, `Socket::ResolutionError` (a subclass of `SocketError`) is raised and propagates as an unhandled 500 error instead of returning 422. This caused the real-board 422 test to fail with an error.
- **Fix:** Added `SocketError` to the rescue clause — `rescue HTTParty::Error, Net::OpenTimeout, Net::ReadTimeout, SocketError => e`. `Socket::ResolutionError < SocketError` so this catches both DNS and general socket failures cleanly.
- **Files modified:** `backend/app/services/rets_auth_service.rb`
- **Verification:** All 6 integration tests pass (6 runs, 19 assertions, 0 failures, 0 errors). The real-board 422 test now correctly returns 422 from `RetsAuthService` failure path.
- **Committed in:** `ae0777c`

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Critical fix in an adjacent service — without it the real-board regression test would error on DNS failure rather than returning 422. The fix is strictly additive and correct for both test and production environments.

## Issues Encountered

**Worktree test environment setup:** Running integration tests from within the git worktree required two manual fixes not needed in the main backend directory:
1. Created `.bundle/config` in the worktree pointing to `BUNDLE_PATH: /home/tomlaventure/projects/realstate/backend/vendor/bundle` — the worktree's own bundler (4.0.10) couldn't find gems without this.
2. Symlinked `config/master.key` from the main backend into the worktree — `master.key` is gitignored so not present in the worktree checkout; without it AR Encryption raises `Configuration: Missing Active Record encryption credential`.
3. Symlinked `.env` from the main backend into the worktree — `dotenv-rails` loads env from cwd; without `DATABASE_URL`, Rails fell back to the `test:` stanza in `database.yml` which specifies SQLite3, but the schema contains PostgreSQL-specific CHECK constraints (`0::numeric`).

These are worktree-specific setup concerns; in normal `cd backend` usage none apply.

## Known Stubs
None — all controller logic is real, all test assertions are on live DB state.

## Next Phase Readiness
- Plan 02 controller and integration test layer complete
- Plan 03 (estate `accessible_by` scope) is the only remaining work for BOARD-03 to deliver full end-to-end listing visibility on the dashboard
- Phase 13 (frontend connect dialog) can rely on `GET /v1/admin/boards` returning `is_test_board: true` boards and `POST /v1/admin/board_credentials` returning 201 for the TEST board

---
*Phase: 12-board-connect-flow-backend*
*Completed: 2026-05-23*
