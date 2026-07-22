# Phase 38: Upgrade & Downgrade Lifecycle - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 38 builds the plan-transition trigger and its four side-effect cascades — a mechanism that does not exist yet in any form:

1. Upgrade (Free → Independent/Growth): silently purges all TEST-board-linked engagement data (PLAN-14)
2. Downgrade (paid → Free): freezes the custom domain via existing `freeze_custom_domains!` (PLAN-15), soft-disconnects all real board credentials (PLAN-16), and suspends all client memberships (PLAN-17)
3. Re-upgrade (Free → paid, again): restores previously soft-disconnected board credentials and suspended client memberships (PLAN-18)

Does NOT build: a payment processor or billing UI (BILL-01, deferred to v2), self-serve plan-change UI (no such UI exists or is being added), paid-to-paid billing recalculation (Phase 39).

</domain>

<decisions>
## Implementation Decisions

### Plan-change trigger & authorization
- **D-01:** The trigger is an Ops-only internal endpoint, extending the existing `Ops::PlanController` (which today only does domain freeze/unfreeze via `freeze_custom_domains!`/`unfreeze_custom_domains!`). No self-serve admin/billing UI is built in this phase — consistent with BILL-01 being deferred and no payment processor existing yet.
- **D-02:** The purge/freeze/suspend side-effect cascade runs as a background job (mirrors the existing `SendInvitationEmailJob` pattern), not synchronously in the request. `PLAN-14`'s purge in particular traverses `Group → GroupEstate → {comments, ratings, likes, documents, RSVPs}` and could touch many rows.
- **D-03:** No explicit confirmation/dry-run step before a downgrade executes — it runs immediately once Ops triggers it, matching `freeze_custom_domains!`'s existing no-confirmation behavior today.
- **D-04:** All plan-transition orchestration (the actual `brokerage.plan` flip plus triggering PLAN-14/15/16/17/18 side effects) lives in `Ops::PlanController`, alongside the existing freeze/unfreeze actions — one home for all plan-transition logic, not split across a new controller.

### Board-credential suspend state (PLAN-16, PLAN-18)
- **D-05:** `BrokerageBoardCredential#status` gets a new enum value `suspended`, alongside the existing `active`/`invalid`. This fits the existing enum shape directly — no new column needed. `Estate.accessible_by`'s existing `bbc.status = 'active'` check requires no change (suspended already fails it).
- **D-06:** Re-upgrade (PLAN-18) restores only the credentials suspended by that specific most-recent downgrade event — not blindly every currently-suspended credential. This avoids incorrectly reactivating a credential that was already `invalid` before the downgrade happened. Planner must determine the exact tracking mechanism (e.g., a `suspended_at` timestamp set once per downgrade, or an explicit "downgrade event" join) to distinguish "suspended by this downgrade" from "was already broken."
- **D-07:** Suspended real-board credentials are fully invisible in the board-connect UI while suspended — same as if they never existed (matches PLAN-16's literal wording: "excluded from member-visible board lists," "board-connect UI reverts to Free-tier behavior"). No distinct "suspended, will restore" indicator is built this phase.

### Client-membership suspend semantics (PLAN-17, PLAN-18)
- **D-08:** New `suspended_at` timestamp column on `BrokerageMembership` — mirrors the `Invitation#revoked_at` pattern already established in this codebase. The membership row (role, associations, history) stays fully intact; only `suspended_at` is set/cleared.
- **D-09:** A suspended client is blocked at the brokerage-auth layer (`BrokerageAuth`/`CognitoAuth` — planner to determine exact enforcement point) — the request is rejected outright for a suspended membership, not just hidden from group/listing-scoped queries. Single enforcement point, consistent with how `acts_as_paranoid`'s `without_deleted` already gates at the query layer for soft-deleted records.
- **D-10 (schema correction — supersedes an initial framing during discussion):** The "client" role lives directly on `BrokerageMembership.role` (confirmed via `backend/app/controllers/v1/admin/users_controller.rb:21,38` — `where.not(brokerage_memberships: {role: "client"})`), NOT on `user_groups`. `.planning/ROLES.md`'s line "clients are never brokerage members" has drifted from the actual code (the doc itself warns file:line pointers are "last known location," not guaranteed current — this is a live example of that drift). PLAN-17's suspend therefore applies to: every `BrokerageMembership` row with `role: "client"` for that brokerage, set via `suspended_at`. Planner and researcher should verify this against current code rather than trusting ROLES.md's client-role description at face value.

### PLAN-14 purge scope & idempotency
- **D-11:** Purge is a hard delete, not soft-delete — TEST-board-linked `BrokerageEstate` rows and their attached `GroupEstate`-scoped comments/ratings/likes/documents/RSVPs are genuinely disposable demo data by design. This is a deliberate exception to the repo's general `acts_as_paranoid` convention (CLAUDE.md), justified because there's no business reason to keep Free-tier trial demo data recoverable, and it avoids leaving orphaned soft-deleted rows that every future query must keep filtering out.
- **D-12:** No explicit idempotency guard beyond the purge query's natural idempotency (deleting zero matching rows on a re-run is fine) — no processed-flag or lock needed, as long as the job isn't double-enqueued concurrently (standard job-queue concern, not specific to this phase).
- **D-13:** Purge is silent — no warning or notice to the brokerage owner before their TEST-board demo data is deleted on upgrade. This is the requirement's own wording in REQUIREMENTS.md ("automatically and silently purges"), not a new decision — confirmed here so planning doesn't second-guess it.

### Claude's Discretion
- Exact traversal/query shape for PLAN-14's purge (whether it's one big transaction, chunked deletes, or a service object walking `Group → GroupEstate → child tables`) — direction is locked (hard delete, silent, no idempotency guard needed), mechanics are not.
- Exact mechanism for D-06's "suspended by this downgrade" tracking (timestamp vs. join record) — direction locked (restore only this downgrade's suspensions), shape is planner's call.
- Exact enforcement point for D-09's brokerage-auth block (which concern/controller layer rejects the request) — direction locked (blocked entirely, not query-scoped), exact code location is planner's call.
- Background job framework/pattern to reuse for D-02 (matching `SendInvitationEmailJob`'s existing setup) — no new decision needed, just follow precedent.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Plan tiers design
- `.planning/PLAN-TIERS.md` — full tier design rationale, pricing table, Key Decisions
- `.planning/REQUIREMENTS.md` — PLAN-14 through PLAN-18 (this phase's requirements), verbatim wording for purge ("automatically and silently") and restore ("no manual re-entry")
- `.planning/ROADMAP.md` — Phase 38 success criteria and dependency chain (depends on Phase 36 + Phase 37)
- `.planning/ROLES.md` — role definitions; note the client-role section is confirmed DRIFTED from actual code per D-10 above — verify against `backend/app/controllers/v1/admin/users_controller.rb` and `brokerage_memberships` schema directly, don't trust the doc's "clients are never brokerage members" claim
- `.planning/phases/36-plan-configuration-tier-migration/36-CONTEXT.md` — prior phase's `plan_config` accessor and enum migration decisions
- `.planning/phases/37-free-tier-gating/37-CONTEXT.md` — prior phase's gating decisions (D-01 board gate, D-05 client-invite gate, D-06/D-07 calendar gate) — this phase's freeze/restore must agree with what that phase treats as "real" vs. "TEST" data

### Existing code to reuse (not duplicate)
- `backend/app/models/brokerage.rb:44-57` — `freeze_custom_domains!` (already does everything PLAN-15 needs: freezes domains, clears `is_primary`, promotes subdomain to primary, transactional)
- `backend/app/models/brokerage.rb:63-74` — `unfreeze_custom_domains!` (restores verified→active/unverified→pending on re-upgrade; does NOT restore `is_primary` — planner should verify whether that matters for PLAN-18)
- `backend/app/controllers/ops/plan_controller.rb` — existing home for plan-transition side effects (freeze/unfreeze only today); this phase extends it per D-04
- `backend/app/models/invitation.rb:38-40` — `revoked_at`/`revoked?`/`valid_invitation?` pattern to mirror for D-08's `BrokerageMembership#suspended_at`
- `backend/app/models/brokerage_board_credential.rb` — `status` enum (`active`/`invalid`) to extend per D-05; `acts_as_paranoid` already covers hard-delete-adjacent concerns, so `suspended` is a distinct third state
- `backend/app/models/estate.rb:19-44` — `Estate.accessible_by` scope checking `bbc.status = 'active' AND bbc.deleted_at IS NULL` — confirm no change needed per D-05
- `backend/app/models/real_estate_board.rb:11` — `is_test_board`/`test_boards` scope, the join point for identifying TEST-linked data for PLAN-14's purge
- `backend/app/models/group_estate.rb` — where comments/ratings/likes/documents/RSVPs actually hang off (not directly on `Estate`/`BrokerageEstate`) — PLAN-14 purge must traverse through this

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Ops::PlanController` — extend with the plan-flip + orchestration trigger (D-01, D-04)
- `Invitation#revoked_at` pattern — direct precedent for `BrokerageMembership#suspended_at` (D-08)
- `freeze_custom_domains!`/`unfreeze_custom_domains!` — reusable as-is for PLAN-15/part of PLAN-18, no new domain-freeze logic needed

### Established Patterns
- Background jobs: `SendInvitationEmailJob` is the existing pattern to mirror for D-02's async cascade
- `BrokerageBoardCredential#status` enum extension (active/invalid → +suspended) follows the same shape Phase 36 used for `Brokerage#plan` (free/independent/growth)
- `acts_as_paranoid` is the repo's default soft-delete convention — D-11's hard-delete for TEST-board data is a deliberate, documented exception, not an oversight

### Integration Points
- `backend/app/controllers/ops/plan_controller.rb` — new plan-flip action + orchestration lands here
- `backend/app/models/brokerage_board_credential.rb` — new `suspended` status value
- `backend/app/models/brokerage_membership.rb` — new `suspended_at` column
- `backend/app/models/brokerage.rb` — no change needed to `freeze_custom_domains!`/`unfreeze_custom_domains!` themselves, just new callers
- Brokerage-auth layer (`BrokerageAuth`/`CognitoAuth` concerns) — new suspended-membership rejection check (D-09)
- `frontend/src/components/view/admin/brokerageView/ConnectBoardDialog.tsx` — no new UI needed; suspended credentials simply stop appearing (D-07), reusing Phase 37's existing TEST-only filtering

</code_context>

<specifics>
## Specific Ideas

No particular UI references — this phase is backend-only (no UI hint in ROADMAP.md for Phase 38). The concrete technical correction that emerged during discussion: `ROLES.md`'s claim that clients are "never brokerage members" doesn't match the actual schema — `BrokerageMembership.role` does get set to `"client"` — and downstream agents must verify this directly rather than trust the doc (D-10).

</specifics>

<deferred>
## Deferred Ideas

- None new this discussion — all four gray areas resolved within phase scope.

### Reviewed Todos (not folded)
- "Rethink listing access model — BrokerageEstate vs board credential JOIN" (`arch-brokerage-listing-access.md`) — surfaced again as a Phase 38 match (score 0.6, directly adjacent to PLAN-14's TEST-board join traversal and PLAN-16's board-credential visibility scoping). Not folded: it's a query-layer scale refactor orthogonal to which data gets purged/frozen/restored on a plan transition — same call made in Phases 36 and 37. Phase 38 purges/restores correctly through the existing indirect `Estate → RealEstateBoard` join without needing a direct FK.

</deferred>

---

*Phase: 38-Upgrade & Downgrade Lifecycle*
*Context gathered: 2026-07-21*
