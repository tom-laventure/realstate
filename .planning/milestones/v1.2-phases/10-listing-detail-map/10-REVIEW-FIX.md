---
phase: 10-listing-detail-map
fixed_at: 2026-05-18T00:00:00Z
review_path: .planning/phases/10-listing-detail-map/10-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 3
skipped: 1
status: partial
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-05-18T00:00:00Z
**Source review:** .planning/phases/10-listing-detail-map/10-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (CR-01, WR-01, WR-02, WR-03)
- Fixed: 3 (WR-01, WR-02, WR-03)
- Skipped: 1 (CR-01)

Build verification: `cd frontend && npm run build` exits 0 — all TypeScript compiled cleanly.

## Fixed Issues

### WR-01: `useEffect` to sync viewport with coordinate prop changes

**Files modified:** `frontend/src/components/dashboard/estate/EstateLocationMap.tsx`
**Commit:** c7f23e9
**Applied fix:** Added `useEffect` import and a `useEffect(() => { setViewState(prev => ({ ...prev, longitude, latitude })) }, [longitude, latitude])` block after the `useState` initializer. This ensures the map camera recenters whenever the `longitude`/`latitude` props change, preventing the viewport from being stuck at the initial mount coordinates if the parent passes different values after first render.

### WR-02: Coordinate range and null-island guard in EstateDashboard

**Files modified:** `frontend/src/containers/dashboard/estate/EstateDashboard.tsx`
**Commit:** 8f9cb99
**Applied fix:** Replaced the bare `!= null` double-check with an IIFE that extracts `lat`/`lng`, computes `hasValidCoords` (range check: lat in [-90,90], lng in [-180,180], plus null-island rejection `!(lat === 0 && lng === 0)`), and only renders `EstateLocationMap` when `hasValidCoords` is true. This prevents Mapbox from receiving out-of-range or sentinel (0,0) coordinates.

### WR-03: `isHydratedFromUrl` guard applied to tab URL hydration useEffect

**Files modified:** `frontend/src/containers/dashboard/estate/EstateDashboard.tsx`
**Commit:** 2392228
**Applied fix:** Added `useState` to the React import. Added `const [isTabHydratedFromUrl, setIsTabHydratedFromUrl] = useState(false)`. Replaced the original tab hydration `useEffect` with the CLAUDE.md guard pattern: early return if already hydrated, allowlist validation, set state, then `setIsTabHydratedFromUrl(true)`. Dependency array updated to `[isTabHydratedFromUrl, searchParams, actions]`. This prevents the effect from re-firing on every `searchParams` mutation and aligns the codebase with the established project convention.

## Skipped Issues

### CR-01: Live Mapbox public token committed to `.env`

**File:** `frontend/.env:10`
**Reason:** The `.env` file is listed in `frontend/.gitignore` (line 46) and has not been tracked since a 2024 commit that predates the Mapbox token. The token was never committed to git history — `git log --all -- .env` shows only one commit (websocket connection, 2024) which contains no `VITE_MAPBOX_TOKEN` entry. There is no tracked credential to remove from git history.

The local `.env` file was updated to replace the live token value with the placeholder `VITE_MAPBOX_TOKEN=your-mapbox-access-token` as a best-practice sanitization of the local dev file, but since the file is gitignored no commit could be produced (`git add .env` returns an error). The real token should still be rotated in the Mapbox dashboard and distributed via a secrets manager or `.env.local` as the reviewer recommends — but this is an operational step, not a code change.

**Original issue:** `VITE_MAPBOX_TOKEN` in tracked `.env` contained a live Mapbox public token.

---

_Fixed: 2026-05-18T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
