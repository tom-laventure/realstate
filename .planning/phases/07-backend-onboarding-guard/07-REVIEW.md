---
phase: 07-backend-onboarding-guard
reviewed_by: claude-sonnet-4-6
reviewed_at: 2026-05-16
status: issues_found
files_reviewed: 5
findings:
  critical: 2
  warning: 3
  info: 1
  total: 6
---

# Phase 07 — Backend Onboarding Guard: Code Review

## Files Reviewed

1. `backend/app/controllers/concerns/main_domain_only.rb`
2. `backend/test/integration/onboarding_domain_guard_test.rb`
3. `backend/app/controllers/v1/onboarding/brokerages_controller.rb`
4. `backend/app/controllers/v1/onboarding/domains_controller.rb`
5. `backend/app/controllers/v1/onboarding/users_controller.rb`

---

## Critical

### CR-01 — `DomainsController#check` omits soft-delete filter on availability checks

**File:** `backend/app/controllers/v1/onboarding/domains_controller.rb`
**Confidence:** 95

The availability check uses:

```ruby
result[:subdomain] = !BrokerageDomain.exists?(domain: full_host)
result[:custom_domain] = !BrokerageDomain.exists?(domain: custom_domain)
```

`BrokerageDomain` has a `deleted_at` column and an `:active` scope (`where(deleted_at: nil)`), but the model does not use `acts_as_paranoid` — so default queries include soft-deleted rows. A domain soft-deleted with a brokerage will permanently report as "taken" to any caller, blocking legitimate reuse of previously released subdomains and custom domains.

**Fix:**
```ruby
result[:subdomain] = !BrokerageDomain.active.exists?(domain: full_host)
result[:custom_domain] = !BrokerageDomain.active.exists?(domain: custom_domain)
```

---

### CR-02 — S3 favicon upload occurs before the transaction; orphaned on DB failure

**File:** `backend/app/controllers/v1/onboarding/brokerages_controller.rb`
**Confidence:** 88

The S3 upload runs before `ActiveRecord::Base.transaction do`. On `RecordInvalid` or `RecordNotUnique` (duplicate subdomain), the rescue handlers render an error but never delete the uploaded S3 object — it is permanently orphaned. The `RecordNotUnique` case is foreseeable (user attempting a taken subdomain after passing the check race).

**Fix:** Capture `s3_key` before upload and delete it in both rescue branches:

```ruby
s3_key = s3_service.generate_unique_key(temp_key, extension)
brokerage_attrs["favicon_url"] = s3_service.upload_base64(brokerage_attrs["favicon_url"], s3_key)
# ...
rescue ActiveRecord::RecordInvalid => e
  s3_service&.delete(s3_key) if s3_key
  render json: { error: "Failed to create brokerage", details: e.record.errors.full_messages }, status: :unprocessable_entity
rescue ActiveRecord::RecordNotUnique
  s3_service&.delete(s3_key) if s3_key
  render json: { error: "Subdomain or brokerage already taken" }, status: :conflict
```

---

## Warning

### WR-01 — `before_create :generate_verification_token` overwrites `nil` on the auto-verified subdomain record

**File:** `backend/app/controllers/v1/onboarding/brokerages_controller.rb` + `backend/app/models/brokerage_domain.rb`
**Confidence:** 92

`BrokeragesController#create` explicitly passes `verification_token: nil` for the auto-verified subdomain record (intent: no token needed since pre-verified). However `BrokerageDomain`'s `before_create :generate_verification_token` callback always runs, overriding the `nil`. The saved row ends up with `verified: true` and a non-nil `verification_token` — contradictory state.

**Fix:** Guard the callback:
```ruby
def generate_verification_token
  return if verified?
  self.verification_token = SecureRandom.hex(16)
end
```

---

### WR-02 — `DomainsController#check` does not normalize the subdomain, creating availability/create mismatch

**File:** `backend/app/controllers/v1/onboarding/domains_controller.rb`
**Confidence:** 85

`check` downcases and strips but does not strip non-`[a-z0-9-]` characters or leading/trailing hyphens. `BrokeragesController#create` applies `normalize_subdomain` which does both. A caller checking `"foo bar"` gets "available" (no record for `"foo bar.realstate.ca"`), but `create` normalizes it to `"foobar"` which may already be taken. The availability signal is untrustworthy for inputs with special characters, spaces, or edge hyphens.

**Fix:** Apply the same normalization in `check`:
```ruby
subdomain = normalize_subdomain(params[:subdomain])
```

Requires extracting `normalize_subdomain` to a shared concern/helper.

---

### WR-03 — `Resolv::DNS.new` has no timeout; slow nameservers can exhaust Puma threads

**File:** `backend/app/controllers/v1/onboarding/domains_controller.rb`
**Confidence:** 82

`dns_resolves?` calls `Resolv::DNS.new` without timeout configuration. On unresponsive authoritative nameservers, `getresource`/`getaddresses` can block indefinitely in a Puma thread. Multiple concurrent `verify` requests against slow nameservers will tie up the thread pool.

**Fix:**
```ruby
Timeout.timeout(5) do
  dns_resolves?(domain.domain, base_domain, server_ip)
end
rescue Timeout::Error
  render json: { error: "DNS check timed out — please try again" }, status: :gateway_timeout
```

---

## Info

### IN-01 — Acceptance (guard-passes) tests only cover one of four onboarding routes

**File:** `backend/test/integration/onboarding_domain_guard_test.rb`

The suite has rejection tests for all four routes but only one acceptance test (`POST /v1/onboarding/brokerage`). A regression blocking the other three routes for main-domain origins would not be caught.

**Fix:** Add three acceptance tests for `GET /v1/onboarding/domains/check`, `POST /v1/onboarding/domains/:id/verify`, and `PATCH /v1/onboarding/user` using `assert_not_equal 403, response.status`.

---

## Summary

The `MainDomainOnly` concern itself is well-implemented — Origin-first extraction, `URI::InvalidURIError` rescue, ENV-based domain, correct before_action ordering. No issues in the concern or `UsersController`.

Critical issues (CR-01, CR-02) are in pre-existing `DomainsController` and `BrokeragesController` code touched during this phase. CR-01 silently blocks users from reusing soft-deleted domains. CR-02 is an unmitigated S3 resource leak. Both should be addressed before the onboarding flow ships.
