---
phase: 09-group-dashboard-map
verified: 2026-05-17T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "MAP-02 — Map panel renders with pins"
    expected: "Mapbox map panel visible between filter bar and listings grid; pins per geocoded listing; heading 'Listings on the map' visible"
    why_human: "Visual rendering of map tiles and pin placement cannot be verified programmatically"
    result: approved
  - test: "MAP-03 — Filter sync"
    expected: "City filter updates map pins and listings grid together within ~500ms; no flash to empty state during refetch"
    why_human: "Real-time UI behavior and absence of flash require human observation"
    result: approved
  - test: "MAP-05 — Clustering"
    expected: "Cluster badges appear on zoom out; cluster click zooms in; max-zoom cluster click opens multi-listing popup with address/price rows"
    why_human: "Spatial clustering behavior and interactive zoom require human observation"
    result: approved
  - test: "MAP-06 — Single pin popup"
    expected: "Click a single pin; popup with hero photo, price badge, address, bed/bath/sqft row, 'View details' link appears"
    why_human: "Interactive popup content and link destination require human observation"
    result: approved
  - test: "Error state — missing token"
    expected: "Remove VITE_MAPBOX_TOKEN, restart; panel shows 'Mapbox token not configured'"
    why_human: "Shell state rendering requires human observation"
    result: approved
  - test: "Accessibility — keyboard and aria"
    expected: "'View details' link keyboard-focusable; cluster popup arrow links have non-empty aria-label values"
    why_human: "Keyboard interaction and assistive-technology behavior require human testing"
    result: approved
---

# Phase 9: Group Dashboard Map Verification Report

**Phase Goal:** Add an interactive Mapbox map panel to the group dashboard showing geocoded estate pins with proximity clustering, single-pin popups, and cluster popups — all filter-synced with the existing listings grid.
**Verified:** 2026-05-17
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Authenticated group member can GET /v1/dashboard/groups/:group_id/estates/coordinates and receive a 200 JSON response | VERIFIED | `def coordinates` exists in `estates_controller.rb` (line 180); route `get :coordinates` in `routes.rb` (line 132) inside the existing collection block; 6 integration tests pass including the 200 happy-path case |
| 2  | Response contains a `coordinates` array filtered by GroupEstatesQuery — soft-deleted and NULL-coord estates excluded | VERIFIED | Controller uses `GroupEstatesQuery.new(@group, Current.user, params).call.joins(:listing_detail).where.not(listing_details: {latitude: nil}).where.not(listing_details: {longitude: nil})`; 3 integration tests cover soft-delete, NULL-coord, and filter-forwarding |
| 3  | Each coordinate entry includes id, latitude, longitude, listPrice, address, beds, baths, sqft, heroImageUrl | VERIFIED | Controller builds the hash with exactly those 9 keys; integration test asserts `expected_keys = ["id", "latitude", "longitude", "listPrice", "address", "beds", "baths", "sqft", "heroImageUrl"].to_set` |
| 4  | Frontend data layer exposes `state.mapCoordinates`, `state.isMapLoading`, `state.isMapError` from `GeneralDashboardContext`, with all filter params forwarded (no pagination) | VERIFIED | `GeneralDashboardContext.tsx` lines 78-106 call `useFetchGroupEstateCoordinates` with all 22 filter params, no `pagination` field; lines 190-192 expose the three state fields; dependency array includes all three at lines 295-297 |
| 5  | GroupMapPanel renders on the group dashboard between ListingsFilterBar and ListingsGrid, with clustering, single-pin popup, cluster popup, and all shell states | VERIFIED | `GeneralDashboard.tsx` imports `GroupMapPanel` (line 14) and renders it at lines 136-142 (after `ListingsFilterBar` at line 83, before `ListingsGrid` at line 143); `GroupMapPanel.tsx` imports from `react-map-gl/mapbox`, `use-supercluster`, `mapbox-gl/dist/mapbox-gl.css`; four shell states implemented; human verification approved all 6 sections |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/controllers/v1/dashboard/group/estates_controller.rb` | `#coordinates` action | VERIFIED | Action at line 180; uses `GroupEstatesQuery`, `joins(:listing_detail)`, NULL-coord filters, `select` projection, `.map` to build 9-key hash |
| `backend/config/routes.rb` | `get :coordinates` inside collection block | VERIFIED | Line 132 inside the existing `collection do ... end` block alongside `get :cities` |
| `backend/test/integration/group_estate_coordinates_test.rb` | 6 integration test cases | VERIFIED | Class `GroupEstateCoordinatesTest < ActionDispatch::IntegrationTest`; exactly 6 `test "..."` blocks |
| `frontend/src/assets/types/estateCoordinateType.ts` | `EstateCoordinate` interface | VERIFIED | Named export; 9 fields matching planned spec |
| `frontend/src/assets/api/dashboard/groups/fetchGroupEstateCoordinates.ts` | API call to `/v1/dashboard/groups/${groupId}/estates/coordinates` | VERIFIED | Correct URL; `return response.data`; no `camelcaseKeys` call; 22 filter params serialized to snake_case |
| `frontend/src/store/hooks/Dashboard/groups/useFetchGroupEstateCoordinates.ts` | TanStack Query hook with `keepPreviousData: true` | VERIFIED | `keepPreviousData: true` present; uses `dashboardGroupEstateCoordinatesKeys`; mirrors `useFetchGroupEstates` pattern |
| `frontend/src/components/dashboard/general/GroupMapPanel.tsx` | Mapbox map panel with clustering and popups | VERIFIED | 261 lines; imports from `react-map-gl/mapbox`, `use-supercluster`, `mapbox-gl/dist/mapbox-gl.css`; `VITE_MAPBOX_TOKEN` guard; `useSupercluster` called twice; four shell states; `fitBounds` with `hasFitBoundsRef` guard; `cooperativeGestures` |
| `frontend/src/components/dashboard/general/GroupMapPinPopup.tsx` | Single-pin popup card | VERIFIED | `w-56`, `h-32`, hero image, price overlay, `from 'lucide-react'`; "View details" Link to `/${groupId}/estate/${coordinate.id}`; no map library imports |
| `frontend/src/components/dashboard/general/GroupMapClusterPopup.tsx` | Multi-listing cluster popup | VERIFIED | `w-64`; header "{N} listings at this location"; rows with price, address, `ArrowRight`; `aria-label` on each row's link |
| `frontend/src/containers/dashboard/general/GeneralDashboard.tsx` | GroupMapPanel inserted between FilterBar and Grid | VERIFIED | Lines 83, 136, 143 confirm ordering: FilterBar → GroupMapPanel → ListingsGrid; "Listings on the map" heading at line 135 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `routes.rb` | `EstatesController#coordinates` | `get :coordinates` inside collection block | WIRED | Confirmed at line 132 inside the collection block for `resources :estates` |
| `EstatesController#coordinates` | `GroupEstatesQuery` | `GroupEstatesQuery.new(@group, Current.user, params).call` | WIRED | Line 181 of controller |
| `GeneralDashboardContext` | `useFetchGroupEstateCoordinates` | `const coordinatesQuery = useFetchGroupEstateCoordinates(...)` | WIRED | Line 78 of context |
| `useFetchGroupEstateCoordinates` | `fetchGroupEstateCoordinates` | `queryFn: async () => fetchGroupEstateCoordinates(...)` | WIRED | Line 9 of hook |
| `fetchGroupEstateCoordinates` | `/v1/dashboard/groups/${groupId}/estates/coordinates` | `api.get(...)` | WIRED | Line 61 of API module |
| `GeneralDashboard` | `GroupMapPanel` | `<GroupMapPanel coordinates={state.mapCoordinates} ...>` | WIRED | Lines 136-142 of GeneralDashboard.tsx |
| `GroupMapPanel` | `react-map-gl/mapbox` | `Map, Marker, Popup, NavigationControl` imports | WIRED | Lines 4-5 of GroupMapPanel.tsx |
| `GroupMapPanel` | `use-supercluster` | `useSupercluster({ points, bounds, zoom, options })` | WIRED | Lines 6, 70-75 of GroupMapPanel.tsx |
| `GroupMapPinPopup` | `/${groupId}/estate/${id}` | `<Link to={...}>View details</Link>` | WIRED | Line 46 of GroupMapPinPopup.tsx |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `GroupMapPanel` | `coordinates: EstateCoordinate[]` | `state.mapCoordinates` from `GeneralDashboardContext` → `coordinatesQuery.data?.coordinates ?? []` → TanStack Query → `fetchGroupEstateCoordinates` → Rails `#coordinates` action → `GroupEstatesQuery` + `listing_details` DB join | Yes — DB select projection with real lat/lng + popup fields | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — map rendering and clustering require a running Mapbox-connected browser session. Static checks cover all programmatic verifications. Human verification (Task 3) serves as the behavioral check.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MAP-02 | 09-01, 09-02, 09-04 | Group dashboard renders interactive map panel with a pin per listing | SATISFIED | `GroupMapPanel` renders in `GeneralDashboard` between filter bar and grid; `coordinates` endpoint supplies real pin data; human verification section A approved |
| MAP-03 | 09-01, 09-02, 09-04 | Map updates pins when filter set changes — no page reload | SATISFIED | `coordinatesQuery` receives identical filter params as `groupEstatesQuery` (minus pagination); `keepPreviousData: true` prevents empty flash; human verification section B approved |
| MAP-05 | 09-04 | Nearby listings grouped into cluster pin showing count badge; cluster expansion reveals individual listings | SATISFIED | `useSupercluster` with `radius: 75, maxZoom: 20`; cluster click below MAX_ZOOM calls `easeTo`; at MAX_ZOOM calls `getLeaves(clusterId, Infinity)` and opens `GroupMapClusterPopup`; human verification section C approved |
| MAP-06 | 09-04 | Clicking a pin or cluster row opens popup with hero photo, price, address, beds/baths/sqft, "View details" link | SATISFIED | `GroupMapPinPopup` renders hero, price overlay, stats row, Link; `GroupMapClusterPopup` renders rows with ArrowRight link; human verification sections C and D approved |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO/FIXME/placeholder comments, empty implementations, hardcoded empty data, or stub patterns found in the phase deliverables.

### Human Verification Required

Human verification was completed and approved on 2026-05-17 (all 6 sections passed, per plan 09-04 SUMMARY.md and verified by the user).

**Section A — MAP-02 (Map renders with pins):** Mapbox map panel appeared between filter bar and listings grid; "Listings on the map" heading visible; pins displayed per geocoded listing.

**Section B — MAP-03 (Filter sync):** Applying a city filter updated map pins and listings grid simultaneously; no flash to empty state during refetch (confirmed `keepPreviousData: true` behavior); clearing filter restored full pin set.

**Section C — MAP-05 (Clustering):** Cluster badges appeared on zoom-out; cluster click at low zoom triggered `easeTo` zoom-in; at maximum zoom, cluster click opened multi-listing popup with price + address + arrow link rows.

**Section D — MAP-06 (Single pin popup):** Clicking a single pin opened popup with hero photo, price badge, address, bed/bath/sqft row, and "View details" link navigating to `/${groupId}/estate/${estateId}`.

**Section E (Error state):** Removing `VITE_MAPBOX_TOKEN` and restarting showed "Mapbox token not configured" fallback panel.

**Section F (Accessibility):** "View details" link was keyboard-focusable; cluster popup arrow links had non-empty `aria-label` values (`"View listing at {address}"`).

Two fixes were applied during verification before approval:
1. Pin click event — replaced childless `<Marker onClick>` with a custom `<button>` child with `e.stopPropagation()`.
2. Hero image fallback — added `listing_details.images` to SELECT and coalesced `hero_image_url.presence || images.first` in the controller.

### Gaps Summary

No gaps. All 5 must-have truths are verified. All 10 required artifacts exist, are substantive, and are wired. All 4 requirements (MAP-02, MAP-03, MAP-05, MAP-06) are satisfied. Human verification was approved for all 6 verification sections.

**Notable implementation deviation from Plan 03:** The plan originally installed `@vis.gl/react-google-maps` and `@googlemaps/markerclusterer`. Before Plan 04 execution the plans were revised (commit `18db7e2`) to migrate to Mapbox. The final implementation correctly uses `react-map-gl@8.1.1`, `mapbox-gl@3.23.1`, and `use-supercluster@1.2.0` as specified in the revised Plan 03. Google Maps packages are absent from `package.json`. `VITE_MAPBOX_TOKEN` is documented in `.env.example`. This is a coherent deviation: the revised plans describe Mapbox, and the codebase implements Mapbox.

---

_Verified: 2026-05-17_
_Verifier: Claude (gsd-verifier)_
