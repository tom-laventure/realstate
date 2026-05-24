# Phase 12: Board Connect Flow — Backend - Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 6 (4 modified, 2 created)
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/controllers/v1/admin/board_credentials_controller.rb` | controller | request-response (CRUD create) | itself — current state read directly | exact (self-modification) |
| `backend/app/controllers/v1/admin/boards_controller.rb` | controller | request-response (index) | itself — current state read directly | exact (self-modification) |
| `backend/app/models/brokerage_board_credential.rb` | model | CRUD | itself — current state read directly | exact (self-modification) |
| `backend/app/models/estate.rb` | model | CRUD (scope) | itself — current state read directly | exact (self-modification) |
| `backend/test/factories/real_estate_boards.rb` | factory | — | `test/factories/brokerage_memberships.rb` (trait pattern) | role-match |
| `backend/test/integration/board_connect_flow_test.rb` | test | request-response | `test/integration/admin_authorization_test.rb` | exact |

---

## Pattern Assignments

### `backend/app/controllers/v1/admin/board_credentials_controller.rb` (controller, request-response)

**Analog:** itself (`board_credentials_controller.rb`) — modify in-place

**Current create action** (lines 22–68) — full file is 68 lines, read in one pass:
```ruby
# POST /v1/admin/board_credentials
def create
  board = RealEstateBoard.active.real_boards.find_by(id: board_credential_params[:real_estate_board_id])
  return render json: {error: "Board not found"}, status: :not_found unless board

  username = board_credential_params[:rets_username]
  password = board_credential_params[:rets_password]

  result = if Rails.env.development?
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

**Three targeted changes to make:**

**Change 1 — Board lookup (line 24):** Remove `.real_boards` from the scope:
```ruby
# Before (line 24):
board = RealEstateBoard.active.real_boards.find_by(id: board_credential_params[:real_estate_board_id])

# After:
board = RealEstateBoard.active.find_by(id: board_credential_params[:real_estate_board_id])
```

**Change 2 — RETS bypass guard (lines 30–34):** Add `board.is_test_board?` condition:
```ruby
# Before (lines 30–34):
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

**Change 3 — Bulk BrokerageEstate insert (after line 48 `if credential.save`):** Insert block after credential saves:
```ruby
# Copy insert_all pattern from group/estates_controller.rb lines 139–143
# Insert immediately after `if credential.save`, before the render:
estate_ids = board.estates.without_deleted.pluck(:id)
if estate_ids.any?
  now = Time.current
  rows = estate_ids.map do |eid|
    {brokerage_id: Current.brokerage.id, estate_id: eid, created_at: now, updated_at: now}
  end
  BrokerageEstate.insert_all(rows, unique_by: [:brokerage_id, :estate_id])
end
```

**insert_all analog** (source: `group/estates_controller.rb` lines 138–143):
```ruby
if truly_new_ids.any?
  now  = Time.current
  rows = truly_new_ids.map do |eid|
    {group_id: group.id, estate_id: eid, added_by_user_id: Current.user.id, created_at: now, updated_at: now}
  end
  GroupEstate.insert_all(rows)
end
```

**Key differences from analog:** Use `unique_by: [:brokerage_id, :estate_id]` (explicit ON CONFLICT DO NOTHING via the composite unique index); omit `added_by_user_id` (BrokerageEstate has no such column); use `board.estates.without_deleted` not a pre-filtered ID list.

---

### `backend/app/controllers/v1/admin/boards_controller.rb` (controller, request-response)

**Analog:** itself — one-line change

**Current index action** (line 7):
```ruby
boards = RealEstateBoard.active.real_boards.order(:name)
```

**After:**
```ruby
boards = RealEstateBoard.active.order(:name)
```

No other changes. Response shape, serializer, and adapter are unchanged.

---

### `backend/app/models/brokerage_board_credential.rb` (model, CRUD)

**Analog:** itself — modify validations in-place

**Current validations** (lines 12–13):
```ruby
validates :rets_username, presence: true
validates :rets_password, presence: true
```

**After (add `unless:` proc to both):**
```ruby
validates :rets_username, presence: true, unless: -> { real_estate_board&.is_test_board? }
validates :rets_password, presence: true, unless: -> { real_estate_board&.is_test_board? }
```

**Why safe navigator (`&.`):** `belongs_to :real_estate_board` is always assigned via `find_or_initialize_by(real_estate_board: board)` in the controller before save, so it is loaded. The `&.` guards against edge cases like `BrokerageBoardCredential.new` without the association in other callers or test setups.

**Full model for reference** (all 18 lines):
```ruby
class BrokerageBoardCredential < ApplicationRecord
  acts_as_paranoid

  belongs_to :brokerage
  belongs_to :real_estate_board

  encrypts :rets_username
  encrypts :rets_password

  enum :status, {active: "active", invalid: "invalid"}, prefix: :credential

  validates :rets_username, presence: true
  validates :rets_password, presence: true
  validates :brokerage_id, uniqueness: {
    scope: :real_estate_board_id,
    message: "is already registered with this board"
  }
end
```

---

### `backend/app/models/estate.rb` (model, scope modification)

**Analog:** itself — rewrite `accessible_by` scope only

**Current scope** (lines 19–38):
```ruby
scope :accessible_by, ->(brokerage) {
  brokerage_id = brokerage.is_a?(Integer) ? brokerage : brokerage.id

  joins(:real_estate_board).merge(RealEstateBoard.real_boards).where(
    <<~SQL,
      EXISTS (
        SELECT 1 FROM brokerage_board_credentials bbc
        WHERE bbc.brokerage_id = :brokerage_id
          AND bbc.real_estate_board_id = estates.real_estate_board_id
          AND bbc.status = 'active'
          AND bbc.deleted_at IS NULL
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

**After (restructure: move `real_boards` filter inside first EXISTS; remove outer joins+merge):**
```ruby
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

**What changed and why:**
- `joins(:real_estate_board).merge(RealEstateBoard.real_boards)` removed — this outer JOIN filtered out test board estates before the EXISTS checks could run.
- First EXISTS now does its own JOIN into `real_estate_boards` with `AND reb.is_test_board = false` — real board protection preserved.
- Second EXISTS (BrokerageEstate path) is now board-type-agnostic — any estate with a `BrokerageEstate` row is accessible regardless of board type.
- `brokerage_id` interpolation variable and safe integer coercion (`brokerage.is_a?(Integer) ? brokerage : brokerage.id`) are unchanged from the original.

---

### `backend/test/factories/real_estate_boards.rb` (factory, new file)

**Analog:** `test/factories/brokerage_memberships.rb` — traits pattern; `test/factories/groups.rb` — sequence with boolean field

**Pattern: sequence fields + boolean field + named trait** (from `brokerage_memberships.rb` lines 1–23 and `groups.rb` lines 1–8):
```ruby
# brokerage_memberships.rb — trait pattern
FactoryBot.define do
  factory :brokerage_membership do
    user
    brokerage
    role { "agent" }

    trait :admin do
      role { "admin" }
    end
  end
end

# groups.rb — sequence + boolean pattern
FactoryBot.define do
  factory :group do
    brokerage
    sequence(:name) { |n| "Group #{n}" }
    active { true }
  end
end
```

**New factory to create:**
```ruby
# test/factories/real_estate_boards.rb
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

**Also needed — `brokerage_board_credentials.rb` factory** (for completeness / future test phases):
```ruby
# test/factories/brokerage_board_credentials.rb
FactoryBot.define do
  factory :brokerage_board_credential do
    brokerage
    real_estate_board
    rets_username { "test_user" }
    rets_password { "test_pass" }
    status { "active" }
    last_verified_at { Time.current }
  end
end
```

---

### `backend/test/integration/board_connect_flow_test.rb` (integration test, new file)

**Analog:** `test/integration/admin_authorization_test.rb` — exact structural match

**Setup pattern** (from `admin_authorization_test.rb` lines 3–17):
```ruby
class AdminAuthorizationTest < ActionDispatch::IntegrationTest
  setup do
    @brokerage = create(:brokerage)
    create(:brokerage_domain, brokerage: @brokerage, domain: "test.example.com")

    @admin = create(:user)
    create(:brokerage_membership, :admin, user: @admin, brokerage: @brokerage)
  end
end
```

**Request + assertion pattern** (from `admin_authorization_test.rb` lines 21–25):
```ruby
test "agent role receives 403 on GET /v1/admin/users" do
  get "/v1/admin/users", headers: auth_headers_for(@agent, @brokerage)
  assert_response :forbidden
  body = JSON.parse(response.body)
  assert_equal "forbidden", body.dig("error", "code")
end
```

**`assert_difference` pattern** (Rails built-in, also used in `group_estates_query_test.rb`):
```ruby
assert_difference "BrokerageEstate.count", 3 do
  post "/v1/admin/board_credentials", params: {...}, headers: auth_headers_for(@admin, @brokerage)
end
```

**New integration test to create:**
```ruby
# test/integration/board_connect_flow_test.rb
require "test_helper"

class BoardConnectFlowTest < ActionDispatch::IntegrationTest
  setup do
    @brokerage = create(:brokerage)
    create(:brokerage_domain, brokerage: @brokerage, domain: "test.example.com")
    @admin = create(:user)
    create(:brokerage_membership, :admin, user: @admin, brokerage: @brokerage)

    @test_board = create(:real_estate_board, :test_board)
    @estates = 3.times.map { create(:estate, real_estate_board: @test_board) }
  end

  # BOARD-04: test board skips RETS validation
  test "connecting to test board with no credentials succeeds" do
    post "/v1/admin/board_credentials",
      params: {board_credential: {real_estate_board_id: @test_board.id, rets_username: "", rets_password: ""}},
      headers: auth_headers_for(@admin, @brokerage)
    assert_response :created
  end

  # BOARD-03: BrokerageEstate rows created for all board estates
  test "connecting to test board creates BrokerageEstate rows for all board estates" do
    assert_difference "BrokerageEstate.count", @estates.length do
      post "/v1/admin/board_credentials",
        params: {board_credential: {real_estate_board_id: @test_board.id, rets_username: "", rets_password: ""}},
        headers: auth_headers_for(@admin, @brokerage)
    end
    assert_response :created
    @estates.each do |estate|
      assert BrokerageEstate.exists?(brokerage_id: @brokerage.id, estate_id: estate.id)
    end
  end

  # Re-connect idempotency — insert_all unique_by silently skips duplicates
  test "connecting to same board twice does not duplicate BrokerageEstate rows" do
    2.times do
      post "/v1/admin/board_credentials",
        params: {board_credential: {real_estate_board_id: @test_board.id, rets_username: "", rets_password: ""}},
        headers: auth_headers_for(@admin, @brokerage)
    end
    assert_equal @estates.length, BrokerageEstate.where(brokerage_id: @brokerage.id).count
  end
end
```

---

## Shared Patterns

### Multi-Tenancy Scoping
**Source:** `board_credentials_controller.rb` lines 7–11 (index) and lines 40–42 (create)
**Apply to:** All writes in `board_credentials_controller.rb`
```ruby
# Always scope to Current.brokerage — never raw model queries
Current.brokerage.brokerage_board_credentials.without_deleted.find_or_initialize_by(real_estate_board: board)
Current.brokerage.id  # used as brokerage_id in insert_all rows
```

### Soft Delete Guard
**Source:** `board_credentials_controller.rb` line 9 and 40; `group/estates_controller.rb` line 118
**Apply to:** Any query touching `Estate` (acts_as_paranoid) — `board.estates.without_deleted.pluck(:id)`
```ruby
# Mandatory — Estate uses acts_as_paranoid; omitting .without_deleted includes deleted records
board.estates.without_deleted.pluck(:id)
```

### insert_all Bulk Insert
**Source:** `group/estates_controller.rb` lines 138–143
**Apply to:** `board_credentials_controller.rb` create action, BrokerageEstate rows
```ruby
now  = Time.current
rows = ids.map do |eid|
  {brokerage_id: Current.brokerage.id, estate_id: eid, created_at: now, updated_at: now}
end
BrokerageEstate.insert_all(rows, unique_by: [:brokerage_id, :estate_id])
```
Note: `unique_by:` is required here (not needed in GroupEstate analog because GroupEstate allows multiple rows per estate across groups). The unique index `index_brokerage_estates_on_brokerage_id_and_estate_id` enforces idempotency.

### Serializer Response Shape
**Source:** `board_credentials_controller.rb` lines 49–55
**Apply to:** `board_credentials_controller.rb` create response — no change needed
```ruby
render json: {
  board_credential: ActiveModelSerializers::SerializableResource.new(
    credential,
    serializer: BrokerageBoardCredentialSerializer,
    adapter: :attributes
  ).as_json
}, status: :created
```

### Integration Test Auth Headers
**Source:** `test_helper.rb` lines 22–36 (`AuthHelper#auth_headers_for`)
**Apply to:** All integration test requests
```ruby
# auth_headers_for(user, brokerage) returns:
# { "Authorization" => "Bearer #{token}", "Host" => brokerage.brokerage_domains.first.domain }
# Brokerage must have a brokerage_domain record — always create one in setup
create(:brokerage_domain, brokerage: @brokerage, domain: "test.example.com")
```

---

## No Analog Found

None. All 6 files have clear analogs or are self-modifications of existing files.

---

## Metadata

**Analog search scope:** `backend/app/controllers/v1/admin/`, `backend/app/models/`, `backend/test/integration/`, `backend/test/factories/`
**Files read:** 14
**Pattern extraction date:** 2026-05-23
