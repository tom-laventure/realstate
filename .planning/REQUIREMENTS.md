# Requirements: RealState SaaS Platform — v1.7

**Defined:** 2026-05-31
**Core Value:** Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.

## v1.7 Requirements

### Navigation & Routing

- [ ] **NAV-01**: New `/admin/boards` route exists and renders a dedicated Board Registrations page
- [ ] **NAV-02**: `AdminBoardSideNav` (subdomain) has a "Board Registrations" nav item pointing to `/admin/boards`, positioned between "Brokerage" and "Users"
- [ ] **NAV-03**: `PortalAdminSideNav` (main domain portal) has "Brokerage" item pointing to `/admin/brokerage` and "Board Registrations" item pointing to `/admin/boards`, in that order before "Users"

### Page Content

- [ ] **NAV-04**: `/admin/brokerage` renders Brokerage Information and Branding only (no Board Registrations section)
- [ ] **NAV-05**: `/admin/boards` renders the Realtor Board Registrations table with all existing functionality (connect, edit, delete)

### Data & Context

- [ ] **NAV-06**: Board Registrations page has its own context (`BoardsAdminBoardContext`) with board credential fetches and mutations — not dependent on brokerage data fetch
- [ ] **NAV-07**: Brokerage page context (`BrokerageAdminBoardContext`) no longer fetches board credentials or boards

## Future Requirements

*(No deferred requirements for this milestone — scope is fully contained)*

## Out of Scope

| Feature | Reason |
|---------|--------|
| Tabs within the Brokerage page | Info + Branding stay as a single scrolling page; no tab UI needed |
| Listing access model refactor | Architecture work deferred to v1.8 |
| UX improvements (tab state, deep-links) | Deferred to v1.8 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-01 | Phase 25 | Pending |
| NAV-02 | Phase 25 | Pending |
| NAV-03 | Phase 25 | Pending |
| NAV-04 | Phase 25 | Pending |
| NAV-05 | Phase 25 | Pending |
| NAV-06 | Phase 25 | Pending |
| NAV-07 | Phase 25 | Pending |

**Coverage:**
- v1.7 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-31*
*Last updated: 2026-05-31 after initial definition*
