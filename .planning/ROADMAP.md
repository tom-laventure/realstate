# Roadmap: RealState SaaS

## Milestones

- ✅ **v1.0 — Security, OAuth & Calendar** — Phases 1–5 (shipped 2026-05-13)
- ✅ **v1.1 — Domain Access Control** — Phases 6–7 (shipped 2026-05-16)
- ✅ **v1.2 — Listing Map View** — Phases 8–10 (shipped 2026-05-18)
- ✅ **v1.3 — Test Board & Board Management** — Phases 11–14 (shipped 2026-05-24)
- ✅ **v1.4 — Main Domain Admin Portal** — Phases 15–18 (shipped 2026-05-27)
- 🔄 **v1.5 — Domain Management** — Phases 19–21 (in progress)

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

<details>
<summary>✅ v1.4 — Main Domain Admin Portal (Phases 15–18) — SHIPPED 2026-05-27</summary>

- [x] Phase 15: Backend API & BrokerageAuth Extension (2/2 plans) — completed 2026-05-24
- [x] Phase 16: Main Domain Routing & Auth Guards (2/2 plans) — completed 2026-05-25
- [x] Phase 17: Brokerage Selection & Post-Create Redirect (3/3 plans) — completed 2026-05-26
- [x] Phase 18: Dashboard Shell, Admin Suite & Brokerage Switcher (5/5 plans) — completed 2026-05-27

Full details: [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md)

</details>

---

## v1.5 — Domain Management (Phases 19–21)

### Phase 19: Domain Schema & Auth Integration

**Goal**: Extend brokerage_domains with lifecycle columns, backfill existing data as active primary subdomains, and update BrokerageAuth + the Caddy TLS endpoint to route by status — so phasing-out domains still resolve and decommissioned ones don't
**Depends on**: Phase 18
**Requirements**: DMOD-01, DMOD-02, DMOD-03, DMOD-04, DINT-03, DINT-04
**Plans**: 3 plans

Plans:
- [ ] 19-01-PLAN.md — Lifecycle columns migration (add 4 columns, backfill, replace unique index)
- [ ] 19-02-PLAN.md — BrokerageDomain model (enums, RESERVED_SLUGS, routable scope, validations)
- [ ] 19-03-PLAN.md — Routing integration (BrokerageAuth + DomainsController + factory + tests)

**Success criteria:**
1. Migration runs cleanly; all current brokerage_domains rows show `domain_type: subdomain`, `status: active`, `is_primary: true`
2. `BrokerageAuth` resolves a brokerage from a domain with `status: phasing_out` and returns 404 for `status: decommissioned`
3. `GET /v1/domains/check` returns 404 for a decommissioned domain
4. A subdomain slug with a space or reserved word (`admin`, `api`, etc.) fails model validation with a clear message
5. All existing backend integration tests continue to pass after the migration

---

### Phase 20: Backend Domain API

**Goal**: Implement the full domain management API — CRUD endpoints for subdomain editing and custom domain management, lifecycle validation (phase-out blocking/warnings), Pro-tier gating, public primary-domain lookup, and invitation email canonicalization
**Depends on**: Phase 19
**Requirements**: DMOD-05, DMOD-06, DMOD-07, DMOD-08, DMOD-09, DMOD-10, DMOD-11, DMOD-12, DMOD-13, DMOD-14, DINT-02
**Plans**: TBD

**Success criteria:**
1. `GET /v1/admin/domains` returns all active + phasing-out domains with correct fields
2. `PATCH /v1/admin/domains/subdomain` creates a new active subdomain and transitions the old one to phasing-out (phase_out_at = 30 days from now)
3. A third subdomain change attempt when 2 phasing-out subdomains exist returns HTTP 422 with `earliest_slot_available_at`
4. `DELETE /v1/admin/domains/:id` on a phasing-out domain sets `status: decommissioned` and `deleted_at: now` immediately
5. `PATCH /v1/admin/domains/:id/set_primary` rejects a phasing-out domain with HTTP 422
6. `GET /v1/domains/lookup?domain=X` returns the primary domain for the owning brokerage; 404 for unknown domains
7. Invitation emails reference the `is_primary: true` domain, not the first record

---

### Phase 21: Frontend — Redirect Guard & Domains Admin Page

**Goal**: Deliver the full Domains admin page where admins can view and manage all brokerage domains, and add an app-init redirect guard so users arriving on a non-primary domain are silently sent to the equivalent path on the primary domain
**Depends on**: Phase 20
**Requirements**: DINT-01, DUI-01, DUI-02, DUI-03, DUI-04, DUI-05, DUI-06, DUI-07, DUI-08, DUI-09
**Plans**: TBD

**Success criteria:**
1. Visiting a phasing-out domain URL in the browser redirects to the same path + query on the primary domain
2. Domains admin page lists all active and phasing-out domains with type badges, status badges, and phase-out countdowns
3. Admin can edit subdomain (client-side slug validation before submit), add/remove custom domain (Pro), and set a domain as primary
4. Phasing-out domain shows "Remove now"; confirmation dialog warns the domain stops resolving immediately
5. Non-Pro brokerage sees the custom domain section locked with an upgrade prompt
6. "Domains" nav item appears in both the subdomain admin sidebar and the main-domain portal admin sidebar

---

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
| 16. Main Domain Routing & Auth Guards | v1.4 | 2/2 | Complete | 2026-05-25 |
| 17. Brokerage Selection & Post-Create Redirect | v1.4 | 3/3 | Complete | 2026-05-26 |
| 18. Dashboard Shell, Admin Suite & Brokerage Switcher | v1.4 | 5/5 | Complete | 2026-05-27 |
| 19. Domain Schema & Auth Integration | v1.5 | 0/3 | Pending | — |
| 20. Backend Domain API | v1.5 | 0/TBD | Pending | — |
| 21. Frontend — Redirect Guard & Domains Admin Page | v1.5 | 0/TBD | Pending | — |
