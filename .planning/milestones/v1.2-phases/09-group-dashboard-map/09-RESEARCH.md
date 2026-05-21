# Phase 9: Group Dashboard Map — Research

**Researched:** 2026-05-16
**Domain:** React Google Maps integration, marker clustering, filter-synced map panels
**Confidence:** HIGH

---

## Summary

Phase 9 adds an interactive Google Maps panel to the existing group dashboard page. The backend data layer is complete (Phase 8 delivered `latitude` and `longitude` on `listing_details`, flowing through `ListingDetailSerializer` into all API responses). The work is primarily frontend with one lightweight backend addition.

The recommended library is `@vis.gl/react-google-maps` v1.8.3 — the Google-endorsed, OpenJS Foundation-backed React wrapper for the Maps JavaScript API. Marker clustering uses `@googlemaps/markerclusterer` v2.6.2. Both have bundled TypeScript definitions; no separate `@types` package is needed.

The four requirements (MAP-02, MAP-03, MAP-05, MAP-06) combine into one integrated component: a `GroupMapPanel` that reads from the existing `GeneralDashboardContext`, renders pins for listings with coordinates, clusters nearby pins, and shows popup cards on click. Filter sync (MAP-03) is automatic because `groupEstatesQuery.data` is driven by context filter state and TanStack Query refetches whenever the query key changes.

The key architecture decision the planner must make: whether the map reads from the **existing paginated estates query** (max 100 listings) or from a **new lightweight `/coordinates` backend endpoint** that returns all coordinate pairs without pagination. Research recommends a new `/coordinates` collection endpoint (follows the existing `/cities` pattern) so the map always shows all listings regardless of group size.

**Primary recommendation:** Add `GET /v1/dashboard/groups/:group_id/estates/coordinates` (backend), install `@vis.gl/react-google-maps` + `@googlemaps/markerclusterer` (frontend), wire a `GroupMapPanel` component into `GeneralDashboard` using filter params from context.

---

## Project Constraints (from CLAUDE.md)

### Required Patterns
- Icons: `lucide-react` only (no other icon libraries)
- Styling: Tailwind CSS utility classes only
- Never call axios or API functions directly inside a component — always go through a hook
- Define domain interfaces in `assets/types/` before creating hooks or contexts
- Context pattern: returns `{ state, actions }` memoized with `useMemo`
- Data flow: `Component → Context → TanStack Hook → API module → Axios instance`
- Axios interceptor already applies `camelcaseKeys(response.data, { deep: true })` — never call `camelcaseKeys` in hooks, return `response.data` directly
- `lucide-react` for all icons

### Backend Required Patterns
- Every request goes through `BrokerageAuth` + `CognitoAuth`
- Soft deletes: always scope `Estate` queries with `.without_deleted`
- `acts_as_paranoid` NOT present on `listing_details` — no deleted_at guard needed on that table
- New collection actions on existing resources: follow the `/cities` pattern (collection do; get :action; end)
- Query cap: `per_page` capped at 100 per CLAUDE.md

### Frontend Quality Standard
- Design quality is non-negotiable — polished, intentional UI
- Loading states, empty states, error states all required
- Accessibility baseline: semantic HTML, visible focus rings

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Listing coordinates | Database / Storage | API / Backend (Serializer) | Already on `listing_details.latitude/longitude` via Phase 8 |
| Coordinate delivery for map | API / Backend (Controller) | — | New `/coordinates` collection action on estates resource |
| Filter application | API / Backend (Query) | — | `GroupEstatesQuery` already handles all filter params; reuse for coordinate endpoint |
| Map rendering | Browser / Client | — | Google Maps JavaScript API runs in browser; `APIProvider` + `Map` components |
| Marker clustering | Browser / Client | — | `MarkerClusterer` runs client-side; clusters computed from marker refs |
| Filter sync | Browser / Client (Context) | — | `GeneralDashboardContext` holds filter state; new coordinates hook reads same params |
| Popup card | Browser / Client | — | `InfoWindow` anchored to `AdvancedMarker` or cluster pin position |
| API key security | CDN / Static | — | `VITE_GOOGLE_MAPS_API_KEY` embedded at build time; restrict in Google Cloud Console |

---

## Standard Stack

### Core (New Installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @vis.gl/react-google-maps | 1.8.3 | `APIProvider`, `Map`, `AdvancedMarker`, `InfoWindow`, `useMap`, `useAdvancedMarkerRef` | Google-endorsed, OpenJS Foundation, active maintenance, full TypeScript built-in [VERIFIED: npm registry, Google blog announcement] |
| @googlemaps/markerclusterer | 2.6.2 | Proximity clustering of `AdvancedMarkerElement` instances | Official Google Maps Platform library; works with both legacy and advanced markers [VERIFIED: npm registry + package types] |

### Supporting (Already in Project)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | ^4.22.0 | useFetchGroupEstateCoordinates hook | Same pattern as all existing hooks |
| lucide-react | ^0.555.0 | Icons in popup card (bed, bath, sqft icons) | Only icon source allowed per CLAUDE.md |
| tailwindcss | ^4.1.18 | Styling the map container and popup card | Only styling approach allowed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @vis.gl/react-google-maps | @react-google-maps/api | `@react-google-maps/api` is privately owned, less actively maintained, not Google-endorsed. `@vis.gl` is the current recommended choice per Google Platform blog. [CITED: https://github.com/visgl/react-google-maps/discussions/163] |
| @googlemaps/markerclusterer | Supercluster (client-side) | Supercluster requires more manual wiring. For < 500 markers, `@googlemaps/markerclusterer` (SuperClusterAlgorithm by default) is simpler and sufficient. |
| Dedicated /coordinates endpoint | paginate=false on existing endpoint | `paginate=false` returns full estate objects (~3KB each); `/coordinates` returns only `{id, lat, lng}` (<100 bytes each). At 500 listings: 1.5MB vs 50KB. Dedicated endpoint is clearly better. |

**Version verification:** [VERIFIED: npm registry 2026-05-16]

**Installation:**
```bash
cd frontend && npm install @vis.gl/react-google-maps @googlemaps/markerclusterer
```

No `@types/google.maps` needed — `@vis.gl/react-google-maps` bundles its own TypeScript definitions. [CITED: https://visgl.github.io/react-google-maps/docs/get-started]

---

## Architecture Patterns

### System Architecture Diagram

```
User changes filter (ListingsFilterBar)
    |
    v
GeneralDashboardContext (filter state changes)
    |-- useFetchGroupEstates (paginated, for ListingsGrid) ← unchanged
    |-- useFetchGroupEstateCoordinates (unpaginated, for GroupMapPanel) ← NEW
         |
         v (filter params passed to both hooks)
    GET /v1/dashboard/groups/:groupId/estates/coordinates?<filter_params>
         |
         v (Rails EstatesController#coordinates)
    GroupEstatesQuery.new(@group, current_user, params).call
         .select(:id).joins(:listing_detail)
         .where.not(listing_details: {latitude: nil})
         |
         v
    [{id, latitude, longitude}] (lightweight response, no pagination)
         |
         v
    GroupMapPanel reads coordinates → AdvancedMarker per coordinate
         |-- MarkerClusterer groups nearby markers
         |-- Cluster pin (count badge) → onClusterClick → multi-listing popup
         |-- Single pin → onClick → InfoWindow with hero photo / price / address / bed/bath/sqft / link
```

### Recommended Project Structure (new files only)

```
frontend/src/
├── assets/
│   ├── api/
│   │   └── dashboard/
│   │       └── groups/
│   │           └── fetchGroupEstateCoordinates.ts    # new API call
│   └── types/
│       └── estateListingDetailsType.ts               # add latitude, longitude, geocodingFailed
├── components/
│   └── dashboard/
│       └── general/
│           ├── GroupMapPanel.tsx                     # new map container component
│           └── GroupMapPinPopup.tsx                  # new InfoWindow card content
├── store/
│   └── hooks/
│       ├── Dashboard/
│       │   └── groups/
│       │       └── useFetchGroupEstateCoordinates.ts  # new hook
│       └── queryKeys.tsx                             # add dashboardGroupEstateCoordinatesKeys

backend/app/
├── controllers/
│   └── v1/
│       └── dashboard/
│           └── group/
│               └── estates_controller.rb             # add #coordinates action
└── config/
    └── routes.rb                                     # add get :coordinates to collection
```

### Pattern 1: Backend — New /coordinates Collection Action

**What:** A lightweight collection action that returns only `[{id, latitude, longitude}]` for all listings with coordinates matching the current filter params. No pagination.

**When to use:** Called by `useFetchGroupEstateCoordinates` hook (map panel only).

```ruby
# File: backend/app/controllers/v1/dashboard/group/estates_controller.rb
# Add this action alongside the existing #cities action
# Source: modeled on #cities action (verified in codebase)

def coordinates
  scope = GroupEstatesQuery.new(@group, Current.user, params).call
    .joins(:listing_detail)
    .where.not(listing_details: { latitude: nil })
    .where.not(listing_details: { longitude: nil })
    .select("estates.id, listing_details.latitude, listing_details.longitude")

  coords = scope.map do |e|
    { id: e.id.to_s, latitude: e.latitude, longitude: e.longitude }
  end

  render json: { coordinates: coords }, status: :ok
end
```

**Route addition** (in `routes.rb`):
```ruby
resources :estates, only: [:index, :show], controller: "group/estates" do
  collection do
    get :cities
    get :coordinates   # ← add this line
  end
  # ... existing member actions ...
end
```

**Key points:**
- Inherits `before_action :authenticate_cognito_user!` and `before_action :set_group` from controller — proper auth/tenancy [VERIFIED: estates_controller.rb]
- `GroupEstatesQuery` already applies all filter params — reuse it, no duplication
- `.select("estates.id, ...")` fetches only needed columns — avoids loading full estate objects
- No `Pagy` pagination — returns all matching records
- The `id.to_s` converts the integer PK to string to match the frontend `estate.id` type (string) [VERIFIED: EstateType interface]

### Pattern 2: Frontend TypeScript Type Update

**What:** Add `latitude`, `longitude`, `geocodingFailed` to `EstateListingDetails` type.

**When to use:** Phase 8 already added these columns; the TS type was never updated.

```typescript
// File: frontend/src/assets/types/estateListingDetailsType.ts — add to existing interface
latitude: number | null
longitude: number | null
geocodingFailed: boolean | null
```

Also add a new type for coordinate data:

```typescript
// File: frontend/src/assets/types/estateCoordinateType.ts — new file
export interface EstateCoordinate {
  id: string
  latitude: number
  longitude: number
}
```

### Pattern 3: API Call and Hook

**What:** `fetchGroupEstateCoordinates` API function and `useFetchGroupEstateCoordinates` hook.

**When to use:** Called from `GeneralDashboardContext` alongside existing estate hooks.

```typescript
// File: frontend/src/assets/api/dashboard/groups/fetchGroupEstateCoordinates.ts
// Source: modeled on fetchGroupEstates.ts (verified)
import api from '@/assets/axios/axios'
import { EstateCoordinate } from '@/assets/types/estateCoordinateType'

// Re-export or define a subset of FetchGroupEstatesPayload without pagination
interface FetchGroupEstateCoordinatesPayload {
  groupId: string
  search?: string
  showFavoritesOnly?: boolean
  cities?: string[]
  propertyTypes?: string[]
  minPrice?: string
  maxPrice?: string
  // ... all the same filter params as fetchGroupEstates, except pagination
}

interface FetchGroupEstateCoordinatesResponse {
  coordinates: EstateCoordinate[]
}

const fetchGroupEstateCoordinates = async (
  payload: FetchGroupEstateCoordinatesPayload
): Promise<FetchGroupEstateCoordinatesResponse> => {
  const { groupId, search, showFavoritesOnly, cities, propertyTypes, ...rest } = payload
  const response = await api.get(`/v1/dashboard/groups/${groupId}/estates/coordinates`, {
    params: {
      ...(search && { search }),
      ...(showFavoritesOnly && { favorites_only: showFavoritesOnly }),
      ...(cities?.length && { 'cities[]': cities }),
      ...(propertyTypes?.length && { 'property_types[]': propertyTypes }),
      // ... same param serialization as fetchGroupEstates
    },
  })
  return response.data
}
export type { FetchGroupEstateCoordinatesPayload, FetchGroupEstateCoordinatesResponse }
export default fetchGroupEstateCoordinates
```

```typescript
// File: frontend/src/store/hooks/Dashboard/groups/useFetchGroupEstateCoordinates.ts
// Source: modeled on useFetchGroupEstates.tsx (verified)
import { useQuery } from '@tanstack/react-query'
import fetchGroupEstateCoordinates, {
  FetchGroupEstateCoordinatesPayload
} from '@/assets/api/dashboard/groups/fetchGroupEstateCoordinates'
import { dashboardGroupEstateCoordinatesKeys } from '@/store/hooks/queryKeys'

const useFetchGroupEstateCoordinates = (
  enabled: boolean,
  props?: FetchGroupEstateCoordinatesPayload
) => {
  return useQuery({
    queryKey: props
      ? dashboardGroupEstateCoordinatesKeys.list(props)
      : dashboardGroupEstateCoordinatesKeys.all,
    queryFn: async () => fetchGroupEstateCoordinates(props!),
    enabled,
    retry: false,
    keepPreviousData: true,
  })
}

export default useFetchGroupEstateCoordinates
```

Add to `queryKeys.tsx`:
```typescript
export const dashboardGroupEstateCoordinatesKeys = {
  all: ['dashboard', 'groups', 'estates', 'coordinates'] as const,
  list: (params: FetchGroupEstateCoordinatesPayload) =>
    [...dashboardGroupEstateCoordinatesKeys.all, params] as const,
}
```

### Pattern 4: GroupMapPanel Component (Map Rendering + Clustering + Popups)

**What:** The map panel component. Wires `@vis.gl/react-google-maps` + `@googlemaps/markerclusterer`.

**When to use:** Rendered inside `GeneralDashboard` between the filter bar and the listings grid.

```tsx
// File: frontend/src/components/dashboard/general/GroupMapPanel.tsx
// Source: APIProvider + AdvancedMarker pattern from https://visgl.github.io/react-google-maps/docs
// Source: MarkerClusterer pattern from @googlemaps/markerclusterer docs
import { useRef, useEffect, useState, useCallback } from 'react'
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import type { Marker } from '@googlemaps/markerclusterer'
import { EstateCoordinate } from '@/assets/types/estateCoordinateType'

// Inner component: needs access to map instance via useMap()
const MapContent = ({
  coordinates,
  onPinClick,
}: {
  coordinates: EstateCoordinate[]
  onPinClick: (id: string, position: { lat: number; lng: number }) => void
}) => {
  const map = useMap()
  const clusterer = useRef<MarkerClusterer | null>(null)
  const [markers, setMarkers] = useState<{ [key: string]: Marker }>({})

  // Initialize clusterer when map is ready
  useEffect(() => {
    if (!map) return
    clusterer.current = new MarkerClusterer({ map })
    return () => { clusterer.current?.clearMarkers() }
  }, [map])

  // Update clusterer when markers change
  useEffect(() => {
    clusterer.current?.clearMarkers()
    clusterer.current?.addMarkers(Object.values(markers))
  }, [markers])

  // Track marker refs for clusterer
  const setMarkerRef = useCallback((marker: Marker | null, key: string) => {
    setMarkers(prev => {
      if (marker && prev[key]) return prev  // already tracked
      if (!marker && !prev[key]) return prev  // already removed
      const next = { ...prev }
      if (marker) next[key] = marker
      else delete next[key]
      return next
    })
  }, [])

  return (
    <>
      {coordinates.map(coord => (
        <AdvancedMarker
          key={coord.id}
          position={{ lat: coord.latitude, lng: coord.longitude }}
          ref={marker => setMarkerRef(marker, coord.id)}
          onClick={() => onPinClick(coord.id, { lat: coord.latitude, lng: coord.longitude })}
        />
      ))}
    </>
  )
}

interface GroupMapPanelProps {
  coordinates: EstateCoordinate[]
  // additional props for popup data lookup
}

const GroupMapPanel = ({ coordinates }: GroupMapPanelProps) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

  if (!apiKey) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Google Maps API key not configured
      </div>
    )
  }

  if (coordinates.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No listings with location data
      </div>
    )
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div className="h-96 w-full overflow-hidden rounded-xl border">
        <Map
          mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'group-dashboard-map'}
          defaultCenter={{ lat: 49.28, lng: -123.12 }} // Vancouver default
          defaultZoom={11}
          style={{ width: '100%', height: '100%' }}
          gestureHandling="cooperative"
        >
          <MapContent coordinates={coordinates} onPinClick={() => {}} />
        </Map>
      </div>
    </APIProvider>
  )
}

export default GroupMapPanel
```

**Key architecture notes:**
- `useMap()` only works inside an `APIProvider` + `Map` subtree — MapContent must be a child of `Map`
- `clusterer.current.addMarkers()` receives `google.maps.marker.AdvancedMarkerElement` instances from AdvancedMarker's `ref` callback
- The `setMarkerRef` pattern handles mount/unmount correctly [VERIFIED: vis.gl/react-google-maps discussions #325]

### Pattern 5: Filter Sync (MAP-03)

**How it works automatically:**

`GeneralDashboardContext` holds all filter state (searchTerm, cities, propertyTypes, etc.). When a filter changes:
1. Context state updates
2. `useFetchGroupEstateCoordinates` detects new query key (includes filter params) via TanStack Query
3. TanStack Query refetches `/coordinates` with new params
4. New coordinates flow into `GroupMapPanel` → pins update

The context needs to call `useFetchGroupEstateCoordinates` with the same filter params it already passes to `useFetchGroupEstates`.

```typescript
// In GeneralDashboardContext.tsx — add alongside existing useFetchGroupEstates call:
const coordinatesQuery = useFetchGroupEstateCoordinates(
  groupSelected,
  {
    groupId: selectedGroup?.id!,
    search: searchTerm,
    showFavoritesOnly,
    cities,
    propertyTypes,
    minPrice: minPrice || undefined,
    // ... same filters as groupEstatesQuery
  }
)
// Expose in state:
// mapCoordinates: coordinatesQuery.data?.coordinates ?? []
```

### Pattern 6: Popup Card for Single Pin (MAP-06)

**What:** InfoWindow showing hero photo, price, address, bed/bath/sqft, "View details" link.

**The challenge:** The `/coordinates` endpoint only returns `{id, lat, lng}`. To show the full popup card, we need the estate's `listingDetail` data (hero photo, price, address, beds, baths, sqft). This data is already available in `groupEstatesQuery.data.estates` from the existing paginated hook.

**Solution:** On pin click, look up the estate in the already-loaded `groupEstatesQuery.data.estates` array. If found (listing is on the current page), show full popup. If not found (listing is not on current page), navigate directly to the listing detail.

**Better solution:** Pass the full coordinates query data alongside a lookup map of estate data.

The planner should decide whether to:
- A) Store a subset of listing data in the coordinates response (add `heroImageUrl`, `listPrice`, `address`, `beds`, `baths`, `sqft` to the coordinates endpoint)
- B) Do a second fetch when a pin is clicked (on-demand detail fetch)

**Recommendation:** Approach A — extend the coordinates endpoint to return the minimum fields needed for the popup card:
```json
{
  "coordinates": [
    {
      "id": "123",
      "latitude": 49.28,
      "longitude": -123.12,
      "heroImageUrl": "https://...",
      "listPrice": "$1,200,000",
      "address": "123 Main St, Vancouver",
      "beds": 3,
      "baths": 2,
      "sqft": 1450
    }
  ]
}
```
This avoids a second network round-trip per click and keeps the popup snappy.

### Pattern 7: Multi-Listing Cluster Popup (MAP-05)

**What:** Clicking a cluster at max zoom shows a multi-listing popup (not zoom-in behavior).

**Challenge:** `@googlemaps/markerclusterer` default behavior on cluster click is to zoom in. At max zoom, the clusterer calls `defaultOnClusterClickHandler` which attempts `map.fitBounds(cluster.bounds)`.

**Implementation strategy:**

```typescript
// In the MapContent component:
import { defaultOnClusterClickHandler } from '@googlemaps/markerclusterer'

const handleClusterClick = useCallback((
  event: google.maps.MapMouseEvent,
  cluster: Cluster,
  map: google.maps.Map
) => {
  const currentZoom = map.getZoom() ?? 0
  const maxZoom = 19 // Google Maps max zoom

  if (currentZoom >= maxZoom) {
    // At max zoom: show multi-listing popup instead of zooming
    const clusterPosition = cluster.position
    const clusterMarkerIds = cluster.markers?.map(m => {
      // Look up estate id from the markers tracking map (reverse lookup)
      return Object.keys(markersRef.current).find(id => markersRef.current[id] === m)
    }).filter(Boolean) as string[]

    setClusterPopup({
      position: { lat: clusterPosition.lat(), lng: clusterPosition.lng() },
      estateIds: clusterMarkerIds,
    })
  } else {
    // Not at max zoom: use default zoom-in behavior
    defaultOnClusterClickHandler(event, cluster, map)
  }
}, [])

// Pass to MarkerClusterer constructor:
clusterer.current = new MarkerClusterer({ map, onClusterClick: handleClusterClick })
```

**Key types from `@googlemaps/markerclusterer` (VERIFIED from package .d.ts):**
```typescript
type onClusterClickHandler = (
  event: google.maps.MapMouseEvent,
  cluster: Cluster,
  map: google.maps.Map
) => void

class Cluster {
  readonly markers: Marker[]  // google.maps.marker.AdvancedMarkerElement references
  get position(): google.maps.LatLng
  get bounds(): google.maps.LatLngBounds | undefined
  get count(): number
}
```

**The reverse lookup problem:** `cluster.markers` contains `google.maps.marker.AdvancedMarkerElement` instances, but we need estate IDs. Use a `Map<google.maps.marker.AdvancedMarkerElement, string>` to track the reverse mapping alongside the `markers` state object.

### Anti-Patterns to Avoid

- **Calling `useMap()` outside the `Map` child tree:** `useMap()` requires being rendered as a descendant of `<Map>`. Put MapContent as a child component inside `<Map>`, not as a sibling. [VERIFIED: vis.gl/react-google-maps docs]
- **`AdvancedMarker` without `mapId` on `<Map>`:** `AdvancedMarker` requires a `mapId` prop on the parent `Map` component. Without it, the component throws at runtime. [VERIFIED: vis.gl/react-google-maps docs — "requires a Map component with a valid mapId"]
- **Calling `camelcaseKeys` in the hook:** The Axios interceptor already applies `camelcaseKeys` globally. Never call it again in hooks. [CLAUDE.md]
- **Rendering `APIProvider` inside the context function:** `APIProvider` is a React component and must be rendered in JSX, not called in a hook. It belongs in `GroupMapPanel.tsx`.
- **Putting all map logic inside `GeneralDashboardContext`:** The context manages data; `GroupMapPanel` owns the map UI. Keep them separate per the existing Context/Component split pattern.
- **Storing all estate data in the coordinates endpoint response unnecessarily:** Only include the fields needed for the popup card. The coordinates endpoint is not a replacement for the full estates endpoint.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Proximity clustering | Custom distance-based grouping | `@googlemaps/markerclusterer` (SuperClusterAlgorithm) | Handles viewport-aware clustering, zoom levels, boundary updates — non-trivial to implement correctly |
| Map tile rendering | Direct Google Maps API script tag | `APIProvider` from `@vis.gl/react-google-maps` | Handles API loading, context propagation, React lifecycle integration |
| Marker management with cluster | Manual DOM manipulation | `AdvancedMarker` + `setMarkerRef` pattern | Library handles OverlayView lifecycle, cluster coordination, and cleanup |
| InfoWindow HTML injection | Manually appending DOM elements | `InfoWindow` from `@vis.gl/react-google-maps` | Renders React content inside the InfoWindow via portal |

**Key insight:** The `MarkerClusterer` + `AdvancedMarker` ref pattern is boilerplate-heavy but well-documented. The only truly custom code in this phase is the cluster click handler (max-zoom popup) and the popup card content. Everything else is standard library usage.

---

## Common Pitfalls

### Pitfall 1: mapId is Required for AdvancedMarker

**What goes wrong:** `AdvancedMarker` renders nothing or throws a console error: "AdvancedMarkerElement requires a mapId".
**Why it happens:** Google Maps Advanced Markers require a Cloud Maps Platform Map ID to be configured. Without it, the feature is disabled.
**How to avoid:** Add `mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID}` to the `<Map>` component. Create the Map ID in Google Cloud Console → Maps Platform → Map IDs. Add `VITE_GOOGLE_MAPS_MAP_ID` to `.env` and `.env.example`.
**Warning signs:** Map renders, but markers do not appear.

### Pitfall 2: MarkerClusterer Receives Stale Markers After Filter Change

**What goes wrong:** After filter changes, some old pins remain on the map.
**Why it happens:** `clusterer.current.clearMarkers()` removes all markers, but if AdvancedMarker refs are still mounted (React hasn't unmounted them yet), the clusterer and React marker state get out of sync.
**How to avoid:** The `useEffect` that calls `clearMarkers()` + `addMarkers()` must depend on the `markers` state object (not the coordinates array). The markers state is updated via the `setMarkerRef` callback, which fires after React reconciles the AdvancedMarker children. [VERIFIED: vis.gl/react-google-maps discussions pattern]
**Warning signs:** Extra pins on the map, duplicate cluster counts.

### Pitfall 3: Cluster Click Handler Loses Marker-to-Estate Mapping

**What goes wrong:** `cluster.markers` contains `AdvancedMarkerElement` instances, but there's no way to find the estate ID from a marker element.
**Why it happens:** `AdvancedMarkerElement` is a Google Maps DOM object with no custom data property in the standard API.
**How to avoid:** Maintain a parallel `Map<Marker, string>` (markerToEstateId) alongside the `markers` state. Update it in the same `setMarkerRef` callback. In the cluster click handler, look up each `cluster.markers` entry in this reverse map.
**Warning signs:** Cluster popup shows no listings or undefined IDs.

### Pitfall 4: Filter Sync Uses Different Filter Params Than the Grid

**What goes wrong:** Map pins don't update when user changes a filter because the coordinates hook doesn't pass that specific filter param.
**Why it happens:** Developer copies the coordinates hook signature without including all filters that `useFetchGroupEstates` accepts.
**How to avoid:** The coordinates hook must accept EXACTLY the same filter params as `useFetchGroupEstates`. In `GeneralDashboardContext`, pass all filter state values to both hooks in parallel.
**Warning signs:** Map shows different listings than the grid for the same filter selection.

### Pitfall 5: Map Takes Full Screen Width Breaking the Dashboard Layout

**What goes wrong:** `Map` component with `width: '100%'` expands outside the `max-w-5xl` container or breaks the flex layout.
**Why it happens:** The `Map` component uses absolute positioning internally; its container needs explicit height.
**How to avoid:** Wrap the `APIProvider` + `Map` in a `div` with explicit `height` (e.g., `h-96`) and `w-full`. Keep it within the existing `max-w-5xl` container.
**Warning signs:** Map overlaps header, or collapses to 0 height.

### Pitfall 6: Google Maps API Key Exposed Without Restrictions

**What goes wrong:** The `VITE_GOOGLE_MAPS_API_KEY` is embedded in the build output (JavaScript bundle) and can be extracted by anyone viewing the page source.
**Why it happens:** All Vite env vars prefixed `VITE_` are public by design.
**How to avoid:** In Google Cloud Console, restrict the API key to specific referrer domains (e.g., `*.realtybase.ca`, `localhost`). This prevents unauthorized use from other domains even if the key is extracted. [ASSUMED — standard Google Maps Platform security practice]
**Warning signs:** Unexpectedly high Google Maps billing; API key abuse alerts.

---

## Code Examples

### Verified: APIProvider + Map Setup

```tsx
// Source: https://visgl.github.io/react-google-maps/docs/get-started (verified)
import { APIProvider, Map } from '@vis.gl/react-google-maps'

<APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
  <Map
    mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID}
    defaultCenter={{ lat: 49.28, lng: -123.12 }}
    defaultZoom={11}
    style={{ width: '100%', height: '100%' }}
  />
</APIProvider>
```

### Verified: AdvancedMarker + InfoWindow Pattern

```tsx
// Source: https://context7.com/visgl/react-google-maps/llms.txt (VERIFIED)
import { AdvancedMarker, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps'

const [markerRef, marker] = useAdvancedMarkerRef()
const [infoWindowShown, setInfoWindowShown] = useState(false)

<AdvancedMarker
  ref={markerRef}
  position={{ lat: 49.28, lng: -123.12 }}
  onClick={() => setInfoWindowShown(true)}
/>

{infoWindowShown && (
  <InfoWindow anchor={marker} onClose={() => setInfoWindowShown(false)}>
    <div>Popup content</div>
  </InfoWindow>
)}
```

### Verified: MarkerClusterer useEffect Pattern

```tsx
// Source: vis.gl/react-google-maps GitHub discussions #325 + #406 (VERIFIED)
const map = useMap()
const clusterer = useRef<MarkerClusterer | null>(null)
const [markers, setMarkers] = useState<{ [id: string]: Marker }>({})

useEffect(() => {
  if (!map) return
  clusterer.current = new MarkerClusterer({ map })
  return () => { clusterer.current?.clearMarkers() }
}, [map])

useEffect(() => {
  clusterer.current?.clearMarkers()
  clusterer.current?.addMarkers(Object.values(markers))
}, [markers])

const setMarkerRef = useCallback((marker: Marker | null, id: string) => {
  setMarkers(prev => {
    if (marker && prev[id]) return prev
    if (!marker && !prev[id]) return prev
    const next = { ...prev }
    if (marker) next[id] = marker
    else delete next[id]
    return next
  })
}, [])
```

### Verified: Cluster Click at Max Zoom

```typescript
// Source: @googlemaps/markerclusterer .d.ts types (VERIFIED from package inspection)
// onClusterClickHandler = (event: google.maps.MapMouseEvent, cluster: Cluster, map: google.maps.Map) => void
// cluster.markers = Marker[] (google.maps.marker.AdvancedMarkerElement[])
// cluster.position = google.maps.LatLng

import { defaultOnClusterClickHandler } from '@googlemaps/markerclusterer'

const handleClusterClick = (event, cluster, map) => {
  const zoom = map.getZoom() ?? 0
  if (zoom >= 19) {
    // At max zoom: show popup
    setClusterInfo({
      position: { lat: cluster.position.lat(), lng: cluster.position.lng() },
      markerRefs: cluster.markers ?? [],
    })
  } else {
    defaultOnClusterClickHandler(event, cluster, map)
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@react-google-maps/api` | `@vis.gl/react-google-maps` | 2023–2024 | Google now endorses vis.gl; @react-google-maps/api still maintained but not recommended for new projects |
| Legacy `google.maps.Marker` | `AdvancedMarker` | Maps JS API v3.55+ | Legacy Marker deprecated; AdvancedMarker supports custom HTML content and clustering |
| Deprecated `MarkerClustererPlus` | `@googlemaps/markerclusterer` v2 | 2022 | New library with TypeScript-first design and AdvancedMarker support |

**Deprecated/outdated:**
- `google.maps.Marker` (legacy): Still functional but deprecated. `AdvancedMarker` is the current standard. [VERIFIED: Google Maps Platform docs]
- `MarkerClustererPlus`: Old npm package. Use `@googlemaps/markerclusterer` instead.

---

## Open Questions

1. **MapId provisioning**
   - What we know: `AdvancedMarker` requires `mapId` on the parent `<Map>`. A Map ID is created in Google Cloud Console.
   - What's unclear: The user (Tom) must create a Map ID in Google Cloud Console and add it to `.env`. The research cannot verify if a Map ID already exists for this project.
   - Recommendation: The plan must include a task that documents the Map ID setup step as a prerequisite. Add `VITE_GOOGLE_MAPS_MAP_ID` to `.env.example`.

2. **Google Maps API Key**
   - What we know: `APIProvider` requires an API key. No `VITE_GOOGLE_MAPS_API_KEY` exists in `.env` or `.env.example`. [VERIFIED: .env.example inspection]
   - What's unclear: Does Tom already have a Google Maps API key from the project's Google Cloud account?
   - Recommendation: Add `VITE_GOOGLE_MAPS_API_KEY=your-maps-api-key` to `.env.example`. The plan must note that the Maps JavaScript API must be enabled on the project's Google Cloud Console. This is a human setup step, not code.

3. **Map default center for the group**
   - What we know: The `Map` component needs a `defaultCenter`. Vancouver BC is the seed city data.
   - What's unclear: Should the map auto-fit to show all pins (using `map.fitBounds`), or use a hardcoded default?
   - Recommendation: Use `map.fitBounds` on initial load when coordinates are available; fall back to Vancouver default when no coordinates exist.

4. **Popup card data source for the map (architecture choice for planner)**
   - What we know: `/coordinates` endpoint (lightweight) vs. existing paginated estates endpoint
   - Recommendation given: Extend `/coordinates` to return `heroImageUrl`, `listPrice`, `address`, `beds`, `baths`, `sqft` alongside coordinates. This avoids a second round-trip on pin click.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install | Yes | v22.9.0 | — |
| npm | Package install | Yes | 10.8.3 | — |
| @vis.gl/react-google-maps | Map rendering | Not installed | 1.8.3 (registry) | — |
| @googlemaps/markerclusterer | Clustering | Not installed | 2.6.2 (registry) | — |
| Google Maps JavaScript API (browser) | Map rendering | Needs API key | — | Degrade gracefully (hide map panel) |
| VITE_GOOGLE_MAPS_API_KEY | APIProvider | Not set | — | Map panel shows "API key not configured" |
| VITE_GOOGLE_MAPS_MAP_ID | AdvancedMarker mapId | Not set | — | Markers will not render without this |

**Missing dependencies with no fallback:**
- `VITE_GOOGLE_MAPS_API_KEY` — must be added to `.env` before the map panel works. Human setup step.
- `VITE_GOOGLE_MAPS_MAP_ID` — must be created in Google Cloud Console and added to `.env`. Human setup step.

**Missing dependencies with fallback:**
- `@vis.gl/react-google-maps` — installed via `npm install` in Wave 0. No fallback needed; this is the implementation.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Map panel is read-only; auth is on the backend /coordinates endpoint |
| V3 Session Management | No | No session changes |
| V4 Access Control | Yes | `/coordinates` inherits `authenticate_cognito_user!` + `set_group` (group membership check) from the estates controller — verified in codebase |
| V5 Input Validation | Yes | Filter params on `/coordinates` are processed by `GroupEstatesQuery` — same validation as existing `/index` endpoint |
| V6 Cryptography | No | No cryptography involved |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Google Maps API key abuse (key extracted from JS bundle) | Spoofing / Tampering | Restrict API key to allowed referrer domains in Google Cloud Console [ASSUMED — standard GCP practice] |
| Unauthorized group listing coordinates access | Information Disclosure | `/coordinates` is protected by Cognito JWT auth + group membership check (inherits before_actions from estates controller) [VERIFIED: estates_controller.rb] |
| Filter param injection (e.g., malformed `min_price` param) | Tampering | `GroupEstatesQuery` processes params server-side — same guards as existing estates endpoint; no new attack surface |
| Information leakage via coordinates endpoint | Information Disclosure | Coordinates reveal property location — already known to group members; no new disclosure beyond what `index` returns |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `AdvancedMarker` requires `mapId` on parent `<Map>` — a Map ID must be created in Google Cloud Console | Pitfall 1, Environment Availability | If a simpler `mapId="DEMO_MAP_ID"` works without Cloud Console setup, setup steps are simpler. Docs say mapId is required. [CITED: vis.gl docs] |
| A2 | Google Maps API key referrer restrictions in GCP prevent key abuse from unauthorized domains | Security Domain | If developer skips this, key can be abused. Risk is financial (billing), not data exposure. |
| A3 | Typical group size in production will exceed 100 listings for some customers, justifying a dedicated `/coordinates` endpoint over per-page capping | Standard Stack | If all groups stay under 100 listings forever, the paginated approach works. `/coordinates` is better long-term regardless. |
| A4 | `TypeScript 4.9.4` (project version) is compatible with `@vis.gl/react-google-maps` 1.8.3 distributed types | Standard Stack | The library uses `^6.0.2` TS internally but ships pre-compiled `.d.ts`. If any type uses TS 5+ syntax, there could be a compile error. Low risk — standard React types. |
| A5 | `cluster.markers` on `@googlemaps/markerclusterer` v2.6.2 contains the `google.maps.marker.AdvancedMarkerElement` instances that match the refs from `AdvancedMarker` component | Pattern 7 (cluster popup) | If the library wraps markers in proxy objects, the identity comparison in reverse lookup fails. Should be verified with an integration test on first run. [VERIFIED: cluster.d.ts types confirm `markers: Marker[]`] |

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAP-02 | Group dashboard renders an interactive Google Maps panel showing a pin for each listing in the group | `@vis.gl/react-google-maps` + `AdvancedMarker` per coordinate; new `/coordinates` backend endpoint returns all coordinates without pagination |
| MAP-03 | Group dashboard map updates its pins in real time when the active filter set changes | `useFetchGroupEstateCoordinates` hook accepts same filter params as `useFetchGroupEstates`; TanStack Query refetches when query key (which includes filter state) changes; filter state in `GeneralDashboardContext` drives both hooks |
| MAP-05 | Listings in close geographic proximity are grouped into a cluster pin; expanding reveals individual listing cards | `@googlemaps/markerclusterer` provides clustering; custom `onClusterClick` handler intercepts max-zoom clicks to show multi-listing `InfoWindow` instead of default zoom behavior |
| MAP-06 | Clicking any listing pin opens a popup card displaying hero photo, address, price, bed/bath count, sqft, and "View details" link | `InfoWindow` anchored to `AdvancedMarker`; popup card content sourced from coordinates endpoint (extended to include display fields); "View details" links to `/:groupId/estate/:estateId` [VERIFIED: dashboard router] |

---

## Sources

### Primary (HIGH confidence)
- `/home/tomlaventure/projects/realstate/frontend/src/containers/dashboard/general/GeneralDashboardContext.tsx` — complete filter state management, hook wiring, context shape
- `/home/tomlaventure/projects/realstate/frontend/src/containers/dashboard/general/GeneralDashboard.tsx` — layout structure, where map panel inserts
- `/home/tomlaventure/projects/realstate/frontend/src/assets/api/dashboard/groups/fetchGroupEstates.ts` — API call pattern to replicate for coordinates endpoint
- `/home/tomlaventure/projects/realstate/frontend/src/store/hooks/Dashboard/groups/useFetchGroupEstates.tsx` — hook pattern to follow
- `/home/tomlaventure/projects/realstate/frontend/src/assets/types/estateListingDetailsType.ts` — confirmed lat/lng absent; needs adding
- `/home/tomlaventure/projects/realstate/frontend/src/store/hooks/queryKeys.tsx` — query key naming convention
- `/home/tomlaventure/projects/realstate/frontend/package.json` — confirmed @vis.gl/react-google-maps NOT installed; React 18, TanStack Query 4.x, TS 4.9
- `/home/tomlaventure/projects/realstate/frontend/.env.example` — confirmed no VITE_GOOGLE_MAPS_API_KEY
- `/home/tomlaventure/projects/realstate/backend/app/controllers/v1/dashboard/group/estates_controller.rb` — before_actions, auth pattern, existing #cities collection action reference
- `/home/tomlaventure/projects/realstate/backend/config/routes.rb` — confirmed route structure for adding :coordinates collection action
- `/home/tomlaventure/projects/realstate/backend/app/serializers/listing_detail_serializer.rb` — confirmed :latitude, :longitude, :geocoding_failed already present (Phase 8 complete)
- `/home/tomlaventure/projects/realstate/backend/db/schema.rb` — confirmed `decimal(10,6)` lat/lng columns on `listing_details`
- `/tmp/package/dist/cluster.d.ts` — VERIFIED: `Cluster.markers: Marker[]`, `Cluster.position: google.maps.LatLng` from @googlemaps/markerclusterer 2.6.2
- `/tmp/package/dist/markerclusterer.d.ts` — VERIFIED: `onClusterClickHandler` type signature
- Context7 `/visgl/react-google-maps` — APIProvider, Map, AdvancedMarker, InfoWindow, useAdvancedMarkerRef, useMap patterns
- npm registry — version verification for @vis.gl/react-google-maps (1.8.3), @googlemaps/markerclusterer (2.6.2)

### Secondary (MEDIUM confidence)
- https://github.com/visgl/react-google-maps/discussions/163 — library comparison rationale (vis.gl vs @react-google-maps/api)
- https://github.com/visgl/react-google-maps/discussions/325 — setMarkerRef pattern with clustering
- https://visgl.github.io/react-google-maps/docs/get-started — TypeScript bundled, no @types/google.maps needed

### Tertiary (LOW confidence)
- A5 in Assumptions Log — cluster.markers identity matching with AdvancedMarker refs (needs runtime verification)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry verified, library docs verified via Context7
- Architecture: HIGH — all patterns derived directly from codebase + verified library docs
- Backend coordinate endpoint: HIGH — follows established /cities pattern from same controller
- Cluster popup (max zoom behavior): MEDIUM — library types verified, but runtime behavior of `cluster.markers` identity with AdvancedMarker refs not tested in a live environment
- Pitfalls: HIGH — derived from vis.gl docs + GitHub discussions + package type inspection

**Research date:** 2026-05-16
**Valid until:** 2026-08-16 (vis.gl is actively maintained; @googlemaps/markerclusterer is stable)
