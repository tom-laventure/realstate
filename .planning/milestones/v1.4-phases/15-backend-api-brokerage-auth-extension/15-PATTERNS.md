# Phase 15: Backend API & BrokerageAuth Extension - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 4 (2 modified, 1 new controller, 1 new test)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/controllers/concerns/brokerage_auth.rb` | middleware/concern | request-response | `backend/app/controllers/concerns/main_domain_only.rb` | exact (same domain-extraction logic to replicate inline) |
| `backend/app/controllers/v1/account/admin_brokerages_controller.rb` | controller | CRUD (read-only) | `backend/app/controllers/v1/dashboard/brokerages_controller.rb` | exact (CognitoAuth + skip_brokerage_membership? + inline render json) |
| `backend/config/routes.rb` | config | — | `backend/config/routes.rb` (existing `namespace :account` block, lines 34–50) | exact |
| `backend/test/integration/admin_brokerages_test.rb` | test | request-response | `backend/test/integration/onboarding_domain_guard_test.rb` + `backend/test/integration/admin_authorization_test.rb` | exact |

---

## Pattern Assignments

### `backend/app/controllers/concerns/brokerage_auth.rb` (concern, request-response)

**Analog:** `backend/app/controllers/concerns/main_domain_only.rb` (domain detection logic to replicate) + current `brokerage_auth.rb` (structure to extend)

**Current full file** (`backend/app/controllers/concerns/brokerage_auth.rb`, lines 1–36):
```ruby
module BrokerageAuth
  extend ActiveSupport::Concern

  included do
    before_action :resolve_brokerage
  end

  private

  def resolve_brokerage
    domain = extract_domain_from_request

    logger.debug("Resolving brokerage for domain: #{domain}")

    domain_record = BrokerageDomain
      .includes(:brokerage)
      .find_by(domain: domain)

    raise ActiveRecord::RecordNotFound, "Brokerage not found for domain: #{domain}" unless domain_record

    Current.brokerage = domain_record.brokerage
  end

  def extract_domain_from_request
    origin_host = begin
      URI.parse(request.headers["Origin"].to_s).host&.downcase
    rescue URI::InvalidURIError
      nil
    end

    origin_host.presence || request.host.downcase
  end
end
```

**Main-domain detection pattern to copy** (`backend/app/controllers/concerns/main_domain_only.rb`, lines 22–35):
```ruby
def require_main_domain!
  main_domain = ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")

  origin_host = begin
    URI.parse(request.headers["Origin"].to_s).host&.downcase
  rescue URI::InvalidURIError
    nil
  end
  request_host = origin_host.presence || request.host.downcase

  dev_hosts = %w[localhost 127.0.0.1]
  allowed = request_host == main_domain || (Rails.env.development? && dev_hosts.include?(request_host))
  render json: {error: "Forbidden"}, status: :forbidden unless allowed
end
```

**What to add to `resolve_brokerage`:** Branch at the top of `resolve_brokerage` — call a new private `main_domain_request?` helper (mirrors `require_main_domain!` logic but returns boolean). On main-domain path: read `request.headers["X-Brokerage-Id"]`, render 400 + `return` if absent, then look up `Brokerage.without_deleted.find_by(id: header_val.to_i)`. On subdomain path: existing logic unchanged.

**Early-render + return pattern** (from `backend/app/controllers/concerns/cognito_auth.rb`, lines 13–16):
```ruby
unless token
  render json: {error: "Authorization token missing"}, status: :unauthorized
  return
end
```
Copy this `render ... return` idiom for the missing-header 400 case in `resolve_brokerage`.

---

### `backend/app/controllers/v1/account/admin_brokerages_controller.rb` (controller, CRUD read-only)

**Analog:** `backend/app/controllers/v1/dashboard/brokerages_controller.rb`

**Full analog** (lines 1–32):
```ruby
module V1
  module Dashboard
    class BrokeragesController < ApplicationController
      include CognitoAuth
      include BrokerageAuth

      before_action :authenticate_cognito_user!

      # Skips membership check — this endpoint is called by the no-access page itself.
      def skip_brokerage_membership?
        true
      end

      # GET /v1/dashboard/brokerage
      def show
        brokerage = Current.brokerage
        return render json: {error: "Brokerage not found"}, status: :not_found unless brokerage

        render json: {
          brokerage: {
            id: brokerage.id,
            name: brokerage.name,
            ...
          }
        }, status: :ok
      end
    end
  end
end
```

**Key differences for new controller:**
- Module path: `V1::Account` not `V1::Dashboard`
- Include `MainDomainOnly` instead of `BrokerageAuth` (no brokerage context for this endpoint)
- Do NOT include `BrokerageAuth` — no single brokerage context applies
- Same `include CognitoAuth` + `before_action :authenticate_cognito_user!` + `skip_brokerage_membership? = true`
- `index` action queries `BrokerageMembership.without_deleted.includes(:brokerage).where(user_id: Current.user.id, role: %w[admin owner])`
- Inline `render json: { admin_brokerages: [...] }` — no serializer

**Existing account namespace controller for module structure** (`backend/app/controllers/v1/account/groups_controller.rb`, lines 1–5):
```ruby
module V1
  module Account
    class GroupsController < ApplicationController
      include CognitoAuth
      include BrokerageAuth
```

**skip_brokerage_membership? pattern** (`backend/app/controllers/concerns/cognito_auth.rb`, lines 32–34):
```ruby
def skip_brokerage_membership?
  false
end
```
Override this in the new controller to return `true`.

**Soft-delete + includes pattern for membership query** (CLAUDE.md mandate + `backend/app/controllers/concerns/cognito_auth.rb`, line 23):
```ruby
BrokerageMembership.without_deleted.exists?(user_id: Current.user.id, brokerage_id: Current.brokerage.id)
```
For the index action, adapt to `.without_deleted.includes(:brokerage).where(user_id: ..., role: ...)`.

---

### `backend/config/routes.rb` (config)

**Analog:** Existing `namespace :account` block (`backend/config/routes.rb`, lines 34–50)

**Current account namespace** (lines 34–50):
```ruby
namespace :account do
  resource :profile, only: [:show, :update], controller: "profile" do
    post :dismiss_welcome
  end
  resources :groups, only: [:index]

  namespace :calendar do
    get    :connections,          to: "connections#index"
    # ... etc
  end
end
```

**What to add:** `resources :admin_brokerages, only: [:index]` after `resources :groups, only: [:index]` (line 39), inside the `namespace :account` block. Produces `GET /v1/account/admin_brokerages` → `V1::Account::AdminBrokeragesController#index`.

---

### `backend/test/integration/admin_brokerages_test.rb` (test, request-response)

**Primary analog:** `backend/test/integration/onboarding_domain_guard_test.rb` (Origin header pattern, main-domain constant, token minting without brokerage context)

**Full primary analog** (lines 1–68 — key patterns):

File header + constant:
```ruby
require "test_helper"

class OnboardingDomainGuardTest < ActionDispatch::IntegrationTest
  MAIN_DOMAIN = ENV.fetch("APP_BASE_DOMAIN", "realstate.ca").freeze
```

Token minting without brokerage context (lines 13–19):
```ruby
setup do
  @user = create(:user)
  # Mint token without Current.brokerage — onboarding context is pre-tenant.
  token = TokenService.issue(@user)
  @auth_header = "Bearer #{token}"
ensure
  Current.reset
end
```

Origin header usage (lines 23–30):
```ruby
post "/v1/onboarding/brokerage",
  headers: {"Authorization" => @auth_header, "Origin" => SUBDOMAIN_ORIGIN},
  ...
assert_response :forbidden
assert_equal "Forbidden", JSON.parse(response.body)["error"]
```

Main-domain pass check (lines 57–67):
```ruby
post "/v1/onboarding/brokerage",
  headers: {"Authorization" => @auth_header, "Origin" => "https://#{MAIN_DOMAIN}"},
  ...
assert_not_equal 403, response.status
```

**Secondary analog:** `backend/test/integration/admin_authorization_test.rb` (FactoryBot membership trait pattern, `auth_headers_for`, JSON body parsing)

Setup with multiple memberships (lines 3–17):
```ruby
setup do
  @brokerage = create(:brokerage)
  create(:brokerage_domain, brokerage: @brokerage, domain: "test.example.com")

  @owner  = create(:user)
  @admin  = create(:user)
  create(:brokerage_membership, :owner, user: @owner, brokerage: @brokerage)
  create(:brokerage_membership, :admin, user: @admin, brokerage: @brokerage)
end
```

Response body parsing (lines 22–26):
```ruby
get "/v1/admin/users", headers: auth_headers_for(@agent, @brokerage)
assert_response :forbidden
body = JSON.parse(response.body)
assert_equal "forbidden", body.dig("error", "code")
```

**Key differences for new test:**
- Do NOT use `auth_headers_for` (it sets `Current.brokerage` + `Host`) — use `TokenService.issue` directly with `Current.user` set only, then reset, and pass `Origin: https://#{MAIN_DOMAIN}` header
- Must test both `admin_brokerages` endpoint (BE-01) AND `BrokerageAuth` extension (BE-02, BE-03) — put them in separate test classes or separate files
- For `BrokerageAuth` tests, pass `X-Brokerage-Id` header alongside `Origin`

**`auth_headers_for` helper** (`backend/test/test_helper.rb`, lines 26–37) — shows the set/issue/reset pattern to replicate inline for main-domain tests:
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
For main-domain tests, omit `Current.brokerage =` and replace `"Host"` with `"Origin" => "https://#{MAIN_DOMAIN}"`.

---

## Shared Patterns

### `render` + `return` Early Halt in Concerns
**Source:** `backend/app/controllers/concerns/cognito_auth.rb`, lines 13–16
**Apply to:** `BrokerageAuth#resolve_brokerage` (missing header 400 case), `MainDomainOnly#require_main_domain!` (already uses this)
```ruby
render json: {error: "..."}, status: :bad_request
return
```
Always `return` immediately after `render` inside concern methods to prevent `AbstractController::DoubleRenderError`.

### `skip_brokerage_membership?` Override Hook
**Source:** `backend/app/controllers/concerns/cognito_auth.rb`, lines 32–34
**Apply to:** `AdminBrokeragesController`
```ruby
def skip_brokerage_membership?
  true
end
```
Override this in any controller that authenticates users without a single brokerage context.

### `.without_deleted` on Every Model Query
**Source:** CLAUDE.md mandate, enforced across all models
**Apply to:** `BrokerageAuth` main-domain branch (`Brokerage.without_deleted.find_by`), `AdminBrokeragesController#index` (`BrokerageMembership.without_deleted`)
```ruby
# ✅ Always explicit
Brokerage.without_deleted.find_by(id: header_val.to_i)
BrokerageMembership.without_deleted.includes(:brokerage).where(user_id: ..., role: ...)
```

### Main Domain Detection Logic
**Source:** `backend/app/controllers/concerns/main_domain_only.rb`, lines 22–35
**Apply to:** New `main_domain_request?` private method in `BrokerageAuth`
```ruby
main_domain = ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")
origin_host = begin
  URI.parse(request.headers["Origin"].to_s).host&.downcase
rescue URI::InvalidURIError
  nil
end
request_host = origin_host.presence || request.host.downcase
dev_hosts = %w[localhost 127.0.0.1]
request_host == main_domain || (Rails.env.development? && dev_hosts.include?(request_host))
```
Note: `extract_domain_from_request` already exists in `BrokerageAuth` (lines 24–35) and performs the same Origin-first extraction — `main_domain_request?` should call `extract_domain_from_request` rather than duplicating that block.

### Token Minting Without Brokerage Context (Tests)
**Source:** `backend/test/integration/onboarding_domain_guard_test.rb`, lines 14–19
**Apply to:** Both new integration test setups
```ruby
Current.user = user
token = TokenService.issue(user)
Current.reset
headers = { "Authorization" => "Bearer #{token}", "Origin" => "https://#{MAIN_DOMAIN}" }
```
Do NOT call `auth_headers_for` from `AuthHelper` — it sets `Current.brokerage` and uses `Host`, not `Origin`.

---

## No Analog Found

All files have close analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `backend/app/controllers/concerns/`, `backend/app/controllers/v1/`, `backend/test/integration/`, `backend/config/`
**Files scanned:** 7 source files read in full
**Pattern extraction date:** 2026-05-24
