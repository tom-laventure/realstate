# Roadmap: RealState SaaS

## Milestones

- ✅ **v1.0 — Security, OAuth & Calendar** — Phases 1–5 (shipped 2026-05-13)
- ✅ **v1.1 — Domain Access Control** — Phases 6–7 (shipped 2026-05-16)
- ✅ **v1.2 — Listing Map View** — Phases 8–10 (shipped 2026-05-18)
- ✅ **v1.3 — Test Board & Board Management** — Phases 11–14 (shipped 2026-05-24)
- 🚧 **v1.4 — Main Domain Admin Portal** — Phases 15–18 (in progress)

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

<details>
<summary>✅ v1.3 — Test Board & Board Management (Phases 11–14) — SHIPPED 2026-05-24</summary>

- [x] Phase 11: DB Migration & Seed Overhaul (3/3 plans) — completed 2026-05-22
- [x] Phase 12: Board Connect Flow — Backend (3/3 plans) — completed 2026-05-23
- [x] Phase 13: Board Connect Flow — Frontend (2/2 plans) — completed 2026-05-24
- [x] Phase 14: Board Credential CRUD (3/3 plans) — completed 2026-05-24

Full details: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)

</details>

### 🚧 v1.4 — Main Domain Admin Portal (In Progress)

**Milestone Goal:** Give brokerage admins a main-domain portal where they can manage all their brokerages in one place — without relying on individual subdomain URLs.

- [x] **Phase 15: Backend API & BrokerageAuth Extension** - New admin_brokerages endpoint + X-Brokerage-Id header resolution — completed 2026-05-24
- [ ] **Phase 16: Main Domain Routing & Auth Guards** - /dashboard/* routes, sign-in routing, no-access screen
- [ ] **Phase 17: Brokerage Selection & Post-Create Redirect** - Selection screen, auto-select, post-wizard redirect
- [ ] **Phase 18: Dashboard Shell, Admin Suite & Brokerage Switcher** - Full dashboard UI with brokerage context and nav switcher

## Phase Details

### Phase 15: Backend API & BrokerageAuth Extension
**Goal**: Backend serves main-domain admin requests by resolving brokerage context from a request header and exposes an endpoint listing all brokerages where the authenticated user is admin or owner
**Depends on**: Phase 14
**Requirements**: BE-01, BE-02, BE-03
**Success Criteria** (what must be TRUE):
  1. Authenticated admin calling `GET /v1/account/admin_brokerages` from the main domain receives a list of brokerage records (name, id, role) covering all brokerages where they hold admin or owner role
  2. An existing `/v1/admin/**` endpoint called from the main domain with a valid `X-Brokerage-Id` header returns the correct brokerage-scoped data (same response as if called from that brokerage's subdomain)
  3. An existing `/v1/admin/**` endpoint called from the main domain without an `X-Brokerage-Id` header returns HTTP 400 Bad Request (not a 500 or silent resolution failure)
**Plans**: 2/2 complete — 2026-05-24

### Phase 16: Main Domain Routing & Auth Guards
**Goal**: The main domain serves a `/dashboard/*` route tree, sign-in correctly routes authenticated users to the admin portal or a no-access screen, and unauthenticated users cannot reach dashboard pages
**Depends on**: Phase 15
**Requirements**: PORTAL-01, AUTH-05, AUTH-06, AUTH-07
**Success Criteria** (what must be TRUE):
  1. Navigating to any `/dashboard/*` URL on the main domain renders the portal shell (no 404, no redirect to `/create`)
  2. A user who signs in on the main domain and holds at least one admin or owner role is redirected to /dashboard (brokerage selection placeholder — full selection screen ships in Phase 17 per D-05)
  3. A user who signs in on the main domain with no admin roles anywhere sees a no-access screen explaining they must use their brokerage subdomain
  4. An unauthenticated user who navigates directly to any `/dashboard/*` URL is redirected to the sign-in page
**Plans**: TBD
**UI hint**: yes

### Phase 17: Brokerage Selection & Post-Create Redirect
**Goal**: Users land on the right brokerage context after sign-in and after completing the creation wizard — one-brokerage admins skip the selection screen, multi-brokerage admins choose from cards
**Depends on**: Phase 16
**Requirements**: BROK-01, BROK-02, ONB-04
**Success Criteria** (what must be TRUE):
  1. An admin with multiple brokerages sees one card per brokerage on the selection screen, each showing the brokerage name and the user's role in that brokerage
  2. An admin who manages exactly one brokerage is automatically redirected to the dashboard without seeing the selection screen
  3. A user who completes the brokerage creation wizard lands on the main domain dashboard with the newly created brokerage already selected as the active context
**Plans**: TBD
**UI hint**: yes

### Phase 18: Dashboard Shell, Admin Suite & Brokerage Switcher
**Goal**: The main domain dashboard presents the full admin panel (board registrations, user management, group management, invitations) scoped to the selected brokerage, with the active brokerage name and role visible in the nav bar and a dropdown to switch brokerage without leaving the page
**Depends on**: Phase 17
**Requirements**: PORTAL-02, PORTAL-03, BROK-03, BROK-04
**Success Criteria** (what must be TRUE):
  1. From the main domain dashboard, the user can navigate to board registrations, user management, group management, and invitations — each panel loads data scoped to the active brokerage
  2. The nav bar displays the name of the active brokerage and the user's role within it at all times while on the dashboard
  3. The user can open a brokerage dropdown in the nav bar and select a different brokerage without navigating away from the current page
  4. After switching brokerage via the nav dropdown, all visible admin panel data updates to reflect the newly selected brokerage
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
| 11. DB Migration & Seed Overhaul | v1.3 | 3/3 | Complete | 2026-05-22 |
| 12. Board Connect Flow — Backend | v1.3 | 3/3 | Complete | 2026-05-23 |
| 13. Board Connect Flow — Frontend | v1.3 | 2/2 | Complete | 2026-05-24 |
| 14. Board Credential CRUD | v1.3 | 3/3 | Complete | 2026-05-24 |
| 15. Backend API & BrokerageAuth Extension | v1.4 | 2/2 | Complete | 2026-05-24 |
| 16. Main Domain Routing & Auth Guards | v1.4 | 0/TBD | Not started | - |
| 17. Brokerage Selection & Post-Create Redirect | v1.4 | 0/TBD | Not started | - |
| 18. Dashboard Shell, Admin Suite & Brokerage Switcher | v1.4 | 0/TBD | Not started | - |
