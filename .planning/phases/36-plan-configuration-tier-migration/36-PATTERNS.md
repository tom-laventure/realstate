# Phase 36: Plan Configuration & Tier Migration - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 12 (1 new migration, 1 new config constant, 2 modified controllers, 1 modified model, 7 modified test files)
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `backend/db/migrate/YYYYMMDDHHMMSS_migrate_brokerage_plan_tiers.rb` | migration | batch (data backfill) | `backend/db/migrate/20260330000007_scope_estate_documents_to_group_estate.rb` | exact |
| `backend/app/constants/plan_tiers.rb` | config | CRUD (read-only lookup) | `backend/app/constants/roles.rb` | role-match (richer shape) |
| `backend/app/models/brokerage.rb` | model | CRUD | itself (existing file, in-place edit) | exact |
| `backend/app/controllers/v1/admin/domains_controller.rb` | controller | request-response | itself (existing file, in-place edit) | exact |
| `backend/app/controllers/v1/onboarding/brokerages_controller.rb` | controller | request-response | itself (existing file, in-place edit) | exact |
| `backend/test/models/brokerage_freeze_test.rb` | test | CRUD | itself (update `plan: "premium"` → `plan: "growth"`) | exact |
| `backend/test/integration/ops_plan_test.rb` | test | request-response | itself (update `plan: "premium"` → `plan: "growth"`) | exact |
| `backend/test/integration/admin_domains_test.rb` | test | request-response | itself (update `plan: "premium"`/`"basic"` → `"growth"`/`"independent"`) | exact |
| `backend/test/integration/onboarding_domain_guard_test.rb` | test | request-response | itself (update `plan: "basic"` param → `"independent"`) | exact |
| `backend/test/mailers/domain_mailer_test.rb` | test | event-driven | itself (update `plan: "premium"` → `"growth"`) | exact |
| `backend/test/jobs/domain_verification_job_test.rb` | test | event-driven | itself (update `plan: "premium"` → `"growth"`) | exact |
| `backend/test/jobs/domain_health_job_test.rb` | test | event-driven | itself (update `plan: "premium"` → `"growth"`) | exact |

Note: `backend/test/factories/brokerages.rb` does **not** set `:plan` (relies on column default) and needs **no code change** — confirmed by direct read. It is included here only as a verification note, not a file to modify. If the column default changes to `"free"` (Pattern 2 below), any test that relies on the factory default and expects real-board/custom-domain access must pass `plan: "independent"` or `"growth"` explicitly — this affects the 7 test files above, which is why they're already in scope.

## Pattern Assignments

### `backend/db/migrate/YYYYMMDDHHMMSS_migrate_brokerage_plan_tiers.rb` (migration, batch)

**Analog:** `backend/db/migrate/20260330000007_scope_estate_documents_to_group_estate.rb` (full file read, 54 lines)

**Core pattern — raw `execute()` backfill with orphan-check guard** (lines 1-29 of analog):
```ruby
class ScopeEstateDocumentsToGroupEstate < ActiveRecord::Migration[7.1]
  def up
    add_column :estate_documents, :group_estate_id, :integer

    execute <<~SQL
      UPDATE estate_documents
      SET group_estate_id = (
        SELECT ge.id FROM group_estates ge
        WHERE ge.estate_id = estate_documents.estate_id
        ORDER BY ge.created_at ASC
        LIMIT 1
      )
    SQL

    orphan_count = execute("SELECT COUNT(*) FROM estate_documents WHERE group_estate_id IS NULL").first["count"].to_i
    raise "Migration halted: #{orphan_count} estate_documents have no matching group_estate and would be permanently deleted. Reassign or remove these records before running this migration." if orphan_count > 0

    change_column_null :estate_documents, :group_estate_id, false
    # ... (index/FK changes not applicable to this phase's migration)
  end

  def down
    add_column :estate_documents, :estate_id, :integer
    execute <<~SQL
      UPDATE estate_documents
      SET estate_id = ge.estate_id
      FROM group_estates ge
      WHERE ge.id = estate_documents.group_estate_id
    SQL
    # ... (reverse operations)
  end
end
```

**What to copy:**
- `def up` / `def down` structure (not `def change`) — this analog uses explicit `up`/`down` because the operation isn't cleanly reversible by Rails' automatic inverse. RESEARCH.md's own suggested skeleton uses `def up`/`def down` for the same reason (raw `execute` UPDATEs aren't auto-invertible).
- `execute(<<~SQL ... SQL)` heredoc style for each UPDATE statement — one statement per old→new value pair.
- The orphan-check guard pattern: run a `SELECT COUNT(*)` after the backfill and `raise` with a descriptive message if any row is left in a bad state. For this phase: `SELECT COUNT(*) FROM brokerages WHERE plan NOT IN ('free','independent','growth')` after backfilling, raise if `> 0`.
- Must also call `change_column_default :brokerages, :plan, from: "basic", to: "free"` inside `up` (and reverse it in `down`) — see RESEARCH.md Pattern 2/Pitfall 4. No analog file does a `change_column_default` in this exact shape, but it's a single stock Rails migration method, safe to add alongside the `execute` calls.
- **Do not** query through the `Brokerage` AR class (bypasses `acts_as_paranoid`'s `default_scope`, silently skipping soft-deleted rows) — raw SQL against the `brokerages` table sidesteps this entirely, exactly as this analog does for `estate_documents`.

**Naming/timestamp convention:** Most recent migration is `20260713000000_add_browser_tab_name_to_brokerages.rb`; current schema version is `2026_07_13_000000`. New migration filename must use a timestamp after that (e.g. `20260714000000_migrate_brokerage_plan_tiers.rb`, matching today's date 2026-07-14 per `currentDate` context).

---

### `backend/app/constants/plan_tiers.rb` (config, CRUD read-only lookup) — NEW FILE

**Analog:** `backend/app/constants/roles.rb` (full file, 3 lines) — establishes the `module AppConstants` + frozen-constant convention this file must follow.

```ruby
# backend/app/constants/roles.rb (full file)
module AppConstants
  # Brokerage-level roles
  BROKERAGE_ROLES = %w[owner admin agent staff client].freeze
end
```

**What to copy:** the `module AppConstants ... end` wrapper and `.freeze` convention. `plan_tiers.rb` is a sibling file in the same `app/constants/` directory, same module namespace (`AppConstants`), reopening the module (do not redeclare `BROKERAGE_ROLES`).

**Secondary analog for the `Struct`-per-entry shape** — `backend/app/services/groups/create.rb` lines 1-6 (Result struct pattern):
```ruby
module Groups
  class Create
    Result = Struct.new(:success, :group, :errors) do
      alias_method :success?, :success
    end
```

**What to copy:** the `Struct.new(...)` declaration style (keyword_init or positional — RESEARCH.md recommends `keyword_init: true` given the number of fields). This is the only existing precedent in the codebase for a lightweight value-object via `Struct`; use it as the model for `PlanTier = Struct.new(:seat_cap, :base_price_cents, :overage_price_cents, :annual_discount_rate, :real_boards, :clients, :custom_domain, :calendar_sync, keyword_init: true)`.

**Values (from RESEARCH.md, sourced from `.planning/PLAN-TIERS.md`/REQUIREMENTS.md — not discretionary):**
- `free`: `seat_cap: nil` (unlimited), `base_price_cents: 0`, `overage_price_cents: 0`, `annual_discount_rate: 0.0`, all capability flags `false`
- `independent` (PLAN-10): `seat_cap: 1`, `base_price_cents: 2000`, `overage_price_cents: 2000`, `annual_discount_rate: 0.15`, all capability flags `true`
- `growth` (PLAN-11): `seat_cap: 5`, `base_price_cents: 7900`, `overage_price_cents: 1600`, `annual_discount_rate: 0.15`, all capability flags `true`

Store prices as integer cents (no existing codebase precedent, but standard Rails/Ruby practice — flagged `[ASSUMED]` in RESEARCH.md).

---

### `backend/app/models/brokerage.rb` (model, CRUD) — IN-PLACE EDIT

**File itself is the analog** (already read in full, 74 lines).

**Line to change** (line 14):
```ruby
# BEFORE
validates :plan, inclusion: {in: %w[basic premium]}
# AFTER
validates :plan, inclusion: {in: %w[free independent growth]}
```

**New accessor to add** (placement: alongside `phasing_out_count_for` / `freeze_custom_domains!` public instance methods, i.e. after line 29, before `freeze_custom_domains!`):
```ruby
def plan_config
  AppConstants::PLAN_TIERS.fetch(plan)
end
```
RESEARCH.md explicitly recommends **fail-loud** (`.fetch(plan)`, no fallback block) over a silent `.fetch(plan) { AppConstants::PLAN_TIERS.fetch("free") }` fallback — a data-integrity bug should raise `KeyError`, not silently strip a paying brokerage's capabilities. Follow this recommendation unless CONTEXT.md's discretion note leads planner elsewhere.

**Existing method style to mirror** (for docstring/comment conventions, lines 31-36 — `freeze_custom_domains!`'s comment block referencing REQ-IDs):
```ruby
# DPRD-01, DPRD-03: Plan downgrade — freeze all custom domains and promote subdomain to primary.
# Called by Ops::PlanController (manual testing) and future billing webhook (v2).
def freeze_custom_domains!
```
New `plan_config` method should carry a similar REQ-ID-referencing comment (e.g. `# PLAN-02, PLAN-03, D-07: ...`).

---

### `backend/app/controllers/v1/admin/domains_controller.rb` (controller, request-response) — IN-PLACE EDIT

**File itself is the analog** (already read in full, 280 lines).

**Line to change** (lines 58-60):
```ruby
# BEFORE
unless Current.brokerage.plan == "premium"
  return render json: {error: "Custom domains require a premium plan", code: "plan_required"}, status: :forbidden
end
# AFTER
unless Current.brokerage.plan_config.custom_domain
  return render json: {error: "Custom domains require a plan with custom domain access", code: "plan_required"}, status: :forbidden
end
```

**Error-response pattern to preserve** (matches this file's convention throughout — e.g. lines 22, 90, 108, 116 all use `render json: {error: "...", ...}, status: :some_status`):
```ruby
render json: {error: "...", code: "plan_required"}, status: :forbidden
```
Keep the `code: "plan_required"` key — it's an existing API contract token other callers may rely on; do not rename it as part of this rewiring.

---

### `backend/app/controllers/v1/onboarding/brokerages_controller.rb` (controller, request-response) — IN-PLACE EDIT

**File itself is the analog** (already read in full, 138 lines).

**Lines to change** (lines 15-18, plan inclusion check):
```ruby
# BEFORE
plan = params[:plan].to_s
unless %w[basic premium].include?(plan)
  return render json: {error: "Invalid plan"}, status: :unprocessable_entity
end
# AFTER
plan = params[:plan].to_s
unless AppConstants::PLAN_TIERS.key?(plan)
  return render json: {error: "Invalid plan"}, status: :unprocessable_entity
end
```

**Lines to change** (lines 34-36, custom-domain-required-for-premium check):
```ruby
# BEFORE
custom_domain = params[:custom_domain].to_s.strip.downcase
if plan == "premium" && custom_domain.blank?
  return render json: {error: "Custom domain is required for premium"}, status: :unprocessable_entity
end
# AFTER (illustrative — exact conditional shape is discretionary per D-05, direction locked: growth requires it, independent/free do not)
custom_domain = params[:custom_domain].to_s.strip.downcase
if plan == "growth" && custom_domain.blank?
  return render json: {error: "Custom domain is required for this plan"}, status: :unprocessable_entity
end
```
Alternatively, config-driven via a capability flag if `plan_config` is fetchable before the brokerage exists (e.g. `AppConstants::PLAN_TIERS[plan]&.custom_domain` combined with a signup-specific "requires" flag) — RESEARCH.md flags this shape as illustrative only; planner has discretion on whether the requirement is literal-string-`"growth"` or a new dedicated config flag (e.g. `custom_domain_required_at_signup`). Either is consistent with D-06's "config-driven" directive since `growth` membership itself is still sourced from the same `AppConstants::PLAN_TIERS` keys, not a hardcoded elsewhere-duplicated list.

**Validation error-response pattern to preserve** (matches this file's convention throughout, e.g. lines 17, 24, 28, 35, 44, 48): `render json: {error: "..."}, status: :unprocessable_entity`.

---

### Test files — 7 files, all follow the same one-line substitution pattern

**Analog:** each file is its own analog; substitution is mechanical per RESEARCH.md Pitfall 2 and D-01's mapping (`basic`→`independent`, `premium`→`growth`).

| File | Line(s) | Change |
|------|---------|--------|
| `backend/test/models/brokerage_freeze_test.rb` | 5 | `create(:brokerage, plan: "premium")` → `create(:brokerage, plan: "growth")` |
| `backend/test/integration/ops_plan_test.rb` | 5 | `create(:brokerage, plan: "premium")` → `create(:brokerage, plan: "growth")` |
| `backend/test/jobs/domain_health_job_test.rb` | 19 | `create(:brokerage, plan: "premium")` → `create(:brokerage, plan: "growth")` |
| `backend/test/jobs/domain_verification_job_test.rb` | 22 | `create(:brokerage, plan: "premium")` → `create(:brokerage, plan: "growth")` |
| `backend/test/mailers/domain_mailer_test.rb` | 5 | `create(:brokerage, name: "Acme Realty", plan: "premium")` → `plan: "growth"` |
| `backend/test/integration/onboarding_domain_guard_test.rb` | 26, 63 | `params: {brokerage: {name: "Test"}, subdomain: "test", plan: "basic"}` → `plan: "independent"` |
| `backend/test/integration/admin_domains_test.rb` | 9, 129-136 | Line 9: `create(:brokerage, plan: "premium")` → `plan: "growth"`. Line 130: `@brokerage.update!(plan: "basic")` → `plan: "independent"`. Line 129's test title `"...returns 403 for basic plan brokerage (DMOD-05)"` should be updated to reference the new tier name (e.g. `"...returns 403 for independent plan brokerage (DMOD-05)"`) for clarity, though this is cosmetic. |

Preserve the intent mapping exactly as D-01 locks it (`basic`→`independent` retains "no custom domain access" semantics; `premium`→`growth` retains "has custom domain access" semantics) — this is why the test assertions themselves (e.g. `assert_equal "plan_required", body["code"]` at line 136) should NOT need logic changes, only the literal plan-value strings.

---

## Shared Patterns

### Config-driven capability check (replaces string-literal plan comparison)
**Source:** `backend/app/models/brokerage.rb` (new `plan_config` method) + `backend/app/constants/plan_tiers.rb` (new `AppConstants::PLAN_TIERS`)
**Apply to:** `backend/app/controllers/v1/admin/domains_controller.rb`, and any future Phase 37-39 controller needing a plan-gated check
```ruby
unless Current.brokerage.plan_config.custom_domain
  # deny
end
```
This is the single integration point D-07 establishes — every later phase must use `Current.brokerage.plan_config.<flag>`, never `Current.brokerage.plan == "<literal>"`.

### Raw-SQL data backfill with orphan-check guard (migration safety)
**Source:** `backend/db/migrate/20260330000007_scope_estate_documents_to_group_estate.rb`
**Apply to:** the new `MigrateBrokeragePlanTiers` migration
```ruby
execute <<~SQL
  UPDATE brokerages SET plan = 'independent' WHERE plan = 'basic'
SQL
execute <<~SQL
  UPDATE brokerages SET plan = 'growth' WHERE plan = 'premium'
SQL
orphan_count = execute("SELECT COUNT(*) FROM brokerages WHERE plan NOT IN ('free','independent','growth')").first["count"].to_i
raise "Migration halted: ..." if orphan_count > 0
```
Raw `execute()` is mandatory here (not `Brokerage.where(...).update_all`) because `acts_as_paranoid`'s `default_scope` would silently exclude soft-deleted rows from an AR-scoped bulk update.

### Frozen `AppConstants` module constant
**Source:** `backend/app/constants/roles.rb`
**Apply to:** `backend/app/constants/plan_tiers.rb`
```ruby
module AppConstants
  BROKERAGE_ROLES = %w[owner admin agent staff client].freeze
end
```
New file reopens the same `AppConstants` module in a sibling file under `app/constants/`.

### Error response shape (controllers)
**Source:** both `domains_controller.rb` and `onboarding/brokerages_controller.rb` (consistent throughout both files)
**Apply to:** any modified conditional branch in these two controllers
```ruby
render json: {error: "<message>"}, status: :unprocessable_entity
# or, when a machine-readable code matters (domains_controller only):
render json: {error: "<message>", code: "plan_required"}, status: :forbidden
```

## No Analog Found

None. All 12 files have a clear analog — this phase is a small, self-contained backend change with direct precedent for every piece (data-backfill migration, frozen config constant, Struct value object, controller conditional rewiring, test literal substitution).

## Metadata

**Analog search scope:** `backend/app/constants/`, `backend/app/models/brokerage.rb`, `backend/app/controllers/v1/admin/domains_controller.rb`, `backend/app/controllers/v1/onboarding/brokerages_controller.rb`, `backend/app/services/groups/create.rb`, `backend/db/migrate/` (recent backfill-shaped migrations), `backend/test/{models,integration,jobs,mailers}/` (grep for `plan:` literals), `backend/test/factories/brokerages.rb`
**Files scanned:** ~15 (targeted reads, no full-repo scan needed — RESEARCH.md had already identified all relevant call sites with verified line numbers, which this pass cross-checked against direct reads)
**Pattern extraction date:** 2026-07-14
