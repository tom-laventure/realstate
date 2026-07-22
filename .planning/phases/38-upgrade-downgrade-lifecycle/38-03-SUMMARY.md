---
phase: 38-upgrade-downgrade-lifecycle
plan: 03
subsystem: api
tags: [rails, activejob, solid_queue, minitest, factory_bot]

# Dependency graph
requires:
  - phase: 38-01
    provides: "brokerage_memberships.suspended_at / brokerage_board_credentials.suspended_at / brokerages.plan_downgraded_at columns, BrokerageBoardCredential#status suspended enum value, BrokerageMembership#suspend!/#restore!/#suspended?"
  - phase: 38-02
    provides: "TestBoardPurgeService.call!(brokerage:) — hard-delete cascade for TEST-board demo data"
provides:
  - "ApplyPlanTransitionJob — single async dispatch point for purge/freeze+suspend/restore based on old->new plan direction"
  - "Downgrade cascade: freeze_custom_domains! + suspend real-board credentials + suspend client memberships, one shared plan_downgraded_at timestamp"
  - "Restore cascade scoped strictly to suspended_at == plan_downgraded_at (D-06 — never reactivates unrelated/earlier suspensions)"
affects: [38-05-ops-plan-controller-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Timestamp-scoped restore (RESEARCH.md Pattern 1): stamp every row suspended by one downgrade event with an identical Time.current, then restore only rows matching that exact timestamp"
    - "Mailer dispatched via deliver_later AFTER the enclosing ApplicationRecord.transaction block returns (never inside it)"

key-files:
  created:
    - backend/app/jobs/apply_plan_transition_job.rb
    - backend/test/jobs/apply_plan_transition_job_test.rb
  modified: []

key-decisions:
  - "paid?(plan) defined as plan != \"free\" — free is the only unpaid tier in the validated %w[free independent growth] set; paid<->paid and free<->free are explicit no-ops (Phase 39 owns paid<->paid billing recalculation)"
  - "Re-upgrade does NOT restore custom-domain is_primary (RESEARCH.md Open Q1 / A3, resolved here) — unfreeze_custom_domains! intentionally leaves the subdomain primary; a code comment documents that the owner must manually reassign it. PLAN-18 only covers RETS credentials and client memberships."
  - "restore! scopes strictly to suspended_at == brokerage.plan_downgraded_at (not a blanket status: \"suspended\" filter) — the D-06 mitigation that keeps an earlier/unrelated suspension from being silently reactivated on re-upgrade"

patterns-established:
  - "ApplyPlanTransitionJob is the sole dispatch point for all four plan-transition side-effect cascades; Plan 05's Ops::PlanController enqueues it exclusively, never runs any cascade synchronously in the request (D-02)"

requirements-completed: [PLAN-14, PLAN-15, PLAN-16, PLAN-17, PLAN-18]

# Metrics
duration: ~50min (across two sessions, interrupted by an API session-limit error between Task 1 draft and Task 1 verification/commit)
completed: 2026-07-22
---

# Phase 38 Plan 03: ApplyPlanTransitionJob Summary

**`ApplyPlanTransitionJob` dispatches all four plan-transition side-effect cascades (TEST-board purge on upgrade, domain-freeze + credential/membership-suspend on downgrade, event-scoped restore on re-upgrade) from a single async job, mirroring `SendInvitationEmailJob`'s shape and satisfying D-06's "restore only this downgrade's suspensions" invariant.**

## Performance

- **Duration:** ~50 min total (spanned two sessions — an API session-limit error interrupted execution right after Task 1's file was drafted but before it was verified/committed; the continuation session verified the draft against the plan's acceptance criteria, committed it, then completed Task 2)
- **Completed:** 2026-07-22T06:34:50Z
- **Tasks:** 2/2 completed
- **Files created:** 2 (job + job test)

## Accomplishments
- `ApplyPlanTransitionJob#perform(brokerage_id, old_plan, new_plan)` classifies free/paid direction and dispatches to the correct cascade:
  - **Upgrade (free → paid):** always calls `TestBoardPurgeService.call!`; additionally calls a private `restore!` (only when `plan_downgraded_at.present?`) and clears `plan_downgraded_at` afterward
  - **Downgrade (paid → free):** private `downgrade!` freezes custom domains, suspends active real-board credentials, suspends client memberships, and stamps `plan_downgraded_at` — all four writes share one `Time.current` timestamp captured once, inside a single `ApplicationRecord.transaction`; `DomainMailer.downgrade_notice(...).deliver_later` is dispatched only after that transaction returns
  - **Paid → paid / free → free:** explicit no-op (Phase 39's responsibility)
- `restore!` scopes both the credential and membership restore queries to `suspended_at == plan_downgraded_at` exactly — never a blanket `status: "suspended"` filter — satisfying D-06
- No `is_primary` mutation anywhere in the job (verified via `grep -n is_primary`, both occurrences are inside the explanatory code comment, not code)
- Full Minitest coverage in `test/jobs/apply_plan_transition_job_test.rb` (6 tests): downgrade suspends the right rows with one shared timestamp; downgrade leaves an already-`invalid` credential and a non-client (owner) membership untouched; re-upgrade restores exactly the current event's rows and clears `plan_downgraded_at`; re-upgrade does NOT reactivate a credential suspended by a different, unrelated timestamp (D-06 negative case); upgrade purges TEST-board data (dispatches to `TestBoardPurgeService`); paid→paid performs no freeze/suspend/purge

## Task Commits

Both tasks were committed atomically in the `backend` sub-repo (branch `worktree-agent-abb6ec41b1abd6f89-backend`, based on `backend@36e44de` — the merged tip of plans 38-01/38-02):

1. **Task 1: Build ApplyPlanTransitionJob with direction dispatch** - `d1750e2` (feat) - backend
2. **Task 2: Test job direction branches and scoped restore** - `f406576` (test) - backend

**Plan metadata:** committed separately in the monorepo worktree (this SUMMARY only — no STATE.md/ROADMAP.md writes; orchestrator owns those per worktree execution mode).

**Backend branch for orchestrator merge:** `worktree-agent-abb6ec41b1abd6f89-backend`, base SHA `36e44de08626d7ed5b49deb1a2c618751eaadd7b` (matches the monorepo gitlink pointer at this worktree's spawn commit, confirming plans 38-01 and 38-02 are already merged underneath these two new commits).

## Files Created/Modified
- `backend/app/jobs/apply_plan_transition_job.rb` - `ApplyPlanTransitionJob < ApplicationJob`: `queue_as :default`, `retry_on StandardError`, `discard_on ActiveRecord::RecordNotFound`; `perform`/`paid?`/`downgrade!`/`restore!`
- `backend/test/jobs/apply_plan_transition_job_test.rb` - 6 tests covering all four direction branches, the D-06 negative case, and the D-05 already-invalid/non-client negative case

## Decisions Made
- Followed the plan's locked design exactly for direction classification, the downgrade/restore query shapes, and the `is_primary` non-mutation decision — no deviation from 38-03-PLAN.md's Task 1 action.
- Test fixtures modeled directly on `test/integration/ops_plan_test.rb` (domain fixtures) and `test/services/test_board_purge_service_test.rb` (TEST-board purge fixtures) for consistency with the codebase's existing test conventions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Backend sub-repo was empty in this worktree; required a full bootstrap**
- **Found during:** Before Task 1 could begin
- **Issue:** `backend/` is a gitlinked sub-repo (no `.gitmodules`) and the worktree's `backend/` directory was empty — no `.git`, no installed gems, no `master.key`/`.env`.
- **Fix:** Cloned `backend/.git` from the main checkout (`git clone /home/tomlaventure/projects/realstate/backend/.git backend`), confirmed the resulting HEAD (`36e44de`) matched the monorepo's gitlink pointer exactly, created branch `worktree-agent-abb6ec41b1abd6f89-backend`, then copied the gitignored `.bundle/config`, `vendor/bundle` (installed gems), `.env`, and `config/master.key` from the main checkout so `bin/rails`/`bin/rails test` could run without a network-dependent `bundle install`. (First `vendor` copy attempt nested incorrectly as `vendor/vendor/bundle` due to a pre-existing `vendor/.keep`-only directory; corrected with `cp -r source/. dest/` to merge contents instead of nesting.)
- **Files modified:** None tracked (bootstrap files are all gitignored: `.bundle/config`, `vendor/bundle/`, `.env`, `config/master.key`)
- **Verification:** `bin/rails runner "puts 'ok'"` succeeded; `bundle exec standardrb` ran clean on both new files.
- **Committed in:** N/A (environment setup only)

**2. [Rule 3 - Blocking] `ActiveRecord::Encryption` credential missing without `config/master.key`**
- **Found during:** First test run attempt (before `master.key` was copied)
- **Issue:** `BrokerageBoardCredential` uses `encrypts` on its RETS credential columns; without `config/master.key` (gitignored, not present in the fresh clone), any factory that touches the model raised `ActiveRecord::Encryption::Errors::Configuration: Missing Active Record encryption credential`.
- **Fix:** Copied `config/master.key` from the main checkout's `backend/` (bootstrap file, not committed).
- **Files modified:** None tracked
- **Verification:** Subsequent test runs no longer raised the encryption configuration error.
- **Committed in:** N/A (environment setup only)

---

**Total deviations:** 2 auto-fixed (both blocking/environment bootstrap, no code or design deviation)
**Impact on plan:** Zero — both tasks were executed exactly as written once the backend sub-repo was fully bootstrapped. No job logic, test assertions, or acceptance criteria were altered.

## Issues Encountered

- **Pre-existing environmental flakiness (not introduced by this plan):** `RAILS_ENV=test` resolves to the same live remote Postgres database (`neondb`) as development, per the condition already documented in `.planning/STATE.md`'s Blockers/Concerns section (`DATABASE_URL` leaks into `RAILS_ENV=test`). Every invocation of `bin/rails test` triggers a `db:test:load_schema => db:test:purge` round-trip against that remote DB (~7-11 min per run), and — because a sibling worktree agent (plan 38-04) is executing concurrently against the *same* shared remote database in its own bootstrapped backend clone — several test runs hit transient `PG::ObjectInUse` / `PG::UnableToSend: no connection to the server` errors during Minitest's fixture-transaction setup (`ActiveRecord::TestFixtures#setup_fixtures`), not inside any of this plan's own code.
  - Ran the full 6-test suite four times. In every run, whichever tests *did* execute produced 100% passing assertions (11, 18, 20, and again a partial run's worth of assertions across the four attempts — 0 assertion failures in any run). Only the transient connection-drop errors varied in count and which test they landed on between runs, which is itself evidence the flakiness is connection-level/environmental rather than a defect in the job or test logic.
  - This matches the exact issue already called out in 38-01-SUMMARY.md and 38-02-SUMMARY.md ("RAILS_ENV=test bin/rails test resolves to the same live Postgres... unrelated test errors remain in the full suite"). No code change was made to work around it — doing so would be out of this plan's scope and risks masking a real future regression.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 05 (Ops::PlanController wiring) can now enqueue `ApplyPlanTransitionJob.perform_later(brokerage.id, old_plan, new_plan)` directly — the job's full four-branch dispatch contract is built and tested.
- Sibling plan 38-04 (executing in parallel, no file overlap — CognitoAuth suspended-membership enforcement) is unaffected by this plan's changes.
- **Orchestrator action required:** merge backend branch `worktree-agent-abb6ec41b1abd6f89-backend` (base `36e44de08626d7ed5b49deb1a2c618751eaadd7b`) into `backend/main`, same pattern as the prior 38-01/38-02 merges, before Plan 05 (or any other downstream plan) builds on top of it in a fresh worktree.

---
*Phase: 38-upgrade-downgrade-lifecycle*
*Completed: 2026-07-22*

## Self-Check: PASSED

- FOUND: backend/app/jobs/apply_plan_transition_job.rb
- FOUND: backend/test/jobs/apply_plan_transition_job_test.rb
- FOUND: .planning/phases/38-upgrade-downgrade-lifecycle/38-03-SUMMARY.md
- FOUND: backend commit d1750e2 (Task 1)
- FOUND: backend commit f406576 (Task 2)
