---
phase: 15-backend-api-brokerage-auth-extension
plan: "02"
subsystem: api
tags: [rails, ruby, cognito-auth, main-domain, brokerage-membership, integration-tests]

# Dependency graph
requires:
  - phase: 15-backend-api-brokerage-auth-extension
    provides: MainDomainOnly concern and CognitoAuth pattern
provides:
  - "GET /v1/account/admin_brokerages endpoint returning brokerages where user holds admin or owner role"
  - "V1::Account::AdminBrokeragesController with MainDomainOnly + CognitoAuth, no BrokerageAuth"
  - "Integration test suite (4 tests) covering BE-01 happy path, empty list, 403 subdomain, 401 unauthenticated"
affects: [frontend-admin-portal, brokerage-selection-screen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-brokerage endpoint: include MainDomainOnly + CognitoAuth, skip BrokerageAuth, override skip_brokerage_membership? = true"
    - "Inline JSON render without serializer for simple list endpoints"
    - "BrokerageMembership.without_deleted.includes(:brokerage) for N+1-safe soft-delete-aware membership queries"
    - "main_domain_headers_for test helper mints JWT without Current.brokerage for cross-brokerage integration tests"

key-files:
  created:
    - backend/app/controllers/v1/account/admin_brokerages_controller.rb
    - backend/test/integration/admin_brokerages_test.rb
  modified:
    - backend/config/routes.rb

key-decisions:
  - "MainDomainOnly included before CognitoAuth so domain guard fires before auth — 403 before 401 for subdomain requests"
  - "No BrokerageAuth included — endpoint is cross-brokerage by design (D-06); skip_brokerage_membership? = true as explicit defense-in-depth (D-07)"
  - "Inline render with no serializer per D-12 — response is a simple flat list"

patterns-established:
  - "Pattern: cross-brokerage endpoint module inclusion order: MainDomainOnly first, CognitoAuth second, no BrokerageAuth"
  - "Pattern: test helper mints token without Current.brokerage for endpoints without brokerage context"

requirements-completed: [BE-01]

# Metrics
duration: 8min
completed: 2026-05-24
---

# Phase 15 Plan 02: AdminBrokerages Endpoint Summary

**GET /v1/account/admin_brokerages endpoint returning cross-brokerage admin/owner membership list, secured by MainDomainOnly + CognitoAuth with no BrokerageAuth, verified by 4 passing integration tests**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-24T17:35:00Z
- **Completed:** 2026-05-24T17:43:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `V1::Account::AdminBrokeragesController` with MainDomainOnly + CognitoAuth, no BrokerageAuth, `skip_brokerage_membership? = true`
- Registered `GET /v1/account/admin_brokerages` route under `namespace :account` in routes.rb
- Queried `BrokerageMembership.without_deleted.includes(:brokerage).where(user_id: Current.user.id, role: %w[admin owner])` for N+1-safe, soft-delete-correct membership retrieval
- Wrote 4 integration tests covering BE-01: happy path (2 entries with id/name/role), empty list for agent-only user, 403 from subdomain origin, 401 unauthenticated — all pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AdminBrokeragesController and register route** - `389d3f7` (feat)
2. **Task 2: Write integration tests for BE-01** - `d918f79` (test file committed within plan-01 agent's commit due to concurrent worktree staging)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `backend/app/controllers/v1/account/admin_brokerages_controller.rb` - New controller: MainDomainOnly + CognitoAuth, no BrokerageAuth, inline JSON render
- `backend/config/routes.rb` - Added `resources :admin_brokerages, only: [:index]` under `namespace :account`
- `backend/test/integration/admin_brokerages_test.rb` - 4 integration tests covering BE-01: happy path, empty list, 403 subdomain, 401 unauthenticated

## Decisions Made
- Include `MainDomainOnly` before `CognitoAuth` so domain guard fires first — subdomain requests receive 403 before auth is even evaluated
- Do not include `BrokerageAuth` — this endpoint spans all brokerages; no single brokerage context applies (D-06)
- Override `skip_brokerage_membership? = true` as explicit defense-in-depth even though `Current.brokerage.nil?` would skip the check anyway (D-07)
- Inline `render json:` with no serializer — the response shape is a simple flat list (D-12)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Parallel worktree execution: the plan-01 agent staged and committed `admin_brokerages_test.rb` as part of its own `feat(15-01)` commit because both agents were writing to the same backend sub-repo concurrently. The file content was identical to what plan-02 wrote, and all 4 tests pass — no functional impact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- BE-01 requirement satisfied: `GET /v1/account/admin_brokerages` endpoint is live
- Frontend brokerage selection screen can now call this endpoint from the main domain
- Integration tests provide regression coverage for BE-01 access control semantics

---
*Phase: 15-backend-api-brokerage-auth-extension*
*Completed: 2026-05-24*
