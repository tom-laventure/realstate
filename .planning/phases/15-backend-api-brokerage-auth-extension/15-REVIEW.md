---
phase: 15-backend-api-brokerage-auth-extension
reviewed: 2026-05-24T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - backend/app/controllers/concerns/brokerage_auth.rb
  - backend/app/controllers/v1/account/admin_brokerages_controller.rb
  - backend/config/routes.rb
  - backend/test/integration/admin_brokerages_test.rb
  - backend/test/integration/brokerage_auth_main_domain_test.rb
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-05-24
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 15 introduced two pieces: (1) a main-domain branch in `BrokerageAuth#resolve_brokerage` that resolves the current brokerage from an `X-Brokerage-Id` request header, and (2) a new cross-brokerage endpoint `GET /v1/account/admin_brokerages` backed by `AdminBrokeragesController`. The authorization chain (MainDomainOnly → CognitoAuth → membership guard) is correctly ordered. The `X-Brokerage-Id` value is passed through `.to_i` before the database lookup, preventing SQL injection. Multi-tenant isolation in `AdminBrokeragesController` is correct: the membership query is scoped to `Current.user.id`. No critical security vulnerabilities were found.

Three warnings were identified: a non-numeric `X-Brokerage-Id` header silently produces a 404 instead of a 400; the `AdminBrokeragesController` map block can crash with `NoMethodError` if `m.brokerage` is nil; and `BrokerageDomain` resolution does not filter out unverified domain records. Two info-level items cover a missing test case and the absence of pagination.

---

## Warnings

### WR-01: Non-numeric X-Brokerage-Id header returns 404 instead of 400

**File:** `backend/app/controllers/concerns/brokerage_auth.rb:13-18`

**Issue:** `header_val.present?` only guards against blank/nil. A non-numeric string such as `"abc"` passes the presence check, then `header_val.to_i` silently returns `0`. `Brokerage.without_deleted.find_by(id: 0)` returns `nil`, and the code raises `ActiveRecord::RecordNotFound`, yielding a 404. The caller sent a syntactically invalid header and receives a "not found" response, not the correct "bad request" response. This makes the API contract misleading: a client retrying on 404 will loop forever, whereas a 400 signals a fixable request error.

**Fix:**
```ruby
def resolve_brokerage
  if main_domain_request?
    header_val = request.headers["X-Brokerage-Id"]
    unless header_val.present?
      render json: {error: "X-Brokerage-Id header required"}, status: :bad_request
      return
    end

    brokerage_id = header_val.to_i
    unless brokerage_id.positive?
      render json: {error: "X-Brokerage-Id must be a positive integer"}, status: :bad_request
      return
    end

    brokerage = Brokerage.without_deleted.find_by(id: brokerage_id)
    raise ActiveRecord::RecordNotFound, "Brokerage not found for id: #{header_val}" unless brokerage
    Current.brokerage = brokerage
  else
    # ... existing subdomain path unchanged
  end
end
```

---

### WR-02: AdminBrokeragesController map block crashes with NoMethodError if brokerage eager-load returns nil

**File:** `backend/app/controllers/v1/account/admin_brokerages_controller.rb:22-26`

**Issue:** The map block accesses `m.brokerage.id` and `m.brokerage.name` without a nil guard. `Brokerage` uses `acts_as_paranoid` (paranoia 3.x), which adds a `WHERE deleted_at IS NULL` default scope. When `includes(:brokerage)` eager-loads the association, paranoia applies this default scope, meaning a membership whose brokerage has been soft-deleted will have `m.brokerage == nil` after eager loading. Calling `.id` on `nil` raises `NoMethodError` and returns a 500. CLAUDE.md explicitly calls this out as a known failure mode: "Failing to do this causes serializers to receive nil associations and raise NoMethodError."

Although `Brokerage.brokerage_memberships` is declared `dependent: :destroy`, meaning brokerage soft-deletion cascades to memberships, a race condition (brokerage deleted between the query and the map) or a direct DB operation bypassing callbacks can still produce this state.

**Fix:**
```ruby
def index
  memberships = BrokerageMembership
    .without_deleted
    .includes(:brokerage)
    .where(user_id: Current.user.id, role: %w[admin owner])

  render json: {
    admin_brokerages: memberships.filter_map { |m|
      next if m.brokerage.nil?
      {id: m.brokerage.id, name: m.brokerage.name, role: m.role}
    }
  }
end
```

Using `filter_map` silently skips orphaned memberships rather than crashing. If stricter behaviour is preferred, log the orphaned membership ID and skip rather than raising.

---

### WR-03: BrokerageDomain resolution does not exclude unverified domains

**File:** `backend/app/controllers/concerns/brokerage_auth.rb:25-27`

**Issue:** The subdomain branch resolves `Current.brokerage` via `BrokerageDomain.includes(:brokerage).find_by(domain: domain)` with no filter on `verified`. A custom domain added via the admin ops panel (which starts with `verified: false`) will resolve to a brokerage immediately, before the domain owner has proven control of that hostname. Any attacker who can route traffic to the backend from an unverified domain name that has been pre-registered by an admin will gain access to that brokerage's tenant context. The `BrokerageModel` has a `verified` scope and a `verified_at` column specifically to gate this. The `v1/domains#check` controller correctly filters by `verified: true, deleted_at: nil`; the auth path should be consistent.

**Fix:**
```ruby
domain_record = BrokerageDomain
  .includes(:brokerage)
  .find_by(domain: domain, verified: true)
```

If there is a deliberate product decision to allow pre-verification access (e.g., for onboarding preview), that exception must be documented and constrained (e.g., only during an onboarding grace window), not left open by default.

---

## Info

### IN-01: No test case for non-numeric X-Brokerage-Id header value

**File:** `backend/test/integration/brokerage_auth_main_domain_test.rb`

**Issue:** The test suite covers: valid id (200), missing header (400), non-existent id (404), and subdomain path. It does not cover a non-numeric value such as `"abc"`. After fixing WR-01, a test asserting `assert_response :bad_request` for a non-numeric header should be added to lock in the contract.

**Fix:**
```ruby
test "GET /v1/admin/users from main domain with non-numeric X-Brokerage-Id returns 400" do
  headers = main_domain_headers_for(@admin, nil)
  headers["X-Brokerage-Id"] = "abc"
  get "/v1/admin/users", headers: headers
  assert_response :bad_request
  body = JSON.parse(response.body)
  assert_match(/positive integer/, body["error"])
end
```

---

### IN-02: admin_brokerages endpoint has no pagination

**File:** `backend/app/controllers/v1/account/admin_brokerages_controller.rb:18-28`

**Issue:** `AdminBrokeragesController#index` returns all qualifying memberships in a single response with no pagination or result cap. CLAUDE.md mandates that collection endpoints always include Pagy pagination with a hard cap of 100 per page. A user who is an admin or owner of a very large number of brokerages (or a crafted account in a test environment) can trigger an arbitrarily large response.

**Fix:** Apply the standard project pagination pattern:
```ruby
def index
  scope = BrokerageMembership
    .without_deleted
    .includes(:brokerage)
    .where(user_id: Current.user.id, role: %w[admin owner])

  @pagy, memberships = pagy(scope, items: 100)

  render json: {
    admin_brokerages: memberships.filter_map { |m|
      next if m.brokerage.nil?
      {id: m.brokerage.id, name: m.brokerage.name, role: m.role}
    },
    meta: pagy_metadata(@pagy)
  }
end
```

Include `Pagy::Backend` in the controller (or its base class). If this endpoint is exclusively used as a dropdown source, apply the `paginate=false` bypass pattern from CLAUDE.md instead.

---

_Reviewed: 2026-05-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
