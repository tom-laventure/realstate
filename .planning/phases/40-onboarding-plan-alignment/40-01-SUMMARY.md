---
phase: 40-onboarding-plan-alignment
plan: 01
subsystem: api
tags: [rails, onboarding, plan-tiers, backend]

# Dependency graph
requires:
  - phase: 36-plan-configuration-tier-migration
    provides: "AppConstants::PLAN_TIERS single source of truth for seat caps, pricing, capability flags"
provides:
  - "GET /v1/onboarding/plan_tiers endpoint serializing AppConstants::PLAN_TIERS as a drift-proof frontend data source"
  - "Growth signup no longer requires a custom_domain to complete (backend validation removed)"
affects: [40-02, 40-03, 40-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plain-hash render json: for non-AR config-as-endpoint controllers (no ActiveModel::Serializer for Struct data)"

key-files:
  created:
    - backend/app/controllers/v1/onboarding/plan_tiers_controller.rb
    - backend/test/integration/onboarding_plan_tiers_test.rb
    - backend/test/integration/onboarding_growth_no_domain_test.rb
  modified:
    - backend/config/routes.rb
    - backend/app/controllers/v1/onboarding/brokerages_controller.rb

key-decisions:
  - "PlanTiersController#index builds a plain Hash array (no AMS serializer) since AppConstants::PlanTier is a Struct, not an ActiveRecord model — matches DomainsController#check precedent"
  - "Deleted only the 3-line growth-requires-custom_domain block; kept the AppConstants::PLAN_TIERS.key?(plan) validity guard and the custom_domain record-creation block untouched (T-40-02 threat mitigation)"

patterns-established:
  - "Config-as-endpoint pattern: GET action serializing a frozen Ruby constant, guarded by MainDomainOnly + CognitoAuth like sibling onboarding controllers, zero DB access"

requirements-completed: [ONB-05, ONB-06]

# Metrics
duration: 13min
completed: 2026-07-23
---

# Phase 40 Plan 01: Onboarding Plan Alignment (Backend) Summary

**New `GET /v1/onboarding/plan_tiers` endpoint serving `AppConstants::PLAN_TIERS` as the frontend's drift-proof data source, plus removal of the retired "Growth requires custom_domain" backend validation.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-23T02:44:00Z (approx.)
- **Completed:** 2026-07-23T02:57:00Z
- **Tasks:** 2 completed
- **Files modified:** 5 (2 created controllers/none, 2 test files created, 2 files modified)

## Accomplishments
- `V1::Onboarding::PlanTiersController#index` returns the 3 real tiers (free, independent, growth) in display order, with price-per-month in dollars, seat cap, and the four capability flags (`real_boards`, `clients`, `custom_domain`, `calendar_sync`) — guarded by the same `MainDomainOnly` + `CognitoAuth` stack as sibling onboarding controllers.
- Removed the "Growth requires custom_domain" validation from `BrokeragesController#create`; a Growth signup with no custom domain now completes (201) instead of being rejected (422).
- Confirmed the real security boundary — `AppConstants::PLAN_TIERS.key?(plan)` — survived the deletion; unknown plan strings still return 422 "Invalid plan".

## Task Commits

Each task was committed atomically (directly in the `backend/` sub-repo per CLAUDE.md's "Sub-repos" convention):

1. **Task 1: Create PlanTiersController#index + route + endpoint test** - `dd7e5f4` (feat)
2. **Task 2: Remove growth-requires-custom_domain validation + prove Growth-no-domain succeeds** - `362ba4a` (fix)

_Note: `gsd-sdk query commit-to-subrepo` returned `{ committed: false, reason: "no sub_repos configured in .planning/config.json" }` because the SDK's handler reads a top-level `config.sub_repos` key, while this project's `.planning/config.json` nests it under `config.planning.sub_repos`. Fell back to plain `git commit` executed directly inside the `backend/` repo, which is the documented CLAUDE.md convention ("Commit code to them directly") and functionally equivalent._

## Files Created/Modified
- `backend/app/controllers/v1/onboarding/plan_tiers_controller.rb` - New controller; `#index` serializes `AppConstants::PLAN_TIERS` as a plain hash array (key, price_per_month, seat_cap, 4 capability flags)
- `backend/config/routes.rb` - Added `resources :plan_tiers, only: [:index]` inside the existing `namespace :onboarding` block
- `backend/app/controllers/v1/onboarding/brokerages_controller.rb` - Deleted the 3-line `if plan == "growth" && custom_domain.blank?` rejection block; the `custom_domain = params[:custom_domain]...` assignment and the downstream `if custom_domain.present?` record-creation block were both left untouched
- `backend/test/integration/onboarding_plan_tiers_test.rb` - New integration test: 200 with 3 tiers in order, correct field shape, free = $0.0/nil seat cap, growth = $79.0/mo, and 403 on a brokerage-subdomain Origin
- `backend/test/integration/onboarding_growth_no_domain_test.rb` - New integration test: Growth signup with no `custom_domain` param returns 201 and creates the Brokerage; an unrecognized `plan` value ("premium") still returns 422 "Invalid plan"

## Decisions Made
- Followed the plan's D-01/threat-model guidance exactly: no new gem, no AMS serializer class for `PLAN_TIERS` (it's a plain `Struct`, not an ActiveRecord model) — a private hash-builder method on the controller mirrors the existing `DomainsController#check` precedent.
- Kept the `custom_domain = params[:custom_domain].to_s.strip.downcase` assignment line in `BrokeragesController#create` exactly where it was (it's still consumed by the later `if custom_domain.present?` record-creation block) — only the validation/rejection block was deleted, per Pitfall 5 in 40-RESEARCH.md.

## Deviations from Plan

None - plan executed exactly as written. The only deviation is process-level (documented above): the `commit-to-subrepo` SDK tool couldn't resolve `sub_repos` from this project's nested config shape, so commits were made with plain `git commit` directly in `backend/`, which is explicitly sanctioned by CLAUDE.md's "Sub-repos" section ("Commit code to them directly").

## Issues Encountered
- `bin/rails test` prints a non-fatal `PG::ObjectInUse` stack trace during the `db:test:load_schema => db:test:purge` pre-task (a shared Neon Postgres connection already in use) before falling through to running the actual Minitest suite, which completes successfully (0 failures, 0 errors) in all four test runs performed during this plan. This matches the pre-existing STATE.md-documented DB quirk ("`DATABASE_URL` leaks into `RAILS_ENV=test`") and is unrelated to this plan's changes — not treated as a regression.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `GET /v1/onboarding/plan_tiers` is live and ready for Plan 40-02/40-03 (frontend plan-selection step rebuild) to consume via `useFetchPlanTiers` per the established `assets/api` → `store/hooks` → Context pattern.
- Growth signups with no custom domain now succeed end-to-end at the API layer; the frontend `DomainStep.tsx` Yes/No toggle rebuild (D-05) in a subsequent plan can rely on this being unblocked.
- No blockers identified for downstream plans in this phase.

---
*Phase: 40-onboarding-plan-alignment*
*Completed: 2026-07-23*

## Self-Check: PASSED

- FOUND: backend/app/controllers/v1/onboarding/plan_tiers_controller.rb
- FOUND: backend/test/integration/onboarding_plan_tiers_test.rb
- FOUND: backend/test/integration/onboarding_growth_no_domain_test.rb
- FOUND commit: dd7e5f4
- FOUND commit: 362ba4a
