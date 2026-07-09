---
phase: 30-backend-rbac-enforcement
reviewed: 2026-07-09T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - backend/app/controllers/v1/admin/base_controller.rb
  - backend/app/controllers/v1/admin/board_credentials_controller.rb
  - backend/app/controllers/v1/admin/brokerages_controller.rb
  - backend/app/controllers/v1/admin/invitations_controller.rb
  - backend/app/controllers/v1/admin/users_controller.rb
  - backend/test/integration/admin_authorization_test.rb
  - backend/test/integration/admin_domains_test.rb
  - backend/test/integration/board_connect_flow_test.rb
  - backend/test/integration/board_credential_crud_test.rb
  - backend/test/integration/filter_sets_test.rb
  - backend/test/integration/group_estate_coordinates_test.rb
  - backend/test/integration/group_estates_query_test.rb
  - backend/test/integration/invitations_test.rb
findings:
  critical: 3
  warning: 1
  info: 2
  total: 6
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-07-09
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

The core ask of this phase — broaden `V1::Admin::BaseController`'s default `before_action` to `require_agent_or_above!` and layer narrower `require_admin!`/`require_owner!` checks onto exactly the write actions that must stay blocked for `agent` — is implemented correctly. I traced every action in all four narrowed controllers (`users_controller.rb`, `board_credentials_controller.rb`, `brokerages_controller.rb`, `invitations_controller.rb`) against the callback chain and confirmed **no gap lets `agent` through to a write action**: `require_admin!`/`require_owner!` is layered on `users#update/destroy`, `board_credentials#create/update/destroy`, `brokerages#update`, and `invitations#index/create/validate/destroy`. `skip_before_action` targets were correctly renamed from `:require_admin!` to `:require_agent_or_above!` in both affected controllers, avoiding the `ArgumentError`-at-boot failure mode. `standardrb` is clean on all five controller files, and I confirmed by direct HTTP probe that the soft-delete-scoped `current_membership` lookup and the callback ordering (`resolve_brokerage` → `authenticate_cognito_user!` → `require_*!`) behave as designed.

However, while tracing the admin/owner boundary inside `invitations_controller.rb` and `users_controller.rb` (adjacent to, but not identical to, the agent boundary this phase targets), I found three genuine authorization/correctness defects that predate this phase but live in the files under review and materially affect the RBAC surface: an owner-role privilege-escalation path via brokerage invitations, an asymmetric "any admin can remove the owner" gap in user destroy, and a broken/dead-code routing mismatch on the invitation accept/decline endpoints (verified by direct reproduction — see CR-01). These are flagged below even though they are not "agent boundary" gaps, because they sit squarely in the security-sensitive files this review was scoped to.

## Critical Issues

### CR-01: Admin invitation accept/decline routes are broken (unreachable actions) — reproduced

**File:** `backend/app/controllers/v1/admin/invitations_controller.rb:157` (`accept_invitation`), `:207` (`decline_invitation`); also `backend/config/routes.rb:110-116`

**Issue:** `config/routes.rb` maps the admin invitations collection routes to actions named `accept` and `decline`:
```ruby
resources :invitations, only: [:create, :index, :destroy] do
  collection do
    post :validate
    post :accept
    post :decline
  end
end
```
`rails routes` confirms this resolves to `v1/admin/invitations#accept` and `v1/admin/invitations#decline`. But `V1::Admin::InvitationsController` defines methods named `accept_invitation` and `decline_invitation` — there is no `accept` or `decline` method. I reproduced this directly: `POST /v1/admin/invitations/accept` returns `AbstractController::ActionNotFound` ("Unknown action") for every caller, authenticated or not, regardless of role. The `skip_before_action :require_agent_or_above!, only: [:accept_invitation, :decline_invitation, :validate_token]` line is therefore dead code — those action names are never dispatched under the admin routes, so the "let non-members through to accept their invite" intent is completely non-functional. (`validate_token` is additionally not routed under `/v1/admin/*` at all — only `/v1/dashboard/invitations/validate_token` exists — making that method 100% dead code in this controller.)

This is not introduced by Phase 30 (confirmed via `git log -p`; the method names predate the phase-30 commit, which only touched the `skip_before_action` target rename), but it means the admin-namespace invitation accept/decline flow is entirely broken today, and none of the required-reading test files (including `admin_authorization_test.rb`, which was extended for this phase) exercise these two endpoints — so the break has no regression coverage.

**Fix:** Rename the controller methods to match the routes (`accept`, `decline`), or add explicit route mappings (`post :accept, action: :accept_invitation`). Also either wire up a `validate_token` route under `/v1/admin/invitations` or delete the dead method:
```ruby
# config/routes.rb — option A: keep route names, fix action mapping
collection do
  post :validate
  post :accept, action: :accept_invitation
  post :decline, action: :decline_invitation
end
```
Add a regression test asserting a real (non-member) invitee gets a 2xx on `POST /v1/admin/invitations/accept`.

### CR-02: Non-owner admin can invite a new user with role "owner", bypassing owner-only promotion

**File:** `backend/app/controllers/v1/admin/invitations_controller.rb:36-58` (`create`), `:157-205` (`accept_invitation`)

**Issue:** `create` is gated by `require_admin!` (owner OR admin), and validates `role` against `AppConstants::BROKERAGE_ROLES` while only explicitly rejecting `role == "client"`:
```ruby
return render_unprocessable(["Invalid role"], brokerage) unless AppConstants::BROKERAGE_ROLES.include?(role)
return render_unprocessable(["Client-level users must be invited at the group level"], brokerage) if role == "client"
```
`"owner"` passes both checks. `accept_invitation` then creates the membership directly from the invitation's stored role with no re-validation:
```ruby
membership = BrokerageMembership.new(user_id: user.id, brokerage_id: brokerage.id, role: invitation.role)
```
This means a non-owner `admin` can send an invitation with `role: "owner"`, and when a new (not-yet-member) user accepts it, that user becomes a brokerage owner — with no existing owner ever approving the promotion. This directly contradicts the rule enforced elsewhere in the same review scope, `users_controller.rb:108-110`:
```ruby
if role == "owner" && current_role != "owner"
  return render json: {error: "Only owners can assign the owner role"}, status: :forbidden
end
```
`.planning/ROLES.md` documents this as a deliberate, single enforcement point ("Only an existing owner can promote another user to owner") — `invitations_controller.rb#create` is a second path to the same outcome that has no equivalent guard.

**Fix:** Mirror the `users_controller.rb` guard in `create`:
```ruby
return render_unprocessable(["Only owners can invite a new owner"], brokerage) if role == "owner" && current_membership.role != "owner"
```
(`current_membership` is available via `BaseController`.)

### CR-03: Any admin can remove the brokerage's owner via `users#destroy` (no owner-only guard)

**File:** `backend/app/controllers/v1/admin/users_controller.rb:128-144`

**Issue:** `destroy` is gated only by `require_admin!` (owner or admin), with no check on the target user's role:
```ruby
def destroy
  brokerage = Current.brokerage
  user = User.for_brokerage(brokerage.id).find_by(uid: params[:id])
  return render json: {error: "User not found"}, status: :not_found unless user
  brokerage.groups.each { |group| user.user_groups.where(group_id: group.id).destroy_all }
  user.brokerage_memberships.where(brokerage_id: brokerage.id).destroy_all
  render json: {message: "User removed from brokerage"}, status: :ok
end
```
A non-owner `admin` can call `DELETE /v1/admin/users/:owner_uid` and remove the owner's brokerage membership entirely — with no check preventing it. This is asymmetric with `update` (lines 107-110), which explicitly blocks non-owners from *assigning* the owner role but has no equivalent protection against *removing* an existing owner. Combined with CR-02, this is chainable into a full takeover: a non-owner admin can (1) remove the current owner via `destroy`, then (2) invite a new owner (themselves or an accomplice) via the CR-02 path, ending with a brokerage that has no owner-approved chain of custody at all.

**Fix:** Reject destroy attempts on an owner's membership unless the acting user is also an owner:
```ruby
membership = user.brokerage_memberships.find_by(brokerage_id: brokerage.id)
if membership&.role == "owner" && current_membership.role != "owner"
  return render json: {error: "Only owners can remove an owner"}, status: :forbidden
end
```

## Warnings

### WR-01: Membership lookups in `users_controller#update` skip the explicit `.without_deleted` scope required by project convention

**File:** `backend/app/controllers/v1/admin/users_controller.rb:100`, `:107`

**Issue:** CLAUDE.md's Soft Deletes section mandates `.without_deleted` on every model touched by a query, "including joined tables." `base_controller.rb`'s `current_membership` helper follows this (`BrokerageMembership.without_deleted.find_by(...)`), but `users_controller#update` does not:
```ruby
membership = user.brokerage_memberships.find_by(brokerage_id: brokerage.id)          # line 100
current_role = Current.user.brokerage_memberships.find_by(brokerage_id: brokerage.id)&.role  # line 107
```
`acts_as_paranoid`'s default scope currently makes this functionally equivalent to `.without_deleted` (soft-deleted rows are excluded by default), so this is not exploitable today. But it is an explicit deviation from the codified convention, and defense-in-depth is lost if the association is ever accessed via `.unscoped`/`.with_deleted` upstream, or if the default scope is altered.

**Fix:**
```ruby
membership = user.brokerage_memberships.without_deleted.find_by(brokerage_id: brokerage.id)
current_role = Current.user.brokerage_memberships.without_deleted.find_by(brokerage_id: brokerage.id)&.role
```

## Info

### IN-01: Misleading route comment in `invitations_controller.rb`

**File:** `backend/app/controllers/v1/admin/invitations_controller.rb:32`

**Issue:** `# POST /v1/invitations` above `def create` is inaccurate — the actual route (confirmed via `rails routes`) is `POST /v1/admin/invitations`. Minor, but misleading when cross-referencing routes during future changes.

**Fix:** Update the comment to `# POST /v1/admin/invitations`.

### IN-02: `validate_token` action in the admin controller is unreachable dead code

**File:** `backend/app/controllers/v1/admin/invitations_controller.rb:103-155`

**Issue:** No route under `/v1/admin/invitations/*` dispatches to `validate_token` (only `/v1/dashboard/invitations/validate_token` exists, handled by a separate `V1::Dashboard::InvitationsController`). This ~50-line method (plus its `skip_before_action` entry) is entirely dead code in this file, duplicating logic that already lives in the dashboard controller.

**Fix:** Remove `validate_token` (and its `skip_before_action` reference) from `admin/invitations_controller.rb`, or confirm with product whether an admin-namespace equivalent route was intended and wire it up.

---

_Reviewed: 2026-07-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
