---
phase: 33-backend-owner-api-endpoint-lockdown
reviewed_by: claude-sonnet-5
reviewed_at: 2026-07-12
status: clean
files_reviewed: 7
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
---

# Phase 33 — Backend Owner API Endpoint Lockdown: Code Review

## Files Reviewed

1. `backend/app/controllers/v1/admin/invitations_controller.rb`
2. `backend/app/controllers/v1/admin/settings/owners_controller.rb`
3. `backend/app/controllers/v1/admin/users_controller.rb`
4. `backend/config/routes.rb`
5. `backend/test/integration/admin_owner_lockdown_test.rb`
6. `backend/test/integration/admin_settings_owners_test.rb`
7. `frontend/src/components/view/admin/brokerageView/addAgentView/AddAgentView.tsx`

---

## Verification of the Phase's Core Invariants

- **Fresh DB-backed role checks, not JWT claims:** `V1::Admin::BaseController#current_membership` (`backend/app/controllers/v1/admin/base_controller.rb:32-37`) queries `BrokerageMembership.without_deleted.find_by(user_id:, brokerage_id:)` fresh per request (memoized only within the request via `@current_membership`). `require_owner!`, `require_admin!`, and `require_agent_or_above!` all gate on this, and every controller in scope (`UsersController`, `InvitationsController`, `Settings::OwnersController`) relies exclusively on it. No code path in these files reads a role off `Current.user` or a JWT claim.
- **`.without_deleted` scoping:** Every membership lookup touched by this phase is correctly scoped — `UsersController#update`/`#destroy` (`user.brokerage_memberships.without_deleted.find_by(...)`), `Settings::OwnersController#create`/`#update`/`#index`/`#eligible` (`BrokerageMembership.without_deleted.where(...)`/`.find_by(...)`), and the last-owner COUNT guards in both controllers (`BrokerageMembership.without_deleted.where(brokerage_id:, role: "owner").count`). No joined-model scoping gaps found in the reviewed diff.
- **Last-owner invariant:** Enforced independently in two places, both correct: `UsersController#destroy` (blocks destroying an owner target when `owner_count <= 1`, only reachable after `require_owner!` passes) and `Settings::OwnersController#update` (blocks demoting when `owner_count <= 1`, which also transparently covers self-demotion/OWN-09 with no special-casing).
- **Owner-role assignment fully centralized:** `InvitationsController#create` rejects `role == "owner"` unconditionally (value-level, after the role passes the `AppConstants::BROKERAGE_ROLES` allowlist, so case-variant bypass like `"Owner"` is caught earlier as "Invalid role" rather than slipping through). `UsersController#update` rejects any transition where `role == "owner"` **or** `membership.role == "owner"`, forcing all ownership changes through `Settings::OwnersController`, which alone carries the last-owner guard and D-05 server-side re-validation of the target's current role (`unless %w[admin agent].include?(membership.role)`).
- **Routing:** `namespace :settings { resources :owners, only: [:index, :create, :update] { collection { get :eligible } } }` inside `namespace :admin` produces exactly the four expected routes, no stray public routes.
- **Test coverage:** `admin_owner_lockdown_test.rb` and `admin_settings_owners_test.rb` exercise every bypass path named in the plan's `must_haves` (owner-role invitation rejection for both admin and owner callers, owner-touching update rejection both directions, non-owner-destroys-owner rejection, last-owner destroy/demote rejection at the exact boundary, self-demotion-with-another-owner-remaining success, and unauthenticated/non-owner denial on the new endpoints). All assertions traced against the implementation are consistent with actual controller behavior.
- **Frontend:** `AddAgentView.tsx` role `<Select>` only offers `agent`/`admin`; the `owner` `SelectItem` and its `RolePermissions` entry were removed, correctly framed as defense-in-depth since the backend already rejects `role: "owner"` server-side independent of this UI.

No critical or warning-level (confidence ≥ 80) issues were found in the reviewed files.

---

## Info

### IN-01 — TOCTOU race on the last-owner COUNT guard across two independent mutation endpoints

**Files:** `backend/app/controllers/v1/admin/users_controller.rb` (`#destroy`), `backend/app/controllers/v1/admin/settings/owners_controller.rb` (`#update`)

Both last-owner guards are read-then-act checks (`owner_count = BrokerageMembership...count; return if owner_count <= 1; ...update!/destroy_all`) with no row lock, transaction-level lock, or DB constraint backing them. Two concurrent requests each targeting a different owner (e.g., one `DELETE /v1/admin/users/:id` and one `PATCH /v1/admin/settings/owners/:id` fired near-simultaneously when exactly two owners remain) could each observe `owner_count == 2`, both pass the guard, and leave the brokerage with zero owners. This requires the caller(s) to already hold owner-level access, so it isn't a privilege-escalation vector, but it can defeat the exact invariant this phase is meant to guarantee under concurrent admin activity. Not blocking for this phase, but worth a follow-up (e.g., `BrokerageMembership.transaction { ...with_lock... }` or a partial unique/check constraint) before the ownership-management UI (Phase 34/35) makes concurrent owner actions more likely.

### IN-02 — `Settings::OwnersController#index`/`#eligible` are intentionally unpaginated

**File:** `backend/app/controllers/v1/admin/settings/owners_controller.rb:11-31`

These two read endpoints return the full, unpaginated list of owners/eligible admin-agent members, diverging from CLAUDE.md's general pagination guidance (Pagy + `per_page` cap). This is a deliberate, documented decision (33-02-SUMMARY.md: bounded by brokerage staff size for a settings page), so risk is low, but flagging for visibility in case brokerage size assumptions change.

### IN-03 — Some 4xx branches of the new owner endpoints aren't exercised by tests

**File:** `backend/test/integration/admin_settings_owners_test.rb`

The suite doesn't cover: `PATCH /v1/admin/settings/owners/:id` against a target who is *not* currently an owner (should 422 "User is not currently an owner"), or the `404` "User not found"/"Membership not found" branches on `#create`/`#update`. These branches are implemented correctly by inspection, just not asserted by an integration test.

---

## Summary

The phase closes the previously identified admin-takeover gap correctly and consistently: role enforcement is uniformly DB-backed (never JWT-derived), soft-delete scoping is correct everywhere touched, and the last-owner invariant is enforced at both remaining owner-mutation call sites with test coverage matching the plan's threat model. No critical or warning-level issues found. The three info items above are non-blocking hardening/coverage notes for future phases (34/35 ownership-management UI), not defects in this phase's deliverable.
