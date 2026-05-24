# Phase 12: Board Connect Flow — Backend - Research

**Researched:** 2026-05-23
**Domain:** Rails controller logic, ActiveRecord bulk insert, conditional model validation, scope modification
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BOARD-03 | Connecting to any board auto-creates `BrokerageEstate` rows for all estates on that board (fired inside `POST /v1/admin/board_credentials`) | `BrokerageEstate` model exists; `insert_all` with `unique_by` is the established pattern; see Controller Changes section |
| BOARD-04 | Connecting to a test board requires no RETS credentials — username/password validation skipped server-side | Three guard points: `board_credentials_controller.rb` env guard, `BrokerageBoardCredential` model validations, `RetsAuthService` call — all three must be conditionalized on `board.is_test_board?` |
</phase_requirements>

---

## Summary

Phase 12 is a pure backend phase touching one controller, one model, and one model scope. No migrations are needed — all tables exist. The implementation has three logical concerns:

**1. Allow TEST board in the connect endpoint.** The `BoardCredentialsController#create` action currently scopes the board lookup to `RealEstateBoard.active.real_boards`, which excludes the TEST board (`is_test_board: true`). The scope must be widened to include test boards.

**2. Bypass RETS validation for test boards.** Two guard points block test board connections: (a) the inline `Rails.env.development?` bypass in the controller will not fire in non-dev environments, and (b) `BrokerageBoardCredential` validates `rets_username` and `rets_password` presence unconditionally. Both must be conditionalized on `board.is_test_board?`.

**3. Bulk-insert `BrokerageEstate` rows after credential save.** After a successful credential save, the controller must insert one `BrokerageEstate` row per estate belonging to that board. The established pattern for this in the codebase is `insert_all` with a `unique_by` clause to guard against re-connect idempotency. Additionally, the `Estate#accessible_by` scope currently filters to `real_boards` only — test board estates are invisible to dashboards even after `BrokerageEstate` rows exist. This scope must be updated so that test board estates are returned when the brokerage has a direct `BrokerageEstate` row.

**Primary recommendation:** Two plans. Plan 01: fix the controller (board lookup scope + RETS bypass + bulk insert). Plan 02: fix the `Estate#accessible_by` scope + integration tests.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Board credential creation | API / Backend (controller) | — | `POST /v1/admin/board_credentials` — controller owns the flow |
| RETS credential validation bypass | API / Backend (controller + service) | API / Backend (model) | Controller calls `RetsAuthService`; model validates fields; both need test-board awareness |
| Bulk `BrokerageEstate` creation | API / Backend (controller) | Database | INSERT fired inside controller action after credential save |
| TEST board listing visibility | Database (scope) | — | `Estate#accessible_by` is a model scope; fixing it here makes it work everywhere |
| Test factory setup | API / Backend (test) | — | FactoryBot factories for `RealEstateBoard` and `BrokerageBoardCredential` don't exist yet |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Rails 7.1 `insert_all` | Built-in | Bulk insert `BrokerageEstate` rows without callbacks | Already used in `GroupEstate` insert in group/estates_controller and services/groups/create.rb |
| `acts_as_paranoid` | Project-established | `BrokerageEstate` lacks soft-delete; no paranoid concern here | `BrokerageEstate` model has no `acts_as_paranoid` — plain insert_all is correct |
| ActiveRecord scopes | Built-in | `Estate#accessible_by` update | Scope already established in estate.rb |
| FactoryBot | Project-established | Test factory creation | `test_helper.rb` includes `FactoryBot::Syntax::Methods` |

[VERIFIED: codebase — app/models/brokerage_estate.rb, app/controllers/v1/admin/group/estates_controller.rb, test/test_helper.rb]

### No New Gems Required

This phase adds no new dependencies.

---

## Architecture Patterns

### System Architecture Diagram

```
POST /v1/admin/board_credentials
  └── BoardCredentialsController#create
        │
        ├── 1. Board lookup
        │     RealEstateBoard.active.find_by(id:)   ← CHANGE: remove .real_boards scope
        │     board not found → 404
        │
        ├── 2. RETS validation (conditional)
        │     if board.is_test_board?
        │       → skip → Result.new(success: true)  ← NEW: test board bypass
        │     elsif Rails.env.development?
        │       → skip (existing dev bypass)
        │     else
        │       → RetsAuthService.new(board:, username:, password:).call
        │     result.success? == false → 422
        │
        ├── 3. Credential save
        │     find_or_initialize_by(real_estate_board:)
        │     assign username/password (may be empty for test board)  ← BOARD-04 model change needed
        │     credential.save → 422 on failure
        │
        ├── 4. BrokerageEstate bulk insert  ← NEW: BOARD-03
        │     board.estates.pluck(:id)
        │     insert_all(rows, unique_by: [:brokerage_id, :estate_id])
        │
        └── 5. Render 201 with credential

Estate#accessible_by scope (current):
  joins(:real_estate_board).merge(RealEstateBoard.real_boards)  ← EXCLUDES test board estates
  WHERE bbc exists OR be exists

Estate#accessible_by scope (after Phase 12):
  Test board estates with a BrokerageEstate row must be returned.
  Option: change scope so real_boards filter only applies when no BrokerageEstate row exists,
  OR: add a second OR branch that covers test board estates with BrokerageEstate rows.
```

### Recommended Project Structure

No new files or folders needed. The following existing files are modified:

```
backend/
├── app/
│   ├── controllers/v1/admin/
│   │   └── board_credentials_controller.rb  ← board scope + RETS bypass + bulk insert
│   │   └── boards_controller.rb             ← include test boards in index (Phase 13 needs this)
│   ├── models/
│   │   ├── brokerage_board_credential.rb    ← conditional presence validations
│   │   └── estate.rb                        ← accessible_by scope update
├── test/
│   ├── factories/
│   │   ├── real_estate_boards.rb            ← NEW factory
│   │   └── brokerage_board_credentials.rb  ← NEW factory
│   └── integration/
│       └── board_connect_flow_test.rb       ← NEW integration test
```

### Pattern 1: Widening a board lookup scope

**What:** Replace `.real_boards.find_by(id:)` with `.find_by(id:)` to include test boards.

```ruby
# Source: [VERIFIED: codebase — board_credentials_controller.rb line 24]

# Before:
board = RealEstateBoard.active.real_boards.find_by(id: board_credential_params[:real_estate_board_id])

# After:
board = RealEstateBoard.active.find_by(id: board_credential_params[:real_estate_board_id])
```

**When to use:** Any endpoint that must accept both real and test boards.

### Pattern 2: Test board RETS bypass in controller

**What:** Replace the dev-only bypass with a combined test-board-or-dev bypass.

```ruby
# Source: [VERIFIED: codebase — board_credentials_controller.rb lines 30-35]

# Before:
result = if Rails.env.development?
  RetsAuthService::Result.new(success: true, error: nil)
else
  RetsAuthService.new(board: board, username: username, password: password).call
end

# After:
result = if board.is_test_board? || Rails.env.development?
  RetsAuthService::Result.new(success: true, error: nil)
else
  RetsAuthService.new(board: board, username: username, password: password).call
end
```

**Key insight:** `is_test_board?` is an AR-generated predicate for the boolean column — no custom method needed. [VERIFIED: codebase — real_estate_board.rb confirms column exists; Rails boolean predicate generation is established behavior]

### Pattern 3: Conditional model validation (unless proc)

**What:** Make `rets_username` and `rets_password` presence validations skip when board is a test board.

The challenge: `BrokerageBoardCredential` `belongs_to :real_estate_board`, so `real_estate_board` is accessible when validating. A `unless: proc` using the association works:

```ruby
# Source: [VERIFIED: codebase — brokerage_board_credential.rb lines 12-13, real_estate_board.rb]

# Before:
validates :rets_username, presence: true
validates :rets_password, presence: true

# After:
validates :rets_username, presence: true, unless: -> { real_estate_board&.is_test_board? }
validates :rets_password, presence: true, unless: -> { real_estate_board&.is_test_board? }
```

**Why `&.`:** `real_estate_board` is a `belongs_to` association. With `find_or_initialize_by`, the association is assigned before validating, so `real_estate_board` is present. The safe navigator guards against edge cases where the association is nil (e.g., in tests or invalid builds).

**Alternative considered:** Use a custom `before_validation` to assign placeholder credentials. Rejected — this hides intent and pollutes the DB with fake values. Conditional validation is cleaner and more explicit. [ASSUMED — multiple valid approaches; recommendation based on project code style]

### Pattern 4: Bulk insert of BrokerageEstate rows

**What:** After a successful credential save, insert one `BrokerageEstate` row per estate on the board.

```ruby
# Source: [VERIFIED: codebase — group/estates_controller.rb lines 139-143, established insert_all pattern]

estate_ids = board.estates.without_deleted.pluck(:id)

if estate_ids.any?
  now = Time.current
  rows = estate_ids.map do |eid|
    {brokerage_id: Current.brokerage.id, estate_id: eid, created_at: now, updated_at: now}
  end
  BrokerageEstate.insert_all(rows, unique_by: [:brokerage_id, :estate_id])
end
```

**Why `insert_all` not `upsert_all`:** `BrokerageEstate` has no encrypted fields, no callbacks to trigger, and no status column to update. `insert_all` is correct and faster. Duplicate rows are silently skipped by the unique index. [VERIFIED: codebase — schema.rb unique index `index_brokerage_estates_on_brokerage_id_and_estate_id`]

**Why `board.estates.without_deleted`:** `Estate` uses `acts_as_paranoid`. The `.without_deleted` guard is mandatory per project conventions to exclude soft-deleted listings. [VERIFIED: codebase — CLAUDE.md explicit rule; estate.rb confirms `acts_as_paranoid`]

**`unique_by` identifier:** The schema shows a regular composite unique index on `(brokerage_id, estate_id)`. Rails `insert_all` supports `unique_by:` with a column array for this case. [VERIFIED: codebase — schema.rb `index_brokerage_estates_on_brokerage_id_and_estate_id`]

### Pattern 5: Updating `accessible_by` to include test board estates

**What:** The current `accessible_by` scope has a hard `merge(RealEstateBoard.real_boards)` filter. Test board estates will never be returned even if a `BrokerageEstate` row exists.

```ruby
# Source: [VERIFIED: codebase — estate.rb lines 19-38]

# Current scope (simplified):
scope :accessible_by, ->(brokerage) {
  joins(:real_estate_board).merge(RealEstateBoard.real_boards).where(
    "EXISTS(bbc...) OR EXISTS(be...)"
  )
}

# Problem: test board estates are excluded by merge(real_boards) before the EXISTS checks run.
```

**Fix approach:** Add a second `OR` branch at the JOIN level that allows test board estates through when a direct `BrokerageEstate` row exists:

```ruby
# After:
scope :accessible_by, ->(brokerage) {
  brokerage_id = brokerage.is_a?(Integer) ? brokerage : brokerage.id

  where(
    <<~SQL,
      EXISTS (
        SELECT 1 FROM real_estate_boards reb
        JOIN brokerage_board_credentials bbc
          ON bbc.real_estate_board_id = reb.id
         AND bbc.brokerage_id = :brokerage_id
         AND bbc.status = 'active'
         AND bbc.deleted_at IS NULL
        WHERE reb.id = estates.real_estate_board_id
          AND reb.is_test_board = false
      ) OR EXISTS (
        SELECT 1 FROM brokerage_estates be
        WHERE be.brokerage_id = :brokerage_id
          AND be.estate_id = estates.id
      )
    SQL
    brokerage_id: brokerage_id
  )
}
```

**Key change:** The `real_boards` filter is moved inside the first `EXISTS` subquery (for the board credential path). The second `EXISTS` (direct `BrokerageEstate` row) is now unrestricted by board type — any estate with a `BrokerageEstate` row is accessible regardless of whether it is a test board estate.

**Why this is safe:** Real boards remain protected by the `bbc` credential check. Test boards only become accessible through the explicit `BrokerageEstate` row, which is only created by the connect flow. An estate on a test board with no `BrokerageEstate` row is still invisible. [VERIFIED: codebase — original scope logic, schema.rb foreign keys]

**Impact on callers:** `accessible_by` is called from 5 places in the codebase. The behavior for real boards is unchanged. Only test board estates with a `BrokerageEstate` row become visible — which is exactly what Phase 12 requires. [VERIFIED: codebase — grep of all `accessible_by` usages]

### Pattern 6: BoardsController must return test boards for Phase 13

**What:** `BoardsController#index` currently returns `RealEstateBoard.active.real_boards.order(:name)`. Phase 13 needs the connect dialog to show the TEST board in the dropdown. The backend endpoint must be updated.

```ruby
# Source: [VERIFIED: codebase — boards_controller.rb line 7]

# Before:
boards = RealEstateBoard.active.real_boards.order(:name)

# After:
boards = RealEstateBoard.active.order(:name)
```

This is a one-line change. It belongs in Phase 12 (backend phase) since Phase 13 (frontend) depends on it.

### Anti-Patterns to Avoid

- **Storing blank strings for test board credentials:** Assigning `""` to `rets_username`/`rets_password` before saving avoids the presence validation but writes garbage ciphertext to the DB. Conditional validation (`unless: -> { real_estate_board&.is_test_board? }`) is cleaner. [VERIFIED: codebase — STATE.md D-05 deleted credential seeding for this reason]
- **Calling `destroy_all` or `delete_all` on existing BrokerageEstate rows before insert:** Phase 12 creates rows; it must not delete them. The unique index on `(brokerage_id, estate_id)` handles idempotency via `insert_all`'s conflict-skip behavior.
- **Forgetting `.without_deleted` when fetching board estates:** `Estate` uses `acts_as_paranoid`. Omitting `.without_deleted` from `board.estates` would include soft-deleted listings in the bulk insert, violating the project-wide rule. [VERIFIED: codebase — CLAUDE.md explicit rule]
- **Leaving the `real_boards` filter in the board lookup for `board_credentials_controller`:** TEST board is `is_test_board: true` which means `real_boards` (`where(is_test_board: false)`) will not return it. The controller will always return 404 for TEST board connects without this fix. [VERIFIED: codebase — real_estate_board.rb scopes]
- **Treating `insert_all` conflicts as errors:** By default, Rails `insert_all` silently skips rows that violate unique constraints. This is the desired behavior for re-connecting a brokerage to a board it already has `BrokerageEstate` rows for.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bulk `BrokerageEstate` creation | Loop with `BrokerageEstate.find_or_create_by` | `BrokerageEstate.insert_all(rows, unique_by: [:brokerage_id, :estate_id])` | Single SQL statement vs O(n) roundtrips; already the project pattern for `GroupEstate` inserts |
| Conditional presence validation | Custom `before_validation` assigning placeholders | `validates :rets_username, presence: true, unless: -> { ... }` | Rails built-in conditional validation |
| Test board RETS bypass | New `NullRetsAuthService` class | Inline `if board.is_test_board?` guard in controller | Two lines vs a new file; same pattern as the existing `Rails.env.development?` guard |

---

## Common Pitfalls

### Pitfall 1: `real_boards` scope excludes TEST board from credential creation

**What goes wrong:** `RealEstateBoard.active.real_boards.find_by(id:)` returns `nil` for the TEST board because `real_boards` is `where(is_test_board: false)`. The controller renders 404 before any credential logic runs.

**Why it happens:** The `real_boards` scope was added in Phase 11 to distinguish between test and real boards. The `BoardCredentialsController` was not updated to handle both types.

**How to avoid:** Change `RealEstateBoard.active.real_boards.find_by` to `RealEstateBoard.active.find_by` in the controller. The board type check (`is_test_board?`) then happens inside the action when deciding whether to validate RETS credentials.

**Warning signs:** `POST /v1/admin/board_credentials` with the TEST board's ID returns 404 instead of 201. [VERIFIED: codebase — board_credentials_controller.rb line 24, real_estate_board.rb real_boards scope]

### Pitfall 2: Model validation blocks test board credential save

**What goes wrong:** Even if the controller bypasses `RetsAuthService`, the `credential.save` call will fail because `BrokerageBoardCredential` validates `rets_username` and `rets_password` presence. With empty/nil credentials for a test board, the model returns 422 with "Rets username can't be blank".

**Why it happens:** The model validations were written for real boards and are unconditional.

**How to avoid:** Add `unless: -> { real_estate_board&.is_test_board? }` to both `validates :rets_username` and `validates :rets_password` in `BrokerageBoardCredential`.

**Warning signs:** `credential.errors.full_messages` contains "Rets username can't be blank" when connecting to TEST board. [VERIFIED: codebase — brokerage_board_credential.rb lines 12-13]

### Pitfall 3: `Estate#accessible_by` filters out test board estates

**What goes wrong:** After inserting `BrokerageEstate` rows for TEST board estates, the group dashboard does not show those listings. The `accessible_by` scope has `.merge(RealEstateBoard.real_boards)` which runs BEFORE the `EXISTS (SELECT 1 FROM brokerage_estates ...)` check. The JOIN filter eliminates test board estates entirely.

**Why it happens:** The `accessible_by` scope was designed for real boards only. The `BrokerageEstate` EXISTS branch was added as a secondary access path but inherits the real_boards JOIN filter.

**How to avoid:** Restructure `accessible_by` to move the `real_boards` check inside the `bbc` EXISTS subquery, leaving the `be` (BrokerageEstate) EXISTS branch unrestricted by board type.

**Warning signs:** After a successful `POST /v1/admin/board_credentials` for TEST board, `Estate.accessible_by(brokerage).count` returns 0 even though 100 `BrokerageEstate` rows were created. [VERIFIED: codebase — estate.rb accessible_by scope, `joins(:real_estate_board).merge(RealEstateBoard.real_boards)` confirmed]

### Pitfall 4: `insert_all` does not trigger AR callbacks or validations

**What goes wrong:** `BrokerageEstate.insert_all(rows)` bypasses all ActiveRecord callbacks and validations. This is intentional and correct for Phase 12 (no callbacks needed), but planners must not add validation logic to `BrokerageEstate` expecting it to run during the bulk insert.

**Why it happens:** `insert_all` is a direct SQL INSERT — this is documented Rails behavior.

**How to avoid:** Keep `BrokerageEstate` a plain join model with no callbacks. The uniqueness constraint is enforced at the DB level by the unique index, which `insert_all` respects.

**Warning signs:** N/A — this is a positive property, not an error condition. [VERIFIED: codebase — Rails 7.1 insert_all behavior, established in GroupEstate inserts]

### Pitfall 5: Missing factories for `RealEstateBoard` and `BrokerageBoardCredential`

**What goes wrong:** Integration tests for BOARD-03 and BOARD-04 need `RealEstateBoard` and `BrokerageBoardCredential` records. The test factory directory has no `real_estate_boards.rb` or `brokerage_board_credentials.rb` factory files.

**Why it happens:** Phase 11 and earlier phases didn't add board-related factories because no tests needed them at the time.

**How to avoid:** Create both factories before writing the integration test. The `RealEstateBoard` factory needs a trait for `is_test_board: true`. The `BrokerageBoardCredential` factory may be needed for setup in future test phases. [VERIFIED: codebase — test/factories/ directory listing confirms absence]

---

## Code Examples

### BoardCredentialsController#create — full updated action

```ruby
# Source: [VERIFIED: codebase — board_credentials_controller.rb]

def create
  board = RealEstateBoard.active.find_by(id: board_credential_params[:real_estate_board_id])
  return render json: {error: "Board not found"}, status: :not_found unless board

  username = board_credential_params[:rets_username]
  password = board_credential_params[:rets_password]

  result = if board.is_test_board? || Rails.env.development?
    RetsAuthService::Result.new(success: true, error: nil)
  else
    RetsAuthService.new(board: board, username: username, password: password).call
  end

  unless result.success?
    return render json: {error: result.error}, status: :unprocessable_entity
  end

  credential = Current.brokerage.brokerage_board_credentials.without_deleted.find_or_initialize_by(
    real_estate_board: board
  )

  credential.rets_username = username
  credential.rets_password = password
  credential.assign_attributes(status: "active", last_verified_at: Time.current)

  if credential.save
    # BOARD-03: bulk-insert BrokerageEstate rows for all non-deleted estates on this board
    estate_ids = board.estates.without_deleted.pluck(:id)
    if estate_ids.any?
      now = Time.current
      rows = estate_ids.map do |eid|
        {brokerage_id: Current.brokerage.id, estate_id: eid, created_at: now, updated_at: now}
      end
      BrokerageEstate.insert_all(rows, unique_by: [:brokerage_id, :estate_id])
    end

    render json: {
      board_credential: ActiveModelSerializers::SerializableResource.new(
        credential,
        serializer: BrokerageBoardCredentialSerializer,
        adapter: :attributes
      ).as_json
    }, status: :created
  else
    render json: {errors: credential.errors.full_messages}, status: :unprocessable_entity
  end
end
```

### BrokerageBoardCredential model — conditional validations

```ruby
# Source: [VERIFIED: codebase — brokerage_board_credential.rb]

class BrokerageBoardCredential < ApplicationRecord
  acts_as_paranoid

  belongs_to :brokerage
  belongs_to :real_estate_board

  encrypts :rets_username
  encrypts :rets_password

  enum :status, {active: "active", invalid: "invalid"}, prefix: :credential

  validates :rets_username, presence: true, unless: -> { real_estate_board&.is_test_board? }
  validates :rets_password, presence: true, unless: -> { real_estate_board&.is_test_board? }
  validates :brokerage_id, uniqueness: {
    scope: :real_estate_board_id,
    message: "is already registered with this board"
  }
end
```

### Estate#accessible_by — updated scope

```ruby
# Source: [VERIFIED: codebase — estate.rb; restructured to allow test board estates via BrokerageEstate]

scope :accessible_by, ->(brokerage) {
  brokerage_id = brokerage.is_a?(Integer) ? brokerage : brokerage.id

  where(
    <<~SQL,
      EXISTS (
        SELECT 1 FROM real_estate_boards reb
        JOIN brokerage_board_credentials bbc
          ON bbc.real_estate_board_id = reb.id
         AND bbc.brokerage_id = :brokerage_id
         AND bbc.status = 'active'
         AND bbc.deleted_at IS NULL
        WHERE reb.id = estates.real_estate_board_id
          AND reb.is_test_board = false
      ) OR EXISTS (
        SELECT 1 FROM brokerage_estates be
        WHERE be.brokerage_id = :brokerage_id
          AND be.estate_id = estates.id
      )
    SQL
    brokerage_id: brokerage_id
  )
}
```

**Note:** The outer `joins(:real_estate_board).merge(RealEstateBoard.real_boards)` is removed. The real-board filter is now inside the first EXISTS subquery. The `BrokerageEstate` EXISTS subquery is board-type-agnostic.

### FactoryBot factory for RealEstateBoard

```ruby
# Source: [VERIFIED: codebase — test/factories/ existing patterns]
# Path: test/factories/real_estate_boards.rb

FactoryBot.define do
  factory :real_estate_board do
    sequence(:name)          { |n| "Board #{n}" }
    sequence(:short_code)    { |n| "BOARD#{n}" }
    sequence(:rets_endpoint) { |n| "https://rets#{n}.example.com/login" }
    active { true }
    is_test_board { false }

    trait :test_board do
      is_test_board { true }
      short_code { "TEST" }
      name { "Test RETS Board" }
    end
  end
end
```

### Integration test structure (BOARD-03 and BOARD-04)

```ruby
# Source: [VERIFIED: codebase — test/integration/admin_authorization_test.rb pattern]
# Path: test/integration/board_connect_flow_test.rb

class BoardConnectFlowTest < ActionDispatch::IntegrationTest
  setup do
    @brokerage = create(:brokerage)
    create(:brokerage_domain, brokerage: @brokerage, domain: "test.example.com")
    @admin = create(:user)
    create(:brokerage_membership, :admin, user: @admin, brokerage: @brokerage)

    @test_board = create(:real_estate_board, :test_board)
    # Create estates for the test board (no BrokerageEstate rows yet)
    @estates = 3.times.map { create(:estate, real_estate_board: @test_board) }
  end

  # BOARD-04: test board skips RETS validation
  test "connecting to test board with no credentials succeeds" do
    post "/v1/admin/board_credentials",
      params: { board_credential: { real_estate_board_id: @test_board.id, rets_username: "", rets_password: "" } },
      headers: auth_headers_for(@admin, @brokerage)
    assert_response :created
  end

  # BOARD-03: BrokerageEstate rows created for all board estates
  test "connecting to test board creates BrokerageEstate rows for all board estates" do
    assert_difference "BrokerageEstate.count", @estates.length do
      post "/v1/admin/board_credentials",
        params: { board_credential: { real_estate_board_id: @test_board.id, rets_username: "", rets_password: "" } },
        headers: auth_headers_for(@admin, @brokerage)
    end
    assert_response :created
    @estates.each do |estate|
      assert BrokerageEstate.exists?(brokerage_id: @brokerage.id, estate_id: estate.id)
    end
  end

  # Re-connect idempotency
  test "connecting to same board twice does not duplicate BrokerageEstate rows" do
    2.times do
      post "/v1/admin/board_credentials",
        params: { board_credential: { real_estate_board_id: @test_board.id, rets_username: "", rets_password: "" } },
        headers: auth_headers_for(@admin, @brokerage)
    end
    assert_equal @estates.length, BrokerageEstate.where(brokerage_id: @brokerage.id).count
  end
end
```

---

## File-by-File Change Summary

| File | Action | What Changes |
|------|--------|-------------|
| `app/controllers/v1/admin/board_credentials_controller.rb` | MODIFY | Remove `.real_boards` from board lookup; add `board.is_test_board?` to RETS bypass guard; add bulk `BrokerageEstate.insert_all` after credential save |
| `app/controllers/v1/admin/boards_controller.rb` | MODIFY | Remove `.real_boards` scope from index — TEST board must appear in dropdown for Phase 13 |
| `app/models/brokerage_board_credential.rb` | MODIFY | Add `unless: -> { real_estate_board&.is_test_board? }` to `rets_username` and `rets_password` validations |
| `app/models/estate.rb` | MODIFY | Restructure `accessible_by` scope: move `real_boards` filter into the `bbc` EXISTS subquery; remove outer `joins+merge`; `BrokerageEstate` EXISTS branch becomes board-type-agnostic |
| `test/factories/real_estate_boards.rb` | CREATE | FactoryBot factory with `:test_board` trait |
| `test/integration/board_connect_flow_test.rb` | CREATE | BOARD-03 and BOARD-04 integration tests |

---

## Open Questions

1. **Should `boards_controller.rb` show test boards even before a credential exists?**
   - What we know: Phase 13 (frontend) needs the connect dialog to list the TEST board. `BoardsController#index` currently uses `.real_boards` scope — TEST board is invisible.
   - What's unclear: Should both real and test boards be shown, or only real boards with test boards appended separately?
   - Recommendation: Remove `.real_boards` scope from `BoardsController#index` in Phase 12. Both board types returned in the same collection; the frontend can use `is_test_board` to differentiate. This is a one-line backend change that unblocks Phase 13.

2. **Does `accessible_by` scope change need to guard against estates with no `real_estate_board`?**
   - What we know: `real_estate_board_id` is nullable on `estates` (schema: `t.bigint "real_estate_board_id"` — no `null: false`). An estate with `real_estate_board_id: nil` would fail the first EXISTS subquery's `WHERE reb.id = estates.real_estate_board_id` JOIN.
   - What's unclear: Can an estate with `real_estate_board_id: nil` also have a `BrokerageEstate` row? If so, the second EXISTS still returns it — correct behavior.
   - Recommendation: No change needed. The second EXISTS covers the nil-board-id case correctly because it only checks `be.estate_id = estates.id`.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — phase is backend code changes only; no new CLIs, services, or runtimes required). PostgreSQL is already running; no new tables or migrations are needed.

---

## Validation Architecture

Step 4: SKIPPED — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`. [VERIFIED: .planning/config.json]

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | CognitoAuth — no change |
| V3 Session Management | no | — |
| V4 Access Control | yes | Admin-only endpoint; `require_admin!` guard in `BaseController` unchanged — no bypass introduced |
| V5 Input Validation | yes | `real_estate_board_id` is resolved via `find_by` after auth — no injection risk; `insert_all` uses parameterized values |
| V6 Cryptography | yes | `encrypts :rets_username`/`rets_password` still applied — for test boards with nil/empty values, AR encryption stores nil ciphertext |

**Security note on empty credential encryption:** When `rets_username` and `rets_password` are nil/empty for a test board credential, `attr_encrypted` / `ActiveRecord::Encryption` stores a null or empty ciphertext column. This is safe — the fields are never read for test boards, and no real credentials are involved. [ASSUMED — encryption behavior with nil values not directly verified in this session; behavior is consistent with Active Record Encryption documentation]

**Tenant isolation:** The bulk `BrokerageEstate.insert_all` uses `Current.brokerage.id` — scoped to the authenticated brokerage. Cross-tenant insertion is structurally impossible given the auth middleware resolves `Current.brokerage` from the request host before the controller runs. [VERIFIED: codebase — BrokerageAuth concern, CognitoAuth concern]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Rails insert_all` on PostgreSQL silently skips rows that violate a unique index (ON CONFLICT DO NOTHING semantics) | Bulk insert pattern | If wrong, re-connecting to a board raises `ActiveRecord::RecordNotUnique` instead of succeeding idempotently |
| A2 | `real_estate_board` association is loaded on the credential object when `unless: -> { real_estate_board&.is_test_board? }` runs in validation | Conditional validation | If the association is not loaded at validation time (e.g., only `real_estate_board_id` is set), `real_estate_board` returns nil and the safe navigator makes the condition false — validation would run even for test boards |
| A3 | `Active Record Encryption` stores nil/empty ciphertext without error when `rets_username`/`rets_password` are nil | Security domain | If AR Encryption raises on nil plaintext, test board credential saves will fail even after conditional validation passes — may need `credential.rets_username = nil` explicitly set or use a placeholder |
| A4 | The `accessible_by` scope change (moving `real_boards` filter into first EXISTS) does not break any existing queries for real boards | Scope restructure | If SQL semantics differ between `joins+merge` and an inline EXISTS JOIN, real board query results may change — needs verification via test |

**Note on A2:** In the controller, `credential = find_or_initialize_by(real_estate_board: board)` assigns the full object — so `real_estate_board` is loaded. The safe navigator is a safeguard for other callers (e.g., `BrokerageBoardCredential.new` without the association). [VERIFIED: codebase — controller lines 40-42]

**Note on A3:** The `unless` guard prevents validation from running. `credential.save` will succeed with nil username/password. AR Encryption behavior with nil values should be tested. If it errors, set `credential.rets_username = nil` explicitly (or assign `""`) before save. [ASSUMED]

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase — backend/app/controllers/v1/admin/board_credentials_controller.rb] — complete controller read; identified real_boards scope, dev-only RETS bypass, missing BrokerageEstate insert
- [VERIFIED: codebase — backend/app/models/brokerage_board_credential.rb] — presence validations confirmed unconditional
- [VERIFIED: codebase — backend/app/models/real_estate_board.rb] — `is_test_board?` predicate confirmed via boolean column; `real_boards`/`test_boards` scopes confirmed
- [VERIFIED: codebase — backend/app/models/estate.rb] — `accessible_by` scope reads `joins(:real_estate_board).merge(RealEstateBoard.real_boards)` confirmed
- [VERIFIED: codebase — backend/app/models/brokerage_estate.rb] — plain join model, no acts_as_paranoid, no callbacks
- [VERIFIED: codebase — backend/db/schema.rb] — `brokerage_estates` unique index on `(brokerage_id, estate_id)` confirmed; `real_estate_board_id` nullable on `estates` confirmed
- [VERIFIED: codebase — backend/app/controllers/v1/admin/group/estates_controller.rb] — `GroupEstate.insert_all(rows)` pattern confirmed as project standard
- [VERIFIED: codebase — backend/test/factories/] — no `real_estate_boards.rb` or `brokerage_board_credentials.rb` factory files exist
- [VERIFIED: codebase — backend/test/test_helper.rb] — `AuthHelper`, `FactoryBot::Syntax::Methods` integration test patterns confirmed
- [VERIFIED: codebase — .planning/config.json] — nyquist_validation: false
- [VERIFIED: codebase — CLAUDE.md] — acts_as_paranoid .without_deleted mandatory rule; insert_all/upsert_all patterns

---

## Metadata

**Confidence breakdown:**
- Controller changes (board lookup + RETS bypass): HIGH — code read line by line, changes are direct
- Model validation conditionals: HIGH — Rails `unless:` proc is established, association loading confirmed
- BrokerageEstate bulk insert: HIGH — `insert_all` pattern confirmed from GroupEstate controller
- `accessible_by` scope restructure: MEDIUM — SQL semantics change must be verified via test; A4 assumption
- Factory creation: HIGH — existing factory patterns are clear and simple

**Research date:** 2026-05-23
**Valid until:** 2026-06-23 (stable Rails stack, no external dependencies)
