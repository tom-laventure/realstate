---
phase: 10-listing-detail-map
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - frontend/src/components/dashboard/estate/EstateLocationMap.tsx
  - frontend/src/containers/dashboard/estate/EstateDashboard.tsx
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-05-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Two files were reviewed: the new `EstateLocationMap` Mapbox component and the updated `EstateDashboard` container that conditionally renders it. The map component is functionally sound and clean in isolation. However, a live Mapbox public access token is committed to `.env`, which is a tracked file in the frontend sub-repo. One critical security issue and three warnings were found; the warnings center on stale-closure risks in a `useCallback`, an unguarded coordinate-validity check, and tab URL-sync missing the `isHydratedFromUrl` guard mandated by project conventions.

---

## Critical Issues

### CR-01: Live Mapbox public token committed to `.env`

**File:** `frontend/.env:10`
**Issue:** `VITE_MAPBOX_TOKEN` in the committed `.env` file contains a live Mapbox public access token (`pk.eyJ1...`). This file is tracked by git (confirmed present and not in `.gitignore`). Any developer who clones the repo, or any CI system that reads this file, receives a working credential. Mapbox public tokens can be used to make tile requests that count against billing, and this token is linked to the owner's Mapbox account. While Mapbox public tokens are less sensitive than secret tokens, they carry billing risk and can be rotated/restricted — committing them defeats that.
**Fix:** Remove the real token from `.env` and replace it with a placeholder matching `.env.example`:
```
VITE_MAPBOX_TOKEN=your-mapbox-access-token
```
Rotate the currently-committed token in the Mapbox dashboard (add URL restrictions so it only works from the production domain), and distribute the real value through a secrets manager or a local `.env.local` that is `.gitignore`d.

---

## Warnings

### WR-01: `useCallback` for `handleMove` has a stale-closure non-issue that hides a real one — marker pin stays pinned to initial coordinates regardless of prop updates

**File:** `frontend/src/components/dashboard/estate/EstateLocationMap.tsx:17-29`
**Issue:** The `viewState` is initialised from `longitude`/`latitude` props once via `useState`. If the parent re-renders `EstateLocationMap` with different coordinates (e.g. after data loads asynchronously, or if the component is reused for a different estate without unmounting), the map viewport and the marker will be out of sync: the marker always renders at the current `longitude`/`latitude` props (line 56), but the initial viewport never recenters. More concretely: if `EstateDashboard` renders while `estate.listingDetail` is not yet available and then the component mounts when coordinates become available, the `useState` initialiser runs once with whatever values were passed at first mount. If those props change afterwards, the viewport is never updated.

In the current call site this is partially mitigated because the map is only rendered when both lat/lng are non-null (lines 111-118 of `EstateDashboard`), but the component itself does not enforce that invariant and the design is fragile.
**Fix:** Add a `useEffect` that resets the viewport when the incoming props change:
```tsx
useEffect(() => {
    setViewState(prev => ({ ...prev, longitude, latitude }))
}, [longitude, latitude])
```
This ensures the camera follows a coordinate change without fighting against the user's current pan/zoom once they interact.

---

### WR-02: Coordinates accepted as-is — no validity guard before passing to Mapbox

**File:** `frontend/src/components/dashboard/estate/EstateLocationMap.tsx:13`
**Issue:** The component accepts `latitude: number` and `longitude: number` (non-nullable in the prop interface). Mapbox GL will throw or silently render incorrectly if it receives coordinates outside the valid ranges (`latitude` outside `[-90, 90]` or `longitude` outside `[-180, 180]`). The parent (`EstateDashboard`) only checks `!= null` before rendering the map (lines 111-112); it does not validate the numeric ranges. The `EstateListingDetails` type declares both as `number | null`, meaning the type system provides no constraint on the values that pass the null check.

Geocoding failures (`geocodingFailed: boolean | null` on the type) may produce `0, 0` or other sentinel coordinates that will place the pin in the Atlantic Ocean without any error being raised.
**Fix:** Add a range guard in `EstateDashboard` before rendering, and/or inside the component:
```tsx
// In EstateDashboard (preferred — prevents map mount entirely)
const lat = state.estate.listingDetail?.latitude
const lng = state.estate.listingDetail?.longitude
const hasValidCoords =
    lat != null && lng != null &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)   // reject null-island sentinel

{hasValidCoords && (
    <EstateLocationMap latitude={lat} longitude={lng} address={...} />
)}
```

---

### WR-03: Tab URL hydration does not use the `isHydratedFromUrl` guard required by project conventions

**File:** `frontend/src/containers/dashboard/estate/EstateDashboard.tsx:26-32`
**Issue:** The project's CLAUDE.md mandates a `isHydratedFromUrl` flag for all URL → state sync via `useEffect` to prevent re-hydration on every `searchParams` change and to correctly handle back/forward navigation. The `tab` hydration `useEffect` (lines 26-32) omits this guard. As written, every time `searchParams` changes (including when the user manually sets a tab via the tab bar, which calls `setSearchParams`), the effect re-evaluates and calls `actions.setActiveSection` again — this is a no-op only because `state.activeSection === urlTab` is checked on line 30. However, the missing guard means:

1. The effect can run an unnecessary extra time after each tab-bar click (re-reads the URL and re-sets what was just set).
2. A future maintainer who removes the `state.activeSection === urlTab` short-circuit will introduce an infinite update loop.
3. The pattern diverges from the established project standard, making the codebase inconsistent.

**Fix:** Apply the hydration guard pattern from CLAUDE.md:
```tsx
const [isTabHydratedFromUrl, setIsTabHydratedFromUrl] = useState(false)

useEffect(() => {
    if (isTabHydratedFromUrl) return
    const allowed: EstateSection[] = ['details', 'comments', 'dates', 'documents']
    const val = searchParams.get('tab')
    if (val && allowed.includes(val as EstateSection)) {
        actions.setActiveSection(val as EstateSection)
    }
    setIsTabHydratedFromUrl(true)
}, [isTabHydratedFromUrl, searchParams, actions])
```

---

## Info

### IN-01: `token` read inside the component body on every render instead of at module level or via a stable ref

**File:** `frontend/src/components/dashboard/estate/EstateLocationMap.tsx:14`
**Issue:** `const token = import.meta.env.VITE_MAPBOX_TOKEN || ''` is evaluated on every render. While `import.meta.env` values are statically inlined by Vite at build time and will never actually change at runtime, reading it inside the render body is unconventional. Additionally, `|| ''` means an explicitly-set-to-empty-string env var is treated identically to an unset one, which is correct, but a future reader may not realise that `mapboxAccessToken=""` will still be passed to `<MapGL>` when the token guard on line 31 is `!token` — both branches are consistent, so this is not a bug, just slightly surprising code.
**Fix:** Move to a module-level constant to make the intent clear and avoid any re-evaluation:
```tsx
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''

const EstateLocationMap = ({ latitude, longitude, address }: EstateLocationMapProps) => {
    // ...
    if (!MAPBOX_TOKEN) { ... }
    // use MAPBOX_TOKEN below
}
```

---

_Reviewed: 2026-05-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
