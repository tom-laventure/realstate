---
phase: 36-plan-configuration-tier-migration
reviewed: 2026-07-14T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - backend/app/constants/plan_tiers.rb
  - backend/app/controllers/v1/admin/domains_controller.rb
  - backend/app/controllers/v1/onboarding/brokerages_controller.rb
  - backend/app/models/brokerage.rb
  - backend/config/initializers/constants.rb
  - backend/db/migrate/20260714000000_migrate_brokerage_plan_tiers.rb
  - backend/test/integration/admin_domains_test.rb
  - backend/test/integration/onboarding_domain_guard_test.rb
  - backend/test/integration/ops_plan_test.rb
  - backend/test/jobs/domain_health_job_test.rb
  - backend/test/jobs/domain_verification_job_test.rb
  - backend/test/mailers/domain_mailer_test.rb
  - backend/test/models/brokerage_freeze_test.rb
  - backend/test/models/plan_config_test.rb
findings:
  critical: 1
  warning: 5
  info: 2
  total: 8
status: issues_found
---

# Phase 36: Code Review Report

**Reviewed:** 2026-07-14
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 36 introduces `AppConstants::PLAN_TIERS`, the `Brokerage#plan_config` accessor, and migrates the `plan` enum from `basic`/`premium` to `free`/`independent`/`growth`, rewiring `admin/domains_controller.rb` and `onboarding/brokerages_controller.rb` to read plan capability off the new config. I read all 14 listed files in full, diffed the five phase commits (`749be58`, `df15b68`, `e8db061`, `e294a7b`, `cef96ca`) against their parents, and ran the full backend test suite for every file touched by this phase (`test/models/plan_config_test.rb`, `test/models/brokerage_freeze_test.rb`, and the six `test/integration|jobs|mailers` files) — all 97 assertions pass, matching the commit's stated 0-failures claim.

The core defect is in the new "single source of truth" config itself: `PLAN_TIERS` freezes the *Hash*, but not the `PlanTier` `Struct` values inside it, so any future caller can silently mutate a shared, process-wide tier config (proven by reproduction below). Given this is the exact primitive Phases 37–39 will build all plan-gating logic on top of, this is a blocking design flaw, not a style nit. The remaining findings are test-coverage gaps for behavior this phase newly enables (e.g. `independent`-tier custom domains), a hardcoded tier-name comparison in the file this phase itself was supposed to make config-driven, and a rollback-safety gap in the migration's `down` method.

## Critical Issues

### CR-01: `PLAN_TIERS` struct values are mutable despite the hash being frozen

**File:** `backend/app/constants/plan_tiers.rb:5-48`
**Issue:** `PLAN_TIERS = { ... }.freeze` only freezes the outer `Hash`. Each value is a plain `Struct.new(..., keyword_init: true)` instance, which is **not** frozen and retains public setters. The file's own header comment claims this is "single source of truth for plan-tier seat caps, pricing, and capability flags... Changing any tier value is a one-file edit here" and `plan_config_test.rb` only asserts `AppConstants::PLAN_TIERS.frozen?` (the hash), never that individual tier values are immutable — so the gap is untested and easy to miss in review.

Reproduced directly against this file:
```
$ bundle exec ruby -e '
require_relative "app/constants/plan_tiers"
tier = AppConstants::PLAN_TIERS["free"]
tier.seat_cap = 999
puts AppConstants::PLAN_TIERS["free"].seat_cap
'
hash frozen? true
struct frozen? false
mutated seat_cap: 999
```
Because `Current.brokerage.plan_config` returns this exact shared object (not a copy) to every controller in every request, a single accidental mutation anywhere in the app (e.g. a future Phase 37/38/39 controller that writes `brokerage.plan_config.seat_cap = x` instead of comparing, or a typo `=` vs `==`) permanently corrupts the seat cap / price / capability flags for **every brokerage on that tier**, for every request served by that process, until restart. This is exactly the kind of landmine a foundational "config used everywhere" phase should close off, especially since Phases 37-39 explicitly build their gating logic on top of `plan_config`.

**Fix:** Either deep-freeze each tier value when building the hash, or switch to Ruby's immutable value object (`Data.define`, available on this project's Ruby 4.0.2 and frozen-by-default with no setters):
```ruby
module AppConstants
  PlanTier = Data.define(
    :seat_cap, :base_price_cents, :overage_price_cents, :annual_discount_rate,
    :real_boards, :clients, :custom_domain, :calendar_sync
  )

  PLAN_TIERS = {
    "free" => PlanTier.new(seat_cap: nil, base_price_cents: 0, ...),
    ...
  }.freeze
end
```
or, if keeping `Struct`, add `.each_value(&:freeze)` after building the hash and add a test asserting `AppConstants::PLAN_TIERS.values.all?(&:frozen?)`.

## Warnings

### WR-01: Migration `down` has no orphan-check symmetry and silently strands `free`-plan rows on rollback

**File:** `backend/db/migrate/20260714000000_migrate_brokerage_plan_tiers.rb:24-34`
**Issue:** `up` explicitly guards against leaving orphaned plan values ("halt the migration if any row was left with a plan value outside the three new tiers"). `down` has no equivalent guard. Once this migration ships, brokerages can sign up with `plan: "free"` (a genuinely new value that never existed under the old `basic`/`premium` enum — see `onboarding/brokerages_controller.rb`). If `down` is ever run after any such signups have occurred, those `free` rows are left completely untouched (`down` only maps `independent -> basic` and `growth -> premium`), while `change_column_default` flips the column default back to `"basic"`. Any brokerage stuck with `plan: "free"` after a rollback either violates the reverted `%w[basic premium]` model validation (if the model code is reverted alongside the DB) or silently carries a plan value the old code was never written to handle.
**Fix:** Add a rollback-time guard, and decide/document the intended fate of `free` rows on rollback (e.g. treat them as `basic`, or raise loudly instead of leaving them stranded):
```ruby
def down
  execute "UPDATE brokerages SET plan = 'basic' WHERE plan IN ('independent', 'free')"
  execute "UPDATE brokerages SET plan = 'premium' WHERE plan = 'growth'"
  change_column_default :brokerages, :plan, from: "free", to: "basic"
end
```

### WR-02: No test coverage for the newly-granted `independent`-tier custom domain capability

**File:** `backend/test/integration/admin_domains_test.rb`
**Issue:** This phase's actual behavior change in `admin/domains_controller.rb#custom` is that custom-domain access widened from `plan == "premium"` to `plan_config.custom_domain`, which is now `true` for **both** `independent` and `growth` (previously only `premium`/`growth` had it — `basic` never did). The test suite only exercises the `growth` (default fixture, `POST .../custom` returns 200 at line 139) and `free` (403, line 129) cases. There is no test asserting `plan: "independent"` also succeeds — the exact new capability this phase's config-driven rewire is supposed to unlock is unverified.
**Fix:** Add a case, e.g.:
```ruby
test "POST /v1/admin/domains/custom creates pending custom domain for independent brokerage" do
  @brokerage.update!(plan: "independent")
  post "/v1/admin/domains/custom", params: {domain: "brand.com"}, headers: auth_headers_for(@owner, @brokerage)
  assert_response :ok
end
```

### WR-03: No test coverage for `Onboarding::BrokeragesController#create`'s plan validation logic

**File:** `backend/app/controllers/v1/onboarding/brokerages_controller.rb:15-36`
**Issue:** This phase rewired three behaviors in this action: (1) `plan` is now validated against `AppConstants::PLAN_TIERS.key?(plan)` instead of `%w[basic premium]`, (2) `free` became a selectable signup plan (explicitly called out as the key reversal in `36-CONTEXT.md` D-05), and (3) the custom-domain-required-at-signup rule moved from `plan == "premium"` to `plan == "growth"`. None of this is under test. `onboarding_domain_guard_test.rb` only exercises the `MainDomainOnly` origin guard (it asserts 403/not-403, never inspects the created brokerage or plan-specific validation errors), and no other test file exercises this endpoint. Concretely untested: a request with `plan: "free"` succeeds without a custom domain, a request with `plan: "growth"` and no `custom_domain` is rejected with 422, and a request with an invalid plan literal (e.g. the old `"basic"`/`"premium"`) is now rejected with `"Invalid plan"`.
**Fix:** Add a dedicated integration test file (e.g. `test/integration/onboarding_brokerages_test.rb`) covering: free-tier signup succeeds without `custom_domain`; growth-tier signup without `custom_domain` returns 422; legacy `basic`/`premium` plan values are now rejected with `"Invalid plan"`.

### WR-04: Hardcoded tier-name string comparison reintroduced in the file this phase was meant to make config-driven

**File:** `backend/app/controllers/v1/onboarding/brokerages_controller.rb:34`
**Issue:** `.planning/PLAN-TIERS.md` ("Gating a new feature by plan") explicitly states: *"never hardcode a tier name or numeric cap inline in a controller. If a new feature needs a plan check, add it to the same config-driven pattern rather than inventing a one-off `brokerage.plan == "..."` check."* The plan-inclusion check on line 16 was correctly rewired to `AppConstants::PLAN_TIERS.key?(plan)`, but the very next plan-derived check three lines later is a literal string swap from `plan == "premium"` to `plan == "growth"` (see `e294a7b`) — the same hardcoded-tier-name pattern the project's own design doc calls out as the anti-pattern this phase exists to eliminate.
**Fix:** Either add a config-level flag (e.g. `requires_custom_domain_at_signup`) to `PlanTier` and check `AppConstants::PLAN_TIERS[plan]&.requires_custom_domain_at_signup`, or at minimum centralize the literal in a named constant so future tier renames don't require another grep-and-swap pass like the one `cef96ca` had to do across 7 files.

### WR-05: Favicon upload failure exposes raw internal exception message to the client

**File:** `backend/app/controllers/v1/onboarding/brokerages_controller.rb:52-59`
**Issue:** Pre-existing code (untouched by this phase's diff, but in a file under full review): `rescue => e; return render json: {error: "Failed to upload favicon: #{e.message}"}`. `e.message` for an `S3UploadService` failure can leak internal infrastructure detail (AWS SDK error text, bucket/key naming, network error internals) directly to an authenticated-but-untrusted client. Since this endpoint is reachable pre-tenant by any Cognito-authenticated user during onboarding, this is a low-friction information-disclosure surface.
**Fix:** Log `e` server-side and return a generic client-facing message:
```ruby
rescue => e
  Rails.logger.error("[onboarding] favicon upload failed: #{e.class}: #{e.message}")
  return render json: {error: "Failed to upload favicon"}, status: :unprocessable_entity
end
```

## Info

### IN-01: Stale test description no longer matches the tier name it exercises

**File:** `backend/test/integration/admin_domains_test.rb:139`
**Issue:** `test "POST /v1/admin/domains/custom creates pending custom domain for premium brokerage (D-08)"` — the `cef96ca` literal-swap pass renamed the plan value used by the shared `setup` block (`plan: "premium"` → `plan: "growth"`, line 9) but did not update this test's title, which still says "premium brokerage." Minor, but it's exactly the kind of drift that makes future greps for `"premium"` incomplete.
**Fix:** Rename to `"...for growth brokerage (D-08)"`.

### IN-02: Awkward user-facing copy for the custom-domain plan-gate error

**File:** `backend/app/controllers/v1/admin/domains_controller.rb:59`
**Issue:** `"Custom domains require a plan with custom domain access"` is circular/developer-speak ("a plan with custom domain access" restates the feature name). Per this repo's frontend/backend copy guidance ("error messages should be clear, concise, and human"), this reads like an internal capability-flag name leaking into user-facing text.
**Fix:** e.g. `"Upgrade to Independent or Growth to connect a custom domain"`.

---

_Reviewed: 2026-07-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
