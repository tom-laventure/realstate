# Phase 30: Backend RBAC Enforcement - Pattern Map

**Mapped:** 2026-07-09
**Files analyzed:** 6 (all modified, 0 new)
**Analogs found:** 6 / 6 (self-analogs — this phase edits existing controllers using an existing sibling pattern already proven in `domains_controller.rb`)

**Note on scope:** This phase creates zero new files. All "patterns" below are precise edits to existing controllers, each following a pattern already proven elsewhere in the same codebase (`domains_controller.rb`'s stacking approach). No file needs an external analog — the analog for each file is either itself (before/after diff) or `domains_controller.rb` (the reference implementation of the stacking technique). 8 controllers require zero code changes (see "No Change Required" below) — do not create plan tasks for them.

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/controllers/v1/admin/base_controller.rb` | middleware (auth base) | request-response | itself (add 3rd tier method) — technique proven in same file's existing `require_admin!`/`require_owner!` pair | exact (self) |
| `backend/app/controllers/v1/admin/users_controller.rb` | controller | CRUD | `backend/app/controllers/v1/admin/domains_controller.rb` (Pattern 1: stack narrower `before_action`, no skip) | exact |
| `backend/app/controllers/v1/admin/board_credentials_controller.rb` | controller | CRUD | `backend/app/controllers/v1/admin/domains_controller.rb` (Pattern 1: stack narrower `before_action`, no skip) | exact |
| `backend/app/controllers/v1/admin/brokerages_controller.rb` | controller | CRUD | itself — rename existing `skip_before_action` target only, `require_owner!` stack unchanged | exact (self) |
| `backend/app/controllers/v1/admin/invitations_controller.rb` | controller | CRUD | itself for the skip-rename + `brokerages_controller.rb` for the `skip_before_action` pattern; `users_controller.rb` (this phase) for the added narrow `before_action` list | exact |
| `backend/test/integration/admin_authorization_test.rb` | test | request-response | itself — existing test block structure (lines 21-52), extend with same shape | exact (self) |

## No Change Required (verified — do not edit)

Per RESEARCH.md's Controller Inventory, these 8 controllers have no per-action authorization override today and automatically inherit agent access once `base_controller.rb`'s default is broadened. Flag any plan task targeting these files as unnecessary:

| File | Reason |
|---|---|
| `backend/app/controllers/v1/admin/domains_controller.rb` | Already stacks `require_owner!` with no `skip_before_action` — rename-proof by construction. **Do not touch.** |
| `backend/app/controllers/v1/admin/estates_controller.rb` | `search`/`cities` inherit broadened default (D-01) |
| `backend/app/controllers/v1/admin/boards_controller.rb` | `index` inherits broadened default |
| `backend/app/controllers/v1/admin/activity_controller.rb` | `index`/`stats` inherit broadened default |
| `backend/app/controllers/v1/admin/groups_controller.rb` | Full CRUD inherits broadened default (RBAC-01) |
| `backend/app/controllers/v1/admin/group/estates_controller.rb` | Inherits broadened default (RBAC-01) |
| `backend/app/controllers/v1/admin/group/filter_sets_controller.rb` | Inherits broadened default (RBAC-01) |
| `backend/app/controllers/v1/admin/group/invitations_controller.rb` | Inherits broadened default (RBAC-01) |
| `backend/app/controllers/v1/admin/group/users_controller.rb` | Inherits broadened default (RBAC-01) |

## Pattern Assignments

### `backend/app/controllers/v1/admin/base_controller.rb` (middleware, request-response)

**Analog:** itself — extend the existing two-method pattern to a third method, reusing the identical membership-lookup shape.

**Current full file** (lines 1-36):
```ruby
module V1
  module Admin
    class BaseController < ApplicationController
      include BrokerageAuth
      include CognitoAuth
      include Pagy::Backend

      before_action :authenticate_cognito_user!
      before_action :require_admin!

      private

      def require_admin!
        membership = BrokerageMembership.without_deleted.find_by(
          user_id: Current.user.id,
          brokerage_id: Current.brokerage.id
        )
        unless membership && %w[owner admin].include?(membership.role)
          render json: { error: { code: "forbidden", message: "You do not have permission to perform this action." } },
                 status: :forbidden
        end
      end

      def require_owner!
        membership = BrokerageMembership.without_deleted.find_by(
          user_id: Current.user.id,
          brokerage_id: Current.brokerage.id
        )
        unless membership&.role == "owner"
          render json: { error: { code: "forbidden", message: "Owner access required." } },
                 status: :forbidden
        end
      end
    end
  end
end
```

**Required change (per CONTEXT.md D-blocking + RESEARCH.md Pattern 3):**
1. Add `require_agent_or_above!` — same `BrokerageMembership.without_deleted.find_by(...)` shape (lines 14-17 / 25-28 above), allow-list `%w[owner admin agent]`, same 403 body shape as `require_admin!` (`{ error: { code: "forbidden", message: "..." } }`).
2. Change line 9's default `before_action :require_admin!` to `before_action :require_agent_or_above!`.
3. Keep `require_admin!` (owner/admin) and `require_owner!` (owner) methods completely unchanged in body/semantics — only their role in the chain changes (no longer the default, but still callable as a narrower `before_action` in subclasses).
4. Optional per RESEARCH.md Pattern 3 (DRY, not required): extract the duplicated `BrokerageMembership.without_deleted.find_by(...)` lookup into a private `current_membership` memoized method used by all three checks. Not mandated by CONTEXT.md — planner's discretion.

**Auth/membership-lookup pattern to reuse verbatim** (lines 14-17):
```ruby
membership = BrokerageMembership.without_deleted.find_by(
  user_id: Current.user.id,
  brokerage_id: Current.brokerage.id
)
```

**403 response shape to reuse verbatim** (lines 19-20):
```ruby
render json: { error: { code: "forbidden", message: "You do not have permission to perform this action." } },
       status: :forbidden
```

---

### `backend/app/controllers/v1/admin/users_controller.rb` (controller, CRUD)

**Analog:** `backend/app/controllers/v1/admin/domains_controller.rb` — Pattern 1 (stack narrower `before_action`, no `skip_before_action` needed).

**Current class declaration** (lines 1-4, no before_action present today):
```ruby
module V1
  module Admin
    class UsersController < V1::Admin::BaseController

      # GET /v1/admin/users
```

**Analog to copy (`domains_controller.rb` lines 3-6):**
```ruby
class DomainsController < V1::Admin::BaseController
  # require_admin! is the default from BaseController — applies to index (D-10).
  # Mutations require owner role (D-11).
  before_action :require_owner!, only: %i[subdomain custom destroy set_primary]
```

**Required change:** add one line directly under the class declaration:
```ruby
class UsersController < V1::Admin::BaseController
  before_action :require_admin!, only: [:update, :destroy]

  # GET /v1/admin/users
```
`index` (lines 8-70) and `show` (lines 74-90) fall through to the new broadened default (`require_agent_or_above!`) — agent gets 2xx with zero further changes. `update` (lines 94-123) and `destroy` (lines 127-143) get the narrower `require_admin!` check stacked on top — agent gets 403.

---

### `backend/app/controllers/v1/admin/board_credentials_controller.rb` (controller, CRUD)

**Analog:** `backend/app/controllers/v1/admin/domains_controller.rb` — same Pattern 1 as `users_controller.rb`.

**Current class declaration** (lines 1-4, no before_action present today):
```ruby
module V1
  module Admin
    class BoardCredentialsController < V1::Admin::BaseController
      # GET /v1/admin/board_credentials
```

**Required change:** add one line directly under the class declaration:
```ruby
class BoardCredentialsController < V1::Admin::BaseController
  before_action :require_admin!, only: [:create, :update, :destroy]

  # GET /v1/admin/board_credentials
```
`index` (lines 5-19) inherits the broadened default — agent gets 2xx. `create` (22-70), `update` (89-126), `destroy` (74-85) get the narrower check — agent gets 403.

---

### `backend/app/controllers/v1/admin/brokerages_controller.rb` (controller, CRUD)

**Analog:** itself — rename `skip_before_action` target only; `require_owner!` stack is unchanged (this is RESEARCH.md's Pattern 2).

**Current lines 3-5:**
```ruby
class BrokeragesController < V1::Admin::BaseController
  skip_before_action :require_admin!, only: [:update]
  before_action :require_owner!, only: [:update]
```

**Required change** (rename the skip target — Rails raises `ArgumentError` at load time if this is missed, per RESEARCH.md Pitfall 2):
```ruby
class BrokeragesController < V1::Admin::BaseController
  skip_before_action :require_agent_or_above!, only: [:update]
  before_action :require_owner!, only: [:update]
```
`show` (lines 8-15) inherits the broadened default — agent gets 2xx. `update` (18-63) skips the broadened default entirely and re-checks strictly for `owner` — agent gets 403, semantics unchanged from today.

---

### `backend/app/controllers/v1/admin/invitations_controller.rb` (controller, CRUD)

**Analog:** `brokerages_controller.rb` for the `skip_before_action` rename pattern; `users_controller.rb` (this phase, above) for the added narrow `before_action` list shape.

**Current lines 3-6:**
```ruby
class InvitationsController < V1::Admin::BaseController
  skip_before_action :require_admin!, only: [:accept_invitation, :decline_invitation, :validate_token]
  skip_before_action :authenticate_cognito_user!, only: [:validate_token]
  before_action :set_invitation, only: [:destroy]
```

**Required change** (rename skip target + add new narrow write-tier check — this is the ONE controller RESEARCH.md's Pitfall 1 flags as easy to miss, since it "looks like" a zero-change controller but must stay FULLY blocked for agent per ACCESS-07):
```ruby
class InvitationsController < V1::Admin::BaseController
  skip_before_action :require_agent_or_above!, only: [:accept_invitation, :decline_invitation, :validate_token]
  skip_before_action :authenticate_cognito_user!, only: [:validate_token]
  before_action :require_admin!, only: [:index, :create, :validate, :destroy]
  before_action :set_invitation, only: [:destroy]
```
Note: `index` (9-29), `create` (32-75), `validate` (77-100), `destroy` (234-239) must ALL be in the `require_admin!` only-list — omitting any one (especially `validate`, not explicitly enumerated in RBAC-03 but required per CONTEXT.md's "stay fully blocked" instruction) leaves that action on the broadened default, silently opening it to agent. `accept_invitation` (156-204), `decline_invitation` (206-230), `validate_token` (102-154) are self-service actions that already skip role-checking entirely — untouched by this phase.

---

### `backend/test/integration/admin_authorization_test.rb` (test, request-response)

**Analog:** itself — existing test block structure and fixtures (lines 1-53), extend with the same shape for the full permission matrix.

**Existing fixture setup to reuse as-is** (lines 4-17):
```ruby
setup do
  @brokerage = create(:brokerage)
  create(:brokerage_domain, brokerage: @brokerage, domain: "test.example.com")

  @owner  = create(:user)
  @admin  = create(:user)
  @agent  = create(:user)
  @client = create(:user)

  create(:brokerage_membership, :owner,  user: @owner,  brokerage: @brokerage)
  create(:brokerage_membership, :admin,  user: @admin,  brokerage: @brokerage)
  create(:brokerage_membership, :agent,  user: @agent,  brokerage: @brokerage)
  create(:brokerage_membership, :client, user: @client, brokerage: @brokerage)
end
```

**Existing test pattern to reuse — rejection case** (lines 21-26, this exact test is D-03's blocking fix and MUST be flipped):
```ruby
test "agent role receives 403 on GET /v1/admin/users" do
  get "/v1/admin/users", headers: auth_headers_for(@agent, @brokerage)
  assert_response :forbidden
  body = JSON.parse(response.body)
  assert_equal "forbidden", body.dig("error", "code")
end
```
Flip to:
```ruby
test "agent role receives 200 on GET /v1/admin/users" do
  get "/v1/admin/users", headers: auth_headers_for(@agent, @brokerage)
  assert_response :ok
end
```

**Existing test pattern to reuse — acceptance case** (lines 37-40):
```ruby
test "owner role receives 200 on GET /v1/admin/users" do
  get "/v1/admin/users", headers: auth_headers_for(@owner, @brokerage)
  assert_response :ok
end
```

**403-with-body-check pattern for new write-endpoint coverage** (mirrors lines 21-26 shape):
```ruby
test "agent role receives 403 on PATCH /v1/admin/users/:id" do
  patch "/v1/admin/users/#{@agent.uid}",
    params: { user: { role: "admin" } },
    headers: auth_headers_for(@agent, @brokerage)
  assert_response :forbidden
  body = JSON.parse(response.body)
  assert_equal "forbidden", body.dig("error", "code")
end
```

**`auth_headers_for` helper being reused (no changes needed)** — `backend/test/test_helper.rb` lines 26-36:
```ruby
def auth_headers_for(user, brokerage)
  Current.brokerage = brokerage
  Current.user = user
  token = TokenService.issue(user)
  {
    "Authorization" => "Bearer #{token}",
    "Host" => brokerage.brokerage_domains.first.domain
  }
ensure
  Current.reset
end
```

**Factory trait being reused (no changes needed)** — `backend/test/factories/brokerage_memberships.rb`:
```ruby
trait :agent do
  role { "agent" }
end
```

**Endpoint-to-route map for the full D-02 matrix** (from `backend/config/routes.rb`, `namespace :admin` block):
```
resource  :brokerage,        only: [:show, :update]
resources :domains,          only: [:index, :destroy] do collection { patch :subdomain; post :custom }; member { patch :set_primary; post :verify } end
resources :users,            only: [:index, :show, :destroy, :update]
resources :groups,           only: [:index, :show, :create, :destroy, :update] do collection { post :check_name } end
  resources :users,          only: [:create, :destroy],                  controller: "group/users"
  resources :filter_sets,    only: [:index, :create, :update, :destroy], controller: "group/filter_sets" do collection { post :preview } end
  resources :estates,        only: [:index, :create, :destroy],          controller: "group/estates" do collection { get :search } end
  resources :invitations,    only: [:index, :create, :update, :destroy], controller: "group/invitations" do collection { post :validate } end  # NOTE: :validate route is ORPHANED — controller has NO validate action; do not test
resources :estates,          only: [] do collection { get :search; get :cities } end
resources :boards,           only: [:index]
resources :board_credentials, only: [:index, :create, :destroy, :update]
resources :invitations,      only: [:create, :index, :destroy] do collection { post :validate; post :accept; post :decline } end
resources :activity,         only: [:index] do collection { get :stats } end
```

---

## Shared Patterns

### Membership lookup (soft-delete safe)
**Source:** `backend/app/controllers/v1/admin/base_controller.rb` lines 14-17 (and identically at 25-28)
**Apply to:** the new `require_agent_or_above!` method only — `require_admin!`/`require_owner!` keep their existing bodies unchanged
```ruby
membership = BrokerageMembership.without_deleted.find_by(
  user_id: Current.user.id,
  brokerage_id: Current.brokerage.id
)
```
Never write a new query for this — CLAUDE.md's `acts_as_paranoid` convention plus RESEARCH.md Pitfall 4 both require reusing this exact scoped pattern.

### 403 response shape
**Source:** `backend/app/controllers/v1/admin/base_controller.rb` lines 19-20
**Apply to:** `require_agent_or_above!` (new) — match `require_admin!`'s shape exactly, per CONTEXT.md's explicit instruction not to introduce a third format
```ruby
render json: { error: { code: "forbidden", message: "You do not have permission to perform this action." } },
       status: :forbidden
```

### Stacking without skip (Pattern 1)
**Source:** `backend/app/controllers/v1/admin/domains_controller.rb` line 6 (unchanged reference implementation)
**Apply to:** `users_controller.rb`, `board_credentials_controller.rb` — add a narrower `before_action :require_admin!, only: [...]` directly, no `skip_before_action` needed since the broader check renders-and-halts on failure before the narrower check ever runs
```ruby
before_action :require_owner!, only: %i[subdomain custom destroy set_primary]
```

### Skip + rename (Pattern 2)
**Source:** `backend/app/controllers/v1/admin/brokerages_controller.rb` lines 4-5 (before this phase's edit)
**Apply to:** `brokerages_controller.rb`, `invitations_controller.rb` — any `skip_before_action :require_admin!` must be renamed to `skip_before_action :require_agent_or_above!` in the same commit as the `base_controller.rb` rename, or Rails raises `ArgumentError` at load time
```ruby
skip_before_action :require_admin!, only: [:update]   # BEFORE — must become:
skip_before_action :require_agent_or_above!, only: [:update]   # AFTER
```

## No Analog Found

None. Every file in scope for this phase is an edit to an existing controller/test, and every edit follows a technique already proven live in `domains_controller.rb` or the file's own pre-existing `skip_before_action`/`before_action` structure.

## Metadata

**Analog search scope:** `backend/app/controllers/v1/admin/**`, `backend/test/integration/admin_authorization_test.rb`, `backend/test/test_helper.rb`, `backend/test/factories/brokerage_memberships.rb`, `backend/config/routes.rb`
**Files scanned:** 14 admin controllers (13 subclasses + base), 1 test file, 1 test helper, 1 factory, routes.rb
**Pattern extraction date:** 2026-07-09
