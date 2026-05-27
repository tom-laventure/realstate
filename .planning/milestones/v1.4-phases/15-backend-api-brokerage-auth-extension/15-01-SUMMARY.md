---
phase: 15-backend-api-brokerage-auth-extension
plan: 01
subsystem: auth
tags: [rails, brokerage-auth, multi-tenant, integration-tests, tdd]

# Dependency graph
requires:
  - phase: 7-onboarding
    provides: MainDomainOnly concern with APP_BASE_DOMAIN detection (origin-first pattern)
provides:
  - BrokerageAuth concern extended with main-domain branch (X-Brokerage-Id header resolution)
  - Integration tests for BE-02 and BE-03 (4 tests covering main-domain and subdomain paths)
affects: [15-02, frontend admin portal, all /v1/admin/** controllers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Main-domain branch in BrokerageAuth: main_domain_request? gates X-Brokerage-Id header path"
    - "extract_domain_from_request reused by main_domain_request? (no URI.parse duplication)"
    - "Brokerage.without_deleted.find_by(id: header_val.to_i) — .to_i prevents injection, 0 → nil → RecordNotFound"
    - "render + return early-halt idiom for 400 (mirrors CognitoAuth pattern)"

key-files:
  created:
    - backend/test/integration/brokerage_auth_main_domain_test.rb
  modified:
    - backend/app/controllers/concerns/brokerage_auth.rb

key-decisions:
  - "15-01-01: main_domain_request? calls extract_domain_from_request rather than duplicating URI.parse block — single source of truth for host extraction"
  - "15-01-02: X-Brokerage-Id with non-numeric value uses .to_i which returns 0; find_by(id: 0) returns nil; RecordNotFound raised — no SQL injection risk"
  - "15-01-03: Subdomain path is byte-for-byte equivalent to original resolve_brokerage body — no regression risk"

patterns-established:
  - "Main-domain integration tests: use Origin header (not Host) to trigger main-domain path; do NOT set Current.brokerage before TokenService.issue"
  - "main_domain_headers_for helper pattern: mirrors onboarding_domain_guard_test.rb setup"

requirements-completed: [BE-02, BE-03]

# Metrics
duration: 8min
completed: 2026-05-24
---

# Phase 15 Plan 01: BrokerageAuth Main-Domain Extension Summary

**BrokerageAuth concern extended with X-Brokerage-Id header-based brokerage resolution for main-domain requests, enabling all /v1/admin/** controllers to serve cross-brokerage admin requests without per-controller changes**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-24T17:40:00Z
- **Completed:** 2026-05-24T17:48:00Z
- **Tasks:** 2 (Task 1 TDD: 2 commits RED+GREEN; Task 2 integrated into TDD cycle)
- **Files modified:** 2

## Accomplishments
- Extended BrokerageAuth with `main_domain_request?` private method mirroring MainDomainOnly detection logic
- Added main-domain branch in `resolve_brokerage`: reads X-Brokerage-Id, returns HTTP 400 if absent, looks up `Brokerage.without_deleted.find_by(id:)` if present
- Preserved subdomain path byte-for-byte (BrokerageDomain lookup, no regression)
- Created 4 integration tests covering BE-02 (header present → 200), BE-03 (header absent → 400), subdomain isolation (→ 200), invalid brokerage ID (→ 404)
- All 3 regression test suites pass: brokerage_auth_main_domain (4/4), tenant_isolation (2/2), admin_authorization (5/5)

## Task Commits

Each task was committed atomically (TDD cycle):

1. **RED - Integration tests (failing)** - `8df7628` (test)
2. **GREEN - BrokerageAuth implementation** - `d918f79` (feat)

_Note: Task 2 (integration test file) was created as the TDD RED step and committed as part of Task 1's TDD cycle. Both planned artifacts are delivered._

## Files Created/Modified
- `backend/app/controllers/concerns/brokerage_auth.rb` - Extended with main-domain branch, `main_domain_request?`, subdomain path unchanged
- `backend/test/integration/brokerage_auth_main_domain_test.rb` - 4 integration tests for BE-02/BE-03

## Decisions Made
- `main_domain_request?` reuses `extract_domain_from_request` — no duplication of URI.parse block (single source of truth)
- `header_val.to_i` on non-numeric string returns 0; `find_by(id: 0)` returns nil; `RecordNotFound` is raised — safe against header injection
- Logger.debug line moved to subdomain path only (irrelevant for header-based path)

## Deviations from Plan

### Unintended File Inclusion
**1. [Minor - Unintended] admin_brokerages_test.rb included in feat commit**
- **Found during:** Post-commit check
- **Issue:** `test/integration/admin_brokerages_test.rb` was untracked in the worktree (created by plan 02 agent) and was accidentally staged alongside `brokerage_auth.rb`
- **Fix:** File content is correct (created by plan 02 agent); no corrective action needed as it belongs to the repo. Not a data loss or regression issue.
- **Files affected:** backend/test/integration/admin_brokerages_test.rb
- **Committed in:** d918f79 (alongside Task 1 implementation)

---

**Total deviations:** 1 (unintended file inclusion — content correct, no functional impact)
**Impact on plan:** No scope creep. Plan delivered as specified with all success criteria met.

## Issues Encountered
- `ruby -Itest` without `bundle exec` fails to find test_helper — resolved by using `bundle exec ruby -Itest`

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BrokerageAuth main-domain branch is live; all /v1/admin/** controllers automatically support X-Brokerage-Id resolution
- Plan 02 (admin_brokerages endpoint) can verify its endpoint works end-to-end using the same pattern
- Frontend admin portal (Phase 16) can send X-Brokerage-Id on all admin API calls

## Self-Check: PASSED
- `backend/app/controllers/concerns/brokerage_auth.rb` — FOUND (contains main_domain_request?, resolve_brokerage branches, Brokerage.without_deleted.find_by)
- `backend/test/integration/brokerage_auth_main_domain_test.rb` — FOUND (63 lines, 4 tests)
- Commits 8df7628 and d918f79 — FOUND in git log
- 4 integration tests: PASS
- Regression: tenant_isolation (2/2 PASS), admin_authorization (5/5 PASS)

---
*Phase: 15-backend-api-brokerage-auth-extension*
*Completed: 2026-05-24*
