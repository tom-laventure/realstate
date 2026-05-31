---
phase: 23-301-redirect-primary-domain-enforcement
reviewed: 2026-05-30T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - backend/app/middleware/domain_redirect_middleware.rb
  - backend/test/middleware/domain_redirect_middleware_test.rb
  - backend/config/application.rb
  - backend/test/mailers/domain_mailer_test.rb
  - backend/test/mailers/invitation_mailer_test.rb
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-05-30
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

This phase adds `DomainRedirectMiddleware`, a Rack middleware that issues 301 redirects from non-primary brokerage domains to the primary domain. The middleware logic is well-structured and consistent with the existing `BrokerageAuth` concern. Registration in `application.rb` is correct. Mailer test coverage is comprehensive.

Two blockers were found:

1. The in-memory primary-domain resolution in the middleware uses an unfiltered `brokerage_domains` association that can include decommissioned records still flagged `is_primary: true`, causing 301 redirects to a dead domain.
2. The `skip_host?` guard only bypasses `localhost`/`127.0.0.1` in `development` mode. In `test` mode those hosts are not skipped — harmless today only because the test suite never sends requests with those Host values. If a future test does, the middleware will hit the DB and may return unexpected results.

Three warnings round out the review: missing `Content-Length` on the Rack response body, a nil-URL risk in the mailer `primary_domain` helper, and a test environment guard gap. Two info-level items cover a duplicate requirement label and a misleading test description.

---

## Critical Issues

### CR-01: `includes` loads decommissioned domains — 301 can redirect to a dead host

**File:** `backend/app/middleware/domain_redirect_middleware.rb:14,20`

**Issue:** Line 14 preloads the brokerage's domains with no status filter:

```ruby
.includes(brokerage: :brokerage_domains)
```

Line 20 then resolves the redirect target using an in-memory `find`:

```ruby
primary = domain_record.brokerage.brokerage_domains.find { |d| d.is_primary? }
```

`BrokerageDomain#decommission!` sets `status: :decommissioned` but does **not** clear `is_primary`. `phase_out!` also does not clear `is_primary`. So when a primary custom domain is phased out and then decommissioned (DMOD-14 flow) without an intervening `set_primary` call, it retains `is_primary: true` in the database. The unfiltered `includes` loads that decommissioned record into memory and the `find` returns it as the "primary." The middleware then issues:

```
301 Location: https://<decommissioned-domain>/path
```

This sends all traffic to a domain that is no longer served, causing a broken redirect loop from the perspective of the end user or client.

**Fix:** Filter out non-routable statuses in the in-memory lookup so only active/phasing_out domains can be selected as the redirect target:

```ruby
# line 20 — replace
primary = domain_record.brokerage.brokerage_domains.find { |d| d.is_primary? }

# with
REDIRECT_TARGET_STATUSES = %w[active phasing_out].freeze
primary = domain_record.brokerage.brokerage_domains
  .select { |d| d.is_primary? && REDIRECT_TARGET_STATUSES.include?(d.status) }
  .first
```

Alternatively, avoid the preloaded association and issue a second scoped DB query:

```ruby
primary = BrokerageDomain
  .where(brokerage: domain_record.brokerage, is_primary: true)
  .where(status: %i[active phasing_out])
  .first
```

---

### CR-02: `skip_host?` guard is `development`-only — `localhost`/`127.0.0.1` not skipped in `test` env

**File:** `backend/app/middleware/domain_redirect_middleware.rb:41`

**Issue:**

```ruby
host == main_domain || (Rails.env.development? && dev_hosts.include?(host))
```

In `RAILS_ENV=test`, `Rails.env.development?` is `false`. Any integration test that sends `Host: localhost` or `Host: 127.0.0.1` (including the implicit default when no Host header is specified in `ActionDispatch::IntegrationTest`) will fall through the guard, trigger a live `BrokerageDomain` DB query, and may receive an unexpected 301 redirect if a test-DB record matches. The current test suite avoids this by always setting an explicit Host header, but the guard is fragile — one future test without an explicit Host will produce a confusing redirect rather than the expected downstream response.

Note: `BrokerageAuth` has the exact same guard (`Rails.env.development? && dev_hosts.include?`) and has the same latent issue. They should match, but both should be corrected.

**Fix:**

```ruby
def skip_host?(host)
  main_domain = ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")
  dev_hosts   = %w[localhost 127.0.0.1]
  host == main_domain ||
    ((Rails.env.development? || Rails.env.test?) && dev_hosts.include?(host))
end
```

---

## Warnings

### WR-01: Redirect response missing `Content-Length` header

**File:** `backend/app/middleware/domain_redirect_middleware.rb:24`

**Issue:**

```ruby
[301, {"Location" => redirect_url, "Content-Type" => "text/plain"}, ["Moved Permanently"]]
```

The body `["Moved Permanently"]` is 16 bytes. The response omits `Content-Length`. While Rack 3 does not mandate `Content-Length` for non-entity-body status codes (1xx, 204, 304), 301 is an entity-body response. Several HTTP/1.1 clients and CDNs behave incorrectly when `Content-Length` is absent on redirect responses — they may wait for the connection to close before following the redirect. The Rack 3 Lint will silently accept the response but production behavior can differ.

**Fix:**

```ruby
body = "Moved Permanently"
[301, {
  "Location"       => redirect_url,
  "Content-Type"   => "text/plain",
  "Content-Length" => body.bytesize.to_s
}, [body]]
```

---

### WR-02: `primary_domain` helper produces a malformed URL when brokerage has no domains

**File:** `backend/app/mailers/domain_mailer.rb:38-43` and `backend/app/mailers/invitation_mailer.rb:23-28`

**Issue:** Both mailers share the same helper (copied verbatim per the comment):

```ruby
def primary_domain(brokerage)
  brokerage.brokerage_domains
    .where(is_primary: true)
    .where.not(domain: "localhost")
    .first&.domain || brokerage.brokerage_domains.first&.domain
end
```

If a brokerage has **no associated domains at all** (possible during tests or after data corruption), both sides of the `||` return `nil`. The callers then interpolate:

```ruby
@dashboard_url = "https://#{nil}/admin/domains"  # => "https:///admin/domains"
@invitation_url = "https://#{nil}/invite/#{token}"  # => "https:///invite/..."
```

These produce structurally invalid URLs that will be silently embedded in sent emails.

**Fix:** Raise or return a sentinel when no domain can be resolved:

```ruby
def primary_domain(brokerage)
  brokerage.brokerage_domains
    .where(is_primary: true)
    .where.not(domain: "localhost")
    .first&.domain ||
    brokerage.brokerage_domains.first&.domain ||
    raise(ArgumentError, "Brokerage #{brokerage.id} has no domains — cannot generate mailer URL")
end
```

---

### WR-03: Test for "frozen primary passes through" is absent

**File:** `backend/test/middleware/domain_redirect_middleware_test.rb`

**Issue:** D-03 tests that a `phasing_out` primary domain passes through. There is no equivalent test for `frozen + is_primary: true`. After `freeze_custom_domains!` is called (plan downgrade), the subdomain is set as primary, but if the primary ever becomes frozen (edge case or future logic change), the middleware must still not redirect it. The frozen status **is** included in the `where(status: ...)` query on line 13, so the `is_primary?` check on line 18 is the only guard — and it is tested for `phasing_out` but not `frozen`.

**Fix:** Add a test:

```ruby
test "frozen domain that IS primary passes through (DPRD-02 edge case)" do
  @primary.update!(status: "frozen")
  get "/v1/admin/users", headers: { "Host" => "primary.example.com" }
  refute_equal 301, response.status
end
```

---

## Info

### IN-01: Duplicate requirement label `D-06` on two distinct test cases

**File:** `backend/test/middleware/domain_redirect_middleware_test.rb:50,57`

**Issue:** Two different test cases both carry the label `(D-06)`:

```
"decommissioned domain passes through (D-06)"   # line 50
"unknown domain passes through (D-06)"           # line 57
```

These test different behaviors (known decommissioned domain vs. completely unknown domain). Using the same requirement ID makes traceability ambiguous. One of these should reference a distinct requirement.

**Fix:** Assign the unknown-domain test a distinct label (e.g., `D-07-fallback` or a new ID), or confirm in the requirements document that both fall under D-06 and update the test name to clarify they are two sub-cases.

---

### IN-02: `invitation_mailer_test.rb` test name does not match what is actually tested

**File:** `backend/test/mailers/invitation_mailer_test.rb:30`

**Issue:** The test is named:

```
"primary_domain skips localhost-like domain when is_primary: true but filtered by where.not"
```

The body creates a domain `"primary.acme.com"` with `is_primary: true`. Since `"primary.acme.com"` is not `"localhost"`, the `.where.not(domain: "localhost")` filter does not exclude it — the test never exercises the "filtered out" code path described in its name. The scenario it actually validates is: "primary domain is returned when it is a non-localhost domain." The comment in the test body acknowledges this ("we cannot insert a second 'localhost' row") but the test name is left unchanged, misleading future maintainers.

**Fix:** Rename the test to reflect what it actually exercises:

```ruby
test "primary_domain returns is_primary domain when it is not localhost (non-filtered path)" do
```

Or remove the test if it is redundant with `"primary_domain returns the is_primary: true domain even when other verified domains exist"`.

---

_Reviewed: 2026-05-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
