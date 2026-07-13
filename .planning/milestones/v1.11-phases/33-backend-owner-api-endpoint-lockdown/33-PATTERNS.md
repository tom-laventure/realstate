# Phase 33: Backend Owner API & Endpoint Lockdown - Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 8 (3 edited controllers, 1 new controller, 1 route file, 1 frontend edit, 1 test file to extend, 1 factory reused as-is)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/controllers/v1/admin/users_controller.rb` (`update`, `destroy` edits — D-01/D-02) | controller | request-response (CRUD) | itself (in-place edit); guard-pattern analog: `backend/app/controllers/v1/admin/brokerages_controller.rb` | exact (self) / role-match (guard) |
| `backend/app/controllers/v1/admin/invitations_controller.rb` (`create` edit — D-03/LOCK-01) | controller | request-response | itself (in-place edit); value-guard analog: `users_controller.rb#update` line 108-110 | exact (self) |
| `backend/app/controllers/v1/admin/settings/owners_controller.rb` (NEW) | controller | CRUD (request-response) | `backend/app/controllers/v1/admin/brokerages_controller.rb` (owner-only guard shape) + `backend/app/controllers/v1/admin/group/users_controller.rb` (uid-param, inline-hash response, rescue shape) | role-match (strong composite) |
| `backend/config/routes.rb` (new `namespace :settings do resources :owners ... end` block inside `namespace :admin`) | config/route | — | existing `namespace :account { namespace :calendar { ... } }` block (lines 47-56) — nested-namespace-to-nested-module precedent | exact |
| `backend/test/integration/admin_authorization_test.rb` or new `backend/test/integration/admin_owners_test.rb` (extend for LOCK-01/D-01/D-02/API-01..05) | test | request-response | `backend/test/integration/admin_authorization_test.rb` (role-matrix style) + `backend/test/integration/admin_brokerages_test.rb` (focused single-resource style) | exact |
| `backend/test/factories/brokerage_memberships.rb` | test fixture | — | itself — already has `:owner`/`:admin`/`:agent`/`:client` traits, no changes needed, reuse as-is | exact |
| `frontend/src/components/view/admin/brokerageView/addAgentView/AddAgentView.tsx` (LOCK-02 edit) | component | request-response (form submit) | itself (in-place edit, remove one `SelectItem` + trim `RolePermissions roles` prop) | exact (self) |
| `backend/app/models/brokerage_membership.rb` / `backend/app/models/user.rb` (read-only, no edits expected) | model | CRUD | — | reference only |

## Pattern Assignments

### `backend/app/controllers/v1/admin/users_controller.rb` (controller, CRUD) — D-01/D-02 edits

**Analog for the owner-only action-guard shape:** `backend/app/controllers/v1/admin/brokerages_controller.rb`

**Current `update` action being replaced** (full read, `backend/app/controllers/v1/admin/users_controller.rb` lines 93-124):
```ruby
def update
  brokerage = Current.brokerage
  user = User.for_brokerage(brokerage.id).find_by(uid: params[:id])
  return render json: {error: "User not found"}, status: :not_found unless user

  membership = user.brokerage_memberships.find_by(brokerage_id: brokerage.id)
  return render json: {error: "Membership not found"}, status: :not_found unless membership

  role = params.dig(:user, :role).to_s.strip
  return render json: {error: "Role is required"}, status: :unprocessable_entity if role.blank?
  return render json: {error: "Invalid role"}, status: :unprocessable_entity unless AppConstants::BROKERAGE_ROLES.include?(role)

  current_role = Current.user.brokerage_memberships.find_by(brokerage_id: brokerage.id)&.role
  if role == "owner" && current_role != "owner"
    return render json: {error: "Only owners can assign the owner role"}, status: :forbidden
  end

  membership.update!(role: role)
  # ... re-fetch + serialize
end
```
**Gaps this rewrite must fix (Pitfall 2 and Pitfall 4 from RESEARCH.md):**
1. `membership = user.brokerage_memberships.find_by(brokerage_id: brokerage.id)` — missing `.without_deleted`.
2. `current_role` is hand-derived instead of reusing the inherited `current_membership` helper (which IS already `.without_deleted`-scoped, see below).
3. The guard only blocks *assigning* `"owner"` — it must also reject when `membership.role == "owner"` (demoting an owner via this endpoint), per D-02 / Pitfall 2.

**Reusable helper to call instead of hand-deriving `current_role`** (`backend/app/controllers/v1/admin/base_controller.rb` lines 32-37):
```ruby
def current_membership
  @current_membership ||= BrokerageMembership.without_deleted.find_by(
    user_id: Current.user.id,
    brokerage_id: Current.brokerage.id
  )
end
```

**Current `destroy` action being replaced** (full read, lines 126-144) — has zero owner-specific guard; `before_action :require_admin!, only: [:update, :destroy]` (line 4) is the only gate today. D-01 requires an additional `require_owner!` check gated on the *target's* role plus a last-owner COUNT guard, both evaluated inside the action body (the action-level `before_action` stays `require_admin!` for non-owner targets — this is a value-level, not action-level, escalation, exactly like Pitfall 3's warning for `InvitationsController#create`).

**Owner-only action-guard shape to borrow** (`backend/app/controllers/v1/admin/brokerages_controller.rb` lines 4-5):
```ruby
skip_before_action :require_agent_or_above!, only: [:update]
before_action :require_owner!, only: [:update]
```
This shape is for *whole-action* owner-lockdown (used by the new `Settings::OwnersController`). For `UsersController#destroy`, D-01's guard is conditional on the *target's* current role, so it must be an inline check inside the action body calling the existing `require_owner!` guard method directly (it's already `private`, callable from within the same class) — do not add it as a blanket `before_action` since non-owner targets must still work under `require_admin!`.

**`require_owner!` to reuse directly** (`base_controller.rb` lines 25-30):
```ruby
def require_owner!
  unless current_membership&.role == "owner"
    render json: {error: {code: "forbidden", message: "Owner access required."}},
      status: :forbidden
  end
end
```

**Last-owner COUNT guard pattern** (from RESEARCH.md Pattern 4, apply inline in both `destroy` and the new demote endpoint):
```ruby
owner_count = BrokerageMembership.without_deleted.where(brokerage_id: Current.brokerage.id, role: "owner").count
if owner_count <= 1
  return render json: {error: "Cannot remove the brokerage's last owner"}, status: :unprocessable_entity
end
```

**Existing 422 error-shape convention to keep consistent** (lines 104-105, flat string, not nested):
```ruby
return render json: {error: "Role is required"}, status: :unprocessable_entity if role.blank?
return render json: {error: "Invalid role"}, status: :unprocessable_entity unless AppConstants::BROKERAGE_ROLES.include?(role)
```
Per Pitfall 1: reserve `render_forbidden`'s nested `{error: {code:, message:}}` shape for true 403 authorization failures; keep flat `{error: "..."}` strings for 422 validation-style rejections (last-owner, invalid role value) to match this file's existing precedent.

---

### `backend/app/controllers/v1/admin/invitations_controller.rb` (controller, request-response) — D-03/LOCK-01 edit

**Analog:** itself — in-place value-level edit inside the existing `create` action (lines 33-76).

**Exact insertion point** (after the existing role-allowlist and client-rejection checks, lines 40-41):
```ruby
return render_unprocessable(["Invalid role"], brokerage) unless AppConstants::BROKERAGE_ROLES.include?(role)
return render_unprocessable(["Client-level users must be invited at the group level"], brokerage) if role == "client"
# NEW (LOCK-01/D-03): reject owner-role invitations regardless of caller role
return render json: {error: "The owner role cannot be assigned via invitation"}, status: :forbidden if role == "owner"
```

**Action-level gate to leave untouched** (line 6):
```ruby
before_action :require_admin!, only: [:index, :create, :validate, :destroy]
```
Per Pitfall 3: do NOT change this to `require_owner!` — admins must still invite `agent`/`admin` users; only the `role == "owner"` *value* is rejected.

**Existing error-response helper already in this file** (lines 270-272, for the flat-array shape used by every other `create` rejection):
```ruby
def render_unprocessable(messages, brokerage)
  render json: {error: "Validation failed", details: messages, contact: contact_payload(brokerage)}, status: :unprocessable_entity
end
```
Note the new owner-value rejection above intentionally uses a plain `{error: "..."}` + `:forbidden` (403) shape instead of `render_unprocessable` (422) — matching D-03's own wording ("rejected (403) for any caller") and keeping it visually distinct from the file's other 422-style validation rejections.

---

### `backend/app/controllers/v1/admin/settings/owners_controller.rb` (NEW controller, CRUD)

**Primary analog for owner-only guard wiring:** `backend/app/controllers/v1/admin/brokerages_controller.rb` (lines 1-5)
**Secondary analog for uid-param resolution + inline-hash response + rescue shape:** `backend/app/controllers/v1/admin/group/users_controller.rb` (full file, 46 lines)

**Class/guard skeleton to copy** (adapted from `brokerages_controller.rb` lines 1-5):
```ruby
module V1
  module Admin
    module Settings
      class OwnersController < V1::Admin::BaseController
        skip_before_action :require_agent_or_above!, only: [:create, :update]
        before_action :require_owner!, only: [:create, :update]
        # index and eligible inherit require_agent_or_above! from BaseController — agent/admin/owner can read (A3 in RESEARCH.md)
```

**uid-param + inline-hash-response + rescue pattern to copy** (`backend/app/controllers/v1/admin/group/users_controller.rb` lines 6-23, `create` action):
```ruby
def create
  group = Current.brokerage.groups.find_by!(uid: params[:group_id])
  user = User.for_brokerage(Current.brokerage.id).find_by!(uid: add_user_params[:user_id])

  membership = UserGroup.find_or_create_by!(user_id: user.id, group_id: group.id)

  render json: {
    message: "User added to group",
    group_id: group.uid,
    user_id: user.uid,
    membership_id: membership.id
  }, status: :created
rescue ActiveRecord::RecordNotFound => e
  render json: {error: e.message}, status: :not_found
rescue ActiveRecord::RecordInvalid => e
  render json: {error: e.record.errors.full_messages}, status: :unprocessable_entity
end

private

def add_user_params
  params.require(:user).permit(:user_id)
end
```
Apply the same `params.require(:user).permit(:user_id)` convention for the promote endpoint's body (`{ user: { user_id: <uid> } }`, per RESEARCH.md Assumption A1), and `params.dig(:user, :role)` (matching `UsersController#update` line 103) for the demote endpoint's body.

**Full reference implementations already drafted in RESEARCH.md** (verified against real query/guard/response conventions in this codebase — copy directly, no need to re-derive):
- `index` (API-01) — RESEARCH.md "Architecture Patterns Pattern 2", `BrokerageMembership.without_deleted.where(brokerage_id:, role: "owner").includes(:user)`, inline hash `{id: m.user.uid, name: m.user.full_name, email: m.user.email}`, unpaginated array (D-06).
- `eligible` (API-02) — same shape, `role: %w[admin agent]`, includes `role:` in each hash for OWN-03's dropdown display.
- `create` (API-03) — RESEARCH.md "Pattern 3": resolve `target_user` via `User.for_brokerage(...).find_by(uid: ...)`, resolve `membership` via `BrokerageMembership.without_deleted.find_by(user_id:, brokerage_id:)`, re-validate `%w[admin agent].include?(membership.role)` server-side (D-05) before `membership.update!(role: "owner")`.
- `update` (API-04) — RESEARCH.md "Pattern 4": resolve target + membership the same way, reject if `membership.role != "owner"`, validate `new_role` against `DEMOTE_TARGET_ROLES = %w[admin agent client].freeze`, apply the last-owner COUNT guard (shared with `UsersController#destroy`, see above) before `membership.update!(role: new_role)`.

**`full_name`/`email`/`uid` accessors used in every inline hash** (`backend/app/models/user.rb` lines 20, 29-31):
```ruby
validates :uid, presence: true, uniqueness: true
def full_name
  "#{first_name} #{last_name}"
end
```

**Model note:** `BrokerageMembership` (`backend/app/models/brokerage_membership.rb`) is a minimal `acts_as_paranoid` model with only `belongs_to :user`/`belongs_to :brokerage` — no scopes of its own. All filtering happens in the controller via `.without_deleted.where(...)`, matching the "no query object needed" anti-pattern guidance in RESEARCH.md.

---

### `backend/config/routes.rb` (config)

**Analog:** existing `namespace :account { namespace :calendar { ... } }` block, `backend/config/routes.rb` lines 47-56, which maps to `V1::Account::Calendar::ConnectionsController` (`backend/app/controllers/v1/account/calendar/connections_controller.rb`) — direct precedent for nested `namespace X { namespace Y { ... } }` → `V1::X::Y::ClassNameController` under `app/controllers/v1/x/y/`.

**Insertion point:** inside the existing `namespace :admin do ... end` block (starts line 65), alongside `resources :users, only: [:index, :show, :destroy, :update]` (line 77):
```ruby
namespace :settings do
  resources :owners, only: [:index, :create, :update] do
    collection do
      get :eligible
    end
  end
end
```
This produces the four routes: `GET /v1/admin/settings/owners`, `GET /v1/admin/settings/owners/eligible`, `POST /v1/admin/settings/owners`, `PATCH /v1/admin/settings/owners/:id`.

---

### `frontend/src/components/view/admin/brokerageView/addAgentView/AddAgentView.tsx` (component) — LOCK-02 edit

**Analog:** itself, in-place edit. Full file read (125 lines). Two exact edit points:

**Line 99** — remove this `SelectItem`:
```tsx
<SelectItem value="owner">Owner</SelectItem>
```
(keep lines 97-98, `agent`/`admin` options, unchanged, inside the same `<SelectContent>` block starting line 96)

**Line 107** — trim the `roles` prop (drop `'owner'`):
```tsx
<RolePermissions roles={['agent', 'admin', 'owner']} />
```
becomes:
```tsx
<RolePermissions roles={['agent', 'admin']} />
```

No other lines in this file need changes — `useState<UserRole>('agent')` (line 19) already defaults away from `'owner'`, and `onSubmit`'s type signature (`role: UserRole`) is unaffected since `UserRole` is a shared type used elsewhere (not narrowed here).

---

### `backend/test/integration/admin_authorization_test.rb` and new owner-endpoint test file (test)

**Analog for role-matrix style (broad endpoint coverage, one assertion per role/endpoint pair):** `backend/test/integration/admin_authorization_test.rb` (full file, 402 lines) — `setup` block (lines 4-19) creates one user per role (`@owner`/`@admin`/`@agent`/`@client`) each with a `create(:brokerage_membership, :role_trait, ...)`, then asserts `assert_response :forbidden` + `assert_equal "forbidden", body.dig("error", "code")` for the structured 403 shape (e.g. lines 253-268 for `PATCH`/`DELETE /v1/admin/users/:id`).

**Analog for focused single-resource style (fewer, deeper tests per endpoint):** `backend/test/integration/admin_brokerages_test.rb` (full file, 90 lines) — narrower `setup`, explicit field-presence assertions (`entry.key?("id")` etc., lines 29-34), a private `main_domain_headers_for` auth-header helper mirroring the `auth_headers_for` helper this repo's `test_helper.rb` already provides for brokerage-scoped requests.

**Recommendation:** extend `admin_authorization_test.rb`'s existing role-matrix for the D-01/D-02/D-03 lockdown assertions (they slot naturally into the existing "Agent deny-list" / rejection-case sections, e.g. near lines 253-268), and create a new `backend/test/integration/admin_settings_owners_test.rb` (or similar) for the four new API-01..04 endpoints, following `admin_brokerages_test.rb`'s narrower single-resource style since these are new endpoints without an existing test home.

**Factory to reuse as-is (no changes needed):** `backend/test/factories/brokerage_memberships.rb` — already has `:owner`, `:admin`, `:agent`, `:client` traits (lines 7-21), sufficient for every test scenario in this phase including last-owner-guard tests (create exactly one `:owner` membership per brokerage in `setup`, then attempt to destroy/demote it).

## Shared Patterns

### Authorization guard reuse (applies to all 3 edited + 1 new controller)
**Source:** `backend/app/controllers/v1/admin/base_controller.rb` lines 13-37
**Apply to:** `UsersController` (destroy), `Settings::OwnersController` (create/update)
```ruby
before_action :authenticate_cognito_user!   # line 8, inherited, unchanged
before_action :require_agent_or_above!      # line 9, inherited; skip + override with require_owner! where needed

def require_owner!
  unless current_membership&.role == "owner"
    render json: {error: {code: "forbidden", message: "Owner access required."}}, status: :forbidden
  end
end

def current_membership
  @current_membership ||= BrokerageMembership.without_deleted.find_by(
    user_id: Current.user.id, brokerage_id: Current.brokerage.id
  )
end
```
**Critical constraint (RESEARCH.md Summary + Anti-Patterns):** never read `role` from the decoded JWT claims for any of these checks — always resolve via `current_membership` (a fresh DB read every request). No controller in this codebase reads `claims["role"]`; new code must not be the first.

### Soft-delete scoping (applies to every query touching `BrokerageMembership` or `User` in this phase)
**Source:** CLAUDE.md convention + `base_controller.rb` line 33 (`current_membership`'s own implementation)
**Apply to:** all new/edited queries in `UsersController#update`/`#destroy` and `Settings::OwnersController`
```ruby
BrokerageMembership.without_deleted.where(brokerage_id: Current.brokerage.id, role: "owner")
BrokerageMembership.without_deleted.find_by(user_id: target_user.id, brokerage_id: Current.brokerage.id)
```
Every existing `find_by(brokerage_id: ...)` call in the two lines this phase edits (`users_controller.rb` lines 100, 107) is currently MISSING `.without_deleted` — fix in passing per Pitfall 4.

### Error-response shape convention (applies to all new 403/422 responses across this phase)
**Source:** `base_controller.rb#render_forbidden` (nested) vs. `users_controller.rb#update` lines 104-105 (flat) — two pre-existing, inconsistent shapes (Pitfall 1)
**Apply to:** pick one shape per status code, consistently, across all edits in this phase:
- 403 (pure authorization failure) → reuse `render_forbidden`'s nested shape: `{error: {code: "forbidden", message: "..."}}`
- 422 (validation-style rejection: last-owner, invalid role value, blank param) → flat shape: `{error: "..."}`, matching `users_controller.rb` lines 104-105 exactly.

### Role-value allowlist validation (applies to every role param across this phase)
**Source:** `backend/app/constants/roles.rb`
```ruby
module AppConstants
  BROKERAGE_ROLES = %w[owner admin agent staff client].freeze
end
```
**Apply to:** `Settings::OwnersController#update`'s `DEMOTE_TARGET_ROLES = %w[admin agent client].freeze` constant (subset, per API-04), and any role-value check across the three edited controllers.

## No Analog Found

None — every file in scope for this phase has at least one strong existing analog in the codebase (RESEARCH.md's own "Don't Hand-Roll" section confirms every primitive needed already exists).

## Metadata

**Analog search scope:** `backend/app/controllers/v1/admin/`, `backend/app/controllers/v1/account/calendar/`, `backend/config/routes.rb`, `backend/app/models/`, `backend/app/constants/`, `backend/test/integration/`, `backend/test/factories/`, `frontend/src/components/view/admin/brokerageView/addAgentView/`
**Files scanned:** 12 (all read in full — none exceeded 2,000 lines, no offset/limit reads needed)
**Pattern extraction date:** 2026-07-12
