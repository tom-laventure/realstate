---
phase: 39-paid-to-paid-plan-changes
fixed_at: 2026-07-22T19:35:38Z
review_path: .planning/phases/39-paid-to-paid-plan-changes/39-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 39: Code Review Fix Report

**Fixed at:** 2026-07-22T19:35:38Z
**Source review:** .planning/phases/39-paid-to-paid-plan-changes/39-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (critical + warning): 5
- Fixed: 5
- Skipped: 0

Fix scope was `critical_warning`, so IN-01 (readability nit about a dead
`|| 0` fallback) was intentionally excluded and left untouched.

All fixes were applied and committed in the `backend/` repo (a separate
git repository nested in this monorepo, not a submodule). Each commit was
verified against the existing Rails test suite (`bin/rails test`) for the
affected files before being committed — no regressions were introduced.

## Fixed Issues

### CR-01: `downgrade!` is not idempotent — retried/redelivered job desyncs `plan_downgraded_at` from suspended rows, permanently breaking restore

**Files modified:** `backend/app/jobs/apply_plan_transition_job.rb`, `backend/test/jobs/apply_plan_transition_job_test.rb`
**Commit:** `49701bf`
**Applied fix:** Added `return if brokerage.plan_downgraded_at.present?` at the
top of `downgrade!` so a retried/redelivered job (solid_queue is at-least-once;
the job also declares `retry_on StandardError, attempts: 3`) is a true no-op
instead of overwriting `plan_downgraded_at` with a fresh timestamp that no
longer matches the already-suspended credential/membership rows. Added a
regression test that runs the job twice for the same downgrade event and
asserts the brokerage is still fully restorable afterward.

This finding was in code that predates phase 39 (phase 38), per the task
context, but was fixed and verified per the instruction that pre-existing
bugs surfaced by the review are still worth fixing when it can be done safely.

### CR-02: `unfreeze_custom_domains!` restores ALL frozen custom domains, not just the ones frozen by the current downgrade event

**Files modified:** `backend/app/jobs/apply_plan_transition_job.rb`, `backend/app/models/brokerage.rb`, `backend/db/migrate/20260722000002_add_frozen_at_to_brokerage_domains.rb`, `backend/db/schema.rb`, `backend/test/jobs/apply_plan_transition_job_test.rb`, `backend/test/models/brokerage_freeze_test.rb`
**Commit:** `8efebc9`
**Applied fix:** Added a `frozen_at` column (+ index) to `brokerage_domains`
via a new migration, matching the existing `suspended_at` pattern on
credentials/memberships. Threaded the same downgrade-event timestamp through
`freeze_custom_domains!(stamp)` / `unfreeze_custom_domains!(event)`, and scoped
the restore query to `frozen_at: event` — mirroring `restore!`'s existing
`suspended_at: event` scoping (D-06). Updated `brokerage_freeze_test.rb` to
pass the stamp/event explicitly and added a regression test (in both the model
test and the job test) mirroring the existing "unrelated event" credential
test, but for a custom domain frozen outside of the current downgrade event.

This finding was also in code that predates phase 39, fixed for the same
reason as CR-01.

### WR-01: Job has no guard against being invoked with `old_plan == new_plan`

**Files modified:** `backend/app/jobs/apply_plan_transition_job.rb`, `backend/test/jobs/apply_plan_transition_job_test.rb`
**Commit:** `29acd85`
**Applied fix:** Added `return if old_plan == new_plan` at the top of
`perform`, so a future caller that doesn't repeat the controller's existing
no-op guard (e.g. a v2 billing webhook) can't reach
`recalculate_billing!("free", ...)` (which fails `PlanBillingSnapshot`'s plan
inclusion validator and retries 3x for a deterministic, unrecoverable error)
or silently write a spurious duplicate snapshot for a paid-plan no-op. Added
regression tests for both the free and paid no-op cases. This was in phase
39's own new code, and was prioritized per the task instructions.

### WR-02: `Brokerage` has no `has_many :plan_billing_snapshots`

**Files modified:** `backend/app/models/brokerage.rb`, `backend/test/models/brokerage_test.rb`
**Commit:** `50ea7c2`
**Applied fix:** Added `has_many :plan_billing_snapshots, dependent:
:restrict_with_error` to `Brokerage`, matching the codebase's convention of a
matching inverse association for every `belongs_to :brokerage` model.
`:restrict_with_error` (rather than the suggested `:destroy`) was chosen
because `PlanBillingSnapshot` is explicitly an append-only billing audit
trail (per its own model/job comments) that must survive an accidental
brokerage hard-delete. Added regression tests for the association and for
the restrict-on-destroy behavior.

### WR-03: Paid<->paid recalculation can use a stale `new_plan` if two transitions race

**Files modified:** `backend/app/jobs/apply_plan_transition_job.rb`, `backend/test/jobs/apply_plan_transition_job_test.rb`
**Commit:** `72ba126`
**Applied fix:** Added `return unless brokerage.plan == new_plan` at the top
of `recalculate_billing!`, so a job that executes out of enqueue order (two
racing plan-change requests) skips writing a stale snapshot once it detects
the brokerage's live plan no longer matches the transition it was enqueued
for. Updated the existing paid<->paid tests to set `brokerage.plan` the same
way the controller does synchronously before enqueuing (mirroring the real
invariant this fix depends on), and added a regression test for the
superseded-transition case.

## Skipped Issues

None — all five in-scope findings (CR-01, CR-02, WR-01, WR-02, WR-03) were
fixed and verified. IN-01 was out of scope for `fix_scope: critical_warning`
and was left untouched.

## Verification Notes

- All five commits were verified with `bin/rails test` against the affected
  test files (`test/jobs/apply_plan_transition_job_test.rb`,
  `test/models/brokerage_freeze_test.rb`, `test/models/brokerage_domain_test.rb`,
  `test/models/brokerage_test.rb`, `test/integration/ops_plan_test.rb`,
  `test/models/user_paid_membership_test.rb`, `test/mailers/domain_mailer_test.rb`)
  before committing. Final combined run: 68 runs, 170 assertions, 0 failures,
  0 errors.
- Environment note (not a code issue, no action needed): this backend's
  `RAILS_ENV=test` database config in `database.yml` specifies `sqlite3`, but
  `ENV["DATABASE_URL"]` (loaded from `.env`) takes precedence for the
  "primary" connection in ANY environment per Rails' own
  `ActiveRecord::DatabaseConfigurations` resolution rules — so `test` always
  connects to the same Neon Postgres database as `development` in this local
  setup. This is pre-existing and unrelated to phase 39; it explains
  intermittent `PG::ObjectInUse` / prepared-statement-cache-expired noise
  observed during verification (a long-running `rails console` session was
  found still open from a previous day, sharing the same database), and why
  `?prepared_statements=false` was appended to `DATABASE_URL` for the
  verification runs in this session. The CR-02 migration was applied then
  cleanly rolled back once, then re-applied for good, against this same
  database — schema now matches what's committed in `db/schema.rb`, and no
  test data was left behind (`bin/rails test` wraps each test in a rolled-back
  transaction).
- The `frozen_at` column addition is a purely additive, nullable schema
  change (new column + index), safe for existing rows and existing code.

---

_Fixed: 2026-07-22T19:35:38Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
