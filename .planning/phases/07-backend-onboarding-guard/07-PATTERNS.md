# Phase 7: Backend Onboarding Guard - Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 5 (1 new concern, 3 modified controllers, 1 new test)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/controllers/concerns/main_domain_only.rb` | middleware/concern | request-response | `backend/app/controllers/concerns/brokerage_auth.rb` | exact |
| `backend/app/controllers/v1/onboarding/brokerages_controller.rb` | controller | request-response | `backend/app/controllers/v1/onboarding/brokerages_controller.rb` (self) | self (modify) |
| `backend/app/controllers/v1/onboarding/domains_controller.rb` | controller | request-response | `backend/app/controllers/v1/onboarding/domains_controller.rb` (self) | self (modify) |
| `backend/app/controllers/v1/onboarding/users_controller.rb` | controller | request-response | `backend/app/controllers/v1/onboarding/users_controller.rb` (self) | self (modify) |
| `backend/test/integration/onboarding_domain_guard_test.rb` | test | request-response | `backend/test/integration/admin_authorization_test.rb` | exact |

---

## Pattern Assignments

### `backend/app/controllers/concerns/main_domain_only.rb` (middleware/concern, request-response)

**Analog:** `backend/app/controllers/concerns/brokerage_auth.rb`

**Module structure pattern** (lines 1-6 of brokerage_auth.rb):
```ruby
module BrokerageAuth
  extend ActiveSupport::Concern

  included do
    before_action :resolve_brokerage
  end
```
Copy this verbatim — replace module name with `MainDomainOnly` and method name with `require_main_domain!`.

**Origin extraction pattern** (lines 24-35 of brokerage_auth.rb):
```ruby
def extract_domain_from_request
  # Use Origin as the canonical tenant identifier — the frontend domain
  # is what maps to a brokerage, not the backend server's hostname.
  # Fall back to Host only when Origin is absent (dev proxy, direct calls).
  origin_host = begin
    URI.parse(request.headers["Origin"].to_s).host&.downcase
  rescue URI::InvalidURIError
    nil
  end

  origin_host.presence || request.host.downcase
end
```
Inline this logic directly in `require_main_domain!` — no shared method needed (4-line duplication preferred over coupling).

**403 render pattern** (from `backend/app/controllers/v1/onboarding/domains_controller.rb`, lines 39-41):
```ruby
return render json: {error: "Forbidden"}, status: :forbidden
```
Use the simple single-key `{error: "Forbidden"}` shape — not the structured admin shape `{error: {code:, message:}}`.

**ENV read pattern** (from `backend/app/controllers/v1/onboarding/brokerages_controller.rb`, line 19):
```ruby
base_domain = ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")
```
Always `ENV.fetch` with `"realstate.ca"` as default. Never hardcode the domain string directly.

**render-and-return pattern** (from `backend/app/controllers/concerns/cognito_auth.rb`, lines 14-16):
```ruby
render json: {error: "Authorization token missing"}, status: :unauthorized
return
```
After `render json: {...}, status: :forbidden`, Rails' `performed?` mechanism short-circuits the chain automatically — an explicit `return` is not required here since `require_main_domain!` is the entire method body, but it is acceptable for clarity.

---

### `backend/app/controllers/v1/onboarding/brokerages_controller.rb` (controller, request-response — modify)

**Current include/before_action block** (lines 1-6):
```ruby
module V1
  module Onboarding
    class BrokeragesController < ApplicationController
      include CognitoAuth

      before_action :authenticate_cognito_user!
```

**Target state after modification** — insert `include MainDomainOnly` before `include CognitoAuth`:
```ruby
module V1
  module Onboarding
    class BrokeragesController < ApplicationController
      include MainDomainOnly
      include CognitoAuth

      before_action :authenticate_cognito_user!
```

`MainDomainOnly`'s `included do` block auto-registers `before_action :require_main_domain!` at include time, so it fires before the explicit `before_action :authenticate_cognito_user!` below it. No additional `before_action` line is needed.

---

### `backend/app/controllers/v1/onboarding/domains_controller.rb` (controller, request-response — modify)

**Current include/before_action block** (lines 5-8):
```ruby
class DomainsController < ApplicationController
  include CognitoAuth

  before_action :authenticate_cognito_user!
```

**Target state after modification:**
```ruby
class DomainsController < ApplicationController
  include MainDomainOnly
  include CognitoAuth

  before_action :authenticate_cognito_user!
```

Covers both `check` and `verify` actions — concern applied at controller level covers all routes without per-action scoping.

---

### `backend/app/controllers/v1/onboarding/users_controller.rb` (controller, request-response — modify)

**Current include/before_action block** (lines 3-6):
```ruby
class UsersController < ApplicationController
  include CognitoAuth

  before_action :authenticate_cognito_user!
```

**Target state after modification:**
```ruby
class UsersController < ApplicationController
  include MainDomainOnly
  include CognitoAuth

  before_action :authenticate_cognito_user!
```

---

### `backend/test/integration/onboarding_domain_guard_test.rb` (test, request-response — new)

**Analog:** `backend/test/integration/admin_authorization_test.rb`

**File structure and require pattern** (lines 1-2 of admin_authorization_test.rb):
```ruby
require "test_helper"

class AdminAuthorizationTest < ActionDispatch::IntegrationTest
```
Copy structure: `require "test_helper"` then `class ... < ActionDispatch::IntegrationTest`.

**Setup block pattern without brokerage** — the `auth_headers_for` helper (test_helper.rb, lines 26-36) sets `Current.brokerage` before issuing the token. For onboarding tests (no brokerage), issue the token directly:
```ruby
# From test_helper.rb lines 26-37 — auth_headers_for shows TokenService.issue usage:
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
For onboarding tests, call `TokenService.issue(@user)` directly without setting `Current.brokerage`. Mirror the `ensure Current.reset` guard.

**FactoryBot user creation pattern** (admin_authorization_test.rb, lines 5-6):
```ruby
@brokerage = create(:brokerage)
create(:brokerage_domain, brokerage: @brokerage, domain: "test.example.com")
@owner = create(:user)
```
Use `create(:user)` from FactoryBot. For subdomain rejection tests, any non-main-domain origin string suffices — e.g. `"https://acme.realstate.ca"`.

**Rejection test pattern** (admin_authorization_test.rb, lines 21-26):
```ruby
test "agent role receives 403 on GET /v1/admin/users" do
  get "/v1/admin/users", headers: auth_headers_for(@agent, @brokerage)
  assert_response :forbidden
  body = JSON.parse(response.body)
  assert_equal "forbidden", body.dig("error", "code")
end
```
Adapt for onboarding: assert `assert_response :forbidden` and `assert_equal "Forbidden", JSON.parse(response.body)["error"]` (simple shape, not nested).

**Pass-through test pattern** — no direct analog exists; use negative assertion:
```ruby
assert_not_equal 403, response.status
```
This verifies the guard passed without asserting the exact downstream response (which depends on CognitoAuth and business logic).

**Header-only request pattern** (invitations_test.rb, lines 53-58):
```ruby
post "/v1/dashboard/invitations/validate_token",
  headers: {"Host" => "test.example.com"},
  params: {invite_token: @invitation.token},
  as: :json
```
For onboarding tests, set `"Origin"` in headers (not `"Host"`) because the concern reads `request.headers["Origin"]` first. Set `"Authorization"` alongside it.

**Test grouping convention** (admin_authorization_test.rb, lines 18-19 and 35):
```ruby
# --- Rejection cases ---
# ...
# --- Acceptance cases ---
```
Use comment section dividers to separate rejection and pass-through test groups.

---

## Shared Patterns

### Concern Structure (ActiveSupport::Concern)
**Source:** `backend/app/controllers/concerns/brokerage_auth.rb` lines 1-6
**Apply to:** `main_domain_only.rb`
```ruby
module ModuleName
  extend ActiveSupport::Concern

  included do
    before_action :method_name!
  end

  private
  # ...
end
```

### 403 Forbidden Response Shape
**Source:** `backend/app/controllers/v1/onboarding/domains_controller.rb` lines 39-41
**Apply to:** `main_domain_only.rb#require_main_domain!`
```ruby
render json: { error: "Forbidden" }, status: :forbidden
```
Do NOT use the admin structured shape `{ error: { code: "forbidden", message: "..." } }`.

### ENV.fetch for APP_BASE_DOMAIN
**Source:** `backend/app/controllers/v1/onboarding/brokerages_controller.rb` line 19
**Apply to:** `main_domain_only.rb#require_main_domain!`
```ruby
ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")
```

### Origin-First Host Extraction
**Source:** `backend/app/controllers/concerns/brokerage_auth.rb` lines 24-35
**Apply to:** `main_domain_only.rb#require_main_domain!`
```ruby
origin_host = begin
  URI.parse(request.headers["Origin"].to_s).host&.downcase
rescue URI::InvalidURIError
  nil
end
origin_host.presence || request.host.downcase
```

### Test Setup with TokenService (no brokerage)
**Source:** `backend/test/test_helper.rb` lines 26-37 (invert the pattern — omit brokerage)
**Apply to:** `onboarding_domain_guard_test.rb#setup`
```ruby
setup do
  @user = create(:user)
  token = TokenService.issue(@user)
  @auth_header = "Bearer #{token}"
ensure
  Current.reset
end
```

---

## No Analog Found

All files have close analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `backend/app/controllers/concerns/`, `backend/app/controllers/v1/onboarding/`, `backend/test/integration/`, `backend/test/test_helper.rb`
**Files scanned:** 8
**Pattern extraction date:** 2026-05-15
