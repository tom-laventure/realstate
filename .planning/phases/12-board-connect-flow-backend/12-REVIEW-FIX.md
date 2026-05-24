---
phase: 12-board-connect-flow-backend
fixed_at: 2026-05-23T00:00:00Z
review_path: .planning/phases/12-board-connect-flow-backend/12-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-05-23T00:00:00Z
**Source review:** .planning/phases/12-board-connect-flow-backend/12-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (2 Critical, 3 Warning)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: DB NOT NULL constraint on ciphertext columns causes save failure for test-board blank credentials

**Files modified:** `backend/app/models/brokerage_board_credential.rb`, `backend/db/migrate/20260523000001_make_bbc_ciphertext_columns_nullable.rb`
**Commit:** 08a4e90
**Applied fix:** Updated both setter methods (`rets_username=` and `rets_password=`) to normalise nil/blank values to empty string using `value.presence || ""` before delegating to the ciphertext column. Also created a new migration (`20260523000001_make_bbc_ciphertext_columns_nullable.rb`) to change both `rets_username_ciphertext` and `rets_password_ciphertext` columns from `null: false` to `null: true`, eliminating the DB-level NOT NULL constraint as a safety net.

### CR-02: Rails.env.development? bypass in BoardCredentialsController#create

**Files modified:** `backend/app/controllers/v1/admin/board_credentials_controller.rb`
**Commit:** d0c3ed7
**Applied fix:** Removed `|| Rails.env.development?` from the conditional on line 29. The bypass condition now reads `if board.is_test_board?` only, which is the intended scope. Real boards in any environment now always go through `RetsAuthService` authentication.

### WR-01: RetsAuthService rescue clause missing exception types

**Files modified:** `backend/app/services/rets_auth_service.rb`
**Commit:** 053a501
**Applied fix:** Expanded the rescue clause from `HTTParty::Error, Net::OpenTimeout, Net::ReadTimeout, SocketError` to include `EOFError`, `Errno::ECONNREFUSED`, `Errno::ECONNRESET`, `Errno::ETIMEDOUT`, `Errno::EHOSTUNREACH`, `OpenSSL::SSL::SSLError`, and `Timeout::Error`. This matches the pattern used in the project's `GeocodingService` and ensures connection failures (firewall-blocked endpoints, expired TLS certificates) return a graceful 422 instead of an unhandled 500.

### WR-02: require_admin! missing without_deleted on BrokerageMembership

**Files modified:** `backend/app/controllers/v1/admin/base_controller.rb`
**Commit:** f144f79
**Applied fix:** Added `.without_deleted` to both `BrokerageMembership.find_by(...)` calls — in `require_admin!` and `require_owner!`. This enforces the project-wide CLAUDE.md convention that all `acts_as_paranoid` queries must use explicit `without_deleted` scoping.

### WR-03: Estate#accessible_by second SQL branch missing board-active check

**Files modified:** `backend/app/models/estate.rb`
**Commit:** 56547f4
**Applied fix:** Extended the second EXISTS subquery to JOIN through `estates e2` and LEFT JOIN `real_estate_boards reb2`, adding the condition `AND (e2.real_estate_board_id IS NULL OR reb2.active = true)`. This means deactivating a board now revokes access through the `brokerage_estates` path for all connected brokerages, consistent with the first branch's `bbc.status = 'active'` guard.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-05-23T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
