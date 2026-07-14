---
phase: 36-plan-configuration-tier-migration
plan: 02
subsystem: api
tags: [ruby, rails, migration, plan-tiers, billing, rbac]

# Dependency graph
requires:
  - phase: 36-plan-configuration-tier-migration (plan 01)
    provides: "AppConstants::PLAN_TIERS frozen config + Brokerage#plan_config accessor"
provides:
  - "Brokerage#plan enum migrated from basic/premium to free/independent/growth, with all existing rows (including soft-deleted) backfilled and the column default changed to free"
  - "Brokerage#plan validation restricted to the three new tier values — basic/premium are now rejected"
  - "Admin::DomainsController#custom gates custom-domain creation via Current.brokerage.plan_config.custom_domain (config-driven, no plan-name string comparison)"
  - "Onboarding::BrokeragesController#create validates plan against AppConstants::PLAN_TIERS.key? and requires a custom domain at signup only for growth"
affects: [37-free-tier-gating, 38-upgrade-downgrade-lifecycle, 39-paid-to-paid-billing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Raw-SQL execute() backfill + in-migration orphan-check guard (raise if any row left outside the target enum) — mirrors the estate_documents group_estate backfill precedent"
    - "Plan-gated capability checks read Current.brokerage.plan_config.<flag> exclusively; no controller or model code compares plan against a literal tier-name string anymore"

key-files:
  created:
    - backend/db/migrate/20260714000000_migrate_brokerage_plan_tiers.rb
  modified:
    - backend/app/models/brokerage.rb
    - backend/app/controllers/v1/admin/domains_controller.rb
    - backend/app/controllers/v1/onboarding/brokerages_controller.rb
    - backend/test/models/brokerage_freeze_test.rb
    - backend/test/integration/ops_plan_test.rb
    - backend/test/integration/admin_domains_test.rb
    - backend/test/integration/onboarding_domain_guard_test.rb
    - backend/test/mailers/domain_mailer_test.rb
    - backend/test/jobs/domain_verification_job_test.rb
    - backend/test/jobs/domain_health_job_test.rb

key-decisions:
  - "D-01/D-03 backfill mapping executed exactly as locked: basic->independent, premium->growth, via raw SQL (not Brokerage.update_all) so acts_as_paranoid's default_scope does not skip soft-deleted rows"
  - "Column default changed basic->free inside the same migration (Pitfall 4) — the old basic default would be invalid the instant the model validation flips"
  - "DMOD-05 test fixture corrected to plan: \"free\" instead of the plan's literal basic->independent substitution — see Deviations"

patterns-established:
  - "Every future plan-gated controller check reads Current.brokerage.plan_config.<capability_flag> — this plan closes out the last two hardcoded plan == \"premium\" / %w[basic premium] call sites in the codebase"

requirements-completed: [PLAN-01, PLAN-02]

# Metrics
duration: ~15min
completed: 2026-07-14
---

# Phase 36 Plan 02: Plan Configuration & Tier Migration Summary

**Migrated `Brokerage#plan` from the binary `basic`/`premium` enum to the three-tier `free`/`independent`/`growth` enum via a raw-SQL backfill migration with an orphan-check guard, flipped the model validation, and rewired both the admin custom-domain gate and onboarding signup validation to read from the config-driven `plan_config`/`PLAN_TIERS` accessor instead of comparing plan-name string literals.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-14T21:19:10Z (immediately following 36-01 completion)
- **Completed:** 2026-07-14T21:34:21Z
- **Tasks:** 3/3 completed
- **Files modified:** 11 (1 created, 10 modified)

## Accomplishments
- `MigrateBrokeragePlanTiers` migration: raw-SQL backfill (`basic`→`independent`, `premium`→`growth`), column default `basic`→`free`, and an in-migration orphan-check guard that raises if any row is left outside the three new tiers — ran clean against the dev/prod-shaped Postgres schema with zero invalid rows
- `Brokerage#plan` validation now `%w[free independent growth]` — `basic`/`premium` are rejected going forward
- `Admin::DomainsController#custom` gates custom-domain creation on `Current.brokerage.plan_config.custom_domain` (true for `independent`/`growth`, false for `free`) instead of `plan == "premium"`
- `Onboarding::BrokeragesController#create` validates the signup `plan` param against `AppConstants::PLAN_TIERS.key?` (strict allow-list, closes T-36-01) and requires a custom domain at signup only when `plan == "growth"` (D-05: `free`/`independent` no longer require one)
- Seven test files updated to the new tier literals; full backend suite re-verified green against the new enum

## Task Commits

Each task was committed atomically (inside `backend`'s own git repo per CLAUDE.md sub-repo convention):

1. **Task 1: Write and run the plan-tier backfill migration** - `e8db061` (feat)
2. **Task 2: Flip model validation and rewire both controllers to config-driven checks** - `e294a7b` (feat)
3. **Task 3: Update the seven test files to the new tier literals and run the full suite** - `cef96ca` (test)

**Plan metadata:** commit pending (docs: complete plan, top-level monorepo)

## Files Created/Modified
- `backend/db/migrate/20260714000000_migrate_brokerage_plan_tiers.rb` - raw-SQL backfill + orphan-check guard + column-default change (`up`/`down`)
- `backend/app/models/brokerage.rb` - `validates :plan, inclusion: {in: %w[free independent growth]}`
- `backend/app/controllers/v1/admin/domains_controller.rb` - `custom` action gates on `plan_config.custom_domain`; comment updated to drop the stale "premium only" phrasing
- `backend/app/controllers/v1/onboarding/brokerages_controller.rb` - plan inclusion check via `PLAN_TIERS.key?`; custom-domain-at-signup requirement now keys off `plan == "growth"`
- `backend/test/models/brokerage_freeze_test.rb` - `plan: "premium"` → `plan: "growth"`
- `backend/test/integration/ops_plan_test.rb` - `plan: "premium"` → `plan: "growth"`
- `backend/test/integration/admin_domains_test.rb` - setup fixture `plan: "premium"` → `plan: "growth"`; DMOD-05 fixture corrected to `plan: "free"` (see Deviations)
- `backend/test/integration/onboarding_domain_guard_test.rb` - `plan: "basic"` → `plan: "independent"` (both occurrences)
- `backend/test/mailers/domain_mailer_test.rb` - `plan: "premium"` → `plan: "growth"`
- `backend/test/jobs/domain_verification_job_test.rb` - `plan: "premium"` → `plan: "growth"`
- `backend/test/jobs/domain_health_job_test.rb` - `plan: "premium"` → `plan: "growth"`

## Decisions Made
- Followed D-01/D-03's locked backfill mapping exactly: `basic`→`independent`, `premium`→`growth`, executed transactionally within a single migration, raw SQL only (never through the `Brokerage` AR class, to avoid `acts_as_paranoid` silently excluding soft-deleted rows from the bulk UPDATE).
- Column default changed `basic`→`free` in the same migration as the backfill (not a separate migration) — this was called out in RESEARCH.md Pitfall 4 as needing to land before or alongside the validation flip, since the old `basic` default becomes an invalid value the instant Task 2's validation change lands.
- `custom_domain`-required-at-signup conditional kept as the literal-string `plan == "growth"` shape (not a new dedicated `custom_domain_required_at_signup` config flag) — PATTERNS.md/CONTEXT.md left this shape to planner/executor discretion, and the literal form is sufficient because `growth` membership itself still resolves against the same `PLAN_TIERS` keys elsewhere in the same method (D-06 compliance).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DMOD-05 test fixture corrected from `plan: "independent"` to `plan: "free"`**
- **Found during:** Task 3 (full suite verification, first run)
- **Issue:** The plan's task 3 action and PATTERNS.md's substitution table both instructed a literal `basic`→`independent` swap for the DMOD-05 test (`"POST /v1/admin/domains/custom returns 403 for basic plan brokerage"`), reasoning that `basic`→`independent` "retains no custom domain access" semantics. That reasoning does not hold under the tier config established in plan 36-01: `AppConstants::PLAN_TIERS["independent"].custom_domain` is `true` (Independent is a paid tier with full custom-domain access per PROJECT.md/PLAN-TIERS.md — only `free` denies it). Applying the plan's literal instruction produced a real test failure: `POST /v1/admin/domains/custom` returned `200 OK` for an `independent`-plan brokerage instead of the expected `403`, because the newly config-driven `plan_config.custom_domain` check (Task 2) correctly evaluates `independent` as having the capability. The literal substitution the plan specified would have shipped an incorrect regression test that asserted the wrong access-control behavior for the `independent` tier.
- **Fix:** Changed the DMOD-05 fixture to `@brokerage.update!(plan: "free")` (the only tier with `custom_domain: false`) and updated the test title to `"...returns 403 for free plan brokerage (DMOD-05)"`. This preserves the test's actual intent — asserting that a plan without custom-domain capability is denied — under the real tier semantics rather than the stale `basic`-era assumption baked into the plan's substitution table.
- **Files modified:** `backend/test/integration/admin_domains_test.rb`
- **Verification:** Full suite re-run: 315 runs, 631 assertions, 0 failures, 30 errors — matching plan 36-01's documented pre-existing baseline exactly (all 30 errors are the known `test_board` factory/DB collision, none related to this plan).
- **Committed in:** `cef96ca` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary correction — the plan's own literal test-substitution instruction, if followed verbatim, would have committed a test asserting incorrect access-control behavior for the `independent` tier (a paid tier that must retain custom-domain access per PROJECT.md's tier definitions). No scope creep — same file, same test, corrected fixture value only.

## Issues Encountered

None beyond the deviation documented above. The full backend test suite's 30 pre-existing errors (`BoardConnectFlowTest`, `BoardCredentialCrudTest`, `BrokerageBoardCredentialTest`, `EstateAccessibleByTest` — all `RealEstateBoard(:test_board)` factory/DB collision) remain unchanged in count and origin from plan 36-01's baseline, confirming this plan introduced no new test breakage.

## User Setup Required

None - no external service configuration required.

## ROLLOUT NOTES — D-08 Deploy-Sequencing Risk (must read before deploy)

**This plan tightens backend plan validation to `free`/`independent`/`growth` with NO backward-compatible aliasing for `basic`/`premium`.** As of this commit:

- `Brokerage#plan` rejects `basic`/`premium` outright (`ActiveRecord::RecordInvalid` on create/update).
- `POST /v1/onboarding/brokerage` rejects any `plan` param not in `AppConstants::PLAN_TIERS` (i.e. anything other than `free`/`independent`/`growth`) with a `422 "Invalid plan"`.
- The onboarding **frontend** (`createBrokerageWizard.ts`, `PlanSelectionStep.tsx`) still only sends `basic`/`premium` today — it is not updated until Phase 37.

**Consequence: if this backend deploys before a coordinated frontend fix (or before Phase 37 ships), every real onboarding signup will receive a `422 Invalid plan` and be unable to create a brokerage.** This is a full onboarding-break window, not a degraded-but-functional state.

The user (Tom) explicitly accepted this risk during Phase 36 discussion (D-08) and will coordinate deploys manually — either:
1. Deploy backend + frontend together in the same release window, or
2. Accept a short, planned downtime window on the onboarding flow between backend deploy and frontend catch-up.

**Do not deploy this backend change to production standalone without confirming one of the above with the operator first.** No aliasing/backward-compatibility shim was built in this plan by design (D-08) — this is the correct, deliberate scope boundary, not an oversight.

Existing brokerages are unaffected by this risk — the migration (Task 1) already backfilled all existing rows to valid `independent`/`growth` values before the validation tightened, so no currently-live brokerage holds an invalid `plan` value post-deploy. The risk is confined to **new signups** via the onboarding flow until the frontend catches up.

## Next Phase Readiness

- Phase 36 (both plans 36-01 and 36-02) is now fully complete: `AppConstants::PLAN_TIERS`, `Brokerage#plan_config`, the three-tier enum migration, and both rewired controllers are all in place and test-verified.
- Phase 37 (Free-tier gating) can now build its TEST-board-only wall, client-invite block, and other Free-tier restrictions on top of `Current.brokerage.plan_config` — no further enum/config foundation work is needed.
- Phase 37 also owns the frontend onboarding plan-selection UI update (`PlanBadge.tsx`, `PlanCard.tsx`, `createBrokerageWizard.ts`) that resolves this plan's D-08 rollout risk — this is a hard dependency the operator must sequence correctly with the backend deploy from this plan (see Rollout Notes above).
- Scope boundary respected: no frontend files were touched in this plan (backend-only per ROADMAP.md Phase 36 scope); no billing/payment logic was added (BILL-01 remains deferred).

---
*Phase: 36-plan-configuration-tier-migration*
*Completed: 2026-07-14*

## Self-Check: PASSED

All created/modified files verified to exist on disk:
- `backend/db/migrate/20260714000000_migrate_brokerage_plan_tiers.rb` — FOUND
- `.planning/phases/36-plan-configuration-tier-migration/36-02-SUMMARY.md` — FOUND

All task commits verified in `backend`'s git history:
- `e8db061` (Task 1) — FOUND
- `e294a7b` (Task 2) — FOUND
- `cef96ca` (Task 3) — FOUND
