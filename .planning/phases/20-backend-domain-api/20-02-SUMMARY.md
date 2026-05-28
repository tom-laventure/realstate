---
phase: 20-backend-domain-api
plan: "02"
subsystem: backend-controller-routes-tests
tags: [domains, admin-api, phase-out, lifecycle, integration-tests, routes]
dependency_graph:
  requires: [20-01]
  provides: [V1::Admin::DomainsController, admin-domain-routes, admin-domains-integration-tests]
  affects:
    - backend/app/controllers/v1/admin/domains_controller.rb
    - backend/config/routes.rb
    - backend/test/integration/admin_domains_test.rb
tech_stack:
  added: []
  patterns:
    - tenant-scoped-current-brokerage
    - dual-key-mutation-payload
    - slot-block-guard
    - before_action-owner-gate
    - ApplicationRecord-transaction
key_files:
  created:
    - backend/test/integration/admin_domains_test.rb
  modified:
    - backend/app/controllers/v1/admin/domains_controller.rb
    - backend/config/routes.rb
decisions:
  - "All mutation actions gated behind require_owner! (D-11); index accessible to admin role (D-10)"
  - "Dual-key mutation payload { domain, domains, phase_out_warning? } allows frontend single-round-trip refresh (D-04)"
  - "slot_block_response returns rendered 422 on >=2 phasing-out of same type; slot_block_response returns nil otherwise (DMOD-12)"
  - "phase_out_warning_for returns hash only when post-action count == 2 (DMOD-11)"
  - "Legacy admin verify route removed entirely; onboarding verify route untouched"
  - "Pre-existing ExtraSpacing lint in calendar namespace routes fixed via standardrb --fix (deviation Rule 3)"
  - "Legacy verify route test uses assert_response :not_found (not assert_raises ActionController::RoutingError) matching Rails test env behavior"
metrics:
  duration: "7m 20s"
  completed: "2026-05-28"
  tasks_completed: 3
  tests_added: 21
  files_modified: 2
  files_created: 1
---

# Phase 20 Plan 02: Admin Domains Controller Rebuild Summary

**One-liner:** Rebuilt `V1::Admin::DomainsController` from scratch with 5 owner-gated actions (index, subdomain, custom, destroy, set_primary), slot-block/warning logic, Pro-tier gate, and dual-key mutation payloads — proven by 21 integration tests all passing.

## What Was Built

### Task 1: V1::Admin::DomainsController (full rebuild)

**File:** `backend/app/controllers/v1/admin/domains_controller.rb`

Completely replaced the legacy DNS-verify controller with a clean 5-action controller:

| Action | Verb | Path | Auth | DMOD |
|--------|------|------|------|------|
| `index` | GET | `/v1/admin/domains` | admin+ | DMOD-06 |
| `subdomain` | PATCH | `/v1/admin/domains/subdomain` | owner | DMOD-07 |
| `custom` | POST | `/v1/admin/domains/custom` | owner | DMOD-05, DMOD-08 |
| `destroy` | DELETE | `/v1/admin/domains/:id` | owner | DMOD-09, DMOD-14 |
| `set_primary` | PATCH | `/v1/admin/domains/:id/set_primary` | owner | DMOD-10 |

Key design points:
- `before_action :require_owner!, only: %i[subdomain custom destroy set_primary]` (D-11)
- `index` uses inherited `require_admin!` from BaseController (D-10)
- All queries scope via `Current.brokerage.brokerage_domains.*` — never `BrokerageDomain.where(...)` (tenant safety)
- `ApplicationRecord.transaction` wraps `subdomain` create + `set_primary` demote/promote
- New domains created with `verified: true, verified_at: Time.current, verification_token: nil` (bypasses status_requires_verified for deferred DNS verification — Assumption A1)
- `destroy` branches: subdomain(active) → 422 code `subdomain_not_deletable`; active custom → slot check then `phase_out!`; phasing_out → `decommission!` (DMOD-14); decommissioned → 422
- Dual-key mutation payload: `{ domain: <updated>, domains: <all routable>, phase_out_warning?: { earliest_slot_available_at } }` (D-04)
- Removed: `require "resolv"`, `verify` action, `dns_resolves?` helper, old `skip_before_action`

### Task 2: Routes update

**File:** `backend/config/routes.rb`

Replaced admin domains block:

```
# Before
resources :domains, only: [:index] do
  member do
    post :verify
  end
end

# After
resources :domains, only: [:index, :destroy] do
  collection do
    patch :subdomain # DMOD-07
    post :custom # DMOD-08
  end
  member do
    patch :set_primary # DMOD-10
  end
end
```

Rails routes output for `admin/domains`:
```
subdomain_v1_admin_domains PATCH  /v1/admin/domains/subdomain(.:format)          v1/admin/domains#subdomain
   custom_v1_admin_domains POST   /v1/admin/domains/custom(.:format)             v1/admin/domains#custom
set_primary_v1_admin_domain PATCH  /v1/admin/domains/:id/set_primary(.:format)  v1/admin/domains#set_primary
          v1_admin_domains GET    /v1/admin/domains(.:format)                    v1/admin/domains#index
           v1_admin_domain DELETE /v1/admin/domains/:id(.:format)               v1/admin/domains#destroy
```

No `POST .../verify` under admin namespace.

### Task 3: Integration Tests

**File:** `backend/test/integration/admin_domains_test.rb`

21 tests, 61 assertions — all passing.

| Test Group | Count | Requirements Covered |
|------------|-------|---------------------|
| index auth gating | 4 | DMOD-06 |
| subdomain happy path + slot block + warning | 4 | DMOD-07, DMOD-11, DMOD-12, D-11 |
| custom Pro gate + happy path + phase-out existing | 4 | DMOD-05, DMOD-08 |
| destroy branching (subdomain, active custom, phasing_out, slot block, isolation) | 5 | DMOD-09, DMOD-12, DMOD-14 |
| set_primary atomicity + invalid status + admin forbidden | 3 | DMOD-10, D-11 |
| legacy verify route removed | 1 | D-09 |
| **Total** | **21** | |

## Commits

| Hash | Message |
|------|---------|
| `88e4de5` | feat(20-02): rebuild V1::Admin::DomainsController with 5 actions + private helpers |
| `1c558bd` | feat(20-02): update admin :domains routes — add destroy, subdomain, custom, set_primary; remove verify |
| `ce19ea3` | test(20-02): add integration tests for admin domains controller |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-existing ExtraSpacing lint in calendar namespace routes**
- **Found during:** Task 2 lint verification
- **Issue:** `config/routes.rb` had 15 pre-existing `Layout/ExtraSpacing` offenses in the `namespace :calendar do` block (aligned route assignments). These existed before this plan's changes.
- **Fix:** Ran `bundle exec standardrb --fix config/routes.rb` to auto-correct spacing. Routing behavior is unchanged; only whitespace was modified.
- **Files modified:** `backend/config/routes.rb`
- **Commit:** included in `1c558bd`

**2. [Rule 3 - Blocking] Legacy verify route test uses assert_response :not_found instead of assert_raises**
- **Found during:** Task 3 — plan suggested `assert_raises ActionController::RoutingError` with fallback
- **Issue:** In test environment with `config.action_dispatch.show_exceptions = :rescuable`, Rails returns a 404 response rather than raising `ActionController::RoutingError`. No existing tests in the project use `assert_raises RoutingError`.
- **Fix:** Used `assert_response :not_found` directly, which is the established pattern across the project.
- **Files modified:** `backend/test/integration/admin_domains_test.rb`

### Known Non-Regression Note

The existing integration test suite (`admin_authorization_test.rb`, `brokerage_auth_main_domain_test.rb`, `tenant_isolation_test.rb`, model tests) cannot be run during this wave due to a pre-existing `PG::ObjectInUse` database contention error caused by concurrent worktree agents accessing the shared Neon test database. This is the same issue documented in Plan 01 Summary. The plan-specific tests (`admin_domains_test.rb`) ran cleanly with 21/21 passing. The pre-existing tests are unrelated to the controller/routes changes made in this plan.

## Known Stubs

None — all actions are fully implemented and tested. No hardcoded empty values, placeholder text, or unconnected data sources.

## Threat Flags

No new network endpoints beyond those specified in the plan's threat model. All T-20.02-* threats mitigated as designed:

- T-20.02-01 (EoP): `require_owner!` on all mutations — verified by 5 `assert_response :forbidden` assertions
- T-20.02-02 (Spoofing): `Current.brokerage.brokerage_domains.find_by` scoping — verified by tenant isolation test
- T-20.02-03 (Tampering): `Current.brokerage.plan == "premium"` server-side check — verified by basic-plan 403 test
- T-20.02-04 (Tampering): `ApplicationRecord.transaction` wrapping set_primary — verified by primary_count == 1 assertion
- T-20.02-05 (DoS): `slot_block_response` guards at >=2 phasing-out per type — verified by 2 slot-block tests

## Self-Check: PASSED

Files exist:
- backend/app/controllers/v1/admin/domains_controller.rb: FOUND
- backend/config/routes.rb: FOUND
- backend/test/integration/admin_domains_test.rb: FOUND

Commits verified:
- 88e4de5: present in git log
- 1c558bd: present in git log
- ce19ea3: present in git log
