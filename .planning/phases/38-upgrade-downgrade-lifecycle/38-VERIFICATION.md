---
phase: 38-upgrade-downgrade-lifecycle
verified: 2026-07-22T07:11:41Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 38: Upgrade & Downgrade Lifecycle Verification Report

**Phase Goal:** Brokerages can move between Free and a paid tier without losing real business data — Free's disposable TEST-board data is purged on upgrade, while a paid brokerage's real boards, clients, and domain are frozen (not deleted) on downgrade and automatically restored on re-upgrade.
**Verified:** 2026-07-22T07:11:41Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criteria) | Status | Evidence |
|---|---|---|---|
| 1 | Upgrading Free→paid silently purges all TEST-board-linked data (BrokerageEstate, GroupEstate tree, comments/ratings/likes/documents/RSVPs, orphaned calendar events) | ✓ VERIFIED | `backend/app/services/test_board_purge_service.rb` implements the full traversal via `really_destroy!` (hard delete) scoped to `RealEstateBoard.test_boards` and the calling brokerage's own groups/estates. `ApplyPlanTransitionJob#perform` dispatches to it unconditionally on Free→paid. Test suite `test/services/test_board_purge_service_test.rb` and `test/jobs/apply_plan_transition_job_test.rb#test_upgrade_...purges_TEST-board_data` both pass (verified by direct execution, not SUMMARY claim — see Behavioral Spot-Checks). |
| 2 | Downgrading paid→Free freezes the custom domain via existing `freeze_custom_domains!`, auto-promoting subdomain to primary | ✓ VERIFIED | `ApplyPlanTransitionJob#downgrade!` calls `brokerage.freeze_custom_domains!` (line 45) inside the downgrade transaction — reuses the pre-existing method verbatim (`backend/app/models/brokerage.rb:44-57`), which sets custom domains `frozen` and promotes the active subdomain to `is_primary: true`. Job test asserts `@custom.reload.status_frozen?` — passes. |
| 3 | Downgrading paid→Free soft-disconnects all real board credentials — preserved, marked inactive/suspended, excluded from member-visible board list, board-connect UI reverts to Free-tier behavior | ✓ VERIFIED | `ApplyPlanTransitionJob#downgrade!` sets `status: "suspended", suspended_at: stamp` via `update_all` on active real-board credentials (row preserved, not deleted). `board_credentials_controller.rb#index` adds `.where.not(status: "suspended")` so suspended rows are invisible; frontend `ConnectBoardDialog.tsx` requires no changes since it just renders whatever `index` returns (confirmed no suspended-specific UI code exists). `update`/`destroy` also exclude suspended credentials (404s), preventing an admin from reactivating/disconnecting a frozen credential directly. Controller test asserts suspended is absent from index while active/invalid remain — passes. |
| 4 | Downgrading paid→Free suspends all client memberships — access revoked, membership record preserved | ✓ VERIFIED | `ApplyPlanTransitionJob#downgrade!` sets `suspended_at: stamp` (via `update_all`, row preserved) on `role: "client"` memberships only — owner/agent memberships untouched (test asserts this negative case). `CognitoAuth#authenticate_cognito_user!` loads the membership via `find_by` and renders 403 "Your access has been suspended" when `suspended_at.present?`, rejecting the request outright (not just query-filtered). Integration test `suspended_membership_auth_test.rb` proves 403 for suspended, success after restore — passes. |
| 5 | Re-upgrading Free→paid automatically restores previously soft-disconnected credentials and suspended memberships, no manual re-entry/re-inviting | ✓ VERIFIED | `ApplyPlanTransitionJob#restore!` is invoked when `brokerage.plan_downgraded_at.present?` on Free→paid; restores exactly `suspended_at == plan_downgraded_at` rows (both credentials and client memberships) back to `active`/`nil`, and clears `plan_downgraded_at`. A negative test proves a credential suspended by a *different* stale timestamp is untouched (D-06 scoping). All 6 job tests (including this one and the negative case) pass. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `backend/db/migrate/20260721000001_add_plan_transition_suspend_columns.rb` + `db/schema.rb` | suspended_at (memberships, credentials) + plan_downgraded_at columns, indexed | ✓ VERIFIED | `schema.rb` confirmed: `t.datetime "suspended_at"` on both tables with indexes; `t.datetime "plan_downgraded_at"` on brokerages. |
| `backend/app/models/brokerage_membership.rb` | `suspended?`/`suspend!`/`restore!` timestamp-flag methods, row preserved | ✓ VERIFIED | All three methods present exactly as specified, mirroring `Invitation#revoked_at`. |
| `backend/app/models/brokerage_board_credential.rb` | status enum extended with `suspended` | ✓ VERIFIED | `enum :status, {active: "active", invalid: "invalid", suspended: "suspended"}, prefix: :credential` |
| `backend/app/services/test_board_purge_service.rb` | hard-delete cascade of TEST-board data | ✓ VERIFIED | `self.call!(brokerage:)` present; uses `really_destroy!`, scoped via `RealEstateBoard.test_boards`; explicit `without_deleted`/`deleted_at: nil` guards on all paranoid joins; explicit `EstateDateCalendarEvent` orphan cleanup. No `destroy_all`/plain `.destroy` used. |
| `backend/app/jobs/apply_plan_transition_job.rb` | async dispatch of purge/freeze+suspend/restore by direction | ✓ VERIFIED | `perform(brokerage_id, old_plan, new_plan)` looks up brokerage fresh; correct 3-way branch (upgrade/downgrade/no-op); `queue_as :default`, `retry_on`, `discard_on` present. |
| `backend/app/controllers/concerns/cognito_auth.rb` | suspended-membership 403 rejection | ✓ VERIFIED | `membership.suspended_at.present?` guard renders distinct 403; used as a `before_action` so Rails halts the filter chain on render even without an explicit trailing `return` (functionally correct despite plan wording asking for an explicit `return`). |
| `backend/app/controllers/v1/admin/board_credentials_controller.rb` | index/update/destroy exclude suspended credentials | ✓ VERIFIED | All three actions contain `.where.not(status: "suspended")` (3 occurrences confirmed). `create` intentionally left out of this exclusion per Plan 04's explicit scope decision — see WR-01 discussion below. |
| `backend/app/controllers/ops/plan_controller.rb` | plan-transition trigger, flips plan + enqueues cascade | ✓ VERIFIED | Validates `params[:plan]` against `AppConstants::PLAN_TIERS`, captures `old_plan` before flip, no-ops on same-plan, enqueues `ApplyPlanTransitionJob.perform_later` (never inline). Old boolean `freeze:` param fully removed. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `ApplyPlanTransitionJob` | `TestBoardPurgeService.call!` | upgrade branch dispatch | ✓ WIRED | Called unconditionally on Free→paid. |
| `ApplyPlanTransitionJob` | `brokerage.freeze_custom_domains!` | downgrade branch reuse | ✓ WIRED | Called inside `downgrade!`'s transaction. |
| `ApplyPlanTransitionJob` | `brokerages.plan_downgraded_at` | event timestamp for scoped restore | ✓ WIRED | Set in `downgrade!`, read + cleared in upgrade branch; restore query filters on it exactly. |
| `Ops::PlanController#update` | `ApplyPlanTransitionJob.perform_later` | async cascade dispatch | ✓ WIRED | Enqueued after plan flip; integration test asserts `assert_enqueued_with`. |
| `CognitoAuth` | `membership.suspended_at` | request-level 403 | ✓ WIRED | Confirmed via passing `suspended_membership_auth_test.rb`. |
| `board_credentials_controller#index/update/destroy` | suspended exclusion | invisibility + immutability | ✓ WIRED | Confirmed via passing controller test asserting 404 on suspended update/destroy and absence from index. |

### Behavioral Spot-Checks (test execution, not SUMMARY claims)

| Behavior | Command | Result | Status |
|---|---|---|---|
| Model/service tests (Plan 01+02) | `bin/rails test test/models/brokerage_membership_test.rb test/services/test_board_purge_service_test.rb` | 7 runs, 25 assertions, 0 failures | ✓ PASS |
| Job direction-dispatch tests (Plan 03) | `bin/rails test test/jobs/apply_plan_transition_job_test.rb` (re-run 2x with different seeds after one transient infra timeout) | 6 runs, 22 assertions, 0 failures (both re-runs) | ✓ PASS |
| Auth + board-credential controller tests (Plan 04) | `bin/rails test test/integration/suspended_membership_auth_test.rb test/controllers/v1/admin/board_credentials_controller_test.rb test/integration/ops_plan_test.rb` | 14 runs, 52 assertions, 0 failures | ✓ PASS |

Note: one run of `apply_plan_transition_job_test.rb` hung and had to be killed after ~5 minutes on the third test (`downgrade does not suspend an already-invalid credential...`). Investigated directly: an isolated reproduction of that exact scenario completed in 1.8s with no exception, and two subsequent full-file runs (different random seeds) both completed cleanly in ~8s with 6/6 passing and no hang. This is attributed to a transient connectivity hiccup with the remote Neon Postgres test database (`PG::ObjectInUse` warnings were observed on nearly every invocation from a leftover session), not a defect in the phase's code. Flagged as an infra note, not a code gap.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| PLAN-14 | 38-02, 38-03 | Upgrade purges TEST-board data silently | ✓ SATISFIED | `TestBoardPurgeService` + job dispatch + passing tests |
| PLAN-15 | 38-03 | Downgrade freezes custom domain | ✓ SATISFIED | `freeze_custom_domains!` reused verbatim in `downgrade!` |
| PLAN-16 | 38-01, 38-03, 38-04 | Downgrade soft-disconnects real board credentials, excluded from member-visible list | ✓ SATISFIED | `suspended` enum + `where.not(status: "suspended")` on index/update/destroy |
| PLAN-17 | 38-01, 38-03, 38-04 | Downgrade suspends client memberships, access revoked not deleted | ✓ SATISFIED | `suspended_at` + CognitoAuth 403 rejection |
| PLAN-18 | 38-03 | Re-upgrade restores credentials/memberships automatically, no manual re-entry | ✓ SATISFIED | `restore!` scoped to `plan_downgraded_at`, event-scoped negative test passes |

**Note on REQUIREMENTS.md traceability table:** `.planning/REQUIREMENTS.md` still shows PLAN-14 through PLAN-18 as unchecked (`[ ]`) and their traceability table status as "Not started." This is stale documentation, not a code gap — all five plans' code is merged into `backend/main`, committed (see commits `fb02fe3`, `0f761cd`, `d1750e2`, `383cd5f`/`c578ddf`/`a446f83`, `c4508d8`), and independently tested above. The requirements checklist/traceability table should be updated as part of milestone close, but this does not block Phase 38's goal achievement.

### Code Review Cross-Reference (38-REVIEW.md, 4 Warnings)

None of the four Warning-level findings from the code review constitute a genuine gap against the five ROADMAP success criteria verified above. Judgment on each, as requested:

| ID | Finding | Judgment |
|---|---|---|
| WR-01 | `board_credentials_controller#create` can reactivate a suspended credential without clearing `suspended_at`, if hit while the brokerage is already back on a paid plan but the async restore job hasn't completed (or has permanently failed) | **Out of scope for this phase's success criteria, genuine hardening item.** This path is only reachable when `plan_config.real_boards` is true, i.e., the brokerage has already been re-upgraded — at that point SC #3's "board-connect UI reverts to Free-tier behavior" no longer even applies (the brokerage is paid again). Plan 04 explicitly scoped `create` out ("Do NOT touch `create`"). This is a narrow race-condition/failure-mode edge case around async job completion, not a failure of the core upgrade/downgrade/restore truths. Recommend a follow-up fix but not a Phase 38 blocker. |
| WR-02 | Plan flip and job enqueue in `Ops::PlanController#update` are not atomic — if `perform_later` raises after `update!(plan:)` commits, the brokerage is left on the new plan with no cascade ever run | **Out of scope for this phase's success criteria, genuine hardening item.** Requires an infrastructure-level failure (transient `solid_queue` insert failure) to trigger; under normal operation (verified by passing tests) the flip+enqueue sequence works correctly and SC #5's "automatic" restore is satisfied. This is operational resilience, not a functional gap in the demonstrated upgrade/downgrade/restore behavior. |
| WR-03 | `plan_downgraded_at` clear happens in a separate statement outside `restore!`'s transaction | **Not a success-criteria gap.** Reviewer confirms this is self-healing (a future downgrade overwrites the stamp; a retried restore is a harmless no-op) and only matters on a mid-job process crash — an infra failure mode, not a functional defect in the restore path verified by passing tests. |
| WR-04 | The purge service's own test suite doesn't exercise the subcomments-cascade scenario RESEARCH.md flagged as highest-risk | **Test-coverage gap, not an implementation gap.** The reviewer independently verified via the installed `paranoia` gem's source that `really_destroy!` does correctly cascade through nested paranoid `dependent: :destroy` associations (including subcomments) — the underlying mechanism is confirmed sound. The gap is that no assertion in the test file exercises this specific case, which is a regression-safety-net concern for future refactors, not evidence the current purge behavior is wrong. |

All four are consistent with the review's own classification (Warning, not Critical) and none block phase-goal achievement. Recommend tracking WR-01/02/03/04 as fast-follow hardening work, but they do not gate Phase 38 completion.

### Anti-Patterns Found

None found in the five plans' modified files. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers, no empty stub implementations, no hardcoded-empty return values in the reviewed files.

### Human Verification Required

None. This phase is backend-only (no new UI per D-07/38-CONTEXT.md), and all observable truths are verifiable via passing automated tests plus direct code inspection of live source files.

### Gaps Summary

No gaps found. All 5 ROADMAP success criteria are verified against live source code (not SUMMARY.md claims), all associated automated tests pass on direct execution, and the 4 code-review Warning findings are judged to be out-of-scope hardening items rather than success-criteria violations, consistent with their own Warning (not Critical) classification.

---

_Verified: 2026-07-22T07:11:41Z_
_Verifier: Claude (gsd-verifier)_
