---
phase: 23-301-redirect-primary-domain-enforcement
plan: "02"
subsystem: testing
tags: [mailer, integration-test, dpri-03, primary-domain, email]

requires:
  - phase: 22-dns-verification-health-monitoring
    provides: "DomainMailer + InvitationMailer with primary_domain helper"
  - phase: 23-01
    provides: "DomainRedirectMiddleware (primary domain enforcement infrastructure)"

provides:
  - "DPRI-03 regression tests: all DomainMailer methods assert primary domain in dashboard URL"
  - "DPRI-03 regression tests: both InvitationMailer methods assert primary domain in invitation URL"
  - "Propagation test: promoting a new primary domain updates the link in the next email"

affects: [phase-24-domain-ui-overhaul]

tech-stack:
  added: []
  patterns:
    - "assert_includes body, primary_domain.domain — asserts URL contains the primary domain string"
    - "refute_includes body — negative assertion prevents non-primary domain leak into URL"
    - "Inline create(:brokerage_domain, is_primary: true) in each InvitationMailerTest test — setup does not create a primary domain so each test owns its fixture"

key-files:
  created: []
  modified:
    - backend/test/mailers/domain_mailer_test.rb
    - backend/test/mailers/invitation_mailer_test.rb

key-decisions:
  - "No mailer production code changes — DPRI-03 was already code-complete in Phase 22 (D-13 stands)"
  - "Invitation factory has no :group trait — pass group: directly to create(:invitation) for invite_group test"
  - "InvitationMailer setup does not create primary domain — each DPRI-03 test creates its own fixture inline"

patterns-established:
  - "DPRI-03 pattern: assert primary domain appears in body; refute non-primary domain appears in URL"
  - "Propagation test pattern: update!(is_primary: false/true), re-send email, assert new primary in body"

requirements-completed: [DPRI-03]

duration: 12min
completed: 2026-05-31
---

# Phase 23 Plan 02: DPRI-03 Mailer Integration Tests Summary

**Regression-proof test coverage locking DPRI-03: four DomainMailer and two InvitationMailer tests assert all system emails embed the brokerage's current primary domain, including a propagation test that proves a primary-domain change takes effect on the next send.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-31T01:00:00Z
- **Completed:** 2026-05-31T01:12:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Four DPRI-03 tests added to DomainMailerTest: health_failure, downgrade_notice, unverified_warning dashboard URLs all assert primary domain; propagation test asserts promoting a new primary changes the link host
- Two DPRI-03 tests added to InvitationMailerTest: invite_brokerage and invite_group invitation URLs assert primary domain; invite_brokerage test also asserts the /invite/{token} path is present
- Full mailer test suite remains green: 22 runs, 58 assertions, 0 failures, 0 errors, 0 skips
- StandardRB lint clean on both modified files

## Task Commits

Each task was committed atomically:

1. **Task 1: Add DPRI-03 tests to DomainMailerTest** - `4eb4515` (test)
2. **Task 2: Add DPRI-03 tests to InvitationMailerTest** - `ba6bd72` (test)

**Plan metadata:** (see final docs commit)

## Files Created/Modified

- `backend/test/mailers/domain_mailer_test.rb` - Added 4 DPRI-03 test cases (37 lines)
- `backend/test/mailers/invitation_mailer_test.rb` - Added 2 DPRI-03 test cases (24 lines)

## Decisions Made

- No mailer production code changed — DPRI-03 was already implemented in Phase 22 (D-13 locked). This plan is test coverage only.
- Invitation factory does not have a `:group` trait. The `invite_group` test passes `group:` directly to `create(:invitation, ...)` without a trait.
- InvitationMailerTest setup does not create a primary domain (it exercises the fallback chain). Each DPRI-03 test creates its own `brokerage_domain` with `is_primary: true` inline to avoid test interdependence.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DPRI-03 is now fully covered with regression tests. No mailer code will break primary-domain resolution without failing these tests.
- Phase 23 (Plan 01 + Plan 02) is complete. Phase 24 Domain UI Overhaul can proceed.
- No blockers.

---
*Phase: 23-301-redirect-primary-domain-enforcement*
*Completed: 2026-05-31*

## Self-Check: PASSED

- [x] `backend/test/mailers/domain_mailer_test.rb` exists and contains DPRI-03 tests
- [x] `backend/test/mailers/invitation_mailer_test.rb` exists and contains DPRI-03 tests
- [x] Commit `4eb4515` exists (DomainMailerTest DPRI-03 tests)
- [x] Commit `ba6bd72` exists (InvitationMailerTest DPRI-03 tests)
- [x] 22 runs, 58 assertions, 0 failures, 0 errors, 0 skips
