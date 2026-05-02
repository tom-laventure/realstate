---
phase: 01-security-foundation
plan: "04"
subsystem: backend-security
tags: [security, sql-injection, rbac, enum, rails, pagination, logging]

# Dependency graph
requires:
  - 01-02: "V1::Admin::BaseController with Current.user — InvitationsController inherits it; Current.user available after this plan"
provides:
  - "Group model with SQL injection path (dead methods) removed"
  - "InvitationsController using Current.user throughout, per_page capped at 100"
  - "FilterSetsController#create GroupEstate cleanup group-scoped"
  - "BrokerageBoardCredential with enum :status (prefix: :credential)"
  - "BrokerageAuth domain resolution logged at debug level"
  - "Pagination concern removed; ApplicationController is empty"
affects:
  - "All /v1/admin/** endpoints (invitations, filter_sets)"
  - "BrokerageBoardCredential queries (credential_active?, credential_invalid? predicates)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rails 7.1 enum positional API: use prefix: (not _prefix:) when calling enum :name, values, prefix: :foo"
    - "Per-page cap: items = per_page.positive? ? [per_page, 100].min : 10"
    - "Group-scoped GroupEstate cleanup: GroupEstate.where(group: @group, group_filter_set_id: id)"

key-files:
  created: []
  modified:
    - backend/app/models/group.rb
    - backend/app/controllers/v1/admin/invitations_controller.rb
    - backend/app/controllers/v1/admin/group/filter_sets_controller.rb
    - backend/app/models/brokerage_board_credential.rb
    - backend/app/controllers/concerns/brokerage_auth.rb
    - backend/app/controllers/application_controller.rb
  deleted:
    - backend/app/controllers/concerns/pagination.rb

key-decisions:
  - "D-15: Rails 7.1 enum positional API uses prefix: (no underscore), not _prefix: — _prefix: is silently ignored and causes invalid? conflict with AR built-in"
  - "D-16: BrokerageBoardCredential enum uses prefix: :credential to namespace predicates (credential_active?, credential_invalid?) — avoids conflict with AR's built-in invalid? method"
  - "D-17: Pagination concern deleted — ApplicationController is now empty; all pagination done via Pagy::Backend included in BaseController"

requirements-completed:
  - SEC-05
  - SEC-06
  - SEC-07
  - PERF-03
  - DEBT-03
  - DEBT-06
  - DEBT-07

# Metrics
duration: 8min
completed: "2026-05-01"
---

# Phase 1 Plan 04: Bug Fixes and Security Debt Summary

**SEC-05/06/07 + four debt items resolved: SQL injection path removed from Group, current_user crash fixed in InvitationsController, GroupEstate cleanup scoped to group, BrokerageBoardCredential enum added, domain logging lowered to debug, Pagination concern deleted**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-01T00:00:00Z
- **Completed:** 2026-05-01T00:08:00Z
- **Tasks:** 2
- **Files modified:** 6 (1 deleted, 5 modified — backend sub-repo)

## Accomplishments

- SEC-05: Removed 4 dead Group model methods (`order_estates`, `estates_ordered_by_avg_rating`, `estates_ordered_by_user_rating`, `estates_ordered_by_created_at`) — eliminated `#{user.id}` SQL injection interpolation path
- SEC-06: Replaced both `current_user` occurrences in InvitationsController with `Current.user` — fixes nil crash when Cognito JWT is absent
- PERF-03 (partial): InvitationsController per_page now capped at `[per_page, 100].min` — abusive large-page requests rejected
- SEC-07: FilterSetsController#create GroupEstate cleanup now scoped with `group: @group` — prevents cross-group estate deletion
- DEBT-03: BrokerageBoardCredential string inclusion validation replaced with `enum :status, {active: "active", invalid: "invalid"}, prefix: :credential`
- DEBT-06: BrokerageAuth domain resolution logging lowered from `logger.info` to `logger.debug` — domain names no longer appear in production log aggregation at info level
- DEBT-07: `Pagination` concern file deleted; `include Pagination` removed from ApplicationController — dead code eliminated
- Rails boots cleanly; `BrokerageBoardCredential.statuses` returns `{"active"=>"active", "invalid"=>"invalid"}`

## Task Commits

Each task was committed atomically to the backend sub-repo:

1. **Task 1: Remove dead Group methods (SEC-05), fix InvitationsController (SEC-06), cap per_page (PERF-03)** - `5b59a61` (fix)
2. **Task 2: Scope FilterSets cleanup (SEC-07), add enum (DEBT-03), lower log level (DEBT-06), remove Pagination concern (DEBT-07)** - `3662a36` (fix)
3. **Fix: Correct enum prefix syntax for Rails 7.1** - `35f2329` (fix — auto-fix deviation)

## Files Created/Modified

- `backend/app/models/group.rb` — Dead ordering methods removed; no more SQL injection path
- `backend/app/controllers/v1/admin/invitations_controller.rb` — `current_user` replaced with `Current.user` at both call sites; per_page capped at 100
- `backend/app/controllers/v1/admin/group/filter_sets_controller.rb` — GroupEstate.where in create action now group-scoped with `group: @group`
- `backend/app/models/brokerage_board_credential.rb` — `enum :status, {active: "active", invalid: "invalid"}, prefix: :credential` replaces string inclusion validation
- `backend/app/controllers/concerns/brokerage_auth.rb` — `logger.info` changed to `logger.debug` for domain resolution log
- `backend/app/controllers/application_controller.rb` — `include Pagination` removed; class is now empty
- `backend/app/controllers/concerns/pagination.rb` — DELETED

## Decisions Made

- D-15: Rails 7.1 enum positional API uses `prefix:` (no underscore prefix), not `_prefix:` — the `_prefix:` keyword argument is silently ignored when using the positional form `enum :name, values, **opts` and passes through to `_enum` which expects `prefix:`
- D-16: Used `prefix: :credential` to namespace the generated predicate methods as `credential_active?` and `credential_invalid?` — avoids conflict with ActiveRecord's built-in `invalid?` method (which is in `dangerous_attribute_methods`)
- D-17: Pagination concern fully removed — it was dead code after Pagy was adopted; `ApplicationController` is now empty (the correct state)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rails 7.1 enum prefix option syntax mismatch**
- **Found during:** Task 2 (Add BrokerageBoardCredential enum)
- **Issue:** Initial enum declaration `enum :status, {active: "active", invalid: "invalid"}, _prefix: :credential` failed with `ArgumentError: ...will generate a instance method 'invalid?', which is already defined by Active Record`. With the positional Rails 7.1 API, `_prefix:` is silently ignored (it's transformed by the old hash-based API path), and `prefix:` must be used directly. Without prefix, the `invalid?` predicate conflicts with AR's built-in `dangerous_attribute_methods` list.
- **Fix:** Changed `_prefix: :credential` to `prefix: :credential` — generates `credential_active?` and `credential_invalid?` predicates, avoiding the conflict.
- **Files modified:** `backend/app/models/brokerage_board_credential.rb`
- **Verification:** `bundle exec rails runner "puts BrokerageBoardCredential.statuses.inspect"` returns `{"active"=>"active", "invalid"=>"invalid"}`
- **Committed in:** `35f2329` (separate fix commit after task commit 3662a36)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** The fix was necessary for correctness — the enum would have crashed on model load in production. The fix adds `prefix: :credential` scoping which is a minor but intentional naming choice documented as D-16.

## Issues Encountered

- Rails 7.1 enum API has two dispatch paths (`enum :name, values` positional vs `enum name: values` hash). The underscore-prefixed options (`_prefix:`, `_suffix:`) only apply to the hash-based legacy API. The positional API introduced in Rails 7.0+ uses the clean names (`prefix:`, `suffix:`). This is documented as D-15 for future reference.

## Known Stubs

None.

## Threat Flags

None — all threat surface changes (removing SQL injection, scoping GroupEstate, fixing auth) were in the plan's threat model (T-04-01 through T-04-05).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 7 SEC/PERF/DEBT items from this plan resolved
- Group model is clean — no dead code, no SQL injection path
- InvitationsController is fully Current.user-based — consistent with BaseController auth chain
- BrokerageBoardCredential now has proper enum — can use scopes (`.credential_active`, `.credential_invalid`) and predicates (`credential_active?`, `credential_invalid?`)
- ApplicationController is clean — Pagination dead code gone
- Ready for Plan 01-05

---
*Phase: 01-security-foundation*
*Completed: 2026-05-01*

## Self-Check: PASSED

- FOUND: backend/app/models/group.rb (dead methods removed — grep returns 0)
- FOUND: backend/app/controllers/v1/admin/invitations_controller.rb (current_user count = 0)
- FOUND: backend/app/controllers/v1/admin/group/filter_sets_controller.rb (group: @group, group_filter_set_id: at line 57)
- FOUND: backend/app/models/brokerage_board_credential.rb (enum :status with prefix: :credential at line 10)
- VERIFIED: backend/app/controllers/concerns/pagination.rb — does not exist (DELETED)
- VERIFIED: backend/app/controllers/application_controller.rb — no include Pagination
- VERIFIED: [per_page, 100].min in invitations_controller.rb — 1 match
- VERIFIED: bundle exec rails runner "puts BrokerageBoardCredential.statuses.inspect" returns {"active"=>"active", "invalid"=>"invalid"}
- FOUND: backend commit 5b59a61 (Task 1)
- FOUND: backend commit 3662a36 (Task 2)
- FOUND: backend commit 35f2329 (Auto-fix: enum prefix syntax)
