# Phase 36: Plan Configuration & Tier Migration - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 36 delivers two things, and only these two:
1. A single centralized, code-level plan config defining seat caps, base prices, and per-seat overage rates for `free`/`independent`/`growth` (PLAN-02, PLAN-03, PLAN-10, PLAN-11, PLAN-13).
2. Migration of `Brokerage#plan` from the binary `basic`/`premium` enum to the three-tier `free`/`independent`/`growth` enum, including backfilling existing rows (PLAN-01).

This phase is foundational — every gating rule in Phases 37-39 reads from the config and accessor this phase builds. It does NOT build the Free-tier gating wall (TEST-board-only, no-client-invites, etc.) — that's Phase 37. A brokerage that signs up as Free in this phase gets the `free` plan label and config, but no enforcement exists yet until Phase 37 ships.

</domain>

<decisions>
## Implementation Decisions

### Enum migration mapping (PLAN-01)
- **D-01:** Existing `basic` brokerages migrate to `independent`; existing `premium` brokerages migrate to `growth`. Rationale: today `basic` vs `premium` only gates custom domain access — both have full, unrestricted real-board and real-client access. Mapping either to the new `free` tier would wall off real customer data behind the new TEST-only demo tier, which is unacceptable for live paying customers.
- **D-02:** No seat truncation and no back-billing for migrated brokerages that already exceed their new tier's included seat count (e.g. a `basic`→`independent` brokerage with 3 existing agents). The migration just relabels the plan; seat-overage billing math applies going forward from the new config. No payment processor exists yet (BILL-01 is deferred), so nothing is actually charged as a result of this migration regardless.
- **D-03:** Migration executes as a single Rails migration that both alters the `plan` enum's allowed values and backfills existing rows (`basic`→`independent`, `premium`→`growth`) transactionally, in one step. No separate rake-task-based backfill — no precedent for that pattern exists in this codebase's migrations or `db/seeds/`.

### Annual discount scope (PLAN-13)
- **D-04:** The 15% annual billing discount applies to the base subscription price ONLY, never to per-seat overage billing. This is consistent with PLAN-TIERS.md's existing rule that overage seats are deliberately never discounted (overage = tier's own base ÷ included seats, at full price, to keep Independent the "un-discounted anchor" in the pricing ladder). Overage seats bill at the same standard monthly-equivalent rate whether the brokerage is on monthly or annual billing.

### Onboarding plan selection (config surface)
- **D-05:** The onboarding brokerage-creation flow (`backend/app/controllers/v1/onboarding/brokerages_controller.rb`) is updated in this phase to accept all three tiers — `free`, `independent`, `growth` — as valid signup choices (currently validates only `basic`/`premium`). This reverses an initial "paid-only" answer during discussion; the user explicitly asked to allow Free at signup now rather than deferring it to Phase 37.
  - Note: selecting `free` at signup in this phase does not yet enforce the TEST-board wall, client-invite block, or any other Free-tier gating — those land in Phase 37. Signing up as Free in Phase 36 just sets the plan label and applies the Free tier's config values (unlimited seats, no custom domain requirement).
  - The existing `premium`-requires-custom-domain-at-signup validation (line 34-35 of that controller) needs to be re-evaluated for the new tiers: `growth` (formerly the "premium" concept) should likely keep an equivalent requirement, while `independent` and `free` should not require a custom domain at signup. Leave the exact validation shape to planning, but the requirement direction (Free tier signup must not demand a custom domain) is locked.

### Deploy sequencing (surfaced during research)
- **D-08:** Backend validation tightens to `free`/`independent`/`growth` immediately in this phase, with NO backward-compatible aliasing for `basic`/`premium`. The onboarding frontend (`createBrokerageWizard.ts`, `PlanSelectionStep.tsx`) still only sends `basic`/`premium` today and its update is deferred to Phase 37 (see Deferred Ideas) — this creates a real onboarding-break window if the backend deploy lands before a coordinated frontend fix or before Phase 37 ships. The user explicitly accepted this risk and will coordinate deploys manually (backend + frontend together, or a short accepted downtime window) rather than have Phase 36 build aliasing or expand into frontend scope. Flag this clearly in the plan's rollout/verification notes so it isn't silently deployed backend-first without the operator's awareness.

### Config surface & consumers (PLAN-02, PLAN-03)
- **D-06:** All existing hardcoded plan checks must be rewired to read from the new centralized config rather than comparing against literal tier-name strings. Confirmed call sites needing rewiring:
  - `backend/app/controllers/v1/admin/domains_controller.rb` (line 58-59): `unless Current.brokerage.plan == "premium"` → must become a config-driven capability check (custom domain allowed for `independent`/`growth`, not `free`).
  - `backend/app/controllers/v1/onboarding/brokerages_controller.rb` (lines 15-17, 34-35): plan inclusion validation and the premium-domain-requirement check — both must be updated for the new three-tier enum (see D-05).
  - `backend/app/models/brokerage.rb` (line 14): `validates :plan, inclusion: {in: %w[basic premium]}` → becomes `%w[free independent growth]`.
- **D-07:** Phase 36 introduces a reusable `Brokerage#plan_config` accessor (exact method name/shape left to planning) that returns the full tier config (seat cap, base price, overage rate, capability flags) for the brokerage's current plan. This gives Phases 37-39 a single, already-tested integration point instead of each phase inventing its own config lookup — consistent with PLAN-TIERS.md's existing directive that plan checks must be config-driven, mirroring the `Can`/`RequireRole` pattern already used for role-based gating.

### Claude's Discretion
- Exact Ruby structure of the plan config constant (module constant vs. class, file location under `app/models/` or `app/lib/`) — no strong precedent exists in this codebase (no `config_for`/YAML pattern used elsewhere for this kind of data); pick whatever fits Rails conventions cleanly.
- Exact method name and return shape of the `Brokerage#plan_config` accessor (D-07) — a plain hash, a `Struct`, or a small value object are all consistent with the codebase's existing `Result`-struct pattern used in service objects.
- Exact validation rewrite in `onboarding/brokerages_controller.rb` for which tiers require a custom domain at signup (D-05 locks the direction — Free must not require one — but not the precise conditional shape).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Plan tiers design
- `.planning/PLAN-TIERS.md` — full tier design rationale, pricing table, Key Decisions (including the config-driven-checks and no-discount-on-overage rules referenced above), and the "Known gaps" this discussion resolved (annual-discount scope, enum migration mapping)
- `.planning/REQUIREMENTS.md` — PLAN-01 through PLAN-19, this phase covers PLAN-01, PLAN-02, PLAN-03, PLAN-10, PLAN-11, PLAN-13
- `.planning/ROADMAP.md` — Phase 36 success criteria and dependency chain (37 depends on 36; 38 depends on 36+37; 39 depends on 36 only)

### Existing plan-gating code (to be rewired, not duplicated)
- `backend/app/models/brokerage.rb` — current `basic`/`premium` enum validation (line 14)
- `backend/app/controllers/v1/admin/domains_controller.rb` — current premium-only custom domain check (lines 54-59)
- `backend/app/controllers/v1/onboarding/brokerages_controller.rb` — current plan selection + premium-domain-requirement validation (lines 15-17, 34-35)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/components/createBrokerage/PlanBadge.tsx` and `PlanCard.tsx` — existing frontend plan-display components from the onboarding wizard; will need tier-name updates when frontend catches up (likely Phase 37, since Phase 36 has no UI hint in ROADMAP.md), but worth the planner knowing they exist so Phase 36's onboarding changes don't silently break their prop expectations.
- `backend/app/services/` `Result` struct pattern (e.g. `Groups::Create`) — a natural model for the `plan_config` accessor if a lightweight value object is preferred over a plain hash.

### Established Patterns
- Query/Service object separation: config lookups are not DB queries, so a `plan_config` accessor likely lives directly on the `Brokerage` model or a small `PlanConfig` module, not in `app/queries/` or `app/services/`.
- `Current.brokerage` is resolved on every authenticated request via `BrokerageAuth` — `Current.brokerage.plan_config` will be the natural call pattern in controllers needing plan-gated checks (mirrors existing `Current.brokerage.plan == "premium"` usage being replaced).

### Integration Points
- `backend/app/models/brokerage.rb` — enum validation and the new `plan_config` accessor both land here.
- `backend/app/controllers/v1/admin/domains_controller.rb` and `backend/app/controllers/v1/onboarding/brokerages_controller.rb` — both call sites needing rewiring per D-06.
- No frontend integration in this phase (no UI hint on Phase 36 in ROADMAP.md) — frontend plan-string references (`createBrokerageWizard.ts`, `CreateBrokerageContext.tsx`, `DomainStep.tsx`, `PlanBadge.tsx`, `PlanCard.tsx`) are out of scope here unless they'd hard-break against the new enum values (flag for planner to verify).

</code_context>

<specifics>
## Specific Ideas

No particular UI/UX references — this phase is backend-only (config + migration + accessor). The one concrete "I want it like X" was the reversal on onboarding: the user wants `free` selectable at brokerage creation now, not deferred, even though Free-tier enforcement itself isn't built until Phase 37.

</specifics>

<deferred>
## Deferred Ideas

- Frontend plan-selection UI updates (`PlanBadge.tsx`, `PlanCard.tsx`, `createBrokerageWizard.ts`, etc.) to reflect the new three-tier names — likely belongs in Phase 37 (which has a UI hint) since Phase 36 is backend-only per ROADMAP.md scope. Flagged here so it isn't lost, not decided as in-scope for 36.
- Per-brokerage manual review/flagging of over-cap seats after migration (D-02's rejected alternative) — not needed now since no billing is live, but worth revisiting once BILL-01 (payment processor integration) actually ships and seat overage becomes a real charge.

### Reviewed Todos (not folded)
- "Rethink listing access model — BrokerageEstate vs board credential JOIN" (`arch-brokerage-listing-access.md`) — surfaced as a low-relevance todo match (score 0.2) during cross-referencing. Not folded: it's an existing architectural carry-over already tracked in PROJECT.md's Deferred section, unrelated to plan config/tier migration.

</deferred>

---

*Phase: 36-Plan Configuration & Tier Migration*
*Context gathered: 2026-07-14*
