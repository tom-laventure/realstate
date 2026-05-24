# Milestones

## v1.3 — Test Board & Board Management

**Shipped:** 2026-05-24
**Phases:** 4 | **Plans:** 11
**Timeline:** 2026-05-21 → 2026-05-24 (3 days)

### Delivered

Seed overhaul: single TEST board replaces REBGV/FVREB/CADREB; 100 real North Vancouver listings with hardcoded lat/lng, seeded without pre-attached BrokerageEstate rows (Phase 11). Board connect flow: `POST /v1/admin/board_credentials` bulk-inserts `BrokerageEstate` rows idempotently; test boards bypass RETS validation; `Estate#accessible_by` restructured for test-board estate visibility (Phase 12). Frontend connect dialog: `ConnectBoardDialog` test-board-info step skips credentials, shows blue info notice, handles server errors (Phase 13). Board credential CRUD: DELETE + PATCH backend endpoints with IDOR scoping, 10 integration tests; `EditBoardCredentialDialog` + 5-column Board Registrations table with per-row ⋯ dropdown and AlertDialog delete confirmation (Phase 14). All 12 requirements validated.

### Key Accomplishments

1. `is_test_board boolean null: false default: false` column + `test_boards`/`real_boards` scopes + serializer exposure — BOARD-01/02
2. `NV_LISTINGS` constant with 100 real North Vancouver addresses; per-street lat bands guarantee all 100 unique — SEED-01/02/03/04
3. `BrokerageEstate.insert_all unique_by: [:brokerage_id, :estate_id]` on board connect; `Estate#accessible_by` restructured — BOARD-03/04
4. `ConnectBoardDialog` test-board-info bypass step with blue info notice and server error handling — BOARD-05
5. `DELETE`/`PATCH /v1/admin/board_credentials/:id` with IDOR scoping, 10 integration tests, acts_as_paranoid soft delete — BOARD-06/07
6. `EditBoardCredentialDialog` + 5-column `BoardRegistrations` with DropdownMenu and controlled AlertDialog — BOARD-08

### Known Deferred Items at Close: 4

| Category | Item | Status |
|----------|------|--------|
| CAL-04 | Microsoft Calendar sync | Adapter built, activate by expanding PROVIDERS |
| CAL-05 | Apple CalDAV sync | Adapter built, activate by expanding PROVIDERS |
| CR-01 | `BrokerageDomain.exists?` missing `.active` scope | Pre-existing; address in v1.4 |
| CR-02 | S3 favicon upload outside transaction | Pre-existing; address in v1.4 |

### Archive

- Roadmap: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)
- Requirements: [milestones/v1.3-REQUIREMENTS.md](milestones/v1.3-REQUIREMENTS.md)
- Tag: `v1.3`

---

## v1.2 — Listing Map View

**Shipped:** 2026-05-18
**Phases:** 3 | **Plans:** 7
**Timeline:** 2026-05-16 → 2026-05-18 (2 days)

### Delivered

Geocoding pipeline seeded listing coordinates from Nominatim (OpenStreetMap) with retry/discard job semantics and a backfill rake task (Phase 8). Interactive Mapbox GL map panel on the group dashboard with filter-synced pins, use-supercluster proximity clustering, single-pin and cluster popups (Phase 9). Single-pin location map on individual listing detail pages, conditional on coordinates, placed outside the tab system (Phase 10). All 6 MAP requirements validated.

### Key Accomplishments

1. `decimal(10,6)` lat/lng + `geocoding_failed` on `listing_details` — zero-downtime PostgreSQL metadata-only migration — MAP-01
2. `GeocodingService` (Nominatim) + `GeocodeListingsJob` (retry/after_discard) + idempotent `geocode:backfill` rake task — MAP-01
3. `GET /v1/dashboard/groups/:id/estates/coordinates` — filter-synced, null-coord-excluding lightweight projection endpoint — MAP-02/03
4. `GroupMapPanel` with use-supercluster clustering, `keepPreviousData`, custom Marker child, `fitBounds` on first load only — MAP-02/03/05
5. `GroupMapPinPopup` + `GroupMapClusterPopup` with hero photo, price, address, bed/bath/sqft, "View details" links — MAP-06
6. `EstateLocationMap` single-pin Mapbox component on listing detail page; absent when listing has no coordinates — MAP-04

### Known Deferred Items at Close: 0

No items deferred at milestone close.

### Archive

- Roadmap: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- Requirements: [milestones/v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md)
- Tag: `v1.2`

---

## v1.1 — Domain Access Control

**Shipped:** 2026-05-16
**Phases:** 2 | **Plans:** 2
**Timeline:** 2026-05-13 → 2026-05-16 (3 days)

### Delivered

Full-stack domain enforcement: frontend `DomainGuard` React components enforce main-domain-only (`/create`) and subdomain-only routes via `VITE_MAIN_DOMAIN` env var (Phase 6). Backend `MainDomainOnly` Rails concern rejects non-main-domain requests on all four `/v1/onboarding/*` endpoints with HTTP 403 before Cognito auth runs (Phase 7). Both layers read domain config from env vars — no hardcoded strings. All 5 DOM requirements validated.

### Key Accomplishments

1. `isMainDomain()` utility + `SubdomainOnly`/`MainDomainOnly` guard components wired into React router — DOM-01/02/03
2. `NotFound` page per UI-SPEC — renders on all non-`/create` routes from main domain
3. `MainDomainOnly` Rails concern: Origin-first extraction, `URI::InvalidURIError` rescue, `APP_BASE_DOMAIN` env config — DOM-04/05
4. Guard runs before Cognito auth — wrong-domain requests return 403, not 401 (correct security ordering)
5. 22 backend integration tests (17 prior + 5 new), 0 failures; 8 frontend unit tests (all passing)
6. Code review surfaced 2 pre-existing critical issues (soft-delete filter gap, S3 orphan) — logged for v1.2

### Known Deferred Items at Close: 2

| Category | Item | Status |
|----------|------|--------|
| CR-01 | `BrokerageDomain.exists?` missing `.active` scope in `DomainsController#check` | Pre-existing; address in v1.2 |
| CR-02 | S3 favicon upload outside transaction — orphaned on DB failure | Pre-existing; address in v1.2 |

### Archive

- Roadmap: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- Requirements: [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md)
- Tag: `v1.1`

---

## v1.0 — Security, OAuth & Calendar

**Shipped:** 2026-05-13
**Phases:** 5 | **Plans:** 30
**Timeline:** 2026-04-29 → 2026-05-13 (14 days)

### Delivered

Server-side RBAC enforcement, rack-attack rate limiting, CORS hardening, N+1 fixes, and tech debt cleanup (Phase 1) — followed immediately by a backend + frontend test suite proving the fixes (Phase 2). Onboarding flows fixed: domain wizard, post-invite redirect, and welcome banner (Phase 3). Google social login shipped atomically with PreSignUp Lambda account linking and intermediary callback page (Phase 4). Google Calendar sync with advisory-lock job, encrypted credential storage, and settings UI (Phase 5).

### Key Accomplishments

1. `Admin::BaseController#require_admin!` closed the RBAC gap across all 13 admin controllers — SEC-01
2. Backend integration test suite: 17 tests covering tenant isolation, RBAC, FilterSets, GroupEstatesQuery, InvitationsController
3. Frontend test suite: Vitest 4.x + MSW 2.x, 7 tests covering ProtectedRoute, RequireRole, GoogleSignInButton
4. Google OAuth federation via Cognito + PreSignUp Lambda with `AdminLinkProviderForUser` email linking
5. `CalendarSyncJob` with PostgreSQL advisory lock, deterministic event IDs, and token refresh — wired to EstateEventsController fan-out
6. Calendar settings UI: CalendarTab + ProviderCard + CalendarContext, Google provider connected and verified

### Known Deferred Items at Close: 2

| Category | Item | Status |
|----------|------|--------|
| CAL-04 | Microsoft Calendar sync | Adapter built, activate in v2 by expanding PROVIDERS |
| CAL-05 | Apple CalDAV sync | Adapter built, activate in v2 by expanding PROVIDERS |

### Archive

- Roadmap: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- Requirements: [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)
- Tag: `v1.0`
