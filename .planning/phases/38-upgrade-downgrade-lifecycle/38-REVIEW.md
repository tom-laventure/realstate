---
phase: 38-upgrade-downgrade-lifecycle
reviewed: 2026-07-21T23:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - backend/app/controllers/concerns/cognito_auth.rb
  - backend/app/controllers/ops/plan_controller.rb
  - backend/app/controllers/v1/admin/board_credentials_controller.rb
  - backend/app/jobs/apply_plan_transition_job.rb
  - backend/app/models/brokerage_board_credential.rb
  - backend/app/models/brokerage_membership.rb
  - backend/app/services/test_board_purge_service.rb
  - backend/db/migrate/20260721000001_add_plan_transition_suspend_columns.rb
  - backend/db/schema.rb
  - backend/test/controllers/v1/admin/board_credentials_controller_test.rb
  - backend/test/integration/ops_plan_test.rb
  - backend/test/integration/suspended_membership_auth_test.rb
  - backend/test/jobs/apply_plan_transition_job_test.rb
  - backend/test/models/brokerage_membership_test.rb
  - backend/test/services/test_board_purge_service_test.rb
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 38: Code Review Report

**Reviewed:** 2026-07-21T23:00:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 38's core lifecycle logic is sound. I traced the full purge/freeze/suspend/restore cascade against the actual schema and against the installed `paranoia` gem's source (`vendor/bundle/.../paranoia-3.0.0/lib/paranoia.rb`), not just the RESEARCH.md's stated assumptions:

- **Cross-tenant/brokerage-scoping boundary (focus area 2): clean.** `TestBoardPurgeService` computes TEST-board estate IDs globally but always re-scopes every actual mutation (`BrokerageEstate`, `GroupEstate`) to the calling brokerage's own `groups`/`brokerage_estates`. `ApplyPlanTransitionJob#downgrade!`/`#restore!` operate exclusively through `brokerage.brokerage_board_credentials`/`brokerage.brokerage_memberships` associations — no cross-brokerage leak found.
- **Soft-delete discipline (focus area 1): clean.** Every query I checked in these 15 files correctly guards `acts_as_paranoid` models, including the joined-table guard rule (`EstateDate.without_deleted.joins(:group_estate).where(group_estates: {..., deleted_at: nil})` in `test_board_purge_service.rb`). The one documented hard-delete exception (`GroupEstate#really_destroy!`) is real, intentional, and I confirmed via the gem source that it correctly cascades through both paranoid (subcomments, rsvps) and non-paranoid (likes, rejections) `dependent: :destroy` associations.
- **D-06 restore scoping (focus area 3): correct.** `restore!` scopes strictly to `suspended_at == plan_downgraded_at`, never a blanket `status: "suspended"` filter, and this is exercised by a real negative test case.
- **Mailer/transaction boundary (focus area 5): mostly correct** — `DomainMailer.downgrade_notice(...).deliver_later` is dispatched after the `downgrade!` transaction closes, as intended — but see WR-03 below for a related transaction-boundary gap the review was specifically asked to check.

The issues below are real but narrower: a data-integrity/invisibility gap in `board_credentials_controller#create` (WR-01), a non-atomic plan-flip/job-enqueue sequence in `Ops::PlanController` (WR-02), a small transaction-boundary gap around clearing `plan_downgraded_at` (WR-03), and an un-exercised transaction wrapper mismatch in the purge service (WR-04). None of these are exploitable without either an admin-privileged action or an infrastructure-level failure, so none rise to Critical, but all four should be fixed.

## Warnings

### WR-01: `board_credentials_controller#create` can silently reactivate a suspended credential and leaves stale `suspended_at`

**File:** `backend/app/controllers/v1/admin/board_credentials_controller.rb:48-54`
**Issue:** `index`, `update`, and `destroy` all correctly add `.where.not(status: "suspended")` (D-07: suspended credentials must be "fully invisible ... same as if it never existed"). `create` was deliberately left untouched per the Plan 04 summary ("create's plan_config.real_boards gate is untouched"), but its lookup is a plain `find_or_initialize_by(real_estate_board: board)` with no suspended-status guard:
```ruby
credential = Current.brokerage.brokerage_board_credentials.without_deleted.find_or_initialize_by(
  real_estate_board: board
)
credential.rets_username = username
credential.rets_password = password
credential.assign_attributes(status: "active", last_verified_at: Time.current)
```
This is reachable whenever `plan_config.real_boards` is true (i.e., the brokerage is currently paid) while a credential for that same real board still has `status: "suspended"` — which happens (a) in the async window between `Ops::PlanController` flipping the plan synchronously and `ApplyPlanTransitionJob`'s restore branch actually running, or (b) permanently, if that job ever exhausts its `retry_on` attempts and never completes. In either case, hitting "connect board" for that board finds the hidden suspended row and flips it to `status: "active"` — but unlike `ApplyPlanTransitionJob#restore!` (which does `update_all(status: "active", suspended_at: nil)`), this code path never clears `suspended_at`. The row ends up `status: "active"` with a stale, non-nil `suspended_at`, violating the same invariant `BrokerageMembership#restore!` and the job maintain elsewhere, and bypassing D-06/D-07's "restore is event-scoped, not an ad-hoc action" design.
**Fix:**
```ruby
credential = Current.brokerage.brokerage_board_credentials.without_deleted
  .where.not(status: "suspended")
  .find_or_initialize_by(real_estate_board: board)
# or, if a suspended credential must remain reconnectable via create,
# clear suspended_at explicitly whenever status leaves "suspended":
credential.assign_attributes(status: "active", suspended_at: nil, last_verified_at: Time.current)
```

### WR-02: Plan flip and job enqueue are not atomic in `Ops::PlanController#update`

**File:** `backend/app/controllers/ops/plan_controller.rb:29-31`
**Issue:**
```ruby
@brokerage.update!(plan: new_plan)
ApplyPlanTransitionJob.perform_later(@brokerage.id, old_plan, new_plan)
render json: {status: "transitioning", ...}, status: :ok
```
If `perform_later` raises (e.g., a transient DB error writing to `solid_queue_jobs`, which is itself an ActiveRecord-backed table), the generic `rescue => e` at the bottom of `update` catches it and returns a 422 — but `@brokerage.update!(plan: new_plan)` on the line above has already committed. The brokerage is left with its **new** plan value in the database while none of PLAN-14/15/16/17/18's side effects (purge, domain freeze, credential suspend, membership suspend) ever ran, and no job exists to retry them. For a downgrade this means a "Free" brokerage silently keeps live real-board credentials, an unfrozen custom domain, and unsuspended client seats — the opposite of what the plan transition is supposed to guarantee — until an operator notices and manually re-triggers the transition.
**Fix:** Wrap the flip + enqueue in a single transaction so a failed enqueue also rolls back the plan flip, and the client's 422 response reflects the true state:
```ruby
ApplicationRecord.transaction do
  @brokerage.update!(plan: new_plan)
  ApplyPlanTransitionJob.perform_later(@brokerage.id, old_plan, new_plan)
end
```
(Note: `perform_later` on `solid_queue` enqueues via an ActiveRecord insert, so it participates correctly in the wrapping transaction — the job row won't be visible to the queue worker until commit, which is the desired behavior.)

### WR-03: `plan_downgraded_at` clear happens outside `restore!`'s transaction

**File:** `backend/app/jobs/apply_plan_transition_job.rb:17-20`
**Issue:**
```ruby
if brokerage.plan_downgraded_at.present?
  restore!(brokerage)
  brokerage.update!(plan_downgraded_at: nil)
end
```
`restore!` wraps its own three writes (`unfreeze_custom_domains!`, credential restore, membership restore) in `ApplicationRecord.transaction do ... end`, but the subsequent `brokerage.update!(plan_downgraded_at: nil)` is a separate statement outside that transaction. If the job process dies or raises between the `restore!` transaction committing and this update completing, a job retry (or `discard_on`/final failure) leaves `plan_downgraded_at` pointing at an already-resolved event. This is mostly self-healing (a future `downgrade!` overwrites it with a fresh stamp, and a retried `restore!` call is a harmless no-op since the rows are already restored), so it's not immediately data-destructive, but it is exactly the kind of transaction-boundary gap this review was asked to check, and it means `plan_downgraded_at` can transiently lie about whether a brokerage has an unresolved suspension event.
**Fix:** Fold the clear into the same transaction as the rest of the restore:
```ruby
def restore!(brokerage)
  event = brokerage.plan_downgraded_at
  ApplicationRecord.transaction do
    brokerage.unfreeze_custom_domains!
    brokerage.brokerage_board_credentials.without_deleted
      .where(status: "suspended", suspended_at: event)
      .update_all(status: "active", suspended_at: nil)
    brokerage.brokerage_memberships.without_deleted
      .where(role: "client", suspended_at: event)
      .update_all(suspended_at: nil)
    brokerage.update!(plan_downgraded_at: nil)
  end
end
```

### WR-04: `TestBoardPurgeService`'s highest documented risk (subcomments cascade) is never exercised by its own test suite

**File:** `backend/test/services/test_board_purge_service_test.rb:21-42`
**Issue:** RESEARCH.md calls out the `subcomments -> estate_comments` FK gap (no `ON DELETE CASCADE`) as the single highest-risk area of this entire phase — a raw hard-delete without going through Rails callbacks would raise `ActiveRecord::InvalidForeignKey` on any purged comment that has replies. I independently verified in `vendor/bundle/ruby/4.0.0/gems/paranoia-3.0.0/lib/paranoia.rb:150-175` that `really_destroy!` does correctly recurse through nested paranoid `dependent: :destroy` associations (so `GroupEstate#really_destroy!` → `EstateComment#really_destroy!` → `Subcomment#really_destroy!` is genuinely sound), so the implementation itself is correct. However, the test's `setup` block creates `@test_comment`/`@real_comment` but never attaches a `Subcomment` to either one — the exact scenario the research flagged as the one to guard against is not covered by any assertion in this file. A future refactor of the purge traversal (e.g., someone "optimizing" `really_destroy!` into a raw `delete_all` for performance, which CLAUDE.md's own conventions might tempt) would pass this test suite while reintroducing the documented FK-violation bug.
**Fix:** Add a `Subcomment` fixture under `@test_comment` in `setup` and assert `Subcomment.with_deleted.where(estate_comment_id: @test_comment.id).count == 0` after `TestBoardPurgeService.call!`, mirroring the existing pattern used for `EstateDateRsvp`.

## Info

### IN-01: `TestBoardPurgeService`'s per-step methods are public, breaking the transaction/ordering contract

**File:** `backend/app/services/test_board_purge_service.rb:33-53`
**Issue:** `purge_brokerage_estates`, `purge_group_estate_tree`, and `purge_orphaned_calendar_events` are all public class methods. `self.call!` is the documented single entry point ("the sole entry point for PLAN-14's purge" per 38-02-SUMMARY.md), but nothing prevents another caller from invoking `TestBoardPurgeService.purge_group_estate_tree(...)` directly, outside `call!`'s transaction and without the `estate_date_ids` capture that step 3's calendar-event cleanup depends on.
**Fix:** `private_class_method :purge_brokerage_estates, :purge_group_estate_tree, :purge_orphaned_calendar_events` (or move them into a `class << self; private; ...; end` block) to enforce `call!` as the only public API.

### IN-02: `Ops::PlanController`'s "Invalid plan" error doesn't echo the rejected value

**File:** `backend/app/controllers/ops/plan_controller.rb:17-20`
**Issue:** `render json: {error: "Invalid plan"}, status: :unprocessable_entity` gives an Ops operator no indication of what value was actually rejected, which slows down debugging a scripted/automated caller that passed a malformed value.
**Fix:** `render json: {error: "Invalid plan: #{new_plan.inspect}"}, status: :unprocessable_entity` (safe here since this is an Ops-only, HTTP-Basic-authenticated internal endpoint, not a public-facing one).

---

_Reviewed: 2026-07-21T23:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
