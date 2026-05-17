---
phase: 09-group-dashboard-map
plan: "02"
subsystem: frontend-data-layer
tags: [map, coordinates, tanstack-query, context, types]
dependency_graph:
  requires: [GET /v1/dashboard/groups/:group_id/estates/coordinates]
  provides: [state.mapCoordinates, state.isMapLoading, state.isMapError on GeneralDashboardContext]
  affects:
    - frontend/src/assets/types/estateListingDetailsType.ts
    - frontend/src/assets/types/estateCoordinateType.ts
    - frontend/src/assets/api/dashboard/groups/fetchGroupEstateCoordinates.ts
    - frontend/src/store/hooks/Dashboard/groups/useFetchGroupEstateCoordinates.ts
    - frontend/src/store/hooks/queryKeys.tsx
    - frontend/src/containers/dashboard/general/GeneralDashboardContext.tsx
tech_stack:
  added: []
  patterns: [TanStack Query hook mirroring, keepPreviousData for pin stability, filter parity enforcement (MAP-03)]
key_files:
  created:
    - frontend/src/assets/types/estateCoordinateType.ts
    - frontend/src/assets/api/dashboard/groups/fetchGroupEstateCoordinates.ts
    - frontend/src/store/hooks/Dashboard/groups/useFetchGroupEstateCoordinates.ts
  modified:
    - frontend/src/assets/types/estateListingDetailsType.ts
    - frontend/src/store/hooks/queryKeys.tsx
    - frontend/src/containers/dashboard/general/GeneralDashboardContext.tsx
decisions:
  - "keepPreviousData: true in hook — existing map pins remain visible during filter refetch (no flash to empty state per UI-SPEC)"
  - "Filter param set is identical to groupEstatesQuery minus pagination — guarantees MAP-03 filter sync"
  - "Named export for EstateCoordinate interface — consumed by 3 files (API module, hook, component); named exports are more refactor-friendly"
  - "tsc --noEmit fails due to pre-existing TS 4.9.5 / moduleResolution:bundler incompatibility; npm run build (Vite) used as TypeScript verifier — consistent with all prior plans in this project"
metrics:
  duration: "~8 min"
  completed_date: "2026-05-17"
  tasks_completed: 3
  files_changed: 6
---

# Phase 9 Plan 02: Frontend Data Layer Summary

One-liner: TanStack Query data layer for map coordinates — EstateCoordinate type, fetchGroupEstateCoordinates API module, useFetchGroupEstateCoordinates hook, and GeneralDashboardContext wired with `state.mapCoordinates`, enforcing identical filter parity with the estates list query (MAP-03).

## What Was Built

### Types

**`EstateListingDetails`** (extended):
- `latitude: number | null`
- `longitude: number | null`
- `geocodingFailed: boolean | null`

**`EstateCoordinate`** (new):
```typescript
export interface EstateCoordinate {
  id: string
  latitude: number
  longitude: number
  listPrice: string | null
  address: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  heroImageUrl: string | null
}
```

### API Module

`fetchGroupEstateCoordinates` calls `GET /v1/dashboard/groups/${groupId}/estates/coordinates`.

Returns `response.data` directly — no `camelcaseKeys` call (global Axios interceptor handles it).

### Hook

`useFetchGroupEstateCoordinates` mirrors `useFetchGroupEstates` exactly:
- `useQuery` with `keepPreviousData: true`
- `retry: false`
- `dashboardGroupEstateCoordinatesKeys` query key registered in `queryKeys.tsx`

### Query Key

```typescript
export const dashboardGroupEstateCoordinatesKeys = {
    all: ['dashboard', 'groups', 'estates', 'coordinates'] as const,
    list: (params: FetchGroupEstateCoordinatesPayload) =>
        [...dashboardGroupEstateCoordinatesKeys.all, params] as const,
}
```

### Context State (GeneralDashboardContext)

New fields exposed:
```typescript
state.mapCoordinates: EstateCoordinate[]   // [] when no data
state.isMapLoading: boolean
state.isMapError: boolean
```

### Filter Params Forwarded to Coordinates Endpoint

All 21 filter params (identical to groupEstatesQuery, minus pagination):

| Param | Maps to backend |
|-------|----------------|
| search | search |
| showFavoritesOnly | favorites_only |
| cities | cities[] |
| propertyTypes | property_types[] |
| minPrice | min_price |
| maxPrice | max_price |
| minPricePerSqft | min_price_per_sqft |
| maxPricePerSqft | max_price_per_sqft |
| maxMaintenanceFee | max_maintenance_fee |
| maxDaysListed | max_days_listed |
| maxDaysAddedToGroup | max_days_added_to_group |
| minBedrooms | min_bedrooms |
| minBathrooms | min_bathrooms |
| minSqft | min_sqft |
| maxAgeYears | max_age_years |
| minUserRating | min_user_rating |
| minGroupRating | min_group_rating |
| hasComments | has_comments |
| hasSharedDocuments | has_shared_documents |
| pendingReview | pending_review |
| showRejected | show_rejected |
| sortBy | sort_by |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes

**`pagination:` count in acceptance criterion:** The plan's acceptance criterion expects exactly 1 `pagination:` occurrence in GeneralDashboardContext (only in `groupEstatesQuery`). The actual count is 2 — there is a second pre-existing occurrence in `useFetchAccountGroups({ pagination: { page: 1 } })` on line 110, which existed before this plan. The coordinates hook correctly has zero pagination references, satisfying the functional intent of the criterion.

**`tsc --noEmit` incompatibility:** TypeScript 4.9.5 (installed in frontend/) does not recognize `moduleResolution: bundler` — this is a pre-existing configuration mismatch with no impact on actual compilation. Vite handles TypeScript resolution and `npm run build` exits 0, which is the authoritative type check for this project.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 8c4c325 | feat(09-02): add EstateCoordinate type and extend EstateListingDetails |
| 2 | c1abd83 | feat(09-02): add API module, TanStack hook, and query key for estate coordinates |
| 3 | 7ed902d | feat(09-02): wire coordinatesQuery into GeneralDashboardContext state |

## Known Stubs

None — data flows from real backend through TanStack Query to context state.

## Threat Flags

None — new files use the shared `api` Axios instance (Cognito JWT applied automatically). No new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- `frontend/src/assets/types/estateCoordinateType.ts` — exists, contains `export interface EstateCoordinate`
- `frontend/src/assets/api/dashboard/groups/fetchGroupEstateCoordinates.ts` — exists, contains `/v1/dashboard/groups/${groupId}/estates/coordinates`
- `frontend/src/store/hooks/Dashboard/groups/useFetchGroupEstateCoordinates.ts` — exists, contains `keepPreviousData: true`
- `frontend/src/store/hooks/queryKeys.tsx` — contains `dashboardGroupEstateCoordinatesKeys`
- `frontend/src/containers/dashboard/general/GeneralDashboardContext.tsx` — contains `mapCoordinates`, `isMapLoading`, `isMapError`
- Commits 8c4c325, c1abd83, 7ed902d verified in frontend git log
- `npm run build` exits 0 (3755 modules, no errors)
