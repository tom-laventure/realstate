---
phase: 23-301-redirect-primary-domain-enforcement
verified: 2026-05-30T00:00:00Z
status: passed
score: 13/13 must-haves verified
overrides_applied: 0
---

# Phase 23: 301 Redirect & Primary Domain Enforcement Verification Report

**Phase Goal:** Requests arriving at any non-primary domain are transparently redirected to the same path on the primary domain at the server layer; frozen domains also redirect
**Verified:** 2026-05-30
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A request to a non-primary active domain returns HTTP 301 with Location pointing to the same path on the brokerage's current primary domain | VERIFIED | Test D-01 passes: `assert_response 301` + `assert_equal "https://primary.example.com/v1/admin/users"` |
| 2 | A request to a phasing-out non-primary domain returns HTTP 301 to the primary domain | VERIFIED | Test D-02 passes: `status: "phasing_out", is_primary: false` → 301 |
| 3 | A phasing-out domain that IS primary passes through (no redirect) | VERIFIED | Test D-03 passes: `refute_equal 301, response.status` when primary is phasing_out |
| 4 | A frozen custom domain returns HTTP 301 to the primary domain | VERIFIED | Test D-04 passes: `status: "frozen", is_primary: false` → 301 to primary |
| 5 | Pending, decommissioned, and unknown domains pass through to BrokerageAuth | VERIFIED | Tests D-05, D-06 (×2) all pass with `refute_equal 301` |
| 6 | The main domain (APP_BASE_DOMAIN) passes through | VERIFIED | Test D-08 passes: `skip_host?` guards on APP_BASE_DOMAIN |
| 7 | The redirect preserves path and query string | VERIFIED | Test D-12 passes: `?page=2&sort=name` preserved via `request.fullpath` |
| 8 | Origin header takes precedence over Host header for host extraction | VERIFIED | Test D-07 passes: Origin `old.example.com` triggers redirect despite Host `backend.internal` |
| 9 | DomainMailer.health_failure, downgrade_notice, unverified_warning all embed primary domain | VERIFIED | 4 DPRI-03 tests in DomainMailerTest pass (22 runs, 58 assertions, 0 failures) |
| 10 | Changing the primary domain propagates to the next email sent | VERIFIED | Propagation test passes: `update!(is_primary: false/true)` + re-send asserts new primary in body |
| 11 | InvitationMailer.invite_brokerage and invite_group both embed primary domain | VERIFIED | 2 DPRI-03 tests in InvitationMailerTest pass including `/invite/#{invitation.token}` path assertion |
| 12 | Middleware is registered before ActionDispatch::Static and after Rack::Cors | VERIFIED | `bin/rails middleware` output: `Rack::Cors` → `DomainRedirectMiddleware` → `ActionDispatch::Static` |
| 13 | The status query includes frozen domains (NOT using .routable) | VERIFIED | `where(status: [:active, :phasing_out, :frozen])` confirmed in middleware; `grep -c ".routable"` = 0; `grep -c "without_deleted"` = 0 |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/middleware/domain_redirect_middleware.rb` | Rack middleware issuing 301 redirects for non-primary domains | VERIFIED | 44 lines, `class DomainRedirectMiddleware`, contains all required patterns |
| `backend/config/application.rb` | Middleware registration in the Rack stack | VERIFIED | Lines 66-67: `require_relative` + `config.middleware.insert_before ActionDispatch::Static, DomainRedirectMiddleware` |
| `backend/test/middleware/domain_redirect_middleware_test.rb` | Integration tests covering D-01 through D-12 | VERIFIED | 10 tests, `class DomainRedirectMiddlewareTest < ActionDispatch::IntegrationTest`, all pass |
| `backend/test/mailers/domain_mailer_test.rb` | DPRI-03 assertions for all three DomainMailer methods | VERIFIED | Contains 4 DPRI-03 test cases, `def full_body` defined once |
| `backend/test/mailers/invitation_mailer_test.rb` | DPRI-03 assertions for both InvitationMailer methods | VERIFIED | Contains 2 DPRI-03 test cases, `def full_body` defined once |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/config/application.rb` | `DomainRedirectMiddleware` | `config.middleware.insert_before ActionDispatch::Static, DomainRedirectMiddleware` | WIRED | Exact pattern found at line 67; `require_relative` at line 66 ensures class loads at boot |
| `backend/app/middleware/domain_redirect_middleware.rb` | `BrokerageDomain` | `where(status: [:active, :phasing_out, :frozen])` | WIRED | Exact pattern found at line 13 of middleware |
| `backend/test/mailers/domain_mailer_test.rb` | `DomainMailer#primary_domain` | `assert_includes body, primary domain` | WIRED | `assert_includes body, @primary_subdomain.domain` appears in all 3 DomainMailer DPRI-03 tests |
| `backend/test/mailers/invitation_mailer_test.rb` | `InvitationMailer#primary_domain` | `assert_includes body, primary domain` | WIRED | `assert_includes body, "primary.acme.com"` appears in both InvitationMailer DPRI-03 tests |

### Data-Flow Trace (Level 4)

This phase is test-only for Plan 02 and a Rack middleware for Plan 01. No frontend components render dynamic data from a fetch. The middleware's data flow is verified by integration test execution (real DB queries, real Rack response triples). No Level 4 trace required.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Middleware integration tests (10 scenarios) | `bin/rails test test/middleware/domain_redirect_middleware_test.rb` | 10 runs, 16 assertions, 0 failures, 0 errors, 0 skips | PASS |
| Mailer DPRI-03 tests | `bin/rails test test/mailers/domain_mailer_test.rb test/mailers/invitation_mailer_test.rb` | 22 runs, 58 assertions, 0 failures, 0 errors, 0 skips | PASS |
| Middleware stack position | `bin/rails middleware` | `Rack::Cors` → `DomainRedirectMiddleware` → `ActionDispatch::Static` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DPRI-03 | 23-02-PLAN.md | All system-generated links use the primary domain | SATISFIED | 6 passing tests (4 DomainMailer + 2 InvitationMailer) with assert_includes body, primary_domain + propagation test |
| DPRI-04 | 23-01-PLAN.md | Requests to any non-primary domain are 301-redirected to the equivalent path on the primary domain | SATISFIED | DomainRedirectMiddleware implemented and tested; 10 integration tests pass |
| DPRD-02 | 23-01-PLAN.md | Frozen custom domains serve only a redirect to the subdomain | SATISFIED | Test D-04 explicitly tests `status: "frozen", is_primary: false` → 301; query uses `[:active, :phasing_out, :frozen]` not `.routable` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Checked `domain_redirect_middleware.rb` for: TODO/FIXME, placeholder, `return null/[]/{}`, `without_deleted`, `.routable`. All clear.

### Human Verification Required

None. All behaviors are fully verifiable programmatically through integration tests that run against a real test database.

### Gaps Summary

No gaps. All 13 must-have truths are verified by direct code inspection and passing test execution.

---

_Verified: 2026-05-30_
_Verifier: Claude (gsd-verifier)_
