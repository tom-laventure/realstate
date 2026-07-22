# Phase 39: Paid-to-Paid Plan Changes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 39-Paid-to-Paid Plan Changes
**Areas discussed:** Billing recalculation output, Where the logic lives, Seat counting, Annual billing scope

---

## Billing recalculation output

| Option | Description | Selected |
|--------|-------------|----------|
| Persist a lightweight record | Store a small billing snapshot (new plan, seat count, computed total, timestamp) somewhere queryable — gives support/future billing system an audit trail. Requires a new table/model this phase. | ✓ |
| Return it in the API response only | Ops::PlanController's response includes the computed breakdown (base + overage = total); nothing persisted. | |
| Log it only | Rails logger records the computed amount; no API response field, no DB table. | |

**User's choice:** Persist a lightweight record
**Notes:** None — chosen directly.

---

## Where the logic lives

| Option | Description | Selected |
|--------|-------------|----------|
| Extend ApplyPlanTransitionJob's no-op branch | Keeps all plan-transition side effects in the one existing dispatch point from Phase 38. | ✓ |
| Compute inline in Ops::PlanController | Synchronous computation in the controller action itself, lets the response include the number immediately. | |

**User's choice:** Extend ApplyPlanTransitionJob's no-op branch
**Notes:** None — chosen directly.

---

## Seat counting

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing member_roles definition | BrokerageMembership rows with role in %w[agent staff owner admin] — excludes client, matching admin_brokerages_controller.rb:41. | ✓ |
| Something different | Alternative seat definition (exclude owner, active-only, etc.) | |

**User's choice:** Reuse existing member_roles definition (Recommended)
**Notes:** None — chosen directly.

---

## Annual billing scope

| Option | Description | Selected |
|--------|-------------|----------|
| Out of scope — monthly-equivalent only | Compute using base_price_cents/overage_price_cents as-is. Matches PLAN-19's literal wording. | ✓ |
| Add billing_interval scaffolding now | Add a column to track annual vs monthly per brokerage ahead of BILL-01. | |

**User's choice:** Out of scope — monthly-equivalent only (Recommended)
**Notes:** None — chosen directly.

---

## Claude's Discretion

- Exact schema/model shape for the persisted billing record (table name, columns beyond plan/seat_count/total_cents/timestamp)
- Whether to extract seat-counting into a shared method or call the same filter inline in the job
- Whether the persisted billing record needs its own read/query endpoint this phase (default: no, unless planning surfaces a concrete reason)

## Deferred Ideas

- Billing-interval (annual vs monthly) tracking on `Brokerage` — no field exists today, PLAN-19 doesn't require it; revisit when BILL-01 is scoped.
- A read/query endpoint for the persisted billing records — not requested by PLAN-19; revisit if support tooling or BILL-01 planning needs it.
- "Rethink listing access model — BrokerageEstate vs board credential JOIN" todo (`arch-brokerage-listing-access.md`) — reviewed, not folded (unrelated to this phase's pure billing-computation scope).
