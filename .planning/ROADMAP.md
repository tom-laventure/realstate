# Roadmap: RealState SaaS

## Milestones

- ✅ **v1.0 — Security, OAuth & Calendar** — Phases 1–5 (shipped 2026-05-13)
- ✅ **v1.1 — Domain Access Control** — Phases 6–7 (shipped 2026-05-16)
- 🔨 **v1.2 — Listing Map View** — Phases 8–10 (in progress)

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

## v1.2 — Listing Map View (Phases 8–10)

**Goal:** Give agents a geographic view of their listings — interactive Google Maps on the group dashboard (filter-synced, clustered) and on individual listing detail pages.

**Requirements:** MAP-01 through MAP-06 (6 total)

| # | Phase | Goal | Requirements |
|---|-------|------|--------------|
| 8 | 2/2 | Complete    | 2026-05-17 |
| 9 | Group Dashboard Map | Google Maps panel with filter sync, clustering, popup cards | MAP-02, MAP-03, MAP-05, MAP-06 |
| 10 | Listing Detail Map | Embedded map on individual listing detail page | MAP-04 |

### Phase 8: Geocoding & Data Layer

**Goal:** Give listings geographic coordinates — geocoded from address via Nominatim (OpenStreetMap). RETS/MLS coordinate ingestion is deferred to a future phase per Phase 8 CONTEXT D-06.

**Requirements:** MAP-01

**Success Criteria:**
1. Listings imported without MLS coordinates are geocoded via `GeocodingService` and stored
2. `latitude` and `longitude` appear in the group dashboard and listing detail API responses
3. `GeocodeListingsJob` backfills all existing listings that have an address but no coordinates
4. RETS/MLS coordinate ingestion deferred (D-06) — to be addressed in a future phase

**Plans:** 2/2 plans complete

Plans:
- [x] 08-01-PLAN.md — Migration adding latitude/longitude/geocoding_failed to listing_details + serializer + model attribute hints
- [x] 08-02-PLAN.md — GeocodingService (Nominatim wrapper) + GeocodeListingsJob (retry/after_discard) + geocode:backfill rake task + Minitest coverage

### Phase 9: Group Dashboard Map

**Goal:** Render an interactive Google Maps panel on the group dashboard with filter-synced pins, proximity clustering, and popup cards.

**Requirements:** MAP-02, MAP-03, MAP-05, MAP-06

**Success Criteria:**
1. Group dashboard shows a map panel with a pin for each listing in the group that has coordinates
2. Switching filter sets updates the map pins without a page reload
3. Listings within ~50m are grouped into a cluster pin showing a count badge
4. Clicking a cluster at max zoom shows a multi-listing popup with individual address + price rows, each linking to the listing detail
5. Clicking a single pin opens a popup with hero photo, price, address, bed/bath/sqft, and "View details" link

**Plans:** 4 plans

Plans:
- [x] 09-01-PLAN.md — Backend /coordinates endpoint on EstatesController + route + integration tests (Wave 1)
- [x] 09-02-PLAN.md — Frontend data layer: types, API module, TanStack hook, query key, GeneralDashboardContext wiring (Wave 1)
- [x] 09-03-PLAN.md — Install @vis.gl/react-google-maps + @googlemaps/markerclusterer + document VITE_GOOGLE_MAPS_API_KEY/MAP_ID env vars (Wave 1)
- [x] 09-04-PLAN.md — GroupMapPanel + GroupMapPinPopup + GroupMapClusterPopup components, wire into GeneralDashboard, human-verify end-to-end (Wave 2)

### Phase 10: Listing Detail Map

**Goal:** Show the property location on the individual listing detail page via an embedded Google Map.

**Requirements:** MAP-04

**Success Criteria:**
1. Listing detail page shows a Google Maps section with the property pinned at its exact location
2. Map section is absent (not a broken component) when the listing has no coordinates

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
| 9. Group Dashboard Map | v1.2 | 3/4 | Executing | — |
| 10. Listing Detail Map | v1.2 | 0/? | Pending | — |
