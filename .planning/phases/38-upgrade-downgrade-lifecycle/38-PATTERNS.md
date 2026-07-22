# Phase 38: Upgrade & Downgrade Lifecycle - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 12 (create/modify)
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `backend/app/controllers/ops/plan_controller.rb` (extend) | controller | request-response | itself (existing freeze/unfreeze action) | exact — file already exists, extend in place |
| `backend/app/jobs/apply_plan_transition_job.rb` (new) | job | event-driven / batch | `backend/app/jobs/send_invitation_email_job.rb` | exact |
| `backend/app/services/test_board_purge_service.rb` (new) | service | batch (hard-delete cascade) | `backend/app/services/group_creation_service.rb` | role-match (class-method service, transaction) |
| `backend/db/migrate/*_add_suspended_at_to_brokerage_memberships.rb` (new) | migration | CRUD (schema) | `backend/db/migrate/20260503000001_add_welcomed_at_to_brokerage_memberships.rb` | exact |
| `backend/app/models/brokerage_board_credential.rb` (modify — enum) | model | CRUD | itself (existing `status` enum) + `backend/db/migrate/20260714000000_migrate_brokerage_plan_tiers.rb` (enum-relabel precedent) | exact |
| `backend/app/models/brokerage_membership.rb` (modify — `suspended_at`, `suspend!`/`restore!`) | model | CRUD | `backend/app/models/invitation.rb` (`revoked_at`/`revoked?` pattern) | exact |
| `backend/app/controllers/concerns/cognito_auth.rb` (modify — suspended check) | middleware | request-response | itself (existing membership-exists check, lines 22-27) | exact |
| `backend/app/controllers/v1/admin/board_credentials_controller.rb` (modify — `index` status filter) | controller | request-response | itself (existing `index` action) | exact |
| `backend/app/models/brokerage.rb` (modify — optional `last_downgraded_at` tracking, D-06) | model | CRUD | itself (existing `freeze_custom_domains!`/`unfreeze_custom_domains!`) | exact |
| `backend/test/integration/ops_plan_test.rb` (extend) | test | request-response | itself (existing freeze/unfreeze tests) | exact |
| `backend/test/models/brokerage_membership_test.rb` (new) | test | CRUD | `backend/test/models/brokerage_board_credential_test.rb`, `backend/test/models/brokerage_freeze_test.rb` | role-match |
| `backend/test/services/test_board_purge_service_test.rb` (new) | test | batch | `backend/test/services/dns_verifier_test.rb`, `backend/test/models/brokerage_freeze_test.rb` (setup/assert shape) | role-match |

## Pattern Assignments

### `backend/app/controllers/ops/plan_controller.rb` (controller, request-response)

**Analog:** itself — `backend/app/controllers/ops/plan_controller.rb` (full file, 40 lines)

**Full current implementation (extend this in place):**
```ruby
module Ops
  class PlanController < BaseController
    skip_before_action :verify_authenticity_token, raise: false
    before_action :set_brokerage

    # POST /ops/brokerages/:brokerage_id/plan
    # Params: { freeze: true|false }
    def update
      freeze = ActiveModel::Type::Boolean.new.cast(params[:freeze])
      if freeze
        @brokerage.freeze_custom_domains!
        DomainMailer.downgrade_notice(@brokerage).deliver_now!
        render json: {status: "frozen", brokerage_id: @brokerage.id}, status: :ok
      else
        @brokerage.unfreeze_custom_domains!
        render json: {status: "unfrozen", brokerage_id: @brokerage.id}, status: :ok
      end
    rescue ActiveRecord::RecordInvalid => e
      render json: {error: e.message, details: e.record.errors.full_messages}, status: :unprocessable_entity
    rescue => e
      render json: {error: e.message}, status: :unprocessable_entity
    end

    alias_method :create, :update

    private

    def set_brokerage
      @brokerage = Brokerage.without_deleted.find(params[:brokerage_id])
    rescue ActiveRecord::RecordNotFound
      render json: {error: "Brokerage not found"}, status: :not_found
    end
  end
end
```

**Auth pattern:** inherited from `Ops::BaseController` (`backend/app/controllers/ops/base_controller.rb`, full file):
```ruby
module Ops
  class BaseController < ActionController::Base
    layout "ops"
    http_basic_authenticate_with(
      name: ENV.fetch("OPS_USERNAME"),
      password: ENV.fetch("OPS_PASSWORD")
    )
    protect_from_forgery with: :exception
  end
end
```
No change needed here — D-01's "Ops-only internal endpoint" is already satisfied by `PlanController < BaseController`.

**Extension pattern (D-04, open question #2 in RESEARCH.md — recommended param shape):**
Per research's `Assumptions Log` A1/open question 2, replace the boolean `freeze:` param with an explicit target-plan param (`{plan: "growth"}`), diff against `@brokerage.plan` to derive `old_plan`/`new_plan`, and enqueue `ApplyPlanTransitionJob` instead of calling `freeze_custom_domains!` inline. Keep the same `rescue ActiveRecord::RecordInvalid` / generic `rescue =>` error-shape structure and the same `set_brokerage` private helper — this is the established error-handling contract for this controller and should not be reinvented.

**Error handling pattern (lines 24-27, reuse verbatim style):**
```ruby
rescue ActiveRecord::RecordInvalid => e
  render json: {error: e.message, details: e.record.errors.full_messages}, status: :unprocessable_entity
rescue => e
  render json: {error: e.message}, status: :unprocessable_entity
```

---

### `backend/app/jobs/apply_plan_transition_job.rb` (job, event-driven/batch)

**Analog:** `backend/app/jobs/send_invitation_email_job.rb` (full file, 15 lines)

```ruby
class SendInvitationEmailJob < ApplicationJob
  queue_as :default
  retry_on StandardError, wait: :polynomially_longer, attempts: 3
  discard_on ActiveRecord::RecordNotFound

  def perform(invitation_id)
    invitation = Invitation.find(invitation_id)
    mailer = invitation.group_id? ? InvitationMailer.invite_group(invitation) : InvitationMailer.invite_brokerage(invitation)
    mailer.deliver_now!
    invitation.update!(email_status: "sent", email_sent_at: Time.current)
  rescue
    invitation&.update!(email_status: "failed")
    raise
  end
end
```

**Base class:** `backend/app/jobs/application_job.rb` (full file — no custom hooks defined, `retry_on`/`discard_on` are declared per-job, not centrally):
```ruby
class ApplicationJob < ActiveJob::Base
  # retry_on ActiveRecord::Deadlocked
  # discard_on ActiveJob::DeserializationError
end
```

**Pattern to copy for `ApplyPlanTransitionJob`:**
- `queue_as :default`
- `retry_on StandardError, wait: :polynomially_longer, attempts: 3` (purge/freeze/suspend work should retry like email dispatch)
- `discard_on ActiveRecord::RecordNotFound` (brokerage may have been deleted between enqueue and perform)
- `perform(brokerage_id, old_plan, new_plan)` — look up the record fresh inside `perform` (`Brokerage.find(brokerage_id)`), never pass the AR object itself (matches `SendInvitationEmailJob`'s `Invitation.find(invitation_id)` — ActiveJob serializes args, GlobalID lookups can raise `RecordNotFound` on stale jobs, which `discard_on` handles)
- Dispatch to purge (`TestBoardPurgeService`) or freeze+suspend or restore logic based on `old_plan`/`new_plan` direction (see Architecture Diagram in RESEARCH.md)
- No `rescue` re-raise wrapper needed unless a status field needs updating on failure (unlike `Invitation#email_status`, `Brokerage` has no per-transition failure-status field in this phase's schema — confirm with planner before adding one)

---

### `backend/app/services/test_board_purge_service.rb` (service, batch/hard-delete)

**Analog:** `backend/app/services/group_creation_service.rb` (full file, 54 lines)

```ruby
class GroupCreationService
  def self.call!(brokerage:, creator:, params:)
    ActiveRecord::Base.transaction do
      group = brokerage.groups.create!(name: params[:name])
      group.user_groups.create!(user: creator)
      add_users(group, params[:users])
      create_invitations(group, params[:invitations])
      create_filter_sets(group, params[:filter_sets])
      group
    end
  end

  def self.add_users(group, users)
    Array(users).each { |u| group.user_groups.create!(user_id: u[:user_id]) }
  end
  # ... more self.xxx helper methods, each doing one traversal step
end
```

**Pattern to copy:** class-method service (`self.call!`), single `ApplicationRecord.transaction do ... end` wrapper, private-by-convention helper methods per traversal step (here: per child table). Mirror this shape for `TestBoardPurgeService.call!(brokerage:)`.

**Core traversal pattern — copy directly from RESEARCH.md's verified Pattern 2** (source associations verified this session in `group_estate.rb`, `estate_comment.rb`, `subcomment.rb`):
```ruby
test_board_ids = RealEstateBoard.test_boards.pluck(:id)
estate_ids = Estate.without_deleted.where(real_estate_board_id: test_board_ids).pluck(:id)

# BrokerageEstate: plain join table, no children, no acts_as_paranoid — delete_all is safe as-is
BrokerageEstate.where(brokerage_id: brokerage.id, estate_id: estate_ids).delete_all

group_ids = brokerage.groups.pluck(:id)
GroupEstate.without_deleted
  .where(group_id: group_ids, estate_id: estate_ids)
  .find_each { |ge| ge.really_destroy! }  # cascades via dependent: :destroy — see GroupEstate below
```

**Why `really_destroy!` not `delete_all`/`destroy_all`:** `GroupEstate` (`backend/app/models/group_estate.rb`, full file) declares:
```ruby
class GroupEstate < ApplicationRecord
  acts_as_paranoid
  has_many :estate_ratings, dependent: :destroy
  has_many :estate_comments, dependent: :destroy
  has_many :estate_documents, dependent: :destroy
  has_many :estate_dates, dependent: :destroy
  has_many :estate_likes, dependent: :destroy
  has_many :estate_rejections, dependent: :destroy
  has_many :estate_tags, dependent: :destroy
end
```
`acts_as_paranoid` overrides `destroy`/`destroy_all` to be a *soft* delete — `really_destroy!` (paranoia gem) is required per row to get a true hard delete while still firing the `dependent: :destroy` Ruby callbacks (needed because `subcomments → estate_comments` and `estate_date_rsvps/estate_date_calendar_events → estate_dates` lack DB-level `ON DELETE CASCADE` — see RESEARCH.md Pitfall 1).

**Board scope source:** `backend/app/models/real_estate_board.rb` (full file, 13 lines) — `scope :test_boards, -> { where(is_test_board: true) }` / `scope :real_boards, -> { where(is_test_board: false) }` already exist, use directly.

---

### `backend/db/migrate/*_add_suspended_at_to_brokerage_memberships.rb` (migration)

**Analog:** `backend/db/migrate/20260503000001_add_welcomed_at_to_brokerage_memberships.rb` (full file, 7 lines)

```ruby
class AddWelcomedAtToBrokerageMemberships < ActiveRecord::Migration[7.1]
  def change
    add_column :brokerage_memberships, :welcomed_at, :datetime
    add_column :brokerage_memberships, :deleted_at, :datetime
    add_index :brokerage_memberships, :deleted_at
  end
end
```

**Pattern to copy:** plain `add_column` + `add_index` in a `change` block (reversible, no `up`/`down` needed for a simple additive column). CognitoAuth will check `suspended_at` on every authenticated request (per D-09/Pattern 3 below) — add an index:
```ruby
class AddSuspendedAtToBrokerageMemberships < ActiveRecord::Migration[7.1]
  def change
    add_column :brokerage_memberships, :suspended_at, :datetime
    add_index :brokerage_memberships, :suspended_at
  end
end
```

**If D-06's tracking mechanism uses a `brokerages.plan_downgraded_at` column** (see Shared Patterns below), use the same `add_column`/`change` shape on a separate migration file against `brokerages`.

**No migration needed for `BrokerageBoardCredential#status`** — it's `t.string "status", default: "active", null: false` (schema.rb), no DB CHECK constraint, confirmed via `20260521000001_add_is_test_board_to_real_estate_boards.rb`-style precedent (plain string/boolean columns). Adding `suspended` is a Ruby-level `enum` declaration only.

---

### `backend/app/models/brokerage_board_credential.rb` (model, CRUD)

**Analog:** itself (full file, 38 lines) — extend the existing enum in place, no other pattern needed.

```ruby
class BrokerageBoardCredential < ApplicationRecord
  acts_as_paranoid
  belongs_to :brokerage
  belongs_to :real_estate_board
  # ... AR Encryption accessors unchanged ...
  enum :status, {active: "active", invalid: "invalid"}, prefix: :credential
  validates :rets_username, presence: true, unless: -> { real_estate_board&.is_test_board? }
  validates :rets_password, presence: true, unless: -> { real_estate_board&.is_test_board? }
  validates :brokerage_id, uniqueness: {scope: :real_estate_board_id, message: "is already registered with this board"}
end
```

**Change:** `enum :status, {active: "active", invalid: "invalid", suspended: "suspended"}, prefix: :credential` — generates `credential_suspended?`, `credential_suspended!`, `credential_suspended` scope automatically (Rails enum convention already used here via `prefix: :credential`, matching `credential_active?`/`status_active?`-style predicates used elsewhere in this codebase, e.g. `BrokerageDomain#status_frozen?` seen in `brokerage_freeze_test.rb`).

**No change needed:** `backend/app/models/estate.rb:19-44` `Estate.accessible_by`'s `bbc.status = 'active'` literal string comparison already excludes `suspended` — confirmed in RESEARCH.md Code Examples, zero-diff item.

---

### `backend/app/models/brokerage_membership.rb` (model, CRUD)

**Analog:** `backend/app/models/invitation.rb` (full file, 46 lines) — the `revoked_at`/`revoked?` timestamp-flag pattern to mirror.

```ruby
class Invitation < ApplicationRecord
  # ...
  def revoked?
    revoked_at.present?
  end
  # ...
end
```

**Current state of file to extend (full file, 6 lines):**
```ruby
class BrokerageMembership < ApplicationRecord
  acts_as_paranoid
  belongs_to :user
  belongs_to :brokerage
end
```

**Pattern to add (mirrors `Invitation#revoked?` exactly per D-08):**
```ruby
class BrokerageMembership < ApplicationRecord
  acts_as_paranoid
  belongs_to :user
  belongs_to :brokerage

  def suspended?
    suspended_at.present?
  end

  def suspend!(at: Time.current)
    update!(suspended_at: at)
  end

  def restore!
    update!(suspended_at: nil)
  end
end
```
Note `Invitation` does not have a `revoke!`/`restore!` mutator method (only the `revoked?` predicate) — `suspend!`/`restore!` are new but follow the same "single timestamp column, presence = state" idiom, not a novel design.

---

### `backend/app/controllers/concerns/cognito_auth.rb` (middleware, request-response)

**Analog:** itself (full file, 43 lines) — extend the existing membership-check block in place.

**Current membership-existence check (lines 22-27, exact location to extend):**
```ruby
if Current.brokerage.present? && !skip_brokerage_membership?
  unless BrokerageMembership.without_deleted.exists?(user_id: Current.user.id, brokerage_id: Current.brokerage.id)
    render json: {error: "You are not a member of this brokerage", next_step: "no-access"}, status: :forbidden
    return
  end
end
```

**Extension pattern (D-09) — copy this exact shape immediately after, per RESEARCH.md Pattern 3 (verified against real file structure this session):**
```ruby
if Current.brokerage.present? && !skip_brokerage_membership?
  membership = BrokerageMembership.without_deleted
    .find_by(user_id: Current.user.id, brokerage_id: Current.brokerage.id)
  unless membership
    render json: {error: "You are not a member of this brokerage", next_step: "no-access"}, status: :forbidden
    return
  end
  if membership.suspended_at.present?
    render json: {error: "Your access has been suspended", next_step: "no-access"}, status: :forbidden
    return
  end
end
```
Note: switches from `.exists?` to `.find_by` since the membership row itself (not just its existence) is now needed to check `suspended_at`. Keep the same `render ... ; return` early-exit style used throughout this method (see `token` nil-check at lines 12-15, and the `rescue AuthenticationError, ActiveRecord::RecordNotFound` at line 28 — no change needed there).

---

### `backend/app/controllers/v1/admin/board_credentials_controller.rb` (controller, request-response)

**Analog:** itself, `index` action (lines 6-21 of the file)

**Current:**
```ruby
def index
  credentials = Current.brokerage
    .brokerage_board_credentials
    .without_deleted
    .includes(:real_estate_board)
    .order(:created_at)
  render json: { board_credentials: ActiveModelSerializers::SerializableResource.new(
    credentials, each_serializer: BrokerageBoardCredentialSerializer, adapter: :attributes
  ).as_json }
end
```

**Extension pattern (D-07 — exclude suspended from member-visible list):** add `.where.not(status: "suspended")` (or `.merge(BrokerageBoardCredential.where.not(credential_suspended: true))` using the new enum scope) to the existing chain, same style as the `.without_deleted.includes(...).order(...)` chain already there. This is the only change needed in this controller — `create`/`update`/`destroy` are untouched by this phase.

---

## Shared Patterns

### Ops-only auth (D-01)
**Source:** `backend/app/controllers/ops/base_controller.rb` (full file)
**Apply to:** `Ops::PlanController` — no change, already inherited.
```ruby
http_basic_authenticate_with(name: ENV.fetch("OPS_USERNAME"), password: ENV.fetch("OPS_PASSWORD"))
```

### Timestamp-flag revocable/suspendable state
**Source:** `backend/app/models/invitation.rb:38-40` (`revoked_at`/`revoked?`)
**Apply to:** `BrokerageMembership#suspended_at`/`suspended?` (D-08), and — per D-05/D-06 — `BrokerageBoardCredential`'s new `suspended_at` companion column (needed alongside the `status` enum flip to support D-06's "restore only this downgrade's suspensions" scoping; the enum alone cannot carry a timestamp).

### D-06 "restore only this downgrade" scoping
**Source:** RESEARCH.md Architecture Patterns Pattern 1 (no direct codebase analog exists yet — this is new logic, but the *shape* mirrors `Invitation#valid_invitation?`'s multi-condition boolean check style: `!accepted? && !expired? && !revoked?`)
**Apply to:** `ApplyPlanTransitionJob`'s restore branch and (if chosen) a new `brokerages.plan_downgraded_at` column, OR derive via `MAX(suspended_at)` across `brokerage_board_credentials`/`brokerage_memberships` at restore time — planner's call per CONTEXT.md D-06 discretion. If a column is added, use the same migration shape as `AddWelcomedAtToBrokerageMemberships` above, targeting `brokerages`.

### Background job shape
**Source:** `backend/app/jobs/send_invitation_email_job.rb` + `backend/app/jobs/application_job.rb`
**Apply to:** `ApplyPlanTransitionJob` — `queue_as :default`, `retry_on StandardError, wait: :polynomially_longer, attempts: 3`, `discard_on ActiveRecord::RecordNotFound`, look up records fresh by id inside `perform`.

### Service-object transaction shape
**Source:** `backend/app/services/group_creation_service.rb`
**Apply to:** `TestBoardPurgeService` — `self.call!(...)` class method, single `ActiveRecord::Base.transaction do ... end` (note: purge's `really_destroy!` calls should NOT all be wrapped in one giant transaction if volume is a concern — see RESEARCH.md Pattern 2 caveat; `GroupCreationService`'s single-transaction shape is appropriate for the smaller `BrokerageEstate.delete_all` step but the `find_each { really_destroy! }` loop may be left outside the transaction or chunked, per Claude's Discretion in CONTEXT.md).

### Controller error-handling contract
**Source:** `backend/app/controllers/ops/plan_controller.rb:24-27`
**Apply to:** Extended `Ops::PlanController#update` — keep the same `rescue ActiveRecord::RecordInvalid` (422 with `details`) then generic `rescue =>` (422 with plain message) two-tier structure; do not introduce a different error shape for the new plan-flip logic.

## No Analog Found

None — every file in this phase's scope has a strong, directly analogous existing pattern in the codebase (consistent with RESEARCH.md's own conclusion: "Nothing in this phase needs a new library or a novel pattern").

The only genuinely new *logic* (not pattern) is D-06's downgrade-event-scoped restore query — flagged above under Shared Patterns since it has no direct 1:1 analog, though its multi-condition-boolean style still follows `Invitation#valid_invitation?`'s established idiom.

## Metadata

**Analog search scope:** `backend/app/controllers/ops/`, `backend/app/controllers/concerns/`, `backend/app/controllers/v1/admin/`, `backend/app/models/`, `backend/app/jobs/`, `backend/app/services/`, `backend/db/migrate/`, `backend/test/{integration,models,services,factories}/`
**Files scanned:** ~35 (directory listings + 17 files read in full or targeted)
**Pattern extraction date:** 2026-07-21
