---
phase: 36-plan-configuration-tier-migration
plan: 01
subsystem: api
tags: [ruby, rails, config-constant, plan-tiers, billing]

# Dependency graph
requires: []
provides:
  - "AppConstants::PLAN_TIERS frozen Hash (free/independent/growth) with PlanTier struct: seat_cap, base_price_cents, overage_price_cents, annual_discount_rate, real_boards, clients, custom_domain, calendar_sync"
  - "Brokerage#plan_config instance accessor (AppConstants::PLAN_TIERS.fetch(plan)) — fails loud (KeyError) on unrecognized plan"
affects: [36-02-enum-migration, 37-free-tier-gating, 38-upgrade-downgrade-lifecycle, 39-paid-to-paid-billing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AppConstants module reopened per-file under app/constants/, each file explicitly require_relative'd from config/initializers/constants.rb (NOT Zeitwerk-autoloaded, since AppConstants is defined outside the app/ default root as an added autoload_path root — the module is already defined by the first require, so Zeitwerk's const_missing hook never fires for it)"
    - "keyword_init Struct as an immutable config value object (mirrors Groups::Create::Result precedent)"
    - "Fail-loud Hash#fetch with no fallback block for tier/config lookups — silent fallback to a default would silently strip a paying customer's capabilities on a data bug"

key-files:
  created:
    - backend/app/constants/plan_tiers.rb
    - backend/test/models/plan_config_test.rb
  modified:
    - backend/app/models/brokerage.rb
    - backend/config/initializers/constants.rb

key-decisions:
  - "Money stored as integer cents (base_price_cents, overage_price_cents), not float dollars — standard Ruby money practice, and Phase 39's billing recalc consumes these fields directly"
  - "annual_discount_rate is a distinct field, applied only to base_price_cents by future billing code — never baked into base price and never applied to overage_price_cents (D-04)"
  - "plan_config uses bare .fetch(plan) with no fallback block — an unrecognized plan value raises KeyError instead of silently degrading to Free's all-false capability set (D-07, T-36-02 mitigation)"
  - "plan_tiers.rb must be explicitly required in config/initializers/constants.rb alongside roles.rb — AppConstants is not managed by Zeitwerk once the first file defines the module via require_relative, so a second sibling file under app/constants/ would never autoload without the same explicit require"

patterns-established:
  - "Every future plan-tier value (seat caps, pricing, capability flags) is a one-file edit in app/constants/plan_tiers.rb (PLAN-03)"
  - "Reading a brokerage's tier config always goes through Brokerage#plan_config, never a direct AppConstants::PLAN_TIERS[...] lookup scattered through the codebase — this is the single integration point 36-02 rewires existing plan==\"premium\" string comparisons to use"

requirements-completed: [PLAN-02, PLAN-03, PLAN-10, PLAN-11, PLAN-13]

# Metrics
duration: 16min
completed: 2026-07-14
---

# Phase 36 Plan 01: Plan Configuration Tier Migration Summary

**Centralized `AppConstants::PLAN_TIERS` config constant (free/independent/growth pricing, seat caps, and capability flags) plus a fail-loud `Brokerage#plan_config` accessor — the single source of truth every later gating and billing rule in Phases 37-39 reads from.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-14T21:01:59Z
- **Completed:** 2026-07-14T21:16:04Z
- **Tasks:** 2/2 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `AppConstants::PLAN_TIERS` frozen Hash with a `PlanTier` keyword-init Struct defining seat caps, base prices (integer cents), overage rates, a distinct `annual_discount_rate`, and four capability flags for `free`/`independent`/`growth`
- `Brokerage#plan_config` accessor that fails loud (`KeyError`) on an unrecognized plan value instead of silently downgrading a paying brokerage to Free's capability set
- Focused Minitest coverage (8 assertions across structure, Independent/Growth/Free values, and accessor behavior including the KeyError path)

## Task Commits

Each task was committed atomically (inside `backend/`'s own git repo per CLAUDE.md sub-repo convention):

1. **Task 1: Create the AppConstants::PLAN_TIERS config constant** - `749be58` (feat)
2. **Task 2: Add Brokerage#plan_config accessor and its focused test** - `df15b68` (feat)

**Plan metadata:** commit pending (docs: complete plan, top-level monorepo)

## Files Created/Modified
- `backend/app/constants/plan_tiers.rb` - `AppConstants::PlanTier` struct + frozen `PLAN_TIERS` Hash for free/independent/growth
- `backend/app/models/brokerage.rb` - `plan_config` instance method delegating to `PLAN_TIERS.fetch(plan)`
- `backend/test/models/plan_config_test.rb` - focused test asserting tier values and accessor fail-loud behavior
- `backend/config/initializers/constants.rb` - added `require_relative "../../app/constants/plan_tiers"` (deviation, see below)

## Decisions Made
- Money as integer cents, not float dollars, to avoid floating-point rounding in future billing math (Phase 39 consumes these fields directly).
- `annual_discount_rate` kept as a distinct struct field rather than pre-baked into `base_price_cents`, and never touches `overage_price_cents` — this is the locked interpretation of the previously-open PLAN-13 design gap noted in STATE.md.
- `plan_config` intentionally has no fallback branch — fail loud per RESEARCH.md's threat analysis (T-36-02): a corrupted/unexpected `plan` value must raise, not silently strip capabilities.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registered `plan_tiers.rb` in the constants initializer**
- **Found during:** Task 1 verification (`bin/rails runner` one-liner)
- **Issue:** The plan's `<action>` only specified creating `backend/app/constants/plan_tiers.rb` and reopening `module AppConstants`. Running the verification one-liner raised `uninitialized constant AppConstants::PLAN_TIERS`. Investigation showed `app/constants` is added via `config.autoload_paths <<` in `config/application.rb`, but the sibling file `roles.rb` is explicitly loaded via `require_relative "../../app/constants/roles"` in `config/initializers/constants.rb` — not via Zeitwerk autoloading. Because `AppConstants` is already defined as a plain Ruby module by the time any app code runs (via that explicit require), Zeitwerk's `const_missing` hook never fires for `AppConstants` again, so a second file reopening the same module (`plan_tiers.rb`) is never discovered or loaded without the same explicit require.
- **Fix:** Added `require_relative "../../app/constants/plan_tiers"` to `config/initializers/constants.rb`, mirroring the existing `roles.rb` line.
- **Files modified:** `backend/config/initializers/constants.rb`
- **Verification:** Task 1's `bin/rails runner` one-liner passes (`PLAN_TIERS OK`); Task 2's `bin/rails test test/models/plan_config_test.rb` passes (8 runs, 30 assertions, 0 failures).
- **Committed in:** `749be58` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for the plan's own stated verification command to pass — without it, `AppConstants::PLAN_TIERS` would be unreachable from application code, defeating the plan's objective entirely. No scope creep — the fix is a one-line addition mirroring an existing, established pattern in the same file.

## Issues Encountered

Full backend test suite (`bin/rails test`) shows 315 runs, 631 assertions, 0 failures, 30 errors (reproduced identically across two separate runs). All 30 errors are in `BoardConnectFlowTest`, `BoardCredentialCrudTest`, `BrokerageBoardCredentialTest`, and `EstateAccessibleByTest` — none reference `Brokerage#plan_config` or `AppConstants::PLAN_TIERS`. This matches the pre-existing blocker already documented in `.planning/STATE.md` prior to this plan's execution: *"Pre-existing: `RealEstateBoard(:test_board)` factory trait collides with a live seeded row in the shared test-environment Postgres DB (`DATABASE_URL` leaks into `RAILS_ENV=test`) — unrelated test errors remain in the full suite."* This plan's own scoped test (`bin/rails test test/models/plan_config_test.rb`) is fully green (8 runs, 30 assertions, 0 failures, 0 errors), satisfying the plan's actual success criterion that no test *broke as a result of this plan's changes*.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `AppConstants::PLAN_TIERS` and `Brokerage#plan_config` are the foundation plan 36-02 needs to rewire the existing `plan == "premium"` / `%w[basic premium]` literal comparisons and flip the model's plan inclusion validation.
- Scope boundary respected: this plan did NOT touch the `validates :plan, inclusion:` line, run any data migration, or rewire any controller — confirmed via `grep -n "validates :plan, inclusion:" backend/app/models/brokerage.rb` still showing `%w[basic premium]` unchanged.
- Pre-existing full-suite test errors (unrelated `RealEstateBoard(:test_board)` factory/DB collision) remain a known environment blocker for future plans in this milestone — not introduced or worsened by this plan.

---
*Phase: 36-plan-configuration-tier-migration*
*Completed: 2026-07-14*

## Self-Check: PASSED

All created files verified to exist on disk:
- `backend/app/constants/plan_tiers.rb` — FOUND
- `backend/app/models/brokerage.rb` — FOUND
- `backend/test/models/plan_config_test.rb` — FOUND
- `backend/config/initializers/constants.rb` — FOUND
- `.planning/phases/36-plan-configuration-tier-migration/36-01-SUMMARY.md` — FOUND

All task commits verified in `backend`'s git history:
- `749be58` (Task 1) — FOUND
- `df15b68` (Task 2) — FOUND
