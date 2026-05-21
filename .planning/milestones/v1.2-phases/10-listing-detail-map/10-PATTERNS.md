# Phase 10: Listing Detail Map — Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 2 (1 new, 1 modified)
**Analogs found:** 2 / 2

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/components/dashboard/estate/EstateLocationMap.tsx` | component | request-response (read-only display) | `frontend/src/components/dashboard/general/GroupMapPanel.tsx` | exact (same library, same token pattern, same map style) |
| `frontend/src/containers/dashboard/estate/EstateDashboard.tsx` | container | request-response | self (existing file, modification only) | exact |

---

## Pattern Assignments

### `frontend/src/components/dashboard/estate/EstateLocationMap.tsx` (component, read-only display)

**Analog:** `frontend/src/components/dashboard/general/GroupMapPanel.tsx`

**Imports pattern** (lines 1-10 of GroupMapPanel.tsx):
```tsx
import { useCallback, useMemo, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import MapGL, { Marker, NavigationControl } from 'react-map-gl/mapbox'
import type { MapRef, ViewState } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
```
For `EstateLocationMap`, `useMemo` and `useSupercluster` are not needed. Use only: `useCallback`, `useRef`, `useState`.

**Token guard pattern** (lines 125-131 of GroupMapPanel.tsx):
```tsx
const token = import.meta.env.VITE_MAPBOX_TOKEN || ''

if (!token) {
    return (
        <div className="flex h-64 w-full items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
            Map token not configured
        </div>
    )
}
```
Note: GroupMapPanel uses a `PanelShell` helper. `EstateLocationMap` uses an inline div at `h-64` (not `h-96`).

**ViewState initialization pattern** (lines 48-55 of GroupMapPanel.tsx):
```tsx
const [viewState, setViewState] = useState<ViewState>({
    longitude: MAP_DEFAULT_CENTER.longitude,
    latitude: MAP_DEFAULT_CENTER.latitude,
    zoom: MAP_DEFAULT_ZOOM,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
})
```
For `EstateLocationMap`, initialize directly from props: `longitude` and `latitude` from props, `zoom: 14`. No `MAP_DEFAULT_CENTER` constant needed — the listing's own coordinates are the center.

**handleMove callback pattern** (lines 86-92 of GroupMapPanel.tsx):
```tsx
const handleMove = useCallback(
    (evt: { viewState: ViewState }) => {
        setViewState(evt.viewState)
        syncBounds()
    },
    [syncBounds]
)
```
For `EstateLocationMap`, `syncBounds` is not needed (no clustering). Simplify to:
```tsx
const handleMove = useCallback(
    (evt: { viewState: ViewState }) => setViewState(evt.viewState),
    []
)
```

**Core MapGL + Marker pattern** (lines 169-257 of GroupMapPanel.tsx):
```tsx
<div className="h-96 w-full overflow-hidden rounded-xl border border-border">
    <MapGL
        ref={mapRef}
        mapboxAccessToken={token}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        {...viewState}
        onMove={handleMove}
        style={{ width: '100%', height: '100%' }}
        cooperativeGestures
    >
        <NavigationControl position="top-right" />

        <Marker longitude={lng} latitude={lat}>
            <MapPin className="h-6 w-6 fill-primary text-primary" />
        </Marker>
    </MapGL>
</div>
```
For `EstateLocationMap`:
- Change `h-96` to `h-64` (256px — supplemental panel, not the primary page focus)
- Remove `onLoad`, `useSupercluster`, `clusters.map`, `Popup` — single pin only
- Change `MapPin` size to `h-7 w-7` and add `drop-shadow-sm` per UI-SPEC
- Add `aria-label` to `MapPin`: `address ? \`Property at ${address}\` : 'Property location'`
- Wrap map in `<div className="space-y-2">` with a label above the border container

**Section label pattern** (per UI-SPEC.md):
```tsx
<div className="space-y-2">
    <p className="text-sm font-medium text-muted-foreground">Property location</p>
    <div className="h-64 w-full overflow-hidden rounded-xl border border-border">
        <MapGL ... />
    </div>
</div>
```
Label style `text-sm font-medium text-muted-foreground` mirrors `EstateSummaryCard.tsx`'s sub-header pattern.

**Props interface pattern** (mirrors GroupMapPanel's explicit interface at lines 17-21):
```tsx
interface EstateLocationMapProps {
    latitude: number
    longitude: number
    address?: string | null
}
```
Do NOT accept the whole `estate` object — keep props minimal and typed.

---

### `frontend/src/containers/dashboard/estate/EstateDashboard.tsx` (container, modification)

**Analog:** `self` — modification of existing file.

**Existing import block to extend** (lines 1-14 of EstateDashboard.tsx):
```tsx
import useEstateDashboardContext from './EstateDashboardContext'
import EstateHeroGallery from '@/components/dashboard/estate/EstateHeroGallery'
import EstateActionsBar from '@/components/dashboard/estate/EstateActionsBar'
import EstateSummaryCard from '@/components/dashboard/estate/EstateSummaryCard'
import EstateSectionTabs from '@/components/dashboard/estate/EstateSectionTabs'
// ... more imports
```
Add one import below the existing estate component imports:
```tsx
import EstateLocationMap from '@/components/dashboard/estate/EstateLocationMap'
```

**Insertion point** (lines 109-110 of EstateDashboard.tsx):
```tsx
<EstateSummaryCard estate={state.estate} />
<EstateSectionTabs        // ← insert EstateLocationMap between these two
```

**Coordinate guard pattern** — derived from GroupMapPanel.tsx line 155 empty-state check and confirmed in RESEARCH.md:
```tsx
{state.estate.listingDetail?.latitude != null &&
 state.estate.listingDetail?.longitude != null && (
    <EstateLocationMap
        latitude={state.estate.listingDetail.latitude}
        longitude={state.estate.listingDetail.longitude}
        address={state.estate.listingDetail.address}
    />
)}
```
Critical: use `!= null` (not `!` or `!== null`) — handles both `null` and `undefined` while accepting `0.0` as a valid equatorial coordinate. The type for `latitude`/`longitude` is `number | null` (confirmed in `estateListingDetailsType.ts` lines 39-40).

**Type confirmation** (`frontend/src/assets/types/estateListingDetailsType.ts` lines 39-41):
```typescript
latitude: number | null     // line 39
longitude: number | null    // line 40
geocodingFailed: boolean | null  // line 41
```
No type changes needed — `latitude` and `longitude` are already typed. After the `!= null` guard, TypeScript narrows both to `number`, so the props passed to `EstateLocationMap` satisfy `latitude: number` and `longitude: number` without casting.

---

## Shared Patterns

### Token Environment Variable
**Source:** `frontend/src/components/dashboard/general/GroupMapPanel.tsx` line 43
**Apply to:** `EstateLocationMap.tsx`
```tsx
const token = import.meta.env.VITE_MAPBOX_TOKEN || ''
```
Use `|| ''` (not `?? ''`) — consistent with GroupMapPanel. Pass to `mapboxAccessToken={token}`.

### CSS Import (Mapbox tiles)
**Source:** `frontend/src/components/dashboard/general/GroupMapPanel.tsx` line 7
**Apply to:** `EstateLocationMap.tsx`
```tsx
import 'mapbox-gl/dist/mapbox-gl.css'
```
Must be a top-level module import, not inside a conditional. Vite deduplicates — importing in both components has no performance cost.

### Tailwind Container + Border Radius
**Source:** `frontend/src/components/dashboard/general/GroupMapPanel.tsx` line 170
**Apply to:** `EstateLocationMap.tsx`
```tsx
// GroupMapPanel uses h-96; EstateLocationMap uses h-64
<div className="h-64 w-full overflow-hidden rounded-xl border border-border">
```

### cooperativeGestures
**Source:** `frontend/src/components/dashboard/general/GroupMapPanel.tsx` line 179
**Apply to:** `EstateLocationMap.tsx`
```tsx
<MapGL ... cooperativeGestures>
```
Prevents scroll-wheel page hijacking. Required on all Mapbox maps in this project.

### MapPin Icon Style
**Source:** `frontend/src/components/dashboard/general/GroupMapPanel.tsx` line 223
**Apply to:** `EstateLocationMap.tsx`
```tsx
// GroupMapPanel (non-selected pin):
<MapPin className="h-6 w-6 fill-primary text-primary" />

// EstateLocationMap (single listing pin, slightly larger + shadow per UI-SPEC):
<MapPin className="h-7 w-7 fill-primary text-primary drop-shadow-sm" />
```

### lucide-react Only
**Source:** `CLAUDE.md`
**Apply to:** All new component files
No other icon library. `MapPin` is from `lucide-react`.

---

## No Analog Found

None. Both files have strong analogs in the codebase.

---

## Metadata

**Analog search scope:** `frontend/src/components/dashboard/`, `frontend/src/containers/dashboard/estate/`, `frontend/src/assets/types/`
**Files scanned:** 4 (GroupMapPanel.tsx, EstateDashboard.tsx, EstateDashboardContext.tsx, estateListingDetailsType.ts)
**Pattern extraction date:** 2026-05-18
