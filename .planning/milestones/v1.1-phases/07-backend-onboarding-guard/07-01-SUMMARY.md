---
phase: 07-backend-onboarding-guard
plan: "01"
subsystem: backend
tags: [security, onboarding, guard, rails-concern, integration-test]
dependency_graph:
  requires: []
  provides:
    - MainDomainOnly concern guards all /v1/onboarding/* routes with HTTP 403 for non-main-domain origins
  affects:
    - backend/app/controllers/v1/onboarding/brokerages_controller.rb
    - backend/app/controllers/v1/onboarding/domains_controller.rb
    - backend/app/controllers/v1/onboarding/users_controller.rb
tech_stack:
  added: []
  patterns:
    - Rails ActiveSupport::Concern with included do before_action block
    - Origin-first host extraction (mirrors BrokerageAuth pattern)
    - ENV.fetch with fallback default for environment configuration
key_files:
  created:
    - backend/app/controllers/concerns/main_domain_only.rb
    - backend/test/integration/onboarding_domain_guard_test.rb
  modified:
    - backend/app/controllers/v1/onboarding/brokerages_controller.rb
    - backend/app/controllers/v1/onboarding/domains_controller.rb
    - backend/app/controllers/v1/onboarding/users_controller.rb
decisions:
  - "Duplicate Origin extraction vs shared helper: duplicated the extraction logic from BrokerageAuth (not extracted to shared module). Research section confirmed duplication is preferred — the concerns have different semantics (brokerage identity lookup vs domain equality check) and sharing would couple two orthogonal security boundaries."
  - "No explicit return after render: Rails performed? short-circuit handles filter chain halting; render is the last statement of the unless block."
  - "Simple error shape {error: Forbidden} not nested {error: {code:, message:}}: matches the onboarding controller conventions (DomainsController#verify uses same shape)."
  - "Class-level include (no only:/except: scoping): all actions of each onboarding controller need the guard — no per-action exemptions."
  - "include MainDomainOnly before include CognitoAuth: ensures domain check fires before JWT verification so wrong-domain requests get 403 not 401."
metrics:
  duration: "~3 min"
  completed_date: "2026-05-16"
  tasks_completed: 3
  files_changed: 5
---

# Phase 07 Plan 01: Backend Onboarding Guard Summary

**One-liner:** MainDomainOnly Rails concern rejects non-main-domain origins with HTTP 403 across all four /v1/onboarding/* routes, enforcing DOM-04/DOM-05 at the API layer.

## What Was Built

### Task 1: MainDomainOnly concern (commit: 9d81fbf)

Created `backend/app/controllers/concerns/main_domain_only.rb` — a Rails ActiveSupport::Concern that:

- Registers `require_main_domain!` as a `before_action` via the `included do` block (no explicit `before_action` needed in including controllers)
- Reads the main domain from `ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")` — no hardcoded domain strings outside this default (DOM-05)
- Extracts the request origin via the `Origin` header (URI-parsed, downcased) with `request.host.downcase` fallback for non-browser/dev contexts
- Rescues `URI::InvalidURIError` for malformed Origin values, falling back to `request.host`
- Renders `{error: "Forbidden"}` with HTTP 403 when the extracted host does not equal the configured main domain (DOM-04)

### Task 2: Include in all three onboarding controllers (commit: ae9d38f)

Added `include MainDomainOnly` immediately above `include CognitoAuth` in:
- `backend/app/controllers/v1/onboarding/brokerages_controller.rb`
- `backend/app/controllers/v1/onboarding/domains_controller.rb`
- `backend/app/controllers/v1/onboarding/users_controller.rb`

This order guarantees `require_main_domain!` runs before `authenticate_cognito_user!` — wrong-domain requests return 403, not 401.

### Task 3: Integration tests (commit: 943a82d)

Created `backend/test/integration/onboarding_domain_guard_test.rb` with 5 test methods:

**Rejection cases (4):** POST /v1/onboarding/brokerage, GET /v1/onboarding/domains/check, POST /v1/onboarding/domains/1/verify, PATCH /v1/onboarding/user — all from `Origin: https://acme.realstate.ca` return HTTP 403.

**Pass-through case (1):** POST /v1/onboarding/brokerage from `Origin: https://<MAIN_DOMAIN>` returns a status that is not 403 (guard passes; downstream CognitoAuth + param validation determines actual response).

Test results: **5 runs, 6 assertions, 0 failures, 0 errors, 0 skips**
Full suite: **22 runs, 39 assertions, 0 failures, 0 errors, 0 skips** (no regressions)

## Threats Mitigated

| Threat ID | Description | Mitigation |
|-----------|-------------|------------|
| T-07-01-01 | Elevation of privilege: subdomain user calls POST /v1/onboarding/brokerage | 403 from MainDomainOnly; tested |
| T-07-01-02 | Elevation of privilege: subdomain user calls DomainsController#check and #verify | 403 from class-level concern; both actions covered |
| T-07-01-03 | Elevation of privilege: subdomain user calls PATCH /v1/onboarding/user | 403 from MainDomainOnly; tested |
| T-07-01-05 | APP_BASE_DOMAIN unset in production | ENV.fetch default "realstate.ca" prevents crash |
| T-07-01-06 | Information disclosure via error body | Fixed string {"error":"Forbidden"} — no internal state leaked |
| T-07-01-07 | Malformed Origin header causes crash | URI::InvalidURIError rescue falls back to request.host |

T-07-01-04 (Origin header spoofing) accepted per plan — defence-in-depth; authenticated spoofed-origin requests still hit CognitoAuth next.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Pre-existing standardrb violations] Fixed DomainsController standardrb violations**
- **Found during:** Task 2 acceptance criteria verification
- **Issue:** `domains_controller.rb` had two pre-existing standardrb violations: `Lint/SafeNavigationChain` on `membership&.role.in?(...)` and `Layout/ExtraSpacing` on `server_ip   =`. The plan's acceptance criteria require standardrb to pass on all modified files — including this one.
- **Fix:** Ran `bundle exec standardrb --fix app/controllers/v1/onboarding/domains_controller.rb`. The safe navigation chain became `membership&.role&.in?(...)` and the extra spacing was removed.
- **Files modified:** `backend/app/controllers/v1/onboarding/domains_controller.rb`
- **Committed with:** Task 2 commit (ae9d38f)

## Known Stubs

None — all wired behavior; no placeholder data or hardcoded empty values.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes beyond what the plan's threat model covers.

## Self-Check

Created files exist:
- `backend/app/controllers/concerns/main_domain_only.rb` — FOUND
- `backend/test/integration/onboarding_domain_guard_test.rb` — FOUND

Commits exist:
- `9d81fbf` (Task 1 — concern) — FOUND
- `ae9d38f` (Task 2 — controllers) — FOUND
- `943a82d` (Task 3 — tests) — FOUND

Phase verification:
- MainDomainOnly.instance_method(:require_main_domain!).owner.name → "MainDomainOnly" — PASSED
- 3 controllers include MainDomainOnly — PASSED
- 5 tests pass, 0 failures — PASSED
- standardrb clean on all 5 files — PASSED
- Full suite 22 runs, 0 failures — PASSED

## Self-Check: PASSED
