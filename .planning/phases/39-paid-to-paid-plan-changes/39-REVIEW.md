---
phase: 39-paid-to-paid-plan-changes
reviewed: 2026-07-22T17:59:38Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - backend/db/migrate/20260722000001_create_plan_billing_snapshots.rb
  - backend/app/models/plan_billing_snapshot.rb
  - backend/test/factories/plan_billing_snapshots.rb
  - backend/db/schema.rb
  - backend/app/models/brokerage.rb
  - backend/app/jobs/apply_plan_transition_job.rb
  - backend/test/jobs/apply_plan_transition_job_test.rb
findings:
  critical: 2
  warning: 3
  info: 1
  total: 6
status: issues_found
---

# Phase 39: Code Review Report

**Reviewed:** 2026-07-22T17:59:38Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the `plan_billing_snapshots` migration/model/factory, the `Brokerage` domain-freeze/unfreeze methods, and `ApplyPlanTransitionJob` (the async cascade for free↔paid and paid↔paid plan transitions), plus its test suite.

The paid↔paid billing recalculation path (PLAN-19) is correct and well-tested: pricing is keyed by `new_plan`, overage is floored at zero, and seat counting excludes clients/deleted memberships as documented. However, tracing the downgrade/restore cascade against its own stated invariant (D-06: "restore is strictly scoped to the event that suspended a row, never a blanket filter") surfaced two provable correctness bugs:

1. `ApplyPlanTransitionJob#downgrade!` is **not idempotent** — a retried/redelivered job (this app runs `solid_queue`, and the job itself declares `retry_on StandardError, attempts: 3`) generates a fresh `Time.current` stamp on every invocation and unconditionally writes it to `brokerage.plan_downgraded_at`, even when the credential/membership rows it's supposed to be paired with were already stamped by an earlier attempt and are therefore skipped on the retry. This desyncs `plan_downgraded_at` from the rows' `suspended_at`, permanently breaking `restore!`'s ability to find them on re-upgrade.
2. `Brokerage#unfreeze_custom_domains!` (called from the free-upgrade path) has **no event scoping at all** — unlike the credential/membership restore, which strictly matches `suspended_at: event`, it restores *every* frozen custom domain belonging to the brokerage, including ones frozen for reasons unrelated to this plan-downgrade event. There is no `frozen_at` (or similar) column to even support such scoping, so a domain frozen for e.g. a policy/fraud reason would be silently reactivated the next time the brokerage re-upgrades.

Both directly contradict the documented design intent in the same files, and neither is covered by the existing test suite (which only ever exercises a single downgrade → single re-upgrade cycle with domains/credentials known to belong to that one event).

## Structural Findings (fallow)

None provided for this review.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `downgrade!` is not idempotent — retried/redelivered job desyncs `plan_downgraded_at` from suspended rows, permanently breaking restore

**File:** `backend/app/jobs/apply_plan_transition_job.rb:43-63`

**Issue:**
`ApplyPlanTransitionJob` declares `retry_on StandardError, wait: :polynomially_longer, attempts: 3` (line 7), and the app's queue adapter is `solid_queue` (`config/environments/{development,production}.rb`), which is an at-least-once backend — a job can be re-executed after a worker crash or transient failure even outside `retry_on`.

`downgrade!` computes `stamp = Time.current` fresh on every call (line 44) and, inside the transaction, only updates rows that currently match `credential_active` / `suspended_at: nil` (lines 49-56). If `downgrade!` is invoked a second time for the same event — e.g. because `DomainMailer.downgrade_notice(brokerage).deliver_later` (line 62, deliberately placed *outside* the transaction) raises, or the job is redelivered after the first transaction already committed — the second invocation:

- Re-runs `freeze_custom_domains!` (harmless, idempotent).
- Finds zero matching rows for the credential/membership `update_all` calls, because they're already `suspended` / already have `suspended_at` set from the first attempt — so their `suspended_at` **keeps the original stamp**.
- Still executes `brokerage.update!(plan_downgraded_at: stamp)` unconditionally with the **new** `stamp` — overwriting `plan_downgraded_at` with a timestamp that no longer matches any child row.

After this, `restore!` (line 75-89) reads `event = brokerage.plan_downgraded_at` and looks for rows `WHERE suspended_at = event`. Since the child rows still carry the *original* stamp and `plan_downgraded_at` now holds the *second* stamp, `restore!` matches **zero rows** on the next re-upgrade — the credential and client membership stay permanently suspended and the brokerage can never be restored via the normal flow, with no error raised anywhere to surface the problem.

**Fix:** Make `downgrade!` idempotent by short-circuiting when the brokerage is already downgraded, and/or don't generate a new stamp if one already exists:
```ruby
def downgrade!(brokerage)
  return if brokerage.plan_downgraded_at.present? # already downgraded — retry/redelivery no-op

  stamp = Time.current

  ApplicationRecord.transaction do
    brokerage.freeze_custom_domains!

    brokerage.brokerage_board_credentials.without_deleted
      .credential_active
      .joins(:real_estate_board).merge(RealEstateBoard.real_boards)
      .update_all(status: "suspended", suspended_at: stamp)

    brokerage.brokerage_memberships.without_deleted
      .where(role: "client", suspended_at: nil)
      .update_all(suspended_at: stamp)

    brokerage.update!(plan_downgraded_at: stamp)
  end

  DomainMailer.downgrade_notice(brokerage).deliver_later
end
```
Also consider moving the `DomainMailer` dispatch to run only once (e.g. guard it behind the same idempotency check, or accept at-least-once mailer delivery deliberately) and add a test that calls `ApplyPlanTransitionJob.perform_now(@brokerage.id, "growth", "free")` twice in a row and asserts `plan_downgraded_at` and the child rows' `suspended_at` all still match after the second call.

---

### CR-02: `unfreeze_custom_domains!` restores ALL frozen custom domains, not just the ones frozen by the current downgrade event — violates the file's own D-06 invariant

**File:** `backend/app/models/brokerage.rb:70-81` (called from `backend/app/jobs/apply_plan_transition_job.rb:79`)

**Issue:** The class comment on `restore!` (job file, lines 65-74) explicitly states the design invariant:

> "restore is strictly scoped to `suspended_at == the most recent downgrade event's timestamp`, never a blanket `status: "suspended"` filter. This is what keeps a credential/membership suspended by an earlier or unrelated event from being silently reactivated on re-upgrade."

The credential and membership `update_all` calls in `restore!` do honor this (`where(status: "suspended", suspended_at: event)`). But `unfreeze_custom_domains!`, called immediately before those two `update_all`s, has **no equivalent scoping**:

```ruby
def unfreeze_custom_domains!
  brokerage_domains.domain_type_custom
                   .status_frozen
                   .where(verified: true)
                   .update_all(status: "active")
  brokerage_domains.domain_type_custom
                   .status_frozen
                   .where(verified: false)
                   .update_all(status: "pending")
end
```

This restores **every** frozen custom domain for the brokerage, regardless of when or why it was frozen. There is also no `frozen_at`/event column on `brokerage_domains` (confirmed against `db/schema.rb:35-54`) to ever add such scoping later without a migration. Concretely: if a custom domain is frozen for a reason unrelated to a plan downgrade (ops action, abuse/fraud hold, manual intervention), and this same brokerage later downgrades-then-reupgrades for billing reasons, that unrelated freeze is silently undone — the exact class of bug the job's own documentation says it is designed to prevent.

**Fix:** Add an event-scoping column (e.g. `frozen_at`) to `brokerage_domains`, stamp it in `freeze_custom_domains!` with the same `stamp` used for credentials/memberships (requires threading the timestamp through, e.g. `freeze_custom_domains!(stamp)` / `unfreeze_custom_domains!(event)`), and scope the restore to it:
```ruby
def freeze_custom_domains!(stamp)
  brokerage_domains.domain_type_custom
                   .where(status: %w[active pending phasing_out])
                   .update_all(status: "frozen", frozen_at: stamp)
  brokerage_domains.update_all(is_primary: false)
  brokerage_domains.domain_type_subdomain
                   .status_active
                   .first
                   &.update!(is_primary: true)
end

def unfreeze_custom_domains!(event)
  brokerage_domains.domain_type_custom
                   .status_frozen.where(verified: true, frozen_at: event)
                   .update_all(status: "active")
  brokerage_domains.domain_type_custom
                   .status_frozen.where(verified: false, frozen_at: event)
                   .update_all(status: "pending")
end
```
At minimum, add a regression test mirroring the existing "re-upgrade does not reactivate a credential suspended by a different, unrelated event" test (`test/jobs/apply_plan_transition_job_test.rb:57-71`), but for a custom domain frozen outside of the current downgrade event — the current suite has no such case and would not catch this bug.

## Warnings

### WR-01: Job has no guard against being invoked with `old_plan == new_plan`; relies entirely on the controller's no-op check

**File:** `backend/app/jobs/apply_plan_transition_job.rb:10-29`

**Issue:** `perform` classifies the transition purely from `paid?(old_plan)` / `paid?(new_plan)`. The only caller today (`Ops::PlanController#update`) special-cases `old_plan == new_plan` as a no-op and never enqueues the job in that case — but the job's own comment says it's also meant to be invoked by "a future billing webhook (v2)," and nothing in the job itself defends against a caller that doesn't repeat that guard. If `perform` is ever called with `old_plan == new_plan == "free"`, it falls into the `else` branch and calls `recalculate_billing!(brokerage, "free")`, which fetches `AppConstants::PLAN_TIERS.fetch("free")` (`seat_cap: nil`, fine) but then calls `PlanBillingSnapshot.create!(plan: "free", ...)` — which fails `PlanBillingSnapshot`'s own validation (`inclusion: {in: %w[independent growth]}`, `plan_billing_snapshot.rb:4`), raising `ActiveRecord::RecordInvalid`. Because that's a `StandardError`, `retry_on StandardError, attempts: 3` will retry it 3 times with a growing backoff even though the error is deterministic and will never succeed, before it finally lands in the failed-jobs table.
For `old_plan == new_plan` on any paid plan (e.g. `"growth" == "growth"`), the job doesn't crash but silently creates a spurious duplicate `PlanBillingSnapshot` row for a transition that never actually happened.

**Fix:** Add an explicit guard at the top of `perform`:
```ruby
def perform(brokerage_id, old_plan, new_plan)
  return if old_plan == new_plan

  brokerage = Brokerage.find(brokerage_id)
  ...
```

### WR-02: `Brokerage` has no `has_many :plan_billing_snapshots` — inconsistent with the rest of the model's association style

**File:** `backend/app/models/brokerage.rb:4-12`, `backend/app/models/plan_billing_snapshot.rb:2`

**Issue:** Every other `belongs_to :brokerage` model in this codebase (e.g. `brokerage_board_credentials`, `brokerage_memberships`, `invitations`, `groups`, `brokerage_domains`) has a matching `has_many` declared on `Brokerage`. `PlanBillingSnapshot belongs_to :brokerage`, but `Brokerage` declares no inverse `has_many :plan_billing_snapshots`. Functionally the job still works because `PlanBillingSnapshot.create!(brokerage: brokerage, ...)` only needs the `belongs_to` side, but any future billing-history feature (e.g. an admin endpoint to list a brokerage's snapshots) will have to hand-roll `PlanBillingSnapshot.where(brokerage_id: ...)` instead of using `brokerage.plan_billing_snapshots`, breaking the established convention.

**Fix:**
```ruby
has_many :plan_billing_snapshots, dependent: :destroy
```
(or `dependent: :restrict_with_error` if snapshots should be treated as an immutable audit trail that must outlive an accidental hard-delete of the brokerage).

### WR-03: Paid↔paid recalculation can use a stale `new_plan` if two transitions are enqueued in quick succession

**File:** `backend/app/jobs/apply_plan_transition_job.rb:96-108`, `backend/app/controllers/ops/plan_controller.rb:29-31`

**Issue:** `Ops::PlanController#update` updates `brokerage.plan` synchronously and then enqueues `ApplyPlanTransitionJob.perform_later(@brokerage.id, old_plan, new_plan)`. If two plan-change requests for the same brokerage race (e.g. `growth → independent` immediately followed by `independent → free`), both jobs read `brokerage.billable_seat_count` at execution time (correctly "live"), but `recalculate_billing!` prices the snapshot using the `new_plan` **argument** captured at enqueue time, not `brokerage.plan` at execution time. If job execution order doesn't match enqueue order (solid_queue does not guarantee strict FIFO across retries/workers), a stale `PlanBillingSnapshot` row can be written for a plan the brokerage is no longer on, with no record of it being stale.

**Fix:** Guard against the mismatch, or at least validate the current plan matches the expected transition before writing:
```ruby
def recalculate_billing!(brokerage, new_plan)
  return unless brokerage.plan == new_plan # transition superseded by a later one — skip

  tier = AppConstants::PLAN_TIERS.fetch(new_plan)
  ...
```

## Info

### IN-01: `tier.seat_cap || 0` fallback in `recalculate_billing!` is unreachable in the current branch

**File:** `backend/app/jobs/apply_plan_transition_job.rb:99`

**Issue:** `recalculate_billing!` is only called from the `else` branch of `perform`, which is reached only when `paid?(old_plan) && paid?(new_plan)` (paid → paid). `new_plan` is therefore always `"independent"` or `"growth"`, both of which have a non-nil `seat_cap` (`app/constants/plan_tiers.rb:29,39`). The only tier with `seat_cap: nil` is `"free"`, which this branch never receives. The `|| 0` fallback is currently dead defensive code.

**Fix:** Either leave a comment noting it's intentionally defensive against a future tier with an unset cap, or remove it if that's not a realistic future case — purely a readability nit, not a behavioral concern.

---

_Reviewed: 2026-07-22T17:59:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
