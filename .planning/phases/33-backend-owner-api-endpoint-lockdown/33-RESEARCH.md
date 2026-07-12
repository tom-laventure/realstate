# Phase 33: Backend Owner API & Endpoint Lockdown - Research

**Researched:** 2026-07-12
**Domain:** Rails 7.1 admin-namespace authorization (RBAC), owner-role lockdown, new CRUD-lite endpoints
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Endpoint lockdown scope (CR-02/CR-03 closure)
- **D-01:** `UsersController#destroy` (`DELETE /v1/admin/users/:id`) gets a `require_owner!` guard when the target user's current role is `owner`, plus a last-owner rejection (cannot destroy the brokerage's only remaining owner). Non-owner targets keep the existing `require_admin!` behavior. This closes CR-03 (any admin could previously destroy an owner's membership with zero guard).
- **D-02:** `UsersController#update` (`PATCH /v1/admin/users/:id`) now rejects `role: "owner"` outright (403) in both directions — assigning owner OR demoting away from owner — regardless of caller role, including existing owners. All owner-role changes must go through the new `POST/PATCH /admin/settings/owners` endpoints, which are the only place with the last-owner guard. This closes the bypass where an owner could demote another owner via the generic endpoint and skip the last-owner check.
- **D-03:** `InvitationsController#create` (`POST /v1/admin/invitations`, the actual endpoint behind the `/admin/brokerage/add-agent` frontend route) keeps its existing `require_admin!` gate for the action as a whole, but adds a value-level rejection: `role: "owner"` is rejected (403) for any caller, admin or owner. Admins/owners can still invite new `agent`/`admin`-role users — this doesn't upgrade the whole action to owner-only. This is LOCK-01. Owner promotion for existing members is a fully separate path (API-03) that invitations never touch.

### Promote mechanism (Add Owner)
- **D-04:** `POST /admin/settings/owners` is an instant, direct `BrokerageMembership` role update — no `Invitation` record, no email, no acceptance step. The target is always an existing brokerage member (already `admin` or `agent`); this mirrors the existing `users#update` pattern (`membership.update!`) rather than the invitation flow, which exists only for onboarding people who aren't members yet.
- **D-05:** The promote endpoint validates server-side that the target's *current* role is `admin` or `agent` before promoting (422/403 otherwise) — it does not trust that the frontend only ever submits IDs from the eligible-list endpoint. Consistent with API-05 ("frontend role gates are UX-only") and the project's backend-is-the-trust-boundary pattern.

### List endpoint shape
- **D-06:** Both `GET /admin/settings/owners` and `GET /admin/settings/owners/eligible` return the full unpaginated array (no Pagy meta) — same `paginate=false`-style convention CLAUDE.md documents for filter-dropdown endpoints. Both lists are inherently small and bounded per brokerage.
- **D-07:** `GET /admin/settings/owners/eligible` does not accept a `?q=` search param. OWN-03's "searchable dropdown" is implemented as client-side filtering over the full returned array on the frontend (Phase 34 concern) — the backend endpoint stays simple.

### Claude's Discretion

- Exact HTTP status code for the last-owner rejection on demote/destroy (422 vs 403) — pick whichever matches the existing convention most closely at implementation time (existing `render_forbidden` uses 403; validation-style rejects in this codebase tend to use 422).
- Route/controller naming for the new owner-management endpoints (e.g., `Admin::Settings::OwnersController` vs `Admin::OwnersController`) — follow existing namespace conventions found in `backend/config/routes.rb`.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. (Audit logging and email notifications on ownership change are already tracked as v2 requirements OWN-11/OWN-12 in `.planning/REQUIREMENTS.md`, not raised fresh here.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| LOCK-01 | `POST /admin/brokerage/add-agent` (actual route: `POST /v1/admin/invitations`) rejects `owner` role assignment with HTTP 403 — owner role can only be assigned via the new settings endpoint | See Architecture Patterns / Common Pitfalls Pitfall 3 — value-level guard inside `InvitationsController#create`, action-level gate (`require_admin!`) stays unchanged |
| LOCK-02 | The role selector on the `/admin/brokerage/add-agent` frontend page no longer offers "owner" | See `frontend/src/components/view/admin/brokerageView/addAgentView/AddAgentView.tsx` line 99 (`SelectItem value="owner"`) and `RolePermissions roles={['agent','admin','owner']}` prop on line 107 — both need the `owner` option removed |
| API-01 | `GET /admin/settings/owners` returns current brokerage owners (name, email) | See Architecture Patterns Pattern 2 — query `BrokerageMembership.without_deleted.where(role: "owner")` joined to `:user`, unpaginated (D-06) |
| API-02 | `GET /admin/settings/owners/eligible` returns brokerage users with role `admin` or `agent` | See Architecture Patterns Pattern 2 — same query shape, `role: %w[admin agent]`, includes `role` field in response for OWN-03's dropdown display |
| API-03 | `POST /admin/settings/owners` promotes a user to owner; requires caller to hold `owner` role | See Architecture Patterns Pattern 1 (owner-only guard) and Pattern 3 (instant direct membership update, D-04/D-05 server-side re-validation) |
| API-04 | `PATCH /admin/settings/owners/:id` demotes an owner to `admin`/`agent`/`client`; requires caller to hold `owner` role; rejects if target is the last owner | See Architecture Patterns Pattern 4 — COUNT-based last-owner guard, also satisfies OWN-09's self-demotion allowance with no special-casing |
| API-05 | All new endpoints validate the caller's role server-side via JWT claims — frontend gates are UX-only | See Summary and Anti-Patterns — the JWT's `role` claim itself must NOT be read; enforcement is via `current_membership` (DB-backed, derived from the JWT's `sub` claim), consistent with every other admin controller in this codebase |
</phase_requirements>

## Summary

This phase is a pure backend Rails change plus one line-item frontend edit. All the primitives needed already exist in the codebase (`Admin::BaseController#require_owner!`/`#require_admin!`/`#current_membership`, the `paginate=false` bypass convention, `acts_as_paranoid`/`.without_deleted` scoping, nested `V1::Admin::*` controller/module conventions). No new gems, no new frontend libraries, no new architectural patterns are required — this is a "reuse and extend" phase, not a "design new infrastructure" phase.

The most important non-obvious finding: **the JWT's embedded `role` claim is never read anywhere for authorization.** `Admin::BaseController#current_membership` re-queries `BrokerageMembership` from the database on every request using only the JWT's `sub` (user identity) claim — it ignores the `role` claim baked into the token at issuance. This is actually *more* secure than trusting the JWT's role claim (a demoted user's stale 24h token can't retain elevated access), but it means REQUIREMENTS.md's literal phrasing for API-05 ("validate the caller's role via JWT claims") must **not** be implemented as `decoded_token["role"] == "owner"`. New code must call the existing `current_membership` helper (DB-backed, fresh every request), exactly like every other admin controller already does. Getting this backwards would silently reopen a version of the exact vulnerability this phase closes.

The second key finding: `UsersController#update` and `#destroy` both have soft-delete scoping gaps (`.find_by(brokerage_id: ...)` without `.without_deleted`) that predate this phase but sit directly in the code this phase edits — the phase's D-01/D-02 rewrites should fix these in passing since the lines are being touched anyway.

**Primary recommendation:** Add a new `V1::Admin::Settings::OwnersController < V1::Admin::BaseController` (mirroring the existing `V1::Admin::Group::UsersController` nested-module convention) under a new `namespace :settings` block inside the existing `namespace :admin` in `routes.rb`. Query owner/eligible lists directly from `BrokerageMembership.without_deleted` (joined to `:user`), not from `User.for_brokerage` (which lacks explicit `.without_deleted` scoping on the join). Guard `create`/`update` with `require_owner!` using the exact `skip_before_action :require_agent_or_above!` + `before_action :require_owner!, only: [...]` pattern already used in `BrokeragesController`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Owner-only role-change enforcement | API/Backend | — | Authorization is imperative, per-controller, in this codebase (no declarative gem); must live in controller `before_action` guards, never trusted from frontend |
| Owner/eligible list retrieval | API/Backend | Database | Simple filtered `BrokerageMembership` queries; no caching/CDN tier involved |
| Role selector UI restriction (LOCK-02) | Browser/Client | — | Purely cosmetic UX guard; the actual enforcement is server-side (LOCK-01) — this tier only prevents accidental submission, never trust it as security |
| Last-owner protection invariant | API/Backend | Database | Must be evaluated against live DB state at request time (COUNT query), not cached or computed client-side |

## Standard Stack

No new libraries are introduced by this phase. All work uses the existing stack:

| Component | Version | Purpose |
|-----------|---------|---------|
| Rails | 7.1 | Existing framework — no upgrade needed |
| paranoia (acts_as_paranoid) | 3.0.0 `[VERIFIED: Gemfile.lock]` | Soft-delete scoping for `BrokerageMembership`/`User` queries |
| active_model_serializers | (existing, `:json`/`:attributes` adapter) | Only relevant if a dedicated serializer is chosen; a lightweight inline hash (see Code Examples) is more consistent with this endpoint's minimal payload and matches precedent (`InvitationsController#create`'s inline hash) |
| Minitest + FactoryBot + shoulda-matchers | (existing, `test/` dir) | Test framework for this phase — see Validation note below |

**Package Legitimacy Audit:** Not applicable — this phase installs no new packages (pure Ruby/Rails controller, route, and query code using only libraries already in `Gemfile.lock`). No `npm install`/`bundle add`/`gem install` calls are needed.

## Architecture Patterns

### System Architecture Diagram

```
Client (React SPA)
   │
   │ 1. PATCH /v1/admin/users/:id  { user: { role: "owner" } }         ── D-02 lockdown
   │ 2. DELETE /v1/admin/users/:id (target is an owner)                ── D-01 lockdown
   │ 3. POST /v1/admin/invitations { invitation: { role: "owner" } }   ── D-03 / LOCK-01
   │ 4. GET/POST/PATCH /v1/admin/settings/owners[...]                 ── API-01..04 (new)
   ▼
BrokerageAuth (resolves Current.brokerage from Host/Origin)
   ▼
CognitoAuth#authenticate_cognito_user! (verifies JWT sub claim → Current.user; JWT "role" claim IGNORED)
   ▼
Admin::BaseController#require_agent_or_above! (blanket before_action; agent/admin/owner pass, client/staff 403)
   ▼
Per-controller before_action overrides:
   ├─ UsersController#update/#destroy  → inline role-value guards (D-01, D-02)
   ├─ InvitationsController#create     → inline role-value guard (D-03 / LOCK-01)
   └─ Settings::OwnersController       → skip_before_action :require_agent_or_above!
                                          before_action :require_owner!, only: [:create, :update]
                                          (mirrors BrokeragesController#update pattern)
   ▼
Admin::BaseController#current_membership
   → BrokerageMembership.without_deleted.find_by(user_id: Current.user.id, brokerage_id: Current.brokerage.id)
   (fresh DB read every request — this IS the "JWT claims" enforcement point for API-05,
    despite the JWT payload itself carrying an unused `role` field)
   ▼
Controller action body:
   ├─ Value-level role checks (AppConstants::BROKERAGE_ROLES membership, owner-transition rejection)
   ├─ Last-owner COUNT guard (BrokerageMembership.without_deleted.where(role: "owner").count)
   └─ membership.update!(role: ...) — direct, synchronous, no Invitation/email (D-04)
   ▼
JSON response (existing render_forbidden / inline error hash conventions)
```

### Recommended Project Structure

```
backend/app/controllers/v1/admin/
├── base_controller.rb              # unchanged — require_owner!/require_admin!/current_membership reused as-is
├── users_controller.rb             # EDIT: update (D-02), destroy (D-01)
├── invitations_controller.rb       # EDIT: create (D-03 / LOCK-01)
├── brokerages_controller.rb        # READ ONLY — cited as the require_owner!-on-one-action pattern
└── settings/
    └── owners_controller.rb        # NEW — V1::Admin::Settings::OwnersController
```

```
backend/config/routes.rb
  namespace :admin do
    ...
    namespace :settings do
      resources :owners, only: [:index, :create, :update] do
        collection do
          get :eligible
        end
      end
    end
  end
```

This produces exactly the four routes required:
- `GET  /v1/admin/settings/owners`          → `#index`   (API-01)
- `GET  /v1/admin/settings/owners/eligible` → `#eligible` (API-02)
- `POST /v1/admin/settings/owners`          → `#create`  (API-03)
- `PATCH /v1/admin/settings/owners/:id`     → `#update`  (API-04)

The nested-module convention (`namespace :admin { namespace :settings { ... } }` → `V1::Admin::Settings::OwnersController` in `app/controllers/v1/admin/settings/owners_controller.rb`) is directly precedented by `namespace :account { namespace :calendar { ... } }` → `app/controllers/v1/account/calendar/connections_controller.rb` `[VERIFIED: backend/config/routes.rb, backend/app/controllers/v1/account/calendar/connections_controller.rb]`.

### Pattern 1: Owner-only action guard (reuse, don't reimplement)

**What:** `Admin::BaseController` already runs `before_action :require_agent_or_above!` for every admin-namespace action. To make specific actions owner-only, skip the blanket guard and apply the stricter one.

**When to use:** `Settings::OwnersController#create` and `#update`.

**Example (verified existing code, `backend/app/controllers/v1/admin/brokerages_controller.rb` lines 4-5):**
```ruby
# Source: backend/app/controllers/v1/admin/brokerages_controller.rb (existing, verified)
class BrokeragesController < V1::Admin::BaseController
  skip_before_action :require_agent_or_above!, only: [:update]
  before_action :require_owner!, only: [:update]
  ...
```

Apply identically for the new controller:
```ruby
class V1::Admin::Settings::OwnersController < V1::Admin::BaseController
  skip_before_action :require_agent_or_above!, only: [:create, :update]
  before_action :require_owner!, only: [:create, :update]
  # index and eligible keep the inherited require_agent_or_above! (agent/admin/owner can read)
```

**Why `index`/`eligible` should stay at `require_agent_or_above!` (not owner-locked):** REQUIREMENTS.md SET-02 (Phase 34, out of scope here but a consumer of this API) explicitly requires admins and agents to have **read-only** access to the owner list. Locking API-01 to owner-only would break that Phase 34 requirement. Nothing in REQUIREMENTS.md's API-01/API-02 acceptance criteria states a caller-role restriction — only API-03/API-04 (the mutating endpoints) state "requires the caller to have the owner role." Treat this as a load-bearing distinction: **GET endpoints stay open to agent+; POST/PATCH endpoints are owner-only.**

### Pattern 2: Query owners/eligible from `BrokerageMembership`, not `User.for_brokerage`

**What:** `User.for_brokerage` (`app/models/user.rb`) does a bare `joins(:brokerage_memberships)` with no explicit `.without_deleted` on the joined table. While Rails typically applies a model's `default_scope` (which `acts_as_paranoid` sets) through symbol-based `.joins(:assoc)`, CLAUDE.md's explicit convention is to scope every touched model with `.without_deleted` regardless — this codebase does not rely on default_scope alone anywhere else (see `board_credentials_controller.rb`, `estates_controller.rb`, etc., all of which call `.without_deleted` explicitly even on default-scoped models).

**When to use:** Both new list endpoints.

**Example:**
```ruby
# GET /v1/admin/settings/owners  (API-01)
def index
  memberships = BrokerageMembership.without_deleted
    .where(brokerage_id: Current.brokerage.id, role: "owner")
    .includes(:user)

  render json: {
    owners: memberships.map { |m| {id: m.user.uid, name: m.user.full_name, email: m.user.email} }
  }, status: :ok
end

# GET /v1/admin/settings/owners/eligible  (API-02)
def eligible
  memberships = BrokerageMembership.without_deleted
    .where(brokerage_id: Current.brokerage.id, role: %w[admin agent])
    .includes(:user)

  render json: {
    eligible_users: memberships.map { |m| {id: m.user.uid, name: m.user.full_name, email: m.user.email, role: m.role} }
  }, status: :ok
end
```

Both responses are unpaginated arrays (D-06) — no Pagy/`meta` wrapper, matching the `paginate=false` convention's *shape* even though there's no query param involved (the lists are inherently small/bounded per brokerage, per D-06's rationale).

### Pattern 3: Promote (instant, no Invitation) — mirrors `UsersController#update`, not `InvitationsController#create`

**What:** D-04 explicitly states the promote endpoint updates an existing `BrokerageMembership` directly — no `Invitation` record, no email, no acceptance step.

**Example:**
```ruby
# POST /v1/admin/settings/owners  (API-03)
# params: { user: { user_id: <uid> } }  — "user_id" holds the public uid string, matching
# the existing Group::UsersController#add_user_params convention (add_user_params[:user_id]
# is a uid, not an integer PK)
def create
  target_uid = params.dig(:user, :user_id)
  return render json: {error: "user_id is required"}, status: :unprocessable_entity if target_uid.blank?

  target_user = User.for_brokerage(Current.brokerage.id).find_by(uid: target_uid)
  return render json: {error: "User not found"}, status: :not_found unless target_user

  membership = BrokerageMembership.without_deleted.find_by(
    user_id: target_user.id, brokerage_id: Current.brokerage.id
  )
  return render json: {error: "Membership not found"}, status: :not_found unless membership

  # D-05: server-side re-validation — never trust that the frontend only submits
  # IDs from the /eligible endpoint's response.
  unless %w[admin agent].include?(membership.role)
    return render json: {error: "Only admins and agents can be promoted to owner"}, status: :unprocessable_entity
  end

  membership.update!(role: "owner")

  render json: {id: target_user.uid, name: target_user.full_name, email: target_user.email}, status: :ok
end
```

### Pattern 4: Demote with last-owner guard

**Example:**
```ruby
# PATCH /v1/admin/settings/owners/:id  (API-04)
# params: { user: { role: "admin" | "agent" | "client" } }
DEMOTE_TARGET_ROLES = %w[admin agent client].freeze

def update
  target_user = User.for_brokerage(Current.brokerage.id).find_by(uid: params[:id])
  return render json: {error: "User not found"}, status: :not_found unless target_user

  membership = BrokerageMembership.without_deleted.find_by(
    user_id: target_user.id, brokerage_id: Current.brokerage.id
  )
  return render json: {error: "Membership not found"}, status: :not_found unless membership
  return render json: {error: "User is not currently an owner"}, status: :unprocessable_entity unless membership.role == "owner"

  new_role = params.dig(:user, :role).to_s
  return render json: {error: "Invalid role"}, status: :unprocessable_entity unless DEMOTE_TARGET_ROLES.include?(new_role)

  owner_count = BrokerageMembership.without_deleted.where(brokerage_id: Current.brokerage.id, role: "owner").count
  if owner_count <= 1
    return render json: {error: "Cannot remove the brokerage's last owner"}, status: :unprocessable_entity
  end

  membership.update!(role: new_role)
  render json: {id: target_user.uid, name: target_user.full_name, email: target_user.email, role: new_role}, status: :ok
end
```

Note: this single COUNT-based guard also satisfies OWN-09 (self-demotion allowed iff another owner remains) with no special-casing — the count check is agnostic to whether the caller is demoting themselves or someone else.

### Anti-Patterns to Avoid

- **Reading `role` from the decoded JWT for authorization:** `TokenService.issue` embeds a `role` claim `[VERIFIED: backend/app/services/token_service.rb]`, but no controller anywhere reads `claims["role"]` for an authorization decision `[VERIFIED: grep across backend/app]`. All existing guards derive role fresh from `BrokerageMembership` via `current_membership`. New code must do the same — trusting the JWT's `role` claim would let a demoted owner retain owner-level access for up to 24 hours (`TokenService::EXPIRY_DURATION`) until their token naturally expires.
- **Reimplementing `require_owner!`/`require_admin!`/`current_membership`:** These already exist in `Admin::BaseController` — the new controller must inherit from it, not duplicate the role-check logic inline.
- **Building a `Query` object for the simple owners/eligible filters:** CLAUDE.md reserves `app/queries/` for *complex* filtering. `UsersController#index` itself keeps comparably simple role filtering inline in the controller (not extracted to a query object) — follow that same precedent; a query object here would be over-engineering for a single `where(role: ...)`.
- **Copying `UsersController#update`'s existing partial owner-guard verbatim:** it recomputes `current_role` via `Current.user.brokerage_memberships.find_by(brokerage_id: ...)` — missing `.without_deleted` — instead of reusing the already-memoized, correctly-scoped `current_membership` helper. Don't propagate this gap into the rewritten action.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Role-based request rejection | A new authorization concern/gem | `Admin::BaseController#require_owner!`/`#require_admin!`/`#current_membership` | Already exists, already tested via `admin_authorization_test.rb`, already wired into every admin controller |
| "Is this the last owner?" check | A model callback / validation on `BrokerageMembership` that blocks its own destroy/update | A plain `.count` query in the controller action, evaluated before the mutation | Model-level validations firing on every `BrokerageMembership` save/destroy (including unrelated ones, e.g. group membership changes) risk unintended side effects; a scoped controller-level check is simpler to reason about and test in isolation |
| Lightweight name+email serialization | A new `ActiveModel::Serializer` class + `AssociationLoader` wiring | A plain inline hash (`{id:, name:, email:}`) | Matches existing precedent (`InvitationsController#create`'s inline hash response); no computed/associative attributes, no N+1 risk to guard against, so the serializer machinery (built for association-loaded conditional attributes) is unneeded overhead |

**Key insight:** Every primitive this phase needs (auth guards, soft-delete scoping, pagination-bypass convention, nested controller namespacing) already has a canonical implementation elsewhere in this exact codebase. The task is disciplined reuse, not design.

## Runtime State Inventory

Not applicable — this phase adds new endpoints and tightens existing guards; it does not rename, refactor, or migrate any existing identifiers, stored data, or external service configuration. No rename/migration audit is required.

## Common Pitfalls

### Pitfall 1: Two inconsistent "forbidden" JSON shapes already exist in the exact code this phase touches

**What goes wrong:** `Admin::BaseController#require_owner!`/`#require_admin!` (via `render_forbidden`) render `{error: {code: "forbidden", message: "..."}}`. But `UsersController#update`'s existing inline owner-guard (line ~108-110) renders a flat `{error: "Only owners can assign the owner role"}` — no `code` key, no nesting. Tests that assert `body.dig("error", "code") == "forbidden"` only pass against the structured shape.
**Why it happens:** The inline value-level check was added ad hoc without reusing `render_forbidden`.
**How to avoid:** When rewriting `UsersController#update`/`#destroy` (D-01/D-02) and `InvitationsController#create` (D-03), decide *and document* one shape for the new inline rejections. Recommended: reuse `render_forbidden` (already available via inheritance) for the 403 cases, and a plain `{error: "..."}`/`{error: [...]}` shape only for genuine 422 validation-style rejections (last-owner, invalid role value) — mirroring `UsersController#update`'s existing 422 pattern for blank/invalid role (lines 104-105).
**Warning signs:** A new test asserting `body.dig("error", "code")` fails with `nil` because the response used a flat string instead of the nested `code`/`message` hash.

### Pitfall 2: `role: "owner"` transition-blocking on `UsersController#update` must check both directions, not just assignment

**What goes wrong:** The current guard (line 108) only blocks *assigning* `"owner"` when the caller isn't already an owner — it does nothing to stop an owner from *demoting another owner* via this same generic endpoint, which was the actual CR-02/CR-03-adjacent bypass path discovered during discussion (D-02).
**Why it happens:** The original guard was written defensively against privilege escalation (non-owner granting themselves/others owner) but never considered the generic endpoint as an undocumented demotion path.
**How to avoid:** The D-02 rewrite must reject the request whenever **either** `params[:user][:role] == "owner"` **or** the target's *current* `membership.role == "owner"` — regardless of caller role. This fully closes the endpoint to all owner-touching transitions, forcing every owner-role change through the new `/admin/settings/owners` endpoints (which alone carry the last-owner guard).
**Warning signs:** A test where an *owner* caller demotes another owner via `PATCH /v1/admin/users/:id` and it succeeds (200) instead of being rejected (403) — this is the exact regression D-02 exists to prevent.

### Pitfall 3: `InvitationsController#create`'s role guard must reject the *value*, not gate the whole action

**What goes wrong:** It would be tempting to add `before_action :require_owner!, only: [:create]`, but that would break existing behavior — admins (non-owners) must still be able to invite new `agent`/`admin` users; only the `role: "owner"` *value* is being locked down (D-03/LOCK-01), not the whole `create` action.
**Why it happens:** Conflating "lock down a value" with "lock down an action" is an easy mistake when the two guard helpers (`require_owner!` for actions, inline value checks for values) look superficially similar.
**How to avoid:** Add a value-level check inside `create` (after the existing `AppConstants::BROKERAGE_ROLES.include?(role)` check, alongside the existing `role == "client"` rejection at line 41): `return render json: {error: "The owner role cannot be assigned via invitation"}, status: :forbidden if role == "owner"`. Keep `before_action :require_admin!, only: [:create]` untouched.
**Warning signs:** A test where an `admin` caller successfully invites a new `agent` (should still succeed, 201) starts failing — signals the guard was mistakenly applied at the action level instead of the value level.

### Pitfall 4: `for_brokerage`/generic `.find_by(brokerage_id: ...)` calls in the two edited actions are missing `.without_deleted`

**What goes wrong:** `UsersController#update` (`membership = user.brokerage_memberships.find_by(brokerage_id: brokerage.id)`) and the `current_role` lookup (`Current.user.brokerage_memberships.find_by(brokerage_id: brokerage.id)`) both skip `.without_deleted`. If a user has a soft-deleted historical membership row for the same brokerage (edge case, but the schema allows it since `acts_as_paranoid` never hard-deletes), `find_by` could theoretically resolve inconsistently depending on default_scope behavior in the specific query form used.
**Why it happens:** Pre-existing gap, not introduced by this phase — but the phase's D-01/D-02 work touches these exact lines.
**How to avoid:** Since these lines are being rewritten anyway for D-01/D-02, add `.without_deleted` and prefer the inherited `current_membership` helper over re-deriving `current_role` manually.
**Warning signs:** None currently observed in production (this is a defense-in-depth fix, not a known live bug) — but CLAUDE.md's soft-delete convention is unconditional ("this applies to every model touched by a query"), so leaving it unscoped while touching the line anyway would be an avoidable convention violation introduced under review.

## Code Examples

### Existing owner-only action-guard precedent (verified, unmodified reference)
```ruby
# Source: backend/app/controllers/v1/admin/brokerages_controller.rb (lines 4-5)
skip_before_action :require_agent_or_above!, only: [:update]
before_action :require_owner!, only: [:update]
```

### Existing `paginate=false` bypass convention (verified, reference for D-06's *shape*, though owners/eligible skip Pagy entirely)
```ruby
# Source: backend/app/controllers/v1/admin/users_controller.rb (lines 44-48)
@pagy, users = if params[:paginate] == "false"
  [nil, users]
else
  pagy(users)
end
```

### Existing nested `uid`-as-param convention (verified, reference for how `:id`/`user_id` params resolve to `User#uid`, not the integer PK)
```ruby
# Source: backend/app/controllers/v1/admin/group/users_controller.rb (lines 8-9)
group = Current.brokerage.groups.find_by!(uid: params[:group_id])
user = User.for_brokerage(Current.brokerage.id).find_by!(uid: add_user_params[:user_id])
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `UsersController#update` partial owner-guard (assign-only, no demote/last-owner protection) | Full owner-transition lockdown (D-02) + dedicated `/admin/settings/owners` endpoints with last-owner guard (API-03/04) | This phase (33) | Closes CR-02/CR-03 takeover chain flagged at v1.10 close |
| `UsersController#destroy` — zero owner-specific guard | `require_owner!` + last-owner rejection when target is an owner (D-01) | This phase (33) | Prevents any admin from removing the brokerage's sole owner |
| `POST /admin/invitations` — no role-value restriction | Rejects `role: "owner"` invitations outright (D-03/LOCK-01) | This phase (33) | Owner promotion is only reachable via the new, owner-gated endpoint |

**Deprecated/outdated:** None — no libraries or Rails APIs are being deprecated by this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Promote endpoint's request body shape (`{ user: { user_id: <uid> } }`) and demote endpoint's shape (`{ user: { role: <newRole> } }`) — not specified in CONTEXT.md/REQUIREMENTS.md, inferred from existing `Group::UsersController#add_user_params` and `UsersController#update` conventions | Architecture Patterns, Code Examples | Low — this is a same-repo API contract with no external consumer yet (Phase 34/35 frontend hooks are written after this phase and will simply match whatever shape this phase ships); worth a quick explicit confirmation at plan time to avoid a rename later |
| A2 | Recommended HTTP status for last-owner/invalid-role rejections is 422 (`unprocessable_entity`), reserving 403 for pure authorization failures | Common Pitfalls, Code Examples | Low — CONTEXT.md explicitly delegates this to Claude's discretion; both codes are defensible, 422 chosen for consistency with `UsersController#update`'s existing blank/invalid-role checks |
| A3 | `eligible` and `index` (owners list) endpoints stay at the inherited `require_agent_or_above!` gate rather than being locked to `require_owner!` | Architecture Patterns Pattern 1 | Medium — if this assumption is wrong (i.e., product actually wants these owner-only too), Phase 34's SET-02 requirement (admin/agent read-only access to owner list) would need a different data-fetch path; flagged for planner/user confirmation since REQUIREMENTS.md's API-01/API-02 acceptance text is silent on caller-role restriction |

## Open Questions

1. **Exact request-body key names for the new promote/demote endpoints (A1 above)**
   - What we know: Existing conventions use `{ <resource>: { <field>: value } }` wrapping (e.g. `params.require(:user).permit(:user_id)`, `params.dig(:user, :role)`).
   - What's unclear: Whether the promote endpoint's target-user identifier should be wrapped in a `user:` key or sent flat as `user_id`/`uid` at the top level.
   - Recommendation: Follow the `{ user: { user_id: <uid> } }` / `{ user: { role: <newRole> } }` convention shown in Code Examples for consistency with `Group::UsersController` and `UsersController#update` — but treat this as a one-line confirmation item at plan time, not a blocking unknown.

2. **Should GET `/admin/settings/owners` and `/eligible` be locked to `require_owner!` instead of the inherited `require_agent_or_above!`?**
   - What we know: REQUIREMENTS.md SET-02 (Phase 34) requires admin/agent read-only access to the Ownership Management section, which implies the owner-list GET endpoint must be readable by non-owners.
   - What's unclear: Whether the `/eligible` endpoint (only ever called from the owner-only "Add Owner" UI) should be restricted further than `/owners`, since non-owners have no UI reason to call it.
   - Recommendation: Keep both at `require_agent_or_above!` for this phase (simplest, matches SET-02's forward need, and exposes no more than `/admin/users?role=admin` already would to the same audience) — revisit only if Phase 34 discussion surfaces a stricter requirement.

## Environment Availability

Skipped — this phase has no new external dependencies (no new gems, no new services, no new CLI tools). All work uses the existing Rails/Postgres/paranoia stack already running in this repo.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Unchanged — Cognito JWT verification via `CognitoAuth` concern, out of scope for this phase |
| V3 Session Management | No | JWT expiry (`TokenService::EXPIRY_DURATION = 24.hours`) unchanged; noted only as context for why DB-backed role checks matter more than JWT claims |
| V4 Access Control | Yes | Server-side, per-request, DB-backed role checks (`current_membership`) — never trust frontend gates or JWT claims payload; this is the core of the phase |
| V5 Input Validation | Yes | `AppConstants::BROKERAGE_ROLES.include?(role)` allowlist validation on every role-value param (already the existing pattern in `UsersController#update`/`InvitationsController#create`) |
| V6 Cryptography | No | No new crypto surface — `TokenService` (HS256 JWT signing) is unchanged by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Privilege escalation via generic update endpoint (admin promotes self/other to owner) | Elevation of Privilege | Value-level role guard on `UsersController#update` rejecting any `role: "owner"` transition (D-02) |
| Full brokerage takeover via owner removal (any admin destroys the sole owner's membership) | Elevation of Privilege / Denial of Service | `require_owner!` + last-owner COUNT guard on `UsersController#destroy` (D-01) and on the new demote endpoint (API-04) |
| Stale-JWT privilege retention (demoted user's token still carries old `role` claim for up to 24h) | Elevation of Privilege | Never read `claims["role"]` for authorization — always re-derive via `current_membership` (DB read), which this codebase already does everywhere except the phrasing risk noted in the Summary |
| Frontend-only enforcement bypass (role selector hidden but endpoint still accepts the value) | Tampering | LOCK-01's server-side value rejection is independent of and does not rely on LOCK-02's UI change — verified by the phase's own Success Criteria 1 vs. 2 being listed as separate, both-required conditions |

## Sources

### Primary (HIGH confidence — direct codebase verification)
- `backend/app/controllers/v1/admin/base_controller.rb` — `require_owner!`/`require_admin!`/`require_agent_or_above!`/`current_membership`/`render_forbidden` (full read)
- `backend/app/controllers/v1/admin/invitations_controller.rb` — `create` action, full read
- `backend/app/controllers/v1/admin/users_controller.rb` — `update`/`destroy` actions, full read
- `backend/app/controllers/v1/admin/brokerages_controller.rb` — `require_owner!`-on-one-action precedent, full read
- `backend/app/controllers/v1/account/calendar/connections_controller.rb` — nested-namespace-to-nested-module precedent, full read
- `backend/app/controllers/v1/admin/group/users_controller.rb` — `uid`-param convention precedent, full read
- `backend/app/models/brokerage_membership.rb`, `backend/app/models/user.rb` — full read
- `backend/app/services/token_service.rb`, `backend/app/controllers/concerns/cognito_auth.rb`, `backend/app/controllers/concerns/brokerage_auth.rb` — full read (JWT `role` claim never consumed, verified via grep)
- `backend/app/constants/roles.rb` — `AppConstants::BROKERAGE_ROLES`, full read
- `backend/config/routes.rb` — full read
- `backend/app/serializers/user_serializer.rb`, `backend/app/serializers/invitation_serializer.rb` — full read
- `backend/test/test_helper.rb`, `backend/test/integration/admin_authorization_test.rb`, `backend/test/integration/admin_brokerages_test.rb` — full read (Minitest/FactoryBot conventions, `auth_headers_for` helper)
- `backend/test/factories/brokerage_memberships.rb`, `backend/test/factories/users.rb` — full read
- `frontend/src/components/view/admin/brokerageView/addAgentView/AddAgentView.tsx` — full read (LOCK-02 exact line)
- `frontend/src/components/view/admin/common/RolePermissions.tsx`, `frontend/src/assets/types/roleType.ts` — full read
- `frontend/src/store/hooks/Admin/Users/useCreateAdminUser.tsx`, `frontend/src/assets/api/admin/users/createAdminUser.tsx` — full read
- `backend/Gemfile.lock` — `paranoia (3.0.0)` version confirmed

### Secondary (MEDIUM confidence)
- None — all findings for this phase were verifiable directly in the codebase; no external library research was needed.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; every primitive verified directly in the existing codebase
- Architecture: HIGH — every pattern recommended is a direct copy of an existing, working precedent in this exact repo
- Pitfalls: HIGH — all four pitfalls are grounded in specific line-level code reads, not speculation

**Research date:** 2026-07-12
**Valid until:** 30 days (stable, self-contained backend change; no fast-moving external dependency)
