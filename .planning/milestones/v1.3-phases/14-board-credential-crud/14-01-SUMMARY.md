---
phase: 14-board-credential-crud
plan: "01"
subsystem: backend
tags: [board-credentials, crud, soft-delete, rets-auth, integration-tests]
dependency_graph:
  requires: []
  provides: [DELETE /v1/admin/board_credentials/:id, PATCH /v1/admin/board_credentials/:id]
  affects: [backend/config/routes.rb, backend/app/controllers/v1/admin/board_credentials_controller.rb]
tech_stack:
  added: []
  patterns: [acts_as_paranoid soft-delete, RETS auth bypass for test boards, scoped find_by! for IDOR prevention]
key_files:
  created:
    - backend/test/integration/board_credential_crud_test.rb
  modified:
    - backend/config/routes.rb
    - backend/app/controllers/v1/admin/board_credentials_controller.rb
decisions:
  - "Separate update_credential_params private method — does NOT permit :real_estate_board_id to prevent board reassignment (D-10)"
  - "destroy action rescues RecordNotFound for 404, RecordNotDestroyed for 422"
  - "update action uses includes(:real_estate_board) in find to avoid N+1 on is_test_board?"
  - "Test DB reset via RAILS_ENV=test rails db:schema:load required before tests due to stale :test_board uniqueness conflict"
metrics:
  duration: 5min
  completed_date: "2026-05-24"
  tasks_completed: 3
  files_changed: 3
---

# Phase 14 Plan 01: Board Credential Backend CRUD Summary

**One-liner:** Soft-delete and credential-update endpoints for board credentials with RETS re-validation, IDOR scoping, and 10 passing integration tests.

## What Was Built

Added DELETE and PATCH endpoints to `V1::Admin::BoardCredentialsController`. Both actions are scoped to `Current.brokerage` via `without_deleted` to prevent IDOR. The update action mirrors the existing create action's RETS auth branch (bypass for test boards, RetsAuthService for real boards). A separate `update_credential_params` method permits only `:rets_username` and `:rets_password` — explicitly excluding `:real_estate_board_id` to prevent board reassignment.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Expose DELETE + PATCH routes | 931cdc7 | backend/config/routes.rb |
| 2 | Add destroy + update actions | 469cb97 | backend/app/controllers/v1/admin/board_credentials_controller.rb |
| 3 | Integration tests (10 tests) | c5a927b | backend/test/integration/board_credential_crud_test.rb |

## Verification Results

- `rails routes -c board_credentials`: 5 routes (index, create, patch, put, delete) — all present
- `board_credential_crud_test.rb`: 10 runs, 26 assertions, 0 failures, 0 errors
- `board_connect_flow_test.rb` regression: 6 runs, 19 assertions, 0 failures, 0 errors
- standardrb: controller and test file clean; routes.rb has pre-existing issues at lines 46-48 (out of scope)

## Deviations from Plan

### Auto-fixed Issues

None — implementation followed the plan exactly.

### Pre-existing Issues Discovered (Out of Scope)

**[Out of Scope] Pre-existing standardrb violations in routes.rb lines 46-48**
- **Found during:** Task 1 verification
- **Issue:** `Layout/ExtraSpacing` violations in calendar routes added in Phase 5 (commits 5b50150, 62be7e7, 6888506)
- **Action:** Logged to deferred items; not fixed per SCOPE BOUNDARY rule
- **Logged to:** deferred-items.md

### Test Database Environment

The test database had stale data from a prior run (the `:test_board` factory uses fixed `short_code: "TEST"` and `name: "Test RETS Board"` which caused uniqueness violations). The pre-existing `board_connect_flow_test.rb` was also failing for the same reason. Resolution: `RAILS_ENV=test rails db:schema:load` to clear the test database before running tests. This is an environment-state issue, not a code defect.

## Threat Model Compliance

All 8 threats from the plan's `<threat_model>` are mitigated:

| Threat | Mitigation | Verified By |
|--------|------------|-------------|
| T-14-01-01: IDOR on destroy | Scoped `Current.brokerage.brokerage_board_credentials.without_deleted.find_by!(id:)` | test: "DELETE ... returns 404 for another brokerage (IDOR)" |
| T-14-01-02: IDOR on update | Same brokerage scope applied to update | test: "PATCH ... returns 404 for another brokerage (IDOR)" |
| T-14-01-03: real_estate_board_id injection | `update_credential_params` permits only `:rets_username` and `:rets_password` | test: "PATCH ... ignores real_estate_board_id" |
| T-14-01-04: Spoofing / unauthenticated access | Inherited from `V1::Admin::BaseController` (CognitoAuth + BrokerageAuth + require_admin!) | existing before_actions unchanged |
| T-14-01-05: Credential info disclosure | Encrypted accessors used; serializer excludes plaintext fields | standardrb + grep confirms no ciphertext writes |
| T-14-01-06: DoS via RETS | Accepted — admin-only, RetsAuthService has timeout | design decision |
| T-14-01-07: Repudiation on delete | acts_as_paranoid sets deleted_at, record preserved for forensics | test: "soft-deletes and returns success message" |
| T-14-01-08: BrokerageEstate cascade | No dependent: :destroy on model; controller does not delete BrokerageEstate | test: "does NOT delete BrokerageEstate rows" |

## Known Stubs

None — all data flows are wired and tested end-to-end.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes beyond what the plan specified.

## Self-Check: PASSED

- backend/config/routes.rb: contains `only: [:index, :create, :destroy, :update]` — FOUND
- backend/app/controllers/v1/admin/board_credentials_controller.rb: contains `def destroy`, `def update`, `def update_credential_params` — FOUND
- backend/test/integration/board_credential_crud_test.rb: exists with 10 tests — FOUND
- Commits 931cdc7, 469cb97, c5a927b — all FOUND in backend git log
