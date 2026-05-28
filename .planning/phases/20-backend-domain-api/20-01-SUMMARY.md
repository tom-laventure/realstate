---
phase: 20-backend-domain-api
plan: "01"
subsystem: backend-models-serializer
tags: [brokerage-domain, lifecycle, serializer, tdd, minitest]
dependency_graph:
  requires: [19-domain-schema-auth-integration]
  provides: [phase_out!, decommission!, phasing_out_count_for, BrokerageDomainSerializer]
  affects: [backend/app/models/brokerage_domain.rb, backend/app/models/brokerage.rb, backend/app/serializers/brokerage_domain_serializer.rb]
tech_stack:
  added: []
  patterns: [fat-model-lean-controller, AMS-scalar-serializer, TDD-red-green]
key_files:
  created:
    - backend/app/serializers/brokerage_domain_serializer.rb
    - backend/test/models/brokerage_domain_test.rb
    - backend/test/models/brokerage_test.rb
    - backend/test/serializers/brokerage_domain_serializer_test.rb
  modified:
    - backend/app/models/brokerage_domain.rb
    - backend/app/models/brokerage.rb
decisions:
  - "phase_out! uses update! (raises on failure) and sets 30.days.from_now without rounding — D-06"
  - "decommission! sets deleted_at manually (BrokerageDomain is NOT acts_as_paranoid) — D-07, Pitfall 2"
  - "phasing_out_count_for uses brokerage_domains association (not BrokerageDomain.where) for multi-tenant safety — T-20.01-02"
  - "BrokerageDomainSerializer excludes all verification fields per D-02 — T-20.01-01"
  - "ActiveSupport::Testing::TimeHelpers included in BrokerageDomainTest class (not globally in test_helper.rb)"
metrics:
  duration: "8m"
  completed: "2026-05-28"
  tasks_completed: 3
  tests_added: 9
  files_modified: 2
  files_created: 4
---

# Phase 20 Plan 01: BrokerageDomain Lifecycle Foundation Summary

**One-liner:** Added `phase_out!` and `decommission!` to BrokerageDomain, `phasing_out_count_for(type)` to Brokerage, and a new `BrokerageDomainSerializer` exposing exactly six lifecycle fields — tested with 9 passing Minitest tests.

## What Was Built

### Model Methods Added to BrokerageDomain

**File:** `backend/app/models/brokerage_domain.rb`

```ruby
def phase_out!
  update!(status: :phasing_out, phase_out_at: 30.days.from_now)
end

def decommission!
  update!(status: :decommissioned, deleted_at: Time.current)
end
```

- `phase_out!` transitions any domain to `status: phasing_out` and stamps `phase_out_at` to exactly 30 days from now (no rounding)
- `decommission!` sets `status: decommissioned` AND `deleted_at: Time.current` in a single `update!` call. Uses manual `deleted_at` assignment because `BrokerageDomain` does NOT use `acts_as_paranoid` (confirmed Pitfall 2)
- Both methods use `update!` (raise on failure)
- Support full lifecycle: active → phasing_out → decommissioned

### Helper Method Added to Brokerage

**File:** `backend/app/models/brokerage.rb`

```ruby
def phasing_out_count_for(type)
  brokerage_domains.status_phasing_out.where(domain_type: type).count
end
```

- Scoped through the `brokerage_domains` association (NOT `BrokerageDomain.where(brokerage_id: ...)`) — multi-tenant safe by construction (T-20.01-02 mitigated)
- Chains the `.status_phasing_out` enum scope with a `domain_type` filter
- Used by Plan 02 controller for DMOD-11 warning and DMOD-12 blocking

### Serializer Created

**File:** `backend/app/serializers/brokerage_domain_serializer.rb`

```ruby
class BrokerageDomainSerializer < ActiveModel::Serializer
  attributes :id, :domain, :domain_type, :status, :is_primary, :phase_out_at
end
```

- Exposes exactly 6 lifecycle attributes: `id`, `domain`, `domain_type`, `status`, `is_primary`, `phase_out_at`
- No `AssociationLoader` (all attributes are scalar columns)
- Explicitly excludes: `verified`, `verified_at`, `verification_token`, `brokerage_id`, `created_at`, `updated_at`, `deleted_at` — per D-02 and T-20.01-01 (Information Disclosure mitigation)

## Test Counts

| Test File | Tests | Assertions |
|-----------|-------|------------|
| `test/models/brokerage_domain_test.rb` | 3 | 7 |
| `test/models/brokerage_test.rb` | 3 | 6 |
| `test/serializers/brokerage_domain_serializer_test.rb` | 3 | 13 |
| **Total** | **9** | **26** |

All 9 tests pass: `9 runs, 26 assertions, 0 failures, 0 errors, 0 skips`

## Commits

| Hash | Message |
|------|---------|
| `3726c94` | feat(20-01): add phase_out! and decommission! to BrokerageDomain |
| `2ec9a0b` | feat(20-01): add phasing_out_count_for(type) to Brokerage |
| `a5343d5` | feat(20-01): create BrokerageDomainSerializer with lifecycle attributes |

## TDD Gate Compliance

All three tasks executed with full RED/GREEN TDD cycle:

- Task 1 RED: `NoMethodError: undefined method 'phase_out!'` and `NoMethodError: undefined method 'decommission!'` confirmed
- Task 1 GREEN: 3 runs, 7 assertions, 0 failures
- Task 2 RED: `NoMethodError: undefined method 'phasing_out_count_for'` confirmed
- Task 2 GREEN: 3 runs, 6 assertions, 0 failures
- Task 3 RED: `NameError: uninitialized constant BrokerageDomainSerializer` confirmed
- Task 3 GREEN: 3 runs, 13 assertions, 0 failures

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes

- `ActiveSupport::Testing::TimeHelpers` was included directly in `BrokerageDomainTest` class (not added globally to `test_helper.rb`), consistent with the plan's guidance: "If `test_helper.rb` does not already include it globally, add `include ActiveSupport::Testing::TimeHelpers` to the test class."
- Full test suite run (`bundle exec rails test`) shows 51 errors unrelated to this plan — these are caused by a pre-existing `PG::ObjectInUse` database locking issue from another worktree agent accessing the shared test database concurrently. Logged to deferred-items. All 9 plan-specific tests pass cleanly in isolation.

## Known Stubs

None — all methods are fully implemented and tested. No hardcoded values, placeholder text, or unconnected data sources.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Model/serializer layer only. All T-20.01-* threats mitigated as designed.

## Self-Check: PASSED

Files created/exist:
- backend/app/serializers/brokerage_domain_serializer.rb: FOUND
- backend/app/models/brokerage_domain.rb (modified): FOUND
- backend/app/models/brokerage.rb (modified): FOUND
- backend/test/models/brokerage_domain_test.rb: FOUND
- backend/test/models/brokerage_test.rb: FOUND
- backend/test/serializers/brokerage_domain_serializer_test.rb: FOUND

Commits verified:
- 3726c94: FOUND
- 2ec9a0b: FOUND
- a5343d5: FOUND
