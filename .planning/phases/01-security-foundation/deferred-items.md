# Deferred Items — Phase 01 Security Foundation

## Out-of-Scope Issues Discovered During Execution

### Pre-existing `db:seed` failure (discovered during Plan 01-03 Task 3)

- **Discovered:** 2026-05-02 during Plan 01-03
- **Issue:** `bundle exec rails db:seed` fails at `seed_users!` with `ActiveRecord::NotNullViolation: PG::NotNullViolation: ERROR: null value in column "uid" of relation "users"`. The `users.uid` column has a NOT NULL constraint but the seed data does not populate it.
- **Impact:** Full `db:seed` cannot complete; affects developer onboarding workflow.
- **Not fixed because:** Out of scope for Plan 01-03 (CORS/rack-attack/seeds plan). The dev domain seed function itself (`seed_dev_domains!`) works correctly — verified via direct `rails runner` invocation.
- **Suggested fix:** Update `db/seeds/01_users.rb` to populate the `uid` field (likely the Cognito `sub` or an email-based identifier).
