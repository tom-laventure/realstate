---
phase: 01-security-foundation
plan: "02"
subsystem: backend-auth
tags: [rbac, admin, base-controller, cognito, brokerage-auth, security]

# Dependency graph
requires:
  - 01-01 (rack-attack + solid_cache installed — not directly needed but wave ordering)
provides:
  - V1::Admin::BaseController with require_admin! and require_owner!
  - All 13 admin controllers enforce BrokerageMembership role before any action
  - SEC-01 RBAC enforcement gap closed
affects:
  - 01-03 (rack_attack.rb initializer — admin controllers are now secured)
  - All /v1/admin/** endpoints

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin RBAC: centralize auth concerns in V1::Admin::BaseController; individual controllers inherit and skip/override as needed"
    - "before_action ordering: include BrokerageAuth (registers resolve_brokerage) → include CognitoAuth → authenticate_cognito_user! → require_admin!"
    - "Owner-only actions: skip_before_action :require_admin!, only: [...] + before_action :require_owner!, only: [...]"

key-files:
  created:
    - backend/app/controllers/v1/admin/base_controller.rb
  modified:
    - backend/app/controllers/v1/admin/activity_controller.rb
    - backend/app/controllers/v1/admin/board_credentials_controller.rb
    - backend/app/controllers/v1/admin/boards_controller.rb
    - backend/app/controllers/v1/admin/brokerages_controller.rb
    - backend/app/controllers/v1/admin/domains_controller.rb
    - backend/app/controllers/v1/admin/estates_controller.rb
    - backend/app/controllers/v1/admin/groups_controller.rb
    - backend/app/controllers/v1/admin/invitations_controller.rb
    - backend/app/controllers/v1/admin/users_controller.rb
    - backend/app/controllers/v1/admin/group/estates_controller.rb
    - backend/app/controllers/v1/admin/group/filter_sets_controller.rb
    - backend/app/controllers/v1/admin/group/invitations_controller.rb
    - backend/app/controllers/v1/admin/group/users_controller.rb

key-decisions:
  - "D-01: V1::Admin::BaseController namespace matches directory path v1/admin/base_controller.rb for Rails autoloading"
  - "D-02: include BrokerageAuth before CognitoAuth — BrokerageAuth included do block registers resolve_brokerage; must run before authenticate_cognito_user! so Current.brokerage is set"
  - "D-03: require_admin! checks BrokerageMembership role against %w[owner admin] — agents, staff, clients receive 403"
  - "D-04: BrokeragesController update/destroy and DomainsController create/destroy use skip+require_owner! pattern — admins cannot modify brokerage/domain structural config"
  - "D-14: InvitationsController skip_before_action pattern — accept_invitation/decline_invitation require valid JWT but no admin check; validate_token is fully public (email link access)"

requirements-completed:
  - SEC-01

# Metrics
duration: 2min
completed: "2026-05-02"
---

# Phase 1 Plan 02: Admin RBAC BaseController Summary

**V1::Admin::BaseController created with require_admin!/require_owner! enforcing BrokerageMembership role; all 13 admin controllers updated to inherit it — SEC-01 RBAC enforcement gap closed**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-02T01:16:30Z
- **Completed:** 2026-05-02T01:18:08Z
- **Tasks:** 2
- **Files modified:** 14 (1 created, 13 modified — backend sub-repo)

## Accomplishments

- `V1::Admin::BaseController` created with `require_admin!` and `require_owner!` private methods
- Before-action chain established: `resolve_brokerage` → `authenticate_cognito_user!` → `require_admin!`
- All 13 admin controllers updated: `< ApplicationController` → `< V1::Admin::BaseController`
- All inline `include CognitoAuth`, `include BrokerageAuth`, `include Pagy::Backend`, `before_action :authenticate_cognito_user!` removed from 13 controllers
- BrokeragesController: `update` and `destroy` require owner role (D-04)
- DomainsController: `create` and `destroy` require owner role (D-04)
- InvitationsController: `accept_invitation`, `decline_invitation` skip require_admin! (valid JWT, no admin check); `validate_token` skips both authenticate and require_admin! (fully public) (D-14)
- Rails boots without errors: `bundle exec rails runner "puts 'ok'"` prints `ok`

## Task Commits

Each task committed atomically to the backend sub-repo:

1. **Task 1: Create V1::Admin::BaseController** - `8068689` (feat)
2. **Task 2: Update all 13 admin controllers to inherit V1::Admin::BaseController** - `70882ce` (feat)

## Files Created/Modified

- `backend/app/controllers/v1/admin/base_controller.rb` — Created: V1::Admin::BaseController with include BrokerageAuth/CognitoAuth/Pagy::Backend, before_actions, require_admin!, require_owner!
- `backend/app/controllers/v1/admin/activity_controller.rb` — Inherits BaseController; inline includes/before_action removed
- `backend/app/controllers/v1/admin/board_credentials_controller.rb` — Inherits BaseController; inline includes/before_action removed
- `backend/app/controllers/v1/admin/boards_controller.rb` — Inherits BaseController; inline includes/before_action removed
- `backend/app/controllers/v1/admin/brokerages_controller.rb` — Inherits BaseController; skip+require_owner! for :update/:destroy
- `backend/app/controllers/v1/admin/domains_controller.rb` — Inherits BaseController; skip+require_owner! for :create/:destroy
- `backend/app/controllers/v1/admin/estates_controller.rb` — Inherits BaseController; inline includes/before_action removed
- `backend/app/controllers/v1/admin/groups_controller.rb` — Inherits BaseController; inline includes/before_action removed
- `backend/app/controllers/v1/admin/invitations_controller.rb` — Inherits BaseController; two skip_before_action declarations per D-14
- `backend/app/controllers/v1/admin/users_controller.rb` — Inherits BaseController; inline includes/before_action removed
- `backend/app/controllers/v1/admin/group/estates_controller.rb` — Inherits BaseController; inline includes/before_action removed
- `backend/app/controllers/v1/admin/group/filter_sets_controller.rb` — Inherits BaseController; inline includes/before_action removed
- `backend/app/controllers/v1/admin/group/invitations_controller.rb` — Inherits BaseController; inline includes/before_action removed
- `backend/app/controllers/v1/admin/group/users_controller.rb` — Inherits BaseController; inline includes/before_action removed

## Decisions Made

- D-01: BaseController class name `V1::Admin::BaseController` matches directory path for Rails autoloading
- D-02: `include BrokerageAuth` comes before `include CognitoAuth` — BrokerageAuth's `included do` block registers `before_action :resolve_brokerage`; guarantees `Current.brokerage` is set before `require_admin!` reads it
- D-03: `require_admin!` checks `BrokerageMembership.role` against `%w[owner admin]` — agent/staff/client roles receive 403 JSON response
- D-04: Owner-only actions use `skip_before_action :require_admin!, only: [...]` + `before_action :require_owner!, only: [...]` pattern
- D-14: InvitationsController public actions (accept/decline/validate_token) are carved out via skip_before_action; validate_token is fully public by design (invitee accesses from email link without account)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — all new surface was already in the plan's threat model (T-02-01 through T-02-05).

---
*Phase: 01-security-foundation*
*Completed: 2026-05-02*

## Self-Check: PASSED

- FOUND: backend/app/controllers/v1/admin/base_controller.rb
- VERIFIED: `grep -c "class BaseController < ApplicationController"` = 1
- VERIFIED: `grep -c "def require_admin!"` = 1, `grep -c "def require_owner!"` = 1
- VERIFIED: `grep -rL "V1::Admin::BaseController" app/controllers/v1/admin/` returns no controller files (all 13 updated)
- VERIFIED: `grep -rn "include CognitoAuth\|include BrokerageAuth" app/controllers/v1/admin/` returns no matches
- VERIFIED: BrokeragesController skip+require_owner! for :update/:destroy present
- VERIFIED: DomainsController skip+require_owner! for :create/:destroy present
- VERIFIED: InvitationsController both D-14 skip_before_action lines present
- VERIFIED: `bundle exec rails runner "puts 'ok'"` prints `ok`
- FOUND: backend commit 8068689 (Task 1)
- FOUND: backend commit 70882ce (Task 2)
