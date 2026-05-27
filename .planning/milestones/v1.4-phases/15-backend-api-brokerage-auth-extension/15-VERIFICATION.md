---
phase: 15-backend-api-brokerage-auth-extension
verified: 2026-05-24T18:15:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
---

# Phase 15: Backend API — BrokerageAuth Extension Verification Report

**Phase Goal:** Backend serves main-domain admin requests by resolving brokerage context from a request header and exposes an endpoint listing all brokerages where the authenticated user is admin or owner
**Verified:** 2026-05-24T18:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                                  | Status     | Evidence                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | A request to any /v1/admin/** endpoint from the main domain with a valid X-Brokerage-Id header resolves Current.brokerage to the correct brokerage and returns 200    | VERIFIED   | Integration test "GET /v1/admin/users from main domain with X-Brokerage-Id resolves brokerage and returns 200" passes |
| 2   | A request to any /v1/admin/** endpoint from the main domain without X-Brokerage-Id header returns HTTP 400 with JSON body { error: 'X-Brokerage-Id header required' } | VERIFIED   | Integration test "GET /v1/admin/users from main domain without X-Brokerage-Id returns 400" passes, body asserted      |
| 3   | Subdomain requests are completely unaffected — they still resolve brokerage via BrokerageDomain lookup with no change in behavior                                      | VERIFIED   | Subdomain isolation test passes; tenant_isolation_test (2/2) and admin_authorization_test (5/5) pass with no changes  |
| 4   | Authenticated admin calling GET /v1/account/admin_brokerages from the main domain receives a JSON list of brokerages where they hold admin or owner role               | VERIFIED   | Integration test returns 200 with 2 entries; each entry has id, name, role fields; roles are admin or owner           |
| 5   | Authenticated user with no admin/owner memberships anywhere receives an empty list (not an error)                                                                      | VERIFIED   | Integration test returns 200 with empty array for agent-only user                                                     |
| 6   | The endpoint is unreachable from a brokerage subdomain — returns HTTP 403                                                                                              | VERIFIED   | Integration test overrides Origin header to subdomain; MainDomainOnly returns 403                                     |
| 7   | Unauthenticated request returns HTTP 401                                                                                                                               | VERIFIED   | Integration test omits Authorization header; CognitoAuth returns 401                                                  |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact                                                                       | Expected                                               | Status   | Details                                                                                                                                                           |
| ------------------------------------------------------------------------------ | ------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/app/controllers/concerns/brokerage_auth.rb`                          | Extended BrokerageAuth concern with main-domain branch | VERIFIED | Contains `main_domain_request?`, `resolve_brokerage` branches on it, `render + return` for missing header, `Brokerage.without_deleted.find_by(id: header_val.to_i)` |
| `backend/test/integration/brokerage_auth_main_domain_test.rb`                 | Integration tests for BE-02 and BE-03                  | VERIFIED | 63 lines, class `BrokerageAuthMainDomainTest < ActionDispatch::IntegrationTest`, 4 tests, 4/4 pass                                                                |
| `backend/app/controllers/v1/account/admin_brokerages_controller.rb`           | New controller serving GET /v1/account/admin_brokerages | VERIFIED | `V1::Account::AdminBrokeragesController`, includes `MainDomainOnly` then `CognitoAuth`, no `BrokerageAuth`, `skip_brokerage_membership? = true`, correct query    |
| `backend/config/routes.rb`                                                    | Route registration for admin_brokerages under :account | VERIFIED | `resources :admin_brokerages, only: [:index]` present inside `namespace :account`; `bin/rails routes` confirms `GET /v1/account/admin_brokerages`                 |
| `backend/test/integration/admin_brokerages_test.rb`                           | Integration tests covering BE-01                       | VERIFIED | Class `AdminBrokeragesTest < ActionDispatch::IntegrationTest`, 4 tests, 4/4 pass, 17 assertions                                                                   |

### Key Link Verification

| From                                                  | To                                               | Via                                                                  | Status   | Details                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `backend/config/routes.rb`                            | `admin_brokerages_controller.rb`                 | `resources :admin_brokerages, only: [:index]` inside namespace :account | VERIFIED | Route output: `v1/account/admin_brokerages#index` confirmed by `bin/rails routes`          |
| `BrokerageAuth#resolve_brokerage`                     | `Brokerage.without_deleted.find_by`              | X-Brokerage-Id header parsed as integer                              | VERIFIED | Line 17: `brokerage = Brokerage.without_deleted.find_by(id: header_val.to_i)`              |
| `BrokerageAuth#main_domain_request?`                  | `extract_domain_from_request`                    | Reuses existing method, no URI.parse duplication                     | VERIFIED | Line 37: `request_host = extract_domain_from_request` — single source of truth             |
| `V1::Account::AdminBrokeragesController#index`        | `BrokerageMembership.without_deleted.includes(:brokerage)` | Query filtered by user_id and role IN [admin, owner]         | VERIFIED | Lines 18-21: `BrokerageMembership.without_deleted.includes(:brokerage).where(user_id: Current.user.id, role: %w[admin owner])` |

### Data-Flow Trace (Level 4)

| Artifact                              | Data Variable      | Source                                                   | Produces Real Data | Status   |
| ------------------------------------- | ------------------ | -------------------------------------------------------- | ------------------ | -------- |
| `AdminBrokeragesController#index`     | `memberships`      | `BrokerageMembership.without_deleted.includes(:brokerage).where(...)` | Yes — DB query with user_id and role filter | FLOWING  |
| `BrokerageAuth#resolve_brokerage`     | `Current.brokerage` | `Brokerage.without_deleted.find_by(id: header_val.to_i)` | Yes — DB query by ID | FLOWING  |

### Behavioral Spot-Checks

| Behavior                                               | Command                                                    | Result                             | Status |
| ------------------------------------------------------ | ---------------------------------------------------------- | ---------------------------------- | ------ |
| 4 BE-02/BE-03 tests pass                               | `RAILS_ENV=test bundle exec ruby -Itest test/integration/brokerage_auth_main_domain_test.rb` | 4 runs, 5 assertions, 0 failures  | PASS   |
| 4 BE-01 tests pass                                     | `RAILS_ENV=test bundle exec ruby -Itest test/integration/admin_brokerages_test.rb` | 4 runs, 17 assertions, 0 failures | PASS   |
| Route registered correctly                             | `bin/rails routes \| grep admin_brokerages`                | `GET /v1/account/admin_brokerages(.:format) v1/account/admin_brokerages#index` | PASS   |
| Tenant isolation regression (subdomain path unaffected) | `RAILS_ENV=test bundle exec ruby -Itest test/integration/tenant_isolation_test.rb` | 2 runs, 3 assertions, 0 failures  | PASS   |
| Admin authorization regression                         | `RAILS_ENV=test bundle exec ruby -Itest test/integration/admin_authorization_test.rb` | 5 runs, 7 assertions, 0 failures  | PASS   |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                            | Status    | Evidence                                                                                               |
| ----------- | ----------- | ------------------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------ |
| BE-01       | 15-02       | Admin user can call GET /v1/account/admin_brokerages and receive a list of brokerages where they hold admin or owner role | SATISFIED | Controller, route, and 4 passing integration tests all verified; response shape {admin_brokerages: [{id, name, role}]} confirmed |
| BE-02       | 15-01       | Backend resolves Current.brokerage from X-Brokerage-Id header when Host is main domain                | SATISFIED | `main_domain_request?` gates the header path; integration test confirms 200 response with valid header |
| BE-03       | 15-01       | Admin endpoint called from main domain without valid X-Brokerage-Id header returns HTTP 400            | SATISFIED | `render json: {error: "X-Brokerage-Id header required"}, status: :bad_request; return` in concern; integration test asserts exact error body |

### Anti-Patterns Found

No anti-patterns found. Scan results:

- No TODO/FIXME/HACK/PLACEHOLDER comments in modified files
- No stub return values (`return null`, `return []`, `return {}`) in production code paths
- No `include BrokerageAuth` in `AdminBrokeragesController` (correctly absent)
- `without_deleted` applied to both `Brokerage` (in `brokerage_auth.rb`) and `BrokerageMembership` (in controller) — CLAUDE.md soft-delete mandate satisfied
- `includes(:brokerage)` prevents N+1 in membership iteration
- `return` immediately after `render` in the missing-header path prevents `AbstractController::DoubleRenderError`
- `.to_i` on `header_val` prevents SQL injection — non-numeric → 0 → `find_by(id: 0)` → nil → `RecordNotFound`

### Human Verification Required

None. All behaviors were verified programmatically via integration tests with real DB queries in test environment.

### Gaps Summary

No gaps. All 7 observable truths are VERIFIED, all 5 artifacts exist and are substantive and wired, all 4 key links are confirmed, all 3 requirement IDs (BE-01, BE-02, BE-03) are satisfied, and all behavioral spot-checks pass. The phase goal is fully achieved.

---

_Verified: 2026-05-24T18:15:00Z_
_Verifier: Claude (gsd-verifier)_
