# Roadmap: RealState SaaS

## Milestones

- ✅ **v1.0 — Security, OAuth & Calendar** — Phases 1–5 (shipped 2026-05-13)
- ✅ **v1.1 — Domain Access Control** — Phases 6–7 (shipped 2026-05-16)
- ✅ **v1.2 — Listing Map View** — Phases 8–10 (shipped 2026-05-18)
- ✅ **v1.3 — Test Board & Board Management** — Phases 11–14 (shipped 2026-05-24)
- ✅ **v1.4 — Main Domain Admin Portal** — Phases 15–18 (shipped 2026-05-27)
- ✅ **v1.5 — Domain Management** — Phases 19–21 (shipped 2026-05-29)
- ✅ **v1.6 — Domain Management v2** — Phases 22–24 (shipped 2026-05-31)

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

<details>
<summary>✅ v1.5 — Domain Management (Phases 19–21) — SHIPPED 2026-05-29</summary>

- [x] Phase 19: Domain Schema & Auth Integration (3/3 plans) — completed 2026-05-27
- [x] Phase 20: Backend Domain API (3/3 plans) — completed 2026-05-28
- [x] Phase 21: Frontend — Redirect Guard & Domains Admin Page (4/4 plans) — completed 2026-05-29

Full details: [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md)

</details>

---

**v1.6 — Domain Management v2 (Phases 22–24)**

- [x] **Phase 22: DNS Verification & Health Monitoring Backend** — Background verification and health check jobs, auto-phase-out, rescue logic, owner email notifications, downgrade handling, domain state constraints (completed 2026-05-30)
- [x] **Phase 23: 301 Redirect & Primary Domain Enforcement** — Rails redirect middleware for non-primary domains, frozen domain redirects, system-link primary domain enforcement (completed 2026-05-31)
- [x] **Phase 24: Domain UI Overhaul** — Revamped card list with role-gating, 4-step add wizard, on-demand verify, delete flow with primary replacement, rescue confirmation, frozen badge (completed 2026-05-31)

---

## Phase Details

### Phase 22: DNS Verification & Health Monitoring Backend
**Goal**: The system autonomously monitors all custom domains, heals DNS changes without manual intervention, and notifies owners when action is required
**Depends on**: Phase 21 (existing domain model with status, phase_out_at, is_primary)
**Requirements**: DVER-02, DVER-05, DHLT-01, DHLT-02, DHLT-03, DHLT-04, DHLT-05, DLCX-01, DPRI-01, DPRI-02, DPRD-01, DPRD-03, DPRD-05, DPRD-06
**Success Criteria** (what must be TRUE):
  1. A SolidQueue recurring job runs every 30 minutes and checks CNAME records for all pending and phasing-out custom domains; verified domains are promoted to active
  2. A separate SolidQueue recurring job runs every 30 minutes against active custom domains; after 3 consecutive failures the domain is moved to phasing-out and Owner-role users receive an email naming the failed domain, failure reason, decommission date, and a dashboard link; if the domain was primary the email explicitly notes the subdomain is now serving as fallback
  3. When a phasing-out domain passes CNAME verification before its decommission date, its status is restored to active and phase_out_at is cleared
  4. When a brokerage plan downgrades from Pro, all custom domains are frozen (status transition), the subdomain is promoted to primary, and Owner-role users receive an email explaining the effect; on re-upgrade frozen domains are restored to active
  5. Health check interval and phase-out duration are defined as named constants in the codebase; no inline magic numbers
**Plans**: 5 plans

Plans:
- [x] 22-01-PLAN.md — DB migration, BrokerageDomain enum/constants/methods, serializer update
- [x] 22-02-PLAN.md — DomainMailer (health_failure, downgrade_notice, unverified_warning) + ERB templates
- [x] 22-03-PLAN.md — Brokerage freeze/unfreeze service methods + Ops::PlanController + routes
- [x] 22-04-PLAN.md — DomainsController D-08 pending creation + destroy pending branch
- [x] 22-05-PLAN.md — DomainVerificationJob + DomainHealthJob + recurring.yml

### Phase 23: 301 Redirect & Primary Domain Enforcement
**Goal**: Requests arriving at any non-primary domain are transparently redirected to the same path on the primary domain at the server layer; frozen domains also redirect
**Depends on**: Phase 22 (domain state machine complete, frozen state and primary promotion reliable)
**Requirements**: DPRI-03, DPRI-04, DPRD-02
**Success Criteria** (what must be TRUE):
  1. A request to `https://old.example.com/some/path` on a non-primary active domain receives an HTTP 301 response with Location pointing to the equivalent path on the brokerage's current primary domain
  2. A request arriving at a frozen custom domain receives a redirect to the brokerage's subdomain (no full app load on frozen domains)
  3. All system-generated emails (invitations, health-failure notifications, downgrade notices) use the current primary domain in links; changing the primary domain propagates to the next email sent
**Plans**: 2 plans

Plans:
- [x] 23-01-PLAN.md — DomainRedirectMiddleware + registration in application.rb + integration tests (DPRI-04, DPRD-02)
- [x] 23-02-PLAN.md — DPRI-03 mailer integration tests (DomainMailer + InvitationMailer, test-only)
**UI hint**: no

### Phase 24: Domain UI Overhaul
**Goal**: Brokerage owners and admins manage their domains through a polished, role-aware UI that surfaces verification state, guides through add and delete flows, and exposes all v1.6 lifecycle states
**Depends on**: Phase 22, Phase 23 (backend jobs, verification endpoints, redirect infrastructure all in place)
**Requirements**: DUIV-01, DUIV-02, DUIV-03, DUIV-04, DUIV-05, DUIV-06, DADD-01, DADD-02, DADD-03, DADD-04, DVER-01, DVER-03, DVER-04, DLCX-02, DLCX-03, DLCX-04, DPRD-04
**Success Criteria** (what must be TRUE):
  1. The Domains page renders a vertical card list with no column headers; each card shows the domain URL, a plain-language status description, relevant dates, and role-appropriate action controls; the subdomain card has a lock icon with tooltip; the primary domain has a Primary badge
  2. An Owner triggering "Add domain" enters a 4-step wizard ending with the domain appearing in the list as Pending; the DNS instructions step shows the exact CNAME record; the primary preference step appears only when another active domain exists
  3. A "Verify now" button appears on pending and phasing-out domain cards; pressing it enqueues an on-demand verification job; each card shows the last-checked timestamp and a plain-language failure reason when verification has failed
  4. Deleting the current primary domain requires selecting a replacement first (subdomain pre-selected); the confirmation dialog shows the decommission date; when a phasing-out domain is rescued a confirmation message appears on the dashboard
  5. Admins see full domain status and can trigger verification but cannot mutate; roles below Admin see a read-only list; frozen custom domain cards display a Frozen badge with an explanation and re-upgrade prompt
**Plans**: 4 plans

Plans:
- [x] 24-01-PLAN.md — Backend: verify endpoint, frozen scope, set_primary_on_verify migration + job, test fixes
- [x] 24-02-PLAN.md — Frontend contract: domain types, verifyDomain hook (rescue), add/remove hooks, Tooltip install
- [x] 24-03-PLAN.md — Components: DomainCard, DomainCardList, 4-step AddDomainWizard
- [x] 24-04-PLAN.md — Delete dialogs, context/container wiring, file deletions, human verification
**UI hint**: yes

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
| 19. Domain Schema & Auth Integration | v1.5 | 3/3 | Complete | 2026-05-27 |
| 20. Backend Domain API | v1.5 | 3/3 | Complete | 2026-05-28 |
| 21. Frontend — Redirect Guard & Domains Admin Page | v1.5 | 4/4 | Complete | 2026-05-29 |
| 22. DNS Verification & Health Monitoring Backend | v1.6 | 5/5 | Complete | 2026-05-30 |
| 23. 301 Redirect & Primary Domain Enforcement | v1.6 | 2/2 | Complete | 2026-05-31 |
| 24. Domain UI Overhaul | v1.6 | 4/4 | Complete | 2026-05-31 |
