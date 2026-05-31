---
phase: 24-domain-ui-overhaul
plan: "01"
subsystem: backend-domains
tags: [domains, verification, dns, migration, controller, tests]
dependency_graph:
  requires: []
  provides:
    - POST /v1/admin/domains/:id/verify
    - set_primary_on_verify column on brokerage_domains
    - frozen domains in index and mutation_payload scopes
  affects:
    - backend/app/controllers/v1/admin/domains_controller.rb
    - backend/app/jobs/domain_verification_job.rb
    - backend/db/schema.rb
tech_stack:
  added: []
  patterns:
    - define_method/remove_method DNS stub for Minitest 6 (no Minitest::Mock)
    - Synchronous DNS check in controller action (mirrors onboarding verify pattern)
    - Pessimistic lock (BrokerageDomain.lock.find) for transactional domain promotion
key_files:
  created:
    - backend/db/migrate/20260601000001_add_set_primary_on_verify_to_brokerage_domains.rb
  modified:
    - backend/app/jobs/domain_verification_job.rb
    - backend/config/routes.rb
    - backend/app/controllers/v1/admin/domains_controller.rb
    - backend/test/serializers/brokerage_domain_serializer_test.rb
    - backend/test/integration/admin_domains_test.rb
decisions:
  - "DNS stub via define_method/remove_method instead of module prepend (cleaner teardown in Minitest 6)"
  - "verify action uses synchronous dns_resolves? inline (mirrors onboarding verify; DVER-01 needs direct response)"
  - "mutation_payload includes status_frozen in both index and mutation scopes for DPRD-04"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-31T05:59:00Z"
  tasks_completed: 3
  files_changed: 5
---

# Phase 24 Plan 01: Backend Slice — Verify Endpoint, set_primary_on_verify, Frozen Scope Summary

**One-liner:** On-demand domain verify endpoint (POST /v1/admin/domains/:id/verify) with synchronous DNS check, set_primary_on_verify promotion logic, and frozen-domain inclusion in all list scopes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add set_primary_on_verify migration and honor it in verification job | 4dce8db | db/migrate/..., db/schema.rb, app/jobs/domain_verification_job.rb |
| 2 | Add verify route + action, frozen scope, and custom-action set_primary_on_verify param | 3f8159b | config/routes.rb, app/controllers/v1/admin/domains_controller.rb |
| 3 | Fix stale serializer test and replace 404-verify test with real verify integration tests | 0c9558d | test/serializers/brokerage_domain_serializer_test.rb, test/integration/admin_domains_test.rb |

## What Was Built

### Task 1: Migration + Job
- Created migration `20260601000001_add_set_primary_on_verify_to_brokerage_domains.rb` adding `set_primary_on_verify boolean NOT NULL DEFAULT false` column to `brokerage_domains`.
- Updated `DomainVerificationJob#promote_to_active!` to: demote existing primaries with `update_all(is_primary: false)` and promote the verified domain when `set_primary_on_verify?` is true (or when no primary exists), then reset the flag to false.

### Task 2: Controller + Routes
- Added `post :verify` to admin domains member routes.
- Added `verify` public action — NOT added to `require_owner!` list (admin + owner access via default `require_admin!`).
- Verify action performs synchronous DNS check and handles pending→active promotion (with optional primary assignment) and phasing_out→active rescue transactionally.
- Updated `index` and `mutation_payload` to include `status_frozen` domains (DPRD-04).
- Added `set_primary_on_verify` param acceptance in `custom` action (wizard preference step DADD-02).
- Copied `dns_resolves?` from onboarding controller into private section; added `require "resolv"` at file top.

### Task 3: Tests
- Updated `BrokerageDomainSerializerTest` to assert all 10 serialized keys (was 6); renamed test.
- Removed stale Phase-21 inverted test "does NOT expose verification fields".
- Deleted old `POST /v1/admin/domains/:id/verify is no longer routed (404)` test.
- Added 5 new integration tests covering: pending→active DNS success, DNS failure response, phasing_out rescue, agent 403, and frozen domain in index.
- DNS stubbing via `define_method`/`remove_method` pattern (Minitest 6 compatible).

## Verification Results

```
31 runs, 98 assertions, 0 failures, 0 errors, 0 skips
bundle exec standardrb app/controllers/v1/admin/domains_controller.rb → exit 0
grep -q "post :verify" config/routes.rb → success
grep -q "set_primary_on_verify" db/schema.rb → success
```

## Deviations from Plan

None — plan executed exactly as written. The `define_method`/`remove_method` DNS stub approach was chosen as the cleanest Minitest 6 compatible pattern (plan gave executor discretion to choose the working mechanism).

## Known Stubs

None — all data flows are wired to real DB state.

## Threat Flags

No new network endpoints or trust boundaries beyond what the plan's threat model documented (T-24-01 through T-24-04). All mitigations are implemented:
- T-24-01: tenant-scoped `Current.brokerage.brokerage_domains.find_by(id:)` prevents cross-tenant access.
- T-24-02: `verify` omitted from `require_owner!` — agent-role test asserts 403.

## Self-Check: PASSED

- `/home/tomlaventure/projects/realstate/backend/db/migrate/20260601000001_add_set_primary_on_verify_to_brokerage_domains.rb` — FOUND
- `/home/tomlaventure/projects/realstate/backend/db/schema.rb` contains `set_primary_on_verify` — FOUND
- `/home/tomlaventure/projects/realstate/backend/app/controllers/v1/admin/domains_controller.rb` contains `def verify` — FOUND
- `/home/tomlaventure/projects/realstate/backend/app/controllers/v1/admin/domains_controller.rb` contains `def dns_resolves?` — FOUND
- Commits 4dce8db, 3f8159b, 0c9558d all exist in git log.
