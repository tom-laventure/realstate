---
phase: 30-backend-rbac-enforcement
plan: 01
subsystem: auth
tags: [rails, imperative-authorization, before_action, rbac, minitest]

# Dependency graph
requires: []
provides:
  - "require_agent_or_above! (owner/admin/agent) as the default before_action on V1::Admin::BaseController"
  - "Narrow require_admin!/require_owner! overrides on the 4 write-tier controllers that must stay blocked for agent"
  - "Green admin_authorization_test.rb with D-03 flipped to reflect RBAC-02 (agent read access)"
affects: [30-02-backend-rbac-enforcement, 31-agent-dashboard-shell, 32-agent-group-permissions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "3-tier imperative before_action stack: require_agent_or_above! (default) -> require_admin! -> require_owner!, all sharing one current_membership/render_forbidden helper pair"
    - "Stacking narrower before_action on top of a broader one needs no skip_before_action as long as the broader check renders-and-halts on failure (proven pre-existing in DomainsController, reused here in UsersController/BoardCredentialsController)"
    - "skip_before_action targets must be renamed in the same commit as any base filter rename, or Rails raises ArgumentError at load time"

key-files:
  created: []
  modified:
    - backend/app/controllers/v1/admin/base_controller.rb
    - backend/app/controllers/v1/admin/users_controller.rb
    - backend/app/controllers/v1/admin/board_credentials_controller.rb
    - backend/app/controllers/v1/admin/brokerages_controller.rb
    - backend/app/controllers/v1/admin/invitations_controller.rb
    - backend/test/integration/admin_authorization_test.rb
    - backend/test/integration/admin_domains_test.rb

key-decisions:
  - "DRY'd the duplicated membership lookup + 403 body into current_membership/render_forbidden private helpers in BaseController (RESEARCH.md Pattern 3, optional but taken)"
  - "Renamed InvitationsController's unused, name-colliding render_forbidden(message, brokerage) to render_invitation_forbidden to avoid ArgumentError when require_admin! (via the new render_forbidden) fires against an agent"
  - "Fixed the D-03 test plus two additional pre-existing agent-403 assertions in admin_domains_test.rb (domains#index, domains#verify) that RBAC-02 makes incorrect, mirroring the plan's own D-03 fix pattern"
  - "Left the wider pre-existing RESERVED_SLUGS/'test.example.com' fixture collision (46 unrelated test errors across ~10 other files) untouched and logged to deferred-items.md — out of scope for this plan's files_modified"

patterns-established:
  - "current_membership (memoized) + render_forbidden shared helpers in V1::Admin::BaseController — reuse for any future authorization tier"

requirements-completed: [RBAC-01, RBAC-02, RBAC-03]

# Metrics
duration: 35min
completed: 2026-07-09
---

# Phase 30 Plan 01: Backend RBAC Enforcement — Base Tier Summary

**Added a third `require_agent_or_above!` authorization tier (owner/admin/agent) as the default `before_action` on `V1::Admin::BaseController`, propagating agent read/group access to all 13 admin controllers, while stacking narrower `require_admin!`/`require_owner!` checks on the 4 controllers whose write actions must stay blocked for agent.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-07-09T22:47:23Z (approx, per STATE.md session start)
- **Completed:** 2026-07-09T23:07:29Z
- **Tasks:** 3 planned tasks, all completed
- **Files modified:** 7 (5 planned + 2 additional test-file fixes, see Deviations)

## Accomplishments
- `V1::Admin::BaseController` now grants `owner`/`admin`/`agent` by default; `require_admin!` and `require_owner!` remain as reusable narrower checks, all sharing one soft-delete-scoped `current_membership` lookup and one `render_forbidden` 403 body.
- 9 controllers (`DomainsController`, `EstatesController`, `BoardsController`, `ActivityController`, `GroupsController`, and the 4 `Group::*` controllers) needed zero code changes — they inherit agent access correctly for free, exactly as RESEARCH.md predicted.
- 4 controllers received exactly the write-tier narrowing specified: `UsersController` (update/destroy admin-only), `BoardCredentialsController` (create/update/destroy admin-only), `BrokeragesController` (skip target renamed, owner-only update unchanged), `InvitationsController` (skip target renamed + `index/create/validate/destroy` admin-only — keeps brokerage-level invitations fully blocked for agent per ACCESS-07/T-30-01).
- `admin_authorization_test.rb`'s D-03 assertion flipped and green; two additional pre-existing agent-403 assertions in `admin_domains_test.rb` (domains#index, domains#verify) fixed for the same root cause.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add require_agent_or_above! tier to BaseController** - `3c5d7a9` (feat)
2. **Task 2: Layer narrow write-tier checks and rename skip targets** - `576531a` (feat)
3. **Task 3: Flip the D-03 assertion and prove the existing suite loads and passes** - `e580a50` (test)
4. **Deviation fix: admin_domains_test.rb agent-403 assertions invalidated by RBAC-02** - `4ee9901` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `backend/app/controllers/v1/admin/base_controller.rb` - Adds `require_agent_or_above!` as default; DRY's membership lookup/403 body into `current_membership`/`render_forbidden`
- `backend/app/controllers/v1/admin/users_controller.rb` - `require_admin!` on `update`/`destroy` only
- `backend/app/controllers/v1/admin/board_credentials_controller.rb` - `require_admin!` on `create`/`update`/`destroy` only
- `backend/app/controllers/v1/admin/brokerages_controller.rb` - `skip_before_action` target renamed to `:require_agent_or_above!`
- `backend/app/controllers/v1/admin/invitations_controller.rb` - `skip_before_action` target renamed; `require_admin!` added on `index/create/validate/destroy`; renamed unused `render_forbidden(message, brokerage)` to `render_invitation_forbidden` to avoid arity collision with the new base helper
- `backend/test/integration/admin_authorization_test.rb` - D-03 flip (agent 200 on `GET /v1/admin/users`); fixed reserved-slug fixture collision (`test.example.com` → `acme.example.com`)
- `backend/test/integration/admin_domains_test.rb` - Flipped 2 pre-existing agent-403 assertions (`domains#index`, `domains#verify`) that RBAC-02 makes incorrect; wrapped the new verify test in the file's existing `with_dns` stub helper

## Decisions Made
- DRY'd the base controller's duplicated membership lookup/403 body per RESEARCH.md's optional Pattern 3 — reduces future-tier duplication risk.
- Renamed InvitationsController's dead-code `render_forbidden(message, brokerage)` rather than deleting it, preserving its (unused) intent while eliminating the arity collision with the newly-added base `render_forbidden` (no args) that `require_admin!` now calls.
- Fixed `admin_domains_test.rb`'s two agent-403 assertions in addition to the plan's own D-03 target, since they were made incorrect by the exact same root cause (RBAC-02 correctly granting agent read access) and were directly triggered by this plan's Task 1/2 changes — not fixing them would have left a real regression (0 failures → the two now pass instead of erroring/failing).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Renamed name-colliding dead-code `render_forbidden` in InvitationsController**
- **Found during:** Task 2
- **Issue:** `InvitationsController` already defined a private `render_forbidden(message, brokerage)` (2 required args, never called anywhere in the app). Once Task 1 added `BaseController#render_forbidden` (0 args, called by `require_admin!`) and Task 2 added `before_action :require_admin!, only: [:index, :create, :validate, :destroy]` to `InvitationsController`, Ruby's method resolution would dispatch to the subclass's 2-arg override when `require_admin!` denies an agent, raising `ArgumentError: wrong number of arguments (given 0, expected 2)` instead of returning 403.
- **Fix:** Renamed the unused subclass method to `render_invitation_forbidden` (no call sites changed, since it was never invoked).
- **Files modified:** `backend/app/controllers/v1/admin/invitations_controller.rb`
- **Verification:** `admin_authorization_test.rb` and the full invitations flow pass; no `ArgumentError` on agent-denied requests.
- **Committed in:** `576531a` (Task 2 commit)

**2. [Rule 3 - Blocking] Fixed `RESERVED_SLUGS` collision in `admin_authorization_test.rb`'s own fixture**
- **Found during:** Task 3
- **Issue:** The file's `setup` block created `brokerage_domain` with `domain: "test.example.com"`. A later-added model validation (`BrokerageDomain::RESERVED_SLUGS` includes `"test"`) rejects this domain, causing every test in the file to error at `setup` — unrelated to RBAC logic but blocking Task 3's own required test run.
- **Fix:** Changed the fixture domain to `"acme.example.com"` (matching the convention used across the rest of the test suite) in both the `create(:brokerage_domain, ...)` call and the unauthenticated-request `Host` header.
- **Files modified:** `backend/test/integration/admin_authorization_test.rb`
- **Verification:** `RAILS_ENV=test bundle exec rails test test/integration/admin_authorization_test.rb` → 5 runs, 0 failures, 0 errors.
- **Committed in:** `e580a50` (Task 3 commit)

**3. [Rule 1 - Bug] Fixed 2 additional pre-existing agent-403 assertions invalidated by RBAC-02**
- **Found during:** Post-task full-suite verification
- **Issue:** `admin_domains_test.rb` had `test "GET /v1/admin/domains returns 403 for agent role"` and `test "POST verify is forbidden for agent role"` — both directly contradicted by RBAC-02 (`domains#index/verify` must accept agent) once Task 1/2's changes landed, exactly analogous to the plan's own D-03 fix but in a file not listed in `files_modified`.
- **Fix:** Flipped both assertions to expect success; the new verify test uses the file's existing `with_dns(true)` stub helper (matching sibling tests) rather than relying on real DNS resolution, avoiding an unrelated order-dependent `remove_method` quirk in that helper.
- **Files modified:** `backend/test/integration/admin_domains_test.rb`
- **Verification:** `RAILS_ENV=test bundle exec rails test test/integration/admin_domains_test.rb test/integration/admin_authorization_test.rb` → 34 runs, 0 failures, 0 errors. Full suite: 209 runs, 0 failures, 46 errors (all pre-existing, unrelated — see Issues Encountered).
- **Committed in:** `4ee9901`

---

**Total deviations:** 3 auto-fixed (1 bug [name collision], 1 blocking [test fixture], 1 bug [invalidated assertions])
**Impact on plan:** All three were necessary consequences of correctly implementing Tasks 1-2; none represent scope creep into unrelated functionality. No architectural changes.

## Issues Encountered
- The full backend test suite (`RAILS_ENV=test bundle exec rails test`) has 46 pre-existing errors unrelated to this phase, all caused by the same `RESERVED_SLUGS` vs `"test.example.com"` fixture collision across ~10 other test files (confirmed pre-existing by reproducing on `HEAD~4`, i.e. before any Phase 30 commit). Logged to `.planning/phases/30-backend-rbac-enforcement/deferred-items.md`; not fixed (out of scope — none of those files are in this plan's `files_modified`).
- Base `bundle exec standardrb` flagged pre-existing hash-brace-spacing violations on lines copied verbatim from the pre-phase `base_controller.rb` (already present before this plan). Ran `standardrb --fix` on `base_controller.rb` only (semantics-neutral formatting) so the plan's own verification gate could pass; this is standard formatting cleanup, not a logic change.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend now correctly enforces the full agent permission boundary (RBAC-01/02/03) at the `before_action` layer, ahead of Plan 02 (full permission-matrix test coverage) and Phases 31/32 (frontend agent-facing UI unlocks).
- `admin_authorization_test.rb` is green and ready for Plan 02 to extend into the full allow/deny matrix.
- The pre-existing `RESERVED_SLUGS`/`test.example.com` fixture issue (deferred-items.md) will make Plan 02's "full suite green" success criterion fail unless addressed — flagging for Plan 02 execution awareness, since Plan 02's `files_modified` also only lists `admin_authorization_test.rb` and does not currently plan to touch the other affected files.

---
*Phase: 30-backend-rbac-enforcement*
*Completed: 2026-07-09*

## Self-Check: PASSED

All modified files (7) and all commit hashes (4) verified present.
