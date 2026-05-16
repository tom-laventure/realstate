# Requirements: RealState SaaS Platform — v1.2

**Defined:** 2026-05-16
**Core Value:** Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.

## v1.2 Requirements

Requirements for the Listing Map View milestone. Each maps to a roadmap phase.

### Data Layer

- [ ] **MAP-01**: Listings have geocoded coordinates (lat/lng) stored server-side — sourced from RETS/MLS feed on import, or geocoded from address as fallback

### Group Dashboard Map

- [ ] **MAP-02**: Group dashboard renders an interactive Google Maps panel showing a pin for each listing in the group
- [ ] **MAP-03**: Group dashboard map updates its pins in real time when the active filter set changes — only filtered listings appear as pins
- [ ] **MAP-05**: Listings in close geographic proximity (e.g. same apartment building) are grouped into a cluster pin on the group map; expanding the cluster reveals individual listing cards

### Listing Detail Map

- [ ] **MAP-04**: The individual listing detail page shows an embedded Google Maps section with the property's location pinned

### Pin Interaction

- [ ] **MAP-06**: Clicking any listing pin (or expanding a cluster pin) opens a popup card displaying: hero photo, address, price, bed/bath count, sqft, and a "View details" link that navigates to the listing detail page

## Future Requirements

Tracked but deferred to a later milestone.

### Calendar Extensions

- **CAL-04**: Microsoft Calendar sync — adapter already built; activate by expanding `PROVIDERS` + `providerOrder`
- **CAL-05**: Apple CalDAV sync — adapter already built; activate by expanding `PROVIDERS` + `providerOrder`
- **CAL-TWO**: Two-way calendar sync — requires webhooks and conflict resolution

### Code Review Fixes (v1.3)

- **CR-01**: `BrokerageDomain.exists?` missing `.active` scope in `DomainsController#check` — pre-existing soft-delete gap
- **CR-02**: S3 favicon upload outside transaction — orphaned on DB failure

### Search

- **SRCH-01**: Free-text search across listings by address, MLS number, or keyword

## Out of Scope

| Feature | Reason |
|---------|--------|
| Microsoft / Apple social login | Auth milestone — separate from map work |
| JWT → HttpOnly cookies | Major architecture change; separate security milestone |
| Redux → Context/TanStack Query migration | Frontend refactor; separate cleanup milestone |
| Brokerage-wide map (all groups) | User did not request; adds cross-group data complexity |
| Saved searches | Search milestone (SRCH scope); out of this milestone |
| Two-way calendar sync | Requires webhook infrastructure; deferred |

## Traceability

Updated by roadmapper after roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MAP-01 | Phase 8 | Pending |
| MAP-02 | Phase 9 | Pending |
| MAP-03 | Phase 9 | Pending |
| MAP-04 | Phase 10 | Pending |
| MAP-05 | Phase 9 | Pending |
| MAP-06 | Phase 9 | Pending |

**Coverage:**
- v1.2 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-16*
*Last updated: 2026-05-16 after initial definition*
