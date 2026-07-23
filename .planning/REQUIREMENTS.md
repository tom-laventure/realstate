# Requirements: RealState SaaS Platform — v1.13

**Defined:** 2026-07-22
**Core Value:** Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.

## v1.13 Requirements

### Onboarding Plan Alignment

- [x] **ONB-05**: Brokerage-creation wizard's plan-selection step shows Free/Independent/Growth (replacing the retired Basic/Premium), each with price/mo, seat cap, and feature list sourced from `AppConstants::PLAN_TIERS`
- [x] **ONB-06**: Custom domain field is optional for both Independent and Growth, and absent entirely when Free is selected — backend's growth-requires-custom-domain check is removed to match
- [ ] **ONB-07**: Completing the wizard submits the correct plan value (`free`/`independent`/`growth`) and successfully creates the brokerage end-to-end for all three tiers (fixes the currently-broken signup path)

### Self-Service Plan Management

- [ ] **PLAN-22**: `/admin/settings` has a new "Plan" section showing the brokerage's current plan tier
- [ ] **PLAN-23**: Owner can change the brokerage's plan via a 3-way selector (Free/Independent/Growth); admin/agent see the current plan read-only, no change control
- [ ] **PLAN-24**: Changing the plan calls a new brokerage-scoped, owner-gated backend endpoint that enqueues the existing `ApplyPlanTransitionJob` cascade (TEST-board purge, domain freeze/restore, credential/membership suspend, billing snapshot) — the real transition, not a stub
- [ ] **PLAN-25**: Server-side enforcement rejects the plan-change request from any non-owner caller, regardless of frontend state
- [ ] **PLAN-26**: Selecting a downgrade (paid → Free) shows a confirmation step before applying, since it freezes the custom domain and suspends real board credentials/client memberships

## v2 Requirements

None identified this milestone.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real payment/billing processor integration | Tracked separately under BILL-01; this milestone only wires the existing internal transition cascade, not Stripe/checkout |
| Multi-step plan-comparison marketing page in admin/settings | User explicitly asked for a simple 3-way selector, not a pricing-page-style UI |
| Growth requiring a custom domain at signup | Reversed during requirements definition — custom domain is optional for both paid tiers |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ONB-05 | Phase 40 | Complete |
| ONB-06 | Phase 40 | Complete |
| ONB-07 | Phase 40 | Pending |
| PLAN-22 | Phase 41 | Pending |
| PLAN-23 | Phase 41 | Pending |
| PLAN-24 | Phase 41 | Pending |
| PLAN-25 | Phase 41 | Pending |
| PLAN-26 | Phase 41 | Pending |

**Coverage:**
- v1.13 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-22*
*Last updated: 2026-07-22 after roadmap creation (Phases 40-41)*
