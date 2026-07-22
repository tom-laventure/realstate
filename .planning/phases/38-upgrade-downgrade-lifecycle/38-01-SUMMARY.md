---
phase: 38-upgrade-downgrade-lifecycle
plan: 01
subsystem: database
tags: [rails, activerecord, migration, enum, paranoia]

# Dependency graph
requires:
  - phase: 36-plan-configuration-tier-migration
    provides: "Brokerage#plan three-tier enum (free/independent/growth)"
  - phase: 37-free-tier-gating
    provides: "Free-tier gating conventions this phase's freeze/restore must agree with"
provides:
  - "brokerage_memberships.suspended_at column + index"
  - "brokerage_board_credentials.suspended_at column + index"
  - "brokerages.plan_downgraded_at column"
  - "BrokerageBoardCredential#status enum third value: suspended"
  - "BrokerageMembership#suspended?/#suspend!/#restore! instance methods"
affects: [38-02, 38-03, 38-04, 38-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Timestamp-flag revocable-but-preserved record (mirrors Invitation#revoked_at) applied to BrokerageMembership#suspended_at"

key-files:
  created:
    - backend/db/migrate/20260721000001_add_plan_transition_suspend_columns.rb
    - backend/test/models/brokerage_membership_test.rb
  modified:
    - backend/db/schema.rb
    - backend/app/models/brokerage_board_credential.rb
    - backend/app/models/brokerage_membership.rb

key-decisions:
  - "suspended_at columns indexed on both brokerage_memberships and brokerage_board_credentials since CognitoAuth/board-credential lookups read them on every authenticated request (T-38-01 mitigation)"
  - "plan_downgraded_at added to brokerages (not derived via MAX(suspended_at)) as the single event-marker for Plan 03/04's scoped restore (D-06)"
  - "BrokerageBoardCredential#status enum extended in-place with suspended: no migration needed (plain string column, no DB CHECK constraint)"

patterns-established:
  - "Suspend/restore timestamp-flag pattern: suspended_at.present? / update!(suspended_at: at) / update!(suspended_at: nil) — row stays intact, no soft-delete"

requirements-completed: [PLAN-16, PLAN-17, PLAN-18]

# Metrics
duration: 12min
completed: 2026-07-22
---

# Phase 38 Plan 01: Suspend-Lifecycle Schema & Model Foundation Summary

**Migration adding suspended_at (indexed) to brokerage_memberships/brokerage_board_credentials plus brokerages.plan_downgraded_at, a third `suspended` enum value on BrokerageBoardCredential#status, and Invitation#revoked_at-style suspend!/restore!/suspended? methods on BrokerageMembership**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-22
- **Tasks:** 2/2 completed
- **Files modified:** 5 (1 migration + schema.rb + 2 models + 1 test file)

## Accomplishments
- Migration `20260721000001_add_plan_transition_suspend_columns` applied: `suspended_at` (+ index) on `brokerage_memberships` and `brokerage_board_credentials`, `plan_downgraded_at` on `brokerages`
- `BrokerageBoardCredential#status` enum extended with a third value, `suspended`, alongside `active`/`invalid`
- `BrokerageMembership` gained `suspended?`/`suspend!(at:)`/`restore!` instance methods mirroring the existing `Invitation#revoked_at` pattern — the row is never soft-deleted
- New `test/models/brokerage_membership_test.rb` covering nil-state, suspend, restore, and row-preservation (4 tests, 7 assertions, all green)

## Task Commits

Both tasks were committed atomically in the `backend` sub-repo (branch `worktree-agent-a0ecacc1bc4123436-backend`, based on `backend@main`):

1. **Task 1: Add suspend-lifecycle columns migration** - `9115cd3` (feat) - backend
2. **Task 2: Extend board-credential enum and add membership suspend methods** - `fb02fe3` (feat) - backend

**Plan metadata:** committed separately in the monorepo worktree (this SUMMARY + no shared STATE.md/ROADMAP.md writes — orchestrator owns those per worktree execution mode).

## Files Created/Modified
- `backend/db/migrate/20260721000001_add_plan_transition_suspend_columns.rb` - new migration: 3 columns, 2 indexes
- `backend/db/schema.rb` - regenerated, version bumped to `2026_07_21_000001`
- `backend/app/models/brokerage_board_credential.rb` - `status` enum: `active`/`invalid` → `active`/`invalid`/`suspended`
- `backend/app/models/brokerage_membership.rb` - added `suspended?`/`suspend!`/`restore!`
- `backend/test/models/brokerage_membership_test.rb` - new model test, 4 assertions-covering tests

## Decisions Made
- Followed the plan's locked column/index shape exactly — no deviation from the migration design specified in 38-01-PLAN.md.
- Verified via `grep`/schema inspection that no `suspended_at`/`plan_downgraded_at` columns pre-existed before migrating (plan's read_first step), confirming a clean apply.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Backend sub-repo working copy was empty in this worktree**
- **Found during:** Task 1 (before creating the migration file)
- **Issue:** This plan executes in a Claude Code worktree (`isolation="worktree"`). `backend/` and `frontend/` are separate git repos (per CLAUDE.md), and the worktree's `backend/` directory contained zero files — the sub-repo content was never checked out into this worktree (no `.gitmodules`-based linkage exists; `backend`/`frontend` are plain gitlink entries in the monorepo tree with independently-cloned `.git` directories in the main checkout). Without backend source present, no task in this plan could be executed.
- **Fix:** Copied the full working tree + `.git` history from the main checkout's `backend/` repo (`/home/tomlaventure/projects/realstate/backend/`) into this worktree's `backend/` directory via `cp -r`, giving this worktree its own independent full clone of the backend repo's history. Created and checked out a dedicated branch `worktree-agent-a0ecacc1bc4123436-backend` off `main` in that clone (matching the exact naming convention already visible in backend's own git log from prior phase-37 parallel executions: `worktree-agent-<id>-backend`), then did all Task 1/Task 2 work and commits on that branch.
- **Files modified:** N/A (tooling/environment setup only, no project files touched by this fix itself)
- **Verification:** `git -C backend log --oneline` confirms the branch is based on backend's `main` at the correct starting commit (`9b26118`, matching the monorepo's gitlink pointer at the base commit); `bin/rails db:migrate` and `bin/rails test` both ran successfully against this clone.
- **Committed in:** N/A (environment setup, not a code commit)

---

**Total deviations:** 1 auto-fixed (1 blocking/environment)
**Impact on plan:** No code or design deviation — purely a worktree bootstrapping gap in how the `backend` sub-repo was (not) populated on worktree creation. Both plan tasks were executed exactly as written once the backend source was available. The orchestrator will need to merge branch `worktree-agent-a0ecacc1bc4123436-backend` back into the canonical `backend` repo's `main` (same pattern already established for phase 37's three plans — see `backend`'s own git log: `chore: merge executor worktree (worktree-agent-*-backend, plan 37-0N)`).

## Issues Encountered
- `RAILS_ENV=test bin/rails test` resolves to the same live Postgres (`neondb`) database as `development` rather than the `storage/test.sqlite3` configured in `database.yml` — this is the pre-existing `DATABASE_URL`-leaks-into-test-env condition already documented in `.planning/STATE.md`'s Blockers/Concerns section, not something introduced by this plan. The model test still ran and passed cleanly against the shared DB (4 runs, 7 assertions, 0 failures).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plans 03/04 (suspend/restore orchestration, CognitoAuth enforcement) can now read/write `suspended_at` on both `brokerage_memberships` and `brokerage_board_credentials`, and `brokerages.plan_downgraded_at`, exactly as this plan's `must_haves` promised.
- `BrokerageBoardCredential.statuses.keys` now includes `"suspended"`, ready for Plan 03/04's downgrade/restore scoping.
- Blocker: the orchestrator must merge `backend` branch `worktree-agent-a0ecacc1bc4123436-backend` into `backend/main` before any downstream plan/agent that depends on this migration can build on top of it in a fresh worktree (same as the existing phase-37 merge pattern).

---
*Phase: 38-upgrade-downgrade-lifecycle*
*Completed: 2026-07-22*
