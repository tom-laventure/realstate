---
phase: 09-group-dashboard-map
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - backend/app/controllers/v1/dashboard/group/estates_controller.rb
  - backend/config/routes.rb
  - backend/test/integration/group_estate_coordinates_test.rb
  - frontend/.env.example
  - frontend/package.json
  - frontend/src/assets/api/dashboard/groups/fetchGroupEstateCoordinates.ts
  - frontend/src/assets/types/estateCoordinateType.ts
  - frontend/src/assets/types/estateListingDetailsType.ts
  - frontend/src/containers/dashboard/general/GeneralDashboardContext.tsx
  - frontend/src/store/hooks/Dashboard/groups/useFetchGroupEstateCoordinates.ts
  - frontend/src/store/hooks/queryKeys.tsx
  - frontend/src/components/dashboard/general/GroupMapPinPopup.tsx
  - frontend/src/components/dashboard/general/GroupMapClusterPopup.tsx
  - frontend/src/components/dashboard/general/GroupMapPanel.tsx
  - frontend/src/containers/dashboard/general/GeneralDashboard.tsx
findings:
  critical: 2
  warning: 4
  info: 1
  total: 7
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-05-17
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 9 adds a Mapbox GL map panel to the group dashboard with coordinate fetching, clustering, pin popups, and cluster popups. The overall structure is sound — the new endpoint, hook, query key, and components follow established project patterns. Two blockers were found: a violation of the project-wide `.without_deleted` rule on `EstateComment` and `EstateDocument` queries (pre-existing but exposed by the cross-file review), and an unrescued `JSON::ParserError` in the new coordinates action that can crash a request in production. Four warnings were also found covering a defensive coding gap in the hook, a map state bug across group switches, an API convention violation, and a debug `console.error` left in production code.

Cross-referencing `GroupEstatesQuery` confirmed it correctly accepts `current_user` and uses it (for rejection, favorites, ratings filters), so the CLAUDE.md rule about unused parameters does not apply here.

---

## Critical Issues

### CR-01: `EstateComment` and `EstateDocument` queries missing `.without_deleted`

**File:** `backend/app/controllers/v1/dashboard/group/estates_controller.rb:18-19` and `:79-85`

**Issue:** Both `EstateComment` and `EstateDocument` use `acts_as_paranoid`. Every query against these models must use `.without_deleted` per the project rule. The `show` action (lines 18-19) and the `index` action (lines 79-85) query these models without that guard. As a result, soft-deleted comments and documents are counted as live data, inflating `comment_count` and `document_count` in the API response. When soft-deleted records are later hard-deleted this count will silently drop, making counts inconsistent over time.

**Fix:**
```ruby
# show action (line 18-19)
comment_count  = EstateComment.without_deleted.where(group_estate_id: ge_id).count
document_count = EstateDocument.without_deleted.where(group_estate_id: ge_id).count

# index action (lines 79-85)
comment_counts = if ge_ids.any?
  EstateComment.without_deleted.where(group_estate_id: ge_ids).group(:group_estate_id).count
else
  {}
end

document_counts = if ge_ids.any?
  EstateDocument.without_deleted.where(group_estate_id: ge_ids).group(:group_estate_id).count
else
  {}
end
```

---

### CR-02: Unrescued `JSON::ParserError` in coordinates action crashes the request

**File:** `backend/app/controllers/v1/dashboard/group/estates_controller.rb:200`

**Issue:** The coordinates action calls `JSON.parse(images)` when the `images` attribute comes back as a raw string from the `.select()` call (which bypasses the `:json` attribute cast defined on `ListingDetail`). If the stored value is invalid JSON (empty string, malformed data, or a legacy value), `JSON.parse` raises `JSON::ParserError` which is not rescued, causing the entire `/coordinates` request to return a 500. One bad record in the group's listings silently breaks the map for all users of that group.

**Fix:**
```ruby
images = e.images
images = begin
  JSON.parse(images)
rescue JSON::ParserError
  nil
end if images.is_a?(String)
first_image = images.is_a?(Array) ? images.first : nil
```

---

## Warnings

### WR-01: Hook fires queryFn with `undefined` payload when `enabled=true` and `props=undefined`

**File:** `frontend/src/store/hooks/Dashboard/groups/useFetchGroupEstateCoordinates.ts:9`

**Issue:** The hook accepts `props` as optional and uses `props as FetchGroupEstateCoordinatesPayload` (a non-null type assertion) in the `queryFn`. If `enabled=true` but `props` is `undefined`, TanStack Query will execute the queryFn and `fetchGroupEstateCoordinates(undefined as ...)` will immediately throw when it destructures the undefined argument. The call site in `GeneralDashboardContext` passes `enabled=groupSelected` but `props=undefined` when `selectedGroup` is null — these two guards are different expressions (lines 79-104), leaving a narrow but real window where `enabled=true && props=undefined`.

**Fix:** Tighten the `enabled` guard to match exactly when `props` is defined:
```typescript
const useFetchGroupEstateCoordinates = (enabled: boolean, props?: FetchGroupEstateCoordinatesPayload) => {
    const { isLoading, data, isError, error, refetch } = useQuery({
        queryKey: props ? dashboardGroupEstateCoordinatesKeys.list(props) : dashboardGroupEstateCoordinatesKeys.all,
        queryFn: async () => {
            if (!props) throw new Error('props required')
            return fetchGroupEstateCoordinates(props)
        },
        retry: false,
        enabled: enabled && !!props,  // guard must match props availability
        // ...
    })
    // ...
}
```

---

### WR-02: `hasFitBoundsRef` never resets on group switch — map does not re-fit to new group's listings

**File:** `frontend/src/components/dashboard/general/GroupMapPanel.tsx:46,96-104`

**Issue:** `hasFitBoundsRef.current` is set to `true` in `handleLoad` and is never reset. When the user navigates from one group to another (e.g. `/groupA` to `/groupB`), React Router reuses the same `GeneralDashboard` component instance (same route shape, no `key` prop), so `GroupMapPanel` does not unmount. The ref therefore stays `true` forever after the first load, and subsequent group switches will never trigger `map.fitBounds(...)`. The map silently shows the previous group's viewport for every group viewed after the first.

**Fix:** Pass `groupId` as a prop to `GroupMapPanel` and reset the ref when it changes via `useEffect`, or add a `key` prop at the call site:

```tsx
// GeneralDashboard.tsx — force remount on group change
<GroupMapPanel
    key={state.selectedGroup?.id}
    coordinates={state.mapCoordinates}
    isLoading={state.isMapLoading}
    isError={state.isMapError}
/>
```

This is the simplest fix and guarantees the map state (viewport, open popups, ref) is fully reset on every group switch.

---

### WR-03: Coordinates action renders camelCase keys directly, violating API convention

**File:** `backend/app/controllers/v1/dashboard/group/estates_controller.rb:203-213`

**Issue:** The `coordinates` action manually renders `listPrice:`, `heroImageUrl:` etc. as camelCase keys in the JSON response. The project convention (CLAUDE.md) is for the backend to render snake_case keys and for the frontend's global Axios interceptor (`camelcaseKeys`) to convert them. The other endpoints in this controller follow the convention via AMS serializers. This one-off breaks the contract: if the interceptor is ever changed or conditionally applied, the frontend type expectations break silently. Additionally, the integration test asserts `"listPrice"` and `"heroImageUrl"` against the raw response, cementing the non-standard behavior in tests.

**Fix:** Render snake_case keys in the action and rely on the interceptor:
```ruby
{
  id: e.id.to_s,
  latitude: e.latitude,
  longitude: e.longitude,
  list_price: e.list_price,
  address: e.address,
  beds: e.bedrooms,
  baths: e.full_bathrooms,
  sqft: e.sqft,
  hero_image_url: e.hero_image_url.presence || first_image
}
```
Update the test assertions to use snake_case keys to match (`"list_price"`, `"hero_image_url"`).

---

### WR-04: `console.error` left in production hook

**File:** `frontend/src/store/hooks/Dashboard/groups/useFetchGroupEstateCoordinates.ts:13`

**Issue:** A `console.error` call is included in the `onError` callback. This leaks internal error details (Axios error objects including request config, headers, and response data) to the browser console in production. It is also inconsistent with other hooks in the codebase that do not log errors to console.

**Fix:** Remove the `console.error` call. Error state is already surfaced via `isError` and `error` return values; `GroupMapPanel` handles the error state UI correctly.
```typescript
onError: (_err: AxiosErrorType) => {
    // error state exposed via isError/error return values
},
```

---

## Info

### IN-01: `dashboardGroupEstateCoordinatesKeys.all` is a prefix of `dashboardGroupEstatesKeys.all`

**File:** `frontend/src/store/hooks/queryKeys.tsx:88-104`

**Issue:** `dashboardGroupEstatesKeys.all` is `['dashboard', 'groups', 'estates']` and `dashboardGroupEstateCoordinatesKeys.all` is `['dashboard', 'groups', 'estates', 'coordinates']`. TanStack Query v4 uses prefix-based matching for `invalidateQueries`, so invalidating `dashboardGroupEstatesKeys.all` (done by `useToggleFavorite`, `useToggleRejection`, and `useRateEstate`) will also invalidate all coordinate queries. This is currently harmless and arguably correct (coordinates respect the same filters as estates), but the nesting is implicit and not obvious. Future maintainers adding selective invalidation may not realize coordinates refetch on every mutation.

**Fix:** No immediate action required, but add a comment to make the intent explicit:
```typescript
// NOTE: coordinatesKeys is nested under estatesKeys intentionally.
// Invalidating estatesKeys.all (on toggle-favorite, toggle-rejection, rate)
// also refetches coordinates, which is correct because coordinates respect
// the same filters (favorites-only, rejected, etc.).
export const dashboardGroupEstateCoordinatesKeys = {
    all: ['dashboard', 'groups', 'estates', 'coordinates'] as const,
    // ...
}
```

---

_Reviewed: 2026-05-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
