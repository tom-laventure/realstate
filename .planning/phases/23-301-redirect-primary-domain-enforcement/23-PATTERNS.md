# Phase 23: 301 Redirect & Primary Domain Enforcement - Pattern Map

**Mapped:** 2026-05-30
**Files analyzed:** 5 (1 new middleware, 1 new middleware test, 1 config modify, 2 mailer test modifications)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/middleware/domain_redirect_middleware.rb` | middleware | request-response | `backend/app/controllers/concerns/brokerage_auth.rb` + `main_domain_only.rb` | role-match (no Rack middleware exists; concerns share host-extraction + skip logic) |
| `backend/test/middleware/domain_redirect_middleware_test.rb` | test | request-response | `backend/test/integration/brokerage_auth_main_domain_test.rb` | exact (same `ActionDispatch::IntegrationTest` pattern, same domain fixture ordering) |
| `backend/config/application.rb` | config | — | self (existing `config.middleware.use` lines 63-65) | exact |
| `backend/test/mailers/domain_mailer_test.rb` | test | request-response | self (existing `DomainMailerTest` class) | exact |
| `backend/test/mailers/invitation_mailer_test.rb` | test | request-response | self (existing `InvitationMailerTest` class) | exact |

---

## Pattern Assignments

### `backend/app/middleware/domain_redirect_middleware.rb` (middleware, request-response)

**Primary analog:** `backend/app/controllers/concerns/brokerage_auth.rb`
**Secondary analog:** `backend/app/controllers/concerns/main_domain_only.rb`

**Rack middleware skeleton — standard initialize + call protocol:**
```ruby
# No existing Rack middleware in project. Pattern from ActionDispatch::SSL (Rails internals).
# The project's concerns give us the extract_host and skip logic to copy verbatim.
def initialize(app)
  @app = app
end

def call(env)
  # ... extract host, check skip, do DB lookup, return pass-through or redirect triple
  [301, { "Location" => redirect_url, "Content-Type" => "text/plain" }, ["Moved Permanently"]]
end
```

**Host extraction pattern** — copy verbatim from `backend/app/controllers/concerns/brokerage_auth.rb` lines 50-61:
```ruby
# Origin-first: the frontend domain is the canonical tenant identifier.
# Fall back to Host only when Origin is absent (dev proxy, direct calls).
def extract_domain_from_request
  origin_host = begin
    URI.parse(request.headers["Origin"].to_s).host&.downcase
  rescue URI::InvalidURIError
    nil
  end

  origin_host.presence || request.host.downcase
end
```
In the Rack middleware, `request` is `ActionDispatch::Request.new(env)`, so `request.headers["Origin"]` and `request.host` work identically to the concern version.

**Main-domain skip logic** — copy from `backend/app/controllers/concerns/brokerage_auth.rb` lines 43-48:
```ruby
def main_domain_request?
  main_domain = ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")
  request_host = extract_domain_from_request
  dev_hosts = %w[localhost 127.0.0.1]
  request_host == main_domain || (Rails.env.development? && dev_hosts.include?(request_host))
end
```
In the middleware this becomes a private `skip_host?(host)` method (host already extracted, passed as argument).

**DB query pattern** — D-09 (NOT routable scope — must include frozen):
```ruby
# brokerage_auth.rb line 32-35 uses .routable + .includes(:brokerage).
# Phase 23 requires frozen too, so the query is wider:
domain_record = BrokerageDomain
  .where(status: [:active, :phasing_out, :frozen])
  .includes(brokerage: :brokerage_domains)
  .find_by(domain: host)
```
Note: `BrokerageDomain` has no `acts_as_paranoid` — no `.without_deleted` needed (confirmed: `brokerage_domain.rb` has no paranoid include).

**Primary domain resolution** — copy from `backend/app/mailers/domain_mailer.rb` lines 38-43 / `invitation_mailer.rb` lines 23-27:
```ruby
# Mailer version (AR query — used at send time, no eager loading):
def primary_domain(brokerage)
  brokerage.brokerage_domains
    .where(is_primary: true)
    .where.not(domain: "localhost")
    .first&.domain || brokerage.brokerage_domains.first&.domain
end
```
In the middleware the `.includes(brokerage: :brokerage_domains)` eager-load means `brokerage_domains` is already in memory. Use `.find { |d| d.is_primary? }` on the loaded collection instead of a second AR query. The `where.not(domain: "localhost")` filter is unnecessary in the middleware because `skip_host?` already passes localhost through before the DB lookup.

**Redirect response triple** — standard Rack protocol (no analog in project, from Rack spec):
```ruby
redirect_url = "https://#{primary.domain}#{request.fullpath}"
[301, { "Location" => redirect_url, "Content-Type" => "text/plain" }, ["Moved Permanently"]]
```
`request.fullpath` (from `ActionDispatch::Request` / `Rack::Request`) concatenates `PATH_INFO + ?QUERY_STRING` and correctly omits the trailing `?` for requests without query params.

**Pass-through cases — guard ordering:**
```ruby
return @app.call(env) if skip_host?(host)          # main domain, dev localhost
return @app.call(env) if domain_record.nil?         # unknown, pending, decommissioned
return @app.call(env) if domain_record.is_primary?  # this IS the primary domain
primary = domain_record.brokerage.brokerage_domains.find { |d| d.is_primary? }
return @app.call(env) if primary.nil?               # safety: no primary configured
```

---

### `backend/test/middleware/domain_redirect_middleware_test.rb` (test, request-response)

**Analog:** `backend/test/integration/brokerage_auth_main_domain_test.rb`

**File header + test class declaration** (lines 1-8 of analog):
```ruby
require "test_helper"

class DomainRedirectMiddlewareTest < ActionDispatch::IntegrationTest
  # ActionDispatch::IntegrationTest runs the full Rack stack including the new middleware.
  # auth_headers_for sets Host header from brokerage.brokerage_domains.first.domain
  # (test_helper.rb line 33) — so the primary domain must be created first in setup.
```

**Setup fixture pattern — primary domain MUST be created first** (mirrors `admin_domains_test.rb` lines 9-19 and `domain_health_job_test.rb` lines 20-24):
```ruby
setup do
  @brokerage = create(:brokerage)
  # CRITICAL: primary domain created first — auth_headers_for calls brokerage_domains.first
  # If a non-primary domain is created first, auth_headers_for returns it and the middleware
  # redirects all subsequent test requests, producing unexpected 301s (Research Pitfall 1).
  @primary = create(:brokerage_domain,
    brokerage: @brokerage,
    domain: "primary.example.com",
    status: "active",
    is_primary: true,
    verified: true)
end
```
Factory default for `:brokerage_domain` is `is_primary: true` (factory line 8) — always override explicitly when creating non-primary domains.

**Integration test request pattern with explicit Host header** (analog: `brokerage_auth_main_domain_test.rb` lines 18-20, `admin_domains_test.rb` lines 33-34):
```ruby
# To test redirect, send Host to the non-primary domain (not via auth_headers_for):
get "/v1/admin/users", headers: { "Host" => "old.example.com" }
assert_response 301
assert_equal "https://primary.example.com/v1/admin/users", response.headers["Location"]

# To test Origin-based extraction:
get "/v1/admin/users", headers: { "Origin" => "https://old.example.com", "Host" => "backend.internal" }
assert_response 301
assert_equal "https://primary.example.com/v1/admin/users", response.headers["Location"]

# Pass-through: primary domain passes through to BrokerageAuth (which returns 404 or 200)
get "/v1/admin/users", headers: auth_headers_for(@user, @brokerage)
refute_equal 301, response.status
```

**Test cases to cover:**
- Active non-primary domain → 301 (D-01)
- Phasing-out non-primary domain → 301 (D-02)
- Phasing-out domain that IS primary → pass through (D-03)
- Frozen non-primary custom domain → 301 (D-04)
- Pending domain → pass through, BrokerageAuth 404s (D-05)
- Decommissioned domain → pass through (D-06)
- Unknown domain → pass through (D-06)
- Main domain (APP_BASE_DOMAIN) → pass through (D-08)
- Path + query string preserved in Location header (D-12)
- Origin header takes precedence over Host header (D-07)

---

### `backend/config/application.rb` (config — middleware registration)

**Analog:** self, lines 63-65 (existing `config.middleware.use` calls)

**Existing middleware registration pattern** (lines 63-65):
```ruby
config.middleware.use Rack::MethodOverride
config.middleware.use ActionDispatch::Cookies
config.middleware.use config.session_store, config.session_options
```

**New line to add** — insert before `ActionDispatch::Static` so it runs before any Rails controller logic but after `Rack::Cors` (which is at position 0):
```ruby
config.middleware.insert_before ActionDispatch::Static, DomainRedirectMiddleware
```
Place this line inside `class Application < Rails::Application`, alongside the existing `config.middleware.use` lines. Zeitwerk autoloads `app/middleware/` without any additional `config.autoload_paths` entry (Rails 7.1 autoloads all `app/` subdirectories by default; `application.rb` line 32 only explicitly adds `app/constants`).

---

### `backend/test/mailers/domain_mailer_test.rb` (test — DPRI-03 additions)

**Analog:** self — existing `DomainMailerTest` class

**Existing setup** (lines 3-29) provides `@brokerage`, `@primary_subdomain` (`is_primary: true`, `domain: "acme.example.com"`), and `@custom_domain` (`is_primary: false`, `domain: "acme.com"`). No setup changes needed.

**`full_body` helper** already defined at line 31:
```ruby
def full_body(mail)
  mail.parts.map { |p| p.body.to_s }.join
end
```

**DPRI-03 test pattern to add** — assert primary domain appears in dashboard URL, non-primary domain does not. Model after existing body tests (lines 48-53):
```ruby
test "health_failure dashboard_url uses primary domain (DPRI-03)" do
  mail = DomainMailer.health_failure(@custom_domain)
  body = full_body(mail)
  assert_includes body, @primary_subdomain.domain,
    "dashboard URL must use primary domain (DPRI-03)"
  refute_includes body, @custom_domain.domain + "/admin",
    "dashboard URL must NOT use non-primary domain"
end

test "downgrade_notice dashboard_url uses primary domain (DPRI-03)" do
  mail = DomainMailer.downgrade_notice(@brokerage)
  body = full_body(mail)
  assert_includes body, @primary_subdomain.domain,
    "downgrade_notice dashboard URL must use primary domain (DPRI-03)"
end

test "unverified_warning dashboard_url uses primary domain (DPRI-03)" do
  pending_domain = create(:brokerage_domain, brokerage: @brokerage,
    domain: "pending.example.com", domain_type: "custom",
    status: "pending", verified: false, is_primary: false)
  mail = DomainMailer.unverified_warning(pending_domain)
  body = full_body(mail)
  assert_includes body, @primary_subdomain.domain,
    "unverified_warning dashboard URL must use primary domain (DPRI-03)"
end
```

---

### `backend/test/mailers/invitation_mailer_test.rb` (test — DPRI-03 additions)

**Analog:** self — existing `InvitationMailerTest` class

**Existing setup** (lines 3-8) provides `@brokerage` and `@inviter` with owner membership. No primary domain is created in setup — existing tests create domains inline. For DPRI-03 the test must create a primary domain explicitly.

**`full_body` helper** already defined at line 11:
```ruby
def full_body(mail)
  mail.parts.map { |p| p.body.to_s }.join
end
```

**Existing DPRI-03-adjacent test to study** (lines 15-28 — already tests primary domain selection):
```ruby
test "primary_domain returns the is_primary: true domain even when other verified domains exist" do
  create(:brokerage_domain, brokerage: @brokerage, domain: "old.acme.com", ..., is_primary: false)
  create(:brokerage_domain, brokerage: @brokerage, domain: "new.acme.com", ..., is_primary: true)
  invitation = create(:invitation, brokerage: @brokerage, inviter: @inviter)
  mail = InvitationMailer.invite_brokerage(invitation)
  body = full_body(mail)
  assert_includes body, "new.acme.com"
  refute_includes body, "old.acme.com"
end
```
This existing test already covers the DPRI-03 assertion for `invite_brokerage`. Add explicit DPRI-03 label tests for `invite_group` and confirm URL structure (`/invite/TOKEN`):

```ruby
test "invite_brokerage invitation_url uses primary domain (DPRI-03)" do
  create(:brokerage_domain, brokerage: @brokerage, domain: "primary.acme.com",
    domain_type: "subdomain", status: "active", is_primary: true, verified: true)
  invitation = create(:invitation, brokerage: @brokerage, inviter: @inviter)
  mail = InvitationMailer.invite_brokerage(invitation)
  body = full_body(mail)
  assert_includes body, "primary.acme.com", "invitation URL must use primary domain (DPRI-03)"
  assert_includes body, "/invite/#{invitation.token}"
end

test "invite_group invitation_url uses primary domain (DPRI-03)" do
  create(:brokerage_domain, brokerage: @brokerage, domain: "primary.acme.com",
    domain_type: "subdomain", status: "active", is_primary: true, verified: true)
  group = create(:group, brokerage: @brokerage)
  invitation = create(:invitation, :group, brokerage: @brokerage, inviter: @inviter, group: group)
  mail = InvitationMailer.invite_group(invitation)
  body = full_body(mail)
  assert_includes body, "primary.acme.com", "group invite URL must use primary domain (DPRI-03)"
end
```

---

## Shared Patterns

### Host Extraction (Origin-first)
**Source:** `backend/app/controllers/concerns/brokerage_auth.rb` lines 50-61
**Apply to:** `domain_redirect_middleware.rb` (copy verbatim, adapted for `ActionDispatch::Request.new(env)`)
```ruby
origin_host = begin
  URI.parse(request.headers["Origin"].to_s).host&.downcase
rescue URI::InvalidURIError
  nil
end
origin_host.presence || request.host.downcase
```

### Main Domain + Dev Skip Logic
**Source:** `backend/app/controllers/concerns/brokerage_auth.rb` lines 43-48
**Apply to:** `domain_redirect_middleware.rb` (copy verbatim as private `skip_host?` method)
```ruby
main_domain = ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")
dev_hosts = %w[localhost 127.0.0.1]
host == main_domain || (Rails.env.development? && dev_hosts.include?(host))
```

### Primary Domain Resolution
**Source:** `backend/app/mailers/domain_mailer.rb` lines 38-43 (identical in `invitation_mailer.rb` lines 23-27)
**Apply to:** `domain_redirect_middleware.rb` (adapt to use in-memory collection via `.find { |d| d.is_primary? }` after eager load; mailer version uses AR query)
```ruby
# Mailer AR query version:
brokerage.brokerage_domains
  .where(is_primary: true)
  .where.not(domain: "localhost")
  .first&.domain || brokerage.brokerage_domains.first&.domain

# Middleware in-memory version (after .includes(brokerage: :brokerage_domains)):
domain_record.brokerage.brokerage_domains.find { |d| d.is_primary? }
```

### Fixture Ordering — Primary Domain First
**Source:** `backend/test/integration/admin_domains_test.rb` lines 9-19, comment "Primary subdomain MUST be created first"
**Apply to:** `domain_redirect_middleware_test.rb` setup block
```ruby
# auth_headers_for calls brokerage.brokerage_domains.first.domain (test_helper.rb line 33).
# If a non-primary domain is first in DB insertion order, auth headers will target that domain
# and the middleware will redirect every authenticated test request with a 301.
@primary = create(:brokerage_domain, ..., is_primary: true)  # always first
# non-primary domains created after:
@non_primary = create(:brokerage_domain, ..., is_primary: false)
```

### Test Class and full_body Helper
**Source:** `backend/test/mailers/domain_mailer_test.rb` lines 3, 31-33; `backend/test/mailers/invitation_mailer_test.rb` lines 3, 11-13
**Apply to:** All mailer test additions (helper already present in both files — do not re-define)
```ruby
class DomainMailerTest < ActionMailer::TestCase
  def full_body(mail)
    mail.parts.map { |p| p.body.to_s }.join
  end
end
```

---

## No Analog Found

No files are without analog. The new Rack middleware (`domain_redirect_middleware.rb`) has no direct structural analog (no existing `app/middleware/` directory) but draws fully from two near-exact concern analogs (`brokerage_auth.rb` + `main_domain_only.rb`) for all logic patterns.

---

## Metadata

**Analog search scope:** `backend/app/controllers/concerns/`, `backend/app/mailers/`, `backend/app/models/`, `backend/config/`, `backend/test/integration/`, `backend/test/mailers/`, `backend/test/jobs/`, `backend/test/factories/`
**Files scanned:** 12
**Pattern extraction date:** 2026-05-30
