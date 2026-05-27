---
status: complete
phase: 15-backend-api-brokerage-auth-extension
source:
  - .planning/phases/15-backend-api-brokerage-auth-extension/15-01-SUMMARY.md
  - .planning/phases/15-backend-api-brokerage-auth-extension/15-02-SUMMARY.md
started: 2026-05-24T00:00:00Z
updated: 2026-05-24T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. BrokerageAuth main-domain integration tests
expected: |
  Run the 4 integration tests for BE-02 and BE-03:
    cd backend && bundle exec ruby -Itest test/integration/brokerage_auth_main_domain_test.rb
  All 4 tests pass: valid X-Brokerage-Id header → 200, missing header → 400,
  subdomain request still resolves via BrokerageDomain → 200, invalid brokerage ID → 404.
result: pass
note: "3/4 initially. Subdomain test got 404 — WR-03 added verified: true to BrokerageDomain lookup but factory defaulted verified: false. Fixed factory, all 4 pass."

### 2. AdminBrokerages endpoint integration tests
expected: |
  Run the 4 integration tests for BE-01:
    cd backend && bundle exec ruby -Itest test/integration/admin_brokerages_test.rb
  All 4 tests pass: happy path returns JSON list with id/name/role, empty list for agent-only user,
  subdomain origin → 403, unauthenticated → 401.
result: pass

### 3. Regression test suite — tenant isolation and admin authorization
expected: |
  Run the regression suites:
    cd backend && bundle exec ruby -Itest test/integration/tenant_isolation_test.rb
    cd backend && bundle exec ruby -Itest test/integration/admin_authorization_test.rb
  tenant_isolation: 2/2 pass. admin_authorization: 5/5 pass.
  No existing brokerage auth behaviour broken by the main-domain branch.
result: pass

### 4. Route registration
expected: |
  Run: cd backend && bundle exec rails routes | grep admin_brokerages
  Output includes a line showing: GET  /v1/account/admin_brokerages(.:format)  v1/account/admin_brokerages#index
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
