---
phase: 33-backend-owner-api-endpoint-lockdown
plan: 02
subsystem: api
tags: [rails, rbac, ownership, authorization, minitest]

# Dependency graph
requires:
  - phase: 33-backend-owner-api-endpoint-lockdown
    provides: "Plan 01 locked down UsersController#update/#destroy and InvitationsController#create so owner-role changes can only happen via a dedicated owner-gated endpoint"
provides:
  - "V1::Admin::Settings::OwnersController with index/eligible/create/update"
  - "GET /v1/admin/settings/owners (API-01), GET /v1/admin/settings/owners/eligible (API-02)"
  - "POST /v1/admin/settings/owners promote (API-03), PATCH /v1/admin/settings/owners/:id demote (API-04)"
  - "Owner-only server-side enforcement via current_membership, no JWT role-claim trust (API-05)"
affects: [34-ownership-management-ui, 35-remove-owner-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nested namespace :settings inside namespace :admin -> V1::Admin::Settings::OwnersController, mirroring the namespace :account { namespace :calendar } precedent"
    - "skip_before_action :require_agent_or_above! + before_action :require_owner!, only: [:create, :update] for per-action owner lockdown on an otherwise agent-readable controller"
    - "Server-side re-validation of a promotable target's current role (D-05) instead of trusting a prior /eligible response"
    - "Single COUNT-based last-owner guard that transparently covers self-demotion (OWN-09) with no special-casing"

key-files:
  created:
    - backend/app/controllers/v1/admin/settings/owners_controller.rb
    - backend/test/integration/admin_settings_owners_test.rb
  modified:
    - backend/config/routes.rb

key-decisions:
  - "index/eligible stay under the inherited require_agent_or_above! (not owner-locked) so Phase 34's SET-02 admin/agent read-only access works; only create/update are owner-gated"
  - "Promote and demote responses are plain inline hashes (id/name/email[/role]), matching InvitationsController#create's precedent instead of introducing a new serializer"
  - "422 (unprocessable_entity) used for all validation-style rejections (last-owner, invalid role, non-eligible target); 403 forbidden reserved for require_owner! authorization failures"

requirements-completed: [API-01, API-02, API-03, API-04, API-05]

# Metrics
duration: ~15min
completed: 2026-07-12
---

# Phase 33 Plan 02: Owner Management API Endpoints Summary

**New `V1::Admin::Settings::OwnersController` ships the four owner-management endpoints (list owners, list eligible admin/agent members, promote, demote-with-last-owner-guard), all mutation paths gated by the DB-backed `current_membership` helper — no JWT role-claim trust anywhere.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-12
- **Tasks:** 3/3 completed
- **Files modified:** 3 (1 new controller, 1 new test file, 1 route edit)

## Accomplishments
- Added `namespace :settings { resources :owners }` inside `namespace :admin`, producing the four required routes.
- Implemented `#index` (API-01) and `#eligible` (API-02) as unpaginated, `.without_deleted`-scoped `BrokerageMembership` queries, deliberately left under the inherited `require_agent_or_above!` gate for Phase 34's read-access requirement.
- Implemented `#create` (API-03, promote) with D-05 server-side re-validation of the target's current role, and `#update` (API-04, demote) with a `DEMOTE_TARGET_ROLES` allowlist and a last-owner COUNT guard that also satisfies OWN-09 self-demotion with no special-casing.
- Added 14 integration tests covering every acceptance criterion in the plan (owners list read access by role, eligible-list scoping, promote success/rejection, demote success/rejection, invalid role, self-demotion, last-owner rejection, and unauthenticated/non-owner denial).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add route block + OwnersController with read endpoints (API-01, API-02)** - `a995199` (feat)
2. **Task 2: Implement promote + demote actions with server-side re-validation and last-owner guard (API-03, API-04, API-05)** - `9131583` (feat)
3. **Task 3: Integration tests for the four owner-management endpoints (API-01..05)** - `69efb3d` (test)

_Note: standardrb auto-fixed minor spacing in the test file (`Layout/ExtraSpacing`) via `--fix` prior to the Task 3 commit; the fixed version is what's committed._

## Files Created/Modified
- `backend/config/routes.rb` - added the `namespace :settings { resources :owners ... }` block inside `namespace :admin`, producing `GET/POST /v1/admin/settings/owners`, `GET /v1/admin/settings/owners/eligible`, `PATCH /v1/admin/settings/owners/:id`
- `backend/app/controllers/v1/admin/settings/owners_controller.rb` - new `V1::Admin::Settings::OwnersController` with `index`/`eligible`/`create`/`update`
- `backend/test/integration/admin_settings_owners_test.rb` - new integration test file, 14 tests covering API-01..05

## Decisions Made
- index/eligible intentionally NOT owner-gated (agent+ can read) per RESEARCH.md Assumption A3 and Phase 34's forward SET-02 requirement.
- Plain inline hash responses (no dedicated serializer) — matches the codebase's existing precedent for small, non-computed payloads.
- 422 for all value/state validation rejections, 403 reserved for `require_owner!` authorization failures — consistent split already established in Plan 01's `UsersController#update`.

## Deviations from Plan

None — plan executed exactly as written. The only adjustment was letting `standardrb --fix` normalize whitespace in the new test file before committing, which is routine lint conformance, not a functional deviation.

## Known Stubs

None.

## Threat Flags

None — this plan's new surface (`V1::Admin::Settings::OwnersController`) is fully covered by the plan's own `<threat_model>` (T-33-07 through T-33-13); no additional untracked surface was introduced.

## Self-Check: PASSED

- FOUND: backend/app/controllers/v1/admin/settings/owners_controller.rb
- FOUND: backend/test/integration/admin_settings_owners_test.rb
- FOUND: backend/config/routes.rb (modified)
- FOUND commit a995199
- FOUND commit 9131583
- FOUND commit 69efb3d
