# Phase 30: Backend RBAC Enforcement - Research

**Researched:** 2026-07-09
**Domain:** Rails 7.1 imperative authorization (before_action role gating), Minitest/FactoryBot integration testing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Un-enumerated endpoints**
- **D-01:** `/v1/admin/estates/search` and `/v1/admin/estates/cities` (top-level `V1::Admin::EstatesController`, distinct from the group-scoped `group/estates` controller) are NOT listed in RBAC-01/02/03. Decision: grant `agent` read access to these too, consistent with the milestone's "full read access everywhere" framing in PROJECT.md. Treat them as part of the same read-only tier as `boards#index` / `activity#index`.

**Test coverage**
- **D-02:** This phase must extend `backend/test/integration/admin_authorization_test.rb` (or equivalent) to cover the full new agent permission matrix — 2xx on every group-scoped and read-only endpoint, 403 on every write endpoint outside Groups scope — not just a minimal fix.
- **D-03 (blocking, must fix):** `admin_authorization_test.rb` currently has a test asserting `"agent role receives 403 on GET /v1/admin/users"` (line 21-26). This assertion is now WRONG under RBAC-02 and must be flipped to expect 200. This is a pre-existing test that will fail once the base authorization change lands — do not leave it red.

### Claude's Discretion
- Exact mechanism for splitting `require_admin!` into read/write/group tiers (e.g., broadening the base check and layering `skip_before_action` + a narrower write-only check per controller, following the existing `require_owner!` override pattern already used in `BrokeragesController` and `DomainsController`) — implementation detail, not a user decision.
- Naming of any new before_action/method introduced for the "owner/admin/agent read" tier.
- Response body shape for new 403s — match the existing `{ error: { code: "forbidden", message: "..." } }` shape used by `require_admin!` today (do not introduce a third format alongside `require_owner!`'s inconsistent `{ error: "..." }` shape — that inconsistency is pre-existing and out of scope to fix here).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. (`staff` role permissions and new granular `Permission` values are already recorded as Out of Scope in REQUIREMENTS.md, not raised as new ideas here.)
</user_constraints>

## Project Constraints (from CLAUDE.md)

Directives from `./CLAUDE.md` that apply to this phase's implementation:

- **Soft deletes (`acts_as_paranoid`):** Any query touching `BrokerageMembership` (or any other user-facing model) MUST scope with `.without_deleted`. The existing `require_admin!`/`require_owner!` methods already do this correctly for `BrokerageMembership.without_deleted.find_by(...)` — the new `require_agent_or_above!` method must reuse the identical scoped pattern (see Pitfall 4).
- **Imperative authorization, no gem:** "Authorization is imperative — no declarative gem. Use `Current.user` / `Current.brokerage` in controller actions." This phase must extend the existing `before_action` pattern in `V1::Admin::BaseController`, not introduce Pundit/CanCanCan or any other authorization gem.
- **Query objects:** Not directly applicable — this phase touches `before_action` role-gating, not query filtering logic. No new `app/queries/` object is needed.
- **Linting:** `bundle exec standardrb` must pass on all modified Ruby files (backend uses the `standard` gem, run from `backend/`).
- **Backend/frontend are separate git repos:** Commit code changes to `backend/` directly; this phase has no `frontend/` changes (confirmed backend-only per CONTEXT.md phase boundary).

## Summary

This phase adds a third authorization tier to `V1::Admin::BaseController` — a broadened "agent-or-above" check — and layers narrower `require_admin!`/`require_owner!` checks on top of it for the specific write actions that must stay blocked. The codebase already establishes this exact layering pattern in `DomainsController` (owner-only mutations stacked on top of the admin-or-above default, **without** `skip_before_action`) and in `BrokeragesController`/`InvitationsController` (`skip_before_action` + narrower `before_action` for actions that need to bypass the default entirely).

Direct inspection of all 13 `V1::Admin::*` controllers (Read tool, verified below) shows that **9 of the 13 need zero code changes** — they have no per-action override today, so broadening the base controller's default `before_action` from `require_admin!` to a new `require_agent_or_above!` gives them agent access automatically. Only 4 controllers need edits: `UsersController`, `BoardCredentialsController`, `BrokeragesController`, and `InvitationsController` (brokerage-level). `DomainsController` needs **no changes** despite having its own `before_action :require_owner!` — the stacking pattern already handles it correctly, which is a non-obvious finding worth flagging explicitly to the planner (easy to over-plan this file).

**Primary recommendation:** Rename `BaseController`'s default `before_action` target from `require_admin!` to a new `require_agent_or_above!` method (owner/admin/agent), keep `require_admin!` (owner/admin only) and `require_owner!` (owner only) as reusable narrower checks, and layer them via `before_action ..., only: [...]` (no `skip_before_action` needed except where a callback *name* referenced by existing `skip_before_action` calls changes).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Role-based endpoint gating (owner/admin/agent/client) | API / Backend (`V1::Admin::BaseController` and subclasses) | — | Imperative `before_action` checks are the established pattern (no gem); all authorization logic lives in controllers per CLAUDE.md |
| Membership role lookup | Database / Storage (`BrokerageMembership` model, `.without_deleted` scope) | API / Backend | Soft-deleted memberships must never grant access — `acts_as_paranoid` convention applies here same as everywhere else |
| Test coverage of the permission matrix | API / Backend (Minitest integration tests) | — | `backend/test/integration/admin_authorization_test.rb` is the existing home for this; extending it (not creating a new file) matches D-02 |

This phase has no Browser/Frontend Server/CDN component — it is entirely API/Backend + Database tier work.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RBAC-01 | All group-scoped endpoints (`groups`, `group/users`, `group/invitations`, `group/filter_sets`, `group/estates`) accept `agent` | Confirmed: these 5 controllers have zero per-action overrides today — broadening `BaseController`'s default filter grants full CRUD automatically. See "Controller Inventory" table. |
| RBAC-02 | Read-only admin endpoints (`users#index/show`, `brokerages#show`, `domains#index/verify`, `boards#index`, `board_credentials#index`, `activity#stats/index`) accept `agent` | Confirmed per-controller: some inherit the broadened default for free (Boards, Activity, Domains#index/verify, Brokerages#show), others need a narrower write-only override added alongside the broadened default (Users#index/show, BoardCredentials#index). Plus D-01: top-level `EstatesController#search/cities` also inherits for free. |
| RBAC-03 | All write endpoints outside Groups scope (`users#update/destroy`, `brokerages#update`, domain mutations, `board_credentials#create/update/destroy`, brokerage-level invitations) reject `agent` with 403 | Confirmed per-controller: `require_admin!`/`require_owner!` stacked or scoped onto exactly these actions. `InvitationsController` (brokerage-level) needs explicit attention per CONTEXT.md warning — see Pitfall 1. |
</phase_requirements>

## Standard Stack

No new dependencies. This phase is a controller-logic change only.

| Component | Version (verified) | Role |
|-----------|---------------------|------|
| Rails | 7.1.5 (`Gemfile`: `~> 7.1.4`) | `before_action`/`skip_before_action` callback chain — the only mechanism used |
| Ruby | 4.0.2 | Runtime |
| Minitest | via `rails/test_help` (Rails default) | Integration test framework already in use |
| FactoryBot | `factory_bot_rails ~> 6.5` | Test fixtures (`:agent` trait already exists on `brokerage_membership` factory) |
| shoulda-matchers | configured in `test_helper.rb` | Not directly relevant to this phase's tests, but present in the suite |

**Installation:** None — no new gems needed.

## Architecture Patterns

### System Architecture Diagram

```
HTTP request (agent JWT, e.g. GET /v1/admin/users)
        │
        ▼
BrokerageAuth#resolve_brokerage  (Current.brokerage from Host header)
        │
        ▼
CognitoAuth#authenticate_cognito_user!  (verifies JWT, sets Current.user)
        │
        ▼
V1::Admin::BaseController before_action chain:
   1. require_agent_or_above!  ← NEW default (was require_admin!)
        │   looks up BrokerageMembership.without_deleted
        │   allows: owner, admin, agent  →  continue
        │   else                          →  render 403, chain halts
        ▼
   2. [optional, per-controller] require_admin!  or  require_owner!
        │   only:[write actions] — re-checks with a NARROWER role set
        │   allows: owner, admin (require_admin!) or owner only (require_owner!)
        │   else → render 403, chain halts (no double-render: step 1
        │           already passed, so this is the first render call)
        ▼
Controller action executes → 2xx response
```

The key architectural fact: **stacking two `before_action`s where the second is a subset check of the first requires no `skip_before_action`.** If the first (broader) check fails, it renders and halts the chain — the second callback never runs, so there's no double-render risk. This is already proven in production code (`DomainsController`, see below) — verified by reading the file, not assumed.

### Recommended Project Structure

No new files or directories. All changes are edits to existing controllers under:
```
backend/app/controllers/v1/admin/
├── base_controller.rb              # add require_agent_or_above!, rename default before_action
├── users_controller.rb             # add narrow before_action for update/destroy
├── board_credentials_controller.rb # add narrow before_action for create/update/destroy
├── brokerages_controller.rb        # rename skip_before_action target
├── invitations_controller.rb       # rename skip_before_action target + add narrow before_action
├── domains_controller.rb           # NO CHANGE (stacking already correct)
├── boards_controller.rb            # NO CHANGE
├── activity_controller.rb          # NO CHANGE
├── estates_controller.rb           # NO CHANGE (D-01 — inherits for free)
├── groups_controller.rb            # NO CHANGE
└── group/
    ├── estates_controller.rb       # NO CHANGE
    ├── filter_sets_controller.rb   # NO CHANGE
    ├── invitations_controller.rb   # NO CHANGE
    └── users_controller.rb         # NO CHANGE
```

### Controller Inventory (all 13, verified by reading each file)

| # | Controller | Current before_action chain | Change needed | Requirement |
|---|-----------|------------------------------|----------------|-------------|
| 1 | `BaseController` | `authenticate_cognito_user!`, `require_admin!` (owner+admin) | **YES** — add `require_agent_or_above!` method, make it the new default; keep `require_admin!`/`require_owner!` as reusable narrower methods | Enables all three RBAC reqs |
| 2 | `UsersController` | default only (`index/show/update/destroy`) | **YES** — add `before_action :require_admin!, only: [:update, :destroy]` | RBAC-02 (index/show free), RBAC-03 (update/destroy blocked) |
| 3 | `BoardCredentialsController` | default only (`index/create/update/destroy`) | **YES** — add `before_action :require_admin!, only: [:create, :update, :destroy]` | RBAC-02 (index free), RBAC-03 (create/update/destroy blocked) |
| 4 | `BrokeragesController` | `skip_before_action :require_admin!, only:[:update]` + `before_action :require_owner!, only:[:update]` | **YES** — rename skip target: `skip_before_action :require_agent_or_above!, only:[:update]` (callback name changed) | RBAC-02 (show free), RBAC-03 (update blocked, unchanged owner-only semantics) |
| 5 | `DomainsController` | default + `before_action :require_owner!, only:%i[subdomain custom destroy set_primary]` (no skip) | **NO CHANGE** — stacking already correct; index/verify inherit agent access, the 4 mutation actions stay owner-only regardless of default rename | RBAC-02 (index/verify free), RBAC-03 (mutations blocked) |
| 6 | `InvitationsController` (brokerage-level) | `skip_before_action :require_admin!, only:[:accept_invitation,:decline_invitation,:validate_token]`, `skip_before_action :authenticate_cognito_user!, only:[:validate_token]` | **YES** — rename first skip target to `:require_agent_or_above!`; add `before_action :require_admin!, only:[:index,:create,:validate,:destroy]` | RBAC-03 — must stay FULLY blocked for agent (ACCESS-07). See Pitfall 1. |
| 7 | `EstatesController` (top-level, `cities`/`search`) | default only | **NO CHANGE** — inherits agent access automatically | RBAC-02 + D-01 |
| 8 | `BoardsController` (`index`) | default only | **NO CHANGE** | RBAC-02 |
| 9 | `ActivityController` (`index`/`stats`) | default only | **NO CHANGE** | RBAC-02 |
| 10 | `GroupsController` | default only (+ `set_group` before_action, unrelated to auth) | **NO CHANGE** | RBAC-01 |
| 11 | `Group::EstatesController` | default only | **NO CHANGE** | RBAC-01 |
| 12 | `Group::FilterSetsController` | default only | **NO CHANGE** | RBAC-01 |
| 13 | `Group::InvitationsController` | default only | **NO CHANGE** | RBAC-01 |
| 14 | `Group::UsersController` | default only | **NO CHANGE** | RBAC-01 |

(13 controllers inherit `BaseController` per CONTEXT.md's count — the table above lists `BaseController` itself as row 1 plus the 13 subclasses, so 13 subclasses total, matching the phase description.)

`grep -rn "require_admin!\|require_owner!" app/controllers` confirms these are the ONLY 4 files (besides `base_controller.rb`) that reference either method — no other controller in the app touches this authorization mechanism. `[VERIFIED: grep against backend/app/controllers]`

### Pattern 1: Broadened default + stacked narrower check (no skip)

**What:** Rename the base filter, then add a second, narrower `before_action` scoped to only the write actions that must exclude `agent`.
**When to use:** When a controller's write actions need MORE restriction than the new default, and there is no pre-existing `skip_before_action` referencing the old filter name for those same actions.
**Example (already proven in this codebase — `DomainsController`, unchanged by this phase):**
```ruby
# Source: backend/app/controllers/v1/admin/domains_controller.rb (read directly, lines 1-7)
module V1
  module Admin
    class DomainsController < V1::Admin::BaseController
      # require_admin! is the default from BaseController — applies to index (D-10).
      # Mutations require owner role (D-11).
      before_action :require_owner!, only: %i[subdomain custom destroy set_primary]
      # ... after this phase's rename, the base default becomes require_agent_or_above!,
      # but this line is untouched — require_owner! is still strictly narrower and still
      # stacks correctly (agent passes the base check, then fails this one → 403).
```
Apply the same no-skip stacking for `UsersController` and `BoardCredentialsController` (new code, same pattern):
```ruby
# UsersController — only 1 line added
class UsersController < V1::Admin::BaseController
  before_action :require_admin!, only: [:update, :destroy]
  # index/show fall through to the new default require_agent_or_above! — agent gets 2xx
end

# BoardCredentialsController — only 1 line added
class BoardCredentialsController < V1::Admin::BaseController
  before_action :require_admin!, only: [:create, :update, :destroy]
  # index falls through to the new default — agent gets 2xx
end
```

### Pattern 2: skip_before_action + narrower before_action (rename required)

**What:** Where a controller already has `skip_before_action :require_admin!, only: [...]`, that line must be updated to reference the new default filter name (`:require_agent_or_above!`), or Rails will raise `ArgumentError` at load time (`skip_before_action` errors if the named callback isn't registered in the chain).
**When to use:** `BrokeragesController` and `InvitationsController` — both currently skip `:require_admin!` for specific actions that must bypass role-checking entirely (self-service invitation actions, owner-only update).
**Example:**
```ruby
# BrokeragesController — rename only, before_action :require_owner! is unchanged
class BrokeragesController < V1::Admin::BaseController
  skip_before_action :require_agent_or_above!, only: [:update]  # was :require_admin!
  before_action :require_owner!, only: [:update]
```
```ruby
# InvitationsController (brokerage-level) — rename + add narrow write-tier check
class InvitationsController < V1::Admin::BaseController
  skip_before_action :require_agent_or_above!, only: [:accept_invitation, :decline_invitation, :validate_token]  # was :require_admin!
  skip_before_action :authenticate_cognito_user!, only: [:validate_token]
  before_action :require_admin!, only: [:index, :create, :validate, :destroy]  # NEW line — keeps agent fully blocked
```

### Pattern 3: Shared membership-lookup extraction (DRY refactor, optional but recommended)

**What:** `require_admin!` and `require_owner!` currently duplicate the exact same `BrokerageMembership.without_deleted.find_by(...)` lookup. Adding a third method (`require_agent_or_above!`) triples this duplication unless extracted.
**When to use:** In `BaseController`, when adding the third check.
**Example:**
```ruby
# Source: refactor of backend/app/controllers/v1/admin/base_controller.rb
module V1
  module Admin
    class BaseController < ApplicationController
      include BrokerageAuth
      include CognitoAuth
      include Pagy::Backend

      before_action :authenticate_cognito_user!
      before_action :require_agent_or_above!

      private

      def require_agent_or_above!
        render_forbidden unless current_membership && %w[owner admin agent].include?(current_membership.role)
      end

      def require_admin!
        render_forbidden unless current_membership && %w[owner admin].include?(current_membership.role)
      end

      def require_owner!
        unless current_membership&.role == "owner"
          render json: { error: { code: "forbidden", message: "Owner access required." } }, status: :forbidden
        end
      end

      private

      def current_membership
        @current_membership ||= BrokerageMembership.without_deleted.find_by(
          user_id: Current.user.id,
          brokerage_id: Current.brokerage.id
        )
      end

      def render_forbidden
        render json: { error: { code: "forbidden", message: "You do not have permission to perform this action." } },
               status: :forbidden
      end
    end
  end
end
```
Note: `require_owner!`'s error shape (`{ error: "..." }`... actually it already uses the nested `{ error: { code:, message: } }` shape too — re-verify against the live file before assuming; CONTEXT.md's D- note about "require_owner!'s inconsistent `{ error: "..." }` shape" should be re-checked against the current file content, since the version read during this research (`base_controller.rb` lines 24-33) shows `require_owner!` ALREADY uses the same nested `{ error: { code: "forbidden", message: "Owner access required." } }` shape as `require_admin!` — see Open Questions.

### Anti-Patterns to Avoid

- **Broadening `require_admin!` in place (renaming its meaning) instead of adding a new method:** would silently change the semantics of every existing `require_admin!` call site across `DomainsController`'s comments and any future code that assumes `require_admin!` means "owner/admin only." Keep `require_admin!`'s existing owner+admin semantics untouched; add a new, distinctly-named method for the broadened tier.
- **Using `skip_before_action` where stacking would work:** unnecessary complexity. Only rename/add `skip_before_action` where a callback's *name* changed (Pattern 2) or where an action needs to skip role-checking entirely (self-service invitation actions). Don't skip-and-reapply where a plain narrower `before_action` (Pattern 1) suffices — matches the existing `DomainsController` precedent.
- **Forgetting `InvitationsController`'s `validate` action:** RBAC-03 doesn't explicitly enumerate `validate`, but ACCESS-07 ("no view, no create") implies the whole controller stays blocked for agent except the 3 pre-authenticated self-service actions. Omitting `validate` from the `require_admin!` override list would leave it on the broadened default — an accidental agent read/write surface into brokerage invitations.
- **Editing `DomainsController`:** verified via direct source read that no change is needed here. Planner and executor should NOT add a task to touch this file — doing so risks accidentally breaking the working stack (e.g., adding an unnecessary `skip_before_action` that could shadow `require_owner!` inadvertently).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Role hierarchy checks | A new `Permission`/gem-based ACL system | The existing imperative `before_action` pattern (`require_agent_or_above!`/`require_admin!`/`require_owner!`) | CLAUDE.md and ROLES.md both state authorization is imperative by design, no gem — this phase's whole purpose is converging remaining ad-hoc checks toward the shared pattern, not introducing a new one |
| Membership role lookup | A new query object or service class | The existing `BrokerageMembership.without_deleted.find_by(...)` inline pattern already used by `require_admin!`/`require_owner!` | ROLES.md explicitly instructs: "New code should converge toward the shared pattern... not add a third variant" |
| Agent/client role checks outside `V1::Admin` | New `membership&.role&.in?(...)` ad hoc checks (as seen in `onboarding/domains_controller.rb` — a known pre-existing gap, NOT part of this phase) | N/A for this phase — `onboarding/domains_controller.rb`'s ad hoc check is out of scope; do not "fix" it as a drive-by in this phase | Phase boundary in CONTEXT.md is explicit: backend-only, `V1::Admin::BaseController` and its subclasses only |

**Key insight:** This phase is entirely about extending an existing 2-method pattern to 3 methods and applying it consistently — it is a textbook case where "the framework already has the mechanism, just use it more" beats any new abstraction.

## Common Pitfalls

### Pitfall 1: Broadening the default accidentally opens `InvitationsController` (brokerage-level) to agent
**What goes wrong:** If the base filter is renamed to `require_agent_or_above!` and `InvitationsController` is NOT also updated, `index`, `create`, `validate`, and `destroy` all silently become agent-accessible (they currently rely entirely on the inherited default with no override), violating RBAC-03 and ACCESS-07.
**Why it happens:** This controller looks like "no override needed" at a glance (like the 9 other zero-change controllers), but CONTEXT.md and REQUIREMENTS.md both single it out as needing to stay fully blocked — it's the one exception to the "no per-action override = free agent CRUD" heuristic.
**How to avoid:** Explicitly add `before_action :require_admin!, only: [:index, :create, :validate, :destroy]` to this controller as part of the same commit that renames the base default. Do not treat this controller as "already fine."
**Warning signs:** A test asserting `agent` gets 403 on `GET /v1/admin/invitations` or `POST /v1/admin/invitations` failing after the base rename — this must be caught by the extended test matrix (D-02).

### Pitfall 2: `skip_before_action` raising `ArgumentError` after the base filter rename
**What goes wrong:** `BrokeragesController` and `InvitationsController` both call `skip_before_action :require_admin!, only: [...]` today. Once `BaseController`'s default `before_action` target is renamed to `require_agent_or_above!`, these `skip_before_action` calls reference a callback that Rails may no longer find registered for those actions in the way expected, raising `ArgumentError: skip_before_action ... a before_action callback was not found` at boot/test-load time (Rails' `set_callback`/`skip_callback` raises by default unless `raise: false` is passed).
**Why it happens:** `skip_before_action` requires the named callback to exist somewhere in the filter chain being modified; renaming the callback method without updating all references breaks this silently until the app boots or the controller's test suite runs.
**How to avoid:** Grep for every `skip_before_action :require_admin!` and `before_action :require_admin!` call site (already enumerated above — only `invitations_controller.rb` and `brokerages_controller.rb` have `skip_before_action`) and update in the same commit as the `BaseController` rename. Run `rails runner "V1::Admin::InvitationsController"` or the full test suite immediately after the rename to catch this class of error fast — it will surface as a load-time error, not a runtime 403/2xx mismatch.
**Warning signs:** Any test in `admin_authorization_test.rb` or `board_credential_crud_test.rb` erroring (not failing — erroring) with `ArgumentError` mentioning a callback name.

### Pitfall 3: Assuming `DomainsController` needs an update
**What goes wrong:** A planner scanning "which controllers have `before_action :require_owner!`" might assume this file needs a `skip_before_action` for its default too, mirroring the `BrokeragesController` fix.
**Why it happens:** Surface-level pattern matching — `DomainsController` "looks like" `BrokeragesController` (both stack `require_owner!` for some actions).
**How to avoid:** The critical difference: `DomainsController` never calls `skip_before_action :require_admin!` anywhere — it relies purely on stacking (Pattern 1), which is unaffected by the base method's rename. Verified by reading the full file (`backend/app/controllers/v1/admin/domains_controller.rb`, lines 1-7) — no `skip_before_action` present.
**Warning signs:** A plan task that says "update DomainsController" — this should be flagged as unnecessary during plan review.

### Pitfall 4: Soft-deleted memberships bypassing the new check
**What goes wrong:** If a new query for the agent tier check doesn't scope with `.without_deleted`, a user whose `BrokerageMembership` was soft-deleted (e.g., removed from the brokerage) could still pass `require_agent_or_above!` if a stale/cached membership record is found.
**Why it happens:** This is a project-wide `acts_as_paranoid` convention (CLAUDE.md) that's easy to forget when adding a new method that superficially resembles existing ones.
**How to avoid:** Reuse the exact same `BrokerageMembership.without_deleted.find_by(...)` pattern already used by `require_admin!`/`require_owner!` (see Pattern 3 code example) — do not write a new query.
**Warning signs:** A test using `create(:brokerage_membership, :agent).destroy` (soft delete) still returning 2xx from a group-scoped endpoint.

### Pitfall 5: Test matrix gaps — writing only "agent" tests, not the full 5-role matrix
**What goes wrong:** D-02 requires the FULL matrix (2xx on every group-scoped + read-only endpoint for agent, 403 on every write endpoint outside Groups for agent) — not just spot-checks. It's easy to under-cover by only testing 2-3 representative endpoints instead of the full enumerated list in RBAC-01/02/03.
**Why it happens:** Enumerating ~20 endpoint/role combinations is tedious; developers (and agents) tend to sample rather than exhaustively cover.
**How to avoid:** Build the test list directly from the REQUIREMENTS.md endpoint enumeration (verbatim) — treat each named endpoint as one required test row. See Validation Architecture below for the concrete map.
**Warning signs:** Plan review / verify-work finds an endpoint listed in RBAC-01/02/03 with no corresponding test in `admin_authorization_test.rb`.

## Code Examples

### Full BaseController after the change
```ruby
# Source: refactor of backend/app/controllers/v1/admin/base_controller.rb (read directly, current version 36 lines)
module V1
  module Admin
    class BaseController < ApplicationController
      include BrokerageAuth
      include CognitoAuth
      include Pagy::Backend

      before_action :authenticate_cognito_user!
      before_action :require_agent_or_above!

      private

      def require_agent_or_above!
        render_forbidden unless current_membership && %w[owner admin agent].include?(current_membership.role)
      end

      def require_admin!
        render_forbidden unless current_membership && %w[owner admin].include?(current_membership.role)
      end

      def require_owner!
        unless current_membership&.role == "owner"
          render json: { error: { code: "forbidden", message: "Owner access required." } },
                 status: :forbidden
        end
      end

      def current_membership
        @current_membership ||= BrokerageMembership.without_deleted.find_by(
          user_id: Current.user.id,
          brokerage_id: Current.brokerage.id
        )
      end

      def render_forbidden
        render json: { error: { code: "forbidden", message: "You do not have permission to perform this action." } },
               status: :forbidden
      end
    end
  end
end
```

### Existing test pattern to extend (fixtures already present)
```ruby
# Source: backend/test/integration/admin_authorization_test.rb (read directly)
# @owner, @admin, @agent, @client all already created via create(:brokerage_membership, :TRAIT, ...)
# auth_headers_for(user, brokerage) helper already mints a real JWT — reuse as-is.

# D-03 fix (flip the wrong assertion):
test "agent role receives 200 on GET /v1/admin/users" do
  get "/v1/admin/users", headers: auth_headers_for(@agent, @brokerage)
  assert_response :ok
end

# New coverage pattern for a write endpoint that must stay blocked:
test "agent role receives 403 on PATCH /v1/admin/users/:id" do
  patch "/v1/admin/users/#{@agent.uid}",
    params: { user: { role: "admin" } },
    headers: auth_headers_for(@agent, @brokerage)
  assert_response :forbidden
  body = JSON.parse(response.body)
  assert_equal "forbidden", body.dig("error", "code")
end
```

## State of the Art

Not applicable — this is a self-contained internal pattern, not tracking an external library's evolving API. No deprecated/outdated external references.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `require_owner!`'s current 403 body already uses the same `{ error: { code:, message: } }` nested shape as `require_admin!`, contradicting CONTEXT.md's note about an "inconsistent `{ error: \"...\" }` shape" | Pattern 3 / Open Questions | Low — this is a documentation/doc-drift discrepancy, not a functional risk. Verified directly against the live file (`base_controller.rb` lines 24-33) — the shapes actually already match. Flagged for planner awareness, not a blocker. |
| A2 | `InvitationsController`'s `validate` action should be included in the agent-blocked set (not explicitly listed in RBAC-03's endpoint enumeration, only implied by ACCESS-07 "no view, no create") | Common Pitfall 1, Controller Inventory row 6 | Medium — if wrong, `validate` would need to move to the agent-allowed tier instead. Given CONTEXT.md's explicit "must stay fully blocked" instruction for this controller and ACCESS-07's "no view, no create" framing, blocking is the safer and better-supported reading. Recommend confirming with a test assertion during planning rather than treating as settled. |

## Open Questions (RESOLVED)

1. **Does `require_owner!`'s current error shape actually differ from `require_admin!`'s, as CONTEXT.md states?**
   - What we know: Direct read of `base_controller.rb` (current, pre-phase) shows BOTH `require_admin!` and `require_owner!` already render `{ error: { code: "forbidden", message: "..." } }` — the same nested shape, just different `code`/`message` values (`require_owner!` uses `message: "Owner access required."` with no explicit `code` key value shown... actually re-checking: `require_owner!` renders `{ error: { code: "forbidden", message: "Owner access required." } }` — wait, verify: line 30 shows `render json: { error: { code: "forbidden", message: "Owner access required." } }, status: :forbidden`. This DOES include a `code` key. So both already match structurally.
   - What's unclear: CONTEXT.md's D- note references "`require_owner!`'s inconsistent `{ error: \"...\" }` shape" as a known pre-existing issue — this may refer to a different, non-`V1::Admin` code path (e.g., `onboarding/domains_controller.rb`'s ad hoc check) rather than `base_controller.rb`'s own `require_owner!`.
   - Recommendation: No action needed for this phase either way — CONTEXT.md already scopes shape-matching as "out of scope to fix," so the planner should simply have the new `require_agent_or_above!` method mirror `require_admin!`'s exact shape (which it already does in the Pattern 3 example) and not worry about `require_owner!`.

2. **Should `Group::FilterSetsController#preview` and `check_name` (GroupsController) be explicitly tested, or are they covered implicitly by "all group-scoped endpoints"?**
   - What we know: Both actions have no per-action override and inherit the broadened default like every other action in their controllers.
   - What's unclear: Whether RBAC-01's endpoint list (`groups`, `group/users`, `group/invitations`, `group/filter_sets`, `group/estates`) is meant at the controller level (implying every action within) or the resource level (implying only the RESTful CRUD actions, not extra collection routes like `preview`/`check_name`/`search`).
   - Recommendation: Test at the controller level (every action) since D-02 asks for "the full new agent permission matrix" — the safest and most complete reading. No functional risk either way since these actions get agent access "for free" regardless of whether they're explicitly tested.

## Environment Availability

Skipped — this phase is a Ruby/Rails code change with no new external tool, service, or runtime dependency. Existing dev environment (Rails 7.1.5, Ruby 4.0.2, already-installed gems) is sufficient.

## Validation Architecture

> `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json` — this section is included anyway as a lightweight reference since the phase is inherently test-heavy (D-02 mandates full matrix coverage), but is not required scaffolding.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Minitest (Rails default) + FactoryBot 6.5 |
| Config file | `backend/test/test_helper.rb` (integration test base class + `auth_headers_for` helper) |
| Quick run command | `RAILS_ENV=test bundle exec rails test test/integration/admin_authorization_test.rb` |
| Full suite command | `RAILS_ENV=test bundle exec rails test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RBAC-01 | agent 2xx on groups/index,show,create,update,destroy,check_name | integration | `rails test test/integration/admin_authorization_test.rb` | ✅ (extend) |
| RBAC-01 | agent 2xx on group/users create,destroy | integration | same file | ✅ (extend) |
| RBAC-01 | agent 2xx on group/invitations index,create,update,destroy (validate route is orphaned — no controller action, intentionally not tested) | integration | same file | ✅ (extend) |
| RBAC-01 | agent 2xx on group/filter_sets index,create,update,destroy,preview | integration | same file | ✅ (extend) |
| RBAC-01 | agent 2xx on group/estates index,create,destroy,search | integration | same file | ✅ (extend) |
| RBAC-02 | agent 2xx on users#index/show, brokerages#show, domains#index/verify, boards#index, board_credentials#index, activity#stats/index, estates#search/cities | integration | same file | ✅ (extend) |
| RBAC-03 | agent 403 on users#update/destroy, brokerages#update, domains#subdomain/custom/destroy/set_primary, board_credentials#create/update/destroy, admin/invitations#index/create/validate/destroy | integration | same file | ✅ (extend, includes D-03 flip) |

### Sampling Rate
- **Per task commit:** `RAILS_ENV=test bundle exec rails test test/integration/admin_authorization_test.rb`
- **Per wave merge:** `RAILS_ENV=test bundle exec rails test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
None — `admin_authorization_test.rb` already exists with `@owner`/`@admin`/`@agent`/`@client` fixtures and the `auth_headers_for` helper (verified by reading the file); no new test infrastructure needed, only new `test` blocks and one flipped assertion (D-03).

## Security Domain

`security_enforcement` is absent from `.planning/config.json` — treated as enabled per protocol.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (unchanged) | Handled upstream by `CognitoAuth#authenticate_cognito_user!` — out of scope for this phase |
| V3 Session Management | No (unchanged) | JWT-based, unaffected by this phase |
| V4 Access Control | **Yes — this IS the phase** | Imperative `before_action` role checks in `V1::Admin::BaseController` subclasses; enforce least-privilege by explicit allow-list of roles per tier (`%w[owner admin agent]` / `%w[owner admin]` / `owner` only) |
| V5 Input Validation | No (unchanged) | Not touched by this phase |
| V6 Cryptography | No (unchanged) | Not touched by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege escalation via missing per-action override (an endpoint silently inherits a broader default than intended) | Elevation of Privilege | Explicit enumeration of every controller's before_action chain (this research's Controller Inventory table) before broadening any default; full permission-matrix test coverage (D-02) as a regression guard |
| Soft-deleted membership still granting access (stale role check bypassing `acts_as_paranoid`) | Elevation of Privilege | Always scope membership lookups with `.without_deleted` (Pitfall 4) — reuse existing pattern, don't hand-roll a new query |
| IDOR via cross-brokerage access (not this phase's concern directly, but adjacent) | Information Disclosure / Tampering | Already handled by `Current.brokerage` scoping in each action (e.g., `Current.brokerage.groups.find_by!(uid: ...)`) — unaffected by this phase, no new IDOR surface introduced since role checks are brokerage-membership-scoped by construction |

## Sources

### Primary (HIGH confidence)
- `backend/app/controllers/v1/admin/base_controller.rb` — read directly, full file (36 lines)
- `backend/app/controllers/v1/admin/brokerages_controller.rb` — read directly, full file (103 lines)
- `backend/app/controllers/v1/admin/domains_controller.rb` — read directly, full file (284 lines)
- `backend/app/controllers/v1/admin/users_controller.rb` — read directly, full file (147 lines)
- `backend/app/controllers/v1/admin/boards_controller.rb` — read directly, full file (18 lines)
- `backend/app/controllers/v1/admin/board_credentials_controller.rb` — read directly, full file (142 lines)
- `backend/app/controllers/v1/admin/activity_controller.rb` — read directly, full file (31 lines)
- `backend/app/controllers/v1/admin/invitations_controller.rb` — read directly, full file (275 lines)
- `backend/app/controllers/v1/admin/estates_controller.rb` — read directly, full file (37 lines)
- `backend/app/controllers/v1/admin/groups_controller.rb` — read directly, full file (125 lines)
- `backend/app/controllers/v1/admin/group/estates_controller.rb` — read directly, full file (200 lines)
- `backend/app/controllers/v1/admin/group/filter_sets_controller.rb` — read directly, full file (204 lines)
- `backend/app/controllers/v1/admin/group/invitations_controller.rb` — read directly, full file (93 lines)
- `backend/app/controllers/v1/admin/group/users_controller.rb` — read directly, full file (46 lines)
- `backend/config/routes.rb` — read directly, confirmed full route table for `/v1/admin/**`
- `backend/test/integration/admin_authorization_test.rb` — read directly, confirms the wrong D-03 assertion and existing fixture setup
- `backend/test/factories/brokerage_memberships.rb` — read directly, confirms `:agent` trait exists
- `backend/test/test_helper.rb` — read directly, confirms Minitest + `auth_headers_for` helper
- `backend/test/integration/board_credential_crud_test.rb` — read directly, confirms existing test conventions for board_credentials
- `backend/app/constants/roles.rb` — read directly, confirms `agent` already in `BROKERAGE_ROLES`
- `grep -rn "require_admin!\|require_owner!" app/controllers` — command run directly, confirms these are the only 4 files (plus base) using the mechanism
- `.planning/phases/30-backend-rbac-enforcement/30-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROLES.md` — read directly

### Secondary (MEDIUM confidence)
None used — this phase required no external library research; all findings are direct codebase inspection.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, versions confirmed via `bundle exec rails --version` and `ruby -v`
- Architecture: HIGH — every controller file read directly, patterns cross-verified against live code (not inferred)
- Pitfalls: HIGH — each pitfall traced to a specific, verified line of existing code or an explicit CONTEXT.md warning

**Research date:** 2026-07-09
**Valid until:** Indefinite for the architectural pattern (internal code, not a moving external dependency) — re-verify controller inventory if any `V1::Admin::*` controller is added/removed before this phase executes.
