---
phase: 12-board-connect-flow-backend
reviewed: 2026-05-23T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - backend/app/models/brokerage_board_credential.rb
  - backend/app/models/estate.rb
  - backend/app/controllers/v1/admin/board_credentials_controller.rb
  - backend/app/controllers/v1/admin/boards_controller.rb
  - backend/app/services/rets_auth_service.rb
  - backend/test/factories/real_estate_boards.rb
  - backend/test/factories/brokerage_board_credentials.rb
  - backend/test/models/brokerage_board_credential_test.rb
  - backend/test/models/estate_accessible_by_test.rb
  - backend/test/integration/board_connect_flow_test.rb
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-05-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 12 introduces the test-board connect bypass (skip RETS auth, bulk-insert BrokerageEstate rows), AR Encryption accessor pattern for RETS credentials, and the `Estate#accessible_by` SQL restructure. The overall flow is sound, but two blockers exist: (1) the DB schema has `NOT NULL` on the ciphertext columns while the model conditionally allows empty credentials for test boards — this causes a DB constraint violation at save time for test boards when blank credentials are submitted; (2) the `Rails.env.development?` bypass in the controller circumvents RETS validation for every developer connecting any board, including real boards, which is a correctness/security regression. Three warnings cover incomplete exception handling in `RetsAuthService`, a missing `without_deleted` guard on `BrokerageMembership` in the base controller (inherited from the existing codebase but exercised by every action in scope), and a gap in test coverage for the uniqueness constraint on test boards.

---

## Critical Issues

### CR-01: DB `NOT NULL` constraint on ciphertext columns causes save failure for test-board blank credentials

**File:** `backend/app/models/brokerage_board_credential.rb:11-33`

**Issue:** The migration (`20260321000002`) declares both `rets_username_ciphertext` and `rets_password_ciphertext` as `null: false` at the DB level. ActiveRecord Encryption serializes an empty string `""` to `nil` in the ciphertext column (line 129 of `encrypted_attribute_type.rb`: `encrypt(casted_value.to_s) unless casted_value.nil?` — the `.to_s` of an empty string is `""` which is truthy, but the underlying `cast_type.serialize("")` for a `text` column returns `""` not `nil`, so it _will_ write an encrypted blob for empty string). However, if the params arrive as `nil` (not `""`), AR Encryption skips serialization entirely and the column is left `NULL`, violating the DB constraint at the INSERT/UPDATE level. More critically: the model-level `validates :rets_username, presence: true, unless: ...` fires on the virtual accessor `rets_username` (which reads through `rets_username_ciphertext`), but the DB constraint applies to the raw `rets_username_ciphertext` column. Any code path that sets `rets_username = nil` (not `""`) on a test-board credential will pass model validation and then raise `ActiveRecord::NotNullViolation` at save, surfacing as an unhandled 500.

The controller always assigns `credential.rets_username = username` (line 43) where `username` comes from `board_credential_params[:rets_username]`, which Rails strong params returns as `nil` when the key is absent — not `""`. A curl request without the `rets_username` key at all will trigger this.

**Fix:** Either (a) relax the DB constraint for test-board-compatible rows by making the columns nullable with a migration, or (b) normalise to `""` in the setter:

```ruby
def rets_username=(value)
  self.rets_username_ciphertext = value.presence || ""
end

def rets_password=(value)
  self.rets_password_ciphertext = value.presence || ""
end
```

And update the migration to allow null:
```ruby
change_column :brokerage_board_credentials, :rets_username_ciphertext, :text, null: true
change_column :brokerage_board_credentials, :rets_password_ciphertext, :text, null: true
```

---

### CR-02: `Rails.env.development?` bypass in `BoardCredentialsController#create` skips RETS validation for all boards in development

**File:** `backend/app/controllers/v1/admin/board_credentials_controller.rb:29`

**Issue:** Line 29 reads:
```ruby
result = if board.is_test_board? || Rails.env.development?
```

This means in the `development` environment, connecting a real production RETS board with blank or wrong credentials succeeds silently, persists the credential as `status: "active"`, and bulk-inserts `BrokerageEstate` rows for all estates on that board. When a developer connects to a staging/production DB from their local dev environment (a common pattern with DB dumps), or when the development environment is shared/cloud-hosted, this becomes a data integrity violation: a credential is stored as active when it has never been verified. The bypass should be limited to test boards only — the `board.is_test_board?` check already covers the intended use case.

**Fix:** Remove the `Rails.env.development?` branch entirely:

```ruby
result = if board.is_test_board?
  RetsAuthService::Result.new(success: true, error: nil)
else
  RetsAuthService.new(board: board, username: username, password: password).call
end
```

If local development against a live RETS endpoint is genuinely impractical, the correct approach is a seeded test board with `is_test_board: true` — not a blanket environment bypass.

---

## Warnings

### WR-01: `RetsAuthService` does not rescue `Errno::ECONNREFUSED`, `Errno::ECONNRESET`, or `OpenSSL::SSL::SSLError`

**File:** `backend/app/services/rets_auth_service.rb:28`

**Issue:** The rescue clause covers `HTTParty::Error, Net::OpenTimeout, Net::ReadTimeout, SocketError`. The project's own `GeocodingService` (which uses the same HTTParty pattern) rescues a materially wider set — `Errno::ECONNREFUSED`, `Errno::ECONNRESET`, `Errno::ETIMEDOUT`, `Errno::EHOSTUNREACH`, `OpenSSL::SSL::SSLError`, and `Timeout::Error`. In practice, a RETS endpoint behind a firewall or with an expired TLS certificate raises `Errno::ECONNREFUSED` or `OpenSSL::SSL::SSLError` respectively. These propagate unrescued through the controller, bypassing the graceful `result.success?` check and returning an unhandled 500 instead of a 422.

**Fix:**
```ruby
rescue HTTParty::Error, SocketError, EOFError,
       Errno::ECONNREFUSED, Errno::ECONNRESET, Errno::ETIMEDOUT,
       Errno::EHOSTUNREACH, OpenSSL::SSL::SSLError,
       Net::OpenTimeout, Net::ReadTimeout, Timeout::Error => e
  Result.new(success: false, error: "Could not connect to board endpoint: #{e.message}")
```

---

### WR-02: `require_admin!` in `BaseController` queries `BrokerageMembership` without `without_deleted`

**File:** `backend/app/controllers/v1/admin/base_controller.rb:14`

**Issue:** `BrokerageMembership` uses `acts_as_paranoid`. The `require_admin!` check (lines 14-20) uses a bare `BrokerageMembership.find_by(...)`, which by default includes soft-deleted rows under `acts_as_paranoid` (paranoid's default scope excludes deleted rows — meaning a soft-deleted admin membership is correctly invisible). However, `acts_as_paranoid` applies a default scope that _does_ exclude deleted rows on `find_by`, so the immediate correctness risk is low. The real risk is the inverse: if a developer calls `BrokerageMembership.unscoped.find_by(...)` elsewhere or if the paranoid version in use has a different default-scope behavior than expected, it silently grants access. The project's own CLAUDE.md convention mandates explicit `.without_deleted` on every `acts_as_paranoid` query — this code violates that convention and sets a bad precedent for all controllers inheriting `BaseController`. Since this file is not strictly in Phase 12 scope but is exercised by every action in this phase's controllers, it must be flagged.

**Fix:**
```ruby
def require_admin!
  membership = BrokerageMembership.without_deleted.find_by(
    user_id: Current.user.id,
    brokerage_id: Current.brokerage.id
  )
  # ...
end
```

---

### WR-03: `Estate#accessible_by` — second SQL branch (`brokerage_estates`) does not guard against deactivated board

**File:** `backend/app/models/estate.rb:33-37`

**Issue:** The second EXISTS subquery grants access to any estate with a matching `brokerage_estates` row, regardless of whether the associated `real_estate_board` is active or whether the board has been deactivated/soft-deleted since the row was inserted. The first branch (real boards) explicitly checks `bbc.status = 'active'` and `bbc.deleted_at IS NULL`. The second branch has no equivalent guard. This means if a test board is later administratively set to `active = false`, every brokerage that connected to it retains access through their existing `brokerage_estates` rows — silently. Because the `BrokerageEstate` rows are inserted on connect and never cleaned up on board deactivation, access revocation has no mechanism.

This is a correctness gap today (deactivating a board does not revoke access) and will become more visible as test boards are managed over time.

**Fix:** Add a board-active check to the second branch:
```sql
EXISTS (
  SELECT 1 FROM brokerage_estates be
  JOIN estates e2 ON e2.id = be.estate_id
  LEFT JOIN real_estate_boards reb2 ON reb2.id = e2.real_estate_board_id
  WHERE be.brokerage_id = :brokerage_id
    AND be.estate_id = estates.id
    AND (e2.real_estate_board_id IS NULL OR reb2.active = true)
)
```

Alternatively, enforce access revocation in a service object when a board is deactivated (delete matching `BrokerageEstate` rows).

---

## Info

### IN-01: Test coverage gap — uniqueness constraint not tested for test boards

**File:** `backend/test/models/brokerage_board_credential_test.rb:48`

**Issue:** The uniqueness test (line 48) only covers real boards. The `(brokerage_id, real_estate_board_id)` uniqueness validation applies equally to test boards, and the `find_or_initialize_by` in the controller relies on it being enforced correctly. There is no test asserting that a duplicate test-board credential is rejected. This is an INFO item because the validation code itself is correct — it's a coverage gap.

**Fix:** Add a test:
```ruby
test "uniqueness on (brokerage, real_estate_board) is enforced for test boards too" do
  create(:brokerage_board_credential,
    brokerage: @brokerage,
    real_estate_board: @test_board,
    rets_username: "",
    rets_password: "")
  dup = build(:brokerage_board_credential,
    brokerage: @brokerage,
    real_estate_board: @test_board,
    rets_username: "",
    rets_password: "")
  assert_not dup.valid?
  assert_includes dup.errors[:brokerage_id], "is already registered with this board"
end
```

---

### IN-02: `:test_board` factory trait does not override `rets_endpoint` to a non-routable value

**File:** `backend/test/factories/real_estate_boards.rb:9-13`

**Issue:** The `:test_board` trait inherits the base `sequence(:rets_endpoint)` which generates `https://rets{n}.example.com/login`. While this is an `.example.com` address (non-routable per RFC 2606), it is a realistic HTTPS URL. If any test inadvertently calls `RetsAuthService` against a test-board credential (e.g., by accidentally removing the `is_test_board?` guard in a future refactor), the service will attempt a network connection before timing out after 10 seconds. Explicitly setting `rets_endpoint` to an obviously invalid sentinel makes the intent clear and any accidental network call fail immediately.

**Fix:**
```ruby
trait :test_board do
  is_test_board { true }
  short_code { "TEST" }
  name { "Test RETS Board" }
  rets_endpoint { "https://test-board.invalid/rets" }
end
```

---

_Reviewed: 2026-05-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
