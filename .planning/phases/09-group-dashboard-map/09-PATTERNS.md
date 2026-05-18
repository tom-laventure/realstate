# Phase 9: Group Dashboard Map — Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 11 new/modified files
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/controllers/v1/dashboard/group/estates_controller.rb` | controller | request-response | same file (add action) | exact — add `#coordinates` alongside `#cities` |
| `backend/config/routes.rb` | config | — | same file (add route) | exact — add `get :coordinates` to collection block |
| `frontend/src/assets/types/estateCoordinateType.ts` | type | — | `src/assets/types/estateListingDetailsType.ts` | role-match |
| `frontend/src/assets/types/estateListingDetailsType.ts` | type | — | same file (extend) | exact — append 3 fields |
| `frontend/src/assets/api/dashboard/groups/fetchGroupEstateCoordinates.ts` | API module | request-response | `src/assets/api/dashboard/groups/fetchGroupEstates.ts` | exact |
| `frontend/src/store/hooks/Dashboard/groups/useFetchGroupEstateCoordinates.ts` | hook | request-response | `src/store/hooks/Dashboard/groups/useFetchGroupEstates.tsx` | exact |
| `frontend/src/store/hooks/queryKeys.tsx` | config | — | same file (add key object) | exact |
| `frontend/src/components/dashboard/general/GroupMapPanel.tsx` | component | event-driven | `src/components/dashboard/general/DashboardLoading.tsx` (states), `ListingsGrid.tsx` (empty state) | partial — new map library, UI states from analogs |
| `frontend/src/components/dashboard/general/GroupMapPinPopup.tsx` | component | event-driven | `src/components/dashboard/general/ListingsGrid.tsx` | role-match — same card anatomy (image + price + address + stats + link) |
| `frontend/src/components/dashboard/general/GroupMapClusterPopup.tsx` | component | event-driven | `src/components/dashboard/general/ListingsGrid.tsx` | partial — row list format |
| `frontend/src/containers/dashboard/general/GeneralDashboardContext.tsx` | context | request-response | same file (extend) | exact |
| `frontend/src/containers/dashboard/general/GeneralDashboard.tsx` | container | — | same file (extend) | exact |
| `frontend/.env.example` | config | — | same file (extend) | exact |

---

## Pattern Assignments

### `backend/app/controllers/v1/dashboard/group/estates_controller.rb` (controller, request-response)

**Analog:** Same file — add `#coordinates` alongside the existing `#cities` action.

**Auth/tenancy pattern** (lines 9-10 of estates_controller.rb):
```ruby
before_action :authenticate_cognito_user!
before_action :set_group
```
Both before_actions are already inherited — the new `#coordinates` action gets them for free.

**Closest existing action to copy — `#cities`** (lines 169-177):
```ruby
def cities
  cities = @group.estates.without_deleted
    .joins(:listing_detail)
    .where.not(listing_details: {city: nil})
    .where.not(listing_details: {city: ""})
    .distinct.pluck("listing_details.city").sort
  render json: {cities: cities}, status: :ok
end
```

**New `#coordinates` action — follow the same structure but use `GroupEstatesQuery` for filter support and extend the select to include popup display fields:**
```ruby
def coordinates
  scope = GroupEstatesQuery.new(@group, Current.user, params).call
    .joins(:listing_detail)
    .where.not(listing_details: { latitude: nil })
    .where.not(listing_details: { longitude: nil })
    .select(
      "estates.id",
      "listing_details.latitude",
      "listing_details.longitude",
      "listing_details.list_price",
      "listing_details.address",
      "listing_details.beds",
      "listing_details.baths",
      "listing_details.sqft",
      "listing_details.hero_image_url"
    )

  coords = scope.map do |e|
    {
      id: e.id.to_s,
      latitude: e.latitude,
      longitude: e.longitude,
      listPrice: e.list_price,
      address: e.address,
      beds: e.beds,
      baths: e.baths,
      sqft: e.sqft,
      heroImageUrl: e.hero_image_url
    }
  end

  render json: { coordinates: coords }, status: :ok
end
```

**Key differences from `#cities`:**
- Uses `GroupEstatesQuery` instead of `@group.estates` — required for filter param support (MAP-03)
- Uses `.select(...)` with explicit columns — avoids loading full estate AR objects
- `e.id.to_s` — frontend `EstateCoordinate.id` is typed as `string`, must match
- No `Pagy` — returns all matching coordinates without pagination
- `acts_as_paranoid` NOT on `listing_details` — no `deleted_at` guard needed on that join

**Error handling** (line 195 in `#rate` action — same controller, same pattern):
```ruby
rescue ActiveRecord::RecordInvalid
  render json: {errors: estate_rating.errors.full_messages}, status: :unprocessable_entity
end
```
The `#coordinates` action has no writes so no rescue block needed; Rails default 500 handler applies.

---

### `backend/config/routes.rb` (config)

**Analog:** Same file — line 129-138, the existing dashboard estates resource with `:cities` collection action.

**Existing collection block** (lines 129-138):
```ruby
resources :estates, only: [:index, :show], controller: "group/estates" do
  collection do
    get :cities
  end
  member do
    post :toggle_favorite
    post :toggle_rejection
    patch :rate
  end
  ...
end
```

**Change:** Add `get :coordinates` to the existing `collection do` block:
```ruby
collection do
  get :cities
  get :coordinates   # add this line
end
```

---

### `frontend/src/assets/types/estateCoordinateType.ts` (type, new file)

**Analog:** `src/assets/types/estateListingDetailsType.ts` (lines 1-38) — convention is `export default interface` for single-type files.

**Type file pattern** (estateListingDetailsType.ts lines 1-5):
```typescript
export default interface EstateListingDetails {
  id: string
  estateId: string
  listPrice: string | null
  ...
}
```

**New file to create:**
```typescript
// src/assets/types/estateCoordinateType.ts
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
Note: Named export (not default) because it will be re-imported in multiple files (API module, hook, component). Matches the research pattern for response-specific types.

---

### `frontend/src/assets/types/estateListingDetailsType.ts` (type, modify existing)

**Change:** Append 3 fields to the existing `EstateListingDetails` interface after line 38 (`heroImageUrl` and `photosSyncedAt`).

**Current tail** (lines 33-38):
```typescript
  sqft: number | null,
  openHouses: [],
  city?: string | null
  heroImageUrl: string | null
  photoCount: number | null
  photosSyncedAt: string | null
```

**Append these 3 fields:**
```typescript
  latitude: number | null
  longitude: number | null
  geocodingFailed: boolean | null
```

---

### `frontend/src/assets/api/dashboard/groups/fetchGroupEstateCoordinates.ts` (API module, new file)

**Analog:** `src/assets/api/dashboard/groups/fetchGroupEstates.ts` (all 97 lines) — exact same structure.

**Imports pattern** (fetchGroupEstates.ts lines 1-3):
```typescript
import api from '@/assets/axios/axios'
import EstateType from '@/assets/types/estateType'
import { PaginationMetaType, PaginationPostType } from '@/assets/types/paginationType'
```

**Interface + async function pattern** (fetchGroupEstates.ts lines 5-94):
```typescript
interface FetchGroupEstatesPayload {
    groupId: string
    pagination: PaginationPostType
    search?: string
    // ...all filter fields as optional strings/booleans
}

interface FetchGroupEstatesResponse {
    estates: EstateType[]
    meta: PaginationMetaType
}

const fetchGroupEstates = async ({
    groupId,
    pagination,
    search,
    // ...destructured params
}: FetchGroupEstatesPayload): Promise<FetchGroupEstatesResponse> => {
    const response = await api.get(`/v1/dashboard/groups/${groupId}/estates`, {
        params: {
            ...pagination,
            ...(search && { search }),
            ...(cities && cities.length > 0 && { 'cities[]': cities }),
            // ...conditional param spreading
        },
    })
    return response.data  // ← NEVER call camelcaseKeys here; interceptor handles it
}

export type { FetchGroupEstatesPayload, FetchGroupEstatesResponse }
export default fetchGroupEstates
```

**New file — key differences from fetchGroupEstates.ts:**
- No `pagination` field in payload (coordinates endpoint is unpaginated)
- Import `EstateCoordinate` from `@/assets/types/estateCoordinateType`
- Response type: `{ coordinates: EstateCoordinate[] }` (no `meta`)
- URL: `/v1/dashboard/groups/${groupId}/estates/coordinates`
- Same filter params block as `fetchGroupEstates` (all filters except pagination) — required for MAP-03 filter sync
- `return response.data` — same, no camelcaseKeys call

**Param serialization to copy verbatim** (fetchGroupEstates.ts lines 67-91):
```typescript
params: {
    ...(search && { search }),
    ...(showFavoritesOnly && { favorites_only: showFavoritesOnly }),
    ...(cities && cities.length > 0 && { 'cities[]': cities }),
    ...(propertyTypes && propertyTypes.length > 0 && { 'property_types[]': propertyTypes }),
    ...(minPrice && { min_price: minPrice }),
    ...(maxPrice && { max_price: maxPrice }),
    ...(minPricePerSqft && { min_price_per_sqft: minPricePerSqft }),
    ...(maxPricePerSqft && { max_price_per_sqft: maxPricePerSqft }),
    ...(maxMaintenanceFee && { max_maintenance_fee: maxMaintenanceFee }),
    ...(maxDaysListed && { max_days_listed: maxDaysListed }),
    ...(minBedrooms && { min_bedrooms: minBedrooms }),
    ...(minBathrooms && { min_bathrooms: minBathrooms }),
    ...(minSqft && { min_sqft: minSqft }),
    ...(maxAgeYears && { max_age_years: maxAgeYears }),
    ...(minUserRating && { min_user_rating: minUserRating }),
    ...(minGroupRating && { min_group_rating: minGroupRating }),
    ...(hasComments && { has_comments: hasComments }),
    ...(hasSharedDocuments && { has_shared_documents: hasSharedDocuments }),
    ...(pendingReview && { pending_review: pendingReview }),
    ...(showRejected && { show_rejected: showRejected }),
    ...(maxDaysAddedToGroup && { max_days_added_to_group: maxDaysAddedToGroup }),
    ...(sortBy && { sort_by: sortBy }),
},
```

---

### `frontend/src/store/hooks/Dashboard/groups/useFetchGroupEstateCoordinates.ts` (hook, new file)

**Analog:** `src/store/hooks/Dashboard/groups/useFetchGroupEstates.tsx` (all 21 lines) — exact same structure.

**Full hook pattern** (useFetchGroupEstates.tsx lines 1-21):
```typescript
import { useQuery } from '@tanstack/react-query'
import fetchGroupEstates, { FetchGroupEstatesPayload } from '@/assets/api/dashboard/groups/fetchGroupEstates'
import { AxiosErrorType } from '@/assets/types/axiosErrorType'
import { dashboardGroupEstatesKeys } from '@/store/hooks/queryKeys'

const useFetchGroupEstates = (enabled: boolean, props?: FetchGroupEstatesPayload) => {
    const { isLoading, data, isError, error, refetch } = useQuery({
        queryKey: props ? dashboardGroupEstatesKeys.list(props) : dashboardGroupEstatesKeys.all,
        queryFn: async () => fetchGroupEstates(props as FetchGroupEstatesPayload),
        retry: false,
        enabled,
        onError: (err: AxiosErrorType) => {
            console.error('Failed to fetch group estates:', err)
        },
        keepPreviousData: true,
    })

    return { isLoading, data, isError, error, refetch }
}

export default useFetchGroupEstates
```

**New file — substitute:**
- `fetchGroupEstates` → `fetchGroupEstateCoordinates`
- `FetchGroupEstatesPayload` → `FetchGroupEstateCoordinatesPayload`
- `dashboardGroupEstatesKeys` → `dashboardGroupEstateCoordinatesKeys`
- `console.error` message → `'Failed to fetch group estate coordinates:'`
- Keep `keepPreviousData: true` — required for MAP-03 "pins remain during filter refetch" behavior

---

### `frontend/src/store/hooks/queryKeys.tsx` (config, modify existing)

**Analog:** Same file — copy the `dashboardGroupEstatesKeys` object pattern (lines 86-94) for the new key.

**Pattern to copy** (queryKeys.tsx lines 86-94):
```typescript
export const dashboardGroupEstatesKeys = {
    all: ['dashboard', 'groups', 'estates'] as const,

    list: (params: FetchDashboardGroupEstatesPayload) =>
        [
            ...dashboardGroupEstatesKeys.all,
            params
        ] as const,
}
```

**Add to file — imports block (lines 1-11) also needs a new import:**
```typescript
import { FetchGroupEstateCoordinatesPayload } from "@/assets/api/dashboard/groups/fetchGroupEstateCoordinates"
```

**New key object to add after `dashboardGroupEstatesKeys`:**
```typescript
export const dashboardGroupEstateCoordinatesKeys = {
    all: ['dashboard', 'groups', 'estates', 'coordinates'] as const,

    list: (params: FetchGroupEstateCoordinatesPayload) =>
        [
            ...dashboardGroupEstateCoordinatesKeys.all,
            params
        ] as const,
}
```

---

### `frontend/src/containers/dashboard/general/GeneralDashboardContext.tsx` (context, modify existing)

**Analog:** Same file — add one hook call alongside the existing `useFetchGroupEstates` block (lines 48-76) and expose new state in `useMemo`.

**Hook wiring pattern to copy** (lines 48-76):
```typescript
const groupEstatesQuery = useFetchGroupEstates(
    groupSelected,
    {
        groupId: selectedGroup?.id!,
        pagination: { page: listingsPage },
        search: searchTerm,
        showFavoritesOnly,
        cities,
        propertyTypes,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
        // ...all other filters
        sortBy: sortBy || undefined,
    }
)
```

**New hook call to add immediately after** (all filter params must match exactly — critical for MAP-03):
```typescript
const coordinatesQuery = useFetchGroupEstateCoordinates(
    groupSelected,
    groupSelected ? {
        groupId: selectedGroup?.id!,
        search: searchTerm,
        showFavoritesOnly,
        cities,
        propertyTypes,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
        minPricePerSqft: minPricePerSqft || undefined,
        maxPricePerSqft: maxPricePerSqft || undefined,
        maxMaintenanceFee: maxMaintenanceFee || undefined,
        maxDaysListed: maxDaysListed || undefined,
        maxDaysAddedToGroup: maxDaysAddedToGroup || undefined,
        minBedrooms: minBedrooms || undefined,
        minBathrooms: minBathrooms || undefined,
        minSqft: minSqft || undefined,
        maxAgeYears: maxAgeYears || undefined,
        minUserRating: minUserRating || undefined,
        minGroupRating: minGroupRating || undefined,
        hasComments: hasComments || undefined,
        hasSharedDocuments: hasSharedDocuments || undefined,
        pendingReview: pendingReview || undefined,
        showRejected: showRejected || undefined,
        sortBy: sortBy || undefined,
    } : undefined
)
```

**State exposure in `useMemo` return** — copy the pattern of `listingsMeta` (line 160):
```typescript
// In state: {}
mapCoordinates: coordinatesQuery.data?.coordinates ?? [],
isMapLoading: coordinatesQuery.isLoading,
isMapError: coordinatesQuery.isError,
```

**`useMemo` dependency array** (lines 252-294) — add:
```typescript
coordinatesQuery.data,
coordinatesQuery.isLoading,
coordinatesQuery.isError,
```

**Import to add at top of file:**
```typescript
import useFetchGroupEstateCoordinates from '@/store/hooks/Dashboard/groups/useFetchGroupEstateCoordinates'
```

---

### `frontend/src/containers/dashboard/general/GeneralDashboard.tsx` (container, modify existing)

**Analog:** Same file — insertion point is between `<ListingsFilterBar>` and `<ListingsGrid>` (lines 81-133).

**Insertion context** (lines 81-134):
```tsx
<div className="mb-4">
    <ListingsFilterBar
        ...
    />
</div>
{/* ← INSERT GroupMapPanel HERE */}
<ListingsGrid
    listings={state.dashboardData.listings}
    ...
/>
```

**Map section heading pattern** — copy from the sub-header pattern at lines 56-60:
```tsx
<div className="text-sm text-muted-foreground">A curated grid of the most recent properties</div>
```

**Import pattern** (lines 9-16) — copy the component import style:
```typescript
import GroupMapPanel from '@/components/dashboard/general/GroupMapPanel'
```

**JSX insertion:**
```tsx
<div className="mb-4">
    <p className="mb-2 text-sm font-medium text-muted-foreground">Listings on the map</p>
    <GroupMapPanel
        coordinates={state.mapCoordinates}
        isLoading={state.isMapLoading}
        isError={state.isMapError}
    />
</div>
```

---

### `frontend/src/components/dashboard/general/GroupMapPanel.tsx` (component, new file)

**Analogs:**
- Loading state: `DashboardLoading.tsx` (lines 1-11) — `Loader2` spinner pattern
- Empty state: `ListingsGrid.tsx` (lines 22-34) — icon + text in centered container
- Container dimensions: UI-SPEC (h-96, rounded-xl border border-border overflow-hidden)

**Loading state to copy from DashboardLoading.tsx** (lines 1-11):
```tsx
import { Loader2 } from 'lucide-react'

// DashboardLoading uses:
<div className="flex h-full w-full items-center justify-center p-8">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
</div>

// GroupMapPanel loading state adapts to fixed h-96:
<div className="flex h-96 items-center justify-center rounded-xl border border-border">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
</div>
```

**Empty state pattern to copy from ListingsGrid.tsx** (lines 22-34):
```tsx
// ListingsGrid empty state:
<div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Home className="h-7 w-7 text-muted-foreground" />
    </div>
    <div>
        <p className="font-medium">No listings found</p>
        <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
    </div>
</div>

// GroupMapPanel empty state adapts to h-96 fixed container:
<div className="flex h-96 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center">
    <MapPin className="h-8 w-8 text-muted-foreground" />
    <div>
        <p className="font-medium">No listings with location data</p>
        <p className="text-sm text-muted-foreground">
            Location data isn't available for the listings in this group yet.
        </p>
    </div>
</div>
```

**Error state** — same structure as empty state, different copy:
```tsx
<div className="flex h-96 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center">
    <MapPin className="h-8 w-8 text-muted-foreground" />
    <div>
        <p className="font-medium">Couldn't load map</p>
        <p className="text-sm text-muted-foreground">
            Location data failed to load. Try refreshing the page.
        </p>
    </div>
</div>
```

**Component interface pattern** — no existing analog for the Map library usage; follow RESEARCH.md Pattern 4 directly (the library is new to this project). Key architecture notes from research to carry forward:
- `useMap()` only works inside the `<Map>` child tree — `MapContent` must be a child of `<Map>`, not a sibling
- `AdvancedMarker` requires `mapId` prop on parent `<Map>`; without it, markers do not render
- `MarkerClusterer` initialized in `useEffect` that depends on `[map]`; re-synced in `useEffect` that depends on `[markers]`
- `setMarkerRef` callback must use functional state update to avoid stale closure

**Props interface:**
```typescript
interface GroupMapPanelProps {
  coordinates: EstateCoordinate[]
  isLoading: boolean
  isError: boolean
}
```

---

### `frontend/src/components/dashboard/general/GroupMapPinPopup.tsx` (component, new file)

**Analog:** `ListingsGrid.tsx` (lines 44-128) — the card interior shares the same data fields: hero image, price overlay, address, bed/bath/sqft row, navigation link.

**Hero image + price pattern** (ListingsGrid.tsx lines 44-52):
```tsx
<div className="relative h-44 w-full overflow-hidden">
    <img
        src={listing.listingDetail?.images?.[0] ?? listing.listingDetail?.heroImageUrl ?? ''}
        alt={listing.listingDetail?.address || ''}
        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
    />
    <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
        {listing.listingDetail?.listPrice}
    </div>
```

**Popup adapts** (popup is narrower — w-56, shorter image — h-32):
```tsx
<div className="relative h-32 w-full overflow-hidden">
    <img
        src={coordinate.heroImageUrl ?? ''}
        alt={coordinate.address ?? ''}
        className="h-full w-full object-cover"
    />
    <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
        {coordinate.listPrice}
    </div>
</div>
```

**Address + stat row pattern** (ListingsGrid.tsx lines 76-95):
```tsx
<CardContent className="space-y-4 p-5">
    <div>
        <div className="text-base font-semibold">{listing.listingDetail?.address || ''}</div>
    </div>
    <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
            <BedDouble className="h-4 w-4" />
            {listing.listingDetail?.bedrooms} bd
        </div>
        <div className="flex items-center gap-1">
            <Bath className="h-4 w-4" />
            {listing.listingDetail?.fullBathrooms} ba
        </div>
        <div className="flex items-center gap-1">
            <Square className="h-4 w-4" />
            {listing.listingDetail?.sqft} sqft
        </div>
    </div>
```

**Popup adapts** (compact `p-3` per UI-SPEC):
```tsx
<div className="p-3 space-y-2">
    <div className="text-base font-semibold">{coordinate.address}</div>
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5" />
            {coordinate.beds} bd
        </span>
        <span className="flex items-center gap-1">
            <Bath className="h-3.5 w-3.5" />
            {coordinate.baths} ba
        </span>
        <span className="flex items-center gap-1">
            <Square className="h-3.5 w-3.5" />
            {coordinate.sqft} sqft
        </span>
    </div>
    <Link
        to={`/${groupId}/estate/${coordinate.id}`}
        className="text-sm text-foreground hover:text-primary hover:underline"
    >
        View details
    </Link>
</div>
```

**Props interface:**
```typescript
interface GroupMapPinPopupProps {
  coordinate: EstateCoordinate
  groupId: string
  onClose: () => void
}
```

---

### `frontend/src/components/dashboard/general/GroupMapClusterPopup.tsx` (component, new file)

**Analog:** `ListingsGrid.tsx` (lines 97-128) — the footer row pattern with icon + value + action.

**Row pattern to adapt** (ListingsGrid.tsx lines 97-108):
```tsx
<div className="flex items-center justify-between text-xs text-muted-foreground">
    <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">...</span>
    </div>
</div>
```

**Cluster popup row pattern** (per UI-SPEC):
```tsx
// Each row: flex items-center justify-between gap-4 text-sm py-1
<div key={id} className="flex items-center justify-between gap-4 py-1 text-sm">
    <span className="font-semibold">{coord.listPrice}</span>
    <span className="truncate text-muted-foreground">{coord.address}</span>
    <Link to={`/${groupId}/estate/${id}`} aria-label={`View listing at ${coord.address}`}>
        <ArrowRight className="h-4 w-4 text-primary" />
    </Link>
</div>
```

**Header pattern** (per UI-SPEC):
```tsx
<div className="p-3 w-64">
    <p className="mb-2 text-sm font-semibold">{count} listings at this location</p>
    <div className="divide-y divide-border">
        {/* rows */}
    </div>
</div>
```

**Props interface:**
```typescript
interface GroupMapClusterPopupProps {
  estateIds: string[]           // IDs from cluster reverse-lookup
  coordinates: EstateCoordinate[] // full coordinates array for data lookup
  groupId: string
  onClose: () => void
}
```

---

### `frontend/.env.example` (config, modify existing)

**Existing file** (lines 1-9 — all entries are `KEY=placeholder` format):
```
VITE_BE_ENDPOINT=http://127.0.0.1:8080
VITE_SECRET_KEY=your-secret-key
...
```

**Append:**
```
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
VITE_GOOGLE_MAPS_MAP_ID=your-google-maps-map-id
```

---

## Shared Patterns

### Authentication + Tenancy (Backend)
**Source:** `backend/app/controllers/v1/dashboard/group/estates_controller.rb` lines 5-10
**Apply to:** The new `#coordinates` action — inherits automatically, no code needed
```ruby
include CognitoAuth
include BrokerageAuth
include Pagy::Backend

before_action :authenticate_cognito_user!
before_action :set_group
```

### Soft Delete Guard (Backend)
**Source:** `backend/app/controllers/v1/dashboard/group/estates_controller.rb` line 202
**Apply to:** The `#coordinates` action uses `GroupEstatesQuery` which already applies `.without_deleted` on estates. `listing_details` does NOT use `acts_as_paranoid` — no `deleted_at` guard needed there.
```ruby
# set_group already guards:
@group = ::Group.without_deleted
  .where(brokerage_id: Current.brokerage.id)
  .joins(:user_groups)
  .where(user_groups: {user_id: Current.user.id})
  .find_by!(uid: params[:group_id])
```

### Axios / No camelcaseKeys in Hooks (Frontend)
**Source:** CLAUDE.md + `src/assets/api/dashboard/groups/fetchGroupEstates.ts` line 93
**Apply to:** `fetchGroupEstateCoordinates.ts` — the global Axios interceptor already transforms response keys to camelCase
```typescript
return response.data  // ← correct; never call camelcaseKeys(response.data, ...) here
```

### Context Pattern — `{ state, actions }` + `useMemo` (Frontend)
**Source:** `src/containers/dashboard/general/GeneralDashboardContext.tsx` lines 154-295
**Apply to:** `GeneralDashboardContext.tsx` modification — new `mapCoordinates`, `isMapLoading`, `isMapError` fields must be added to the `state` object inside `useMemo`, and their query objects added to the dependency array.

### Loading State — Loader2 Spinner (Frontend)
**Source:** `src/components/dashboard/general/DashboardLoading.tsx` lines 1-11
**Apply to:** `GroupMapPanel.tsx` loading state — use `Loader2 className="h-6 w-6 animate-spin text-muted-foreground"` (smaller than DashboardLoading's `h-8 w-8` to fit the h-96 panel)

### Empty/Error State — Icon + Text (Frontend)
**Source:** `src/components/dashboard/general/ListingsGrid.tsx` lines 22-34
**Apply to:** `GroupMapPanel.tsx` empty and error states — centered icon + heading + body, inside `h-96` fixed-height container with `border border-dashed rounded-xl`

### Stat Row (bed/bath/sqft) (Frontend)
**Source:** `src/components/dashboard/general/ListingsGrid.tsx` lines 83-95
**Apply to:** `GroupMapPinPopup.tsx` stat row — same `BedDouble`, `Bath`, `Square` icons from `lucide-react`, same text pattern; scale icon size to `h-3.5 w-3.5` for popup compactness

### QueryKeys Object Shape (Frontend)
**Source:** `src/store/hooks/queryKeys.tsx` lines 86-94
**Apply to:** New `dashboardGroupEstateCoordinatesKeys` entry — copy the `{ all, list }` shape exactly

---

## No Analog Found

All files have analogs. However, the following file uses a **new library with no prior codebase usage** — the planner must use RESEARCH.md patterns directly for the library-specific wiring:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `GroupMapPanel.tsx` (map library wiring) | component | event-driven | `@vis.gl/react-google-maps` and `@googlemaps/markerclusterer` are not yet installed; no existing component in the codebase uses them. UI states and container structure have analogs; the `APIProvider`/`Map`/`AdvancedMarker`/`MarkerClusterer` wiring comes entirely from RESEARCH.md Patterns 4–7. |

---

## Metadata

**Analog search scope:**
- `frontend/src/containers/dashboard/general/`
- `frontend/src/components/dashboard/general/`
- `frontend/src/assets/api/dashboard/groups/`
- `frontend/src/store/hooks/Dashboard/groups/`
- `frontend/src/store/hooks/queryKeys.tsx`
- `frontend/src/assets/types/`
- `backend/app/controllers/v1/dashboard/group/`
- `backend/config/routes.rb`

**Files read:** 14 source files + RESEARCH.md + UI-SPEC.md + ROADMAP.md
**Pattern extraction date:** 2026-05-17
