# Phase 36: Plan Configuration & Tier Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 36-Plan Configuration & Tier Migration
**Areas discussed:** Enum migration mapping, Annual discount scope, Config surface & consumers, Migration mechanism

---

## Enum migration mapping

| Option | Description | Selected |
|--------|-------------|----------|
| basic→independent, premium→growth | Every existing brokerage becomes a paid tier, preserving current unrestricted real-board/client access | ✓ |
| basic→independent, premium→independent | Flattens both into the cheaper paid tier | |
| Ask me to specify per-brokerage | Hand-map individually | |

**User's choice:** basic→independent, premium→growth
**Notes:** Both basic and premium currently only differ on custom-domain access; both have full real-board/client access today. Mapping either to `free` would regress live paying customers by walling off their real data behind the new TEST-only demo tier.

**Follow-up:** Should the migration do anything special for basic→independent brokerages that already exceed Independent's 1-seat cap?

| Option | Description | Selected |
|--------|-------------|----------|
| Just apply config going forward | No back-billing, no seat truncation; future billing prices excess seats as overage | ✓ |
| Flag over-cap brokerages for review | Migration logs/reports over-cap brokerages for manual outreach | |

**User's choice:** Just apply config going forward
**Notes:** No payment processor exists yet (BILL-01 deferred), so nothing is actually charged as a result of this migration regardless.

---

## Annual discount scope

| Option | Description | Selected |
|--------|-------------|----------|
| Base price only | Consistent with PLAN-TIERS.md's existing no-discount-on-overage rule | ✓ |
| Base + overage, both discounted 15% | Simpler customer pitch but breaks the existing overage rule | |

**User's choice:** Base price only
**Notes:** Overage seats always bill at the standard monthly-equivalent rate regardless of annual/monthly billing cycle.

---

## Config surface & consumers

**Question 1 — Onboarding plan selection:**

| Option | Description | Selected |
|--------|-------------|----------|
| Keep onboarding paid-only for now | Offer only independent/growth at signup; free unreachable until Phase 37 | (initial) |
| Add free as a 3rd onboarding option now | Expose all three tiers immediately | ✓ (final, after revision) |

**User's choice:** Initially chose "Keep onboarding paid-only for now." Later revised via free-text: "I would like to change a previous answer, new brokerage signups be able to select `free` at creation time." Confirmed via re-ask: Yes, add free as a signup option in Phase 36.
**Notes:** Free-tier enforcement (TEST-board wall, client-invite block) is NOT built until Phase 37 — selecting `free` at signup in this phase just sets the plan label and config; no gating exists yet.

**Question 2 — Reusable accessor:**

| Option | Description | Selected |
|--------|-------------|----------|
| Add a single `plan_config` accessor now | One method gives 37/38/39 a shared integration point | ✓ |
| Just ship the config constant, no accessor yet | Each later phase wires its own lookup | |

**User's choice:** Add a single `plan_config` accessor now
**Notes:** This question had to be re-asked once due to a garbled AskUserQuestion response (echoed stale text from a prior question) — re-ask returned a clean answer.

---

## Migration mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Single Rails migration: alter enum + backfill in one step | Standard pattern for this codebase; no rake-task precedent for data migrations | ✓ |
| Migration adds new values, separate rake task backfills | Splits schema change from data change, allows dry-run review | |

**User's choice:** Single Rails migration: alter enum + backfill in one step

---

## Claude's Discretion

- Exact Ruby structure of the plan config constant (module vs. class, file location) — no strong precedent in this codebase.
- Exact method name and return shape of `Brokerage#plan_config` (plain hash vs. `Struct` vs. value object).
- Exact validation rewrite shape in `onboarding/brokerages_controller.rb` for which tiers require a custom domain at signup (direction locked: Free must not require one).

## Deferred Ideas

- Frontend plan-selection UI updates (`PlanBadge.tsx`, `PlanCard.tsx`, `createBrokerageWizard.ts`, etc.) — likely Phase 37 scope (has UI hint), not Phase 36 (backend-only).
- Per-brokerage manual review/flagging of over-cap seats post-migration — revisit once BILL-01 payment processor ships.
- "Rethink listing access model — BrokerageEstate vs board credential JOIN" todo (`arch-brokerage-listing-access.md`) — reviewed via todo cross-reference (score 0.2), not folded; unrelated to this phase, already tracked in PROJECT.md.
