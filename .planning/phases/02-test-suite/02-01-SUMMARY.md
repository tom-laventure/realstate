---
phase: 02-test-suite
plan: "01"
subsystem: testing
tags: [minitest, factory_bot, shoulda-matchers, jwt, ruby4]

# Dependency graph
requires: []
provides:
  - factory_bot_rails 6.5.1 and shoulda-matchers 7.0.1 installed in :development,:test group
  - test/test_helper.rb with AuthHelper (mints real HS256 JWT via TokenService.issue)
  - Current.reset teardown in ActiveSupport::TestCase
  - ActionDispatch::IntegrationTest includes AuthHelper
  - Shoulda::Matchers configured for minitest + rails
  - 10 factory files covering User, Brokerage, BrokerageDomain, BrokerageMembership, Group, Estate, ListingDetail, GroupEstate, GroupFilterSet, Invitation
affects: [02-02, 02-03, 02-04, 02-05, 02-06]

# Tech tracking
tech-stack:
  added: [factory_bot_rails ~> 6.5, shoulda-matchers ~> 7.0]
  patterns:
    - AuthHelper mints JWT by setting Current.brokerage before TokenService.issue call and resets in ensure
    - Factory traits use do..end syntax (not inline braces) — required for Ruby 4.0 strict method-call parsing
    - FactoryBot sequences use SecureRandom.hex(4) suffix for uniqueness beyond counter (cognito_sub, uid, group uid)

key-files:
  created:
    - backend/test/test_helper.rb
    - backend/test/factories/users.rb
    - backend/test/factories/brokerages.rb
    - backend/test/factories/brokerage_domains.rb
    - backend/test/factories/brokerage_memberships.rb
    - backend/test/factories/groups.rb
    - backend/test/factories/estates.rb
    - backend/test/factories/listing_details.rb
    - backend/test/factories/group_estates.rb
    - backend/test/factories/group_filter_sets.rb
    - backend/test/factories/invitations.rb
  modified:
    - backend/Gemfile
    - backend/Gemfile.lock

key-decisions:
  - "02-01: Factory traits use do..end blocks — Ruby 4.0 raises SyntaxError on inline brace syntax after bare method call (trait :owner { role { 'owner' } } is ambiguous)"
  - "02-01: AuthHelper resets Current in ensure block (not only teardown) — guards against JWT-minting side effects leaking into assertion phase"

patterns-established:
  - "Ruby 4.0 factory traits: always use do..end, never inline braces for trait blocks containing attribute definitions"
  - "AuthHelper pattern: set Current.brokerage + Current.user before TokenService.issue, always reset in ensure"

requirements-completed: [TEST-01]

# Metrics
duration: 2min
completed: 2026-05-02
---

# Phase 2 Plan 01: Backend Test Infrastructure Summary

**factory_bot_rails 6.5 + shoulda-matchers 7.0 installed; test_helper.rb with AuthHelper JWT minting and Current.reset teardown; 10 factories covering all Phase 2 models — FactoryBot.lint passes**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-02T23:33:32Z
- **Completed:** 2026-05-02T23:36:12Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Installed factory_bot_rails 6.5.1 and shoulda-matchers 7.0.1 in the backend Gemfile
- Created test_helper.rb with AuthHelper (JWT via TokenService.issue with Current.brokerage guard), Current.reset teardown, and Shoulda::Matchers configuration
- Created 10 factory files covering every model touched by Phase 2 integration tests; FactoryBot.lint passes with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add gems and configure test_helper.rb** - `d8d51db` (chore)
2. **Task 2: Create 10 factory files** - `449c9af` (feat)

**Plan metadata:** *(see final commit below)*

## Files Created/Modified
- `backend/Gemfile` - Added factory_bot_rails ~> 6.5 and shoulda-matchers ~> 7.0 to :development,:test group
- `backend/Gemfile.lock` - Updated lock after bundle install
- `backend/test/test_helper.rb` - AuthHelper module, Current.reset teardown, Shoulda::Matchers config
- `backend/test/factories/users.rb` - email/cognito_sub/uid sequences with SecureRandom suffix
- `backend/test/factories/brokerages.rb` - name sequence
- `backend/test/factories/brokerage_domains.rb` - domain sequence
- `backend/test/factories/brokerage_memberships.rb` - role default + :owner/:admin/:agent/:client traits
- `backend/test/factories/groups.rb` - name/uid sequences, active default
- `backend/test/factories/estates.rb` - link sequence
- `backend/test/factories/listing_details.rb` - price_numeric + sqft defaults
- `backend/test/factories/group_estates.rb` - group + estate associations
- `backend/test/factories/group_filter_sets.rb` - name sequence, active default
- `backend/test/factories/invitations.rb` - inviter association, SecureRandom token, 7-day expires_at

## Decisions Made

- **do..end for traits:** Ruby 4.0 enforces stricter parsing — inline brace syntax `trait :owner { role { "owner" } }` is a SyntaxError because Ruby 4.0 treats `role` as a method call and then rejects the adjacent `{ ... }` block. Fixed to `do..end` form.
- **AuthHelper ensure reset:** Current attributes are reset in the `ensure` block of `auth_headers_for` (not just in teardown) to prevent Current.brokerage/user from leaking into the test's assertion phase if the headers method is called mid-test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Ruby 4.0 SyntaxError in brokerage_memberships factory trait blocks**
- **Found during:** Task 2 (FactoryBot.lint run)
- **Issue:** Plan specified `trait :owner { role { "owner" } }` inline brace syntax, which is a SyntaxError in Ruby 4.0 — `role` is parsed as a method call and the subsequent `{ ... }` block is unexpected
- **Fix:** Rewrote all trait blocks using `do..end` syntax: `trait :owner do; role { "owner" }; end`
- **Files modified:** backend/test/factories/brokerage_memberships.rb
- **Verification:** `RAILS_ENV=test bundle exec rails runner "FactoryBot.lint; puts 'ALL OK'"` passes
- **Committed in:** 449c9af (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - syntax bug)
**Impact on plan:** Auto-fix necessary for Ruby 4.0 compatibility. No scope creep.

## Issues Encountered

- Ruby 4.0 strict method-call parsing rejected FactoryBot inline trait brace syntax from the plan. Fixed immediately with do..end syntax. No impact on functionality.

## User Setup Required

None - no external service configuration required.

## Self-Check: PASSED

All files verified present. Both task commits exist in backend repo (d8d51db, 449c9af).

## Next Phase Readiness

- All factory infrastructure ready for 02-02 through 02-06 integration tests
- `auth_headers_for(user, brokerage)` available in all ActionDispatch::IntegrationTest subclasses
- `FactoryBot.lint` green — all 10 factories confirmed working against test DB
- No blockers for subsequent plans in Wave 1

---
*Phase: 02-test-suite*
*Completed: 2026-05-02*
