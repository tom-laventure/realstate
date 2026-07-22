# Phase 39: Paid-to-Paid Plan Changes - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 6 (1 migration, 1 model, 1 job [modified], 1 model [modified], 1 factory, 1 test [modified])
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/db/migrate/20260722000001_create_plan_billing_snapshots.rb` | migration | batch (schema DDL) | `backend/db/migrate/20260513203643_create_estate_date_calendar_events.rb` | exact |
| `backend/app/models/plan_billing_snapshot.rb` | model | CRUD (create-only, append-only) | `backend/app/models/estate_date_calendar_event.rb` | exact |
| `backend/app/jobs/apply_plan_transition_job.rb` (modified) | service (background job) | event-driven | itself — existing `downgrade!`/`restore!` methods in the same file | exact (same file, extend existing convention) |
| `backend/app/models/brokerage.rb` (modified — optional `billable_seat_count`) | model | CRUD (read/aggregate) | `backend/app/controllers/v1/account/admin_brokerages_controller.rb:41` (inline rule to extract) + `backend/app/models/brokerage.rb:34-36` (`plan_config` accessor, as the style template for a small computed-accessor method) | role-match |
| `backend/test/factories/plan_billing_snapshots.rb` | test (factory) | CRUD | `backend/test/factories/brokerages.rb` | exact |
| `backend/test/jobs/apply_plan_transition_job_test.rb` (modified — extend, don't duplicate) | test | event-driven | itself — existing `"paid -> paid (independent -> growth) performs no freeze, suspend, or purge"` test (lines 87-96) | exact (same file, extend existing test) |

## Pattern Assignments

### `backend/db/migrate/20260722000001_create_plan_billing_snapshots.rb` (migration, batch)

**Analog:** `backend/db/migrate/20260513203643_create_estate_date_calendar_events.rb`

**Full analog** (lines 1-25) — the exact shape to copy: plain `create_table`, no `deleted_at`, plain `t.timestamps`, indexes, `add_foreign_key`:
```ruby
class CreateEstateDateCalendarEvents < ActiveRecord::Migration[7.1]
  def change
    create_table :estate_date_calendar_events do |t|
      t.integer  :estate_date_id, null: false
      t.bigint   :user_id, null: false
      t.string   :provider, null: false
      t.text     :external_event_id
      t.string   :status, null: false, default: "pending"
      t.string   :last_error
      t.datetime :last_synced_at
      t.timestamps
    end

    add_index :estate_date_calendar_events,
      [:estate_date_id, :user_id, :provider],
      unique: true,
      name: "idx_edce_unique"

    add_index :estate_date_calendar_events, :estate_date_id
    add_index :estate_date_calendar_events, [:user_id, :provider]
    add_index :estate_date_calendar_events, :status

    add_foreign_key :estate_date_calendar_events, :users
  end
end
```

**What to adapt for `plan_billing_snapshots`:**
- `belongs_to :brokerage` → `t.bigint :brokerage_id, null: false` + `add_foreign_key :plan_billing_snapshots, :brokerages`
- No unique index needed (multiple snapshots per brokerage over time is the whole point — append-only history)
- Add `add_index :plan_billing_snapshots, :brokerage_id` for lookup, and optionally `add_index :plan_billing_snapshots, [:brokerage_id, :created_at]` if querying by recency matters later
- **No `deleted_at` column, no `acts_as_paranoid` migration line** — this is the one deliberate deviation from the rest of the schema (see Shared Patterns > Soft Deletes below)
- Filename timestamp: must sort after `20260721000001` (Phase 38's most recent) — verify no collision with `ls db/migrate/` before finalizing (last existing migration is `20260721000001_add_plan_transition_suspend_columns.rb`)

---

### `backend/app/models/plan_billing_snapshot.rb` (model, CRUD)

**Analog:** `backend/app/models/estate_date_calendar_event.rb`

**Full analog** (lines 1-11) — the exact shape to copy: no `acts_as_paranoid`, `belongs_to`, string-enum-style validations:
```ruby
class EstateDateCalendarEvent < ApplicationRecord
  belongs_to :estate_date
  belongs_to :user

  PROVIDERS = %w[google microsoft apple].freeze

  STATUSES = %w[pending synced error].freeze

  validates :provider, inclusion: {in: PROVIDERS}
  validates :status, inclusion: {in: STATUSES}
end
```

**Adapted target shape:**
```ruby
class PlanBillingSnapshot < ApplicationRecord
  belongs_to :brokerage

  validates :plan, inclusion: {in: %w[independent growth]}
  validates :seat_count, numericality: {greater_than_or_equal_to: 0}
  validates :total_cents, numericality: {greater_than_or_equal_to: 0}
end
```
Note: unlike `EstateDateCalendarEvent`'s `PROVIDERS`/`STATUSES` frozen constants, this model's `plan` inclusion list (`%w[independent growth]`) should NOT redeclare `AppConstants::PLAN_TIERS.keys` — inline the two paid tiers directly (or reference `AppConstants::PLAN_TIERS.keys - ["free"]` if avoiding drift is preferred), since `free` never produces a snapshot per D-02/Pitfall 5.

**Contrast — what NOT to copy** (the dominant, paranoid model pattern in this codebase), from `backend/app/models/brokerage.rb:1-2`:
```ruby
class Brokerage < ApplicationRecord
  acts_as_paranoid
```
`PlanBillingSnapshot` deliberately omits this line — it is an append-only audit log, not a user-facing, soft-deletable record.

---

### `backend/app/jobs/apply_plan_transition_job.rb` (modified) (service/job, event-driven)

**Analog:** itself — the existing `downgrade!` and `restore!` private methods in the same file (lines 41-87), which establish the transaction/private-method convention this phase's new branch must follow.

**Current full file for context** (lines 1-88, already read in full):
```ruby
class ApplyPlanTransitionJob < ApplicationJob
  queue_as :default
  retry_on StandardError, wait: :polynomially_longer, attempts: 3
  discard_on ActiveRecord::RecordNotFound

  def perform(brokerage_id, old_plan, new_plan)
    brokerage = Brokerage.find(brokerage_id)

    if !paid?(old_plan) && paid?(new_plan)
      # Free -> paid upgrade (PLAN-14, PLAN-18)
      TestBoardPurgeService.call!(brokerage: brokerage)

      if brokerage.plan_downgraded_at.present?
        restore!(brokerage)
        brokerage.update!(plan_downgraded_at: nil)
      end
    elsif paid?(old_plan) && !paid?(new_plan)
      # Paid -> Free downgrade (PLAN-15, PLAN-16, PLAN-17)
      downgrade!(brokerage)
    end
    # paid -> paid (or free -> free): Phase 39 owns paid<->paid billing
    # recalculation; no purge/freeze/suspend/restore cascade fires here.
  end

  private

  def paid?(plan)
    plan != "free"
  end
```
This is the exact comment (line 25-26) marking where the new `else` branch / `recalculate_billing!` call lands.

**Transaction discipline to mirror** (lines 41-57, `downgrade!`):
```ruby
def downgrade!(brokerage)
  stamp = Time.current

  ApplicationRecord.transaction do
    brokerage.freeze_custom_domains!

    brokerage.brokerage_board_credentials.without_deleted
      .credential_active
      .joins(:real_estate_board).merge(RealEstateBoard.real_boards)
      .update_all(status: "suspended", suspended_at: stamp)

    brokerage.brokerage_memberships.without_deleted
      .where(role: "client", suspended_at: nil)
      .update_all(suspended_at: stamp)

    brokerage.update!(plan_downgraded_at: stamp)
  end

  # Dispatched AFTER the transaction above commits — never inside it.
  DomainMailer.downgrade_notice(brokerage).deliver_later
end
```
Use `ApplicationRecord.transaction do ... end` (not `ActiveRecord::Base.transaction`, matching this file's exact convention) if wrapping the seat-count read + snapshot create in a transaction.

**`paid?` helper to reuse unchanged** (lines 33-35):
```ruby
def paid?(plan)
  plan != "free"
end
```

**Target new branch** (replace the comment at lines 25-26 with an `else`, add private method):
```ruby
else
  recalculate_billing!(brokerage, new_plan)
end
# ... (private methods, alongside downgrade!/restore!)

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

**Pitfalls specific to this branch** (from RESEARCH.md, verified against actual config in `backend/app/constants/plan_tiers.rb`):
- Always key `AppConstants::PLAN_TIERS.fetch(...)` by `new_plan`, never `old_plan` (Growth's `overage_price_cents` is 1600, Independent's is 2000 — using the wrong tier silently mis-bills)
- Always clamp `overage_seats` at `[seat_count - tier.seat_cap, 0].max` — no floor produces a negative "seat discount" that undercuts `base_price_cents`
- Seat count must use the role-filtered method (see `brokerage.rb` section below), never a bare `.count` on `brokerage_memberships` (would include `client` rows)

---

### `backend/app/models/brokerage.rb` (modified — optional `billable_seat_count` extraction)

**Analog for the rule to reuse:** `backend/app/controllers/v1/account/admin_brokerages_controller.rb:41`
```ruby
member_roles = %w[agent staff owner admin]
# ...
member_count: group.count { |r| member_roles.include?(r.role) }
```
This is an in-memory `Array#count` over already-loaded `BrokerageMembership` records grouped by brokerage (bulk-loaded for a collection endpoint) — NOT a DB-level `.where(...).count`. For the job's single-brokerage case, translate to a scoped DB query instead (see below).

**Analog for style/placement of a small computed accessor:** `backend/app/models/brokerage.rb:34-36` (`plan_config`)
```ruby
def plan_config
  AppConstants::PLAN_TIERS.fetch(plan)
end
```

**Recommended addition** (same style, placed near `plan_config`):
```ruby
def billable_seat_count
  brokerage_memberships.without_deleted.where(role: %w[agent staff owner admin]).count
end
```
This mirrors the `member_roles` array verbatim (D-03 locks the rule, not the code location) but as a DB-level `.where(...).count` scoped to one brokerage, appropriate for the job's single-record context — distinct from `admin_brokerages_controller.rb`'s in-memory group-count over a bulk-loaded collection.

**`without_deleted` scoping requirement** (per CLAUDE.md): `brokerage_memberships` must be scoped `.without_deleted` — confirmed pattern used identically in `downgrade!`/`restore!` in the job file (`brokerage.brokerage_memberships.without_deleted...`).

---

### `backend/test/factories/plan_billing_snapshots.rb` (test/factory, CRUD)

**Analog:** `backend/test/factories/brokerages.rb` (full file, 5 lines):
```ruby
FactoryBot.define do
  factory :brokerage do
    sequence(:name) { |n| "Brokerage #{n}" }
  end
end
```

**Adapted target:**
```ruby
FactoryBot.define do
  factory :plan_billing_snapshot do
    brokerage
    plan { "growth" }
    seat_count { 1 }
    total_cents { 7900 }
  end
end
```
Note: no `estate_date_calendar_events` factory exists in the codebase yet (its role-based factory pattern in `brokerage_memberships.rb` with traits is the richer example if trait-based variants are ever needed — e.g. `trait :independent` / `trait :growth` — but a flat minimal factory matching `brokerages.rb`'s simplicity is sufficient here since the model has no polymorphic-like branching).

---

### `backend/test/jobs/apply_plan_transition_job_test.rb` (modified — extend, don't duplicate)

**Analog:** the file's own existing test (lines 87-96), which must be extended in place, not copied into a new file (per RESEARCH.md Pitfall 3):
```ruby
test "paid -> paid (independent -> growth) performs no freeze, suspend, or purge" do
  @brokerage.update!(plan: "independent")

  ApplyPlanTransitionJob.perform_now(@brokerage.id, "independent", "growth")

  assert @active_credential.reload.credential_active?
  assert_nil @client_membership.reload.suspended_at
  assert @custom.reload.status_active?
  assert_nil @brokerage.reload.plan_downgraded_at
end
```

**Setup block to build on** (lines 4-24) — already creates `@brokerage` (starts as `plan: "growth"`), `@owner_membership` (role: owner), `@client_membership` (role: client) — the owner counts toward `billable_seat_count`, the client does not:
```ruby
setup do
  @brokerage = create(:brokerage, plan: "growth")
  # ...
  @client_user = create(:user)
  @client_membership = create(:brokerage_membership, :client, user: @client_user, brokerage: @brokerage)

  @owner_user = create(:user)
  @owner_membership = create(:brokerage_membership, :owner, user: @owner_user, brokerage: @brokerage)
end
```

**Required additions to the existing test** — add positive assertions for the snapshot alongside the existing negative assertions:
```ruby
assert_equal 1, PlanBillingSnapshot.count
snapshot = PlanBillingSnapshot.last
assert_equal "growth", snapshot.plan
assert_equal 1, snapshot.seat_count # only @owner_membership counts; @client_membership is excluded
assert_equal 7900, snapshot.total_cents # Growth base_price_cents, 1 seat <= 5-seat cap => zero overage
```

**New focused tests to add** (per Pitfall 3/4, edge cases the existing test doesn't cover):
- Overage math: seat count above `new_plan`'s `seat_cap` (e.g. Growth→Independent with 3 non-client members: `2000 + 2*2000 = 6000` cents)
- Seat count exactly at cap → overage is zero, not negative
- `new_plan` config keyed correctly (not `old_plan`) — assert against `new_plan`'s `overage_price_cents`, not `old_plan`'s

---

## Shared Patterns

### Non-paranoid, append-only model (soft-delete deviation)
**Source:** `backend/app/models/estate_date_calendar_event.rb` (whole file) + `backend/db/migrate/20260513203643_create_estate_date_calendar_events.rb` (whole file)
**Apply to:** `PlanBillingSnapshot` model + its migration only
**Why this deviates from CLAUDE.md's default:** CLAUDE.md mandates `acts_as_paranoid` + `.without_deleted` scoping for "all user-facing models." `PlanBillingSnapshot` is a system-generated, disposable audit row with no UI and no user-initiated delete — `EstateDateCalendarEvent` already establishes this exact precedent (no `deleted_at`, plain `t.timestamps`) for sync-log-style records in this codebase.

### Config-driven pricing (never hardcode)
**Source:** `backend/app/constants/plan_tiers.rb` (whole file) + `backend/app/models/brokerage.rb:34-36` (`plan_config` accessor)
**Apply to:** `apply_plan_transition_job.rb`'s new `recalculate_billing!` method
```ruby
tier = AppConstants::PLAN_TIERS.fetch(new_plan)
# tier.seat_cap, tier.base_price_cents, tier.overage_price_cents
```
Never inline numeric literals (2000, 7900, 1600, etc.) in the job — always fetch through this struct.

### Seat-counting rule (member_roles filter)
**Source:** `backend/app/controllers/v1/account/admin_brokerages_controller.rb:41` (`member_roles = %w[agent staff owner admin]`)
**Apply to:** New `Brokerage#billable_seat_count` method (or inline equivalent in the job) — the exact role list must match, character-for-character, to avoid the two call sites drifting apart.

### Transaction discipline for job-internal writes
**Source:** `backend/app/jobs/apply_plan_transition_job.rb:44` and `:76` — `ApplicationRecord.transaction do ... end` (note: `ApplicationRecord`, not `ActiveRecord::Base`, is this file's exact convention)
**Apply to:** `recalculate_billing!` if the planner decides the seat-count read + snapshot create should be transactional (currently only one write — the `create!` — so a transaction is optional per RESEARCH.md, but if the planner adds it, match this file's `ApplicationRecord.transaction` spelling, not `ActiveRecord::Base.transaction`).

### `without_deleted` scoping on every touched model
**Source:** CLAUDE.md + `backend/app/jobs/apply_plan_transition_job.rb:47,52,79,83` (every `brokerage_board_credentials`/`brokerage_memberships` query in this file is already `.without_deleted`-scoped)
**Apply to:** The new `billable_seat_count` query on `brokerage_memberships` — must be `.without_deleted.where(role: ...)`, matching the exact scoping style already used four times in this same file.

## No Analog Found

None — every file in this phase has a strong (exact or role-match) analog already present in the codebase; no file requires falling back to RESEARCH.md's illustrative code alone.

## Metadata

**Analog search scope:** `backend/app/jobs/`, `backend/app/models/`, `backend/app/controllers/v1/account/`, `backend/app/controllers/ops/`, `backend/app/constants/`, `backend/db/migrate/`, `backend/test/factories/`, `backend/test/jobs/`
**Files scanned:** `apply_plan_transition_job.rb`, `admin_brokerages_controller.rb`, `estate_date_calendar_event.rb`, `20260513203643_create_estate_date_calendar_events.rb`, `brokerage.rb`, `plan_tiers.rb`, `plan_controller.rb`, `apply_plan_transition_job_test.rb`, `brokerages.rb` (factory), `brokerage_memberships.rb` (factory)
**Pattern extraction date:** 2026-07-22
