# Phase 39: Paid-to-Paid Plan Changes - Research

**Researched:** 2026-07-22
**Domain:** Ruby on Rails backend — background job billing computation, lightweight audit-trail model
**Confidence:** HIGH

## Summary

Phase 39 is a small, tightly-bounded extension of an already-shipped mechanism. `Ops::PlanController` (Phase 38) already flips `brokerage.plan` and enqueues `ApplyPlanTransitionJob.perform_later(brokerage.id, old_plan, new_plan)` for every transition, including paid↔paid. `ApplyPlanTransitionJob#perform` already branches on `paid?(old_plan)`/`paid?(new_plan)` and currently has an explicit **empty branch** (just a comment) for the paid→paid case — this is exactly where Phase 39's logic lands. No controller changes, no new job, no new dispatch path.

The computation itself is trivial and fully data-driven: `AppConstants::PLAN_TIERS.fetch(new_plan)` (via `Brokerage#plan_config`) already contains `base_price_cents`, `seat_cap`, and `overage_price_cents` as pre-computed, ready-to-use figures — the "tier's own base ÷ included seats" design rationale documented in PLAN-TIERS.md is already baked into `overage_price_cents` at the config level (e.g. Independent: 2000/1 = 2000; Growth: 7900/5 ≈ 1580, config value is 1600 — the config is the source of truth, not a runtime division). The job does not need to derive overage price — it only multiplies `overage_price_cents * max(0, seat_count - seat_cap)` and adds `base_price_cents`.

The only genuinely new artifact this phase introduces is a persisted audit record (D-01). The codebase has a clean, directly-applicable precedent for this: `EstateDateCalendarEvent` — a model with **no `acts_as_paranoid`**, plain `t.timestamps`, `belongs_to` associations, and simple string/enum columns, used as an append-only sync-status log. This is the shape to copy for the new billing-snapshot model, not the `acts_as_paranoid` soft-delete pattern that dominates the rest of the codebase.

**Primary recommendation:** Fill in `ApplyPlanTransitionJob`'s paid→paid branch (replacing the comment) with: count seats via the exact `member_roles = %w[agent staff owner admin]` filter from `admin_brokerages_controller.rb:41`, look up `new_plan`'s config via `AppConstants::PLAN_TIERS.fetch(new_plan)`, compute `total_cents = base_price_cents + overage_price_cents * [seat_count - seat_cap, 0].max`, and persist one new `PlanBillingSnapshot` (or similarly named) record — modeled after `EstateDateCalendarEvent`'s non-paranoid, timestamped shape — inside the existing `ActiveRecord::Base.transaction` discipline the job already uses for `downgrade!`/`restore!`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Plan-flip + job dispatch | API / Backend (`Ops::PlanController`) | — | Already built in Phase 38; no change needed this phase |
| Billing recalculation (base + overage) | API / Backend (`ApplyPlanTransitionJob`) | Database / Storage (`AppConstants::PLAN_TIERS` config, read-only) | Pure computation against an in-memory constant; no I/O beyond the seat count and the audit-record write |
| Seat counting | Database / Storage (`BrokerageMembership` query) | — | Read-only aggregate query, mirrors `admin_brokerages_controller.rb`'s existing `member_count` logic |
| Billing-snapshot persistence | Database / Storage (new model + migration) | — | New append-only audit row; no business logic beyond a plain `create!` |
| Billing-record exposure (API/UI) | — | — | Explicitly out of scope this phase (Claude's Discretion in CONTEXT.md defaults to "persist only, no endpoint") |

## User Constraints

<user_constraints>
### Locked Decisions

- **D-01:** The recalculated billing amount is persisted as a lightweight record (new plan, seat count at time of transition, computed total in cents, timestamp) — not just returned in an API response or logged. This gives support and any future billing system (BILL-01) a queryable audit trail of what a brokerage was billed at each paid-to-paid transition, without building actual payment collection. Planner determines the exact table/model shape (e.g. a new `PlanBillingSnapshot` model vs. reusing an existing pattern) — direction (persist, don't just log/return) is locked.
- **D-02:** Billing recalculation runs inside `ApplyPlanTransitionJob`'s existing no-op branch for paid→paid transitions (the job already receives `old_plan`/`new_plan` and no-ops there per Phase 38's explicit comment: "Phase 39 owns paid<->paid billing recalculation"). This keeps every plan-transition side effect — purge, freeze+suspend, restore, and now billing — in the one dispatch point `Ops::PlanController` already enqueues into, rather than adding a second code path. Because this branch is async, `Ops::PlanController`'s immediate response stays the existing generic `{status: "transitioning", brokerage_id, old_plan, new_plan}` shape (same as upgrade/downgrade) — it does NOT synchronously return the computed billing breakdown.
- **D-03:** Seat count for overage purposes = `BrokerageMembership` rows with `role` in `%w[agent staff owner admin]` (excludes `client`) — reusing the exact `member_roles` definition already established in `backend/app/controllers/v1/account/admin_brokerages_controller.rb:41` for `member_count`. No new seat-counting logic invented; call the same definition (extract to a shared method if the planner judges duplication a concern, but the counting rule itself is locked).
- **D-04:** This phase computes billing using `base_price_cents`/`overage_price_cents` as defined in `AppConstants::PLAN_TIERS` — monthly-equivalent figures only. The `annual_discount_rate` field already exists in the config (set in Phase 36) but is NOT applied here: there is no `billing_interval` (annual vs monthly) field on `Brokerage` today, and PLAN-19's requirement wording only mentions base price + seat overage, not annual discounting. Adding billing-cycle tracking is explicitly deferred — see Deferred Ideas.

### Claude's Discretion

- Exact schema/model shape for D-01's persisted billing record (table name, exact columns beyond the four locked ones: plan, seat_count, total_cents, timestamp) — direction locked, shape is planner's call.
- Whether to extract seat-counting into a shared method (e.g. on `Brokerage`) to avoid duplicating `admin_brokerages_controller.rb`'s inline logic, or just call the same filter inline in the job — the counting *rule* (D-03) is locked, code organization is not.
- Whether the persisted billing record needs its own read/query endpoint this phase — not requested by PLAN-19's wording (which only asks for the recalculation to happen), so default to "persist only, no new endpoint" unless planning surfaces a concrete reason.

### Deferred Ideas (OUT OF SCOPE)

- **Billing-interval (annual vs monthly) tracking on `Brokerage`** — no such field exists today; PLAN-19 doesn't require it, and adding it now would be scope creep ahead of BILL-01 actually needing it. Revisit when the payment processor integration is scoped.
- **A read/query endpoint for the persisted billing records** — not requested by PLAN-19; the decision here is to persist for future use, not to expose it via API this phase. Revisit if support tooling or BILL-01 planning needs it.
- Payment processor integration, checkout flow, invoicing (BILL-01) — separate, larger scope, not touched by this phase.
- Board-selection UI, seat caps/enforcement that blocks a brokerage from exceeding its tier's seat count — no such cap exists on any paid tier; overage is priced, never blocked.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAN-19 | Switching between paid plans (Independent ↔ Growth) is a pure billing recalculation — new base price plus seat overage for seats beyond the new tier's included count. No data is purged, frozen, or disconnected. | Confirmed: `AppConstants::PLAN_TIERS` already provides `base_price_cents`/`seat_cap`/`overage_price_cents` per tier (see Standard Stack). Seat-counting rule confirmed at `admin_brokerages_controller.rb:41`. `ApplyPlanTransitionJob`'s paid→paid branch is the exact, already-scaffolded integration point (see Code Examples). No board/client/domain code paths are touched — confirmed by reading `downgrade!`/`restore!`, neither of which fires when both `old_plan` and `new_plan` are paid. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Soft deletes:** All user-facing models use `acts_as_paranoid`; queries must be scoped with `.without_deleted`. **This phase's new audit model is a deliberate exception** — see "Runtime State Inventory" / model-shape discussion below for why an append-only snapshot record should NOT use `acts_as_paranoid` (mirrors the existing `EstateDateCalendarEvent` precedent, and Phase 38's D-11 already established precedent for deliberately deviating from `acts_as_paranoid` when a record is disposable/log-like rather than user-facing).
- **Query objects:** Complex filtering belongs in `app/queries/`. Not applicable here — seat counting is a simple `count`/`where` on `BrokerageMembership`, not a query object candidate (no filtering complexity, no `current_user` authorization logic).
- **Multi-tenancy:** Use `Current.brokerage`/`Current.user` in controllers. Not applicable — this phase's logic lives entirely inside a background job, which receives `brokerage_id` as a plain argument (jobs do not have `Current.brokerage` set; the existing job already does `Brokerage.find(brokerage_id)` directly, not `Current.brokerage`).
- **No hardcoded plan/pricing values:** Per PLAN-TIERS.md's "Gating a new feature by plan" section, backend code must read pricing from the centralized `AppConstants::PLAN_TIERS` config, never hardcode a tier name or numeric figure inline. The new billing computation must call `brokerage.plan_config` / `AppConstants::PLAN_TIERS.fetch(new_plan)`, not inline `2000`/`7900`/etc.

## Standard Stack

### Core (all pre-existing — no new dependencies)
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|---------------|
| `ApplyPlanTransitionJob` | existing (Phase 38) | Async dispatch point for all plan-transition side effects | Already the single, tested integration point; adding a second job/dispatch path would violate D-02 and duplicate `Ops::PlanController`'s existing enqueue call |
| `AppConstants::PLAN_TIERS` / `Brokerage#plan_config` | existing (Phase 36) | Source of `base_price_cents`, `seat_cap`, `overage_price_cents` per tier | Centralized, frozen `Struct`-backed hash; already the sole source of truth for pricing figures, no new config needed |
| Rails 7.1 migrations (`ActiveRecord::Migration[7.1]`) | 7.1.4 [VERIFIED: Gemfile] | New table for the billing-snapshot model | Existing migrations in `db/migrate/` (e.g. `20260513203643_create_estate_date_calendar_events.rb`) follow plain `create_table` + `add_index` + `add_foreign_key`, no gems beyond stock ActiveRecord |
| Ruby 4.0.2 / Rails ~> 7.1.4 | [VERIFIED: Gemfile] | Runtime | Confirmed via `Gemfile` — `ruby "4.0.2"`, `gem "rails", "~> 7.1.4"` |

### Supporting
| Component | Purpose | When to Use |
|-----------|---------|-------------|
| `ActiveRecord::Base.transaction` | Wraps seat-count read + record-create | Matches `downgrade!`/`restore!`'s existing transactional discipline in the same job; only strictly required if there end up being 2+ writes (currently there's exactly one: creating the snapshot row) |
| FactoryBot (`test/factories/`) | Test fixtures for the new model | Every existing model in this codebase has a matching `test/factories/<table>.rb`; `ApplyPlanTransitionJobTest` already uses `create(:brokerage, plan: ...)` etc. — the new model needs its own factory following the same minimal pattern (e.g. `test/factories/brokerages.rb`'s one-line `factory :brokerage do ... end`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `PlanBillingSnapshot` model/table | Append a column to `Brokerage` (e.g. `last_billing_recalc_cents`) | Rejected by D-01's own wording ("queryable audit trail... at each paid-to-paid transition") — a single column can't hold history across multiple transitions, only the most recent one |
| Non-paranoid, timestamped model (this recommendation) | `acts_as_paranoid` model like the rest of the codebase | Soft-delete adds no value for an append-only audit log nobody ever "deletes" in the UI sense — mirrors `EstateDateCalendarEvent`'s precedent of opting out of `acts_as_paranoid` for log-like records |
| Inline seat-counting query in the job | Extract to `Brokerage#billable_seat_count` (or similar) | Both are valid per CONTEXT.md's Claude's Discretion; extracting avoids duplicating the `member_roles` array a third time (once in `admin_brokerages_controller.rb`, once wherever this phase adds it) — recommend extracting to a small shared method to avoid a second literal copy of `%w[agent staff owner admin]` |

**Installation:** No new gems. This is a plain migration + model + job-logic change.

**Version verification:**
```
$ grep -E "ruby |gem \"rails\"" Gemfile
ruby "4.0.2"
gem "rails", "~> 7.1.4"
```
Confirmed directly from the repo's own `Gemfile` — no registry lookup needed since no new package is introduced.

## Package Legitimacy Audit

Not applicable — this phase introduces zero new external packages (no `Gemfile` changes). The billing computation uses only existing ActiveRecord/Ruby stdlib; the new model uses stock Rails migration DSL. Skipping the Package Legitimacy Gate protocol entirely per its own scope ("whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
POST /ops/brokerages/:id/plan  {plan: "growth"}   (Ops::PlanController — UNCHANGED this phase)
        │
        ▼
  brokerage.update!(plan: new_plan)
        │
        ▼
  ApplyPlanTransitionJob.perform_later(brokerage_id, old_plan, new_plan)   (async — UNCHANGED)
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ ApplyPlanTransitionJob#perform                                │
│                                                                 │
│  if !paid?(old) && paid?(new)   → upgrade cascade (Phase 38)  │
│  elsif paid?(old) && !paid?(new) → downgrade cascade (Ph. 38)  │
│  else (paid → paid, e.g. independent ↔ growth)                │
│        ▼  ◄─── THIS PHASE'S NEW LOGIC LANDS HERE               │
│     seat_count = brokerage.brokerage_memberships                │
│                    .without_deleted                             │
│                    .where(role: member_roles).count              │
│        │                                                        │
│        ▼                                                        │
│     tier = AppConstants::PLAN_TIERS.fetch(new_plan)              │
│     overage = [seat_count - tier.seat_cap, 0].max                │
│     total_cents = tier.base_price_cents +                        │
│                    overage * tier.overage_price_cents            │
│        │                                                        │
│        ▼                                                        │
│     PlanBillingSnapshot.create!(                                 │
│        brokerage:, plan: new_plan, seat_count:,                  │
│        total_cents:, computed_at: Time.current)                  │
│                                                                   │
│     (no purge / freeze / suspend / restore fires — boards,       │
│      clients, and domain are untouched)                          │
└─────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
backend/
├── db/migrate/
│   └── 20260722XXXXXX_create_plan_billing_snapshots.rb   # new
├── app/models/
│   └── plan_billing_snapshot.rb                          # new — belongs_to :brokerage, no acts_as_paranoid
├── app/jobs/
│   └── apply_plan_transition_job.rb                       # modified — paid→paid branch filled in
└── test/
    ├── factories/
    │   └── plan_billing_snapshots.rb                      # new
    └── jobs/
        └── apply_plan_transition_job_test.rb              # extended, not duplicated (see Pitfall 3)
```

### Pattern 1: Config-driven computation, not hand-derived formula
**What:** Read `base_price_cents`/`seat_cap`/`overage_price_cents` directly from `AppConstants::PLAN_TIERS.fetch(new_plan)` (or `Brokerage#plan_config` if computing off `brokerage.reload.plan_config` after the flip). Do NOT re-derive `overage_price_cents` as `base_price_cents / seat_cap` at runtime — the config already stores the deliberately-set value (Growth's overage is 1600, not the exact 1580 that `7900/5` would produce).
**When to use:** Always, for this phase's billing math.
**Example:**
```ruby
# Source: backend/app/constants/plan_tiers.rb (existing, Phase 36)
tier = AppConstants::PLAN_TIERS.fetch(new_plan)
overage_seats = [seat_count - (tier.seat_cap || 0), 0].max
total_cents = tier.base_price_cents + (overage_seats * tier.overage_price_cents)
```

### Pattern 2: Shared seat-counting definition (avoid a second inline copy)
**What:** `member_roles = %w[agent staff owner admin]` is already defined inline in `admin_brokerages_controller.rb:41`. D-03 locks the *rule*, not the code location. Recommend a small extraction to avoid two literal copies of the same array drifting apart.
**When to use:** This phase, when adding seat-count logic to the job.
**Example:**
```ruby
# Source: backend/app/models/brokerage.rb (existing) + admin_brokerages_controller.rb:41 (existing rule)
# Recommended addition to Brokerage model:
def billable_seat_count
  brokerage_memberships.without_deleted.where(role: %w[agent staff owner admin]).count
end
```
Then both `admin_brokerages_controller.rb` (optionally, if the planner chooses to also refactor that call site — not required by CONTEXT.md) and the new job logic call `brokerage.billable_seat_count`.

### Pattern 3: Non-paranoid, append-only audit model
**What:** Model with plain `t.timestamps`, no `deleted_at`, no `acts_as_paranoid` — matches `EstateDateCalendarEvent`'s existing precedent in this codebase for a system-generated log row that users never edit or delete.
**When to use:** The new `PlanBillingSnapshot` (or equivalent) model.
**Example:**
```ruby
# Source: backend/app/models/estate_date_calendar_event.rb (existing precedent, adapted)
class PlanBillingSnapshot < ApplicationRecord
  belongs_to :brokerage

  validates :plan, inclusion: {in: %w[independent growth]}  # only paid tiers ever produce a snapshot
  validates :seat_count, numericality: {greater_than_or_equal_to: 0}
  validates :total_cents, numericality: {greater_than_or_equal_to: 0}
end
```
```ruby
# Source: backend/db/migrate/20260513203643_create_estate_date_calendar_events.rb (existing precedent, adapted)
class CreatePlanBillingSnapshots < ActiveRecord::Migration[7.1]
  def change
    create_table :plan_billing_snapshots do |t|
      t.bigint   :brokerage_id, null: false
      t.string   :plan, null: false
      t.integer  :seat_count, null: false
      t.integer  :total_cents, null: false
      t.datetime :computed_at, null: false
      t.timestamps
    end

    add_index :plan_billing_snapshots, :brokerage_id
    add_index :plan_billing_snapshots, [:brokerage_id, :computed_at]
    add_foreign_key :plan_billing_snapshots, :brokerages
  end
end
```
Note: `computed_at` is redundant with `created_at` in almost all cases (the record is created synchronously with the computation) — the planner may choose to drop `computed_at` and rely on `created_at` alone, since D-01 only locks "timestamp" as a concept, not a specific column name. Keeping both is harmless but arguably unnecessary; flagging as a planner judgment call, not a locked requirement.

### Anti-Patterns to Avoid
- **Adding a second job or a new Ops controller action:** D-02 explicitly locks this into the existing job's existing branch. A new dispatch path duplicates `Ops::PlanController`'s enqueue call and creates two sources of truth for "what happens on a plan transition."
- **Hardcoding tier prices inline in the job:** Violates PLAN-TIERS.md's own "Gating a new feature by plan" rule and CLAUDE.md's spirit of centralized config — always call through `AppConstants::PLAN_TIERS`/`plan_config`.
- **Applying `acts_as_paranoid` to the new snapshot model:** Would be inconsistent with the append-only, disposable-log nature of the record and adds unnecessary `.without_deleted` scoping burden everywhere it's queried, for no benefit (nobody "deletes" a billing snapshot in the UI sense — there's no UI at all this phase, per D-01's discretion note).
- **Re-deriving overage price from `base_price_cents / seat_cap` at runtime:** Growth's actual config value (1600) is not the exact quotient (1580) — always read `overage_price_cents` directly from config, never recompute it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Seat counting | A new query object or a fresh role-filter array | `%w[agent staff owner admin]` — call it via a new `Brokerage#billable_seat_count` method (or inline, mirroring `admin_brokerages_controller.rb:41` verbatim) | D-03 locks the exact rule already in production; inventing a second definition risks silent drift between the two call sites |
| Tier pricing figures | Inline cents literals in the job | `AppConstants::PLAN_TIERS.fetch(new_plan)` / `brokerage.plan_config` | Already centralized in Phase 36; PLAN-TIERS.md explicitly forbids hardcoding tier numbers in controllers/jobs |
| Money/cents arithmetic | A `Money`/`money-rails` gem | Plain Integer cents arithmetic (`base_price_cents + overage * overage_price_cents`) | No `money`/`money-rails` gem exists in this `Gemfile` [VERIFIED: `grep -i money Gemfile` returned no results] — the entire existing codebase (schema, config, other jobs) already represents money as plain integer `_cents` columns; introducing a currency-value-object gem for one phase would be inconsistent with every other price field in the app |

**Key insight:** Every piece this phase needs already exists in the codebase in a directly-reusable, tested form (config, seat filter, transaction pattern, non-paranoid model precedent). The only "build" work is: one migration, one model, ~10 lines inside an existing job method, and one FactoryBot factory.

## Common Pitfalls

### Pitfall 1: Recomputing seat count against the OLD plan instead of the new one
**What goes wrong:** PLAN-19 says "seats beyond the *new* tier's included count" — using `old_plan`'s `seat_cap` (or, worse, the wrong tier's `overage_price_cents`) silently produces a bill for the tier the brokerage is leaving, not the one it's entering.
**Why it happens:** The job receives both `old_plan` and `new_plan` as arguments; it's easy to grab the wrong one when writing `AppConstants::PLAN_TIERS.fetch(...)`.
**How to avoid:** Always fetch the tier config keyed by `new_plan`, never `old_plan`, for both `seat_cap` and `overage_price_cents`. Write a test asserting Growth(5 seats)→Independent(1 seat) with 3 active members bills `2000 + 2*2000 = 6000` cents, not some figure derived from Growth's 5-seat cap.
**Warning signs:** A billing snapshot for a downgrade-in-tier (Growth→Independent) that doesn't show increased overage despite Independent's lower `seat_cap`.

### Pitfall 2: Counting client memberships as billable seats
**What goes wrong:** `BrokerageMembership` includes `role: "client"` rows (confirmed in Phase 38's D-10 schema correction). If the seat-count query doesn't filter to `member_roles`, client rows inflate the bill.
**Why it happens:** A naive `brokerage.brokerage_memberships.without_deleted.count` (no role filter) looks correct at a glance since it reuses the association, but omits the role scoping that `admin_brokerages_controller.rb:41` applies.
**How to avoid:** Always filter `.where(role: %w[agent staff owner admin])` (or the extracted `billable_seat_count` method) — never a bare `.count` on the association.
**Warning signs:** Seat count in a snapshot record higher than the brokerage's actual paid-seat headcount whenever the brokerage has client memberships.

### Pitfall 3: Duplicating rather than extending the existing job test file
**What goes wrong:** `test/jobs/apply_plan_transition_job_test.rb` already contains a test named `"paid -> paid (independent -> growth) performs no freeze, suspend, or purge"` that currently only asserts the ABSENCE of purge/freeze/suspend side effects. If the planner adds a brand-new test file for billing instead of extending this existing test, coverage of "billing recalculation now also runs in this exact branch, alongside confirming nothing else fires" gets split across two files with overlapping setup, and it's easy to miss that the existing negative-assertions test needs a companion positive assertion (`assert_equal expected_total_cents, PlanBillingSnapshot.last.total_cents`) added to the SAME test.
**Why it happens:** Existing test already covers this exact `perform_now(@brokerage.id, "independent", "growth")` call; a fresh contributor might not notice it and add a parallel/duplicate setup elsewhere.
**How to avoid:** Extend the existing test (add snapshot-creation assertions to it) and add 1-2 new focused tests for the overage-math edge cases (e.g. seat count under the cap → overage is zero; seat count exactly at the cap → overage is zero, not negative).
**Warning signs:** Two test blocks both calling `ApplyPlanTransitionJob.perform_now(@brokerage.id, "independent", "growth")` with near-identical setup in the same file.

### Pitfall 4: Negative overage from seat_count < seat_cap
**What goes wrong:** `overage_seats = seat_count - tier.seat_cap` without a floor at 0 produces a negative number (e.g. 1 seat, Growth's 5-seat cap → `-4`), and `-4 * 1600 = -6400` — a negative overage that silently *reduces* `total_cents` below `base_price_cents`, which is nonsensical (no such "seat discount" exists in the pricing design).
**Why it happens:** Straightforward subtraction without clamping — easy to miss since most manual testing during dev will use brokerages already near or above the cap.
**How to avoid:** Always clamp with `[seat_count - tier.seat_cap, 0].max` (or `.clamp(0, ...)`), and add a test with a low seat count against Growth's 5-seat cap to catch a regression.
**Warning signs:** `total_cents` in a snapshot lower than `base_price_cents` for the new plan.

### Pitfall 5: Free tier's `seat_cap: nil` causing a `NoMethodError` if the branch logic is ever reused generically
**What goes wrong:** `AppConstants::PLAN_TIERS["free"].seat_cap` is `nil` (unlimited). If seat-overage logic is ever accidentally invoked for a transition involving `free` (it should never be — this branch only fires when both `old_plan` and `new_plan` are paid per `paid?`), `seat_count - nil` raises `NoMethodError: undefined method '-' for nil`.
**Why it happens:** The `paid?(old_plan) && paid?(new_plan)`-style guard is implicit in this branch (it's the `else` after the two explicit `if`/`elsif` branches for upgrade/downgrade) — a future refactor that changes the branch structure could accidentally let a `free`-involved transition fall through here.
**How to avoid:** Either keep the branch structure exactly as-is (the existing `if !paid?(old) && paid?(new) ... elsif paid?(old) && !paid?(new) ... else` already guarantees both are paid in the `else`), or add a defensive `seat_cap = tier.seat_cap || 0` if extra safety is wanted. Not currently a live bug — flagging as a guard against future refactors.
**Warning signs:** N/A today (current branch structure is safe) — this is a forward-looking note for the planner's task-writing, not a current defect.

## Code Examples

### Filling in the paid→paid branch
```ruby
# Source: backend/app/jobs/apply_plan_transition_job.rb (existing file, comment currently at lines 25-26)
# Adapted — illustrative, not a full diff:
def perform(brokerage_id, old_plan, new_plan)
  brokerage = Brokerage.find(brokerage_id)

  if !paid?(old_plan) && paid?(new_plan)
    TestBoardPurgeService.call!(brokerage: brokerage)
    if brokerage.plan_downgraded_at.present?
      restore!(brokerage)
      brokerage.update!(plan_downgraded_at: nil)
    end
  elsif paid?(old_plan) && !paid?(new_plan)
    downgrade!(brokerage)
  else
    recalculate_billing!(brokerage, new_plan)
  end
end

private

def recalculate_billing!(brokerage, new_plan)
  tier = AppConstants::PLAN_TIERS.fetch(new_plan)
  seat_count = brokerage.billable_seat_count
  overage_seats = [seat_count - (tier.seat_cap || 0), 0].max
  total_cents = tier.base_price_cents + (overage_seats * tier.overage_price_cents)

  PlanBillingSnapshot.create!(
    brokerage: brokerage,
    plan: new_plan,
    seat_count: seat_count,
    total_cents: total_cents
  )
end
```

### Existing seat-counting rule to reuse (D-03)
```ruby
# Source: backend/app/controllers/v1/account/admin_brokerages_controller.rb:41 (existing, unmodified this phase)
member_roles = %w[agent staff owner admin]
member_count: group.count { |r| member_roles.include?(r.role) }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Binary `basic`/`premium` plan enum with no pricing config | Three-tier `free`/`independent`/`growth` enum + `AppConstants::PLAN_TIERS` centralized config | Phase 36 (2026-07-14, migration `20260714000000`) | This phase's entire computation is possible only because Phase 36 already centralized pricing figures — no config work needed here |
| No plan-transition side-effect mechanism at all | `Ops::PlanController` + `ApplyPlanTransitionJob` async cascade | Phase 38 (2026-07-21) | This phase's only "new" code is filling in an already-scaffolded empty branch |

**Deprecated/outdated:** None relevant — this is the newest layer of an actively-developing feature set (Phases 36-39 of the same milestone), not a legacy system being replaced.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Model name `PlanBillingSnapshot` and column names (`plan`, `seat_count`, `total_cents`) are illustrative suggestions, not locked | Architecture Patterns, Code Examples | Low — CONTEXT.md explicitly delegates exact naming to the planner ("Planner determines the exact table/model shape") |
| A2 | Dropping the redundant `computed_at` column in favor of relying on `created_at` is a reasonable simplification | Pattern 3 | Low — cosmetic; either choice satisfies D-01's "timestamp" requirement |
| A3 | Extracting seat-counting to `Brokerage#billable_seat_count` is preferable to inlining a second copy of `%w[agent staff owner admin]` | Pattern 2, Don't Hand-Roll | Low — CONTEXT.md explicitly leaves this as Claude's Discretion either way; inlining would also satisfy D-03 |

**If this table is empty:** N/A — three low-risk naming/structuring assumptions logged above; none affect correctness of the billing computation itself, which is fully specified by locked decisions and verified config values.

## Open Questions

1. **Should the new model's factory/tests live under `test/factories/plan_billing_snapshots.rb` and `test/models/plan_billing_snapshot_test.rb`, or is a job-level test alone sufficient?**
   - What we know: Every other model in the codebase has a matching factory file; `ApplyPlanTransitionJobTest` is the primary place asserting job-branch behavior.
   - What's unclear: Whether CONTEXT.md's "persist only, no new endpoint" default extends to also meaning "no dedicated model-level test, job coverage is enough" — not addressed in CONTEXT.md.
   - Recommendation: Add a minimal factory (required for job tests to build associated records cleanly) and at least a couple of job-level assertions (per Pitfall 3); a full standalone model test is optional given the model has no custom logic beyond validations.

2. **Exact migration timestamp/filename for the new table.**
   - What we know: Existing migrations use sequential sortable timestamps (e.g. `20260721000001_add_plan_transition_suspend_columns.rb` for Phase 38).
   - What's unclear: The planner will need to pick a timestamp after `20260721000001` (Phase 38's most recent) — should be straightforward, just flagging so the plan doesn't collide with an existing filename.
   - Recommendation: Use a timestamp like `20260722000001` or later; verify no collision with `ls db/migrate/` before finalizing.

## Environment Availability

Skipped — this phase has no external dependencies beyond the existing Rails/PostgreSQL stack already running in this repo (no new gems, no new services, no new API integrations).

## Validation Architecture

Skipped — `.planning/config.json` has `workflow.nyquist_validation: false` explicitly set.

## Security Domain

No `security_enforcement` key found in `.planning/config.json` (absent = enabled by default per instructions), but this phase has no auth/authz/input-validation surface of its own:
- No new user-facing endpoint (D-01's discretion note: "persist only, no new endpoint").
- No new input parsing beyond `brokerage_id`/`old_plan`/`new_plan`, both of which are already validated by `Ops::PlanController`'s existing `AppConstants::PLAN_TIERS.key?(new_plan)` check before the job is ever enqueued.
- No cryptography, no session/auth changes, no new access-control surface.

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | No | Job runs internally; no new endpoint |
| V3 Session Management | No | N/A |
| V4 Access Control | No | `Ops::PlanController`'s existing auth/authorization (unchanged) already gates who can trigger a transition |
| V5 Input Validation | Indirect | `new_plan` is already validated as a known key in `AppConstants::PLAN_TIERS` before the job is enqueued (existing `Ops::PlanController` code, unmodified) |
| V6 Cryptography | No | No secrets/PII touched — the snapshot stores only plan name, seat count, and a cents integer |

### Known Threat Patterns for this stack
None specific to this phase — no injection surface (all values are either integers from a trusted config or a `brokerage_id` already resolved via `Brokerage.find` inside the job), no new external input parsing.

## Sources

### Primary (HIGH confidence — direct file reads from this repo)
- `backend/app/jobs/apply_plan_transition_job.rb` — exact current branch structure, `paid?` helper, transaction pattern
- `backend/app/constants/plan_tiers.rb` — exact `PlanTier` struct fields and frozen config values
- `backend/app/models/brokerage.rb` — `plan_config` accessor, existing model conventions
- `backend/app/controllers/ops/plan_controller.rb` — dispatch/enqueue signature, unchanged this phase
- `backend/app/controllers/v1/account/admin_brokerages_controller.rb` — exact `member_roles` seat-counting definition (line 41)
- `backend/app/models/brokerage_membership.rb`, `backend/db/schema.rb` — confirmed `role` column includes `"client"`, `suspended_at` column exists
- `backend/app/models/estate_date_calendar_event.rb` + `backend/db/migrate/20260513203643_create_estate_date_calendar_events.rb` — non-paranoid, timestamped model precedent
- `backend/test/jobs/apply_plan_transition_job_test.rb` — existing test coverage, including the paid→paid negative-assertion test to extend
- `backend/Gemfile` — Ruby 4.0.2, Rails ~> 7.1.4, no `money`/`money-rails` gem present
- `.planning/PLAN-TIERS.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — requirement wording, design rationale, milestone status
- `.planning/phases/36-.../36-CONTEXT.md`, `.planning/phases/38-.../38-CONTEXT.md` — locked upstream decisions this phase builds on
- `.planning/phases/39-.../39-CONTEXT.md` — this phase's own locked decisions (D-01 through D-04)

### Secondary (MEDIUM confidence)
None — all findings in this research were verified by direct repository inspection; no WebSearch or Context7 lookups were needed since this is a pure Rails-conventions extension of existing, already-read code with no new external library involved.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all figures/patterns read directly from the repo
- Architecture: HIGH — the exact integration point (`ApplyPlanTransitionJob`'s paid→paid branch) is visible in the current source with an explicit comment marking it as this phase's landing spot
- Pitfalls: HIGH — derived directly from reading the config's actual values (e.g. Growth's 1600 vs. naive 1580), the existing test file's exact assertions, and the schema's actual `role` values

**Research date:** 2026-07-22
**Valid until:** Effectively indefinite for this phase's scope (internal codebase conventions, not a fast-moving external dependency) — re-verify only if Phase 36/38's config or job shape changes before Phase 39 executes.
