# Roadmap: RealState SaaS

## Milestones

- ✅ **v1.0 — Security, OAuth & Calendar** — Phases 1–5 (shipped 2026-05-13)
- 🔄 **v1.1 — Domain Access Control** — Phases 6–7 (in progress)

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

<details open>
<summary>🔄 v1.1 — Domain Access Control (Phases 6–7) — IN PROGRESS</summary>

### Phase 6: Frontend Domain Routing Guards

**Goal:** React router conditionally enforces main-domain-only and subdomain-only route trees based on hostname.

**Requirements:** DOM-01, DOM-02, DOM-03

**Success criteria:**
1. On the main domain (`VITE_MAIN_DOMAIN`), visiting any non-`/create` URL renders the 404 error page
2. On the main domain, visiting `/create` renders the brokerage creation wizard correctly
3. On a brokerage subdomain, visiting `/create` redirects to `/` without rendering the wizard

**Plans:**

Wave 1 *(all tasks autonomous, no dependencies)*

- [ ] 06-01: Domain detection utility + frontend router split

---

### Phase 7: Backend Onboarding Guard

**Goal:** Rails API rejects all onboarding requests not originating from the main domain.

**Requirements:** DOM-04, DOM-05

**Success criteria:**
1. `POST /v1/onboarding/brokerage` from a brokerage subdomain returns HTTP 403
2. `POST /v1/onboarding/brokerage` from the main domain succeeds as before
3. Domain check and verify endpoints also return 403 from non-main-domain origins

**Plans:**
- [ ] 07-01: `MainDomainOnly` concern + apply to all onboarding controllers

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Security Foundation | v1.0 | 7/7 | Complete | 2026-05-02 |
| 2. Test Suite | v1.0 | 6/6 | Complete | 2026-05-03 |
| 3. Onboarding Fixes | v1.0 | 5/5 | Complete | 2026-05-05 |
| 4. Google OAuth | v1.0 | 4/4 | Complete | 2026-05-09 |
| 5. Calendar Sync | v1.0 | 7/7 | Complete | 2026-05-13 |
| 6. Frontend Domain Routing Guards | v1.1 | 0/1 | Pending | — |
| 7. Backend Onboarding Guard | v1.1 | 0/1 | Pending | — |
