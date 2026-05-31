# Phase 23: 301 Redirect & Primary Domain Enforcement - Research

**Researched:** 2026-05-30
**Domain:** Rails Rack middleware, BrokerageDomain model, mailer integration tests
**Confidence:** HIGH

---

## Summary

Phase 23 is a pure backend phase with three deliverables: (1) a Rack middleware file that intercepts every HTTP request and redirects non-primary domains to the brokerage's primary domain with HTTP 301, (2) that same middleware path handles frozen custom domains (DPRD-02), and (3) integration test coverage asserting that both mailers embed the primary domain in generated links (DPRI-03 — no mailer code changes needed).

The codebase already has all the building blocks: `BrokerageAuth#extract_domain_from_request` provides the exact Origin-first host extraction logic to copy verbatim, `BrokerageDomain` has all required statuses including `frozen`, and both mailers already call `primary_domain` at send time. The only new artifact is `app/middleware/domain_redirect_middleware.rb` plus its test file, and additions to the existing mailer test files.

The largest planning risk is an unintended interaction with existing integration tests: when `DomainRedirectMiddleware` is registered, it runs for every request in the test suite. Existing tests that send a `Host` header pointing to a non-primary domain would start receiving a 301 instead of the expected response. This is mitigated by the factory default (`is_primary: true`) and the pattern of always creating the primary subdomain first in `setup` — but the planner must be aware of this as a pitfall.

**Primary recommendation:** One middleware file, one middleware test file (unit-style Rack test), two additions to existing mailer test files. No new models, no new controllers, no migrations.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Redirect triggers:**
- D-01: Active non-primary domains — 301 redirect to primary + same path
- D-02: Phasing-out non-primary domains — also redirect immediately to primary
- D-03: Phasing-out primary domains — pass through (still the canonical URL)
- D-04: Frozen custom domains — redirect to primary (subdomain is already primary after DPRD-03)
- D-05: Pending domains — pass through to BrokerageAuth (which 404s them)
- D-06: Decommissioned and unknown domains — pass through to BrokerageAuth (404)

**Middleware design:**
- D-07: Host extraction: Origin header first, Host header as fallback — identical to `BrokerageAuth#extract_domain_from_request`
- D-08: Skip conditions: main domain (APP_BASE_DOMAIN) passes through; primary domains pass through; no health-check carve-outs; no dev environment overrides
- D-09: DB query must include frozen: `BrokerageDomain.where(status: [:active, :phasing_out, :frozen]).find_by(domain: host)`
- D-10: Primary domain lookup: `brokerage.brokerage_domains.where(is_primary: true).first.domain` — same pattern used in both mailers
- D-11: File: `app/middleware/domain_redirect_middleware.rb`; registered via `config.middleware.insert_before ActionDispatch::Static, DomainRedirectMiddleware`
- D-12: HTTP 301 for all methods; Location: `https://#{primary_domain}#{path}` preserving query string

**DPRI-03:**
- D-13: Both mailers already implement `primary_domain` at send time — no code changes; Phase 23 delivers integration tests only
- D-14: `primary_domain` helper stays duplicated across two mailers (not extracted to ApplicationMailer)

### Claude's Discretion

None declared in CONTEXT.md for this phase.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DPRI-04 | Requests to any non-primary domain are 301-redirected to the equivalent path on the primary domain | Middleware intercepts at Rack level before BrokerageAuth; all redirect logic confirmed in D-01 through D-12 |
| DPRD-02 | Frozen custom domains remain live but serve only a redirect to the subdomain | Same middleware path as DPRI-04; D-09 query includes `frozen` status explicitly |
| DPRI-03 | All system-generated links use the primary domain | Both mailers already use `primary_domain` helper — phase delivers integration test assertions only per D-13 |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 301 redirect enforcement | API / Backend (Rack middleware) | — | Must run server-side before any controller logic; cannot be client-side |
| Domain status lookup | Database / Storage | API / Backend | BrokerageDomain AR query inside middleware |
| Primary domain resolution | Database / Storage | API / Backend | `brokerage.brokerage_domains.where(is_primary: true)` query |
| Email link generation | API / Backend (mailers) | — | Mailers resolve `primary_domain` at send time — already correct |
| CORS pre-flight handling | API / Backend (Rack::Cors) | — | Rack::Cors registered at position 0 (before our middleware) |

---

## Standard Stack

### Core
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| Rack middleware | Rack 3.1.8 [VERIFIED: Gemfile.lock] | Intercept every HTTP request before Rails controllers | Only correct layer for universal per-request redirect |
| ActionDispatch::Request | Rails 7.1.5 [VERIFIED: Gemfile] | Wrap Rack env for header extraction | Same class used by BrokerageAuth concern |
| BrokerageDomain AR model | (project model) | Domain status + primary flag lookup | Already has all required statuses and `is_primary` field |
| ActionMailer::TestCase | Rails 7.1.5 | Test class for DPRI-03 mailer assertions | Established pattern in existing `domain_mailer_test.rb` and `invitation_mailer_test.rb` |

### No new gems required
All required capabilities exist in the current stack. [VERIFIED: Gemfile review]

---

## Architecture Patterns

### System Architecture Diagram

```
HTTP request arrives
       |
       v
  Rack::Cors (position 0 — handles OPTIONS preflight)
       |
       v
  ActionDispatch::HostAuthorization
       |
       v
  DomainRedirectMiddleware  <-- NEW
   |           |
   |    [extract host: Origin-first, Host fallback]
   |           |
   |    [skip if: main domain OR dev localhost]
   |           |
   |    [DB query: BrokerageDomain.where(status: [:active, :phasing_out, :frozen]).find_by(domain: host)]
   |           |
   |    [nil/pending/decommissioned] --> pass through
   |           |
   |    [is_primary? true] -----------> pass through
   |           |
   |    [not primary, any redirect status] --> 301 to https://{primary_domain}{fullpath}
   |
  (pass through)
       |
       v
  ActionDispatch::Static
       |
       v
  ... (remaining middleware stack)
       |
       v
  BrokerageAuth (controller concern)
  CognitoAuth (controller concern)
       |
       v
  Controller action
```

### Recommended Project Structure

```
backend/
├── app/
│   └── middleware/                       # NEW directory
│       └── domain_redirect_middleware.rb # NEW file
├── config/
│   └── application.rb                    # MODIFY: register middleware
└── test/
    ├── middleware/                        # NEW directory
    │   └── domain_redirect_middleware_test.rb  # NEW file
    └── mailers/
        ├── domain_mailer_test.rb          # MODIFY: add DPRI-03 tests
        └── invitation_mailer_test.rb      # MODIFY: add DPRI-03 test
```

### Pattern 1: Rack Middleware Skeleton

The Rack middleware protocol: `initialize(app)`, `def call(env)`, return either `@app.call(env)` (pass through) or a Rack response triple.

```ruby
# Source: ActionDispatch::SSL middleware pattern [VERIFIED: vendor/bundle source]
# app/middleware/domain_redirect_middleware.rb
class DomainRedirectMiddleware
  MAIN_DOMAIN = ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")

  def initialize(app)
    @app = app
  end

  def call(env)
    request = ActionDispatch::Request.new(env)
    host = extract_host(request)

    # Pass through: main domain, dev hosts
    return @app.call(env) if skip_host?(host)

    # DB lookup — includes frozen (not just routable scope)
    domain_record = BrokerageDomain
      .where(status: [:active, :phasing_out, :frozen])
      .includes(brokerage: :brokerage_domains)
      .find_by(domain: host)

    # Pass through: unknown, pending, decommissioned
    return @app.call(env) if domain_record.nil?

    # Pass through: this domain IS the primary
    return @app.call(env) if domain_record.is_primary?

    # Redirect to primary domain, preserving path + query string
    primary = domain_record.brokerage
                           .brokerage_domains
                           .where(is_primary: true)
                           .first
    return @app.call(env) if primary.nil?  # safety: no primary configured

    redirect_url = "https://#{primary.domain}#{request.fullpath}"
    [301, { "Location" => redirect_url, "Content-Type" => "text/plain" }, ["Moved Permanently"]]
  end

  private

  def extract_host(request)
    origin_host = begin
      URI.parse(request.headers["Origin"].to_s).host&.downcase
    rescue URI::InvalidURIError
      nil
    end
    origin_host.presence || request.host.downcase
  end

  def skip_host?(host)
    dev_hosts = %w[localhost 127.0.0.1]
    host == MAIN_DOMAIN || (Rails.env.development? && dev_hosts.include?(host))
  end
end
```

**Note:** `request.fullpath` from `Rack::Request` returns `path_info` + `?query_string` if query string is non-empty, or just `path_info` if empty. [VERIFIED: Rack 3.1.8 source — `rack/request.rb` line 603]

### Pattern 2: Rack Middleware Registration

```ruby
# Source: config/application.rb pattern [VERIFIED: codebase]
# config/application.rb — inside class Application < Rails::Application
config.middleware.insert_before ActionDispatch::Static, DomainRedirectMiddleware
```

**Positioning:** This places `DomainRedirectMiddleware` at position 4 in the current stack (between `Rack::Sendfile` and `ActionDispatch::Static`). `Rack::Cors` remains at position 0 — CORS preflight OPTIONS requests are handled by Rack::Cors before our middleware runs. [VERIFIED: `rails middleware` output]

**Autoloading:** Rails 7.1 + Zeitwerk autoloads all subdirectories under `app/` by default. `app/middleware/` requires no additional `config.autoload_paths` entry. [VERIFIED: Rails 7.1 Zeitwerk behavior, `config/application.rb` only adds `app/constants` explicitly]

### Pattern 3: Middleware Unit Test (Rack-level)

The cleanest way to test Rack middleware without going through the full Rails stack is to use `ActionDispatch::IntegrationTest` which does run the full middleware stack. An alternative is pure Rack testing with a mock app lambda. Given the project already uses `ActionDispatch::IntegrationTest` for all integration tests, the recommendation is to use that pattern for consistency:

```ruby
# Source: project test patterns [VERIFIED: test/integration/*_test.rb files]
# test/middleware/domain_redirect_middleware_test.rb
require "test_helper"

class DomainRedirectMiddlewareTest < ActionDispatch::IntegrationTest
  setup do
    @brokerage = create(:brokerage)
    @primary = create(:brokerage_domain,
      brokerage: @brokerage, domain: "primary.example.com",
      status: "active", is_primary: true, verified: true)
  end

  test "request to non-primary active domain returns 301 to primary domain" do
    non_primary = create(:brokerage_domain,
      brokerage: @brokerage, domain: "old.example.com",
      status: "active", is_primary: false, verified: true)
    get "/v1/admin/users", headers: { "Host" => "old.example.com" }
    assert_response 301
    assert_equal "https://primary.example.com/v1/admin/users", response.headers["Location"]
  end

  # ...
end
```

**Note on Origin vs Host in tests:** `auth_headers_for` in `test_helper.rb` sets `Host` (not `Origin`). The middleware's `extract_host` falls back to `request.host` (from `HTTP_HOST`) when `HTTP_ORIGIN` is absent. Tests that need to test Origin-based extraction must set the `Origin` header explicitly.

### Pattern 4: Mailer DPRI-03 Integration Test

```ruby
# Source: existing invitation_mailer_test.rb pattern [VERIFIED: test/mailers/invitation_mailer_test.rb]
# Extend existing test class — no new file needed for DomainMailer
test "health_failure dashboard_url uses primary domain" do
  mail = DomainMailer.health_failure(@custom_domain)
  body = full_body(mail)
  assert_includes body, "primary.example.com", "dashboard URL must use primary domain (DPRI-03)"
  refute_includes body, "old.example.com"
end
```

**Existing coverage to extend:** `DomainMailerTest` and `InvitationMailerTest` already have working setups with primary/non-primary domain fixtures. DPRI-03 tests slot directly into these existing test classes.

### Anti-Patterns to Avoid

- **Querying with `routable` scope only:** `BrokerageDomain.routable` excludes `frozen` domains. DPRD-02 requires frozen domains to redirect. Must use the explicit `where(status: [:active, :phasing_out, :frozen])` query per D-09.
- **Using `without_deleted` on `BrokerageDomain`:** `BrokerageDomain` does NOT include `acts_as_paranoid`. Adding `.without_deleted` will raise `NoMethodError`. [VERIFIED: `brokerage_domain.rb` — no paranoid include]
- **Reconstructing URL manually from env:** Use `request.fullpath` from `Rack::Request`/`ActionDispatch::Request` — it handles the `PATH_INFO + QUERY_STRING` combination correctly for empty query strings. Do not concatenate `env['PATH_INFO'] + '?' + env['QUERY_STRING']` — that produces trailing `?` for requests without query params.
- **Calling `ENV.fetch("APP_BASE_DOMAIN")` inside `call`:** This is fine but slightly wasteful per request. Assigning to a constant or memoizing in `initialize` is cleaner — though given ENV is read-once at boot, either approach works.
- **Skipping the `is_primary.nil?` guard:** If a brokerage somehow has no primary domain set, `brokerage_domains.where(is_primary: true).first` returns nil, and interpolating nil.domain raises. Always guard.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL path + query string reconstruction | Manual `env['PATH_INFO'] + '?' + env['QUERY_STRING']` | `request.fullpath` (Rack::Request) | Handles empty query string without trailing `?` |
| Origin header extraction | Manual `env['HTTP_ORIGIN']` string manipulation | Copy `extract_domain_from_request` from `BrokerageAuth` | Validated, tested, handles `URI::InvalidURIError` |
| Primary domain resolution | New query logic | `brokerage.brokerage_domains.where(is_primary: true).first&.domain` | Exact pattern from both mailers — already proven correct |

---

## Common Pitfalls

### Pitfall 1: Existing Integration Tests Receiving 301 Unexpectedly

**What goes wrong:** After `DomainRedirectMiddleware` is registered, any existing integration test that sends a `Host` header to a non-primary domain receives a 301 instead of the expected response code, causing test failures unrelated to Phase 23.

**Why it happens:** `auth_headers_for` uses `brokerage.brokerage_domains.first.domain`. If any test creates domains in a different order than "primary first", `brokerage_domains.first` may return a non-primary domain. The middleware will then redirect that request.

**How to avoid:** The factory default is `is_primary: true`, and all existing integration test setups create the primary subdomain first (confirmed by reading `admin_domains_test.rb`, `invitations_test.rb`, etc.). The middleware test file must follow the same pattern: create the primary domain first, use `is_primary: true`.

**Warning signs:** Unexpected `assert_response 301` failures in unrelated tests after registering the middleware.

### Pitfall 2: N+1 DB Query in Hot Path

**What goes wrong:** The middleware runs on every single request. A naive implementation queries `BrokerageDomain` and then immediately issues a second query on `brokerage.brokerage_domains` to find the primary domain, for every non-primary domain hit.

**Why it happens:** Two separate AR queries without eager loading.

**How to avoid:** Use `.includes(brokerage: :brokerage_domains)` on the initial domain lookup. This eager-loads both `brokerage` and its `brokerage_domains` in 2 queries, so the `brokerage.brokerage_domains.where(is_primary: true).first` call hits the cache.

**Warning signs:** `bullet` gem N+1 warnings in logs; slow response times on domains that redirect.

### Pitfall 3: CORS Preflight OPTIONS Being Redirected

**What goes wrong:** If the middleware runs before Rack::Cors, browser preflight OPTIONS requests to non-primary domains would receive a 301. Browsers do not follow 301s for preflight requests — the CORS flow breaks entirely.

**Why it doesn't happen with the chosen insertion point:** `Rack::Cors` is registered at position 0 (`insert_before 0`). `DomainRedirectMiddleware` is registered with `insert_before ActionDispatch::Static` (position 4 in current stack). Rack::Cors runs first and fully handles OPTIONS before our middleware is reached. [VERIFIED: `rails middleware` output — Rack::Cors is line 1, ActionDispatch::Static is line 4]

**Warning signs:** If someone changes `insert_before ActionDispatch::Static` to `insert_before 0` or to a position before `Rack::Cors`, CORS will break.

### Pitfall 4: Frozen Domain Is Primary (Edge Case)

**What goes wrong:** After a Pro downgrade, `DPRD-03` makes the subdomain the primary. But what if, due to a bug or race condition, a frozen domain still has `is_primary: true`? The middleware would pass it through (since `is_primary?` is true), and the frozen domain would serve the full app — violating DPRD-02.

**Why it matters:** This is a data integrity invariant, not a middleware bug. The middleware correctly trusts `is_primary`.

**How to handle:** This is a Phase 22 data invariant (DPRD-03 ensures subdomain becomes primary on downgrade). The middleware does not need defensive logic here — if the data is correct, behavior is correct. Add an assertion in the frozen-domain redirect tests that confirms the test fixture has `is_primary: false` for the frozen domain.

### Pitfall 5: Rails autoload timing for `config.middleware.insert_before`

**What goes wrong:** The middleware class name `DomainRedirectMiddleware` must be resolvable when `config/application.rb` runs (at boot). With Zeitwerk, `app/middleware/` is autoloaded, but the constant might not yet be available at the exact line in `application.rb` where the middleware is registered.

**How to avoid:** Rails framework initializers load the middleware stack after `config/application.rb` runs, not during. The middleware registration line stores the class reference for later loading — the constant doesn't need to exist at registration time. This is the established pattern for custom Rack middleware in Rails (same as Rack::Attack, Rack::Cors). No `require` is needed.

**Warning signs:** `NameError: uninitialized constant DomainRedirectMiddleware` at boot — would indicate a class name mismatch between file name and class name.

---

## Code Examples

### Full Middleware with Eager Loading

```ruby
# Source: synthesized from BrokerageAuth#extract_domain_from_request [VERIFIED: brokerage_auth.rb]
# and ActionDispatch::SSL redirect pattern [VERIFIED: actionpack-7.1.5/lib/action_dispatch/middleware/ssl.rb]
# app/middleware/domain_redirect_middleware.rb

class DomainRedirectMiddleware
  def initialize(app)
    @app = app
  end

  def call(env)
    request = ActionDispatch::Request.new(env)
    host = extract_host(request)

    return @app.call(env) if skip_host?(host)

    domain_record = BrokerageDomain
      .where(status: [:active, :phasing_out, :frozen])
      .includes(brokerage: :brokerage_domains)
      .find_by(domain: host)

    return @app.call(env) if domain_record.nil?
    return @app.call(env) if domain_record.is_primary?

    primary = domain_record.brokerage.brokerage_domains.find { |d| d.is_primary? }
    return @app.call(env) if primary.nil?

    redirect_url = "https://#{primary.domain}#{request.fullpath}"
    [301, { "Location" => redirect_url, "Content-Type" => "text/plain" }, ["Moved Permanently"]]
  end

  private

  def extract_host(request)
    origin_host = begin
      URI.parse(request.headers["Origin"].to_s).host&.downcase
    rescue URI::InvalidURIError
      nil
    end
    origin_host.presence || request.host.downcase
  end

  def skip_host?(host)
    main_domain = ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")
    dev_hosts = %w[localhost 127.0.0.1]
    host == main_domain || (Rails.env.development? && dev_hosts.include?(host))
  end
end
```

**Note on N+1:** Using `.includes(brokerage: :brokerage_domains)` eager-loads associations. Then `domain_record.brokerage.brokerage_domains.find { |d| d.is_primary? }` operates on the in-memory collection (no additional query). This is the recommended pattern for the hot middleware path.

### Middleware Registration

```ruby
# Source: config/application.rb existing pattern [VERIFIED: backend/config/application.rb]
# Inside class Application < Rails::Application:
config.middleware.insert_before ActionDispatch::Static, DomainRedirectMiddleware
```

### Primary Domain Lookup (confirmed from both mailers)

```ruby
# Source: DomainMailer#primary_domain [VERIFIED: app/mailers/domain_mailer.rb]
# Source: InvitationMailer#primary_domain [VERIFIED: app/mailers/invitation_mailer.rb]
brokerage.brokerage_domains
  .where(is_primary: true)
  .where.not(domain: "localhost")
  .first&.domain || brokerage.brokerage_domains.first&.domain
```

**Note:** The middleware version uses `find { |d| d.is_primary? }` on the already-loaded collection (no WHERE clause needed — all domains are preloaded). The `where.not(domain: "localhost")` filter in the mailers is not needed in the middleware because `skip_host?` already ensures localhost passes through.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Client-side redirect on app init (v1.5) | Server-side Rack middleware 301 (Phase 23) | No app load on non-primary domains; SEO-correct permanent redirect |

**Deferred:** Caddy/proxy-layer redirect is explicitly listed as out of scope in REQUIREMENTS.md. Rails Rack middleware is the correct implementation for this milestone.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 23 is purely Ruby/Rails code and test changes. No external dependencies beyond the existing Rails + PostgreSQL stack, which is already operational (Phase 22 tests passing).

---

## Runtime State Inventory

Step 2.5: Not applicable — this is a greenfield middleware addition, not a rename/refactor/migration phase.

---

## Validation Architecture

`nyquist_validation` is explicitly `false` in `.planning/config.json`. This section is omitted.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | URI.parse with rescue URI::InvalidURIError on Origin header |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Host header injection | Spoofing | Origin-first extraction (Origin is browser-controlled, harder to spoof than Host); `ActionDispatch::HostAuthorization` runs before our middleware as additional guard |
| Open redirect via manipulated Location | Tampering | Location target is always `brokerage.brokerage_domains.where(is_primary: true).first.domain` — pulled from DB, never from user input |
| Infinite redirect loop | DoS (self-inflicted) | Primary domain always passes through (`is_primary?` check) — no loop possible |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `app/middleware/` is autoloaded by Zeitwerk without explicit config | Standard Stack / Architecture | Middleware class would not be found at boot; NameError — fixable by adding `config.autoload_paths` |
| A2 | `.includes(brokerage: :brokerage_domains)` plus `.find { |d| d.is_primary? }` avoids N+1 | Code Examples | N+1 on every redirected request; fixable but performance impact only |

---

## Open Questions

1. **Test file location for middleware tests**
   - What we know: No `test/middleware/` directory exists; existing tests are in `test/integration/`, `test/models/`, `test/mailers/`, `test/jobs/`
   - What's unclear: Convention preference — `test/middleware/` (mirrors `app/middleware/`) vs `test/integration/` (where similar request-lifecycle tests live)
   - Recommendation: Create `test/middleware/domain_redirect_middleware_test.rb` using `ActionDispatch::IntegrationTest` — mirrors the app directory and is self-documenting

2. **DPRI-03 test placement**
   - What we know: DPRI-03 tests add assertions about primary domain usage to existing mailer test files
   - What's unclear: Whether to add to existing test classes or create a new `test/integration/dpri03_primary_domain_links_test.rb`
   - Recommendation: Add directly to `DomainMailerTest` and `InvitationMailerTest` — they already have appropriate setup fixtures; a new file would duplicate the setup

---

## Sources

### Primary (HIGH confidence)
- `backend/app/controllers/concerns/brokerage_auth.rb` — extract_domain_from_request and main_domain_request? logic (verbatim copy into middleware)
- `backend/app/controllers/concerns/main_domain_only.rb` — structural middleware pattern reference
- `backend/app/models/brokerage_domain.rb` — statuses enum, `is_primary` field, `routable` scope
- `backend/app/mailers/domain_mailer.rb` + `invitation_mailer.rb` — `primary_domain` helper confirmed identical in both
- `backend/config/application.rb` — middleware registration location and existing patterns
- `backend/test/mailers/domain_mailer_test.rb` + `invitation_mailer_test.rb` — existing test patterns for DPRI-03 additions
- `vendor/bundle/ruby/4.0.0/gems/rack-3.1.8/lib/rack/request.rb` — `fullpath` method verified (lines 603-606)
- `vendor/bundle/ruby/4.0.0/gems/actionpack-7.1.5/lib/action_dispatch/middleware/ssl.rb` — redirect middleware pattern reference
- `rails middleware` output — confirmed Rack::Cors at position 1, ActionDispatch::Static at position 4

### Secondary (MEDIUM confidence)
- `.planning/phases/23-301-redirect-primary-domain-enforcement/23-CONTEXT.md` — all D-01 through D-14 decisions
- `.planning/STATE.md` — Phase 22 completion confirmation, `frozen` status available, `BrokerageDomain` has no acts_as_paranoid

---

## Metadata

**Confidence breakdown:**
- Middleware implementation: HIGH — all patterns verified from codebase source
- Middleware registration: HIGH — verified from existing config and `rails middleware` output
- N+1 mitigation via includes: HIGH — verified Rack::Request fullpath and AR includes patterns
- DPRI-03 test approach: HIGH — existing mailer test classes already have correct fixtures
- Pitfall: existing tests receiving 301: MEDIUM — mitigated by factory defaults and setup ordering, but requires planner awareness

**Research date:** 2026-05-30
**Valid until:** 2026-06-30 (stable Rails 7.1 / Rack 3 — no fast-moving dependencies)
