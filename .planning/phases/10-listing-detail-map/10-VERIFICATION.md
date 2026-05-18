---
phase: 10-listing-detail-map
verified: 2026-05-18T00:00:00Z
status: human_needed
score: 6/6
overrides_applied: 0
human_verification:
  - test: "Map renders correctly on a listing with coordinates — label, pin, controls, zoom level"
    expected: "A 'Property location' label above a 256px-tall Mapbox map showing the property's pin in fill-primary at zoom 14 with NavigationControl in top-right"
    why_human: "Cannot spin up the Vite dev server and navigate the app programmatically in this environment"
  - test: "Map section is completely absent on a listing without coordinates — no empty container, no gap"
    expected: "When listing has null latitude/longitude, no map section appears between the summary card and section tabs"
    why_human: "Requires live navigation to a listing with null coordinates to confirm UI omission"
  - test: "Map persists across tab switches — no re-mount or disappearance"
    expected: "Switching between Details, Comments, Dates, and Documents tabs leaves the map visible and unchanged above the tab bar"
    why_human: "React re-mount behaviour only observable at runtime"
  - test: "cooperativeGestures — scroll wheel scrolls page, not map"
    expected: "Scrolling over the map moves the page; Ctrl/Cmd+scroll or two-finger pinch zooms the map"
    why_human: "Interaction behaviour requires manual browser testing"
  - test: "Token-missing placeholder renders when VITE_MAPBOX_TOKEN is empty"
    expected: "A dashed-border h-64 container with text 'Map token not configured' and the 'Property location' label above it"
    why_human: "Requires env var manipulation and dev server reload"
---

# Phase 10: Listing Detail Map — Verification Report

**Phase Goal:** Render an embedded Mapbox map on the individual listing detail page, pinning the property at its exact latitude/longitude (already delivered by Phase 8's serializer). When coordinates are missing, the map section is absent — not a broken/empty container.
**Verified:** 2026-05-18T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Listing detail page shows a 'Property location' label above an interactive Mapbox map centered on the listing's coordinates | VERIFIED | Label present on lines 34 and 44 of EstateLocationMap.tsx; ViewState initialized with `longitude` and `latitude` from props; `mapStyle="mapbox://styles/mapbox/streets-v12"` |
| 2 | Map renders with a single MapPin in fill-primary at the listing's latitude/longitude | VERIFIED | Single `<Marker longitude={longitude} latitude={latitude}>` (grep count = 1); MapPin class `"h-7 w-7 fill-primary text-primary drop-shadow-sm"` at line 58 |
| 3 | Map section is completely absent (not a broken or empty container) when listingDetail.latitude or listingDetail.longitude is null | VERIFIED | EstateDashboard.tsx lines 111-118: both `!= null` guards must pass before `<EstateLocationMap>` is rendered; component is never mounted with null coordinates |
| 4 | Map uses cooperativeGestures so scrolling the page does not get hijacked by the map | VERIFIED | `cooperativeGestures` prop present on `<MapGL>` at line 53 of EstateLocationMap.tsx |
| 5 | When VITE_MAPBOX_TOKEN is empty, a dashed-border h-64 placeholder reading 'Map token not configured' renders instead of attempting to initialize MapGL | VERIFIED | Token guard at line 31 (`if (!token)`) returns placeholder with `border-dashed` class and copy "Map token not configured" at lines 35-36; `h-64` present in placeholder container; MapGL is never instantiated when token is absent |
| 6 | Map section is placed between EstateSummaryCard and EstateSectionTabs (not inside a tab), so it does not re-mount on tab switches | VERIFIED | EstateSummaryCard at line 110, EstateLocationMap at line 113, EstateSectionTabs at line 119 in EstateDashboard.tsx — placement order confirmed |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/components/dashboard/estate/EstateLocationMap.tsx` | Self-contained single-pin Mapbox map component (min 50 lines, default export) | VERIFIED | 68 lines; default export `EstateLocationMap`; imports from `react-map-gl/mapbox`, `lucide-react`, `mapbox-gl/dist/mapbox-gl.css` |
| `frontend/src/containers/dashboard/estate/EstateDashboard.tsx` | Renders EstateLocationMap conditionally between EstateSummaryCard and EstateSectionTabs | VERIFIED | Import at line 5; conditional render block at lines 111-118; placement order SummaryCard(110) < LocationMap(113) < SectionTabs(119) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| EstateDashboard.tsx | EstateLocationMap.tsx | `import EstateLocationMap from '@/components/dashboard/estate/EstateLocationMap'` | WIRED | Line 5 of EstateDashboard.tsx — exact import pattern matches plan spec |
| EstateDashboard.tsx | state.estate.listingDetail.latitude / .longitude | `!= null` guard before rendering EstateLocationMap | WIRED | Lines 111-112: both `latitude != null && longitude != null` guards use loose equality (`!=`), not strict (`!==`) — correctly rejects null and undefined, accepts 0.0 |
| EstateLocationMap.tsx | Mapbox GL JS | `MapGL + Marker + NavigationControl from 'react-map-gl/mapbox'` with `mapboxAccessToken=VITE_MAPBOX_TOKEN` | WIRED | Line 3: `import MapGL, { Marker, NavigationControl } from 'react-map-gl/mapbox'`; token assigned from `import.meta.env.VITE_MAPBOX_TOKEN \|\| ''` at line 14 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| EstateLocationMap.tsx | `latitude`, `longitude` props | `state.estate.listingDetail` in EstateDashboard — populated by `useFetchEstate` TanStack Query hook, which calls `GET /v1/dashboard/groups/:groupId/estates/:estateId` via `fetchEstate.ts` | Yes — API call to real backend endpoint; `EstateListingDetails` type declares `latitude: number \| null`, `longitude: number \| null` (confirmed in `estateListingDetailsType.ts` lines 39-40) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Frontend TypeScript build | `npm run build` in `frontend/` | 3798 modules transformed, 0 TypeScript errors, exit 0 | PASS |
| No Google Maps imports | `grep -rE "@vis.gl/react-google-maps\|@react-google-maps/api" frontend/src/components/dashboard/estate/ frontend/src/containers/dashboard/estate/` | No output | PASS |
| Single Marker in component | `grep -c '<Marker ' frontend/src/components/dashboard/estate/EstateLocationMap.tsx` | 1 | PASS |
| No Popup/useSupercluster/EstateCoordinate | `grep -E "(Popup\|useSupercluster\|EstateCoordinate)" frontend/src/components/dashboard/estate/EstateLocationMap.tsx` | No output | PASS |
| Guard uses `!=` not `!==` | `grep -E "listingDetail\?\.latitude !== null" frontend/src/containers/dashboard/estate/EstateDashboard.tsx` | No output (correct) | PASS |
| Git commits exist | `git log --oneline \| grep -E "e21eb73\|0d62c5c"` | Both commits found | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MAP-04 | 10-01-PLAN.md | The individual listing detail page shows an embedded Google Maps section with the property's location pinned | SATISFIED (via Mapbox) | EstateLocationMap.tsx implements a Mapbox single-pin map on the estate detail page; plan documents that project standard is Mapbox (Phase 9 decision), not Google Maps — the intent of MAP-04 is fulfilled |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TODO/FIXME/placeholder comments, no empty returns, no hardcoded empty data, no forbidden imports found in either modified file.

### Human Verification Required

All 6 automated must-have truths are VERIFIED and the build passes. The following 5 items require runtime testing because they involve UI rendering, interaction behaviour, or environment variable manipulation that cannot be verified programmatically.

#### 1. Map renders correctly on a listing with coordinates

**Test:** Sign in, navigate to any group, open a listing that has geocoded coordinates. Verify the area between the summary card and the section tabs shows:
- A "Property location" label in muted text above the map
- A 256px-tall (`h-64`) Mapbox streets map rounded with a border
- A single filled pin (`fill-primary` accent color) at the exact property location
- A zoom+compass NavigationControl in the top-right corner of the map
- Initial view at street/neighbourhood scale (zoom 14)

**Expected:** All elements described above are visible and correctly styled.
**Why human:** Requires a running dev server and a browser to observe rendered output.

#### 2. Map section absent on a listing without coordinates

**Test:** Navigate to a listing whose `listing_details.latitude` is NULL (or temporarily create one). Observe the area between the summary card and the section tabs.
**Expected:** No map section, no empty container, no broken placeholder — the gap between summary card and tabs looks exactly as it did before Phase 10.
**Why human:** Requires live navigation to a specific database state.

#### 3. Map persists across tab switches — no re-mount

**Test:** On a listing with coordinates, switch between the Details, Comments, Dates, and Documents tabs.
**Expected:** The map remains visible above the tab bar on every tab. It does not flash, re-mount, or disappear during tab changes.
**Why human:** React remount behaviour is only observable at runtime.

#### 4. cooperativeGestures — scroll wheel behaviour

**Test:** On the listing detail page with the map visible, scroll the page using the mouse wheel while hovering over the map.
**Expected:** The page scrolls — the map does NOT zoom. Ctrl+scroll (or Cmd+scroll on Mac) or a two-finger pinch on a trackpad should zoom the map.
**Why human:** Scroll interaction behaviour requires a browser.

#### 5. Token-missing placeholder (optional but recommended)

**Test:** Temporarily set `VITE_MAPBOX_TOKEN=` (blank) in `frontend/.env`, restart `npm run dev`, navigate to a listing with coordinates.
**Expected:** The "Property location" label and a dashed-border `h-64` box reading "Map token not configured" appear where the map would be. No Mapbox GL JS initialisation error in the console.
**Why human:** Requires environment variable manipulation and dev server restart.

### Gaps Summary

No gaps. All 6 automated must-have truths are VERIFIED, build passes cleanly, and no anti-patterns were found. The phase is pending human runtime verification of the rendered map UI and interaction behaviour.

---

_Verified: 2026-05-18T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
