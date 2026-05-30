---
phase: 22-dns-verification-health-monitoring-backend
plan: "01"
subsystem: database
tags: [rails, activerecord, enum, migration, serializer, minitest]

requires: []

provides:
  - "consecutive_failures integer column on brokerage_domains (health tracking)"
  - "last_checked_at datetime column on brokerage_domains (health tracking)"
  - "BrokerageDomain status enum extended with pending and frozen values (5 values total)"
  - "PHASE_OUT_DURATION = 30.days constant in BrokerageDomain model"
  - "freeze_domain! and unfreeze_domain! instance methods"
  - "BrokerageDomainSerializer exposing all 10 domain attributes including health columns"

affects:
  - "22-02-dns-verification-job"
  - "22-03-domain-health-job"
  - "22-04-domain-mailer"
  - "22-05-ops-freeze-endpoint"
  - "23-redirect-middleware"
  - "24-domain-ui"

tech-stack:
  added: []
  patterns:
    - "PHASE_OUT_DURATION constant: duration constants defined at model class level before RESERVED_SLUGS"
    - "Status enum extension: new values added to existing string enum hash with no migration needed"
    - "Freeze/unfreeze methods: follow same update! pattern as phase_out! and decommission!"

key-files:
  created:
    - "backend/db/migrate/20260530000001_add_domain_health_columns_to_brokerage_domains.rb"
  modified:
    - "backend/app/models/brokerage_domain.rb"
    - "backend/app/serializers/brokerage_domain_serializer.rb"
    - "backend/test/models/brokerage_domain_test.rb"
    - "backend/test/integration/admin_domains_test.rb"

key-decisions:
  - "PHASE_OUT_DURATION constant placed at top of class body before RESERVED_SLUGS — visible and centralized"
  - "pending and frozen status values require NO migration — string enum, model-only change"
  - "verified exposed in BrokerageDomainSerializer — Phase 24 UI needs verification state display"
  - "pre-existing DMOD-11 integration test failure is out of scope for this plan (logged to deferred)"

patterns-established:
  - "Duration constants: define as CONSTANT_NAME = N.days before usage, reference via CONSTANT_NAME.from_now"
  - "Freeze methods: update!(status: :frozen) with no additional logic — guard validation is status_requires_verified (fires only on :active)"

requirements-completed:
  - DVER-05
  - DHLT-01
  - DHLT-02
  - DHLT-05
  - DPRI-01
  - DPRI-02
  - DPRD-01
  - DPRD-06

duration: 6min
completed: "2026-05-30"
---

# Phase 22 Plan 01: DB Foundation & Model Extension Summary

**BrokerageDomain gains two health-tracking columns, a 5-value status enum (active/phasing_out/decommissioned/pending/frozen), PHASE_OUT_DURATION constant, freeze_domain!/unfreeze_domain! methods, and serializer exposes all 10 domain attributes**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-30T19:47:55Z
- **Completed:** 2026-05-30T19:53:45Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Migration 20260530000001 adds `consecutive_failures` (integer, default 0, not null) and `last_checked_at` (datetime, nullable) to `brokerage_domains`
- BrokerageDomain model extended: 5-value string enum, `PHASE_OUT_DURATION = 30.days` constant, `phase_out!` updated to use constant, `freeze_domain!`/`unfreeze_domain!` methods added
- BrokerageDomainSerializer now exposes all 10 attributes (previously 6): `id, domain, domain_type, status, is_primary, phase_out_at, verified, verified_at, last_checked_at, consecutive_failures`
- All 8 model tests pass; integration test updated to assert `verified` key is present (Phase 24 UI requirement)

## Task Commits

Each task was committed atomically (backend/ sub-repo):

1. **Task 1: Add health-tracking columns via migration** - `76c7c0b` (chore)
2. **Task 2 RED: Failing tests for enum and freeze methods** - `c309ad5` (test)
3. **Task 2 GREEN: Implement enum, constant, and freeze methods** - `c73ea30` (feat)
4. **Task 3: Update BrokerageDomainSerializer** - `87de4f3` (feat)

## Files Created/Modified

- `backend/db/migrate/20260530000001_add_domain_health_columns_to_brokerage_domains.rb` - Migration adding consecutive_failures + last_checked_at
- `backend/db/schema.rb` - Auto-updated by migration
- `backend/app/models/brokerage_domain.rb` - PHASE_OUT_DURATION constant, 5-value enum, freeze_domain!/unfreeze_domain! methods, updated phase_out!
- `backend/app/serializers/brokerage_domain_serializer.rb` - Exposes 10 attributes (added verified, verified_at, last_checked_at, consecutive_failures)
- `backend/test/models/brokerage_domain_test.rb` - 5 new tests for new behavior
- `backend/test/integration/admin_domains_test.rb` - Updated verified key assertion and expanded key list

## Decisions Made

- `PHASE_OUT_DURATION = 30.days` placed at the top of the class body before `RESERVED_SLUGS` — model-level constant, readily visible and centralized for all Phase 22 plans
- `pending` and `frozen` added to the string enum hash with no migration needed — string enum values are purely model-side (no `ALTER TYPE` required)
- `verified` is now exposed in the serializer: Phase 24 UI needs to display verification state; the endpoint is behind `require_admin!` so no external exposure concern (matches T-22-02 threat disposition: accept)

## Deviations from Plan

### Noted (not auto-fixed — out of scope)

**1. Pre-existing DMOD-11 integration test failure**
- **Found during:** Task 3 verification
- **Issue:** `AdminDomainsTest#test_PATCH_/v1/admin/domains/subdomain_includes_phase_out_warning_when_post-action_count_==_2_(DMOD-11)` was already failing before this plan's changes
- **Action:** Confirmed pre-existing by stashing this plan's changes and re-running — failure was present without our changes
- **Scope decision:** Out of scope per deviation rules (only fix issues directly caused by current task's changes)
- **Logged:** Will track as deferred item for Phase 22 cleanup

---

**Total deviations:** 0 auto-fixes (1 out-of-scope pre-existing failure noted and deferred)
**Impact on plan:** No scope creep. Pre-existing failure is unrelated to this plan's deliverables.

## Issues Encountered

- Test database environment mismatch error (`ActiveRecord::EnvironmentMismatchError`) on first run — resolved by running `RAILS_ENV=test rails db:migrate` before running model tests
- DMOD-11 pre-existing failure discovered during integration test run — confirmed pre-existing via stash test, not introduced by this plan

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. All model methods are fully implemented; serializer exposes real DB columns. No placeholder data.

## Threat Flags

No new security-relevant surface introduced beyond what the plan's threat model covers. The `verified` field exposure in the serializer is explicitly addressed in T-22-02 (accept disposition — endpoint is behind `require_admin!`).

## Next Phase Readiness

All Phase 22 foundational model changes are in place:
- `consecutive_failures` and `last_checked_at` columns ready for DomainVerificationJob (plan 02) and DomainHealthJob (plan 03) to write
- `status_pending?` and `status_frozen?` predicates available for job guards and ops endpoint (plans 02, 03, 05)
- `freeze_domain!`/`unfreeze_domain!` ready for ops endpoint wiring (plan 05)
- Serializer ready for Phase 24 UI to display verification and health state

---
*Phase: 22-dns-verification-health-monitoring-backend*
*Completed: 2026-05-30*
