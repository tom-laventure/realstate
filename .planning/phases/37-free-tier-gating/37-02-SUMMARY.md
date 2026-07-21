---
phase: 37-free-tier-gating
plan: 02
subsystem: backend
tags: [rails, calendar, plan-tiers, gating, tdd]

# Dependency graph
requires:
  - phase: 36-plan-config-migration
    provides: Brokerage#plan_config, AppConstants::PLAN_TIERS, plan column values (free/independent/growth)
provides:
  - User#any_paid_brokerage_membership? cross-brokerage paid-membership predicate
  - 403 plan_required guard on Google calendar authorize and Apple calendar connect
  - calendar_sync_available boolean on GET /v1/account/calendar/connections
  - user_calendar_connection factory (previously missing)
affects: [37-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "User-scoped cross-brokerage capability check: any_paid_brokerage_membership? — single indexed SQL exists? query, never iterate brokerages in Ruby, never gate via Current.brokerage.plan_config for account-wide resources (D-06 / RESEARCH Pitfall 1)"

key-files:
  created:
    - backend/test/factories/user_calendar_connections.rb
    - backend/test/models/user_paid_membership_test.rb
    - backend/test/integration/free_tier_calendar_gate_test.rb
  modified:
    - backend/app/models/user.rb
    - backend/app/controllers/v1/account/calendar/google_oauth_controller.rb
    - backend/app/controllers/v1/account/calendar/connections_controller.rb

key-decisions:
  - "Guard implemented as a single-query exists? predicate on User (not Brokerage), matching D-06: calendar access is account-wide if ANY membership is paid, independent of which brokerage the request resolved to"
  - "microsoft_oauth_controller.rb left untouched (dormant, no live routes) per plan instruction"

requirements-completed: [PLAN-07, PLAN-12]

# Metrics
duration: ~25min
completed: 2026-07-20
---

# Phase 37 Plan 02: Calendar Sync Free-Tier Gate Summary

**User-scoped `any_paid_brokerage_membership?` predicate gates Google calendar authorize and Apple calendar connect with 403 `plan_required` for fully-Free users, and exposes a `calendar_sync_available` boolean on the connections index for frontend banner logic — fully TDD'd against the real backend test suite.**

## Performance

- **Duration:** ~25 min (including one-time sub-repo worktree + test-DB environment setup)
- **Tasks:** 2
- **Files modified:** 6 (3 new, 3 modified)

## Accomplishments

- `User#any_paid_brokerage_membership?` — `brokerages.without_deleted.where(plan: %w[independent growth]).exists?`, a single indexed SQL query, respecting soft-deleted brokerages
- `backend/test/factories/user_calendar_connections.rb` created (was missing) with `:google` (default) and `:apple` traits
- `google_oauth_controller#authorize` and `connections_controller#create_apple` both gated with the canonical `{error:, code: "plan_required"}, status: :forbidden` shape, guard inserted as the first line of each action
- `connections_controller#index` now renders `calendar_sync_available` as a sibling key to `connections`
- Neither controller references `plan_config.calendar_sync` (grep-verified 0 matches) — the gate is always evaluated against `Current.user`, never `Current.brokerage`, avoiding the tenant-confusion pitfall documented in RESEARCH Pitfall 1
- `microsoft_oauth_controller.rb` left untouched (dormant, per plan)

## Task Commits

Each task followed TDD (RED -> GREEN), committed atomically in the `backend` sub-repo, on branch `worktree-agent-a0cdac3aa0edb8e56-backend` (branched off `backend`'s `master`, currently at `4c2bb03`):

1. **Task 1: `User#any_paid_brokerage_membership?` + calendar-connection factory**
   - `a5721ee` (test) — failing test for the five behavior cases + missing factory
   - `d7deef8` (feat) — `any_paid_brokerage_membership?` implementation
2. **Task 2: Gate calendar authorize + apple-connect, expose `calendar_sync_available`**
   - `bf1d3a8` (test) — failing integration test for the five gate behaviors
   - `e780769` (feat) — guard clauses + `calendar_sync_available` key

_All commits made directly in the `backend` sub-repo per CLAUDE.md ("Commit code to them directly")._

## Files Created/Modified

- `backend/app/models/user.rb` — added `any_paid_brokerage_membership?` (near `full_name`), with a D-06 comment
- `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb` — `#authorize` guard, first line
- `backend/app/controllers/v1/account/calendar/connections_controller.rb` — `#create_apple` guard (first line) + `#index` `calendar_sync_available` key
- `backend/test/factories/user_calendar_connections.rb` — new FactoryBot factory (`:google` default, `:apple` trait)
- `backend/test/models/user_paid_membership_test.rb` — 5 cases: free-only, free+independent, growth-only, soft-deleted-paid, zero-memberships
- `backend/test/integration/free_tier_calendar_gate_test.rb` — 5 cases: authorize 403/200, apple-connect 403, connections `calendar_sync_available` false/true

## Decisions Made

- Kept the predicate on `User` (not `Brokerage`), matching the plan's explicit interface contract and D-06 — this is the architecturally distinct part of this plan versus the brokerage-scoped gates in sibling plans.
- No changes to `microsoft_oauth_controller.rb` (dormant, no routes reference it currently).

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched their `<action>` and `<acceptance_criteria>` blocks precisely.

### Environment setup (infrastructure, not a plan deviation)

Per the known repo quirk (`backend/` and `frontend/` are gitlink-style embedded repos with no `.gitmodules`), created a proper `backend` sub-repo worktree at `backend/` inside this monorepo worktree, on branch `worktree-agent-a0cdac3aa0edb8e56-backend`, off `backend`'s `master` (`4c2bb03`). Additionally, to run the backend test suite required two more one-time worktree-local fixes (both gitignored, no tracked files affected):
1. Symlinked `vendor/bundle` from the main `backend` checkout (identical `Gemfile.lock`) and copied `.bundle/config` (untracked, not copied by `git worktree add`) — avoided a redundant full `bundle install`.
2. Copied `.env` from the main `backend` checkout (untracked, not copied by `git worktree add`). This repo's `RAILS_ENV=test` intentionally targets the same shared Neon Postgres as development (`DATABASE_URL` in `.env` overrides `database.yml`'s `test: sqlite3` block for the current environment) — this is the existing, documented pattern (see STATE.md's pre-existing blocker note re: "DATABASE_URL leaks into RAILS_ENV=test"). Without `.env`, the worktree would fall back to a **fresh sqlite3 test DB**, whose `db:schema:load` fails outright: `db/schema.rb` contains two Postgres-only artifacts (a partial index `where: "((status)::text <> ...)"` on `brokerage_domains`, and a Postgres-cast `check_constraint` on `estate_ratings`) that are not valid SQLite syntax. Matching the main checkout's `.env` was the correct fix — not a schema bug to patch.

Flagging for the orchestrator: the `backend` sub-repo commits (`a5721ee`, `d7deef8`, `bf1d3a8`, `e780769`) live on branch `worktree-agent-a0cdac3aa0edb8e56-backend` inside the `backend` sub-repo and need to be merged into `backend`'s `master` alongside this monorepo worktree's merge (`sub_repos` was configured as `["backend", "frontend"]` in `.planning/config.json`, so this should already be expected by the merge tooling — see 37-04-SUMMARY.md for a prior example of this same pattern with `frontend`).

## Out-of-Scope Findings (logged, not fixed)

Logged to `.planning/phases/37-free-tier-gating/deferred-items.md`:
- `backend/app/controllers/v1/account/calendar/connections_controller.rb:52` — pre-existing `Lint/UselessAssignment` (`rescue => e`, unused `e`) in `#create_apple`, introduced in commit `e981f72` before this plan. Not touched by this plan's diff (our guard was inserted earlier in the method). Left as-is per scope boundary.

## Issues Encountered

None beyond the environment setup documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `calendar_sync_available` is live on `GET /v1/account/calendar/connections` (surfaces as `calendarSyncAvailable` to the frontend per the Axios camelCase interceptor) — ready for Plan 06 (Account Calendar tab) to consume for banner-vs-provider-grid decisions.
- Plan 06 must use this backend boolean, not `hasPlanCapability(plan, 'calendarSync')` from Plan 04's `planPermissions.ts` (which is explicitly flagged as never-use-for-gating for this exact reason — D-06).
- No blockers.

## Self-Check: PASSED

- FOUND: backend/app/models/user.rb (contains `any_paid_brokerage_membership?`)
- FOUND: backend/app/controllers/v1/account/calendar/google_oauth_controller.rb (contains `plan_required` guard)
- FOUND: backend/app/controllers/v1/account/calendar/connections_controller.rb (contains `calendar_sync_available` + `plan_required` guard)
- FOUND: backend/test/factories/user_calendar_connections.rb
- FOUND: backend/test/models/user_paid_membership_test.rb
- FOUND: backend/test/integration/free_tier_calendar_gate_test.rb
- FOUND commit a5721ee, d7deef8, bf1d3a8, e780769 (backend sub-repo, `git log --oneline`)
- Full suite (`user_paid_membership_test.rb` + `free_tier_calendar_gate_test.rb`): 10 runs, 16 assertions, 0 failures, 0 errors

---
*Phase: 37-free-tier-gating*
*Completed: 2026-07-20*
