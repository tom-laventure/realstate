# Requirements — Milestone v1.3: Test Board & Board Management

## Seed Data

- [ ] **SEED-01**: All seeded listings belong to a single "Test RETS Board" (short_code: `TEST`) — REBGV, FVREB, CADREB removed from seeds
- [ ] **SEED-02**: All seeded brokerage board credentials reference the TEST board
- [ ] **SEED-03**: All 100 seeded listing addresses are real streets in/around North Vancouver, BC with matching hardcoded lat/lng coordinates
- [ ] **SEED-04**: Listings are seeded without pre-attached `BrokerageEstate` rows — access is granted when a brokerage connects to the board

## Board Model

- [ ] **BOARD-01**: `real_estate_boards` has an `is_test_board` boolean column (default `false`)
- [ ] **BOARD-02**: TEST board seeded with `is_test_board: true`; `is_test_board` exposed in `RealEstateBoardSerializer`

## Board Connect Flow

- [ ] **BOARD-03**: Connecting to any board auto-creates `BrokerageEstate` rows for all estates on that board (fired inside `POST /v1/admin/board_credentials`)
- [ ] **BOARD-04**: Connecting to a test board requires no RETS credentials — username/password validation skipped server-side
- [ ] **BOARD-05**: In the `ConnectBoardDialog`, selecting a test board skips the credentials step and shows an information notice ("This board contains sample listings for development — no real credentials required")

## Board Credential CRUD

- [ ] **BOARD-06**: Admin can delete a board credential (`DELETE /v1/admin/board_credentials/:id` — soft delete via `acts_as_paranoid`)
- [ ] **BOARD-07**: Admin can update credentials for an existing board registration (`PATCH /v1/admin/board_credentials/:id` — re-validates RETS for real boards, no-op validation for test boards)
- [ ] **BOARD-08**: Board Registrations table displays delete and edit actions per row

## Future Requirements

- Microsoft Calendar sync (CAL-04) — adapter built in v1.0, activate by expanding `PROVIDERS` + `providerOrder`
- Apple CalDAV sync (CAL-05) — adapter built in v1.0, activate by expanding `PROVIDERS` + `providerOrder`
- Two-way calendar sync — requires webhooks and conflict resolution
- Expanded test coverage: context hooks, calendar UI states
- CR-01: `BrokerageDomain.exists?` missing `.active` scope in `DomainsController#check`
- CR-02: S3 favicon upload outside transaction — orphaned on DB failure
- Rethink listing access model — BrokerageEstate vs board credential JOIN (see `.planning/todos/pending/arch-brokerage-listing-access.md`)

## Out of Scope

- Activating Microsoft or Apple calendar providers — separate milestone
- RETS feed polling / real listing import jobs — out of scope for this milestone; TEST board is the only sync mechanism
- Brokerage-level listing import preferences — future feature
- Two-way calendar sync — architectural change, separate milestone

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| SEED-01 | Phase 11 | pending |
| SEED-02 | Phase 11 | pending |
| SEED-03 | Phase 11 | pending |
| SEED-04 | Phase 11 | pending |
| BOARD-01 | Phase 11 | pending |
| BOARD-02 | Phase 11 | pending |
| BOARD-03 | Phase 12 | pending |
| BOARD-04 | Phase 12 | pending |
| BOARD-05 | Phase 13 | pending |
| BOARD-06 | Phase 14 | pending |
| BOARD-07 | Phase 14 | pending |
| BOARD-08 | Phase 14 | pending |
