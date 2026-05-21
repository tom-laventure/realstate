---
plan: 10-01
phase: 10-listing-detail-map
status: complete
completed: "2026-05-18"
---

# Plan 10-01: Listing Detail Map — Summary

## What Was Built

Embedded a single-pin Mapbox map on the estate detail page. When a listing has both `latitude` and `longitude`, a "Property location" section appears between the summary card and the section tabs — a `h-64` interactive map pinning the property with a `fill-primary` MapPin. When coordinates are absent, the section is completely omitted.

## Files

### Created
- `frontend/src/components/dashboard/estate/EstateLocationMap.tsx` (68 lines)
  - Single-pin Mapbox component; streets-v12 style; `cooperativeGestures`; "Property location" label; token-missing placeholder; `NavigationControl` top-right; `fill-primary` MapPin `h-7 w-7 drop-shadow-sm`

### Modified
- `frontend/src/containers/dashboard/estate/EstateDashboard.tsx`
  - Added import: `import EstateLocationMap from '@/components/dashboard/estate/EstateLocationMap'`
  - Inserted conditional render block between `<EstateSummaryCard>` and `<EstateSectionTabs>` using `!= null` guard on both `latitude` and `longitude`

## Key Decisions

- Used `!= null` (loose equality) to correctly accept `0.0` as a valid coordinate while rejecting both `null` and `undefined` — per plan spec
- Map placed *outside* the tab system — no re-mount on tab switch (Pitfall 4 from RESEARCH.md)
- Reused all Phase 9 Mapbox conventions: `react-map-gl/mapbox`, `streets-v12`, `cooperativeGestures`, `fill-primary` pin

## Deviations

None. Followed the plan spec exactly.

## Verification

Human verification approved on first pass (all 7 steps confirmed):
- Map renders correctly on listings with coordinates
- Map section absent on listings without coordinates  
- Map stays visible across tab switches (no re-mount)
- `cooperativeGestures` prevents scroll-wheel hijacking
- Token-missing placeholder renders when `VITE_MAPBOX_TOKEN` is empty

## Build

`npm run build` ✓ (3798 modules, no TypeScript errors)

## Git Commits (frontend/)

- `e21eb73` feat(10-01): create EstateLocationMap single-pin Mapbox component
- `0d62c5c` feat(10-01): wire EstateLocationMap into EstateDashboard

## Self-Check: PASSED

key-files.created:
  - frontend/src/components/dashboard/estate/EstateLocationMap.tsx
  - frontend/src/containers/dashboard/estate/EstateDashboard.tsx
