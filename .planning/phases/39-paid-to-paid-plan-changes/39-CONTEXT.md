# Phase 39: Paid-to-Paid Plan Changes - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 39 builds the billing-recalculation side effect for paid↔paid plan transitions (Independent ↔ Growth) — the last unimplemented branch of the plan-transition trigger built in Phase 38. Since board access, client access, and domain behavior are identical across all paid tiers, this is a pure computation: new base price plus seat overage for seats beyond the new tier's included count, with zero data purge/freeze/suspend/restore.

Does NOT build: a payment processor, checkout flow, or invoicing (BILL-01, deferred to v2), any billing UI, seat caps/enforcement that blocks brokerages from exceeding their tier's seat count (no such cap exists on any paid tier — overage is priced, never blocked), or annual/monthly billing-cycle tracking (no `billing_interval` field exists on `Brokerage` today, and PLAN-19's wording only covers base price + seat overage).

</domain>

<decisions>
## Implementation Decisions

### Billing recalculation output & persistence
- **D-01:** The recalculated billing amount is persisted as a lightweight record (new plan, seat count at time of transition, computed total in cents, timestamp) — not just returned in an API response or logged. This gives support and any future billing system (BILL-01) a queryable audit trail of what a brokerage was billed at each paid-to-paid transition, without building actual payment collection. Planner determines the exact table/model shape (e.g. a new `PlanBillingSnapshot` model vs. reusing an existing pattern) — direction (persist, don't just log/return) is locked.

### Where the logic lives
- **D-02:** Billing recalculation runs inside `ApplyPlanTransitionJob`'s existing no-op branch for paid→paid transitions (the job already receives `old_plan`/`new_plan` and no-ops there per Phase 38's explicit comment: "Phase 39 owns paid<->paid billing recalculation"). This keeps every plan-transition side effect — purge, freeze+suspend, restore, and now billing — in the one dispatch point `Ops::PlanController` already enqueues into, rather than adding a second code path. Because this branch is async, `Ops::PlanController`'s immediate response stays the existing generic `{status: "transitioning", brokerage_id, old_plan, new_plan}` shape (same as upgrade/downgrade) — it does NOT synchronously return the computed billing breakdown.

### Seat counting for overage
- **D-03:** Seat count for overage purposes = `BrokerageMembership` rows with `role` in `%w[agent staff owner admin]` (excludes `client`) — reusing the exact `member_roles` definition already established in `backend/app/controllers/v1/account/admin_brokerages_controller.rb:41` for `member_count`. No new seat-counting logic invented; call the same definition (extract to a shared method if the planner judges duplication a concern, but the counting rule itself is locked).

### Annual billing — out of scope
- **D-04:** This phase computes billing using `base_price_cents`/`overage_price_cents` as defined in `AppConstants::PLAN_TIERS` — monthly-equivalent figures only. The `annual_discount_rate` field already exists in the config (set in Phase 36) but is NOT applied here: there is no `billing_interval` (annual vs monthly) field on `Brokerage` today, and PLAN-19's requirement wording only mentions base price + seat overage, not annual discounting. Adding billing-cycle tracking is explicitly deferred — see Deferred Ideas.

### Claude's Discretion
- Exact schema/model shape for D-01's persisted billing record (table name, exact columns beyond the four locked ones: plan, seat_count, total_cents, timestamp) — direction locked, shape is planner's call.
- Whether to extract seat-counting into a shared method (e.g. on `Brokerage`) to avoid duplicating `admin_brokerages_controller.rb`'s inline logic, or just call the same filter inline in the job — the counting *rule* (D-03) is locked, code organization is not.
- Whether the persisted billing record needs its own read/query endpoint this phase — not requested by PLAN-19's wording (which only asks for the recalculation to happen), so default to "persist only, no new endpoint" unless planning surfaces a concrete reason.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Plan tiers design
- `.planning/PLAN-TIERS.md` — full tier design rationale, pricing table, Key Decisions (seat overage formula: tier's own base ÷ included seats, no discount on overage; annual discount applies to base price only, never overage — both already resolved in Phase 36)
- `.planning/REQUIREMENTS.md` — PLAN-19 (this phase's sole requirement), and the "Out of Scope" table confirming no board cap exists on any paid tier
- `.planning/ROADMAP.md` — Phase 39 goal and success criteria (depends on Phase 36 only)
- `.planning/phases/36-plan-configuration-tier-migration/36-CONTEXT.md` — D-07: the `Brokerage#plan_config` accessor this phase reads seat_cap/base_price_cents/overage_price_cents/annual_discount_rate from
- `.planning/phases/38-upgrade-downgrade-lifecycle/38-CONTEXT.md` — D-02 (background-job pattern for plan-transition side effects) and D-04 (all plan-transition orchestration lives in `Ops::PlanController`) — this phase extends both, doesn't reinvent them

### Existing code to reuse (not duplicate)
- `backend/app/constants/plan_tiers.rb` — `AppConstants::PLAN_TIERS` struct with `seat_cap`, `base_price_cents`, `overage_price_cents`, `annual_discount_rate` per tier
- `backend/app/models/brokerage.rb:34-36` — `plan_config` accessor (`AppConstants::PLAN_TIERS.fetch(plan)`)
- `backend/app/jobs/apply_plan_transition_job.rb` — the paid→paid no-op branch (currently just a comment) this phase fills in; also the `paid?(plan)` helper already defined there
- `backend/app/controllers/ops/plan_controller.rb` — already flips `brokerage.plan` and enqueues `ApplyPlanTransitionJob.perform_later(brokerage.id, old_plan, new_plan)` for every transition type, including paid→paid — no controller changes needed for this phase, only the job
- `backend/app/controllers/v1/account/admin_brokerages_controller.rb:41` — `member_roles = %w[agent staff owner admin]`, the exact seat-counting definition to reuse per D-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ApplyPlanTransitionJob` — extend the existing paid→paid no-op branch; the job already receives `brokerage_id, old_plan, new_plan` and has a `paid?` helper
- `AppConstants::PLAN_TIERS` / `Brokerage#plan_config` — provides every price/rate figure needed for the recalculation, no new config needed
- `member_roles = %w[agent staff owner admin]` pattern from `admin_brokerages_controller.rb` — reuse for seat counting

### Established Patterns
- Background jobs for plan-transition side effects (Phase 38's `ApplyPlanTransitionJob` convention) — this phase's billing recalc follows the same async dispatch, not a new synchronous path
- `ActiveRecord::Base.transaction` wrapping used in the job's `downgrade!`/`restore!` methods — same transactional discipline should wrap the seat-count read + record-create in this phase's new branch if multiple writes are involved

### Integration Points
- `backend/app/jobs/apply_plan_transition_job.rb` — new billing-recalculation logic lands in the currently-empty paid→paid branch
- A new model/table for the persisted billing record (D-01) — planner determines exact name/location (likely `app/models/` + a new migration)
- No frontend integration — no UI hint on Phase 39 in ROADMAP.md, backend-only phase

</code_context>

<specifics>
## Specific Ideas

No particular UI/UX references — this phase is backend-only, a small extension of Phase 38's existing plan-transition job. The concrete shape that emerged: the billing recalculation should leave a durable trace (a persisted record) even though nothing consumes it yet, so a future billing system (BILL-01) or support investigating a billing question has something to look at.

</specifics>

<deferred>
## Deferred Ideas

- **Billing-interval (annual vs monthly) tracking on `Brokerage`** — no such field exists today; PLAN-19 doesn't require it, and adding it now would be scope creep ahead of BILL-01 actually needing it. Revisit when the payment processor integration is scoped.
- **A read/query endpoint for the persisted billing records** — not requested by PLAN-19; the decision here is to persist for future use, not to expose it via API this phase. Revisit if support tooling or BILL-01 planning needs it.

### Reviewed Todos (not folded)
- "Rethink listing access model — BrokerageEstate vs board credential JOIN" (`arch-brokerage-listing-access.md`) — surfaced again as a low-relevance match (score 0.6, generic "board"/"credential"/"backend" keyword overlap). Not folded: Phase 39 touches zero board/credential code — it's a pure billing computation with no board-access changes, so this todo is unrelated to this phase's actual scope (same call made in Phases 36-38).

</deferred>

---

*Phase: 39-Paid-to-Paid Plan Changes*
*Context gathered: 2026-07-22*
