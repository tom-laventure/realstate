# Deferred Items — Phase 30 (Backend RBAC Enforcement)

Discovered during 30-01 execution. Out of scope for this plan (pre-existing, unrelated to RBAC changes) — logged per SCOPE BOUNDARY protocol, not fixed.

## Pre-existing: `RESERVED_SLUGS` collision with `"test.example.com"` fixture domain

**Found during:** Task 3 (running `admin_authorization_test.rb`) and full-suite verification after Plan 01.

**Issue:** `BrokerageDomain#valid_subdomain_slug` (added later, `app/models/brokerage_domain.rb`) rejects any domain whose slug (the part before the first dot) is in `RESERVED_SLUGS = %w[admin api www mail smtp ftp staging dev test app auth login signup dashboard static assets cdn docs help support status]`. Many pre-existing test fixtures use `domain: "test.example.com"`, whose slug `"test"` is reserved. Every test file using this fixture domain errors at `setup` with `ActiveRecord::RecordInvalid: Validation failed: Domain is reserved and cannot be used as a brokerage subdomain`.

**Scope:** Confirmed pre-existing (reproduced on `HEAD~3`, i.e. before any Phase 30 commits) and confirmed unrelated to files_modified for this phase. Affects ~46 test errors across `board_connect_flow_test.rb`, `board_credential_crud_test.rb`, `brokerage_board_credential_test.rb`, `estate_accessible_by_test.rb`, `filter_sets_test.rb`, `group_estate_coordinates_test.rb`, `group_estates_query_test.rb`, `invitations_test.rb`, and likely others not enumerated by this run.

**What was fixed in-scope (Rule 3, blocking):** `test/integration/admin_authorization_test.rb`'s own fixture (`"test.example.com"` → `"acme.example.com"`) was fixed because it directly blocked Task 3's own verification. All other occurrences were left untouched — out of scope for Plan 01 (`files_modified` only covers `admin_authorization_test.rb`).

**Recommendation:** A follow-up cleanup task (not part of v1.10's RBAC requirements) should either (a) bulk-replace `"test.example.com"` with a non-reserved domain across the test suite, or (b) remove `"test"` from `RESERVED_SLUGS` if it's not actually needed as a reserved brokerage subdomain slug.

**Verification of scope:** `RAILS_ENV=test bundle exec rails test` on the full suite after Plan 01: 209 runs, 0 failures, 46 errors (all attributable to this pre-existing issue, none in files touched by Plan 01).
