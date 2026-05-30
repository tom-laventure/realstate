---
phase: 22-dns-verification-health-monitoring-backend
plan: 05
subsystem: infra
tags: [solidqueue, resolv, dns, background-jobs, cname, domain-lifecycle, mailer]

requires:
  - phase: 22-01
    provides: BrokerageDomain model with pending/phasing_out/frozen enum, consecutive_failures, last_checked_at, phase_out!/decommission! methods, PHASE_OUT_DURATION constant
  - phase: 22-02
    provides: DomainMailer with health_failure(domain), unverified_warning(domain) methods

provides:
  - DomainVerificationJob: promotes pending domains on CNAME match, warns at day 5, decommissions at day 7, rescues phasing_out domains before phase_out_at
  - DomainHealthJob: increments consecutive_failures on CNAME miss, phases out at 3 failures with health_failure email
  - SolidQueue recurring schedule entries for both jobs at 30-minute intervals

affects:
  - phase-23-301-redirect (needs phasing_out domains)
  - phase-24-domain-ui-overhaul (needs verified/pending status flow)

tech-stack:
  added: []
  patterns:
    - "FakeJob subclass pattern for testing jobs without DNS network calls in Minitest 6 (no mock/stub)"
    - "BrokerageDomain.lock.find inside ApplicationRecord.transaction for pessimistic lock (DVER-05)"
    - "getresources (plural) with rescue Resolv::ResolvError, Resolv::ResolvTimeout (D-01, D-03)"

key-files:
  created:
    - backend/app/jobs/domain_verification_job.rb
    - backend/app/jobs/domain_health_job.rb
    - backend/test/jobs/domain_verification_job_test.rb
    - backend/test/jobs/domain_health_job_test.rb
  modified:
    - backend/config/recurring.yml

key-decisions:
  - "FakeJob subclass pattern instead of Minitest::Mock for DNS stubbing — Minitest 6.0.3 removed the mock library, so test subclass overrides cname_resolves_to_subdomain? directly"
  - "BrokerageDomain has no acts_as_paranoid — removed without_deleted calls from job scopes (plan had incorrect assumption)"
  - "30.minutes literal is acceptable in HEALTH_CHECK_INTERVAL constant definition; plan verification grep catches the definition itself which is correct behavior"

patterns-established:
  - "FakeJob test subclass: override DNS resolution method rather than using Minitest::Mock (incompatible with Minitest 6)"
  - "Job scopes on BrokerageDomain use .domain_type_custom.status_pending (no without_deleted — model is not paranoid)"

requirements-completed:
  - DVER-02
  - DVER-05
  - DHLT-01
  - DHLT-02
  - DHLT-03
  - DHLT-04
  - DHLT-05
  - DLCX-01

duration: 25min
completed: 2026-05-30
---

# Phase 22 Plan 05: DomainVerificationJob + DomainHealthJob Summary

**SolidQueue recurring jobs for autonomous DNS lifecycle management: CNAME verification polling, 7-day pending expiry with day-5 warning email, phasing-out rescue (DLCX-01), and 3-strike health failure detection with phase_out + email (DHLT-02)**

## Performance

- **Duration:** 25 min
- **Started:** 2026-05-30T20:55:00Z
- **Completed:** 2026-05-30T21:20:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- DomainVerificationJob processes pending domains (promote/expire/warn) and phasing-out domains (rescue), with pessimistic lock preventing duplicate promotion (DVER-05)
- DomainHealthJob tracks consecutive CNAME failures on active custom domains and triggers phase_out! + health_failure email at 3 consecutive failures (DHLT-02, DHLT-03, DHLT-04)
- recurring.yml updated with SolidQueue schedule entries for both jobs at every 30 minutes
- 20 tests across both jobs: 0 failures, 0 errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement DomainVerificationJob** - `01dfaf6` (feat)
2. **Task 2: Implement DomainHealthJob and update recurring.yml** - `5c25bea` (feat)

_Note: TDD tasks — tests written first (RED), implementation added (GREEN), both committed together._

## Files Created/Modified

- `backend/app/jobs/domain_verification_job.rb` - Processes pending/phasing_out custom domains; VERIFICATION_EXPIRY_DAYS=7, WARNING_EMAIL_DAYS=5 constants; pessimistic lock (DVER-05); CNAME via getresources (D-01)
- `backend/app/jobs/domain_health_job.rb` - Processes active custom domains; HEALTH_CHECK_INTERVAL=30.minutes, MAX_CONSECUTIVE_FAILURES=3; phase_out! + email at 3 failures (DHLT-02)
- `backend/config/recurring.yml` - Added domain_verification and domain_health entries at every 30 minutes
- `backend/test/jobs/domain_verification_job_test.rb` - 10 tests covering pending promote/expire/warn, phasing-out rescue, idempotency guard, constants
- `backend/test/jobs/domain_health_job_test.rb` - 10 tests covering success reset, failure increment, 3-strike phase_out, DHLT-04, subdomain exclusion, constants

## Decisions Made

- **FakeJob subclass for DNS testing:** Minitest 6.0.3 (used with Ruby 4.0.0) removed the `Minitest::Mock` library and does not have `.stub` on objects. Used a `FakeJob < DomainVerificationJob` subclass that overrides `cname_resolves_to_subdomain?` with a hash lookup — clean, no real DNS calls, fully controllable.
- **No `without_deleted` on BrokerageDomain:** The plan's job code used `.without_deleted` on BrokerageDomain, but this model does not include `acts_as_paranoid`. Removed those calls; scopes work correctly without them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed without_deleted calls on BrokerageDomain**
- **Found during:** Task 1 (DomainVerificationJob), Task 2 (DomainHealthJob)
- **Issue:** Plan's code called `BrokerageDomain.without_deleted.domain_type_custom.status_pending` but BrokerageDomain does not include `acts_as_paranoid` — this raises `NoMethodError: undefined method 'without_deleted'`
- **Fix:** Replaced with `BrokerageDomain.domain_type_custom.status_pending` (and equivalent for status_phasing_out, status_active)
- **Files modified:** backend/app/jobs/domain_verification_job.rb, backend/app/jobs/domain_health_job.rb
- **Verification:** All 20 tests pass with no NoMethodError
- **Committed in:** 01dfaf6, 5c25bea (part of task commits)

**2. [Rule 1 - Bug] Replaced Minitest::Mock / .stub with FakeJob subclass pattern**
- **Found during:** Task 1 (DomainVerificationJob tests)
- **Issue:** Plan's test code used `Minitest::Mock.new` and `Resolv::DNS.stub(...)` — Minitest 6.0.3 removed the mock library entirely; neither `Minitest::Mock` nor `.stub` exist on objects
- **Fix:** Created `FakeVerificationJob < DomainVerificationJob` and `FakeHealthJob < DomainHealthJob` subclasses that override `cname_resolves_to_subdomain?` using an `@cname_results` hash. Tests set the hash before calling `job.perform`.
- **Files modified:** backend/test/jobs/domain_verification_job_test.rb, backend/test/jobs/domain_health_job_test.rb
- **Verification:** All 20 tests pass, DNS resolution is fully controlled without network calls
- **Committed in:** 01dfaf6, 5c25bea (part of task commits)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs in plan code)
**Impact on plan:** Both fixes necessary for the code and tests to run. No scope creep — behavior implemented exactly as specified in the plan.

## Issues Encountered

None — both deviations were identified and fixed immediately during RED phase.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Both jobs are internal SolidQueue workers operating on existing BrokerageDomain records. DNS queries are outbound read-only UDP (T-22-11 mitigated via rescue clause). No new threat surface beyond what the plan's threat model documented.

## User Setup Required

None - no external service configuration required. SolidQueue recurring.yml is self-contained.

## Next Phase Readiness

- Phase 22 is now complete: all 5 plans (model foundation, DomainMailer, Brokerage freeze/unfreeze + ops endpoint, DomainsController pending flow, background jobs) are implemented
- Phase 23 (301 Redirect & Primary Domain Enforcement) can proceed — depends on BrokerageDomain phasing_out/active status machine which is fully operational
- Phase 24 (Domain UI Overhaul) can proceed — DomainVerificationJob promotes pending domains; the pending→active flow is end-to-end

---
*Phase: 22-dns-verification-health-monitoring-backend*
*Completed: 2026-05-30*
