---
phase: 19-domain-schema-auth-integration
plan: "03"
subsystem: backend-auth
tags: [routing, auth, brokerage_auth, domains_controller, factory, domain-lifecycle]
dependency_graph:
  requires: [BrokerageDomain-enums, BrokerageDomain-routable-scope, BrokerageDomain-status-active-scope]
  provides: [BrokerageAuth-routable-resolution, DomainsController-status-active-check, brokerage_domain-factory-complete]
  affects: [BrokerageAuth, DomainsController, test-factories]
tech_stack:
  added: []
  patterns: [named-scope-in-routing, status-based-domain-resolution, factory-string-enum-defaults]
key_files:
  created: []
  modified:
    - backend/app/controllers/concerns/brokerage_auth.rb
    - backend/app/controllers/v1/domains_controller.rb
    - backend/test/factories/brokerage_domains.rb
decisions:
  - "BrokerageAuth uses .routable scope (active + phasing_out) not .verified for tenant resolution — phasing_out domains remain routable through transition"
  - "DomainsController#check uses .status_active scope — Caddy TLS provisioning only approves actively-served domains, not phasing_out ones"
  - "Factory uses string values (\"subdomain\", \"active\") not symbols to match brokerage_board_credentials pattern"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-27"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 19 Plan 03: BrokerageAuth and DomainsController Status-Based Routing Summary

**One-liner:** BrokerageAuth subdomain lookup updated to `.routable` scope (active+phasing_out), DomainsController#check updated to `.status_active` scope, and brokerage_domain factory updated with three new column defaults — all integration tests pass.

## What Was Built

Three targeted file updates to wire the routing layer to the new status-based model scopes from Plan 02:

### 1. BrokerageAuth concern (`backend/app/controllers/concerns/brokerage_auth.rb`)

The subdomain branch of `resolve_brokerage` now uses:
```ruby
domain_record = BrokerageDomain
  .routable
  .includes(:brokerage)
  .find_by(domain: domain)
```
Previously used `.find_by(domain: domain, verified: true)`. The `.routable` scope (from Plan 02) matches `status IN ('active', 'phasing_out')`, so domains in transition remain resolvable while decommissioned domains correctly raise `RecordNotFound` → 404.

### 2. DomainsController (`backend/app/controllers/v1/domains_controller.rb`)

The `check` action now uses:
```ruby
exists = BrokerageDomain.status_active.exists?(domain: domain)
```
Previously used `BrokerageDomain.exists?(domain: domain, verified: true, deleted_at: nil)`. The `.status_active` scope (Rails enum-generated) ensures Caddy's TLS provisioning endpoint only approves domains currently in active service — not phasing_out or decommissioned.

### 3. brokerage_domain factory (`backend/test/factories/brokerage_domains.rb`)

Added three new attributes using string values (matching the `brokerage_board_credentials` pattern):
```ruby
domain_type { "subdomain" }
status      { "active" }
is_primary  { true }
```
These defaults ensure factory-created records satisfy the new model validations (`status_requires_verified` passes because `verified: true` is already the factory default).

## Verification Results

**Acceptance criteria — Task 1 (all pass):**
- `grep -c "\.routable"` in brokerage_auth.rb → 1
- `grep -c "find_by(domain: domain, verified: true)"` in brokerage_auth.rb → 0
- `grep -c "status_active"` in domains_controller.rb → 1
- `grep -c "verified: true, deleted_at: nil"` in domains_controller.rb → 0
- `grep -c "skip_before_action"` in domains_controller.rb → 1 (preserved)
- `grep -c "main_domain_request?"` in brokerage_auth.rb → 2 (method + call preserved)
- `grep -c "extract_domain_from_request"` in brokerage_auth.rb → 3 (preserved)

**Acceptance criteria — Task 2 (all pass):**
- `grep -c "domain_type"` in factory → 1
- `grep -c "status"` in factory → 1
- `grep -c "is_primary"` in factory → 1
- `grep -c '"subdomain"'` in factory → 1 (string value)
- `grep -c '"active"'` in factory → 1 (string value)

**Integration tests:**
- `brokerage_auth_main_domain_test.rb` + `tenant_isolation_test.rb` combined: 6 runs, 8 assertions, 0 failures, 0 errors, 0 skips

**Full test suite:**
- 83 runs, 66 assertions, 0 failures, 51 errors, 0 skips
- The 51 errors are pre-existing `PG::ObjectInUse` failures caused by the shared Neon DB receiving concurrent connections from parallel wave agents — not introduced by this plan. Baseline before this plan's changes: identical 51 errors.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update BrokerageAuth and DomainsController routing lookups | a1fbb65 (backend) | app/controllers/concerns/brokerage_auth.rb, app/controllers/v1/domains_controller.rb |
| 2 | Update factory with domain_type, status, is_primary defaults | a8b3c98 (backend) | test/factories/brokerage_domains.rb |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. All four STRIDE threats from the plan's threat_model are handled:
- T-19-07 (Spoofing via decommissioned domain): `.routable` scope excludes decommissioned records → RecordNotFound → 404
- T-19-08 (Tampering via domain param in check): accepted by design — read-only existence check
- T-19-09 (Information Disclosure from 404): accepted — 404 reveals nothing brokerage-specific
- T-19-10 (DoS via IN query): accepted — two-value IN on indexed column, negligible overhead

## Self-Check: PASSED

- [x] `backend/app/controllers/concerns/brokerage_auth.rb` modified — FOUND (contains `.routable`)
- [x] `backend/app/controllers/v1/domains_controller.rb` modified — FOUND (contains `status_active`)
- [x] `backend/test/factories/brokerage_domains.rb` modified — FOUND (contains `domain_type`, `status`, `is_primary`)
- [x] backend commit a1fbb65 — FOUND
- [x] backend commit a8b3c98 — FOUND
- [x] Integration tests: 6 runs, 8 assertions, 0 failures, 0 errors — CONFIRMED
- [x] No new test failures vs pre-phase baseline — CONFIRMED (same 51 pre-existing PG::ObjectInUse errors)
