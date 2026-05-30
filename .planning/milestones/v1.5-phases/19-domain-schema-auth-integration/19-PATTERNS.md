# Phase 19: Domain Schema & Auth Integration - Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 6 (1 new migration + 5 modified files)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/db/migrate/YYYYMMDDHHMMSS_add_lifecycle_columns_to_brokerage_domains.rb` | migration | batch (schema + data backfill) | `backend/db/migrate/20260420000001_add_last_active_at_to_groups.rb` | exact (add_column + execute UPDATE) |
| `backend/app/models/brokerage_domain.rb` | model | CRUD | `backend/app/models/brokerage_board_credential.rb` | exact (enum + string status default + partial-index uniqueness) |
| `backend/app/controllers/concerns/brokerage_auth.rb` | middleware | request-response | self (existing file being updated) | self |
| `backend/app/controllers/v1/domains_controller.rb` | controller | request-response | self (existing file being updated) | self |
| `backend/test/factories/brokerage_domains.rb` | factory | — | `backend/test/factories/brokerage_board_credentials.rb` | exact (string enum attribute defaults) |
| `backend/test/integration/brokerage_auth_main_domain_test.rb` | test | — | self (must stay passing, no structural changes) | self |

---

## Pattern Assignments

### `backend/db/migrate/YYYYMMDDHHMMSS_add_lifecycle_columns_to_brokerage_domains.rb`

**Analog:** `backend/db/migrate/20260420000001_add_last_active_at_to_groups.rb`
**Secondary analog (partial index):** `backend/db/migrate/20260414000002_enforce_single_active_filter_set.rb`
**Secondary analog (up/down + add_column + backfill):** `backend/db/migrate/20260409000001_add_uid_to_groups.rb`

**Migration class skeleton pattern** (from `20260420000001_add_last_active_at_to_groups.rb`, lines 1-19):
```ruby
class AddLastActiveAtToGroups < ActiveRecord::Migration[7.1]
  def up
    add_column :groups, :last_active_at, :datetime

    execute <<~SQL
      UPDATE groups
      SET last_active_at = COALESCE(...)
    SQL
  end

  def down
    remove_column :groups, :last_active_at
  end
end
```
Use `def up` / `def down` (not `def change`) because the migration contains a raw SQL `execute` backfill that cannot be auto-reversed.

**add_column with DB default pattern** (from `20260321000002_create_brokerage_board_credentials.rb`, line 10):
```ruby
t.string :status, null: false, default: "active"
```
Apply same `null: false, default: "..."` to `domain_type` and `status` columns. `is_primary` is boolean so use `null: false, default: false`. `phase_out_at` is `datetime, null: true` (no default).

**Partial unique index pattern** (from `20260414000002_enforce_single_active_filter_set.rb`, lines 18-21):
```ruby
add_index :group_filter_sets, :group_id,
  unique: true,
  where: "active = true",
  name: "index_group_filter_sets_on_group_id_single_active"
```
Apply to the domain uniqueness index as:
```ruby
add_index :brokerage_domains, :domain,
  unique: true,
  where: "status != 'decommissioned'",
  name: "index_brokerage_domains_on_domain_active_unique"
```
The `down` must also remove the old full unique index and restore it:
```ruby
remove_index :brokerage_domains, name: "index_brokerage_domains_on_domain_active_unique"
remove_index :brokerage_domains, name: "index_brokerage_domains_on_domain"
# then re-add the original full unique index in down
add_index :brokerage_domains, :domain, unique: true
```

**Backfill SQL pattern** (from `20260409000001_add_uid_to_groups.rb`, line 5 and `20260420000001_add_last_active_at_to_groups.rb`, lines 5-13):
```ruby
execute "UPDATE groups SET uid = gen_random_uuid()::text WHERE uid IS NULL"
# or with heredoc:
execute <<~SQL
  UPDATE groups SET last_active_at = COALESCE(...) 
SQL
```
Apply to set `domain_type = 'subdomain'`, `status = 'active'`, `is_primary = true` on all existing rows:
```ruby
execute <<~SQL
  UPDATE brokerage_domains
  SET domain_type = 'subdomain', status = 'active', is_primary = true
  WHERE domain_type IS NULL
SQL
```

---

### `backend/app/models/brokerage_domain.rb`

**Analog:** `backend/app/models/brokerage_board_credential.rb` (string enum + status default)
**Secondary analog (CONSTANT array + inclusion validation):** `backend/app/models/user_calendar_connection.rb`
**Secondary analog (named scope + custom validate method):** existing `brokerage_domain.rb` self (lines 8-10, 28-41)

**Enum macro pattern** (from `brokerage_board_credential.rb`, line 30):
```ruby
enum :status, {active: "active", invalid: "invalid"}, prefix: :credential
```
Replicate for both new enums. Use `prefix: :status` / `prefix: :domain_type` to avoid method-name collisions:
```ruby
enum :domain_type, {subdomain: "subdomain", custom: "custom"}, prefix: :domain_type
enum :status, {active: "active", phasing_out: "phasing_out", decommissioned: "decommissioned"}, prefix: :status
```
This generates `record.status_active?`, `BrokerageDomain.status_active`, etc.

**Frozen constant array pattern** (from `user_calendar_connection.rb`, line 8):
```ruby
PROVIDERS = %w[google microsoft apple].freeze
```
Apply for the reserved slugs constant:
```ruby
RESERVED_SLUGS = %w[admin api www mail smtp ftp staging dev test app auth login
                    signup dashboard static assets cdn docs help support status].freeze
```

**Custom validate method pattern** (from existing `brokerage_domain.rb`, lines 28-41):
```ruby
def valid_domain_format
  return if domain.blank?
  valid_patterns = [...]
  unless valid_patterns.any? { |pattern| domain.match?(pattern) }
    errors.add(:domain, "must be a valid domain name ...")
  end
end
```
Add a second private validate method for subdomain slug and reserved-words logic. Declare it with `validate :valid_subdomain_slug, if: -> { domain_type_subdomain? }`.

**Uniqueness validator with conditions** — no existing analog in the codebase uses the `conditions:` lambda. Use standard Rails form:
```ruby
validates :domain, uniqueness: {
  conditions: -> { where.not(status: :decommissioned) },
  message: "is already taken"
}
```

**Named scope pattern** (from existing `brokerage_domain.rb`, lines 8-10, and `invitation.rb`, lines 17-19):
```ruby
scope :verified,  -> { where(verified: true) }
scope :unverified, -> { where(verified: false) }
scope :active,    -> { where(deleted_at: nil) }  # <-- rename/drop; 'active' claimed by enum
```
Add the new `routable` scope:
```ruby
scope :routable, -> { where(status: [:active, :phasing_out]) }
```
The existing `.active` scope (line 10) must be renamed — drop it or rename to `.not_deleted` since the enum will generate `.status_active` for status-based filtering.

**Model-level invariant validation** (custom validate private method):
```ruby
validate :status_requires_verified

def status_requires_verified
  if status_active? && !verified?
    errors.add(:status, "cannot be set to active unless the domain is verified")
  end
end
```

---

### `backend/app/controllers/concerns/brokerage_auth.rb`

**Self-modification** — update one line within the existing `resolve_brokerage` method.

**Existing routing lookup** (lines 32-35):
```ruby
domain_record = BrokerageDomain
  .includes(:brokerage)
  .find_by(domain: domain, verified: true)
```

**Updated pattern** (replace with named scope from D-08):
```ruby
domain_record = BrokerageDomain
  .routable
  .includes(:brokerage)
  .find_by(domain: domain)
```
No other changes to this file. The `main_domain_request?` branch and `extract_domain_from_request` are untouched.

---

### `backend/app/controllers/v1/domains_controller.rb`

**Self-modification** — update one line in the `check` action.

**Existing query** (line 15):
```ruby
exists = BrokerageDomain.exists?(domain: domain, verified: true, deleted_at: nil)
```

**Updated pattern** (from D-10 — status encapsulates verified + not-deleted invariant):
```ruby
exists = BrokerageDomain.status_active.exists?(domain: domain)
```
No other changes. Error handling, routing, skip_before_action all remain identical.

---

### `backend/test/factories/brokerage_domains.rb`

**Analog:** `backend/test/factories/brokerage_board_credentials.rb` (string attribute default on a model with enum)

**Existing factory** (lines 1-7):
```ruby
FactoryBot.define do
  factory :brokerage_domain do
    brokerage
    sequence(:domain) { |n| "brokerage#{n}.example.com" }
    verified { true }
  end
end
```

**String enum default pattern** (from `brokerage_board_credentials.rb`, line 7):
```ruby
status { "active" }
```

**Updated factory** (add three new attributes with safe defaults so all existing tests keep passing without changes):
```ruby
FactoryBot.define do
  factory :brokerage_domain do
    brokerage
    sequence(:domain) { |n| "brokerage#{n}.example.com" }
    verified    { true }
    domain_type { "subdomain" }
    status      { "active" }
    is_primary  { true }
  end
end
```
Use string values (not symbols) to be consistent with the existing `status { "active" }` pattern in `brokerage_board_credentials.rb`.

---

## Shared Patterns

### Migration: `up` / `down` vs `change`
**Source:** `backend/db/migrate/20260420000001_add_last_active_at_to_groups.rb` and `20260409000001_add_uid_to_groups.rb`
**Apply to:** The new brokerage_domains migration
When a migration includes `execute` (raw SQL backfill), always use `def up` + `def down` instead of `def change`. Rails cannot auto-reverse raw SQL.

### Migration: DB-Level Defaults for String Enums
**Source:** `backend/db/migrate/20260321000002_create_brokerage_board_credentials.rb`, line 10
**Apply to:** `domain_type` and `status` columns
```ruby
t.string :status, null: false, default: "active"
```

### Rails Enum Macro (String-backed, Prefixed)
**Source:** `backend/app/models/brokerage_board_credential.rb`, line 30
**Apply to:** `BrokerageDomain` model
```ruby
enum :status, {active: "active", invalid: "invalid"}, prefix: :credential
```
Always use string values (not integers) to keep DB values human-readable. Always use `prefix:` to avoid collision with other method names.

### Model Frozen Constant for Allowlists
**Source:** `backend/app/models/user_calendar_connection.rb`, line 8
**Apply to:** `BrokerageDomain::RESERVED_SLUGS`
```ruby
PROVIDERS = %w[google microsoft apple].freeze
```

### Controller Scope Over Raw Conditions
**Source:** `backend/app/controllers/v1/domains_controller.rb` (current, being updated)
**Apply to:** Both `BrokerageAuth` and `DomainsController`
Prefer named model scopes (`.routable`, `.status_active`) over inline hash conditions (`verified: true, deleted_at: nil`). This keeps intent explicit and centralizes routing logic in the model.

---

## No Analog Found

All files in scope have strong analogs or are self-modifications.

| File | Note |
|------|------|
| `validates :domain, uniqueness: { conditions: -> { ... } }` | No existing model uses the `conditions:` lambda on `validates :uniqueness`. Use standard Rails docs pattern. |

---

## Metadata

**Analog search scope:** `backend/app/models/`, `backend/app/controllers/`, `backend/db/migrate/`, `backend/test/factories/`, `backend/test/integration/`
**Files scanned:** 18
**Pattern extraction date:** 2026-05-27
