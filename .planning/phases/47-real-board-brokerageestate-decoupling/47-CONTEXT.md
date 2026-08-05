# Phase 47: Real-board BrokerageEstate decoupling - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning
**Source:** grill-me interview session (no live /gsd:discuss-phase run — the ticket investigation and interview together already resolved every decision below)

<domain>
## Phase Boundary

Stop `BrokerageEstate` from being used as a real-board access/attribution mechanism now that `Estate.accessible_by` already grants real-board access via a `BrokerageBoardCredential` JOIN. Fix the two other consumers that still silently depend on `BrokerageEstate` existing for real-board estates, clean up the resulting redundant rows for already-connected real boards, and add missing test coverage for the two riskiest consumers touched. Maps to REQUIREMENTS.md: ARCH-01 through ARCH-06. Source ticket: Notion "Rethink listing access model — BrokerageEstate vs board credential JOIN" (P2/Tech Debt/Backlog, https://app.notion.com/p/3a9eab72c0ba819781deeb3247bce15c).

</domain>

<decisions>
## Implementation Decisions

### Scope & atomicity
- **D-01:** All four code changes (producer + 3 consumers) plus the cleanup migration and new tests ship in **one phase**, not split across multiple phases. Splitting leaves a window where either the auto-insert is gone but a consumer still relies on it, or consumers are fixed but the auto-insert (and its duplication problem) still runs.

### BoardCredentialsController#create (BOARD-03 change)
- **D-02:** Skip the `BrokerageEstate.insert_all` bulk-insert **only** when `!board.is_test_board?`. The TEST board must keep inserting `BrokerageEstate` rows on every connect, exactly as today — `Estate.accessible_by`'s first `EXISTS` branch (the `BrokerageBoardCredential` JOIN) explicitly excludes `reb.is_test_board = false`, so TEST-board access still depends entirely on the `BrokerageEstate` branch. This conditional is load-bearing, not optional.

### total_active_listings stat (V1::Admin::GroupsController#index, line 92)
- **D-03:** Swap `Current.brokerage.estates.without_deleted.count` (via `Brokerage has_many :estates, through: :brokerage_estates`) for `Estate.accessible_by(Current.brokerage.id).without_deleted.count`. This is a direct reuse of the existing scope — no new query logic needed.

### ResyncStalePhotosJob brokerage-attribution
- **D-04:** Add a private resolution method: for estates whose `real_estate_board_id` points at a real (non-test) board, resolve `brokerage_id` via `BrokerageBoardCredential.where(real_estate_board_id: ..., status: :active).pick(:brokerage_id)` — **any** active credential works, not necessarily "the" original connecting brokerage. Traced into `SyncListingPhotosJob`: the `brokerage_id` it receives is only used to look up that brokerage's own `BrokerageBoardCredential` for RETS auth to fetch photos, and photos are board-level data (identical regardless of which brokerage's credential fetches them) — so exclusivity of attribution was never actually required.
- **D-05:** Keep the existing `BrokerageEstate` → `GroupEstate` fallback chain **unchanged** for estates with no real board (`real_estate_board_id` nil) or on the TEST board — those still need `BrokerageEstate`/`GroupEstate` resolution exactly as today.
- **D-06:** Write the new real-board resolution as a **private method inside `ResyncStalePhotosJob` itself** — do not extract a shared helper/class method on `Estate` or elsewhere. Only one genuinely new query exists here (the `total_active_listings` swap reuses `accessible_by` as-is; `DeletionCascadeService` needs no new query at all) — there's nothing actually duplicated across call sites to justify an abstraction, and the query shapes are inverse of each other (`accessible_by` is "given a brokerage, find estates"; this is "given estates, find an eligible brokerage per board").
- **D-07:** Add a code comment in `ResyncStalePhotosJob` cross-referencing `Estate.accessible_by`, noting both encode "what counts as real-board access" and must be kept in sync if the access rules ever change (e.g. `status`/`is_test_board` conditions) — cheap safeguard against silent definition drift between the two, without forcing a shared abstraction.

### Brokerages::DeletionCascadeService
- **D-08:** **No logic change.** Update only the comments on `unlink_estates!` (currently lines 52-53) and the file-header comment (lines 13-17) to reflect that real-board estates are no longer touched by this cascade going forward — the loop iterates `brokerage.brokerage_estates`, and once D-02 ships, that will simply never include real-board estates for a given brokerage. This is judged to be *more* correct than today's behavior: today, if a brokerage is the sole connector to a real board and deletes itself, it hard-deletes shared board listings that another brokerage could still access later by connecting to that same board — a latent bug that self-corrects as a side effect of D-02, not something requiring its own fix.

### Cleanup migration for already-connected real boards
- **D-09:** Add a **one-time reversible data migration** (not just stopping new duplication going forward) that deletes existing `BrokerageEstate` rows where the estate's board is real (`is_test_board: false`) AND the owning brokerage holds an active `BrokerageBoardCredential` for that same board — i.e. rows now provably redundant with the JOIN-based access grant. Chosen over "leave legacy rows alone" specifically because leaving them would only half-fix the ticket's original complaint (duplication for already-connected boards persists indefinitely).
- **D-10:** Follow the precedent set by `backend/db/migrate/20260714000000_migrate_brokerage_plan_tiers.rb`: raw SQL via `execute`, explicit `up`/`down`, and a safety/orphan-count guard pattern.
- **D-11:** `down` must **repopulate** — bulk-insert `BrokerageEstate` rows for every currently-active non-test-board `BrokerageBoardCredential`'s estates (replaying the same `insert_all` logic `BOARD-03` used to run), not be a no-op/irreversible migration. Restores functionally-equivalent state (access/counts identical; `created_at` timestamps won't be byte-identical to the originals, which is acceptable) and keeps this a normal, revertible Rails migration consistent with the plan-tier precedent.

### Test coverage
- **D-12:** Add real test coverage as part of this phase for `ResyncStalePhotosJob` and `Brokerages::DeletionCascadeService` — **zero test files currently exist for either** (confirmed via `find` across `test/`), despite both being touched by this phase and both being exactly the kind of consumer that silently mis-resolves data when changed. Cover, at minimum: real-board vs. test-board/manual-estate resolution paths in the job, and the (now-correct) non-destruction of real-board estates on brokerage deletion in the cascade service.
- **D-13:** Also add/extend coverage for: real-board connect creates **zero** `BrokerageEstate` rows (new assertion — no existing test currently asserts this either way; `board_credential_crud_test.rb` only tests DELETE not touching pre-seeded `BrokerageEstate` rows, and `board_credentials_controller_test.rb` has no `create`-action test at all), TEST board connect still creates `BrokerageEstate` rows (regression guard against accidentally broadening D-02's conditional), `total_active_listings` stat correctness pre/post the swap, and the cleanup migration's `up`/`down` (delete-then-restore round trip).

### Claude's Discretion
- Exact SQL predicates and query structure inside the migration's `up`/`down` `execute` blocks — must match the semantics in D-09/D-11 but wording/formatting is an implementation detail.
- Exact test file names/locations for the new `ResyncStalePhotosJob` and `Brokerages::DeletionCascadeService` test files — follow this codebase's existing `test/jobs/` and `test/services/` conventions (mirror sibling test files' structure).
- Whether the migration's orphan/safety guard raises before or after the delete — follow the plan-tier migration's exact pattern (guard runs as a post-condition check after the update, see D-10).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §Architecture — Real-Board BrokerageEstate Decoupling — ARCH-01 through ARCH-06 exact requirement text
- `.planning/ROADMAP.md` Phase 47 section — goal, 5 success criteria

### Source Ticket & Prior Investigation
- Notion ticket "Rethink listing access model — BrokerageEstate vs board credential JOIN" (https://app.notion.com/p/3a9eab72c0ba819781deeb3247bce15c) — updated 2026-08-05 with the investigation findings this phase is built on
- `.planning/todos/pending/arch-brokerage-listing-access.md` — companion todo, tagged `resolves_phase: 47`, corrected file list matches this CONTEXT.md's canonical file list (not the ticket's original, partially-stale file list)

### Existing Code — Read Before Touching
- `backend/app/models/estate.rb` — `Estate.accessible_by` scope (the JOIN-based access pattern every consumer in this phase must align with or reference)
- `backend/app/controllers/v1/admin/board_credentials_controller.rb` — `#create` action, BOARD-03 bulk-insert (lines ~56-67)
- `backend/app/controllers/v1/admin/groups_controller.rb` — `#index`, `total_active_listings` (line 92)
- `backend/app/jobs/resync_stale_photos_job.rb` — full brokerage-resolution logic (lines 27-42) and its downstream consumer `backend/app/jobs/sync_listing_photos_job.rb` (confirms `brokerage_id` is only used for RETS credential lookup, per D-04)
- `backend/app/services/brokerages/deletion_cascade_service.rb` — `#unlink_estates!` and file-header comment
- `backend/db/migrate/20260714000000_migrate_brokerage_plan_tiers.rb` — migration pattern to mirror (raw SQL, up/down, orphan-count guard)
- `backend/test/controllers/v1/admin/board_credentials_controller_test.rb` and `backend/test/integration/board_credential_crud_test.rb` — existing test coverage baseline (confirms no `create`-action `BrokerageEstate` assertion exists yet)

</canonical_refs>

<specifics>
## Specific Ideas

- The migration's `up` predicate should be expressible as: `BrokerageEstate` rows where `EXISTS (real_estate_boards reb JOIN estates e ON e.real_estate_board_id = reb.id WHERE e.id = brokerage_estates.estate_id AND reb.is_test_board = false) AND EXISTS (brokerage_board_credentials bbc WHERE bbc.brokerage_id = brokerage_estates.brokerage_id AND bbc.real_estate_board_id = e.real_estate_board_id AND bbc.status = 'active' AND bbc.deleted_at IS NULL)` — deliberately mirrors the same real-board JOIN condition already proven correct in `Estate.accessible_by`'s first branch.
- `ResyncStalePhotosJob`'s new resolution step should sit alongside (not replace) the existing `BrokerageEstate.where(estate_id: estate_ids).pluck(...)` step — the real-board resolution only needs to run for whatever estate_ids remain unresolved after checking `BrokerageEstate` first (which still fully covers TEST-board/manual estates), or equivalently run first for real-board estates specifically and let the existing chain handle the remainder. Either ordering is fine as long as the final fallback chain (`BrokerageEstate` → `GroupEstate`) is preserved for non-real-board estates per D-05.

</specifics>

<deferred>
## Deferred Ideas

None — this phase is a complete, closed-loop fix for the ticket's stated problem. No follow-on work was identified during investigation or the grill-me session.

</deferred>

---

*Phase: 47-real-board-brokerageestate-decoupling*
*Context gathered: 2026-08-05 via grill-me interview + direct codebase investigation (no live /gsd:discuss-phase session)*
