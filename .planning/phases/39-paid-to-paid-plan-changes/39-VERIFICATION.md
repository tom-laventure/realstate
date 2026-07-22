---
phase: 39-paid-to-paid-plan-changes
verified: 2026-07-22T00:00:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
---

# Phase 39: Paid-to-Paid Plan Changes Verification Report

**Phase Goal:** Switching between paid tiers is a pure billing event — since board access and client access are identical across Independent and Growth, no data is ever purged, frozen, or disconnected on a paid-to-paid change. Success criteria: (1) Switching Independent -> Growth recalculates billing (new base price plus seat overage for seats beyond the new tier's included count) with zero data changes. (2) Switching Growth -> Independent recalculates billing the same way, with no boards, clients, or domain affected.
**Verified:** 2026-07-22
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | (D-01) Independent -> Growth creates one persisted `PlanBillingSnapshot` with `total_cents` from Growth's base + overage, no data changes | ✓ VERIFIED | `apply_plan_transition_job.rb:96-108` `recalculate_billing!` calls `PlanBillingSnapshot.create!`; test `"paid -> paid (independent -> growth) performs no freeze, suspend, or purge"` asserts `PlanBillingSnapshot.count == 1`, `total_cents == 7900`, and asserts credential/domain/membership/`plan_downgraded_at` are unchanged. Test run confirms pass (see Behavioral Spot-Checks). |
| 2 | (D-02) Growth -> Independent creates one `PlanBillingSnapshot` against Independent's config, no purge/freeze/disconnect, runs inside the existing paid->paid `else` branch | ✓ VERIFIED | `perform` structure unchanged (`if`/`elsif`/`else`); `else` branch is the only new code path, calling `recalculate_billing!(brokerage, new_plan)` — no new dispatch/enqueue path added. Test `"paid -> paid (growth -> independent) with overage keys pricing by new_plan"` asserts `plan == "independent"`, `total_cents == 6000`. |
| 3 | (D-03) Seat count excludes role='client' and soft-deleted memberships, mirroring `admin_brokerages_controller.rb`'s `member_roles` rule | ✓ VERIFIED | `brokerage.rb:41-43` `billable_seat_count` body is `brokerage_memberships.without_deleted.where(role: %w[agent staff owner admin]).count`, exactly matching `admin_brokerages_controller.rb:41`'s `member_roles = %w[agent staff owner admin]`. Test asserts `seat_count == 1` with a client membership present, and explicitly asserts total non-deleted memberships > billable seat_count. |
| 4 | Overage is never negative when seat count is at or below the new tier's seat_cap | ✓ VERIFIED | `overage_seats = [seat_count - (tier.seat_cap || 0), 0].max` clamps at 0. Test `"...at exactly the new tier's seat cap has zero overage, never negative"` asserts `total_cents == 7900` (no negative overage) for 1 seat vs Growth's 5-seat cap. |
| 5 | (D-04) Pricing read from `AppConstants::PLAN_TIERS` keyed by `new_plan`, never hardcoded, never keyed by `old_plan`; `annual_discount_rate` never applied | ✓ VERIFIED | `tier = AppConstants::PLAN_TIERS.fetch(new_plan)` — confirmed keyed by `new_plan` param, not `old_plan`. `grep -Ec '\b(2000|7900|1600)\b' apply_plan_transition_job.rb` returns 0 (no hardcoded cents literals). `annual_discount_rate` is never referenced in `recalculate_billing!`. Test with 3 seats Growth->Independent asserts `total_cents == 6000` (Independent's overage rate 2000, not Growth's 1600), proving new-plan keying. |
| 6 | No boards, clients, or domain data affected by a paid-to-paid transition | ✓ VERIFIED | `recalculate_billing!` contains no call to `freeze_custom_domains!`, `unfreeze_custom_domains!`, `TestBoardPurgeService`, or any `update_all`/`update!` beyond the new `PlanBillingSnapshot.create!`. Test explicitly asserts credential stays active, custom domain stays active, client membership `suspended_at` stays nil, and `plan_downgraded_at` stays nil after a paid->paid transition. |
| 7 | `PlanBillingSnapshot` is append-only (no soft-delete), matching the `EstateDateCalendarEvent` precedent | ✓ VERIFIED | `plan_billing_snapshot.rb` has no `acts_as_paranoid` line; `db/schema.rb`'s `plan_billing_snapshots` table (lines 383-392) has no `deleted_at` column. |
| 8 | PLAN-19 requirement is satisfied and traceable | ✓ VERIFIED | `.planning/REQUIREMENTS.md` line 45 marks `[x] **PLAN-19**` and line 100 maps it to "Phase 39 — Paid-to-Paid Plan Changes — Complete". |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/db/migrate/20260722000001_create_plan_billing_snapshots.rb` | plan_billing_snapshots table (brokerage_id, plan, seat_count, total_cents, timestamps) | ✓ VERIFIED | File exists with exact columns; sorts after `20260721000001` with no collision. `add_foreign_key :plan_billing_snapshots, :brokerages` present. |
| `backend/db/schema.rb` | Table reflected in schema, version bumped | ✓ VERIFIED | `create_table "plan_billing_snapshots"` at line 383, version `2026_07_22_000001`, FK at line 643. No `deleted_at`. |
| `backend/app/models/plan_billing_snapshot.rb` | Append-only audit model, no acts_as_paranoid | ✓ VERIFIED | `class PlanBillingSnapshot < ApplicationRecord`; validates plan inclusion (independent/growth), seat_count/total_cents >= 0; no acts_as_paranoid. |
| `backend/test/factories/plan_billing_snapshots.rb` | FactoryBot factory | ✓ VERIFIED | `factory :plan_billing_snapshot` with brokerage association, plan/seat_count/total_cents defaults. |
| `backend/app/models/brokerage.rb` | `billable_seat_count` method | ✓ VERIFIED | Present at lines 41-43, correct body, `.without_deleted` scoping per CLAUDE.md convention. |
| `backend/app/jobs/apply_plan_transition_job.rb` | paid->paid branch filled with `recalculate_billing!` | ✓ VERIFIED | `else` branch calls `recalculate_billing!(brokerage, new_plan)`; private method implemented correctly. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `apply_plan_transition_job.rb` | `PlanBillingSnapshot` | `create!` inside `recalculate_billing!` | ✓ WIRED | `PlanBillingSnapshot.create!(brokerage:, plan:, seat_count:, total_cents:)` present at line 102. |
| `apply_plan_transition_job.rb` | `AppConstants::PLAN_TIERS` | `.fetch(new_plan)` | ✓ WIRED | `AppConstants::PLAN_TIERS.fetch(new_plan)` at line 97 — confirmed keyed by `new_plan`, not `old_plan`. |
| `brokerage.rb` | `brokerage_memberships` | `without_deleted.where(role:...).count` | ✓ WIRED | `brokerage_memberships.without_deleted.where(role: %w[agent staff owner admin]).count` at line 42. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PLAN-19 | 39-01-PLAN.md | Paid-to-paid plan switch is pure billing recalculation, no data purge/freeze/disconnect | ✓ SATISFIED | Implementation in `apply_plan_transition_job.rb`/`brokerage.rb`/`plan_billing_snapshot.rb`; REQUIREMENTS.md marks PLAN-19 `[x]` Complete, mapped to Phase 39. No orphaned requirements found for this phase. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER found in any file touched by this phase | — | None |
| `brokerage.rb` | 55-80 | `Layout/MultilineMethodCallIndentation` (standardrb) — pre-existing, from Phase 38's `freeze_custom_domains!`/`unfreeze_custom_domains!`, untouched by this plan | ℹ️ Info | Logged in `.planning/phases/39-paid-to-paid-plan-changes/deferred-items.md` as explicitly out of scope; new `billable_seat_count` code is standardrb-clean. Not a blocker for this phase's goal. |

No hardcoded cents literals in `apply_plan_transition_job.rb` (`grep -Ec '\b(2000|7900|1600)\b'` returns 0). No calls to `freeze_custom_domains!`/`unfreeze_custom_domains!`/`TestBoardPurgeService`/`downgrade!`/`restore!` inside `recalculate_billing!`.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Job test suite passes against real Postgres test DB (re-run independently, not trusting SUMMARY claim) | `RAILS_ENV=test bundle exec rails test test/jobs/apply_plan_transition_job_test.rb` | `8 runs, 32 assertions, 0 failures, 0 errors, 0 skips` | ✓ PASS |
| standardrb clean on new/modified billing files (excluding pre-existing deferred offenses) | `bundle exec standardrb app/models/plan_billing_snapshot.rb app/models/brokerage.rb app/jobs/apply_plan_transition_job.rb` | 11 offenses, all in `freeze_custom_domains!`/`unfreeze_custom_domains!` (Phase 38, deferred) — zero offenses in new code | ✓ PASS |
| Commits from SUMMARY exist in backend git history | `git log --oneline \| grep -E "89ad0ab\|0182694\|6a40e54"` | All 3 commits found with matching messages | ✓ PASS |

### Probe Execution

No probe scripts declared in PLAN/SUMMARY and no conventional `scripts/*/tests/probe-*.sh` exists for this phase — SKIPPED (no runnable probes for this phase type; this is a Rails job/model change verified via `rails test`, not a migration/tooling probe phase).

### Human Verification Required

None. All success criteria are structural/computational (billing math, data-mutation absence, config keying) and fully verifiable via code inspection and automated test execution — no visual, real-time, or external-service behavior is introduced by this phase.

### Gaps Summary

No gaps found. All D-01 through D-04 must-haves are verified directly against the codebase (not merely SUMMARY.md claims): the `PlanBillingSnapshot` model, migration, and factory exist with the correct append-only (non-paranoid) shape; `Brokerage#billable_seat_count` correctly mirrors the `member_roles` rule from `admin_brokerages_controller.rb`; `ApplyPlanTransitionJob`'s paid->paid `else` branch correctly computes billing keyed by `new_plan` with overage clamped at zero, and it mutates nothing else. The job test suite was independently re-run (not just trusted from SUMMARY) and passed 8/8 with 32 assertions, 0 failures, 0 errors. PLAN-19 is marked complete and correctly traced in REQUIREMENTS.md. The only anti-pattern found (11 standardrb indentation offenses) is pre-existing from Phase 38, outside this plan's file-touch scope, and is documented in `deferred-items.md` — it does not affect this phase's goal achievement.

---

*Verified: 2026-07-22*
*Verifier: Claude (gsd-verifier)*
