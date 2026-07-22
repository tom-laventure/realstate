# Phase 38: Upgrade & Downgrade Lifecycle - Research

**Researched:** 2026-07-21
**Domain:** Rails 7.1 backend — plan-transition side-effect orchestration (data purge, freeze/restore, membership suspend/restore), background jobs, multi-tenant auth enforcement
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Plan-change trigger & authorization**
- **D-01:** The trigger is an Ops-only internal endpoint, extending the existing `Ops::PlanController` (which today only does domain freeze/unfreeze via `freeze_custom_domains!`/`unfreeze_custom_domains!`). No self-serve admin/billing UI is built in this phase — consistent with BILL-01 being deferred and no payment processor existing yet.
- **D-02:** The purge/freeze/suspend side-effect cascade runs as a background job (mirrors the existing `SendInvitationEmailJob` pattern), not synchronously in the request. `PLAN-14`'s purge in particular traverses `Group → GroupEstate → {comments, ratings, likes, documents, RSVPs}` and could touch many rows.
- **D-03:** No explicit confirmation/dry-run step before a downgrade executes — it runs immediately once Ops triggers it, matching `freeze_custom_domains!`'s existing no-confirmation behavior today.
- **D-04:** All plan-transition orchestration (the actual `brokerage.plan` flip plus triggering PLAN-14/15/16/17/18 side effects) lives in `Ops::PlanController`, alongside the existing freeze/unfreeze actions — one home for all plan-transition logic, not split across a new controller.

**Board-credential suspend state (PLAN-16, PLAN-18)**
- **D-05:** `BrokerageBoardCredential#status` gets a new enum value `suspended`, alongside the existing `active`/`invalid`. This fits the existing enum shape directly — no new column needed. `Estate.accessible_by`'s existing `bbc.status = 'active'` check requires no change (suspended already fails it).
- **D-06:** Re-upgrade (PLAN-18) restores only the credentials suspended by that specific most-recent downgrade event — not blindly every currently-suspended credential. This avoids incorrectly reactivating a credential that was already `invalid` before the downgrade happened. Planner must determine the exact tracking mechanism (e.g., a `suspended_at` timestamp set once per downgrade, or an explicit "downgrade event" join) to distinguish "suspended by this downgrade" from "was already broken."
- **D-07:** Suspended real-board credentials are fully invisible in the board-connect UI while suspended — same as if they never existed (matches PLAN-16's literal wording: "excluded from member-visible board lists," "board-connect UI reverts to Free-tier behavior"). No distinct "suspended, will restore" indicator is built this phase.

**Client-membership suspend semantics (PLAN-17, PLAN-18)**
- **D-08:** New `suspended_at` timestamp column on `BrokerageMembership` — mirrors the `Invitation#revoked_at` pattern already established in this codebase. The membership row (role, associations, history) stays fully intact; only `suspended_at` is set/cleared.
- **D-09:** A suspended client is blocked at the brokerage-auth layer (`BrokerageAuth`/`CognitoAuth` — planner to determine exact enforcement point) — the request is rejected outright for a suspended membership, not just hidden from group/listing-scoped queries. Single enforcement point, consistent with how `acts_as_paranoid`'s `without_deleted` already gates at the query layer for soft-deleted records.
- **D-10 (schema correction — supersedes an initial framing during discussion):** The "client" role lives directly on `BrokerageMembership.role` (confirmed via `backend/app/controllers/v1/admin/users_controller.rb:21,38` — `where.not(brokerage_memberships: {role: "client"})`), NOT on `user_groups`. `.planning/ROLES.md`'s line "clients are never brokerage members" has drifted from the actual code (the doc itself warns file:line pointers are "last known location," not guaranteed current — this is a live example of that drift). PLAN-17's suspend therefore applies to: every `BrokerageMembership` row with `role: "client"` for that brokerage, set via `suspended_at`. Planner and researcher should verify this against current code rather than trusting ROLES.md's client-role description at face value.

**PLAN-14 purge scope & idempotency**
- **D-11:** Purge is a hard delete, not soft-delete — TEST-board-linked `BrokerageEstate` rows and their attached `GroupEstate`-scoped comments/ratings/likes/documents/RSVPs are genuinely disposable demo data by design. This is a deliberate exception to the repo's general `acts_as_paranoid` convention (CLAUDE.md), justified because there's no business reason to keep Free-tier trial demo data recoverable, and it avoids leaving orphaned soft-deleted rows that every future query must keep filtering out.
- **D-12:** No explicit idempotency guard beyond the purge query's natural idempotency (deleting zero matching rows on a re-run is fine) — no processed-flag or lock needed, as long as the job isn't double-enqueued concurrently (standard job-queue concern, not specific to this phase).
- **D-13:** Purge is silent — no warning or notice to the brokerage owner before their TEST-board demo data is deleted on upgrade. This is the requirement's own wording in REQUIREMENTS.md ("automatically and silently purges"), not a new decision — confirmed here so planning doesn't second-guess it.

### Claude's Discretion
- Exact traversal/query shape for PLAN-14's purge (whether it's one big transaction, chunked deletes, or a service object walking `Group → GroupEstate → child tables`) — direction is locked (hard delete, silent, no idempotency guard needed), mechanics are not.
- Exact mechanism for D-06's "suspended by this downgrade" tracking (timestamp vs. join record) — direction locked (restore only this downgrade's suspensions), shape is planner's call.
- Exact enforcement point for D-09's brokerage-auth block (which concern/controller layer rejects the request) — direction locked (blocked entirely, not query-scoped), exact code location is planner's call.
- Background job framework/pattern to reuse for D-02 (matching `SendInvitationEmailJob`'s existing setup) — no new decision needed, just follow precedent.

### Deferred Ideas (OUT OF SCOPE)
- None new this discussion — all four gray areas resolved within phase scope.
- Reviewed but not folded: "Rethink listing access model — BrokerageEstate vs board credential JOIN" (`arch-brokerage-listing-access.md`) — surfaced again as a Phase 38 match, but it's a query-layer scale refactor orthogonal to which data gets purged/frozen/restored on a plan transition (same call made in Phases 36 and 37). Phase 38 purges/restores correctly through the existing indirect `Estate → RealEstateBoard` join without needing a direct FK.

### Canonical References (must read before implementing)
- `.planning/PLAN-TIERS.md` — full tier design rationale, pricing table, Key Decisions
- `.planning/REQUIREMENTS.md` — PLAN-14 through PLAN-18, verbatim wording for purge ("automatically and silently") and restore ("no manual re-entry")
- `.planning/ROADMAP.md` — Phase 38 success criteria and dependency chain (depends on Phase 36 + Phase 37)
- `.planning/ROLES.md` — role definitions; client-role section confirmed DRIFTED from actual code per D-10 — verify against `backend/app/controllers/v1/admin/users_controller.rb` and `brokerage_memberships` schema directly
- `.planning/phases/36-plan-configuration-tier-migration/36-CONTEXT.md` — prior phase's `plan_config` accessor and enum migration decisions
- `.planning/phases/37-free-tier-gating/37-CONTEXT.md` — prior phase's gating decisions — this phase's freeze/restore must agree with what that phase treats as "real" vs. "TEST" data
</user_constraints>

## Summary

Phase 38 wires four side-effect cascades into the existing `Ops::PlanController`: (1) hard-purge of TEST-board demo data on Free→paid upgrade, (2) domain freeze + board-credential soft-disconnect + client-membership suspend on paid→Free downgrade, and (3) restore of both on Free→paid re-upgrade. Every piece of scaffolding needed already exists in the codebase in a directly analogous form — `freeze_custom_domains!`/`unfreeze_custom_domains!` for the domain half, `Invitation#revoked_at` for the suspend-timestamp pattern, `SendInvitationEmailJob` for the async-job shape, and `BrokerageBoardCredential#status` enum for the credential-state half. No new architectural pattern is required; this phase is pure "extend existing shapes."

The single highest-risk area is PLAN-14's purge traversal. The five child tables named in the requirement (comments, ratings, likes, documents, RSVPs) hang off `GroupEstate`, not `Estate` directly, and their foreign-key cascade behavior is **inconsistent**: `estate_comments`, `estate_ratings`, `estate_likes`, `estate_documents`, `estate_dates`, `estate_tags`, and `estate_rejections` all have `ON DELETE CASCADE` from `group_estates`, but `subcomments → estate_comments` has **no** cascade (will raise a Postgres FK violation on a raw hard-delete if any purged comment has subcomments), and `estate_date_rsvps` / `estate_date_calendar_events` have **no FK constraint at all** to `estate_dates` (a raw `delete_all` cascade leaves them as silent orphans, never mentioned in requirement text but real garbage rows). The purge implementation must account for this explicitly — see Common Pitfalls and Code Examples below.

**Primary recommendation:** Extend `Ops::PlanController` with a single plan-transition action that flips `brokerage.plan` and enqueues one background job (`ApplyPlanTransitionJob` or similar) that dispatches to purge/freeze/suspend or restore logic based on old→new plan direction, mirroring `SendInvitationEmailJob`'s minimal `perform(id)` + `retry_on`/`discard_on` shape. Purge child rows via model-level `really_destroy!` (which triggers Ruby `dependent: :destroy` callbacks, correctly cascading through the non-DB-cascaded `subcomments` and `estate_date_rsvps` associations) rather than raw `delete_all`, unless a chunked raw-SQL approach explicitly enumerates every child table by hand.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Plan-transition trigger (Ops endpoint) | API / Backend | — | `Ops::PlanController` already owns freeze/unfreeze; D-04 locks all plan-transition orchestration here |
| TEST-board data purge (PLAN-14) | API / Backend (background job) | Database / Storage | Pure data-layer cascade; no UI trigger exists this phase |
| Custom domain freeze/restore (PLAN-15) | Database / Storage | API / Backend | Already implemented as `Brokerage#freeze_custom_domains!`/`unfreeze_custom_domains!`; this phase only adds new callers |
| Board-credential soft-disconnect/restore (PLAN-16, PLAN-18) | Database / Storage | API / Backend | New `suspended` enum state on `BrokerageBoardCredential`; enforcement point is the existing `index` action + `Estate.accessible_by` (already correct, no change needed) |
| Client-membership suspend/restore (PLAN-17, PLAN-18) | API / Backend | Database / Storage | New `suspended_at` column; enforcement is at the `CognitoAuth` concern (request-rejection layer), not a query scope |
| Board-connect UI reverting to Free-tier behavior (PLAN-16) | Browser / Client | — | No new UI work — reuses Phase 37's existing TEST-only filtering once `plan_config.real_boards` flips to `false` and suspended credentials are excluded from the `index` response |

## Project Constraints (from CLAUDE.md)

- **Soft-delete convention:** All user-facing models use `acts_as_paranoid`; queries must scope with `.without_deleted`. **This phase deliberately violates this convention for the TEST-board purge (D-11)** — hard delete is correct there, a documented exception, not an oversight. All other new/touched code (board credentials, memberships) must continue to respect `.without_deleted`.
- **Query objects:** Complex filtering belongs in `app/queries/`, never in controllers. If PLAN-14's purge traversal grows non-trivial (it will), consider a service object (e.g. `app/services/test_board_purge_service.rb`) rather than inlining the traversal in the controller or job — consistent with the existing `GroupEstatesQuery`/`FilterSetEstatesQuery` pattern of isolating complex query logic, even though this is a write, not a read, operation.
- **Background jobs:** Must go through ActiveJob (`solid_queue` adapter, confirmed in `config/environments/{development,production}.rb`), mirroring `SendInvitationEmailJob`'s `retry_on`/`discard_on` shape (D-02).
- **Multi-tenancy/auth:** Authorization is imperative, enforced via `BrokerageAuth`/`CognitoAuth` concerns — no declarative gem. D-09's suspended-membership block must be added to `CognitoAuth#authenticate_cognito_user!`, not a new concern.
- **Migrations:** Standard Rails migration conventions apply (see Code Examples — recent migrations in this repo use plain `change`/`up`+`down` blocks, `add_column`, `add_index`, and raw `execute` only when relabeling data, as seen in `20260714000000_migrate_brokerage_plan_tiers.rb`).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAN-14 | Upgrade Free→paid silently purges TEST-board `BrokerageEstate` + comments/ratings/likes/documents/RSVPs | Confirmed traversal path `RealEstateBoard(test_boards) → Estate → {BrokerageEstate, GroupEstate} → {estate_comments, estate_ratings, estate_likes, estate_documents, estate_dates→estate_date_rsvps}`; FK cascade gaps documented in Common Pitfalls |
| PLAN-15 | Downgrade paid→Free freezes custom domain via `freeze_custom_domains!` | Confirmed existing method at `brokerage.rb:44-57` needs no changes, just a new caller from the plan-transition job |
| PLAN-16 | Downgrade soft-disconnects real board credentials (preserved, marked inactive, excluded from member-visible lists, board-connect UI reverts to Free) | Confirmed `BrokerageBoardCredential#status` enum extension point; confirmed `board_credentials_controller.rb#index` is the "member-visible board list" needing a status filter; confirmed `Estate.accessible_by` needs no change |
| PLAN-17 | Downgrade suspends all client memberships (access revoked, records preserved) | Confirmed `BrokerageMembership.role == "client"` is the correct scope (D-10 verified); confirmed `Invitation#revoked_at` pattern to mirror for `suspended_at` |
| PLAN-18 | Re-upgrade restores previously suspended credentials/memberships, no manual re-entry | Confirmed `unfreeze_custom_domains!` does NOT restore `is_primary` (verified via code comment); confirmed D-06's "restore only this downgrade's suspensions" needs a tracking mechanism (timestamp-based, detailed below) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Rails | 7.1 | Framework | Existing stack, no change |
| paranoia | 3.0 (confirmed in Gemfile.lock) | Soft-delete (`acts_as_paranoid`) | Existing convention; `really_destroy!` is this gem's hard-delete method — used for D-11's purge |
| solid_queue | (confirmed via `config.active_job.queue_adapter = :solid_queue`) | Background job backend | Existing ActiveJob adapter for dev/prod — D-02's async cascade job runs on this |
| factory_bot_rails | ~> 6.5 | Test factories | Existing test-data convention (`test/factories/`) |

No new external packages are required for this phase — everything is built on existing gems already in `Gemfile.lock`. **Package Legitimacy Audit is not applicable** — no new dependencies to install.

## Package Legitimacy Audit

N/A — this phase introduces zero new external packages. All work uses gems already present in `Gemfile.lock` (`paranoia`, ActiveJob/solid_queue, `factory_bot_rails`).

## Architecture Patterns

### System Architecture Diagram

```
Ops operator (manual trigger, HTTP Basic Auth)
        │
        ▼
Ops::PlanController#update (existing; extended)
        │
        ├─ old_plan = brokerage.plan (before flip)
        ├─ brokerage.update!(plan: new_plan)
        │
        └─ enqueue: ApplyPlanTransitionJob.perform_later(brokerage.id, old_plan, new_plan)
                        │
                        ▼
              ApplyPlanTransitionJob#perform (async, solid_queue)
                        │
        ┌───────────────┼────────────────────┐
        ▼ (free → paid)                      ▼ (paid → free)
  PURGE cascade                        FREEZE + SUSPEND cascade
  ─────────────                        ──────────────────────
  RealEstateBoard.test_boards          brokerage.freeze_custom_domains!
    → Estate (real_estate_board_id)      → DomainMailer.downgrade_notice
    → BrokerageEstate.where(               (dispatched after commit)
        brokerage_id, estate_id in …)
        .delete_all (no cascade risk,    BrokerageBoardCredential
         join table, no children)          .where(brokerage:, status: active,
    → GroupEstate (via brokerage's           real_estate_board: real_boards)
        groups, estate in test estates)    .update_all(status: "suspended",
        → really_destroy! per row            suspended_at: Time.current)
          (cascades via Ruby
           dependent: :destroy to:        BrokerageMembership
           estate_comments → subcomments    .where(brokerage:, role: "client")
           estate_ratings                   .update_all(suspended_at: Time.current)
           estate_likes
           estate_documents
           estate_dates → estate_date_rsvps
           estate_tags, estate_rejections)
                        │
                        ▼ (free → paid, re-upgrade — PLAN-18)
              RESTORE cascade
              ────────────────
              brokerage.unfreeze_custom_domains!
                (does NOT restore is_primary — flag for owner)

              BrokerageBoardCredential
                .where(brokerage:, status: "suspended",
                       suspended_at: >= last_downgrade_at)
                .update_all(status: "active", suspended_at: nil)

              BrokerageMembership
                .where(brokerage:, role: "client",
                       suspended_at: >= last_downgrade_at)
                .update_all(suspended_at: nil)

Runtime request path (any time, all tiers)
        │
        ▼
CognitoAuth#authenticate_cognito_user!
        │
        ├─ token verified → Current.user set
        ├─ BrokerageMembership.without_deleted
        │     .exists?(user_id:, brokerage_id:)   [existing check]
        └─ NEW: reject if that membership's suspended_at is present (D-09)
             → 403 Forbidden, distinct from "not a member" 403
```

### Recommended Project Structure
```
backend/app/
├── controllers/ops/
│   └── plan_controller.rb          # extended: plan-flip action, replaces boolean freeze param with target plan
├── jobs/
│   └── apply_plan_transition_job.rb # new — mirrors SendInvitationEmailJob shape
├── services/
│   └── test_board_purge_service.rb  # new — isolates PLAN-14's traversal (D-02 discretion: service object)
├── models/
│   ├── brokerage.rb                 # unchanged (freeze/unfreeze already correct)
│   ├── brokerage_board_credential.rb # status enum: + suspended
│   └── brokerage_membership.rb      # + suspended_at column, suspended?/suspend!/restore! methods (mirror Invitation)
└── controllers/concerns/
    └── cognito_auth.rb              # + suspended-membership rejection check
```

### Pattern 1: Timestamp-scoped "restore only this downgrade's suspensions" (D-06)
**What:** Track a single `downgraded_at` (or reuse `suspended_at` set identically across all rows in one transaction) so re-upgrade only reactivates rows suspended by *that* downgrade event, not any credential/membership that happened to already be `suspended`/broken for unrelated reasons.
**When to use:** PLAN-18's restore query.
**Example:**
```ruby
# Source: derived from Invitation#revoked_at precedent (invitation.rb:38-40) + D-06/D-08
# In ApplyPlanTransitionJob's downgrade branch — stamp all rows suspended by THIS
# downgrade with the exact same timestamp, captured once:
def downgrade!(brokerage)
  suspended_at = Time.current
  ApplicationRecord.transaction do
    brokerage.freeze_custom_domains!
    brokerage.brokerage_board_credentials.without_deleted
      .credential_active.joins(:real_estate_board).merge(RealEstateBoard.real_boards)
      .update_all(status: "suspended", suspended_at: suspended_at)
    brokerage.brokerage_memberships.without_deleted
      .where(role: "client", suspended_at: nil)
      .update_all(suspended_at: suspended_at)
    brokerage.update!(last_downgraded_at: suspended_at) # or store on a side table/log
  end
end

# Re-upgrade only restores rows whose suspended_at matches the last downgrade event:
def restore!(brokerage)
  last = brokerage.last_downgraded_at
  ApplicationRecord.transaction do
    brokerage.unfreeze_custom_domains!
    brokerage.brokerage_board_credentials.without_deleted
      .where(status: "suspended", suspended_at: last)
      .update_all(status: "active", suspended_at: nil)
    brokerage.brokerage_memberships.without_deleted
      .where(role: "client", suspended_at: last)
      .update_all(suspended_at: nil)
  end
end
```
**Note:** This requires a place to persist `last_downgraded_at` — either a new `brokerages.plan_downgraded_at` column, or deriving it as `MAX(suspended_at)` across the two tables at restore time (avoids a schema change but is a slightly less explicit signal). Both are viable; planner's call, consistent with CONTEXT.md's D-06 discretion note ("timestamp vs. join record").

### Pattern 2: Hard-delete cascade via `really_destroy!`, not raw `delete_all`
**What:** Because `subcomments → estate_comments` and `estate_date_rsvps`/`estate_date_calendar_events → estate_dates` lack DB-level `ON DELETE CASCADE`, a raw `GroupEstate.where(...).delete_all` will either (a) raise a Postgres FK violation on comments with subcomments, or (b) silently orphan RSVP/calendar-event rows. Using paranoia's `really_destroy!` per record triggers Rails' `dependent: :destroy` declarations (which exist on all the relevant associations — see verified list below) and safely cascades through both DB-FK-backed and Ruby-only associations.
**When to use:** PLAN-14's purge.
**Example:**
```ruby
# Source: derived from group_estate.rb, estate_comment.rb, estate_date.rb associations (verified in this session)
# GroupEstate has_many :estate_comments (dependent: :destroy) -> EstateComment has_many :subcomments (dependent: :destroy)
# GroupEstate has_many :estate_dates (dependent: :destroy) -> EstateDate has_many :rsvps (dependent: :destroy)
test_board_ids = RealEstateBoard.test_boards.pluck(:id)
estate_ids = Estate.without_deleted.where(real_estate_board_id: test_board_ids).pluck(:id)

# BrokerageEstate: plain join table, no children, no acts_as_paranoid — delete_all is safe as-is
BrokerageEstate.where(brokerage_id: brokerage.id, estate_id: estate_ids).delete_all

group_ids = brokerage.groups.pluck(:id)
GroupEstate.without_deleted
  .where(group_id: group_ids, estate_id: estate_ids)
  .find_each { |ge| ge.really_destroy! }  # cascades to comments/subcomments/ratings/likes/documents/dates/rsvps/tags/rejections
```
**Caveat:** `really_destroy!` runs one row (and its full dependent tree) at a time — for very large TEST-board datasets this may be slow. Since D-02 already mandates this runs as a background job (not synchronous in-request), this is an acceptable tradeoff. If volume ever becomes a real problem, a hand-rolled multi-table raw-SQL cascade (explicitly listing every child table, including subcomments and RSVPs) chunked in batches would be the escape hatch — but do not build that preemptively; start with `really_destroy!` and only optimize if the job actually times out or is measured to be slow (Free-tier TEST-board demo data volume is inherently small and bounded — seeded fixture data, not user-generated at scale).

### Pattern 3: Suspended-membership rejection in `CognitoAuth`
**What:** Add the D-09 check directly adjacent to the existing membership-existence check in `authenticate_cognito_user!`, since that's already the single enforcement point for "is this user allowed to act within this brokerage."
**When to use:** D-09.
**Example:**
```ruby
# Source: cognito_auth.rb:22-27 (existing code), extended per D-09
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

### Anti-Patterns to Avoid
- **Purging with `.destroy_all` on `GroupEstate` instead of `really_destroy!`:** `acts_as_paranoid` overrides `destroy`/`destroy_all` to be a *soft* delete (sets `deleted_at`). D-11 explicitly requires a hard delete — using the plain `destroy` family here silently produces soft-deleted rows that violate the phase's own requirement and leave permanent debris in every future `.without_deleted`-scoped query.
- **Restoring ALL currently-suspended credentials/memberships on re-upgrade:** D-06 explicitly rejects this — a credential that was already `invalid` (broken RETS creds, unrelated to the downgrade) must not be silently flipped to `active` just because the brokerage re-upgraded. Always scope the restore query to rows suspended by the *specific* most recent downgrade event.
- **Gating suspended-client access only via query scopes (e.g., excluding from group member lists):** D-09 explicitly requires request-level rejection, not just filtered-out-of-results behavior — a suspended client hitting any authenticated endpoint should get a 403, not an empty/filtered response.
- **Building a distinct "suspended, will restore" UI indicator:** D-07 explicitly says suspended credentials must be fully invisible, matching Free-tier's existing "TEST board only" UI exactly — no partial/preview state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Custom domain freeze/restore | New downgrade-domain logic | `Brokerage#freeze_custom_domains!` / `#unfreeze_custom_domains!` (brokerage.rb:44-74) | Already transactional, already tested (`test/integration/ops_plan_test.rb`), already handles is_primary promotion |
| Revocable-but-preserved record pattern | A new soft-state design for memberships | Mirror `Invitation#revoked_at`/`revoked?` exactly for `BrokerageMembership#suspended_at`/`suspended?` | Established, reviewed pattern already in the codebase; consistent naming/semantics for future maintainers |
| Async side-effect dispatch | Synchronous purge/freeze/suspend inline in the controller | ActiveJob (`solid_queue`), mirroring `SendInvitationEmailJob`'s `retry_on`/`discard_on` shape | D-02 explicit decision; also avoids a slow HTTP response for a purge that could touch many rows |
| Cascading hard-delete across mixed-cascade tables | Writing raw multi-table `DELETE` SQL by hand for every child table | `really_destroy!` (paranoia gem) on `GroupEstate`, relying on existing `dependent: :destroy` Rails associations | Handles the mixed DB-cascade/no-cascade landscape automatically and correctly, verified against actual FK definitions this session |

**Key insight:** Nothing in this phase needs a new library or a novel pattern — the risk is entirely in getting the *existing* patterns' edge cases right (FK cascade gaps, D-06's scoped restore, D-09's enforcement point). Research effort here was spent verifying exact schema/association shapes, not searching for new tools.

## Common Pitfalls

### Pitfall 1: FK cascade gap causes purge to fail or leave orphans
**What goes wrong:** A raw `GroupEstate.where(...).delete_all` (bypassing Rails callbacks) either raises a Postgres FK violation (if any purged `estate_comments` row has `subcomments` — no `ON DELETE CASCADE` on that FK) or silently orphans `estate_date_rsvps`/`estate_date_calendar_events` rows (which have **no FK constraint at all** to `estate_dates`).
**Why it happens:** DB-level cascade behavior is inconsistent across the schema — most child tables of `group_estates` have `ON DELETE CASCADE` (verified: `estate_comments`, `estate_ratings`, `estate_likes`, `estate_documents`, `estate_dates`, `estate_tags`, `estate_rejections`), but the second-order children (`subcomments` off `estate_comments`, `estate_date_rsvps`/`estate_date_calendar_events` off `estate_dates`) do not inherit that cascade automatically.
**How to avoid:** Use `really_destroy!` per `GroupEstate` row (triggers Ruby-level `dependent: :destroy`, verified present on all relevant associations) rather than raw SQL `delete_all`. If raw SQL is chosen for performance, explicitly `DELETE FROM subcomments WHERE estate_comment_id IN (...)` and `DELETE FROM estate_date_rsvps WHERE estate_date_id IN (...)` (and consider `estate_date_calendar_events` too, even though not named in the requirement — it's real garbage otherwise) before deleting their parents.
**Warning signs:** `ActiveRecord::InvalidForeignKey` during purge job execution; orphaned rows found later by a data-integrity audit referencing deleted `estate_date_id`s.

### Pitfall 2: `unfreeze_custom_domains!` doesn't restore `is_primary`
**What goes wrong:** After a re-upgrade, the brokerage's custom domain is restored to `active`/`pending` status but the subdomain (promoted to primary during downgrade) stays primary — no domain silently reverts to serving the custom domain.
**Why it happens:** This is explicit, documented behavior in `brokerage.rb:63-74` ("Does NOT restore is_primary to frozen domains — owner must manually reassign primary") — a deliberate prior design decision, not a bug.
**How to avoid:** PLAN-18's success criteria only requires board credentials and client memberships to auto-restore "with no manual re-entry" — it does not mention domain `is_primary`. Confirm with the plan (or flag as an explicit open question) whether re-upgrade should also re-promote the custom domain to primary, or whether leaving it on the subdomain (requiring a manual admin action) is acceptable. Do not silently add `is_primary` restoration without this being a plan decision — it changes existing, tested behavior of a shared method.
**Warning signs:** UAT failure where a re-upgraded brokerage's site still serves from the subdomain instead of the custom domain.

### Pitfall 3: Restoring ALL suspended credentials, not just this downgrade's
**What goes wrong:** A credential that was independently `invalid` (bad RETS creds, board outage) before the downgrade gets reactivated to `active` on re-upgrade, even though it was never actually working.
**Why it happens:** A naive restore query like `.where(status: "suspended").update_all(status: "active")` doesn't distinguish "suspended by this downgrade" from "happened to be suspended for other reasons" — but this phase only introduces `suspended` as a downgrade-caused state, so this specific confusion (suspended vs. invalid) is less likely than it sounds *if* `invalid` and `suspended` remain genuinely distinct enum values (D-05 confirms they do). The more realistic version of this pitfall: restoring suspended credentials from an *earlier* downgrade that a brokerage never should have recovered (e.g., churn → re-signup → different downgrade cycle).
**How to avoid:** Scope the restore query to the specific downgrade event's timestamp (Pattern 1 above), not a blanket `status: "suspended"` filter.
**Warning signs:** A brokerage that downgraded twice (with a paid interval in between) sees credentials restored from the wrong downgrade cycle.

### Pitfall 4: Purge running synchronously blocks the Ops HTTP response
**What goes wrong:** If PLAN-14's purge is implemented inline in `Ops::PlanController#update` instead of as a background job, a brokerage with a large TEST-board dataset (many groups × many listings × many comments) could time out the HTTP request.
**Why it happens:** Easy to reach for since the existing `freeze_custom_domains!`/`unfreeze_custom_domains!` calls in `PlanController` today ARE synchronous (small operation, fast).
**How to avoid:** D-02 explicitly locks this to a background job — do not extend the synchronous pattern to the purge cascade just because it matches today's controller style for domain freeze.
**Warning signs:** Ops endpoint response times spike for brokerages with substantial group/listing activity.

## Code Examples

### D-10 verification: client role lives on `BrokerageMembership.role`
```ruby
# Source: backend/app/controllers/v1/admin/users_controller.rb:19-21, 34-38 (verified this session)
non_client_user_count = User
  .for_brokerage(brokerage.id)
  .where.not(brokerage_memberships: {role: "client"})
  .count
# ...
elsif params[:role] == "non-client"
  users.where.not(brokerage_memberships: {role: "client"})
```
```ruby
# Source: backend/app/constants/roles.rb (verified this session)
BROKERAGE_ROLES = %w[owner admin agent staff client].freeze
```
`.planning/ROLES.md`'s claim that "clients are never brokerage members" is confirmed drifted — `client` is a first-class value of `BrokerageMembership.role`, stored directly on the `brokerage_memberships` table (`t.string "role", null: false` — schema.rb:67, no separate `user_groups`-based client concept exists in the schema). PLAN-17's suspend scope is exactly: `BrokerageMembership.where(brokerage_id: brokerage.id, role: "client")`.

### `Estate.accessible_by` needs no change (verified)
```ruby
# Source: backend/app/models/estate.rb:19-44 (verified this session)
scope :accessible_by, ->(brokerage) {
  # ...
  EXISTS (
    SELECT 1 FROM real_estate_boards reb
    JOIN brokerage_board_credentials bbc
      ON bbc.real_estate_board_id = reb.id
     AND bbc.brokerage_id = :brokerage_id
     AND bbc.status = 'active'          # <- suspended credentials already fail this
     AND bbc.deleted_at IS NULL
    WHERE reb.id = estates.real_estate_board_id
      AND reb.is_test_board = false
  ) OR EXISTS ( ... brokerage_estates fallback for TEST-board-linked estates ... )
}
```
Since `suspended` is a new enum value distinct from `'active'`, the existing `bbc.status = 'active'` literal string comparison already excludes suspended credentials with zero code changes. Confirmed no migration of this scope is needed.

### Migration style precedent (for the two new schema changes this phase needs)
```ruby
# Source: backend/db/migrate/20260503000001_add_welcomed_at_to_brokerage_memberships.rb (verified — recent, analogous single-column-add migration)
class AddWelcomedAtToBrokerageMemberships < ActiveRecord::Migration[7.1]
  def change
    add_column :brokerage_memberships, :welcomed_at, :datetime
    add_column :brokerage_memberships, :deleted_at, :datetime
    add_index :brokerage_memberships, :deleted_at
  end
end
```
This phase needs two migrations of the same shape:
1. `add_column :brokerage_memberships, :suspended_at, :datetime` (+ index if queried frequently — likely yes, since `CognitoAuth` will check it on every authenticated request).
2. No column migration needed for `BrokerageBoardCredential#status` — it's a `t.string "status", default: "active", null: false` column (schema.rb:22), not a Postgres native enum, so adding `suspended` as a new Rails-level enum value (`enum :status, {active: "active", invalid: "invalid", suspended: "suspended"}, prefix: :credential`) requires **no migration at all** — confirmed via `20260521000001_add_is_test_board_to_real_estate_boards.rb`-style precedent (plain boolean/string columns, no DB-level CHECK constraint restricting values). Double-check there is no CHECK constraint on `brokerage_board_credentials.status` before assuming this (none was found in schema.rb's `create_table "brokerage_board_credentials"` block during this research — no `check_constraint` line present, unlike `estate_ratings`' rating column which does have one).

### Existing `Ops::PlanController` (to extend per D-04, D-01)
```ruby
# Source: backend/app/controllers/ops/plan_controller.rb (verified this session, full file)
module Ops
  class PlanController < BaseController
    skip_before_action :verify_authenticity_token, raise: false
    before_action :set_brokerage

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
    # ...
  end
end
```
`Ops::BaseController` uses `http_basic_authenticate_with` (ENV `OPS_USERNAME`/`OPS_PASSWORD`) — this is the auth mechanism for D-01's "Ops-only internal endpoint," already proven in `test/integration/ops_plan_test.rb`'s 401-without-auth test. The planner will need to decide whether the existing boolean `freeze: true|false` param is replaced/extended with an explicit target-plan param (e.g. `plan: "growth"`) so the controller can determine purge-vs-freeze direction, since a plan transition is no longer binary (free↔frozen) but three-valued (free/independent/growth).

### `SendInvitationEmailJob` — job shape to mirror (D-02)
```ruby
# Source: backend/app/jobs/send_invitation_email_job.rb (verified this session, full file)
class SendInvitationEmailJob < ApplicationJob
  queue_as :default
  retry_on StandardError, wait: :polynomially_longer, attempts: 3
  discard_on ActiveRecord::RecordNotFound

  def perform(invitation_id)
    invitation = Invitation.find(invitation_id)
    # ... work ...
  rescue
    invitation&.update!(email_status: "failed")
    raise
  end
end
```

## State of the Art

No external state-of-the-art shift applies here — this is entirely internal-pattern-driven work with no third-party library or framework version dependency. N/A.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The plan-transition job's exact enqueuing param shape (target plan string vs. boolean) is not yet decided in code — recommended as `plan: "growth"` replacing/extending the current `freeze:` boolean | Architecture Patterns, Code Examples | Low — this is an implementation-detail suggestion, not a verified requirement; planner is free to choose a different param shape as long as PLAN-14/15/16/17/18 direction logic is correct |
| A2 | Whether `brokerage.last_downgraded_at` should be a new column vs. derived as `MAX(suspended_at)` across credentials/memberships (D-06 tracking mechanism) | Architecture Patterns Pattern 1 | Medium — CONTEXT.md explicitly leaves this as planner's discretion (D-06), so this is a suggested implementation, not a locked decision; a join-record approach is also valid per CONTEXT.md's own framing |
| A3 | Whether PLAN-18 should also restore custom-domain `is_primary` (not just status) — CONTEXT.md flags this as "planner should verify whether that matters" but does not resolve it | Common Pitfalls Pitfall 2 | Medium — if the plan silently assumes `unfreeze_custom_domains!` fully restores prior state, a re-upgraded brokerage's site could serve from the wrong domain; must be an explicit plan decision, not left ambiguous |

## Open Questions

1. **Does PLAN-18's re-upgrade need to restore custom-domain `is_primary`, or is leaving the subdomain primary (requiring manual reassignment) acceptable?**
   - What we know: `unfreeze_custom_domains!` explicitly does NOT restore `is_primary` (documented in code comment, verified this session).
   - What's unclear: PLAN-18's requirement text only mentions "no manual re-entry of RETS credentials or re-inviting of clients" — domain primary-status is not mentioned either way.
   - Recommendation: Planner should treat this as in-scope-for-decision, not silently either implement or skip it. Likely low-cost to leave as-is (matches existing tested behavior) unless product wants a UX improvement — flag for a discuss-phase follow-up or explicit plan note rather than assuming.

2. **What is the exact param/payload shape for the extended `Ops::PlanController` action?**
   - What we know: Today it's `{freeze: true|false}` against a fixed brokerage id in the URL.
   - What's unclear: Whether this phase should accept `{plan: "growth"}` (letting the controller diff against current `brokerage.plan` to determine direction) or keep an explicit `{transition: "upgrade"|"downgrade"}` param.
   - Recommendation: `{plan: "<new_plan>"}` is simplest and mirrors how `Brokerage#plan` already works elsewhere (single source of truth), with the controller comparing `old_plan`/`new_plan` via `AppConstants::PLAN_TIERS` to decide purge-vs-freeze-vs-noop (also needed for future Phase 39's paid↔paid case, which explicitly does neither).

3. **Should the purge job also clean up `estate_date_calendar_events` (Google Calendar sync rows) for purged TEST-board estate_dates?**
   - What we know: This table has no FK to `estate_dates` at all (verified in schema.rb), so a hard-delete of `estate_dates` leaves these rows orphaned regardless of deletion method used.
   - What's unclear: Requirement PLAN-14 doesn't mention calendar events, and TEST-board demo data presumably never has real Google Calendar sync triggered against it (calendar sync is itself a paid-tier-only feature per PLAN-07, so Free-tier TEST-board events should have zero calendar_events rows in practice).
   - Recommendation: Likely a non-issue in practice (Free tier has no calendar sync, so no rows to orphan) — but the planner should not assume this without a one-line verification note in the plan, since Free-tier brokerages *could* have downgraded from paid (retaining old calendar_events rows from when they were paid) before ever purging TEST-board data on a *subsequent* re-upgrade. Low priority, but worth a one-line guard (`EstateDateCalendarEvent.where(estate_date_id: purged_date_ids).delete_all`) for defensive cleanliness.

## Sources

### Primary (HIGH confidence — direct codebase inspection this session)
- `backend/app/controllers/v1/admin/users_controller.rb` — D-10 client-role verification
- `backend/db/schema.rb` — full schema inspection: `brokerage_memberships`, `brokerage_board_credentials`, `brokerage_estates`, `group_estates`, `estate_comments`/`subcomments`/`estate_ratings`/`estate_likes`/`estate_documents`/`estate_dates`/`estate_date_rsvps`/`estate_tags`/`estate_rejections`, all `add_foreign_key` declarations
- `backend/app/models/brokerage.rb` — `freeze_custom_domains!`/`unfreeze_custom_domains!` full implementation and comments
- `backend/app/models/invitation.rb` — `revoked_at`/`revoked?`/`valid_invitation?` pattern
- `backend/app/models/brokerage_board_credential.rb` — `status` enum shape
- `backend/app/models/estate.rb` — `accessible_by` scope SQL
- `backend/app/models/real_estate_board.rb`, `group_estate.rb`, `group.rb`, `estate_date.rb`, `subcomment.rb` — association graph
- `backend/app/controllers/ops/plan_controller.rb`, `ops/base_controller.rb` — existing Ops auth + action shape
- `backend/app/controllers/concerns/brokerage_auth.rb`, `cognito_auth.rb` — full concern source for D-09 enforcement point
- `backend/app/controllers/v1/admin/board_credentials_controller.rb` — member-visible board list `index` action (PLAN-16 integration point)
- `backend/app/jobs/send_invitation_email_job.rb`, `application_job.rb` — job pattern to mirror
- `backend/db/migrate/20260503000001_add_welcomed_at_to_brokerage_memberships.rb`, `20260714000000_migrate_brokerage_plan_tiers.rb`, `20260521000001_add_is_test_board_to_real_estate_boards.rb` — migration style precedent
- `backend/app/constants/plan_tiers.rb`, `roles.rb` — `AppConstants::PLAN_TIERS`/`BROKERAGE_ROLES` shape
- `backend/test/integration/ops_plan_test.rb`, `test/factories/{brokerage_board_credentials,brokerage_memberships,real_estate_boards,estates,group_estates,groups}.rb` — existing test conventions
- `backend/Gemfile`/`Gemfile.lock` — confirmed `paranoia (3.0.0)`, `factory_bot_rails (~> 6.5)`, no billing/payment gems present
- `frontend/src/components/view/admin/brokerageView/ConnectBoardDialog.tsx` — confirmed no board-connect UI change needed beyond backend filtering

### Secondary (MEDIUM confidence)
- Paranoia gem's `really_destroy!` semantics (triggers Ruby `dependent: :destroy` callbacks, not just a raw hard delete) — based on well-established public API of the `paranoia` gem (training knowledge), consistent with the gem being pinned at `~> 3.0` in this repo's Gemfile; not independently re-verified via gem source in this session, but low-risk given it's a widely-used, stable gem with unchanged core API across the 3.x line.

### Tertiary (LOW confidence)
- None — all claims above are grounded in direct codebase reads or well-established gem behavior.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, everything verified against existing Gemfile.lock
- Architecture: HIGH — every referenced file/method/association was read directly this session, not assumed from training data
- Pitfalls: HIGH — FK cascade gaps (subcomments, estate_date_rsvps, estate_date_calendar_events) verified directly against `schema.rb`'s `add_foreign_key` declarations, not inferred

**Research date:** 2026-07-21
**Valid until:** Stable — this is internal-codebase research, not dependent on external library versions; valid until the underlying schema/models change (re-research if Phase 36/37 code is modified after this phase begins, or if a schema migration touches any of the tables listed above before this phase executes).
