# Deferred Items — Phase 30 (Backend RBAC Enforcement)

Discovered during 30-01 execution. Out of scope for this plan (pre-existing, unrelated to RBAC changes) — logged per SCOPE BOUNDARY protocol, not fixed.

## Pre-existing: `RESERVED_SLUGS` collision with `"test.example.com"` fixture domain

**Found during:** Task 3 (running `admin_authorization_test.rb`) and full-suite verification after Plan 01.

**Issue:** `BrokerageDomain#valid_subdomain_slug` (added later, `app/models/brokerage_domain.rb`) rejects any domain whose slug (the part before the first dot) is in `RESERVED_SLUGS = %w[admin api www mail smtp ftp staging dev test app auth login signup dashboard static assets cdn docs help support status]`. Many pre-existing test fixtures use `domain: "test.example.com"`, whose slug `"test"` is reserved. Every test file using this fixture domain errors at `setup` with `ActiveRecord::RecordInvalid: Validation failed: Domain is reserved and cannot be used as a brokerage subdomain`.

**Scope:** Confirmed pre-existing (reproduced on `HEAD~3`, i.e. before any Phase 30 commits) and confirmed unrelated to files_modified for this phase. Affects ~46 test errors across `board_connect_flow_test.rb`, `board_credential_crud_test.rb`, `brokerage_board_credential_test.rb`, `estate_accessible_by_test.rb`, `filter_sets_test.rb`, `group_estate_coordinates_test.rb`, `group_estates_query_test.rb`, `invitations_test.rb`, and likely others not enumerated by this run.

**What was fixed in-scope (Rule 3, blocking):** `test/integration/admin_authorization_test.rb`'s own fixture (`"test.example.com"` → `"acme.example.com"`) was fixed because it directly blocked Task 3's own verification. All other occurrences were left untouched — out of scope for Plan 01 (`files_modified` only covers `admin_authorization_test.rb`).

**Recommendation:** A follow-up cleanup task (not part of v1.10's RBAC requirements) should either (a) bulk-replace `"test.example.com"` with a non-reserved domain across the test suite, or (b) remove `"test"` from `RESERVED_SLUGS` if it's not actually needed as a reserved brokerage subdomain slug.

**Verification of scope:** `RAILS_ENV=test bundle exec rails test` on the full suite after Plan 01: 209 runs, 0 failures, 46 errors (all attributable to this pre-existing issue, none in files touched by Plan 01).

**RESOLVED during Plan 02 (30-02):** Plan 02's own success criterion required the full suite to be green, and this issue directly blocked it (Rule 3, pre-authorized in the 30-02 execution brief). Fixed via the same mechanical rename pattern (`"test.example.com"` → `"acme.example.com"`) across all 6 remaining affected files: `board_connect_flow_test.rb`, `board_credential_crud_test.rb`, `filter_sets_test.rb`, `group_estate_coordinates_test.rb`, `group_estates_query_test.rb`, `invitations_test.rb` (`invitations_test.rb` also had 2 hardcoded `Host` header occurrences, also renamed). Reduced full-suite errors from 46 to 30. Commit: `fix(30-02): rename reserved-slug fixture domain across affected integration tests`.

## NEW pre-existing issue discovered while fixing the above: seeded `RealEstateBoard(short_code: "TEST")` collides with the `:test_board` factory trait

**Found during:** Plan 02 (30-02) Task 3, after fixing the RESERVED_SLUGS issue above and re-running the full suite (expecting 0 errors, got 30).

**Issue:** The test environment's `DATABASE_URL` (set in `backend/.env`, loaded by `dotenv-rails` for all environments including `test` — `config/database.yml`'s `test:` block specifying `adapter: sqlite3` is effectively overridden by the environment variable at boot) points at a **live, shared Neon Postgres database** rather than an isolated local test database. This database already contains a real `real_estate_boards` row seeded on 2026-05-24 (`short_code: "TEST"`, `name: "Test RETS Board"`, `is_test_board: true`) — almost certainly from a `rails db:seed` run against this same shared instance.

`test/factories/real_estate_boards.rb`'s `:test_board` trait hardcodes the same `short_code: "TEST"` / `name: "Test RETS Board"` values (by design, to mirror the seeded convention). Whenever a test's `setup` block calls `create(:real_estate_board, :test_board)`, it collides with the pre-existing live row and raises `ActiveRecord::RecordInvalid: Validation failed: Name has already been taken, Short code has already been taken`.

**Scope:** Confirmed pre-existing and unrelated to Phase 30 / RBAC — reproduced independently in `test/models/brokerage_board_credential_test.rb` and `test/models/estate_accessible_by_test.rb` (pure model tests with no `brokerage_domain`/RESERVED_SLUGS involvement at all, so this is a distinct root cause from the issue above). The seeded row's `created_at` (2026-05-24) pre-dates all Phase 30 commits by well over a month. Affects 30 test errors across 4 files after the RESERVED_SLUGS fix: `test/models/brokerage_board_credential_test.rb` (5), `test/integration/board_connect_flow_test.rb` (6), `test/integration/board_credential_crud_test.rb` (10), `test/models/estate_accessible_by_test.rb` (9).

**What was NOT fixed (out of scope for Plan 02):** This was discovered only as a consequence of the pre-authorized RESERVED_SLUGS fix (which was scoped to a mechanical domain rename, not further debugging). Resolving this properly requires either (a) an operational fix — removing the stale seed row from the shared live database, or pointing the test environment at a genuinely isolated database (correcting the `DATABASE_URL` leak into the `test` environment), or (b) a broader factory change (e.g. `find_or_create_by` semantics for `:test_board`) that touches 4+ test files outside this plan's `files_modified` and risks unpredictable ripple effects on other tests relying on a fresh `RealEstateBoard` per test. Both are judgment calls beyond a "mechanical rename" and were left untouched per the SCOPE BOUNDARY / Rule 4 guidance.

**Recommendation:** A follow-up infra task should (a) audit why `backend/.env`'s `DATABASE_URL` leaks into the `test` Rails environment despite `config/database.yml` specifying `sqlite3` for `test:`, and either fix `.env` scoping (e.g. `.env.test` override, or unset `DATABASE_URL` for `RAILS_ENV=test`) or point `test:` at a disposable database; and (b) once test runs against an isolated database, decide whether `:test_board` should use `find_or_create_by` for idempotency or keep `create` now that seed-data collisions can no longer occur.

**Verification of scope:** `RAILS_ENV=test bundle exec rails test` on the full suite after the RESERVED_SLUGS fix (Plan 02): 255 runs, 479 assertions, 0 failures, 30 errors (all attributable to this newly-documented issue, confirmed independent of files touched by Plan 01 or Plan 02).
