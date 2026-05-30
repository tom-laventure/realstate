---
phase: 22-dns-verification-health-monitoring-backend
plan: "04"
subsystem: api
tags: [rails, domains, domain-lifecycle, pending-verification, dns]

# Dependency graph
requires:
  - phase: 22-dns-verification-health-monitoring-backend plan 01
    provides: BrokerageDomain pending/frozen enum values, status_pending? predicate, generate_verification_token callback

provides:
  - DomainsController#custom creates with status: :pending, verified: false (D-08)
  - DomainsController#destroy handles pending domains with immediate decommission
  - index and mutation_payload include pending domains in responses
  - Integration tests covering D-08 lifecycle behavior

affects: [22-05, 23-redirect-middleware, 24-domain-ui-overhaul]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pending-first domain creation: new custom domains start pending, verified by job rather than bypassing verification"
    - "OR-scope for collection queries: routable.or(status_pending) to include pending in listings"

key-files:
  created: []
  modified:
    - backend/app/controllers/v1/admin/domains_controller.rb
    - backend/test/integration/admin_domains_test.rb

key-decisions:
  - "D-08: custom domains created as pending (not active) — DomainVerificationJob promotes them after CNAME check"
  - "Pending destroy: immediate decommission with no phase-out (no live traffic to protect)"
  - "No slot check at pending creation: multiple pending domains may coexist"
  - "index and mutation_payload include pending domains so Phase 24 UI can show verification status"

patterns-established:
  - "Pending-first creation: create!(status: :pending, verified: false) — before_create callback sets verification_token"
  - "Or-scope pattern: .routable.or(.status_pending) for domain listings that should include pending"

requirements-completed: [DPRI-01, DPRI-02, DVER-05]

# Metrics
duration: 25min
completed: 2026-05-30
---

# Phase 22 Plan 04: DomainsController D-08 Pending Creation Summary

**DomainsController#custom now creates pending domains (not active), with immediate decommission for pending deletes and pending visibility in all domain listings**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-30T20:30:00Z
- **Completed:** 2026-05-30T20:55:00Z
- **Tasks:** 2 (TDD: RED + GREEN + test updates)
- **Files modified:** 2

## Accomplishments
- Custom domain creation now uses `status: :pending, verified: false` — the `before_create :generate_verification_token` callback auto-sets the token, completing the D-08 lifecycle entry point
- `destroy` action handles pending domains with immediate `decommission!` (no phase-out step needed since pending domains have no live traffic)
- `index` and `mutation_payload` both use `.routable.or(.status_pending)` so pending domains appear in all domain listings
- Removed old `slot_block_response` check and `old_active_custom&.phase_out!` from `custom` action — pending domains do not occupy phase-out slots
- Updated existing tests that asserted `status: "active"` to assert `status: "pending"` and updated coexistence test

## Task Commits

TDD cycle (RED -> GREEN -> test update):

1. **RED — failing tests for D-08** - `8453394` (test)
2. **GREEN — controller implementation** - `8b8ba13` (feat)
3. **Task 2 — updated existing tests + new tests** - `8829a32` (test)

## Files Created/Modified
- `backend/app/controllers/v1/admin/domains_controller.rb` - Updated custom action (D-08 pending), added pending branch in destroy, updated index + mutation_payload scope
- `backend/test/integration/admin_domains_test.rb` - Updated 2 existing tests, added 4 new D-08 tests

## Decisions Made
- Removed `slot_block_response(:custom)` from creation path: pending domains do not occupy phase-out slots and multiple pending domains can coexist. Slot checks remain on the destroy path for active->phase_out transitions.
- Old active custom domains are NOT phased out when a new custom domain is added (D-08 coexistence). Previously the action phased out the old active custom; with pending flow this is no longer appropriate.
- `mutation_payload` uses `or` scope rather than combining scopes with `where` to preserve ARel composability.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed slot_block_response from custom action**
- **Found during:** Task 1 (controller implementation)
- **Issue:** The plan's action template removed `slot_block_response`, but also implicitly removed `old_active_custom&.phase_out!`. The existing test "phases out existing active custom domain" would fail because the action no longer phases out existing customs.
- **Fix:** Updated the test to assert the new D-08 coexistence behavior: old active domain stays active, new domain goes pending. This is correct D-08 behavior — the plan confirms "Multiple pending domains can coexist."
- **Files modified:** test/integration/admin_domains_test.rb
- **Verification:** Tests pass with new assertions
- **Committed in:** 8829a32

---

**Total deviations:** 1 auto-fixed (Rule 1 - test expectation aligned with D-08 coexistence behavior)
**Impact on plan:** Necessary alignment. The old "phases out existing custom" test reflected pre-D-08 behavior. No scope creep.

## Issues Encountered

**Pre-existing DMOD-11 test failure (not caused by this plan):**
Test `PATCH /v1/admin/domains/subdomain includes phase_out_warning when post-action count == 2` was failing before this plan started (1 failure at baseline). It tests the subdomain action's warning logic and is unrelated to D-08 changes. Not fixed here — deferred.

## Known Stubs

None — all behavior is wired. Pending domains show in listings; the `DomainVerificationJob` (Plan 22-05) will promote them to active after CNAME verification.

## Threat Flags

None — no new network endpoints or trust boundaries introduced. The existing POST /v1/admin/domains/custom threat model (T-22-08: accept, T-22-09: accept) covers the pending creation behavior as designed.

## Next Phase Readiness
- Plan 22-05 (DomainVerificationJob) can now pick up `status: :pending` domains created by D-08
- Phase 24 UI can show `pending` status from both `GET /v1/admin/domains` and mutation responses
- Pre-existing DMOD-11 subdomain phase_out_warning test still failing — should be investigated before Phase 23

---
*Phase: 22-dns-verification-health-monitoring-backend*
*Completed: 2026-05-30*
