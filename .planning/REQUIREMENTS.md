# Requirements: RealState SaaS Platform — v1.12

**Defined:** 2026-07-14
**Core Value:** Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.

**Status:** Locked for milestone v1.12 (Plan Tiers & Gating). Mapped to roadmap Phases 36-39 — see Traceability table below.

## v1.12 Requirements

### Plan Configuration

- [x] **PLAN-01**: `Brokerage#plan` supports three tiers: `free`, `independent`, `growth` (migrated from the current `basic`/`premium` enum)
- [x] **PLAN-02**: Seat caps, base prices, and per-seat overage rates for every tier are defined in a single centralized config (code-level constant, not a DB-backed model — see Key Decisions) — no plan numbers duplicated or hardcoded across controllers, serializers, or frontend components
- [x] **PLAN-03**: Config is structured so raising/lowering a tier's seat cap, price, or overage rate is a one-file change

### Free Tier Gating

- [x] **PLAN-04**: Free-tier brokerages can only connect the seeded TEST board; the board-connect flow (backend endpoint + frontend UI) does not offer real RETS/MLS board credentials as an option while on Free
- [x] **PLAN-05**: Free-tier brokerages cannot invite or add clients to any group; client-invite endpoints reject the request while the brokerage is on Free
- [x] **PLAN-06**: Free-tier brokerages have unlimited agent/staff seats — no seat cap, no seat billing
- [x] **PLAN-07**: Free-tier brokerages have no calendar sync access
- [x] **PLAN-08**: Free-tier brokerages are restricted to their subdomain — no custom domain
- [x] **PLAN-09**: All other engagement features (groups, comments, ratings, likes, documents, RSVP/dates, filter sets) are fully available on Free, operating against TEST-board demo listings

### Independent & Growth Tiers

- [x] **PLAN-10**: Independent plan: $20/mo base price, 1 seat included, additional seats billed at $20/seat (no volume discount)
- [x] **PLAN-11**: Growth plan: $79/mo base price, 5 seats included, additional seats billed at $16/seat
- [x] **PLAN-12**: Both Independent and Growth permit: unlimited real RETS/MLS board connections, unlimited clients, custom domain + automatic SSL, and Google calendar sync
- [x] **PLAN-13**: Annual billing offers a 15% discount on Independent and Growth (interaction with seat overage pricing to be finalized during phase planning)

### Upgrade Lifecycle (Free → paid)

- [ ] **PLAN-14**: Upgrading a brokerage from Free to Independent or Growth automatically and silently purges all TEST-board-linked data — `BrokerageEstate` rows for the TEST board, plus any comments, ratings, likes, documents, and RSVPs attached only to those listings

### Downgrade Lifecycle (paid → Free)

- [ ] **PLAN-15**: Downgrading a brokerage to Free freezes its custom domain, reusing the existing `freeze_custom_domains!` behavior (subdomain auto-promoted to primary)
- [ ] **PLAN-16**: Downgrading a brokerage to Free soft-disconnects all real board credentials — the credential record is preserved, marked inactive, and excluded from `member`-visible board lists; the board-connect UI reverts to Free-tier behavior (TEST board only)
- [ ] **PLAN-17**: Downgrading a brokerage to Free suspends all client memberships — access is revoked but membership records are preserved, not deleted
- [ ] **PLAN-18**: Re-upgrading from Free to a paid plan automatically restores previously soft-disconnected real board credentials and suspended client memberships — no manual re-entry of RETS credentials, no re-inviting clients

### Paid-to-Paid Transitions

- [ ] **PLAN-19**: Switching between paid plans (Independent ↔ Growth) is a pure billing recalculation — new base price plus seat overage for seats beyond the new tier's included count. No data is purged, frozen, or disconnected, since board access and client access are identical across all paid tiers.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Higher-Seat Tiers

- **PLAN-20**: Additional tier(s) above Growth at higher seat counts (previously sketched as "Growth $249/20 seats" and "Premium $699/60 seats" before rescoping) — revisit once Growth-tier brokerages are consistently outgrowing 5 seats

### Plan Config Flexibility

- **PLAN-21**: Migrate plan config from a code-level constant to a DB-backed model, if tweak frequency ends up requiring runtime edits without a deploy

### Billing Infrastructure

- **BILL-01**: Full Billing management section on `/admin/settings` (stubbed as TODO since v1.11) — payment processor integration, checkout flow, invoicing. This requirements set defines the plan *structure and gating rules* only; payment collection is separate, larger scope.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Payment processor integration (Stripe, etc.) | Separate scope from plan structure/gating — tracked under BILL-01 |
| MLS/RETS board count caps per paid tier | Explicitly decided against — no cap on real board connections for Independent or Growth |
| Per-tier calendar provider differentiation | Only Google Calendar sync is live today (Microsoft/Apple adapters dormant); when activated, they apply uniformly to all paid tiers, not gated by tier |
| Time-boxed trial of paid features | Free tier fills this role permanently; no separate trial mechanism |
| Auto-purge of real data on paid→Free downgrade | Real board/client data is frozen and restorable, never deleted, unlike Free→paid's demo-data purge |
| Board-selection UI for paid-to-paid downgrades | Moot — no paid tier has a board cap, so no board ever needs to be chosen or dropped |

## Traceability

Mapped to roadmap phases 36-39 (see `.planning/ROADMAP.md`).

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAN-01 | Phase 36 — Plan Configuration & Tier Migration | Not started |
| PLAN-02 | Phase 36 — Plan Configuration & Tier Migration | Not started |
| PLAN-03 | Phase 36 — Plan Configuration & Tier Migration | Not started |
| PLAN-10 | Phase 36 — Plan Configuration & Tier Migration | Not started |
| PLAN-11 | Phase 36 — Plan Configuration & Tier Migration | Not started |
| PLAN-13 | Phase 36 — Plan Configuration & Tier Migration | Not started |
| PLAN-04 | Phase 37 — Free Tier Gating | Complete |
| PLAN-05 | Phase 37 — Free Tier Gating | Complete |
| PLAN-06 | Phase 37 — Free Tier Gating | Complete |
| PLAN-07 | Phase 37 — Free Tier Gating | Complete |
| PLAN-08 | Phase 37 — Free Tier Gating | Complete |
| PLAN-09 | Phase 37 — Free Tier Gating | Complete |
| PLAN-12 | Phase 37 — Free Tier Gating | Complete |
| PLAN-14 | Phase 38 — Upgrade & Downgrade Lifecycle | Not started |
| PLAN-15 | Phase 38 — Upgrade & Downgrade Lifecycle | Not started |
| PLAN-16 | Phase 38 — Upgrade & Downgrade Lifecycle | Not started |
| PLAN-17 | Phase 38 — Upgrade & Downgrade Lifecycle | Not started |
| PLAN-18 | Phase 38 — Upgrade & Downgrade Lifecycle | Not started |
| PLAN-19 | Phase 39 — Paid-to-Paid Plan Changes | Not started |

**Coverage:**
- v1.12 requirements: 19 total, 2 deferred to v2 (PLAN-20, PLAN-21) plus BILL-01 carried forward
- Mapped to phases: 19/19 ✓
- Unmapped: 0

---
*Requirements drafted: 2026-07-14, from pricing-tiers brainstorm (see `.planning/PLAN-TIERS.md` for full design rationale)*
*Traceability updated: 2026-07-14, roadmap created (Phases 36-39, see `.planning/ROADMAP.md`)*
