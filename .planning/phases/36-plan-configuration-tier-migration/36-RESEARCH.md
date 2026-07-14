# Phase 36: Plan Configuration & Tier Migration - Research

**Researched:** 2026-07-14
**Domain:** Rails 7.1 data migration + centralized config constant (backend-only, no new gems/packages)
**Confidence:** HIGH

## Summary

Phase 36 is a small, self-contained backend change with no new dependencies: (1) a data-backfill migration that relabels the existing `brokerages.plan` string column's values, and (2) a single frozen Ruby config constant plus a `Brokerage#plan_config` accessor that every later v1.12 phase reads from. Both pieces have direct, unambiguous precedent already in this codebase — this is not new-technology research, it is "find the existing idiom and apply it" research.

The critical fact governing the migration design: `brokerages.plan` is a **plain `string` column with app-level `validates :plan, inclusion:` — there is no Postgres `ENUM` type and no DB `CHECK` constraint** on it (confirmed via `db/schema.rb` and `db/migrate/20260315000000_add_plan_to_brokerages.rb`). This means "altering the enum's allowed values" is entirely a Ruby-level change (`app/models/brokerage.rb`'s `validates` line, plus the two controller checks), not a schema-level migration operation. The Rails migration itself only needs to perform the data backfill (`UPDATE brokerages SET plan = ...`). The codebase already has two precedents for this exact shape of backfill migration — one using raw `execute(<<~SQL)`, one using an in-migration model class — both documented below with recommendations.

The second critical fact: **`acts_as_paranoid` (paranoia 3.0.0) adds a `default_scope` that excludes soft-deleted rows** (`Brokerage.default_scope { paranoia_scope }`, aliased as `.without_deleted`). If the migration queries through the `Brokerage` AR model class without bypassing this default scope, soft-deleted brokerages will silently keep their old `basic`/`premium` plan value forever. Raw SQL via `execute` sidesteps this entirely since it never goes through ActiveRecord scoping — this is the recommended approach and matches the codebase's own precedent (`20260330000007_scope_estate_documents_to_group_estate.rb`).

**Primary recommendation:** Write the migration as a single `ActiveRecord::Migration[7.1]` with `def change` containing two raw `execute()` UPDATE statements (`basic`→`independent`, `premium`→`growth`), also updating the column `default:` to a valid new-tier value via `change_column_default`. Model/controller validation changes ship as regular code files in the same commit, not inside the migration. Build the plan config as a frozen `Hash`-of-`Struct`s (or a small `Data`/`Struct`-per-tier) under `app/constants/`, mirroring the existing `AppConstants::BROKERAGE_ROLES` pattern, with a `Brokerage#plan_config` instance method delegating to it.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Plan tier config (seat cap, price, overage, flags) | API / Backend | — | Pure Ruby constant, read server-side only; no client-side pricing logic exists or is needed this phase |
| `Brokerage#plan` value & validation | API / Backend | Database / Storage | Column lives in Postgres; validation and allowed-values list are enforced in the Rails model, not the DB |
| Existing-row plan backfill | Database / Storage | — | One-time data migration executed directly against the `brokerages` table |
| Custom-domain gating check | API / Backend | — | `admin/domains_controller.rb#custom` reads `Current.brokerage.plan` server-side; no client-side plan gating exists yet (deferred to Phase 37 per ROADMAP) |
| Onboarding plan selection | API / Backend | Browser / Client | Backend validates the `plan` param (this phase); the React signup wizard that produces that param is explicitly out of scope for Phase 36 (see Pitfall 1) |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Existing `basic` brokerages migrate to `independent`; existing `premium` brokerages migrate to `growth`. Both existing tiers already have full, unrestricted real-board/real-client access, so mapping either to the new `free` tier is unacceptable (would wall off live paying customers).
- **D-02:** No seat truncation and no back-billing for migrated brokerages that already exceed their new tier's included seat count. The migration only relabels the plan; seat-overage billing math applies going forward. No payment processor exists yet (BILL-01 deferred), so nothing is actually charged as a result of this migration.
- **D-03:** Migration executes as a single Rails migration that both alters the `plan` enum's allowed values and backfills existing rows (`basic`→`independent`, `premium`→`growth`) transactionally, in one step. No separate rake-task-based backfill.
- **D-04:** The 15% annual billing discount applies to the base subscription price ONLY, never to per-seat overage billing. Overage seats bill at the same standard monthly-equivalent rate whether the brokerage is on monthly or annual billing.
- **D-05:** The onboarding brokerage-creation flow (`backend/app/controllers/v1/onboarding/brokerages_controller.rb`) is updated in this phase to accept all three tiers — `free`, `independent`, `growth` — as valid signup choices (currently validates only `basic`/`premium`). Selecting `free` at signup in this phase does not yet enforce any Free-tier gating (that's Phase 37) — it just sets the plan label and applies Free's config values (unlimited seats, no custom domain requirement). The existing `premium`-requires-custom-domain-at-signup validation needs re-evaluation for the new tiers: `growth` should likely keep an equivalent requirement, while `independent` and `free` should not require a custom domain at signup. Exact validation shape left to planning; direction (Free must not require custom domain) is locked.
- **D-06:** All existing hardcoded plan checks must be rewired to read from the new centralized config rather than comparing against literal tier-name strings. Confirmed call sites:
  - `backend/app/controllers/v1/admin/domains_controller.rb` (line 58-59): `unless Current.brokerage.plan == "premium"` → config-driven capability check (custom domain allowed for `independent`/`growth`, not `free`).
  - `backend/app/controllers/v1/onboarding/brokerages_controller.rb` (lines 15-17, 34-35): plan inclusion validation and premium-domain-requirement check — both updated for the new three-tier enum.
  - `backend/app/models/brokerage.rb` (line 14): `validates :plan, inclusion: {in: %w[basic premium]}` → becomes `%w[free independent growth]`.
- **D-07:** Phase 36 introduces a reusable `Brokerage#plan_config` accessor (exact method name/shape left to planning) that returns the full tier config (seat cap, base price, overage rate, capability flags) for the brokerage's current plan. Single, already-tested integration point for Phases 37-39.

### Claude's Discretion
- Exact Ruby structure of the plan config constant (module constant vs. class, file location under `app/models/` or `app/lib/`) — no strong precedent exists in this codebase for this kind of data (no `config_for`/YAML pattern used elsewhere); pick whatever fits Rails conventions cleanly.
- Exact method name and return shape of the `Brokerage#plan_config` accessor — a plain hash, a `Struct`, or a small value object are all consistent with the codebase's existing `Result`-struct pattern used in service objects.
- Exact validation rewrite in `onboarding/brokerages_controller.rb` for which tiers require a custom domain at signup (direction locked: Free must not require one; precise conditional shape is discretionary).

### Deferred Ideas (OUT OF SCOPE)
- Frontend plan-selection UI updates (`PlanBadge.tsx`, `PlanCard.tsx`, `createBrokerageWizard.ts`, etc.) to reflect the new three-tier names — likely belongs in Phase 37 (which has a UI hint) since Phase 36 is backend-only per ROADMAP.md scope. **See Pitfall 1 below — this deferral has a functional consequence that the planner must account for.**
- Per-brokerage manual review/flagging of over-cap seats after migration — not needed now since no billing is live; revisit once BILL-01 ships.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAN-01 | `Brokerage#plan` supports `free`/`independent`/`growth`, migrated from `basic`/`premium` | Confirmed column is a plain `string`, no DB enum/CHECK constraint — validated by codebase precedent for raw-SQL backfill migrations bypassing `acts_as_paranoid`'s default scope (see Architecture Patterns, Pitfall 3) |
| PLAN-02 | Seat caps, base prices, overage rates centralized in one code-level config, no plan numbers duplicated elsewhere | `AppConstants::BROKERAGE_ROLES` (`app/constants/roles.rb`) is the closest existing precedent for a frozen constant of this kind — recommend `app/constants/plan_tiers.rb` following the same module pattern (see Architecture Patterns) |
| PLAN-03 | Config structured so a tier's seat cap/price/overage is a one-file change | Single-file frozen `Hash` keyed by tier name satisfies this directly; no DB-backed model needed (per PLAN-TIERS.md's explicit decision, echoed by CONTEXT.md) |
| PLAN-10 | Independent: $20/mo, 1 seat, $20/seat overage | Values sourced from `.planning/PLAN-TIERS.md` (canonical design doc) and REQUIREMENTS.md — no ambiguity, direct constant values |
| PLAN-11 | Growth: $79/mo, 5 seats, $16/seat overage | Same as above |
| PLAN-13 | 15% annual discount defined for Independent/Growth, base price only | D-04 in CONTEXT.md locks scope (base price only, never overage) — config must expose a distinct `annual_discount_rate` applied only when computing the base-price line item, never touching the overage rate field |

## Standard Stack

No new libraries, gems, or npm packages are introduced by this phase. It uses only:
- Rails 7.1.5 `ActiveRecord::Migration[7.1]` (already in Gemfile.lock) `[VERIFIED: Gemfile.lock]`
- `paranoia` 3.0.0 (`acts_as_paranoid`, already in Gemfile.lock) `[VERIFIED: Gemfile.lock]`
- Plain Ruby (`Struct`, `Hash`, `Module` constants) — no gem required for the config object

**Installation:** None required.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages (no `npm install`, no `bundle add`). Skipping the legitimacy gate per its own scope condition ("whenever this phase installs external packages").

## Architecture Patterns

### Confirmed current schema (verified by direct file read)

```ruby
# db/schema.rb, line 90
t.string "plan", default: "basic", null: false
```

```ruby
# db/migrate/20260315000000_add_plan_to_brokerages.rb — the ONLY migration that touches this column today
class AddPlanToBrokerages < ActiveRecord::Migration[7.1]
  def change
    add_column :brokerages, :plan, :string, default: "basic", null: false
  end
end
```

No `add_check_constraint` exists on `plan` (only other string-enum-like columns in this codebase — e.g. `AppConstants::BROKERAGE_ROLES`, `EstateDate::AUDIENCES`, `UserCalendarConnection::PROVIDERS` — also rely purely on Rails-level `validates :x, inclusion:` with no DB constraint). **This is the established codebase convention: do not add a DB `CHECK` constraint for this phase** — it would be inconsistent with every other enum-like column in the schema and is not requested by any locked decision.
`[VERIFIED: db/schema.rb, db/migrate/*]`

### Pattern 1: Data-backfill migration via raw `execute` (recommended)

**What:** Two direct `UPDATE` statements against the `brokerages` table, executed inside the migration's `change` block, plus a `change_column_default` to keep the column's default value valid post-migration.
**When to use:** Simple 1:1 value remapping across a whole table, where the migration must not go through model callbacks/validations/scopes (and specifically must not be blind to soft-deleted rows).
**Why this is correct for PLAN-01:** Raw SQL bypasses `acts_as_paranoid`'s `default_scope`, so soft-deleted `brokerages` rows are backfilled too — see Pitfall 3. This is also the exact idiom already used in this codebase for a same-shaped problem.

```ruby
# Source: codebase precedent — backend/db/migrate/20260330000007_scope_estate_documents_to_group_estate.rb
class MigrateBrokeragePlanTiers < ActiveRecord::Migration[7.1]
  def up
    execute <<~SQL
      UPDATE brokerages SET plan = 'independent' WHERE plan = 'basic'
    SQL
    execute <<~SQL
      UPDATE brokerages SET plan = 'growth' WHERE plan = 'premium'
    SQL

    change_column_default :brokerages, :plan, from: "basic", to: "free"
  end

  def down
    execute <<~SQL
      UPDATE brokerages SET plan = 'basic' WHERE plan = 'independent'
    SQL
    execute <<~SQL
      UPDATE brokerages SET plan = 'premium' WHERE plan = 'growth'
    SQL

    change_column_default :brokerages, :plan, from: "free", to: "basic"
  end
end
```

Note: `execute` against Postgres in production, but the **test** environment runs on `sqlite3` (`config/database.yml`) — raw Postgres-flavored SQL syntax must stay ANSI-portable. The `UPDATE ... SET ... WHERE ...` statements above are plain ANSI SQL and work identically on both adapters; avoid Postgres-only syntax (e.g. `RETURNING`, `FILTER`) if extending this pattern. `[VERIFIED: config/database.yml — test env uses sqlite3, production/development use postgresql]`

**Alternative pattern found in codebase (in-migration model class):** `db/migrate/20260226230000_add_images_to_listing_details.rb` defines a throwaway `class MigrationListingDetail < ActiveRecord::Base; self.table_name = "listing_details"; end` inside the migration file specifically to avoid coupling to the real app model (which may change/be deleted later) and to avoid unwanted concerns (like `acts_as_paranoid`) being pulled in. This is a valid alternative if the planner prefers `find_each`/`update_columns` over raw SQL, but for a simple two-value swap, raw `execute` is simpler and has no N+1/batching concerns since it's a single `UPDATE` per old value.

### Pattern 2: Default column value must change too

The column's current default (`"basic"`) will become an invalid value the moment `validates :plan, inclusion: {in: %w[free independent growth]}` ships. Any code path that creates a `Brokerage` without explicitly setting `plan` (the `test/factories/brokerages.rb` factory currently does **not** set `plan`, relying on the column default) will start failing model validation once the new inclusion list ships, unless the default is also changed to a member of the new list.

**Two sub-decisions for the planner:**
1. Which of the three new values should the new column default be? `free` is the most defensible choice — it's the "safe"/non-privileged default for any row created without an explicit plan, and matches the design intent of Free being the ungated entry tier.
2. Ensure the migration's `change_column_default` call and the model's new `validates` list ship in the same deploy — they are two different files but must be treated as one atomic unit of work (no schema-level way to enforce this; it's a task-sequencing concern for the plan).

### Pattern 3: Centralized plan config constant

**What:** A frozen, code-level Ruby constant describing all three tiers' economics and capability flags, structurally modeled on the codebase's one existing precedent for this kind of static reference data (`AppConstants::BROKERAGE_ROLES`) but richer (that one is a flat array; this needs a keyed struct-per-tier).
**When to use:** Any place a controller, serializer, or (later phase's) frontend component needs seat caps, pricing, or a capability flag for a brokerage's plan.
**Recommended shape** (discretionary per CONTEXT.md, this is the most idiomatic fit for the codebase's existing patterns — `app/constants/roles.rb` module-constant style, `app/services/groups/create.rb`'s `Struct.new` style):

```ruby
# app/constants/plan_tiers.rb
module AppConstants
  PlanTier = Struct.new(
    :seat_cap,               # Integer or nil (nil = unlimited)
    :base_price_cents,       # Integer, monthly, in cents
    :overage_price_cents,    # Integer per additional seat/month, in cents
    :annual_discount_rate,   # Float, e.g. 0.15 — applies to base_price_cents ONLY (PLAN-13/D-04)
    :real_boards,            # Boolean
    :clients,                # Boolean
    :custom_domain,          # Boolean
    :calendar_sync,          # Boolean
    keyword_init: true
  )

  PLAN_TIERS = {
    "free" => PlanTier.new(
      seat_cap: nil, base_price_cents: 0, overage_price_cents: 0,
      annual_discount_rate: 0.0, real_boards: false, clients: false,
      custom_domain: false, calendar_sync: false
    ),
    "independent" => PlanTier.new(
      seat_cap: 1, base_price_cents: 2000, overage_price_cents: 2000,
      annual_discount_rate: 0.15, real_boards: true, clients: true,
      custom_domain: true, calendar_sync: true
    ),
    "growth" => PlanTier.new(
      seat_cap: 5, base_price_cents: 7900, overage_price_cents: 1600,
      annual_discount_rate: 0.15, real_boards: true, clients: true,
      custom_domain: true, calendar_sync: true
    )
  }.freeze
end
```

Storing prices as integer cents (not float dollars) avoids floating-point rounding bugs in billing math — this is a general Rails/Ruby best practice for money values, not something this codebase currently has precedent for (no billing code exists yet — BILL-01 is deferred), but is worth flagging since Phase 39's "pure billing recalculation" will directly consume these fields.
`[ASSUMED — cents-based storage is standard Ruby/Rails practice for monetary values, not verified against a documented codebase convention since no billing code exists yet]`

**`Brokerage#plan_config` accessor** (D-07):

```ruby
# app/models/brokerage.rb
def plan_config
  AppConstants::PLAN_TIERS.fetch(plan) { AppConstants::PLAN_TIERS.fetch("free") }
end
```

Using `.fetch(plan) { ... }` with a fallback (rather than `.fetch(plan)` alone, which raises `KeyError`) is a defensive choice worth flagging to the planner as a discretionary decision: should an unrecognized `plan` value (which should be impossible post-migration, given the model validation) raise loudly or silently fall back to `free`? Given `validates :plan, inclusion:` already guarantees only the three valid values can be persisted, a bare `.fetch(plan)` (raising `KeyError` on any bug/inconsistency) is arguably safer — it fails loudly rather than silently degrading a paid brokerage to Free's capability set. **Recommend the planner choose fail-loud (`.fetch(plan)`, no fallback block) over silent-fallback**, since a silent fallback to `free` on a data bug would incorrectly strip a real brokerage's custom-domain/board access.

### Anti-Patterns to Avoid
- **Hardcoding tier names in conditionals** (`if brokerage.plan == "growth"`) anywhere outside the config file itself and the migration — this is exactly what PLAN-02 and D-06 exist to eliminate. Every capability check should go through `plan_config.custom_domain` (or equivalent), not a plan-name string comparison.
- **Referencing the live `Brokerage` AR model class directly inside the migration** without bypassing its `acts_as_paranoid` default scope — see Pitfall 3.
- **Adding a DB-level CHECK constraint or a real Postgres ENUM type** for `plan` — inconsistent with every other enum-like column in this schema, not requested by any locked decision, and adds migration complexity (Postgres `ALTER TYPE ... ADD VALUE` cannot run inside a transaction) with no corresponding benefit given validation already lives in the model.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Soft-delete-aware bulk update | A custom `Brokerage.with_deleted.update_all(...)` call reasoned about scope-by-scope | Raw `execute(<<~SQL)` UPDATE statements | Raw SQL is immune to any future `acts_as_paranoid` scope changes and matches existing codebase precedent (`20260330000007`) |
| Money-value struct | A new gem (e.g. `money-rails`) | Plain integer-cents fields on the `PlanTier` `Struct` | The scope here (3 tiers, read-only config, no currency conversion, no persistence) doesn't warrant a dependency; `BILL-01` (deferred) is the appropriate place to reconsider if real billing math grows more complex |

**Key insight:** This phase's entire scope is well within plain Ruby/Rails idioms already present in the codebase — introducing any new abstraction (gem, DB-backed config model, enum type) would be scope creep against PLAN-TIERS.md's explicit "code-level constant, not DB-backed" decision and CONTEXT.md's "no strong precedent... pick whatever fits Rails conventions cleanly" discretion.

## Common Pitfalls

### Pitfall 1: Onboarding frontend will break the moment the backend's plan validation changes (cross-phase gap)

**What goes wrong:** `frontend/src/store/reducers/createBrokerageWizard.ts` defines `export type CreateBrokeragePlan = 'basic' | 'premium'`, and `frontend/src/containers/createBrokerage/steps/PlanSelectionStep.tsx` renders exactly two `PlanCard`s with `plan="basic"` / `plan="premium"` hardcoded — these are the **only** two values the current onboarding wizard can ever POST to `/v1/onboarding/brokerage`. If Phase 36 tightens `onboarding/brokerages_controller.rb`'s validation to `%w[free independent growth]` (per D-05/D-06) and the model's `validates :plan, inclusion:` to the same list, then every real signup submitted through the current frontend will receive a `422 "Invalid plan"` — **onboarding breaks in production** for any user hitting it between Phase 36's deploy and Phase 37's (deferred) frontend update.
**Why it happens:** CONTEXT.md explicitly defers all frontend plan-string changes to Phase 37 ("no UI hint on Phase 36 in ROADMAP.md"), but D-05 simultaneously locks in tightening backend validation to the new three-value list in Phase 36. These two decisions combined create a functional gap that CONTEXT.md does not resolve.
**How to avoid:** Flag explicitly to the user/planner as an open question (see Open Questions below) rather than silently choosing one of: (a) deploy Phase 36 and Phase 37 back-to-back before real traffic hits onboarding, (b) have Phase 36's backend accept `basic`/`premium` as deprecated aliases that map to `independent`/`growth` for a transition window, or (c) accept a short window of broken onboarding as a known, intentional tradeoff. This is a product/rollout decision, not a technical one — research surfaces it, does not resolve it.
**Warning signs:** Any integration/manual test of the real onboarding wizard (not the `Ops::` test surface) after Phase 36 ships, before Phase 37 ships.
`[VERIFIED: frontend/src/store/reducers/createBrokerageWizard.ts, frontend/src/containers/createBrokerage/steps/PlanSelectionStep.tsx — read directly]`

### Pitfall 2: Existing backend tests hardcode `plan: "basic"` / `plan: "premium"` and will fail post-migration

**What goes wrong:** Seven existing test files create brokerages with the old plan values via FactoryBot (`create(:brokerage, plan: "premium")`, `create(:brokerage, plan: "basic")`) or as request params. Once the model's `validates :plan, inclusion:` list changes, these `create!` calls will raise `ActiveRecord::RecordInvalid`.
**Why it happens:** The `validates :plan, inclusion:` line is shared code — changing its allowed-values list affects every test that constructs a `Brokerage` (or POSTs a plan param) with the old values, not just production code paths.
**How to avoid:** The plan/task list for this phase must include updating these test call sites as part of the same unit of work, not as an afterthought:
- `test/mailers/domain_mailer_test.rb` (`plan: "premium"`)
- `test/jobs/domain_verification_job_test.rb` (`plan: "premium"`)
- `test/jobs/domain_health_job_test.rb` (`plan: "premium"`)
- `test/models/brokerage_freeze_test.rb` (`plan: "premium"`)
- `test/integration/ops_plan_test.rb` (`plan: "premium"`)
- `test/integration/admin_domains_test.rb` (`plan: "premium"` in setup, plus `@brokerage.update!(plan: "basic")` and a test literally titled `"POST /v1/admin/domains/custom returns 403 for basic plan brokerage (DMOD-05)"`)
- `test/integration/onboarding_domain_guard_test.rb` (`plan: "basic"` as a request param, twice)

Recommend mapping 1:1 per D-01 (`premium`→`growth`, `basic`→`independent`) so existing test intent (e.g. "premium plan gets custom domain access") is preserved without needing to re-derive test semantics.
`[VERIFIED: grep across test/ directory]`

### Pitfall 3: `acts_as_paranoid`'s default scope silently excludes soft-deleted brokerages from model-based bulk updates

**What goes wrong:** `Brokerage` calls `acts_as_paranoid` with no options (`app/models/brokerage.rb` line 2), which installs `default_scope { paranoia_scope }` (aliased `.without_deleted`) — confirmed by reading `paranoia-3.0.0/lib/paranoia.rb`. Any migration code that queries through the `Brokerage` AR class (e.g. `Brokerage.where(plan: "basic").update_all(...)`) will silently skip soft-deleted rows. Those rows keep an old, now-invalid `plan` value indefinitely — including on future restore (`acts_as_paranoid`'s `.restore`), which would resurrect a brokerage with a plan value the model itself no longer considers valid.
**Why it happens:** Rails `default_scope` applies transparently to every query through the model class, including inside migrations, unless explicitly bypassed with `.with_deleted` (paranoia's unscoped-all method) or by avoiding the model class entirely.
**How to avoid:** Use raw SQL `execute()` (Pattern 1 above) for the backfill — it operates directly on the table and is completely unaffected by any AR-level default scope. This is the safest option and requires no `.with_deleted` incantation to remember.
**Warning signs:** After the migration, running `Brokerage.with_deleted.where(plan: %w[basic premium]).count` should return `0`. Recommend the plan include a verification step (e.g. inside the migration itself, using `execute("SELECT COUNT(*) FROM brokerages WHERE plan NOT IN ('free','independent','growth')")` and raising if non-zero, mirroring the orphan-check pattern already used in `20260330000007_scope_estate_documents_to_group_estate.rb`) to guarantee "no orphaned or invalid plan values after migration" (Phase 36 Success Criterion 1) is actually verified, not just assumed.
`[VERIFIED: vendor/bundle/.../paranoia-3.0.0/lib/paranoia.rb — default_scope and without_deleted alias read directly]`

### Pitfall 4: Column default value left stale after validation tightens

**What goes wrong:** If the migration backfills existing rows but does not also update `t.string "plan", default: "basic"` to a new valid default, any code path that creates a `Brokerage` without an explicit `plan` (notably `test/factories/brokerages.rb`, which does not set `plan`) will get `plan: "basic"` from the DB default, then immediately fail `validates :plan, inclusion: {in: %w[free independent growth]}` on save.
**Why it happens:** `change_column_default` is a separate schema operation from backfilling existing row *values* — it's easy to do one and forget the other since they address different points in time (existing rows vs. future inserts).
**How to avoid:** Include `change_column_default :brokerages, :plan, from: "basic", to: "free"` in the same migration (see Pattern 1/2 above).
`[VERIFIED: test/factories/brokerages.rb — factory does not set :plan, relies on column default]`

### Pitfall 5: Ops-panel `brokerages_controller.rb` also permits `:plan` via strong params

**What it is, not a defect to fix:** `app/controllers/ops/brokerages_controller.rb` (line 61) permits `:plan` in its update params, gated only by HTTP Basic Auth (`OPS_USERNAME`/`OPS_PASSWORD` env vars) — an internal-only tool, not customer-facing. This is a **useful existing test surface** the planner can point to for manually verifying tier assignment/`plan_config` behavior post-migration (mirrors the existing `Ops::PlanController` pattern already used for testing `freeze_custom_domains!`), not a security gap requiring action in this phase. Flagged here so the planner doesn't waste time re-discovering it, and so it isn't mistaken for something needing a fix.
`[VERIFIED: app/controllers/ops/brokerages_controller.rb, app/controllers/ops/base_controller.rb]`

## Code Examples

### Verified: current (pre-migration) hardcoded checks to be rewired

```ruby
# backend/app/models/brokerage.rb, line 14 (current)
validates :plan, inclusion: {in: %w[basic premium]}
```

```ruby
# backend/app/controllers/v1/admin/domains_controller.rb, lines 58-60 (current)
unless Current.brokerage.plan == "premium"
  return render json: {error: "Custom domains require a premium plan", code: "plan_required"}, status: :forbidden
end
```

```ruby
# backend/app/controllers/v1/onboarding/brokerages_controller.rb, lines 15-17, 34-35 (current)
plan = params[:plan].to_s
unless %w[basic premium].include?(plan)
  return render json: {error: "Invalid plan"}, status: :unprocessable_entity
end
# ...
if plan == "premium" && custom_domain.blank?
  return render json: {error: "Custom domain is required for premium"}, status: :unprocessable_entity
end
```

All three call sites confirmed via direct file read; line numbers match CONTEXT.md's canonical references exactly.

### Rewired shape (illustrative, using the recommended `plan_config` accessor)

```ruby
# backend/app/controllers/v1/admin/domains_controller.rb — after rewiring
unless Current.brokerage.plan_config.custom_domain
  return render json: {error: "Custom domains require a plan with custom domain access", code: "plan_required"}, status: :forbidden
end
```

```ruby
# backend/app/controllers/v1/onboarding/brokerages_controller.rb — after rewiring
plan = params[:plan].to_s
unless AppConstants::PLAN_TIERS.key?(plan)
  return render json: {error: "Invalid plan"}, status: :unprocessable_entity
end
# ...
if plan == "growth" && custom_domain.blank?
  return render json: {error: "Custom domain is required for this plan"}, status: :unprocessable_entity
end
```

(The `growth`-requires-custom-domain-at-signup conditional above is illustrative only — CONTEXT.md leaves the exact shape to planning; it locks only that `free`/`independent` must NOT require one.)

## State of the Art

Not applicable in the conventional sense (no external library/framework version drift to track) — but worth noting the "state of the art" for this codebase specifically:

| Old Approach | Current/Target Approach | When Changed | Impact |
|--------------|------------------------|---------------|--------|
| Binary `basic`/`premium` plan gating a single feature (custom domains) | Three-tier `free`/`independent`/`growth` config gating multiple capability flags | Phase 36 (this phase) | Every future plan-gated feature reads from one config instead of growing more ad-hoc string comparisons |
| Ad-hoc `brokerage.plan == "premium"` checks scattered in 2 controllers | Centralized `Brokerage#plan_config` accessor | Phase 36 (this phase) | Matches the existing `RequireRole`/role-array precedent (`AppConstants::BROKERAGE_ROLES`), making plan checks auditable in one place, per PLAN-TIERS.md's explicit directive |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Storing tier prices as integer cents (not float dollars) is the right representation | Architecture Patterns / Pattern 3 | Low — purely an internal representation choice with no external interface yet (no billing integration exists); easy to change before BILL-01 consumes it, no data migration risk since nothing is persisted |
| A2 | New column default of `"free"` is the correct choice (vs. `"independent"` or leaving it unset with `null: true`) | Architecture Patterns / Pattern 2 | Low-medium — if wrong, only affects code paths that create a `Brokerage` without explicitly setting `plan` (currently only the test factory); a bad default could accidentally grant new test brokerages the wrong capability set, but is trivially fixed by editing the migration/factory before Phase 36 execution completes |
| A3 | `.fetch(plan)` without a fallback (fail-loud) is preferable to a silent `free` fallback in `plan_config` | Architecture Patterns / Pattern 3 | Medium — if the planner instead chooses silent-fallback and a future bug ever produces an unrecognized `plan` value, a paying brokerage could silently lose custom-domain/board access with no error raised, which would be a confusing support issue to diagnose |

## Open Questions

1. **How should the gap identified in Pitfall 1 (onboarding frontend hardcodes `basic`/`premium`, backend validation tightens to the new three values) be handled?**
   - What we know: CONTEXT.md locks tightening backend validation in Phase 36 (D-05/D-06) and separately locks deferring all frontend plan-string updates to Phase 37. Taken together, these create a window where the live onboarding wizard cannot successfully create a brokerage.
   - What's unclear: Whether this is an accepted/intentional short window (e.g., phases 36 and 37 will be deployed together or in immediate succession with no real traffic in between), or whether the backend should temporarily accept `basic`/`premium` as deprecated aliases mapping to `independent`/`growth` until Phase 37 ships.
   - Recommendation: Surface this explicitly to the user during planning/discussion before committing to a validation shape — it's a rollout/sequencing decision, not a research gap that can be resolved from code alone.

2. **Should the migration's orphan-check (verifying zero rows remain with old/invalid plan values) be a hard `raise` inside the migration itself, mirroring `20260330000007_scope_estate_documents_to_group_estate.rb`'s orphan-count guard?**
   - What we know: That codebase precedent halts the migration with a descriptive error if any row would be left in a bad state, rather than silently proceeding.
   - What's unclear: Whether this phase's migration should adopt the same defensive check, given only two known input values (`basic`, `premium`) exist today with no possibility of a third stray value (unlike the `estate_documents`/`group_estates` join scenario, which had a real possibility of true orphans).
   - Recommendation: Include it anyway — it's cheap insurance and directly demonstrates Success Criterion 1 ("no orphaned or invalid plan values after migration") is actually enforced, not just hoped for.

## Environment Availability

Skipped — this phase has no external tool/service/runtime dependencies beyond the already-installed Rails/Ruby/Postgres/sqlite3 stack already verified present and in use by the existing test suite and application.

## Validation Architecture

Skipped — `.planning/config.json` has `workflow.nyquist_validation: false` explicitly set. `[VERIFIED: .planning/config.json]`

For reference (not a required section, but useful context for the planner): this backend uses **Minitest** (not RSpec) with `factory_bot_rails` and `shoulda-matchers`, confirmed via `test/test_helper.rb`. Test files live under `test/models/`, `test/integration/`, `test/jobs/`, `test/mailers/`. The seven files listed in Pitfall 2 are the ones this phase's tasks must touch.

## Security Domain

`security_enforcement` is absent from `.planning/config.json` → treated as enabled per instructions.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No auth mechanism changes in this phase |
| V3 Session Management | No | No session changes in this phase |
| V4 Access Control | Yes | Plan-gated capability checks (custom domain access) must be enforced server-side via the new config-driven `plan_config` accessor, not client-controllable state — already the existing pattern (`Current.brokerage.plan` resolved server-side via `BrokerageAuth`), this phase strengthens it by centralizing the check, doesn't weaken it |
| V5 Input Validation | Yes | `params[:plan]` in `onboarding/brokerages_controller.rb` must remain a strict allow-list check (`AppConstants::PLAN_TIERS.key?(plan)` or equivalent) — never interpolated or trusted without validation. This pattern already exists (`unless %w[basic premium].include?(plan)`) and must be preserved, just extended to the new three values. |
| V6 Cryptography | No | No cryptographic material touched by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Mass-assignment of `plan` via a customer-facing update endpoint (privilege escalation to a higher tier without payment) | Elevation of Privilege | **Already mitigated** — confirmed `v1/admin/brokerages_controller.rb#brokerage_params` does NOT permit `:plan` in its strong params (verified by direct read); only `v1/onboarding/brokerages_controller.rb` (initial creation only, not update) and the HTTP-Basic-Auth-gated `ops/brokerages_controller.rb` (internal tool) accept a `plan` param. No action needed this phase, but the planner should NOT add `:plan` to the customer-facing admin update endpoint's permitted params without an explicit product decision to allow self-service plan changes (which is out of scope — BILL-01 governs actual plan-change billing, deferred). |
| Unrestricted plan selection at signup with no payment gating | (Not a STRIDE-category vulnerability — a known, accepted, documented product gap) | Not applicable — `.planning/PLAN-TIERS.md`'s "Known gaps" section already documents "No payment processor integration exists" as an accepted v1.12 scope boundary (BILL-01 deferred). Onboarding currently lets any authenticated user select any of the three tiers with zero payment enforcement — this is intentional per the current requirements, not a defect to fix in Phase 36. |

## Sources

### Primary (HIGH confidence)
- `backend/db/schema.rb` (line 90) — confirmed `plan` column type/default/null constraint
- `backend/db/migrate/20260315000000_add_plan_to_brokerages.rb` — confirmed no DB enum/CHECK constraint history
- `backend/db/migrate/20260330000007_scope_estate_documents_to_group_estate.rb` — raw-SQL backfill migration precedent, including orphan-check guard pattern
- `backend/db/migrate/20260226230000_add_images_to_listing_details.rb` — in-migration model class backfill precedent (alternative pattern)
- `backend/vendor/bundle/ruby/4.0.0/gems/paranoia-3.0.0/lib/paranoia.rb` — confirmed `default_scope`/`with_deleted`/`without_deleted` behavior directly from gem source
- `backend/app/models/brokerage.rb`, `backend/app/controllers/v1/admin/domains_controller.rb`, `backend/app/controllers/v1/onboarding/brokerages_controller.rb` — current hardcoded plan checks read directly
- `backend/app/constants/roles.rb` — closest existing precedent for a frozen config constant
- `backend/app/services/groups/create.rb` — `Struct.new`/`Result` pattern precedent
- `backend/Gemfile.lock` — confirmed Rails 7.1.5, paranoia 3.0.0
- `backend/config/database.yml` — confirmed test env uses sqlite3, prod/dev use postgresql (portability constraint on raw SQL)
- `.planning/PLAN-TIERS.md`, `.planning/REQUIREMENTS.md`, `.planning/phases/36-plan-configuration-tier-migration/36-CONTEXT.md` — canonical design/requirements sources
- `frontend/src/store/reducers/createBrokerageWizard.ts`, `frontend/src/containers/createBrokerage/steps/PlanSelectionStep.tsx`, `frontend/src/assets/api/onboarding/createBrokerage.ts` — confirmed frontend hardcodes `'basic' | 'premium'` (Pitfall 1)
- `backend/test/factories/brokerages.rb` and 7 test files (grep-confirmed list in Pitfall 2)
- `backend/app/controllers/v1/admin/brokerages_controller.rb`, `backend/app/controllers/ops/brokerages_controller.rb`, `backend/app/controllers/ops/base_controller.rb` — confirmed mass-assignment exposure surface for `:plan`
- `.planning/config.json` — confirmed `nyquist_validation: false`, `security_enforcement` absent

### Secondary (MEDIUM confidence)
None — all findings in this research were verified directly against the codebase or canonical planning documents; no unverified WebSearch claims were needed given the phase's scope (no new external library/API integration).

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; existing Rails/paranoia versions confirmed via Gemfile.lock
- Architecture: HIGH — migration and config patterns both have direct, verified precedent in this exact codebase
- Pitfalls: HIGH — all five pitfalls verified via direct file reads (schema, gem source, frontend types, test files, controller strong params), not inferred

**Research date:** 2026-07-14
**Valid until:** No external time pressure (no library version drift risk) — valid indefinitely for this codebase's current state; re-verify only if the `brokerages` schema or `paranoia` gem version changes before Phase 36 executes.
