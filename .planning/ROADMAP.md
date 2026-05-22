# Roadmap: RealState SaaS

## Milestones

- ✅ **v1.0 — Security, OAuth & Calendar** — Phases 1–5 (shipped 2026-05-13)
- ✅ **v1.1 — Domain Access Control** — Phases 6–7 (shipped 2026-05-16)
- ✅ **v1.2 — Listing Map View** — Phases 8–10 (shipped 2026-05-18)
- 🚧 **v1.3 — Test Board & Board Management** — Phases 11–14 (in progress)

## Phases

<details>
<summary>✅ v1.0 — Security, OAuth & Calendar (Phases 1–5) — SHIPPED 2026-05-13</summary>

- [x] Phase 1: Security Foundation (7/7 plans) — completed 2026-05-02
- [x] Phase 2: Test Suite (6/6 plans) — completed 2026-05-03
- [x] Phase 3: Onboarding Fixes (5/5 plans) — completed 2026-05-05
- [x] Phase 4: Google OAuth (4/4 plans) — completed 2026-05-09
- [x] Phase 5: Calendar Sync — Google only (7/7 plans) — completed 2026-05-13

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 — Domain Access Control (Phases 6–7) — SHIPPED 2026-05-16</summary>

- [x] Phase 6: Frontend Domain Routing Guards (1/1 plans) — completed 2026-05-14
- [x] Phase 7: Backend Onboarding Guard (1/1 plans) — completed 2026-05-16

Full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

<details>
<summary>✅ v1.2 — Listing Map View (Phases 8–10) — SHIPPED 2026-05-18</summary>

- [x] Phase 8: Geocoding & Data Layer (2/2 plans) — completed 2026-05-16
- [x] Phase 9: Group Dashboard Map (4/4 plans) — completed 2026-05-17
- [x] Phase 10: Listing Detail Map (1/1 plans) — completed 2026-05-18

Full details: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

</details>

### 🚧 v1.3 — Test Board & Board Management (In Progress)

**Milestone Goal:** Replace multi-board seed data with a single TEST board (real North Vancouver addresses + coords), add a test board connect flow that skips RETS credentials and auto-associates listings, and add delete/edit CRUD to the Board Registrations table.

- [ ] **Phase 11: DB Migration & Seed Overhaul** - Add `is_test_board` column, update model + serializer, replace multi-board seeds with single TEST board (100 real NV listings)
- [ ] **Phase 12: Board Connect Flow — Backend** - Auto-associate listings on board connect; skip RETS credential validation for test boards
- [ ] **Phase 13: Board Connect Flow — Frontend** - `ConnectBoardDialog` detects test board, skips credentials step, shows info notice
- [ ] **Phase 14: Board Credential CRUD** - DELETE + PATCH backend endpoints and corresponding frontend table actions

## Phase Details

### Phase 11: DB Migration & Seed Overhaul
**Goal**: The database has an `is_test_board` flag on boards, the TEST board is the only seeded board with `is_test_board: true`, and 100 listings with real North Vancouver addresses and hardcoded lat/lng are seeded without pre-attached BrokerageEstate rows
**Depends on**: Phase 10 (v1.2 complete)
**Requirements**: SEED-01, SEED-02, SEED-03, SEED-04, BOARD-01, BOARD-02
**Success Criteria** (what must be TRUE):
  1. Running `rails db:seed` produces exactly one real estate board with `short_code: 'TEST'` and `is_test_board: true`; REBGV, FVREB, and CADREB are absent
  2. 100 seeded listings each have a real North Vancouver street address and non-null `lat`/`lng` values matching known coordinates
  3. No `BrokerageEstate` rows are created during seeding — listings exist on the TEST board but brokerages have no access until they connect
  4. `GET /v1/admin/real_estate_boards` (or equivalent board list endpoint) returns `is_test_board: true` for the TEST board
**Plans**: 3 plans

Plans:

**Wave 1**
- [x] 11-01-PLAN.md — Migration + model scopes + serializer (is_test_board column, test_boards/real_boards scopes, :is_test_board serializer attribute)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 11-02-PLAN.md — Constants + board seed overhaul + seeds.rb cleanup (BOARD_SHORT_CODES → TEST, 09_real_estate_boards.rb → TEST only, remove dropped file references)

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 11-03-PLAN.md — Estate seed rewrite + file deletions (NV_LISTINGS, remove BrokerageEstate/GroupEstate, delete 06/07/08, db:reset verification)

### Phase 12: Board Connect Flow — Backend
**Goal**: Connecting a board via `POST /v1/admin/board_credentials` bulk-inserts `BrokerageEstate` rows for all estates on that board, and test boards bypass RETS credential validation entirely
**Depends on**: Phase 11
**Requirements**: BOARD-03, BOARD-04
**Success Criteria** (what must be TRUE):
  1. After posting board credentials for the TEST board, all estates belonging to that board have a `BrokerageEstate` row scoped to the connecting brokerage
  2. Connecting to the TEST board with no username/password (or any credentials) succeeds — no RETS validation error is returned
  3. Connecting to a non-test board still performs RETS credential validation before creating the credential record
**Plans**: TBD

### Phase 13: Board Connect Flow — Frontend
**Goal**: When an admin selects a test board in `ConnectBoardDialog`, the credentials form step is skipped and a descriptive information notice is displayed
**Depends on**: Phase 12
**Requirements**: BOARD-05
**Success Criteria** (what must be TRUE):
  1. Selecting the TEST board in `ConnectBoardDialog` never renders the username/password credential fields
  2. An information notice reading "This board contains sample listings for development — no real credentials required" (or equivalent clear copy) is visible when the test board is selected
  3. The connect action completes successfully from the dialog without entering any credentials
**Plans**: TBD
**UI hint**: yes

### Phase 14: Board Credential CRUD
**Goal**: Admins can delete or update any board credential row directly from the Board Registrations table
**Depends on**: Phase 13
**Requirements**: BOARD-06, BOARD-07, BOARD-08
**Success Criteria** (what must be TRUE):
  1. Clicking delete on a board credential row soft-deletes the record — the row disappears from the table and is no longer returned by the API
  2. Clicking edit on a board credential row opens a form to re-enter credentials; submitting updates the record (test boards skip RETS re-validation; real boards re-validate)
  3. Both delete and edit actions are visible per row in the Board Registrations table in the admin UI
  4. Deleting a board credential does not hard-delete the underlying `BrokerageEstate` rows (soft delete only on the credential)
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Security Foundation | v1.0 | 7/7 | Complete | 2026-05-02 |
| 2. Test Suite | v1.0 | 6/6 | Complete | 2026-05-03 |
| 3. Onboarding Fixes | v1.0 | 5/5 | Complete | 2026-05-05 |
| 4. Google OAuth | v1.0 | 4/4 | Complete | 2026-05-09 |
| 5. Calendar Sync | v1.0 | 7/7 | Complete | 2026-05-13 |
| 6. Frontend Domain Routing Guards | v1.1 | 1/1 | Complete | 2026-05-14 |
| 7. Backend Onboarding Guard | v1.1 | 1/1 | Complete | 2026-05-16 |
| 8. Geocoding & Data Layer | v1.2 | 2/2 | Complete | 2026-05-16 |
| 9. Group Dashboard Map | v1.2 | 4/4 | Complete | 2026-05-17 |
| 10. Listing Detail Map | v1.2 | 1/1 | Complete | 2026-05-18 |
| 11. DB Migration & Seed Overhaul | v1.3 | 2/3 | In Progress|  |
| 12. Board Connect Flow — Backend | v1.3 | 0/? | Not started | - |
| 13. Board Connect Flow — Frontend | v1.3 | 0/? | Not started | - |
| 14. Board Credential CRUD | v1.3 | 0/? | Not started | - |
