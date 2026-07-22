---
phase: 38-upgrade-downgrade-lifecycle
plan: 05
subsystem: api
tags: [rails, activejob, ops-endpoint, minitest, factory_bot]

# Dependency graph
requires:
  - phase: 38-03
    provides: "ApplyPlanTransitionJob.perform_later(brokerage_id, old_plan, new_plan) — single async dispatch point for the purge/freeze+suspend/restore cascades"
provides:
  - "Ops::PlanController#update/#create — the single Ops-only trigger for a brokerage plan transition, accepting {plan: <target>}"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Controller validates target against AppConstants::PLAN_TIERS.key?(new_plan) before any state change (fail-closed on invalid input)"
    - "old_plan captured before the flip; same-plan requests return an explicit noop status with zero side effects"
    - "Controller enqueues perform_later exclusively — never runs the cascade inline (D-02)"

key-files:
  created: []
  modified:
    - backend/app/controllers/ops/plan_controller.rb
    - backend/test/integration/ops_plan_test.rb

key-decisions:
  - "Old boolean freeze:/unfreeze: branch and its inline freeze_custom_domains!/unfreeze_custom_domains!/DomainMailer.deliver_now! calls removed entirely — the async job (Plan 03) now owns the full downgrade/restore cascade including the domain freeze, so retaining the inline calls here would double-freeze on every downgrade"
  - "Invalid plan value checked via AppConstants::PLAN_TIERS.key?(new_plan) (not a hardcoded %w[] literal) so the allowlist stays in sync with the single source of truth in app/constants/plan_tiers.rb"

requirements-completed: [PLAN-14, PLAN-15, PLAN-16, PLAN-17, PLAN-18]

# Metrics
duration: ~35min
completed: 2026-07-21
---

# Phase 38 Plan 05: Ops::PlanController Plan-Transition Wiring Summary

**`Ops::PlanController#update` now accepts `{plan: "<target>"}`, validates it against the tier allowlist, flips `brokerage.plan`, and enqueues `ApplyPlanTransitionJob(id, old_plan, new_plan)` — replacing the old two-valued boolean `freeze:` param with the three-tier trigger the Plan 03 cascade job needs.**

## Performance

- **Duration:** ~35 min (backend sub-repo bootstrap + both tasks)
- **Completed:** 2026-07-21
- **Tasks:** 2/2 completed
- **Files modified:** 2 (controller + integration test)

## Accomplishments

- `Ops::PlanController#update` reads `params[:plan]`, validates it against `AppConstants::PLAN_TIERS.key?(new_plan)`, and rejects invalid values with `422` before any flip or enqueue
- Captures `old_plan` before `@brokerage.update!(plan: new_plan)`; same-plan requests short-circuit to an explicit `status: "noop"` response with no DB write and no job enqueued
- On a real transition, flips the plan then enqueues `ApplyPlanTransitionJob.perform_later(@brokerage.id, old_plan, new_plan)` — never runs the cascade inline (D-02) — and responds `status: "transitioning"` with both `old_plan`/`new_plan` in the body
- Removed the old boolean `freeze:`/`unfreeze:` branch and its inline `freeze_custom_domains!`/`unfreeze_custom_domains!`/`DomainMailer.downgrade_notice(...).deliver_now!` calls — that cascade now lives entirely inside `ApplyPlanTransitionJob#downgrade!`/`#restore!` (Plan 03), so retaining the inline calls here would have double-frozen domains on every downgrade
- Preserved the two-tier rescue block (`ActiveRecord::RecordInvalid` → 422 with details, generic `rescue =>` → 422), the `set_brokerage` before_action/private helper, `alias_method :create, :update`, and the inherited `Ops::BaseController` HTTP Basic auth — no changes needed there
- Rewrote `test/integration/ops_plan_test.rb`'s freeze/unfreeze tests into 6 tests covering the new contract: growth→free transition (job enqueued with correct args), free→growth transition, same-plan no-op (no job), invalid plan value (422, no job, no flip), unauthenticated 401, unknown-brokerage 404

## Task Commits

Both tasks committed atomically in the `backend` sub-repo (branch `worktree-agent-a694cb4e1657646fd-backend`, based on `backend@3da7855` — the merged tip of plans 38-01 through 38-04):

1. **Task 1: Extend Ops::PlanController to flip plan and enqueue the job** - `c4508d8` (feat) - backend
2. **Task 2: Rewrite ops_plan_test for the plan-transition contract** - `081a864` (test) - backend

**Plan metadata:** committed separately in the monorepo worktree (this SUMMARY only — no STATE.md/ROADMAP.md writes; orchestrator owns those per worktree execution mode).

**Backend branch for orchestrator merge:** `worktree-agent-a694cb4e1657646fd-backend`, base SHA `3da7855eba39c0b98f6e1722fc9d4c47337b4269` (matches `backend/main`'s tip at this worktree's spawn time, confirming plans 38-01 through 38-04 are already merged underneath these two new commits).

## Files Created/Modified

- `backend/app/controllers/ops/plan_controller.rb` - `update` rewritten to accept `{plan: <target>}`, validate against `AppConstants::PLAN_TIERS`, flip the plan, and enqueue `ApplyPlanTransitionJob.perform_later`; old boolean `freeze:` branch and inline domain-freeze/email calls removed
- `backend/test/integration/ops_plan_test.rb` - 6 tests covering the transition/no-op/invalid-plan/401/404 contract, using `assert_enqueued_with`/`assert_no_enqueued_jobs`

## Decisions Made

- Followed the plan's locked design exactly for validation order (validate → capture old_plan → no-op check → flip → enqueue), the response shapes, and which lines to remove. No deviation from 38-05-PLAN.md's Task 1/Task 2 actions.
- Used `AppConstants::PLAN_TIERS.key?(new_plan)` rather than a hardcoded `%w[free independent growth]` literal for the validation check (the plan's Step 1 offered either) — keeps the allowlist tied to the single source of truth in `app/constants/plan_tiers.rb`, consistent with `Brokerage#plan_config`'s existing `.fetch(plan)` pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Backend sub-repo was empty in this worktree; required a full bootstrap**
- **Found during:** Before Task 1 could begin
- **Issue:** `backend/` is a gitlinked sub-repo and the worktree's `backend/` directory was empty — no `.git`, no installed gems, no `master.key`/`.env`.
- **Fix:** Cloned `backend/.git` from the main checkout (`git clone /home/tomlaventure/projects/realstate/backend/.git backend`), confirmed the resulting HEAD (`3da7855`) matched the main checkout's tip (already containing plans 38-01–38-04 merged), created branch `worktree-agent-a694cb4e1657646fd-backend`, then copied the gitignored `.bundle/config`, `vendor/bundle` (installed gems), `.env`, and `config/master.key` from the main checkout so `bin/rails test` could run without a network-dependent `bundle install`.
- **Files modified:** None tracked (bootstrap files are all gitignored: `.bundle/config`, `vendor/bundle/`, `.env`, `config/master.key`)
- **Verification:** `bin/rails runner "puts 'ok'"` succeeded; `bundle exec standardrb` ran clean on both edited files.
- **Committed in:** N/A (environment setup only)

**2. [Process] Monorepo worktree branch accidentally switched during backend bootstrap, corrected immediately**
- **Found during:** Backend bootstrap step
- **Issue:** A `git checkout -b <name>-backend` intended only for the backend clone was mistakenly run first at the monorepo worktree root, switching the monorepo worktree off its assigned `worktree-agent-a694cb4e1657646fd` branch.
- **Fix:** Immediately `git checkout worktree-agent-a694cb4e1657646fd` back to the correct branch and deleted the accidental branch (`git branch -D`) before any commit landed on it.
- **Files modified:** None (caught before any monorepo commit)
- **Verification:** `git branch --show-current` confirmed `worktree-agent-a694cb4e1657646fd` before proceeding to any monorepo-side work.
- **Committed in:** N/A

---

**Total deviations:** 2 auto-fixed (both environment/process bootstrap issues, no code or design deviation)
**Impact on plan:** Zero — both tasks were executed exactly as written once the backend sub-repo was fully bootstrapped and the monorepo worktree branch was corrected. No controller logic, test assertions, or acceptance criteria were altered from the plan.

## Issues Encountered

- **Pre-existing environmental flakiness (not introduced by this plan, documented in STATE.md/38-03-SUMMARY.md/38-04-SUMMARY.md):** `RAILS_ENV=test` resolves to the same live remote Postgres database as development. The first `bin/rails test` invocation logged a `db:test:purge` trace (connection-level error during schema purge) but the test run itself still completed cleanly afterward — `6 runs, 29 assertions, 0 failures, 0 errors, 0 skips` on both the initial run and a confirming re-run. Treated as transient connection flakiness per the documented known issue, not a defect.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Ops-only plan-transition trigger is now live end-to-end: `Ops::PlanController` → `ApplyPlanTransitionJob` → the four cascade branches (purge/freeze+suspend/restore/no-op) built across Plans 01–04.
- This was the last plan in Phase 38 (wave 3, single plan, depends only on 38-03).
- **Orchestrator action required:** merge backend branch `worktree-agent-a694cb4e1657646fd-backend` (base `3da7855eba39c0b98f6e1722fc9d4c47337b4269`) into `backend/main`, same pattern as the prior 38-01/38-02/38-03/38-04 merges.

---
*Phase: 38-upgrade-downgrade-lifecycle*
*Completed: 2026-07-21*

## Self-Check: PASSED

- FOUND: backend/app/controllers/ops/plan_controller.rb (modified)
- FOUND: backend/test/integration/ops_plan_test.rb (modified)
- FOUND: .planning/phases/38-upgrade-downgrade-lifecycle/38-05-SUMMARY.md
- FOUND: backend commit c4508d8 (Task 1)
- FOUND: backend commit 081a864 (Task 2)
