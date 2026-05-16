# Phase 7: Backend Onboarding Guard - Research

**Researched:** 2026-05-15
**Domain:** Rails concerns / before_action guards / domain-based request filtering
**Confidence:** HIGH

---

## Summary

Phase 7 adds a `MainDomainOnly` Rails concern that guards all `/v1/onboarding/*` endpoints. The concern rejects any request whose origin is not the main domain with HTTP 403. The main domain is read from the existing `APP_BASE_DOMAIN` env var — no hardcoded strings.

The three onboarding controllers (`BrokeragesController`, `DomainsController`, `UsersController`) currently include only `CognitoAuth`. None of them include `BrokerageAuth` — this is intentional since onboarding happens before a brokerage exists. The new concern slots in cleanly alongside `CognitoAuth` as an additional `before_action` check. It uses the same Origin→Host extraction logic already established in `BrokerageAuth`.

The implementation is a single new file: `app/controllers/concerns/main_domain_only.rb`. It is `include`d in all three controllers with a `before_action :require_main_domain!` call. The 403 response shape follows the project's simple pattern (`{error: "Forbidden"}`) used by non-admin controllers throughout the codebase.

**Primary recommendation:** Implement `MainDomainOnly` as an `ActiveSupport::Concern` with a single private `require_main_domain!` method. Include it in all three onboarding controllers and add it as the first `before_action` (before `authenticate_cognito_user!`). Write one integration test file covering both the rejection and pass-through cases for the primary endpoint.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOM-04 | All `/v1/onboarding/*` backend endpoints reject requests not originating from the main domain with HTTP 403; applies to brokerage create, domain check/verify, and user profile update | Confirmed: three controllers, four routes. Concern + before_action pattern is the correct Rails primitive. |
| DOM-05 | Backend reads the main domain from the existing `APP_BASE_DOMAIN` env var for origin validation; no hardcoded domain strings in guard logic | Confirmed: `APP_BASE_DOMAIN` is already used via `ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")` in every onboarding controller. The concern must follow the same pattern. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Domain-of-origin check | API / Backend (concern) | — | Security boundary lives at the API layer. Frontend guards (Phase 6) are UX-only per documented decision 06-01. |
| Reading APP_BASE_DOMAIN | API / Backend (concern) | — | Config env var is a backend concern; frontend uses its own VITE_MAIN_DOMAIN independently. |
| HTTP 403 response | API / Backend (controller) | — | Rails renders JSON response; no frontend involvement in rejection path. |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ActiveSupport::Concern` | Rails 7.1 (bundled) | Modular controller mixins | Project-established pattern — `BrokerageAuth` and `CognitoAuth` are both concerns [VERIFIED: codebase] |
| `ActionController::API` | Rails 7.1 (bundled) | Base controller class | `ApplicationController < ActionController::API` [VERIFIED: codebase] |

### No Additional Libraries Required

The guard is pure Ruby logic: extract host from `Origin`/`Host` header, compare to `APP_BASE_DOMAIN`, render or continue. No gem additions needed. [VERIFIED: codebase analysis]

---

## Architecture Patterns

### System Architecture Diagram

```
HTTP Request (any origin)
        |
        v
 MainDomainOnly#require_main_domain!
   [extract origin host from Origin header (or Host fallback)]
   [compare to ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")]
        |
   +-----------+
   |           |
  MATCH      NO MATCH
   |           |
   v           v
continue   render 403
   |        {error: "Forbidden"}
   v
CognitoAuth#authenticate_cognito_user!
        |
        v
   Controller action
```

### Recommended File Locations

```
backend/
└── app/
    └── controllers/
        ├── concerns/
        │   ├── brokerage_auth.rb          # existing
        │   ├── cognito_auth.rb            # existing
        │   └── main_domain_only.rb        # NEW — Phase 7
        └── v1/
            └── onboarding/
                ├── brokerages_controller.rb  # add include + before_action
                ├── domains_controller.rb     # add include + before_action
                └── users_controller.rb       # add include + before_action

backend/
└── test/
    └── integration/
        └── onboarding_domain_guard_test.rb  # NEW — Phase 7
```

### Pattern: MainDomainOnly Concern

**What:** `ActiveSupport::Concern` with a single private method registered as `before_action`.

**When to use:** On any controller that must only accept requests from the main domain (not brokerage subdomains).

**Example:**

```ruby
# Source: [VERIFIED: BrokerageAuth concern — app/controllers/concerns/brokerage_auth.rb]
# mirrors Origin → Host extraction logic established in BrokerageAuth

module MainDomainOnly
  extend ActiveSupport::Concern

  included do
    before_action :require_main_domain!
  end

  private

  def require_main_domain!
    main_domain = ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")
    request_host = extract_request_host

    unless request_host == main_domain
      render json: { error: "Forbidden" }, status: :forbidden
    end
  end

  def extract_request_host
    origin_host = begin
      URI.parse(request.headers["Origin"].to_s).host&.downcase
    rescue URI::InvalidURIError
      nil
    end
    origin_host.presence || request.host.downcase
  end
end
```

**Controller integration:**

```ruby
# Source: [VERIFIED: CognitoAuth pattern in brokerages_controller.rb]
module V1
  module Onboarding
    class BrokeragesController < ApplicationController
      include MainDomainOnly   # guards entire controller before auth
      include CognitoAuth

      before_action :authenticate_cognito_user!
      # ...
    end
  end
end
```

**Before_action ordering rule:** `MainDomainOnly` registers its `before_action` via `included do` block when `include MainDomainOnly` appears before `include CognitoAuth`. This fires the domain check before authentication — consistent with how `BrokerageAuth` is ordered before `CognitoAuth` in all authenticated controllers (see decision 01-02: "include BrokerageAuth before CognitoAuth"). [VERIFIED: codebase]

### Pattern: Integration Test for Domain Guard

**What:** `ActionDispatch::IntegrationTest` using Minitest + FactoryBot. Tests set `Host` and/or `Origin` headers to control which domain appears to originate the request.

**Why Host only:** The onboarding controllers do not include `BrokerageAuth`, so `Current.brokerage` is never set. This means the `auth_headers_for` helper (which sets `"Host" => brokerage.brokerage_domains.first.domain`) won't work directly for onboarding tests — we write the request manually.

**Example pattern:**

```ruby
# Source: [VERIFIED: existing integration test patterns — test/integration/]
class OnboardingDomainGuardTest < ActionDispatch::IntegrationTest
  setup do
    @user = create(:user)
    @brokerage = create(:brokerage)
    @subdomain_domain = create(:brokerage_domain, brokerage: @brokerage,
                               domain: "acme.example.com")

    # Mint a token without setting Current.brokerage (onboarding pattern)
    Current.brokerage = nil
    token = TokenService.issue(@user)
    @auth_token = "Bearer #{token}"
  ensure
    Current.reset
  end

  test "POST /v1/onboarding/brokerage from brokerage subdomain returns 403" do
    post "/v1/onboarding/brokerage",
      headers: {
        "Authorization" => @auth_token,
        "Origin" => "https://acme.example.com"
      },
      params: { ... },
      as: :json

    assert_response :forbidden
  end

  test "POST /v1/onboarding/brokerage from main domain proceeds past guard" do
    # With APP_BASE_DOMAIN defaulting to "realstate.ca" in test env,
    # set Origin or Host to match
    post "/v1/onboarding/brokerage",
      headers: {
        "Authorization" => @auth_token,
        "Origin" => "https://realstate.ca"
      },
      params: { ... },
      as: :json

    # Guard passes — response will be 422 (invalid params) or 201,
    # not 403. Guard itself is tested by the absence of 403.
    assert_not_equal 403, response.status
  end
end
```

### Anti-Patterns to Avoid

- **Including BrokerageAuth in onboarding controllers:** These controllers are called before any brokerage subdomain exists for the new tenant. BrokerageAuth would raise `RecordNotFound` for main-domain requests since the main domain is not in `brokerage_domains`. [VERIFIED: codebase design]
- **Hardcoding the main domain string:** DOM-05 explicitly forbids this. Always use `ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")`. [VERIFIED: requirements]
- **Putting the guard after CognitoAuth:** Domain rejection is a pre-auth check — there is no meaningful auth context when the request comes from the wrong origin. Order `MainDomainOnly` first.
- **Using `request.host` alone (ignoring Origin):** The established pattern in `BrokerageAuth` uses Origin as canonical and falls back to Host. Deviate from this to be consistent. [VERIFIED: brokerage_auth.rb]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concern structure | Custom module with manual `self.included` | `ActiveSupport::Concern` | Removes `included` double-include guard complexity; project pattern [VERIFIED: codebase] |
| Origin extraction | Inline string parsing | Reuse/extract same logic as `BrokerageAuth#extract_domain_from_request` | DRY — one source of truth for Origin→Host logic |

**Key insight:** The domain extraction logic is already solved in `BrokerageAuth`. The `MainDomainOnly` concern can either duplicate the two-line extraction method locally (simple, no coupling) or be designed to call a shared helper. The duplication approach is simpler and preferred since the logic is short. [VERIFIED: brokerage_auth.rb]

---

## Existing Codebase — Key Facts

### Onboarding Controllers Summary

[VERIFIED: direct file inspection]

| Controller | File | Routes | BrokerageAuth? | CognitoAuth? |
|------------|------|--------|----------------|--------------|
| `BrokeragesController` | `v1/onboarding/brokerages_controller.rb` | `POST /v1/onboarding/brokerage` | No | Yes |
| `DomainsController` | `v1/onboarding/domains_controller.rb` | `GET /v1/onboarding/domains/check`, `POST /v1/onboarding/domains/:id/verify` | No | Yes |
| `UsersController` | `v1/onboarding/users_controller.rb` | `PATCH /v1/onboarding/user` | No | Yes |

All four routes under `/v1/onboarding/` are in scope for DOM-04.

### APP_BASE_DOMAIN Usage

[VERIFIED: grep of app/]

`ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")` appears in:
- `v1/onboarding/brokerages_controller.rb` (line 19) — builds subdomain hostname
- `v1/onboarding/domains_controller.rb` (lines 12, 45) — checks subdomain availability, DNS verification
- `v1/admin/domains_controller.rb` (line 31) — DNS verification (out of scope, informational)

The concern should use the same `ENV.fetch` pattern with the same default.

### HTTP 403 Response Shape in This Codebase

[VERIFIED: grep of app/controllers/]

Two patterns exist:

1. **Simple:** `render json: { error: "Forbidden" }, status: :forbidden` — used by non-admin controllers (e.g., `DomainsController#verify`, `EstateDocumentsController`)
2. **Structured:** `render json: { error: { code: "forbidden", message: "..." } }, status: :forbidden` — used only by `V1::Admin::BaseController`

For `MainDomainOnly`, use the **simple pattern** — consistent with the onboarding namespace context and with the simpler controllers in the codebase.

### BrokerageAuth Origin Extraction Logic

[VERIFIED: app/controllers/concerns/brokerage_auth.rb]

```ruby
def extract_domain_from_request
  origin_host = begin
    URI.parse(request.headers["Origin"].to_s).host&.downcase
  rescue URI::InvalidURIError
    nil
  end
  origin_host.presence || request.host.downcase
end
```

The `MainDomainOnly` concern uses identical logic to extract the requesting domain. This is the project's canonical way to determine tenant origin.

### CognitoAuth Error Pattern

[VERIFIED: app/controllers/concerns/cognito_auth.rb]

`authenticate_cognito_user!` uses `render json: {...}, status: :unauthorized` and returns (does not raise). The `MainDomainOnly` concern should follow the same pattern — render and return (Rails' `performed?` check will short-circuit the chain).

### Test Infrastructure

[VERIFIED: test/ directory]

- **Framework:** Rails default Minitest (`ActiveSupport::TestCase` / `ActionDispatch::IntegrationTest`)
- **Helpers:** `AuthHelper#auth_headers_for(user, brokerage)` — sets `Authorization` and `Host` headers. NOT usable for onboarding tests (requires a brokerage domain; onboarding is pre-brokerage).
- **Fixtures:** FactoryBot with `factory :user`, `factory :brokerage`, `factory :brokerage_domain`.
- **Test run:** `RAILS_ENV=test rails test` from `backend/` directory.
- **Current test files:** 5 integration tests, 0 onboarding-specific tests.

For the onboarding guard test, mint a JWT via `TokenService.issue(@user)` directly (without `Current.brokerage` set), then set `Authorization` + `Origin` headers manually.

### TokenService.issue Without Brokerage

[VERIFIED: auth_headers_for in test_helper.rb]

The `auth_headers_for` helper sets `Current.brokerage` before calling `TokenService.issue`. For onboarding tests (no brokerage), set `Current.brokerage = nil` (or simply don't set it) before calling `TokenService.issue`, then reset with `Current.reset` in ensure. The JWT itself doesn't embed brokerage info — `Current.brokerage` is only needed if `TokenService.issue` reads it. Verify this assumption before finalizing test code. [ASSUMED: TokenService.issue does not require Current.brokerage — it likely only reads user claims]

---

## Common Pitfalls

### Pitfall 1: Origin Header Absent in Non-Browser Requests

**What goes wrong:** Direct API calls (curl, Postman, server-to-server) don't send an `Origin` header. The extracted host falls back to `request.host`, which in production is the backend server hostname (not the frontend domain). This would make the guard reject legitimate API calls from tools.

**Why it happens:** `Origin` is a browser security header — non-browser clients don't send it.

**How to avoid:** The fallback to `request.host` is acceptable for production because the frontend always sends `Origin`. For development/testing, set the `Host` header to the main domain in test requests. Document the behavior in the concern's comments.

**Warning signs:** Integration tests that don't set any Origin/Host fail unexpectedly with 403 when they should pass.

### Pitfall 2: Before_action Order — Guard Fires After Auth

**What goes wrong:** If `include CognitoAuth` appears before `include MainDomainOnly`, and `authenticate_cognito_user!` is registered in `CognitoAuth`'s `included do` block — but `CognitoAuth` has no `included do` block (confirmed: it uses explicit `before_action :authenticate_cognito_user!` in each controller). So ordering of `include` statements doesn't determine order here — the explicit `before_action :require_main_domain!` fires in registration order.

**How to avoid:** Always `include MainDomainOnly` and list `before_action :require_main_domain!` BEFORE `before_action :authenticate_cognito_user!`. Since `MainDomainOnly` uses `included do` to auto-register, placing `include MainDomainOnly` first ensures it fires before any explicitly registered `before_action` in the same class.

**Warning signs:** A 401 (unauthorized) is returned instead of 403 (forbidden) for requests from the wrong domain — means auth check ran first.

### Pitfall 3: ENV Default Doesn't Match Test Origin

**What goes wrong:** `APP_BASE_DOMAIN` defaults to `"realstate.ca"` in the concern. Test requests set `Origin: https://realstate.ca`. But the extracted host is `"realstate.ca"` (just the hostname, not the full URL). Match must be host-only comparison.

**How to avoid:** The extraction strips the scheme — `URI.parse("https://realstate.ca").host` returns `"realstate.ca"`. Compare against `ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")` which is already host-only. No special handling needed.

**Warning signs:** Main-domain tests return 403 even when Origin is correctly set.

### Pitfall 4: Missing the /verify Route Scope

**What goes wrong:** `DomainsController` handles two routes — `check` (collection GET) and `verify` (member POST). Forgetting that both need the guard.

**How to avoid:** The concern is included at the controller level, so it automatically covers ALL actions in `DomainsController`. No per-action scoping needed.

---

## Code Examples

### Concern — Full Implementation

```ruby
# app/controllers/concerns/main_domain_only.rb
# Source: [VERIFIED: BrokerageAuth pattern + DOM-04/DOM-05 requirements]
module MainDomainOnly
  extend ActiveSupport::Concern

  included do
    before_action :require_main_domain!
  end

  private

  # Rejects requests not originating from the main domain with HTTP 403.
  # Uses Origin header as canonical source (same logic as BrokerageAuth).
  # Reads main domain from APP_BASE_DOMAIN env var (DOM-05 compliance).
  def require_main_domain!
    main_domain = ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")
    request_host = begin
      URI.parse(request.headers["Origin"].to_s).host&.downcase
    rescue URI::InvalidURIError
      nil
    end
    request_host = request_host.presence || request.host.downcase

    unless request_host == main_domain
      render json: { error: "Forbidden" }, status: :forbidden
    end
  end
end
```

### Controller Integration — BrokeragesController (representative)

```ruby
# Source: [VERIFIED: existing brokerages_controller.rb structure]
module V1
  module Onboarding
    class BrokeragesController < ApplicationController
      include MainDomainOnly  # <-- NEW: domain guard fires first via included do
      include CognitoAuth

      before_action :authenticate_cognito_user!
      # ... rest unchanged
    end
  end
end
```

### Integration Test Structure

```ruby
# test/integration/onboarding_domain_guard_test.rb
# Source: [VERIFIED: admin_authorization_test.rb + invitations_test.rb patterns]
require "test_helper"

class OnboardingDomainGuardTest < ActionDispatch::IntegrationTest
  setup do
    @user = create(:user)
    token = TokenService.issue(@user)
    @auth_header = "Bearer #{token}"
  ensure
    Current.reset
  end

  # --- DOM-04: Rejection from brokerage subdomain ---

  test "POST /v1/onboarding/brokerage from brokerage subdomain returns 403" do
    post "/v1/onboarding/brokerage",
      headers: { "Authorization" => @auth_header, "Origin" => "https://acme.realstate.ca" },
      params: { brokerage: { name: "Test" }, subdomain: "test", plan: "basic" },
      as: :json
    assert_response :forbidden
    assert_equal "Forbidden", JSON.parse(response.body)["error"]
  end

  test "GET /v1/onboarding/domains/check from brokerage subdomain returns 403" do
    get "/v1/onboarding/domains/check",
      headers: { "Authorization" => @auth_header, "Origin" => "https://acme.realstate.ca" },
      params: { subdomain: "test" }
    assert_response :forbidden
  end

  test "PATCH /v1/onboarding/user from brokerage subdomain returns 403" do
    patch "/v1/onboarding/user",
      headers: { "Authorization" => @auth_header, "Origin" => "https://acme.realstate.ca" },
      params: { user: { first_name: "John", last_name: "Doe" } },
      as: :json
    assert_response :forbidden
  end

  # --- DOM-04 + DOM-05: Pass-through from main domain ---

  test "POST /v1/onboarding/brokerage from main domain passes the guard" do
    # Guard passes; will hit CognitoAuth next (which may fail on invalid token in test env).
    # We assert NOT 403 — guard-specific behavior only.
    post "/v1/onboarding/brokerage",
      headers: { "Authorization" => @auth_header, "Origin" => "https://realstate.ca" },
      params: { brokerage: { name: "Test" }, subdomain: "test", plan: "basic" },
      as: :json
    assert_not_equal 403, response.status
  end
end
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `TokenService.issue(@user)` does not require `Current.brokerage` to be set | Code Examples (test pattern) | If it does, test setup needs to mint token differently — but the helper can set `Current.brokerage = nil` explicitly and the concern should still work |
| A2 | `APP_BASE_DOMAIN` in test env defaults to `"realstate.ca"` (no test-specific override) | Common Pitfalls #3 | If overridden in `.env.test`, tests must use the actual configured value; same logic applies, just different string |

---

## Open Questions

1. **Should the `/v1/onboarding/user` (UsersController) guard also apply?**
   - What we know: DOM-04 explicitly includes "user profile update" in its scope.
   - What's clear: Yes, all three controllers need the guard.
   - Recommendation: Include `MainDomainOnly` in all three controllers.

2. **Should the concern's `extract_request_host` be extracted to a shared module?**
   - What we know: `BrokerageAuth` has identical logic inline.
   - What's clear: Duplication is 4 lines; extraction adds coupling.
   - Recommendation: Duplicate inline in `MainDomainOnly` with a comment referencing `BrokerageAuth`. DRY extraction is a future refactor if a third concern needs it.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this is a pure Rails code change with no new gems, services, or CLIs required).

---

## Validation Architecture

Step 4: SKIPPED — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`. [VERIFIED: config.json]

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | `before_action` guard + `render 403` |
| V5 Input Validation | yes | ENV var with safe default; URI.parse with rescue |
| V2 Authentication | no | CognitoAuth handles this separately |
| V6 Cryptography | no | No cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Brokerage subdomain user calls onboarding API to register new brokerage | Elevation of Privilege | `MainDomainOnly` rejects with 403 before any DB writes |
| Spoofed Origin header | Spoofing | Origin check is a UX/defence-in-depth layer; CORS middleware provides additional browser-level enforcement. Server-to-server calls without Origin fall back to Host header. |
| APP_BASE_DOMAIN not set in production | Denial of Service | `ENV.fetch` with default ensures a valid comparison even if env var is missing. Production MUST set the var; the default prevents a crash. |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase] `app/controllers/concerns/brokerage_auth.rb` — Origin extraction pattern, established project approach
- [VERIFIED: codebase] `app/controllers/concerns/cognito_auth.rb` — error render pattern (json + status)
- [VERIFIED: codebase] `app/controllers/v1/onboarding/` (3 files) — exact routes, current auth setup, APP_BASE_DOMAIN usage
- [VERIFIED: codebase] `config/routes.rb` — complete route list for `/v1/onboarding/`
- [VERIFIED: codebase] `test/test_helper.rb`, `test/integration/admin_authorization_test.rb`, `test/integration/invitations_test.rb` — test patterns and AuthHelper design
- [VERIFIED: codebase] `.planning/config.json` — `nyquist_validation: false`

### Secondary (MEDIUM confidence)
- [CITED: Rails Guides — ActionController::API, before_action, ActiveSupport::Concern] — concern structure and before_action ordering semantics [ASSUMED: standard Rails 7.1 behavior, not re-verified via docs lookup]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are project-existing; no new dependencies
- Architecture: HIGH — pattern directly mirrors BrokerageAuth; all relevant code inspected
- Pitfalls: HIGH — derived from direct codebase inspection + Rails concern semantics

**Research date:** 2026-05-15
**Valid until:** Stable — Rails concern behavior does not change between minor versions. Valid indefinitely for this codebase.
