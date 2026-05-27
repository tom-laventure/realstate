# Phase 15: Backend API & BrokerageAuth Extension - Research

**Researched:** 2026-05-24
**Domain:** Rails 7.1 concern extension, multi-tenant auth, custom request headers
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Extend the existing `BrokerageAuth` concern inline — add a main-domain branch inside `resolve_brokerage`. No new concern, no changes to individual admin controllers.
- **D-02:** Main domain detection uses the same `APP_BASE_DOMAIN` env var logic already in `MainDomainOnly` concern (with dev-host allowlist for localhost/127.0.0.1).
- **D-03:** When request is from main domain and `X-Brokerage-Id` header is present: parse it as an integer ID, look up the brokerage by ID, set `Current.brokerage`. Normal subdomain path is unchanged.
- **D-04:** When request is from main domain and `X-Brokerage-Id` header is absent: render `{ error: "X-Brokerage-Id header required" }` with HTTP 400 immediately (in the concern, before reaching the controller).
- **D-05:** `BrokerageAuth` only resolves brokerage — it does not check admin/owner role. The membership check remains in `CognitoAuth`; admin role verification is the controller's responsibility.
- **D-06:** New standalone controller `V1::Account::AdminBrokeragesController` — does NOT include `BrokerageAuth`. Does not inherit from `V1::Admin::BaseController`.
- **D-07:** Controller includes `CognitoAuth` with `skip_brokerage_membership? = true` — authenticates the user via JWT but skips per-brokerage membership check.
- **D-08:** Controller includes `MainDomainOnly` concern — endpoint is restricted to main-domain requests only.
- **D-09:** Authorization logic: query `BrokerageMembership.without_deleted.where(user_id: Current.user.id, role: ["admin", "owner"])` to find all qualifying memberships.
- **D-10:** Response is minimal — `{ admin_brokerages: [{ id, name, role }, ...] }`.
- **D-11:** Root key: `admin_brokerages`.
- **D-12:** Render inline JSON in the controller — `render json: { admin_brokerages: [...] }`. No dedicated serializer.

### Claude's Discretion

None specified.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BE-01 | Admin user can call `GET /v1/account/admin_brokerages` and receive a list of all brokerages where they hold an admin or owner role | `BrokerageMembership` has `role` string column; query by `user_id` + `role` IN `["admin","owner"]`; join to brokerage for `id` and `name` |
| BE-02 | Backend resolves `Current.brokerage` from `X-Brokerage-Id` request header when the request Host is the main domain, enabling existing `/v1/admin/**` endpoints to serve main-domain requests | `BrokerageAuth#resolve_brokerage` is a single method; main-domain check reuses `APP_BASE_DOMAIN` + dev-host logic from `MainDomainOnly`; `request.headers["X-Brokerage-Id"]` is the standard Rails pattern for custom headers |
| BE-03 | Admin endpoint called from main domain without a valid `X-Brokerage-Id` header returns HTTP 400 Bad Request | Early `render` + `return` inside `resolve_brokerage` before any DB lookup; 400 is `status: :bad_request` in Rails |
</phase_requirements>

---

## Summary

Phase 15 is a pure backend Rails phase — no frontend work. It has two independent deliverables that can be implemented in sequence: (1) extend `BrokerageAuth` to handle main-domain requests by resolving brokerage from the `X-Brokerage-Id` header, and (2) add a new `GET /v1/account/admin_brokerages` endpoint that lists all brokerages where the authenticated user holds admin or owner role.

The codebase is already well-structured for both changes. `BrokerageAuth` has a single `resolve_brokerage` method that can be branched on main-domain detection. `MainDomainOnly` contains the exact domain-check logic (`APP_BASE_DOMAIN` + dev-host allowlist using `extract_domain_from_request`-equivalent pattern) that needs to be replicated inside the concern. The new controller follows the opt-out pattern already established by `V1::Dashboard::BrokeragesController` (no `BrokerageAuth`, `CognitoAuth` with `skip_brokerage_membership? = true`), except it also includes `MainDomainOnly`.

The test suite uses Rails Minitest with FactoryBot. Integration tests are the correct layer — they exercise the full request stack including concern behavior. The existing `onboarding_domain_guard_test.rb` and `admin_authorization_test.rb` provide direct templates for the tests needed here.

**Primary recommendation:** Implement in two waves — Wave 1: `BrokerageAuth` extension (BE-02, BE-03); Wave 2: `AdminBrokeragesController` + route (BE-01). Each wave has its own integration test.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Main-domain request detection | API / Backend (concern) | — | Origin/Host header inspection happens server-side; client cannot be trusted to self-identify |
| Brokerage resolution from header | API / Backend (concern) | — | `Current.brokerage` is a thread-local set by the concern before any controller action runs |
| Admin/owner membership query | API / Backend (controller) | — | DB query against `brokerage_memberships`; no frontend involvement |
| Route registration | API / Backend (routes.rb) | — | Rails routing is server-side configuration |
| 400 early rejection | API / Backend (concern) | — | Concern fires before controller action; renders and halts the chain |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Rails | 7.1.4 | Web framework; `ActionController::API`, `ActiveSupport::Concern` | Project standard [VERIFIED: Gemfile] |
| Ruby | 4.0.2 | Runtime | Project standard [VERIFIED: Gemfile] |
| acts_as_paranoid | (bundled) | Soft-delete scoping via `.without_deleted` | All user-facing models use it; CLAUDE.md requirement [VERIFIED: schema, models] |

### Test Stack

| Library | Version | Purpose |
|---------|---------|---------|
| Minitest | (Rails built-in) | Test framework — `ActionDispatch::IntegrationTest` [VERIFIED: test_helper.rb] |
| FactoryBot Rails | ~6.5 | Test fixtures [VERIFIED: Gemfile, factories/] |
| Shoulda Matchers | (bundled) | Additional matchers [VERIFIED: test_helper.rb] |

---

## Architecture Patterns

### System Architecture Diagram

```
Browser / Frontend (main domain, e.g. realstate.ca)
        |
        |  GET /v1/account/admin_brokerages
        |  Authorization: Bearer <JWT>
        |  Origin: https://realstate.ca
        v
+----------------------------+
|   BrokerageAuth concern    |  <-- NOT included in AdminBrokeragesController
|   (for /v1/admin/** etc.)  |      (no brokerage context needed)
|                            |
|  is_main_domain?           |
|    YES: X-Brokerage-Id?    |
|      YES --> Brokerage.find(id) --> Current.brokerage
|      NO  --> 400 Bad Request (halt)
|    NO: BrokerageDomain.find_by(domain) --> Current.brokerage
+----------------------------+
        |
        | (for /v1/account/admin_brokerages)
        v
+----------------------------+
|   MainDomainOnly concern   |  require_main_domain! (403 if not main domain)
+----------------------------+
        |
        v
+----------------------------+
|   CognitoAuth concern      |  authenticate_cognito_user!
|   skip_brokerage_          |  (skip_brokerage_membership? = true)
|   membership? = true       |
+----------------------------+
        |
        v
+----------------------------+
|  AdminBrokeragesController  |
|  #index                     |
|                             |
|  BrokerageMembership        |
|   .without_deleted          |
|   .where(user_id:...,       |
|     role: ["admin","owner"])|
|   .includes(:brokerage)     |
|  --> render json:           |
|    { admin_brokerages: [...]}|
+----------------------------+
```

### Recommended File Structure

```
backend/app/controllers/
├── concerns/
│   └── brokerage_auth.rb       # MODIFY: add main-domain branch
└── v1/
    └── account/
        └── admin_brokerages_controller.rb  # NEW

backend/config/
└── routes.rb                   # MODIFY: add route under namespace :account

backend/test/integration/
└── admin_brokerages_test.rb    # NEW: integration tests for BE-01, BE-02, BE-03
```

### Pattern 1: BrokerageAuth Extension (Main-Domain Branch)

**What:** Add a `main_domain?` private helper that mirrors `MainDomainOnly#require_main_domain!`, then branch inside `resolve_brokerage`.

**When to use:** Every request passing through `BrokerageAuth` — the main-domain branch fires automatically when the Origin/Host matches `APP_BASE_DOMAIN`.

**Example:**
```ruby
# Source: derived from backend/app/controllers/concerns/main_domain_only.rb [VERIFIED]
module BrokerageAuth
  extend ActiveSupport::Concern

  included do
    before_action :resolve_brokerage
  end

  private

  def resolve_brokerage
    if main_domain_request?
      header_val = request.headers["X-Brokerage-Id"]
      unless header_val.present?
        render json: { error: "X-Brokerage-Id header required" }, status: :bad_request
        return
      end
      brokerage = Brokerage.find_by(id: header_val.to_i)
      raise ActiveRecord::RecordNotFound, "Brokerage not found for id: #{header_val}" unless brokerage
      Current.brokerage = brokerage
    else
      domain = extract_domain_from_request
      domain_record = BrokerageDomain
        .includes(:brokerage)
        .find_by(domain: domain)
      raise ActiveRecord::RecordNotFound, "Brokerage not found for domain: #{domain}" unless domain_record
      Current.brokerage = domain_record.brokerage
    end
  end

  def main_domain_request?
    main_domain = ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")
    request_host = extract_domain_from_request
    dev_hosts = %w[localhost 127.0.0.1]
    request_host == main_domain || (Rails.env.development? && dev_hosts.include?(request_host))
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

### Pattern 2: AdminBrokeragesController (No BrokerageAuth)

**What:** A controller that does not inherit from `V1::Admin::BaseController` (which includes `BrokerageAuth`). It directly includes `CognitoAuth` and `MainDomainOnly`, and overrides `skip_brokerage_membership?`.

**When to use:** Any endpoint that needs to authenticate the user but serves cross-brokerage data — no single brokerage context applies.

**Example:**
```ruby
# Source: pattern from backend/app/controllers/v1/dashboard/brokerages_controller.rb [VERIFIED]
module V1
  module Account
    class AdminBrokeragesController < ApplicationController
      include MainDomainOnly
      include CognitoAuth

      before_action :authenticate_cognito_user!

      def skip_brokerage_membership?
        true
      end

      # GET /v1/account/admin_brokerages
      def index
        memberships = BrokerageMembership
          .without_deleted
          .includes(:brokerage)
          .where(user_id: Current.user.id, role: %w[admin owner])

        render json: {
          admin_brokerages: memberships.map { |m|
            { id: m.brokerage.id, name: m.brokerage.name, role: m.role }
          }
        }
      end
    end
  end
end
```

### Pattern 3: Route Registration

**What:** Add `resources :admin_brokerages, only: [:index]` under `namespace :account` in `routes.rb`.

**When to use:** Produces `GET /v1/account/admin_brokerages` routed to `V1::Account::AdminBrokeragesController#index`.

**Example:**
```ruby
# Source: backend/config/routes.rb [VERIFIED] — existing account namespace
namespace :account do
  resource :profile, only: [:show, :update], controller: "profile" do
    post :dismiss_welcome
  end
  resources :groups, only: [:index]
  resources :admin_brokerages, only: [:index]   # NEW

  namespace :calendar do
    # ... unchanged
  end
end
```

### Anti-Patterns to Avoid

- **Including BrokerageAuth in AdminBrokeragesController:** The concern runs `resolve_brokerage` as a `before_action`, which would try to resolve a single brokerage — this makes no sense for a cross-brokerage endpoint.
- **Inheriting from V1::Admin::BaseController:** That base class includes `BrokerageAuth` and `require_admin!` (checks `Current.brokerage`), both of which are wrong for this endpoint.
- **Skipping `acts_as_paranoid` scope:** All `BrokerageMembership` queries MUST use `.without_deleted`. Omitting this returns soft-deleted memberships. (CLAUDE.md requirement)
- **Querying brokerage fields without includes:** `memberships.map { |m| m.brokerage.name }` without `.includes(:brokerage)` triggers N+1 queries.
- **Blindly casting `X-Brokerage-Id` to integer via `.to_i` without validation:** `.to_i` on a non-numeric string returns `0`. Use `Brokerage.find_by(id: ...)` which returns nil for `id: 0`, triggering the proper `RecordNotFound` error.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Soft-delete scoping | Custom `WHERE deleted_at IS NULL` | `.without_deleted` (acts_as_paranoid) | CLAUDE.md mandates this; missing it causes serializer nil-association errors |
| JWT verification | Custom token parsing | `CognitoAuth#authenticate_cognito_user!` | Already handles extraction, verification, user lookup, membership check |
| Main-domain detection | New concern or class method | Inline `main_domain_request?` private method mirroring `MainDomainOnly` logic | Consistent logic; `MainDomainOnly` itself is a 12-line module — replicate the check, don't abstract further per D-01 |

---

## Common Pitfalls

### Pitfall 1: `before_action` Ordering — `resolve_brokerage` fires before `authenticate_cognito_user!`

**What goes wrong:** `BrokerageAuth` registers `before_action :resolve_brokerage` at include-time. `CognitoAuth` does NOT register a before_action automatically — controllers call `before_action :authenticate_cognito_user!` explicitly. For controllers that include both, `resolve_brokerage` runs FIRST (before the user is authenticated). This is the existing pattern and is intentional — brokerage resolution is infrastructure, not auth.

**Why it happens:** The `included do` block in `BrokerageAuth` registers the before_action immediately when the concern is included, ahead of any explicit `before_action` declared in the controller body.

**How to avoid:** This is not a problem to solve — it's the existing behavior. For `AdminBrokeragesController`, `BrokerageAuth` is not included at all, so ordering is: `MainDomainOnly` (registered in its `included do`) then `authenticate_cognito_user!` (explicit in controller).

**Warning signs:** If `Current.brokerage` is nil inside `authenticate_cognito_user!` for a controller that includes `BrokerageAuth`, the resolve step raised and halted the chain. Check logs for `ActiveRecord::RecordNotFound`.

### Pitfall 2: `render` Without `return` Does Not Halt the Concern

**What goes wrong:** Calling `render json: ..., status: :bad_request` in a concern method does NOT automatically stop execution. If `return` is omitted after the render in `resolve_brokerage`, execution continues into the subdomain lookup path, potentially raising a second render error.

**Why it happens:** Rails prevents double-render, but the code after the first `render` still executes up to the point where Rails raises `AbstractController::DoubleRenderError`.

**How to avoid:** Always `return` immediately after rendering in concern methods:
```ruby
render json: { error: "..." }, status: :bad_request
return
```

**Warning signs:** `AbstractController::DoubleRenderError` in logs; 500 response when 400 was expected.

### Pitfall 3: `X-Brokerage-Id` Header Access Name

**What goes wrong:** Custom HTTP headers have multiple naming conventions across layers. In the browser, the frontend sends `X-Brokerage-Id`. In Rack, it becomes `HTTP_X_BROKERAGE_ID`. In Rails, `request.headers["X-Brokerage-Id"]` works because Rails normalizes header names.

**Why it happens:** Rack stores headers with `HTTP_` prefix and underscores; Rails `request.headers` transparently handles both forms.

**How to avoid:** Use `request.headers["X-Brokerage-Id"]` in Rails controller concerns — this is the standard pattern confirmed by vendor code (`request.headers["X-Mandrill-Signature"]`, etc.). [VERIFIED: vendor bundle patterns]

**Warning signs:** `header_val` is nil even though the frontend sends the header — check for typos in the header name string.

### Pitfall 4: Brokerage Soft-Delete — `Brokerage.find_by(id: ...)` vs `Brokerage.without_deleted.find_by`

**What goes wrong:** `Brokerage.find_by(id: x)` may return a soft-deleted brokerage record. Setting `Current.brokerage` to a deleted brokerage lets the request proceed against a deleted tenant.

**Why it happens:** `acts_as_paranoid` adds a default scope `.without_deleted` to AR queries but `find_by` behavior may vary by configuration. The CLAUDE.md rule requires explicit `.without_deleted` on all model queries.

**How to avoid:** Use `Brokerage.without_deleted.find_by(id: header_val.to_i)` in the main-domain branch.

**Warning signs:** Requests succeed for brokerages that should be inaccessible; serializer errors on deleted associations.

### Pitfall 5: `MainDomainOnly` Before-Action Order in AdminBrokeragesController

**What goes wrong:** `MainDomainOnly` registers `before_action :require_main_domain!` in its `included do` block. It runs before `authenticate_cognito_user!`. This means unauthenticated requests from non-main-domain origins get a 403 instead of a 401, which leaks the existence of the main-domain restriction.

**Why it happens:** Same `included do` ordering as `BrokerageAuth` above.

**How to avoid:** This is the intended security behavior — reject non-main-domain requests first regardless of auth state. The 403 is intentional and consistent with `MainDomainOnly` used elsewhere (onboarding).

---

## Code Examples

### Integration Test Pattern — AdminBrokerages

```ruby
# Source: derived from backend/test/integration/admin_authorization_test.rb [VERIFIED]
# and backend/test/integration/onboarding_domain_guard_test.rb [VERIFIED]
class AdminBrokeragesTest < ActionDispatch::IntegrationTest
  MAIN_DOMAIN = ENV.fetch("APP_BASE_DOMAIN", "realstate.ca").freeze

  setup do
    @brokerage1 = create(:brokerage)
    @brokerage2 = create(:brokerage)

    @user = create(:user)
    create(:brokerage_membership, :admin, user: @user, brokerage: @brokerage1)
    create(:brokerage_membership, :owner, user: @user, brokerage: @brokerage2)

    Current.user = @user
    @token = TokenService.issue(@user)
    @main_domain_headers = {
      "Authorization" => "Bearer #{@token}",
      "Origin" => "https://#{MAIN_DOMAIN}"
    }
  ensure
    Current.reset
  end

  # BE-01: returns admin/owner brokerages
  test "GET /v1/account/admin_brokerages returns brokerages with id, name, role" do
    get "/v1/account/admin_brokerages", headers: @main_domain_headers
    assert_response :ok
    body = JSON.parse(response.body)
    assert_equal 2, body["admin_brokerages"].length
  end

  # BE-01: agent-only user gets empty list
  test "GET /v1/account/admin_brokerages returns empty list when user has no admin roles" do
    agent = create(:user)
    brokerage3 = create(:brokerage)
    create(:brokerage_membership, :agent, user: agent, brokerage: brokerage3)
    Current.user = agent
    token = TokenService.issue(agent)
    Current.reset
    get "/v1/account/admin_brokerages",
      headers: { "Authorization" => "Bearer #{token}", "Origin" => "https://#{MAIN_DOMAIN}" }
    assert_response :ok
    assert_equal [], JSON.parse(response.body)["admin_brokerages"]
  end

  # BE-01: endpoint forbidden from subdomain
  test "GET /v1/account/admin_brokerages from subdomain returns 403" do
    get "/v1/account/admin_brokerages",
      headers: { "Authorization" => "Bearer #{@token}", "Origin" => "https://acme.#{MAIN_DOMAIN}" }
    assert_response :forbidden
  end
end
```

### Integration Test Pattern — BrokerageAuth Extension

```ruby
# Source: derived from admin_authorization_test.rb + onboarding_domain_guard_test.rb [VERIFIED]
class BrokerageAuthMainDomainTest < ActionDispatch::IntegrationTest
  MAIN_DOMAIN = ENV.fetch("APP_BASE_DOMAIN", "realstate.ca").freeze

  setup do
    @brokerage = create(:brokerage)
    create(:brokerage_domain, brokerage: @brokerage, domain: "acme.#{MAIN_DOMAIN}")
    @admin = create(:user)
    create(:brokerage_membership, :admin, user: @admin, brokerage: @brokerage)
  end

  # BE-02: X-Brokerage-Id resolves brokerage on main domain
  test "GET /v1/admin/users from main domain with X-Brokerage-Id resolves brokerage" do
    headers = auth_headers_for_main_domain(@admin, @brokerage.id)
    get "/v1/admin/users", headers: headers
    assert_response :ok
  end

  # BE-03: missing header returns 400
  test "GET /v1/admin/users from main domain without X-Brokerage-Id returns 400" do
    Current.user = @admin
    token = TokenService.issue(@admin)
    Current.reset
    get "/v1/admin/users",
      headers: { "Authorization" => "Bearer #{token}", "Origin" => "https://#{MAIN_DOMAIN}" }
    assert_response :bad_request
    assert_equal "X-Brokerage-Id header required", JSON.parse(response.body)["error"]
  end

  private

  def auth_headers_for_main_domain(user, brokerage_id)
    Current.user = user
    token = TokenService.issue(user)
    Current.reset
    {
      "Authorization" => "Bearer #{token}",
      "Origin" => "https://#{MAIN_DOMAIN}",
      "X-Brokerage-Id" => brokerage_id.to_s
    }
  end
end
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-controller subdomain resolution | `BrokerageAuth` concern with single `resolve_brokerage` | Prior to v1.0 | All controllers get brokerage resolution for free by including the concern |
| BrokerageDomain-only resolution | Add header-based resolution path | This phase | Main-domain requests can target any brokerage by ID |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `acts_as_paranoid` adds default scope to `Brokerage.find_by` — explicit `.without_deleted` needed for safety | Common Pitfalls #4 | Low — CLAUDE.md mandates `.without_deleted` regardless; if paranoid adds it automatically the code is just extra-safe |
| A2 | `request.headers["X-Brokerage-Id"]` returns the header value correctly in the test environment with `ActionDispatch::IntegrationTest` | Code Examples | Low — confirmed by vendor bundle usage of `request.headers["X-..."` patterns; standard Rails behavior [VERIFIED: vendor bundle] |

**Risk assessment:** Both assumptions are low-risk. A1 is covered by CLAUDE.md's blanket `.without_deleted` rule. A2 follows the documented Rails header access API.

---

## Open Questions

1. **Token minting for main-domain tests: `Current.brokerage` during `TokenService.issue`**
   - What we know: `auth_headers_for` in `test_helper.rb` sets `Current.brokerage` before `TokenService.issue` so the role is embedded correctly.
   - What's unclear: For `AdminBrokeragesController`, there is no single brokerage context. The token must be minted without a brokerage context (as the onboarding test does: `TokenService.issue(@user)` directly after creating the user, before setting `Current.brokerage`).
   - Recommendation: In the `AdminBrokerages` test setup, mint tokens with `Current.user = @user; token = TokenService.issue(@user); Current.reset`. Do not call `auth_headers_for` (which sets `Current.brokerage` and uses `Host` header). Set `Origin` header instead.

2. **`BrokerageAuth` + `MainDomainOnly` both extract the domain separately**
   - What we know: Both concerns parse `Origin`/`Host` independently with nearly identical code. The extended `BrokerageAuth` will add a third copy via `main_domain_request?`.
   - What's unclear: Whether to DRY this into a shared helper (e.g., a `DomainDetection` module).
   - Recommendation: Per D-01, keep it inline in `BrokerageAuth`. Do not create a new abstraction for this phase. The duplication is small (12 lines) and adding a shared module would be out of scope.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code/config changes to an existing Rails backend. No new external dependencies, CLI tools, or services are required.

---

## Validation Architecture

`nyquist_validation` is explicitly `false` in `.planning/config.json`. Section omitted.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `CognitoAuth#authenticate_cognito_user!` — JWT verified via `TokenService`; already in place |
| V3 Session Management | no | Stateless API; JWT-only |
| V4 Access Control | yes | `MainDomainOnly` (endpoint restriction) + inline membership role check in controller |
| V5 Input Validation | yes | `X-Brokerage-Id` parsed as integer via `.to_i`; `Brokerage.find_by(id: ...)` returns nil for 0/invalid — no raw string injection path |
| V6 Cryptography | no | No new cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Subdomain user sends `X-Brokerage-Id` to access a different tenant | Tampering / Elevation of Privilege | `main_domain_request?` check gates the header path; subdomain requests use the existing domain lookup regardless of the header |
| Unauthenticated user calling `/v1/account/admin_brokerages` | Spoofing | `authenticate_cognito_user!` before_action rejects with 401 |
| Admin sending forged `X-Brokerage-Id` for a brokerage they are not a member of | Elevation of Privilege | `BrokerageAuth` only resolves brokerage — it does NOT verify membership. `CognitoAuth` membership check and `require_admin!` (from `V1::Admin::BaseController`) must still run in downstream admin controllers. BE-02 does not bypass downstream auth. |
| Soft-deleted brokerage accessed via `X-Brokerage-Id` | Tampering | Use `Brokerage.without_deleted.find_by(id: ...)` |

**Key security note:** The `X-Brokerage-Id` header path does NOT weaken tenant isolation. The admin membership check (`require_admin!` in `V1::Admin::BaseController`) still runs after `resolve_brokerage`. An attacker who sends a valid JWT for brokerage A but `X-Brokerage-Id` for brokerage B will be rejected by `require_admin!` because they are not an admin of brokerage B.

---

## Sources

### Primary (HIGH confidence)
- `backend/app/controllers/concerns/brokerage_auth.rb` — Current implementation verified in session
- `backend/app/controllers/concerns/cognito_auth.rb` — `skip_brokerage_membership?` hook verified
- `backend/app/controllers/concerns/main_domain_only.rb` — APP_BASE_DOMAIN logic verified
- `backend/config/routes.rb` — Existing `namespace :account` block verified
- `backend/app/models/brokerage_membership.rb` — `role` column, `acts_as_paranoid` verified
- `backend/app/models/brokerage.rb` — Model fields verified
- `backend/db/schema.rb` — `brokerage_memberships` table columns verified
- `backend/test/test_helper.rb` — `AuthHelper`, `TokenService.issue` pattern verified
- `backend/test/factories/brokerage_memberships.rb` — Trait names verified
- `backend/db/seeds/00_constants.rb` — Role values: `owner`, `admin`, `agent`, `staff`, `client` verified

### Secondary (MEDIUM confidence)
- `backend/app/controllers/v1/sessions_controller.rb` — `skip_before_action :resolve_brokerage` pattern; `skip_brokerage_membership?` override verified
- `backend/app/controllers/v1/dashboard/brokerages_controller.rb` — No-BrokerageAuth pattern verified
- `backend/app/controllers/v1/admin/base_controller.rb` — `require_admin!` and `require_owner!` verified
- `backend/test/integration/onboarding_domain_guard_test.rb` — Integration test pattern with `Origin` header verified
- `backend/test/integration/admin_authorization_test.rb` — `auth_headers_for` usage pattern verified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries and versions verified from Gemfile and source files
- Architecture: HIGH — all concern patterns verified from actual source code; no assumptions needed
- Pitfalls: HIGH — derived directly from inspected source (render-without-return is visible in existing concern; header naming verified from vendor bundle)

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (stable Rails codebase; no fast-moving dependencies)
