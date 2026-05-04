---
phase: 03-onboarding-fixes
plan: 03
subsystem: api
tags: [onboarding, welcome-banner, backend, migration, acts-as-paranoid, brokerage-membership]

requires:
  - phase: 01-security-hardening
    provides: BrokerageMembership model, ProfileController with CognitoAuth + BrokerageAuth stack

provides:
  - welcomed_at datetime column on brokerage_memberships (soft-delete-aware)
  - deleted_at column + acts_as_paranoid on BrokerageMembership
  - POST /v1/account/profile/dismiss_welcome endpoint persisting banner dismissal per (user, brokerage)
  - show_welcome_banner boolean on UserSerializer profile response

affects: [03-04-frontend-welcome-banner, plan-04-google-oauth]

tech-stack:
  added: [acts_as_paranoid on BrokerageMembership]
  patterns: [singleton resource block route form for member-style actions on singular resources]

key-files:
  created:
    - backend/db/migrate/20260503000001_add_welcomed_at_to_brokerage_memberships.rb
  modified:
    - backend/db/schema.rb
    - backend/app/models/brokerage_membership.rb
    - backend/app/controllers/v1/account/profile_controller.rb
    - backend/config/routes.rb
    - backend/app/serializers/user_serializer.rb

key-decisions:
  - "D-14: welcomed_at added as nullable datetime; NULL = banner not yet dismissed; no backfill"
  - "D-15: dismiss_welcome uses BrokerageMembership.without_deleted.find_by! — soft-deleted memberships get 404, not a stale update"
  - "D-16: show_welcome_banner exposed as boolean only — raw welcomed_at timestamp not in payload (T-03-03-03 accept)"
  - "Deviation: BrokerageMembership lacked acts_as_paranoid — deleted_at column added in same migration to satisfy .without_deleted requirement"

patterns-established:
  - "Singular resource route block: `resource :profile, only: [...] do; post :dismiss_welcome; end` — canonical form for member-style POST on singular resource"
  - "BrokerageMembership.without_deleted.find_by! for all membership lookups"

requirements-completed: [ONB-03]

duration: 9min
completed: 2026-05-04
---

# Phase 3 Plan 03: Welcome Banner Backend Summary

**welcomed_at nullable datetime + acts_as_paranoid soft-delete on BrokerageMembership, dismiss_welcome POST endpoint, and show_welcome_banner boolean on profile serializer**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-04T00:02:02Z
- **Completed:** 2026-05-04T00:11:46Z
- **Tasks:** 3
- **Files modified:** 6 (backend sub-repo)

## Accomplishments

- Migration `20260503000001` adds `welcomed_at` datetime (and `deleted_at` + index for soft-delete) to `brokerage_memberships`; schema version advanced to `2026_05_03_000001`
- `POST /v1/account/profile/dismiss_welcome` sets `BrokerageMembership.welcomed_at = Time.current` for the current user/brokerage pair; 404 on missing or soft-deleted membership; idempotent
- `show_welcome_banner` boolean attribute on `UserSerializer` — true when `welcomed_at IS NULL`, false otherwise, safe fallback when `Current.brokerage` is nil

## Routes Added

```
bin/rails routes -g dismiss_welcome output:
                            Prefix Verb URI Pattern                                   Controller#Action
dismiss_welcome_v1_account_profile POST /v1/account/profile/dismiss_welcome(.:format) v1/account/profile#dismiss_welcome
```

Canonical route form used: `resource :profile, only: [:show, :update], controller: "profile" do; post :dismiss_welcome; end`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add welcomed_at migration + schema** - `260e9a1` (feat)
2. **Task 2: dismiss_welcome action + route** - `faaa7fd` (feat)
3. **Task 3: show_welcome_banner on UserSerializer** - `5dca6d1` (feat)

## Files Created/Modified

- `backend/db/migrate/20260503000001_add_welcomed_at_to_brokerage_memberships.rb` - Migration adding `welcomed_at`, `deleted_at`, and deleted_at index to `brokerage_memberships`
- `backend/db/schema.rb` - Schema regenerated with new columns; version `2026_05_03_000001`
- `backend/app/models/brokerage_membership.rb` - Added `acts_as_paranoid` to enable `.without_deleted` scope
- `backend/app/controllers/v1/account/profile_controller.rb` - `dismiss_welcome` action with `.without_deleted` lookup and `RecordNotFound` rescue
- `backend/config/routes.rb` - Converted profile resource to block form; `post :dismiss_welcome` inside
- `backend/app/serializers/user_serializer.rb` - `attribute :show_welcome_banner` + private method using `BrokerageMembership.without_deleted.find_by`

## Decisions Made

- D-14 implemented: `welcomed_at` is nullable with no default; NULL means banner has never been dismissed (shows banner on first load for all existing users)
- D-15 implemented: `.without_deleted` scope on membership lookup — soft-deleted memberships return 404 instead of re-setting their `welcomed_at`, satisfying threat T-03-03-07
- D-16 implemented: Only the derived boolean is exposed in the serializer, not the raw timestamp (T-03-03-03 accept disposition)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added acts_as_paranoid + deleted_at to BrokerageMembership**

- **Found during:** Task 1 (migration) + Task 2 (controller)
- **Issue:** The plan required `BrokerageMembership.without_deleted.find_by!` but the model had no `acts_as_paranoid` declaration and no `deleted_at` column. Calling `.without_deleted` on a model without acts_as_paranoid raises `NoMethodError` at runtime. The plan's context stated the model "has deleted_at (acts_as_paranoid)" — this was incorrect for the current schema.
- **Fix:** Migration `20260503000001` also adds `deleted_at :datetime` + index (in addition to `welcomed_at`); `BrokerageMembership` model updated with `acts_as_paranoid`
- **Files modified:** `backend/db/migrate/20260503000001_add_welcomed_at_to_brokerage_memberships.rb`, `backend/app/models/brokerage_membership.rb`
- **Verification:** `bin/rails runner "puts BrokerageMembership.respond_to?(:without_deleted)"` outputs `true`; all 17 backend tests pass (0 failures)
- **Committed in:** `260e9a1` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical functionality)

**Impact on plan:** The fix is required for the plan's acceptance criteria and threat model mitigations to hold. No scope creep — the plan explicitly described BrokerageMembership as having soft-delete support.

## Issues Encountered

None beyond the deviation above.

## Self-Check: PASSED

- `backend/db/migrate/20260503000001_add_welcomed_at_to_brokerage_memberships.rb` — FOUND
- `backend/db/schema.rb` with `welcomed_at` and version `2026_05_03_000001` — FOUND
- `backend/app/controllers/v1/account/profile_controller.rb` with `dismiss_welcome` + `without_deleted` — FOUND
- `backend/config/routes.rb` with `dismiss_welcome` — FOUND
- `backend/app/serializers/user_serializer.rb` with `show_welcome_banner` — FOUND
- Commits `260e9a1`, `faaa7fd`, `5dca6d1` — FOUND
- 17 backend tests: 0 failures, 0 errors

## Next Phase Readiness

- Frontend Plan 04 (`03-04`) can consume `show_welcome_banner` from `GET /v1/account/profile` response
- Frontend Plan 04 can `POST /v1/account/profile/dismiss_welcome` (no body required) to persist dismissal
- All backend pre-conditions for ONB-03 satisfied

---
*Phase: 03-onboarding-fixes*
*Completed: 2026-05-04*
