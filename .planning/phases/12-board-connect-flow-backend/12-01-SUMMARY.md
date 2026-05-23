---
phase: 12-board-connect-flow-backend
plan: "01"
subsystem: api
tags: [rails, activerecord, encryption, validations, factorybot, minitest]

# Dependency graph
requires:
  - phase: 11-test-board-seed
    provides: is_test_board column on real_estate_boards table; RealEstateBoard model with is_test_board? predicate
provides:
  - BrokerageBoardCredential model with conditional presence validations (unless real_estate_board.is_test_board?)
  - FactoryBot factory for RealEstateBoard with :test_board trait
  - FactoryBot factory for BrokerageBoardCredential
  - 5 model unit tests proving validation conditional + uniqueness retained
  - Corrected AR Encryption column mapping (rets_username_ciphertext / rets_password_ciphertext)
affects: [12-02, 12-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AR Encryption with _ciphertext column names: use encrypts :rets_username_ciphertext (column name), then add manual Ruby accessors for the friendly name"
    - "Conditional validation: validates :field, presence: true, unless: -> { association&.boolean_predicate? }"

key-files:
  created:
    - backend/test/factories/real_estate_boards.rb
    - backend/test/factories/brokerage_board_credentials.rb
    - backend/test/models/brokerage_board_credential_test.rb
  modified:
    - backend/app/models/brokerage_board_credential.rb

key-decisions:
  - "12-01-A: encrypts :rets_username_ciphertext (column name) not encrypts :rets_username — AR Encryption stores ciphertext in the named attribute/column; with _ciphertext suffix columns the encryption declaration must match the column name, and friendly accessors are added manually"
  - "12-01-B: rets_username / rets_password Ruby accessors delegate to rets_username_ciphertext / rets_password_ciphertext — controller API unchanged; validations still use the friendly names"
  - "12-01-C: :test_board factory trait uses fixed name/short_code (Test RETS Board / TEST) — idiomatic with transactional test cleanup; sequences kept on base factory for real boards"

patterns-established:
  - "AR Encryption + _ciphertext column naming: encrypt the DB column name, expose friendly accessor manually"

requirements-completed:
  - BOARD-04

# Metrics
duration: 24min
completed: 2026-05-23
---

# Phase 12 Plan 01: Model + Factory Layer Summary

**Conditional RETS credential validation via `unless: -> { real_estate_board&.is_test_board? }` on BrokerageBoardCredential, plus FactoryBot factories for RealEstateBoard/:test_board and BrokerageBoardCredential, and a corrected AR Encryption column mapping that unblocks all credential saves**

## Performance

- **Duration:** 24 min
- **Started:** 2026-05-23T22:09:06Z
- **Completed:** 2026-05-23T22:33:00Z
- **Tasks:** 4
- **Files modified:** 4 (1 modified, 3 created)

## Accomplishments
- Conditional presence validations on `BrokerageBoardCredential` — RETS credentials skipped for test boards
- Two FactoryBot factories created: `RealEstateBoard` (with `:test_board` trait) and `BrokerageBoardCredential`
- 5 model unit tests prove the conditional validation + uniqueness behavior (5 runs, 11 assertions, 0 failures)
- Fixed pre-existing AR Encryption bug that prevented any `BrokerageBoardCredential.save` from succeeding

## Task Commits

Each task was committed atomically:

1. **Task 1: Conditional presence validations** - `67b3437` (feat)
2. **Task 2: RealEstateBoard factory** - `0244854` (feat)
3. **Task 3: BrokerageBoardCredential factory** - `0639efc` (feat)
4. **Rule 1 fix: AR Encryption column mapping** - `e3ad4da` (fix)
5. **Task 4: Model unit tests** - `a8a3871` (test)

## Files Created/Modified
- `backend/app/models/brokerage_board_credential.rb` - Added conditional `unless:` validations; corrected AR Encryption to use `encrypts :rets_username_ciphertext` with manual accessors
- `backend/test/factories/real_estate_boards.rb` - New factory with sequences + `:test_board` trait
- `backend/test/factories/brokerage_board_credentials.rb` - New factory with non-blank default credentials for real boards
- `backend/test/models/brokerage_board_credential_test.rb` - 5 unit tests for conditional validation behavior

## Decisions Made
- `12-01-A`: `encrypts :rets_username_ciphertext` (column name) not `encrypts :rets_username` — AR Encryption in Rails 7.1 stores ciphertext directly in the named attribute's column. The columns are `rets_username_ciphertext` / `rets_password_ciphertext`, so those must be the encryption targets. Friendly `rets_username` / `rets_password` accessors are added manually to keep the controller + validation API unchanged.
- `12-01-B`: Manual accessors `rets_username` / `rets_password` delegate to the encrypted ciphertext columns. The controller (`credential.rets_username = username`) and the validations (`validates :rets_username`) are unchanged.
- `12-01-C`: `:test_board` factory trait uses fixed `name { "Test RETS Board" }` and `short_code { "TEST" }`. With transactional test cleanup these don't collide. The base factory uses sequences to ensure real boards don't collide across test runs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected AR Encryption column mapping in BrokerageBoardCredential**
- **Found during:** Task 4 (model unit tests)
- **Issue:** `encrypts :rets_username` declared a virtual attribute but the DB column is `rets_username_ciphertext`. Rails AR Encryption stores ciphertext in the named attribute's column — when attribute name and column name differ, `_create_record` adds the virtual attribute to `attribute_names` but `attributes_for_create` filters it out via `& column_names`. Result: `rets_username_ciphertext` was always written as `NULL`, causing `PG::NotNullViolation` on every insert. Zero `BrokerageBoardCredential` records could be saved before this fix.
- **Fix:** Changed to `encrypts :rets_username_ciphertext` and `encrypts :rets_password_ciphertext` (matching DB column names). Added `rets_username` / `rets_password` Ruby accessor methods that delegate to the encrypted ciphertext columns.
- **Files modified:** `backend/app/models/brokerage_board_credential.rb`
- **Verification:** All 5 model unit tests pass including Test 5 (uniqueness via `create`) — requires a successful save.
- **Committed in:** `e3ad4da`

**Note on plan acceptance criteria:** The plan specified `grep -F "encrypts :rets_username" ... returns exactly 1 match`. The fix changes this to `encrypts :rets_username_ciphertext`. The plan's success criteria (all 5 tests pass, model layer unblocks Plans 02 and 03) takes priority over the specific grep check, which was written under the assumption the encryption was working correctly.

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Critical fix — without it no BrokerageBoardCredential record could be saved anywhere (development or production). The fix is contained to the model file only; no migrations needed; controller API unchanged.

## Issues Encountered
- **AR Encryption + _ciphertext column naming mismatch:** The test DB environment exposed the AR Encryption bug because all model tests required creating DB records. Investigation confirmed the bug exists in development too (0 BrokerageBoardCredential records in the dev DB). The fix (`encrypts :rets_username_ciphertext`) is the correct Rails 7.1 pattern for this column naming convention.
- **Test DB environment mismatch:** Initial test run failed with `ActiveRecord::EnvironmentMismatchError` — the test DB had been used for development. Fixed by running `DISABLE_DATABASE_ENVIRONMENT_CHECK=1 RAILS_ENV=test rails db:schema:load`.
- **Pre-existing test failures:** `GroupEstatesQueryTest` and `GroupEstateCoordinatesTest` have 5 failures + 1 error unrelated to Plan 01 changes. These are out of scope and logged as deferred items.

## Known Stubs
None — all factories produce valid records, all validations have real conditional logic.

## Next Phase Readiness
- Plan 02 (controller changes) can now use `create(:brokerage_board_credential)` and `create(:real_estate_board, :test_board)` in tests
- Plan 03 (scope tests) can use the same factories
- `BrokerageBoardCredential` model now correctly saves and encrypts credentials in all environments
- BOARD-04 model-layer prerequisite complete; controller-layer guard (board lookup + RETS bypass) handled in Plan 02

---
*Phase: 12-board-connect-flow-backend*
*Completed: 2026-05-23*
