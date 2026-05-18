---
phase: 09-group-dashboard-map
plan: "04"
subsystem: ui
tags: [map, mapbox, react-map-gl, use-supercluster, clustering, popup, markers]
dependency_graph:
  requires:
    - state.mapCoordinates from GeneralDashboardContext (Plan 02)
    - react-map-gl@8.1.1 + mapbox-gl@3.x + use-supercluster@1.2.0 (Plan 03 revised)
  provides:
    - GroupMapPinPopup — single-pin popup card (hero photo, price, address, stats, View details link)
    - GroupMapClusterPopup — multi-listing cluster popup (rows of price + address + arrow link)
    - GroupMapPanel — Mapbox GL map with react-map-gl, use-supercluster clustering, Marker/Popup orchestration
    - GeneralDashboard — GroupMapPanel inserted between ListingsFilterBar and ListingsGrid
  affects:
    - frontend/src/components/dashboard/general/GroupMapPinPopup.tsx
    - frontend/src/components/dashboard/general/GroupMapClusterPopup.tsx
    - frontend/src/components/dashboard/general/GroupMapPanel.tsx
    - frontend/src/containers/dashboard/general/GeneralDashboard.tsx
tech_stack:
  added: []
  patterns:
    - "react-map-gl/mapbox entry point with Map, Marker, Popup, NavigationControl"
    - "use-supercluster for proximity clustering with bounds + zoom tracking"
    - "hasFitBoundsRef guard: fitBounds on initial load only, not on every filter change"
    - "cooperativeGestures on Map to prevent scroll hijacking"
    - "Cluster size scaling: Math.round(28 + (point_count / total) * 20)px — 28–48px range"
    - "Cluster popup at MAX_ZOOM (20) via supercluster.getLeaves(clusterId, Infinity)"
key_files:
  created:
    - frontend/src/components/dashboard/general/GroupMapPinPopup.tsx (56 lines)
    - frontend/src/components/dashboard/general/GroupMapClusterPopup.tsx (48 lines)
    - frontend/src/components/dashboard/general/GroupMapPanel.tsx (256 lines)
  modified:
    - frontend/src/containers/dashboard/general/GeneralDashboard.tsx (155 lines)
decisions:
  - "react-map-gl/mapbox entry point used (not react-map-gl) — matches Mapbox GL JS v3 bundle correctly"
  - "Map renamed to MapGL at import site to avoid shadowing the JS global Map constructor (Rule 1 auto-fix)"
  - "use-supercluster handles clustering in-browser; no server-side clustering needed at current scale"
  - "fitBounds called only on initial load (hasFitBoundsRef) — prevents jarring re-center on filter change"
  - "cooperativeGestures prevents scroll-wheel hijacking on page scroll"
  - "Cluster popup triggered at zoom >= MAX_ZOOM (20); below that, easeTo expansion zoom"
metrics:
  duration: "~15 min"
  completed_date: "2026-05-17"
  tasks_completed: 3
  files_changed: 5
  status: complete
---

# Phase 9 Plan 04: Map UI Components Summary

One-liner: Three Mapbox map components (GroupMapPanel with use-supercluster clustering, GroupMapPinPopup single-pin card, GroupMapClusterPopup multi-listing popup) wired into GeneralDashboard — implementing MAP-02, MAP-03, MAP-05, MAP-06.

**Status: All 3 tasks complete. Human verification approved.**

## What Was Built

### Task 1: Popup Content Components

**GroupMapPinPopup** (`src/components/dashboard/general/GroupMapPinPopup.tsx`, 56 lines)
- Props: `coordinate: EstateCoordinate`, `groupId: string`
- Hero image (`h-32 w-full object-cover`) with price overlay badge (`absolute left-2 top-2`)
- Address as `text-base font-semibold`
- Beds/baths/sqft row with lucide-react icons (`BedDouble`, `Bath`, `Square`)
- "View details" link to `/${groupId}/estate/${coordinate.id}`
- No mapbox-gl or react-map-gl imports — purely presentational

**GroupMapClusterPopup** (`src/components/dashboard/general/GroupMapClusterPopup.tsx`, 48 lines)
- Props: `estateIds: string[]`, `coordinates: EstateCoordinate[]`, `groupId: string`
- Header: "{N} listings at this location"
- One row per listing: price (bold) + address (muted, truncated) + `ArrowRight` link
- `aria-label="View listing at {address}"` on each row's arrow link
- `w-64` popup width per UI-SPEC

### Task 2: GroupMapPanel + GeneralDashboard Wiring

**GroupMapPanel** (`src/components/dashboard/general/GroupMapPanel.tsx`, 256 lines)
- Imports: `react-map-gl/mapbox` (Map as MapGL, Marker, Popup, NavigationControl, MapRef, ViewState)
- CSS import: `mapbox-gl/dist/mapbox-gl.css`
- Clustering: `useSupercluster` with `{ radius: 75, maxZoom: 20 }`
- State: `viewState` (ViewState), `bounds` ([w,s,e,n]), `selectedPin`, `clusterPopup`
- `syncBounds` on both `onMove` and `onLoad` for accurate clustering after pan/zoom
- `hasFitBoundsRef` guard: `fitBounds` on first load only
- `cooperativeGestures` prop on Map
- Cluster size: `Math.round(28 + (point_count / coordinates.length) * 20)px`
- Cluster click: zoom < MAX_ZOOM → `easeTo` expansion; zoom >= MAX_ZOOM → cluster popup
- Four shell states: no token / loading (isLoading + no previous data) / error / empty

**GeneralDashboard** (modified `src/containers/dashboard/general/GeneralDashboard.tsx`)
- GroupMapPanel already imported and inserted between ListingsFilterBar and ListingsGrid
- Section heading: "Listings on the map" (`text-sm font-medium text-muted-foreground mb-2`)
- Props: `coordinates={state.mapCoordinates}`, `isLoading={state.isMapLoading}`, `isError={state.isMapError}`

## Task Commits

| Task | Commit | Description | Repo |
|------|--------|-------------|------|
| 1 | e5038a3 | feat(09-04): add GroupMapPinPopup and GroupMapClusterPopup components | frontend |
| 2 | caa61a1 | feat(09-04): build GroupMapPanel and wire into GeneralDashboard | frontend |
| 2 (fix) | a6d745d | fix(09-04): rename Map import to MapGL to avoid shadowing JS global Map constructor | frontend |
| 3 (fix) | e01a648 | fix(09-04): use custom Marker child with stopPropagation so pin click opens popup | frontend |
| 3 (fix) | 509d5e9 | fix(09-04): fall back to images[0] when hero_image_url is null in coordinates endpoint | backend |
| 3 | — | Human verification approved | — |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Renamed Map import to MapGL**
- **Found during:** Task 2
- **Issue:** `import Map from 'react-map-gl/mapbox'` shadows the JavaScript global `Map` constructor used in `useMemo(() => new Map(...))` calls within the same component. This causes a runtime TypeError when trying to construct a Map for `coordById`.
- **Fix:** Renamed the react-map-gl import to `MapGL` and used `<MapGL ...>` in JSX. All `new Map(...)` calls correctly resolve to the JS built-in.
- **Files modified:** `frontend/src/components/dashboard/general/GroupMapPanel.tsx`
- **Commit:** a6d745d

### Migration Note (Plan 03 → Plan 04)

Plan 03 originally installed `@vis.gl/react-google-maps` + `@googlemaps/markerclusterer` (Google Maps). The plan was revised (commit `18db7e2` "revise plans for Mapbox migration") before Plan 04 execution to use `react-map-gl/mapbox` + `use-supercluster` (Mapbox GL JS). The Mapbox migration commit `12f41b4` (from Plan 03 revised execution) swapped the library installation. Plan 04 therefore implements against the Mapbox stack as intended.

The UI-SPEC.md was written against Google Maps terminology (`AdvancedMarker`, `InfoWindow`, `APIProvider`) but the visual contract is equivalent — `Marker` + `Popup` from react-map-gl satisfy the same visual spec. The Mapbox env var is `VITE_MAPBOX_TOKEN` (not the Google Maps var from the original spec).

## Build Verification

```
npm run build → ✓ built in 9.89s (3797 modules)
```
No TypeScript errors. Two large chunks (mapbox-gl bundle ~1.78MB gzip: 492KB) — expected for a mapping library; code splitting is a future optimization.

## Human Verification (Task 3) — APPROVED

All six verification sections passed after two fixes applied during verification:

- A. MAP-02 ✓ — Map panel renders between filter bar and listings grid; "Listings on the map" heading visible
- B. MAP-03 ✓ — Filter changes update pins without page reload (keepPreviousData: true)
- C. MAP-05 ✓ — Cluster badges appear on zoom out; cluster click zooms in; max-zoom click opens multi-listing popup
- D. MAP-06 ✓ — Single pin click opens popup with hero photo, price badge, address, stats, "View details" link
- E. Error state ✓ — "Mapbox token not configured" shown when VITE_MAPBOX_TOKEN missing
- F. Accessibility ✓ — "View details" keyboard-focusable; cluster rows have aria-label

**Fixes applied during verification:**

1. **Pin click not firing popup** — The childless `<Marker onClick={...} />` (default Mapbox teardrop) does not reliably deliver click events through react-map-gl v8. Fixed by providing a custom `<button>` child (`<MapPin>` icon) with `e.stopPropagation()`, matching the existing cluster marker pattern.

2. **Hero image null in popup** — Seed data populates `listing_details.images` (array) but not `hero_image_url`. The coordinates endpoint only returned `hero_image_url`. Fixed by adding `images` to the SELECT and coalescing `hero_image_url.presence || images.first` in the backend controller.

## Known Stubs

None — `GroupMapPanel` receives real coordinates from `state.mapCoordinates` (live backend data via TanStack Query).

## Threat Flags

None — all components are read-only UI. No new network endpoints, auth paths, or data mutations introduced. The Mapbox token (`VITE_MAPBOX_TOKEN`) is a public-side Vite env var — bundled into the client build, not a server secret.

## Self-Check: PASSED

- `frontend/src/components/dashboard/general/GroupMapPinPopup.tsx` — exists, 56 lines, contains `w-56`, `h-32`, `from 'lucide-react'`
- `frontend/src/components/dashboard/general/GroupMapClusterPopup.tsx` — exists, 48 lines, contains `w-64`, `aria-label`
- `frontend/src/components/dashboard/general/GroupMapPanel.tsx` — exists, 256 lines, contains `react-map-gl/mapbox`, `useSupercluster` (x2), `mapbox-gl/dist/mapbox-gl.css`, `VITE_MAPBOX_TOKEN`
- `frontend/src/containers/dashboard/general/GeneralDashboard.tsx` — contains `<GroupMapPanel`, `Listings on the map`
- Commits e5038a3, caa61a1, a6d745d verified in frontend git log
- `npm run build` exits 0 (3797 modules, 9.89s)
