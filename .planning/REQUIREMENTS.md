# Requirements: RealState SaaS Platform — v1.15

**Defined:** 2026-08-05
**Core Value:** Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.

## v1 Requirements

Requirements for this milestone. Single phase, all requirements map to it.

### Architecture — Real-Board BrokerageEstate Decoupling

- [x] **ARCH-01**: Connecting a real (non-test) board no longer bulk-inserts `BrokerageEstate` rows in `BoardCredentialsController#create` — access for real-board estates is already fully granted by `Estate.accessible_by`'s `BrokerageBoardCredential` JOIN branch. TEST board connects are unaffected and continue to auto-insert `BrokerageEstate` rows, since TEST-board access depends entirely on that branch.
- [x] **ARCH-02**: `V1::Admin::GroupsController#index`'s `total_active_listings` stat is computed via `Estate.accessible_by(brokerage)` instead of `Brokerage#estates` (the `BrokerageEstate` join), so it stays correct once real-board connects stop populating `BrokerageEstate`.
- [x] **ARCH-03**: `ResyncStalePhotosJob` resolves a `brokerage_id` for real-board estates via any active `BrokerageBoardCredential` for that estate's board, instead of `BrokerageEstate`. The existing `BrokerageEstate` → `GroupEstate` fallback chain is preserved for test-board and manually-added estates.
- [x] **ARCH-04**: `Brokerages::DeletionCascadeService#unlink_estates!`'s comments accurately describe that real-board estates are shared board data no longer touched by this cascade (the loop naturally stops iterating them once ARCH-01 ships) — no behavior change, documentation only.
- [ ] **ARCH-05**: A reversible data migration deletes existing `BrokerageEstate` rows that are now redundant — where the estate's board is real (`is_test_board: false`) and the owning brokerage holds an active `BrokerageBoardCredential` for that same board. `down` repopulates those rows by replaying the same bulk-insert logic real-board connects used to run.
- [ ] **ARCH-06**: `ResyncStalePhotosJob` and `Brokerages::DeletionCascadeService` have test coverage for the first time, exercising real-board vs. test-board/manual-estate resolution paths. Regression coverage confirms TEST board connects still create `BrokerageEstate` rows and real board connects do not.

## v2 Requirements

None — this milestone is a fully-scoped, single-phase cleanup with no deferred follow-on work identified.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Changes to `GroupEstatesQuery` | Investigated — it already resolves entirely through `@group.estates...accessible_by(@group.brokerage_id)`, no `BrokerageEstate` dependency exists there despite being listed in the original ticket's file list |
| Changes to group-add flow (`V1::Admin::Group::EstatesController`) | Already gates through `Estate.accessible_by(Current.brokerage)`, not `BrokerageEstate` — real-board listings can already be added to groups without a `BrokerageEstate` row existing |
| Redefining what counts as "actively managed" for reporting/analytics beyond the stat in ARCH-02 | Not raised by the original ticket or requested; would expand scope beyond the access/attribution duplication problem |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ARCH-01 | Phase 47 | Complete |
| ARCH-02 | Phase 47 | Complete |
| ARCH-03 | Phase 47 | Complete |
| ARCH-04 | Phase 47 | Complete |
| ARCH-05 | Phase 47 | Pending |
| ARCH-06 | Phase 47 | Pending |

**Coverage:**
- v1 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-05*
*Last updated: 2026-08-05 after initial definition*
