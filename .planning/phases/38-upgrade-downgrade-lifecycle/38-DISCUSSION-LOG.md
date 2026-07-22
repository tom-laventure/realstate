# Phase 38: Upgrade & Downgrade Lifecycle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-21
**Phase:** 38-Upgrade & Downgrade Lifecycle
**Areas discussed:** Plan-change trigger & authorization, Board-credential suspend state, Client-membership suspend semantics, PLAN-14 purge scope & idempotency

---

## Plan-change trigger & authorization

| Option | Description | Selected |
|--------|-------------|----------|
| Ops-only internal endpoint | Extends existing Ops::PlanController pattern; no self-serve UI since no payment processor exists yet | ✓ |
| Self-serve admin action | Brokerage owner triggers via own admin panel; gets ahead of BILL-01 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Background job | Matches SendInvitationEmailJob pattern; avoids blocking Ops request | ✓ |
| Synchronous in the request | Simpler; matches freeze_custom_domains!'s current style | |

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate execution | Mirrors freeze_custom_domains! today, no confirm step | ✓ |
| Require explicit confirm step | Dry-run/preview before commit; more defensive, more to build | |

| Option | Description | Selected |
|--------|-------------|----------|
| Extend Ops::PlanController | Keeps all plan-transition logic in one place | ✓ |
| New dedicated controller/service | Cleaner separation, splits logic across two places | |

**User's choice:** All recommended options selected.
**Notes:** None.

---

## Board-credential suspend state

| Option | Description | Selected |
|--------|-------------|----------|
| New status enum value: suspended | Fits existing status enum shape directly | ✓ |
| Separate boolean/timestamp alongside status | Keeps validity and plan-gate as orthogonal concerns | |

| Option | Description | Selected |
|--------|-------------|----------|
| Restore all credentials suspended by the most recent downgrade | Avoids reactivating credentials broken before the downgrade | ✓ |
| Restore all currently-suspended credentials, regardless of when | Simpler but risks restoring pre-broken credentials | |

| Option | Description | Selected |
|--------|-------------|----------|
| Fully invisible while suspended | Matches PLAN-16's literal wording | ✓ |
| Show a distinct "suspended" indicator | More informative, but scope addition not asked for | |

**User's choice:** All recommended options selected.
**Notes:** None.

---

## Client-membership suspend semantics

| Option | Description | Selected |
|--------|-------------|----------|
| New suspended_at timestamp on BrokerageMembership | Mirrors Invitation#revoked_at precedent | ✓ |
| New status enum column | Bigger schema change for same effect | |

| Option | Description | Selected |
|--------|-------------|----------|
| Blocked at the brokerage-auth layer | Single enforcement point, consistent with without_deleted gating | ✓ |
| Scoped hide from group/listing queries only | More surgical, more places to update | |

| Option | Description | Selected |
|--------|-------------|----------|
| Suspend every group-membership row for that brokerage | Matches data model (as initially framed) | ✓ |
| You decide | Defer exact traversal shape to planning | |

**User's choice:** All recommended options selected.
**Notes:** Mid-discussion correction — the third question's framing ("group-membership row") was based on an inaccurate initial reading of ROLES.md. Verified against actual schema/code (`backend/app/controllers/v1/admin/users_controller.rb`, `db/schema.rb`): the "client" role lives on `BrokerageMembership.role`, not `user_groups`. ROLES.md's "clients are never brokerage members" line has drifted from the code. The user's selection was preserved with corrected intent: suspend every `BrokerageMembership` row with `role: "client"` for that brokerage. See CONTEXT.md D-10.

---

## PLAN-14 purge scope & idempotency

| Option | Description | Selected |
|--------|-------------|----------|
| Hard delete | TEST-board data is genuinely disposable demo data by design | ✓ |
| Soft-delete (acts_as_paranoid) | Matches repo convention but leaves orphaned rows to filter forever | |

| Option | Description | Selected |
|--------|-------------|----------|
| Delete-whatever-matches is sufficient | Purge query is naturally idempotent | ✓ |
| Add an explicit idempotency guard | More defensive against job-queue retry duplication | |

| Option | Description | Selected |
|--------|-------------|----------|
| Silent, no notice | Matches PLAN-14's locked requirement wording ("automatically and silently") | ✓ |
| Add a warning before upgrade completes | Would contradict the requirement's explicit wording | |

**User's choice:** All recommended options selected.
**Notes:** None.

---

## Claude's Discretion

- Exact traversal/query shape for PLAN-14's purge (single transaction vs. chunked deletes vs. service object)
- Exact mechanism for tracking "suspended by this downgrade" vs. pre-existing suspension (timestamp vs. join record)
- Exact enforcement point/layer for the brokerage-auth suspended-membership block
- Background job framework specifics (follow SendInvitationEmailJob precedent)

## Deferred Ideas

- None new this discussion.
- Reviewed but not folded: "Rethink listing access model — BrokerageEstate vs board credential JOIN" (todo match score 0.6) — stays deferred, same call as Phases 36/37.
