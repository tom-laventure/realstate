---
phase: 07-backend-onboarding-guard
verified: 2026-05-16T00:00:00Z
status: passed
score: 7/7
overrides_applied: 0
---

# Phase 7: Backend Onboarding Guard — Verification Report

**Phase Goal:** Rails API rejects all onboarding requests not originating from the main domain.
**Verified:** 2026-05-16
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /v1/onboarding/brokerage from a brokerage subdomain origin returns HTTP 403 with body `{error: "Forbidden"}` | VERIFIED | Integration test passes: `OnboardingDomainGuardTest#test_POST_/v1/onboarding/brokerage_from_brokerage_subdomain_returns_403` — asserts `:forbidden` + `JSON.parse(response.body)["error"] == "Forbidden"` |
| 2 | POST /v1/onboarding/brokerage from the main domain (APP_BASE_DOMAIN) passes the MainDomainOnly guard (response status is not 403) | VERIFIED | Integration test passes: `OnboardingDomainGuardTest#test_POST_/v1/onboarding/brokerage_from_main_domain_passes_MainDomainOnly_guard` — asserts `response.status != 403` |
| 3 | GET /v1/onboarding/domains/check from a brokerage subdomain origin returns HTTP 403 | VERIFIED | Integration test passes: `OnboardingDomainGuardTest#test_GET_/v1/onboarding/domains/check_from_brokerage_subdomain_returns_403` |
| 4 | POST /v1/onboarding/domains/:id/verify is covered by the same guard (concern at controller level applies to all actions) | VERIFIED | Integration test passes: `OnboardingDomainGuardTest#test_POST_/v1/onboarding/domains/:id/verify_from_brokerage_subdomain_returns_403`; `DomainsController` uses class-level `include MainDomainOnly` with no per-action scoping |
| 5 | PATCH /v1/onboarding/user from a brokerage subdomain origin returns HTTP 403 | VERIFIED | Integration test passes: `OnboardingDomainGuardTest#test_PATCH_/v1/onboarding/user_from_brokerage_subdomain_returns_403` |
| 6 | Guard logic reads the main domain from ENV.fetch("APP_BASE_DOMAIN", "realstate.ca") — no hardcoded domain strings | VERIFIED | Concern line 23: `main_domain = ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")`. `grep -v '^#' main_domain_only.rb | grep '"realstate.ca"'` returns exactly 1 line — only the ENV.fetch default. Same check on test file returns exactly 1 line. |
| 7 | Guard fires BEFORE Cognito authentication (wrong-domain request returns 403, not 401) | VERIFIED | All three controllers have `include MainDomainOnly` at line before `include CognitoAuth` (brokerages: line 4 vs 5; domains: line 6 vs 7; users: line 4 vs 5). Rails processes `included do before_action` blocks in include order — MainDomainOnly's before_action is registered first. All rejection tests confirm 403, not 401. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/controllers/concerns/main_domain_only.rb` | MainDomainOnly concern with require_main_domain! before_action | VERIFIED | Exists, 36 lines, contains `module MainDomainOnly`, `extend ActiveSupport::Concern`, `included do before_action :require_main_domain!`, `ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")`, `URI::InvalidURIError` rescue, `request.host.downcase` fallback, `render json: {error: "Forbidden"}, status: :forbidden` |
| `backend/app/controllers/v1/onboarding/brokerages_controller.rb` | Includes MainDomainOnly before CognitoAuth | VERIFIED | `include MainDomainOnly` at line 4, `include CognitoAuth` at line 5 |
| `backend/app/controllers/v1/onboarding/domains_controller.rb` | Includes MainDomainOnly before CognitoAuth | VERIFIED | `include MainDomainOnly` at line 6, `include CognitoAuth` at line 7 |
| `backend/app/controllers/v1/onboarding/users_controller.rb` | Includes MainDomainOnly before CognitoAuth | VERIFIED | `include MainDomainOnly` at line 4, `include CognitoAuth` at line 5 |
| `backend/test/integration/onboarding_domain_guard_test.rb` | Integration test — 4 rejection + 1 pass-through | VERIFIED | Exists, 68 lines, class `OnboardingDomainGuardTest < ActionDispatch::IntegrationTest`, 5 test methods, 4 `assert_response :forbidden`, 1 `assert_not_equal 403`, all 4 routes covered, uses Origin header (not Host) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `main_domain_only.rb` | `ENV["APP_BASE_DOMAIN"]` | `ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")` | VERIFIED | Pattern found at line 23 |
| `brokerages_controller.rb` | `MainDomainOnly#require_main_domain!` | `include MainDomainOnly` before `include CognitoAuth` | VERIFIED | Line 4, before CognitoAuth at line 5 |
| `domains_controller.rb` | `MainDomainOnly#require_main_domain!` | `include MainDomainOnly` before `include CognitoAuth` | VERIFIED | Line 6, before CognitoAuth at line 7 |
| `users_controller.rb` | `MainDomainOnly#require_main_domain!` | `include MainDomainOnly` before `include CognitoAuth` | VERIFIED | Line 4, before CognitoAuth at line 5 |
| `onboarding_domain_guard_test.rb` | `/v1/onboarding/* endpoints` | ActionDispatch::IntegrationTest HTTP requests with Origin header | VERIFIED | 5 Origin headers used in requests; all 4 routes exercised |

### Data-Flow Trace (Level 4)

Not applicable — this phase delivers security middleware (a guard concern), not a data-rendering artifact. No dynamic data flows to verify.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 5 guard tests pass | `RAILS_ENV=test bundle exec rails test test/integration/onboarding_domain_guard_test.rb` | `5 runs, 6 assertions, 0 failures, 0 errors, 0 skips` | PASS |
| Full suite no regressions | `RAILS_ENV=test bundle exec rails test` | `22 runs, 39 assertions, 0 failures, 0 errors, 0 skips` | PASS |
| standardrb clean | `bundle exec standardrb` on all 5 files | No output (clean) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DOM-04 | 07-01-PLAN.md | All `/v1/onboarding/*` backend endpoints reject requests not originating from the main domain with HTTP 403 | SATISFIED | MainDomainOnly concern included in all 3 onboarding controllers; 4 rejection tests verify each route returns 403 from subdomain origin |
| DOM-05 | 07-01-PLAN.md | Backend reads main domain from `APP_BASE_DOMAIN` env var; no hardcoded domain strings in guard logic | SATISFIED | `ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")` is the only place `"realstate.ca"` appears in the concern (non-comment); test uses `MAIN_DOMAIN = ENV.fetch(...)` constant, not a hardcoded string |

Note: REQUIREMENTS.md traceability table still shows DOM-04 and DOM-05 as "Pending". The PLAN success criteria notes they should be updated "after merge" — this is a post-merge documentation step, not a functional gap. The implementation fully satisfies both requirements.

### Anti-Patterns Found

None. No TODO/FIXME/placeholder comments, no stub implementations, no hardcoded empty returns in the new or modified files.

### Human Verification Required

None. All observable behaviors are verifiable programmatically and confirmed by the integration test suite run.

---

## Gaps Summary

No gaps. All 7 must-have truths verified, all 5 artifacts substantive and wired, all 5 key links confirmed, both requirements DOM-04 and DOM-05 satisfied, full test suite green (22 runs, 0 failures, 0 errors), standardrb clean.

---

_Verified: 2026-05-16_
_Verifier: Claude (gsd-verifier)_
