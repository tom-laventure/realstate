---
phase: 22-dns-verification-health-monitoring-backend
plan: "03"
subsystem: api
tags: [rails, activerecord, actionmailer, minitest, factory_bot, http-basic-auth]

requires:
  - phase: 22-01
    provides: "BrokerageDomain status enum with frozen value, domain_type_custom/subdomain scopes, status_active/frozen scopes"
  - phase: 22-02
    provides: "DomainMailer.downgrade_notice(brokerage) method for email dispatch in controller"

provides:
  - "Brokerage#freeze_custom_domains! atomically freezes active/pending/phasing_out custom domains and promotes subdomain to primary (no email dispatch)"
  - "Brokerage#unfreeze_custom_domains! restores frozen+verified to active and frozen+unverified to pending (DPRD-06)"
  - "Ops::PlanController JSON endpoint at POST /ops/brokerages/:brokerage_id/plan"
  - "DomainMailer.downgrade_notice dispatched by controller after transaction commits (DPRD-05)"
  - "9 model tests and 5 integration tests covering freeze/unfreeze behavior, round-trips, email dispatch, auth, 404"

affects:
  - "22-04-dns-verification-job"
  - "22-05-domain-health-job"
  - "billing-webhook-v2"

tech-stack:
  added: []
  patterns:
    - "Email dispatch separation: model service methods are mailer-free; controller dispatches email after transaction commits"
    - "ActiveModel::Type::Boolean.new.cast(params[:freeze]) for safe boolean coercion from HTTP params"
    - "alias_method :create, :update in Ops controllers to support POST alongside PATCH/PUT without duplicate action code"
    - "skip_before_action :verify_authenticity_token, raise: false for JSON ops endpoints inheriting from BaseController with CSRF enabled"

key-files:
  created:
    - "backend/app/controllers/ops/plan_controller.rb"
    - "backend/test/models/brokerage_freeze_test.rb"
    - "backend/test/integration/ops_plan_test.rb"
  modified:
    - "backend/app/models/brokerage.rb"
    - "backend/config/routes.rb"

key-decisions:
  - "Email dispatch (DPRD-05) moved to Ops::PlanController after freeze_custom_domains! returns — model method is testable without mailer dependency and email is guaranteed to send only after DB transaction commits"
  - "unfreeze_custom_domains! uses verified flag (not original status) to determine restore target — verified:true -> active, verified:false -> pending — avoids needing to track pre-freeze status"
  - "alias_method :create, :update enables POST route alongside PATCH/PUT with a single action implementation"
  - "TDD flow: wrote 9 failing model tests first (RED commit d91b2e6), then implemented methods (GREEN commit 983477a)"

patterns-established:
  - "Brokerage service methods: keep model methods free of mailer calls; let the caller (controller or job) dispatch email after the transaction"
  - "Ops JSON endpoints: inherit Ops::BaseController, skip_before_action :verify_authenticity_token with raise: false, alias :create to :update for POST support"

requirements-completed:
  - DPRD-01
  - DPRD-03
  - DPRD-05
  - DPRD-06

duration: 15min
completed: "2026-05-30"
---

# Phase 22 Plan 03: Pro Plan Freeze/Unfreeze Infrastructure Summary

**Brokerage service methods freeze_custom_domains! and unfreeze_custom_domains! with atomic domain state transitions plus Ops::PlanController JSON endpoint dispatching DomainMailer.downgrade_notice after transaction commits**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-30T20:10:00Z
- **Completed:** 2026-05-30T20:25:00Z
- **Tasks:** 2 (Task 1 TDD: 2 commits; Task 2: 1 commit)
- **Files modified:** 5

## Accomplishments

- `Brokerage#freeze_custom_domains!` wraps all custom domain status transitions in a single `ApplicationRecord.transaction`: freezes active/pending/phasing_out custom domains, clears all primary flags, promotes first active subdomain to primary (DPRD-01, DPRD-03)
- `Brokerage#unfreeze_custom_domains!` selectively restores frozen custom domains based on `verified` flag: `verified:true` -> active, `verified:false` -> pending (DPRD-06); does not touch `is_primary`
- `Ops::PlanController` at `POST /ops/brokerages/:brokerage_id/plan` — HTTP Basic auth inherited, CSRF skipped, dispatches `DomainMailer.downgrade_notice` after freeze (DPRD-05), returns JSON
- 9 model tests pass (freeze/unfreeze/round-trip/email-guard/primary-promotion); 5 integration tests pass (freeze+email, unfreeze-verified, unfreeze-pending-round-trip, 401 without auth, 404 unknown brokerage)

## Task Commits

Each task was committed atomically (backend/ sub-repo):

1. **Task 1 RED: Failing tests for freeze_custom_domains! and unfreeze_custom_domains!** - `d91b2e6` (test)
2. **Task 1 GREEN: Implement freeze_custom_domains! and unfreeze_custom_domains! on Brokerage** - `983477a` (feat)
3. **Task 2: Add Ops::PlanController and POST /ops/brokerages/:id/plan route** - `bd4e061` (feat)

## Files Created/Modified

- `backend/app/models/brokerage.rb` - Added freeze_custom_domains! (transactional, no mailer) and unfreeze_custom_domains! (verified-flag based) methods
- `backend/app/controllers/ops/plan_controller.rb` - JSON ops endpoint with CSRF skip, HTTP Basic auth, DomainMailer dispatch on freeze
- `backend/config/routes.rb` - Added `resource :plan, only: [:update, :create], controller: "plan"` nested under ops brokerages
- `backend/test/models/brokerage_freeze_test.rb` - 9 model tests (RED then GREEN)
- `backend/test/integration/ops_plan_test.rb` - 5 integration tests

## Decisions Made

- Email dispatch lives in the controller, not the model. This means: (1) `freeze_custom_domains!` is testable without a mailer dependency, (2) the email goes out only after the DB transaction has committed — no orphaned emails if the transaction rolls back.
- `unfreeze_custom_domains!` determines restore target from the `verified` column rather than tracking the pre-freeze status. This works because the invariant is enforced by `status_requires_verified` validation: only verified domains can reach `active` status, so `verified:true` on a frozen domain means it was previously active.
- `alias_method :create, :update` allows the route to expose POST (via `:create`) in addition to PATCH/PUT (via `:update`) without duplicating action logic.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `PG::ObjectInUse` transient warning on `rails test` startup (pre-existing issue also seen in plan 22-02). The test runner retried and all tests ran to completion. Not introduced by this plan.

## User Setup Required

None - no external service configuration required. The ops endpoint uses `OPS_USERNAME` and `OPS_PASSWORD` environment variables already set in production.

## Known Stubs

None. Both service methods fully implemented with real `update_all` calls and real domain scopes. Controller dispatches real DomainMailer. No placeholder data.

## Threat Flags

No new security-relevant surface beyond the plan's threat model.
- T-22-05 (Spoofing): HTTP Basic auth inherited from `Ops::BaseController` — mitigated.
- T-22-06 (Tampering): `ActiveModel::Type::Boolean.new.cast(params[:freeze])` coerces safely — mitigated.
- T-22-07 (CSRF skip on ops endpoint): Endpoint is HTTP Basic auth only (no cookie session); CSRF skip is safe — accepted.

## Next Phase Readiness

- `freeze_custom_domains!` and `unfreeze_custom_domains!` are ready for billing webhook integration (v2)
- `Ops::PlanController` ready for manual testing of freeze/unfreeze via curl or ops UI
- DomainMailer.downgrade_notice wired and verified via integration test

---
*Phase: 22-dns-verification-health-monitoring-backend*
*Completed: 2026-05-30*
