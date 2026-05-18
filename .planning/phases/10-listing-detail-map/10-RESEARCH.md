# Phase 10: Listing Detail Map — Research

**Researched:** 2026-05-17
**Domain:** Mapbox GL JS embedded map on estate detail page (reuse Phase 9 stack)
**Confidence:** HIGH

---

## Summary

Phase 10 is a narrowly scoped UI addition: embed a static location map on the individual listing detail page. The map shows a single pin at the property's coordinates. When coordinates are absent, the map section is hidden (not a broken component).

The critical finding from codebase inspection: **all required data is already in flight**. The `useFetchEstate` hook (already wired in `EstateDashboardContext`) fetches the estate's `listingDetail`, which includes `latitude`, `longitude`, and `geocodingFailed` — delivered by `ListingDetailSerializer` since Phase 8. No backend changes are needed.

The required map library (`react-map-gl` + `mapbox-gl` + `use-supercluster`) was installed in Phase 9 and is already in the frontend bundle. The `VITE_MAPBOX_TOKEN` env var is already set (confirmed in `.env`). The `mapbox-gl/dist/mapbox-gl.css` import pattern is established in `GroupMapPanel.tsx`. Phase 10 is purely frontend: one new presentational component (`EstateLocationMap.tsx`) inserted into `EstateDashboard.tsx`.

**Primary recommendation:** Create `EstateLocationMap.tsx` — a single-pin Mapbox map component — and render it in `EstateDashboard.tsx` before the `EstateSectionTabs`, conditioned on `state.estate.listingDetail?.latitude != null`.

---

## Project Constraints (from CLAUDE.md)

### Required Patterns
- Icons: `lucide-react` only
- Styling: Tailwind CSS utility classes only
- Never call axios or API functions directly inside a component — always go through a hook
- Define domain interfaces in `assets/types/` before creating hooks or contexts
- Context pattern: returns `{ state, actions }` memoized with `useMemo`
- Data flow: `Component → Context → TanStack Hook → API module → Axios instance`
- Axios interceptor already applies `camelcaseKeys(response.data, { deep: true })` — never call `camelcaseKeys` in hooks
- `lucide-react` for all icons

### Frontend Quality Standard
- Design quality is non-negotiable — polished, intentional UI
- Loading states, empty states, error states all required
- Accessibility baseline: semantic HTML, visible focus rings
- No new map section when listing has no coordinates (requirement: "absent, not broken")

### No New Backend Work
The estate `show` endpoint already returns `latitude` and `longitude` via `ListingDetailSerializer`. Adding a backend endpoint would be overengineering. [VERIFIED: serializer + type inspection]

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Coordinate data | Database / Storage | API / Backend (Serializer) | `listing_details.latitude/longitude` from Phase 8; `ListingDetailSerializer` already exposes them |
| Coordinate delivery to detail page | API / Backend (Controller) | — | `GET /v1/dashboard/groups/:id/estates/:id` (show action) — already returns coordinates via serializer |
| Map rendering | Browser / Client | — | Mapbox GL JS runs in browser; `react-map-gl` wraps it |
| Coordinate-present guard | Browser / Client (Component) | — | `EstateLocationMap` checks `latitude != null` before rendering map; `EstateDashboard` checks before rendering the component |
| Pin rendering | Browser / Client (Component) | — | Single `<Marker>` at listing coordinates — no clustering needed |

---

## Standard Stack

### Core (All Already Installed — Phase 9)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| react-map-gl | ^8.1.1 | `MapGL`, `Marker`, `NavigationControl` React wrappers for Mapbox GL | Installed [VERIFIED: package.json] |
| mapbox-gl | ^3.23.1 | Mapbox GL JS rendering engine | Installed [VERIFIED: package.json] |

**No new npm installs required.** The Phase 9 map stack is complete.

### Not Needed for This Phase

| Library | Reason Not Needed |
|---------|-------------------|
| use-supercluster | Single-pin map — no clustering required |
| @vis.gl/react-google-maps | Phase 9 used Mapbox, not Google Maps. Stay consistent. |
| @googlemaps/markerclusterer | Same — not in this project's stack |

**Version verification:** [VERIFIED: /home/tomlaventure/projects/realstate/frontend/package.json — 2026-05-17]

---

## Architecture Patterns

### System Architecture Diagram

```
EstateDashboard renders (after estate loaded)
    |
    v
state.estate.listingDetail?.latitude != null?
    |-- NO:  render nothing (section absent, not broken)
    |-- YES: render <EstateLocationMap lat={...} lng={...} address={...} />
                  |
                  v
             MapGL (react-map-gl/mapbox entry point)
             mapboxAccessToken = VITE_MAPBOX_TOKEN
             defaultCenter = { lng, lat }
             defaultZoom = 14
                  |
                  v
             <Marker longitude={lng} latitude={lat}>
               <MapPin className="fill-primary text-primary" />
             </Marker>
             <NavigationControl position="top-right" />
```

**Key:** No new hooks, no new API calls, no new query keys. `EstateDashboardContext` already provides the data.

### Recommended Project Structure (new files only)

```
frontend/src/
└── components/
    └── dashboard/
        └── estate/
            └── EstateLocationMap.tsx    # new — single-pin map component
```

Modification: `EstateDashboard.tsx` — insert `<EstateLocationMap>` after `<EstateSummaryCard>` and before `<EstateSectionTabs>`.

### Pattern 1: EstateLocationMap Component

**What:** A self-contained Mapbox map showing one pin at the listing's coordinates.

**When to use:** Rendered in `EstateDashboard` only when `listingDetail.latitude != null && listingDetail.longitude != null`.

**Props:** Receive `latitude`, `longitude`, and optionally `address` (for `aria-label`). Do NOT accept the whole `estate` object — keep props minimal and explicit.

```tsx
// File: frontend/src/components/dashboard/estate/EstateLocationMap.tsx
// Pattern: mirrors GroupMapPanel.tsx (Phase 9) — same library, simpler usage
import { useRef, useState, useCallback } from 'react'
import MapGL, { Marker, NavigationControl } from 'react-map-gl/mapbox'
import type { MapRef, ViewState } from 'react-map-gl/mapbox'
import { MapPin } from 'lucide-react'
import 'mapbox-gl/dist/mapbox-gl.css'

interface EstateLocationMapProps {
    latitude: number
    longitude: number
    address?: string | null
}

const EstateLocationMap = ({ latitude, longitude, address }: EstateLocationMapProps) => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN || ''
    const mapRef = useRef<MapRef>(null)

    const [viewState, setViewState] = useState<ViewState>({
        longitude,
        latitude,
        zoom: 14,
        bearing: 0,
        pitch: 0,
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
    })

    const handleMove = useCallback(
        (evt: { viewState: ViewState }) => setViewState(evt.viewState),
        []
    )

    if (!token) {
        return (
            <div className="flex h-64 w-full items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                Map token not configured
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Property location</p>
            <div className="h-64 w-full overflow-hidden rounded-xl border border-border">
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
                    <Marker longitude={longitude} latitude={latitude}>
                        <MapPin
                            className="h-7 w-7 fill-primary text-primary drop-shadow-sm"
                            aria-label={address ? `Property at ${address}` : 'Property location'}
                        />
                    </Marker>
                </MapGL>
            </div>
        </div>
    )
}

export default EstateLocationMap
```

**Key decisions:**
- `mapStyle="mapbox://styles/mapbox/streets-v12"` — same style as `GroupMapPanel` [VERIFIED: GroupMapPanel.tsx line 171]
- `cooperativeGestures` — prevents scroll-wheel hijacking, established pattern [VERIFIED: Phase 9 decision]
- `h-64` (256px) — shorter than the group map (`h-96`), appropriate for a secondary panel below the main content
- `import 'mapbox-gl/dist/mapbox-gl.css'` — CSS must be imported once per file that renders a map [VERIFIED: GroupMapPanel.tsx line 7]
- No `fitBounds` logic — single pin, defaultCenter is the listing's coordinates

### Pattern 2: EstateDashboard Integration

**Where to insert:** After `<EstateSummaryCard>` and before `<EstateSectionTabs>`. The map is a supplemental detail about the property — belongs in the "about this property" zone, not inside a tab (tabs are for user activity: comments, dates, docs).

```tsx
// In EstateDashboard.tsx — add after EstateSummaryCard, before EstateSectionTabs:
import EstateLocationMap from '@/components/dashboard/estate/EstateLocationMap'

// Inside return JSX:
<EstateSummaryCard estate={state.estate} />

{state.estate.listingDetail?.latitude != null &&
 state.estate.listingDetail?.longitude != null && (
    <EstateLocationMap
        latitude={state.estate.listingDetail.latitude}
        longitude={state.estate.listingDetail.longitude}
        address={state.estate.listingDetail.address}
    />
)}

<EstateSectionTabs ... />
```

**Guard logic:** `!= null` (not `!== null`) handles both `null` and `undefined` in one check. This is intentional — `geocodingFailed: true` listings have `null` coordinates, and Phase 9 established that null coordinates mean "no map". [VERIFIED: EstateListingDetails type + GroupMapPanel empty state logic]

### Anti-Patterns to Avoid

- **Rendering an empty/broken `<MapGL>` when coordinates are null:** The requirement explicitly states "absent, not broken". Never render a `<MapGL>` with `NaN` or `0,0` coordinates.
- **Importing `mapbox-gl/dist/mapbox-gl.css` conditionally:** CSS must be imported at module level, not inside an `if` block. The import in `GroupMapPanel.tsx` already covers the CSS if both components are in the same bundle — but importing it again in `EstateLocationMap.tsx` is safe (CSS imports are idempotent in Vite).
- **Adding a new hook/API call just for coordinates:** `useFetchEstate` already fetches `listingDetail.latitude`. No new data fetching is needed.
- **Putting the map inside a tab:** The map is property metadata, not user activity. It belongs at the top level of `EstateDashboard`, not behind a "Details" tab click.
- **Using `@vis.gl/react-google-maps` or Google Maps:** Phase 9 conclusively chose Mapbox. Do not mix map providers.
- **Clustering:** Single listing — no clustering needed. `use-supercluster` should NOT be imported in this component.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Map tile rendering | Direct Mapbox GL JS script tag | `react-map-gl/mapbox` — already installed | React lifecycle integration, `ref` API, controlled `ViewState` |
| CSS injection for Mapbox | Manual `<link>` in HTML | `import 'mapbox-gl/dist/mapbox-gl.css'` in component | Established pattern from GroupMapPanel; Vite handles it |
| Coordinate-present guard | Complex state machine | Inline `!= null` check before rendering | Coordinates are either present (decimal) or null — binary case |

**Key insight:** Phase 10 is a reuse phase. The hard work (library selection, token setup, clustering, popup patterns) was done in Phase 9. This phase uses 2-3 imports and a 60-line component.

---

## Common Pitfalls

### Pitfall 1: Map CSS Not Imported (Blank Map Renders)

**What goes wrong:** The map container renders (border, height) but the map tiles do not appear — the canvas is blank.
**Why it happens:** `mapbox-gl` requires its CSS (`mapbox-gl/dist/mapbox-gl.css`) to be loaded. If `GroupMapPanel` is not mounted on the same page (listing detail never mounts the group map), the CSS may not be loaded.
**How to avoid:** Import `'mapbox-gl/dist/mapbox-gl.css'` at the top of `EstateLocationMap.tsx`. Vite deduplicates CSS imports — no performance cost.
**Warning signs:** Map container visible with correct dimensions, no tiles, no error in console about the token.

### Pitfall 2: ViewState Initialized with Wrong Coordinate Order

**What goes wrong:** Map renders but the pin is in the ocean or wrong location.
**Why it happens:** Mapbox uses `longitude` (east/west) then `latitude` (north/south). Swapping them places the pin at a reflected geographic coordinate.
**How to avoid:** Always name variables explicitly (`longitude`, `latitude`) — never use positional arrays for coordinates in React components. Verify with Vancouver listing: lat ~49.28, lng ~-123.12.
**Warning signs:** Pin appears on the opposite side of the world, or map centers on wrong location.

### Pitfall 3: Map Renders When geocodingFailed is True

**What goes wrong:** A listing with `geocodingFailed: true` has `latitude: null` — but if the null check is absent or wrong, the map tries to render with `NaN` coordinates.
**Why it happens:** Developer checks only `!!latitude` (falsy check), which fails for `0.0` lat — a valid coordinate on the equator.
**How to avoid:** Use `!= null` (not falsiness) for the coordinate guard. `latitude != null` correctly handles `0.0` as a valid coordinate while rejecting `null` and `undefined`.
**Warning signs:** Map renders but shows a pin at `[0, 0]` (Gulf of Guinea).

### Pitfall 4: Map Renders Inside EstateSectionTabs Causing Tab Flash

**What goes wrong:** If the map is placed inside the 'details' tab content, switching to a different tab and back re-mounts the map, causing a flash and re-initialization of the Mapbox GL context.
**Why it happens:** Tab switching in `EstateDashboard` conditionally unmounts/mounts tab content.
**How to avoid:** Place `<EstateLocationMap>` before `<EstateSectionTabs>` — always visible when coordinates exist, not tab-conditional.
**Warning signs:** Map flashes or re-loads tiles when switching back to the Details tab.

### Pitfall 5: Token Undefined at Build Time

**What goes wrong:** `import.meta.env.VITE_MAPBOX_TOKEN` is `undefined` in production because the env var was not set in the build environment.
**Why it happens:** The token is only in `.env` (gitignored), not in the CI/CD environment.
**How to avoid:** The component already handles missing token gracefully (renders a "not configured" placeholder). This is correct behavior. No additional guard needed beyond what `GroupMapPanel` already established. [VERIFIED: GroupMapPanel.tsx lines 125-131]
**Warning signs:** In production, map section shows "Map token not configured" instead of a map.

---

## Code Examples

### Verified: react-map-gl/mapbox single-marker pattern

```tsx
// Source: GroupMapPanel.tsx (Phase 9) — established project pattern [VERIFIED]
import MapGL, { Marker, NavigationControl } from 'react-map-gl/mapbox'
import type { MapRef, ViewState } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

// Single marker — no clustering, no popup, no bounds fitting needed
<MapGL
    ref={mapRef}
    mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN || ''}
    mapStyle="mapbox://styles/mapbox/streets-v12"
    {...viewState}
    onMove={evt => setViewState(evt.viewState)}
    style={{ width: '100%', height: '100%' }}
    cooperativeGestures
>
    <NavigationControl position="top-right" />
    <Marker longitude={longitude} latitude={latitude}>
        <MapPin className="h-7 w-7 fill-primary text-primary" />
    </Marker>
</MapGL>
```

### Verified: Coordinate null guard

```tsx
// Pattern: mirrors Phase 9 GroupMapPanel empty state check [VERIFIED: GroupMapPanel.tsx line 155]
// Use != null (not !) to correctly accept 0.0 as a valid coordinate
{estate.listingDetail?.latitude != null &&
 estate.listingDetail?.longitude != null && (
    <EstateLocationMap
        latitude={estate.listingDetail.latitude}
        longitude={estate.listingDetail.longitude}
        address={estate.listingDetail.address}
    />
)}
```

### Verified: EstateListingDetails type (already has lat/lng)

```typescript
// Source: frontend/src/assets/types/estateListingDetailsType.ts [VERIFIED — fields present]
latitude: number | null   // line 39
longitude: number | null  // line 40
geocodingFailed: boolean | null  // line 41
```

No type changes needed — Phase 8 + 9 already updated this type.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Google Maps (Phase 9 original research) | Mapbox GL JS via react-map-gl | Phase 9 execution (2026-05-17) | Phase 10 uses Mapbox, not Google Maps — original research was superseded by Phase 9 execution |
| @vis.gl/react-google-maps (Phase 9 research recommendation) | react-map-gl@8.1.1 + mapbox-gl@3.23.1 + use-supercluster | Phase 9 execution | All map work in this project now uses Mapbox |

**Phase 9 execution note:** The Phase 9 RESEARCH.md recommended `@vis.gl/react-google-maps` (Google Maps). During execution (Phase 09-03), the project switched to Mapbox (`react-map-gl` + `mapbox-gl` + `use-supercluster`). Phase 10 must use the same Mapbox stack. [VERIFIED: package.json, GroupMapPanel.tsx, 09-04-SUMMARY.md]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `mapbox-gl/dist/mapbox-gl.css` imported in `EstateLocationMap.tsx` does not conflict with the same import in `GroupMapPanel.tsx` if both are mounted simultaneously | Pitfall 1 | Vite deduplicates CSS imports — low risk. If they conflict, tiles will still render; only a minor CSS specificity issue. |
| A2 | `VITE_MAPBOX_TOKEN` set in `.env` is a valid public token for the `streets-v12` style | Environment Availability | If the token is expired or scoped incorrectly, the map renders blank. The token value is present (verified) but scope not checked. |
| A3 | The map belongs before `EstateSectionTabs` (not inside a tab) — UX judgment | Architecture | If the user prefers the map inside the "Details" tab, a one-line move is all that's needed. Low risk. |

**If this table is empty:** All claims in this research were verified or cited.

---

## Open Questions

1. **Map height on the listing detail page**
   - What we know: The group map uses `h-96` (384px). A per-listing map needs less height — `h-64` (256px) proposed.
   - What's unclear: User preference for map height on this page.
   - Recommendation: Default to `h-64`. Trivial to adjust post-implementation.

2. **Map section heading copy**
   - What we know: The group dashboard uses `"Listings on the map"`. For a single listing, options are: `"Property location"`, `"Location"`, `"Map"`.
   - Recommendation: `"Property location"` — specific, human, consistent with real estate conventions.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| react-map-gl | Map rendering | Yes | ^8.1.1 | — |
| mapbox-gl | Map rendering | Yes | ^3.23.1 | — |
| VITE_MAPBOX_TOKEN | APIProvider | Yes (.env) | set | Component renders "token not configured" placeholder |
| Node.js | npm (if install needed) | Yes | v22.9.0 | — |

**Missing dependencies with no fallback:** None. All required libraries are installed from Phase 9.

**Missing dependencies with fallback:** None.

---

## Security Domain

Phase 10 introduces no new security surface beyond what Phase 9 already established. The listing detail endpoint is protected by `authenticate_cognito_user!` and `set_group` (group membership). No new API endpoints. The Mapbox token is a public client-side token restricted by referrer domain (same as the group map token). [VERIFIED: GroupMapPanel.tsx — same token, same approach]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Map is read-only display; auth on backend estate endpoint |
| V3 Session Management | No | No session changes |
| V4 Access Control | No | No new endpoint; existing estate show endpoint is already protected |
| V5 Input Validation | No | Props are `number` typed (TypeScript); no user input |
| V6 Cryptography | No | No cryptography |

---

## Phase Requirements

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAP-04 | The individual listing detail page shows an embedded Google Maps section with the property's location pinned | Implemented via Mapbox (project standard since Phase 9, not Google Maps). `latitude`/`longitude` already in `listingDetail` from Phase 8; already returned by the estate show API; already typed in `EstateListingDetailsType`. One new component (`EstateLocationMap.tsx`) + one `EstateDashboard.tsx` insertion point. No backend work needed. Map section absent (not rendered) when coordinates are null — satisfies success criterion 2. |
</phase_requirements>

---

## Sources

### Primary (HIGH confidence)
- `/home/tomlaventure/projects/realstate/frontend/src/components/dashboard/general/GroupMapPanel.tsx` — established Mapbox map pattern; `react-map-gl/mapbox` entry, `cooperativeGestures`, `streets-v12` style, CSS import, `ViewState` pattern
- `/home/tomlaventure/projects/realstate/frontend/src/containers/dashboard/estate/EstateDashboard.tsx` — insertion point, layout structure, rendering pattern
- `/home/tomlaventure/projects/realstate/frontend/src/containers/dashboard/estate/EstateDashboardContext.tsx` — confirms `useFetchEstate` already fetches `listingDetail` with coordinates
- `/home/tomlaventure/projects/realstate/frontend/src/assets/types/estateListingDetailsType.ts` — confirmed `latitude: number | null`, `longitude: number | null`, `geocodingFailed: boolean | null` at lines 39-41
- `/home/tomlaventure/projects/realstate/frontend/src/assets/types/estateType.ts` — confirmed `listingDetail?: EstateListingDetails` on estate type
- `/home/tomlaventure/projects/realstate/backend/app/serializers/listing_detail_serializer.rb` — confirmed `:latitude`, `:longitude`, `:geocoding_failed` in serializer attributes (lines 38-40)
- `/home/tomlaventure/projects/realstate/frontend/package.json` — VERIFIED: `react-map-gl: ^8.1.1`, `mapbox-gl: ^3.23.1`, `use-supercluster: ^1.2.0` installed; no Google Maps libraries present
- `/home/tomlaventure/projects/realstate/frontend/.env` — VERIFIED: `VITE_MAPBOX_TOKEN` set
- `/home/tomlaventure/projects/realstate/.planning/phases/09-group-dashboard-map/09-04-SUMMARY.md` — VERIFIED: Phase 9 switched from Google Maps to Mapbox during execution; all four components complete

### Secondary (MEDIUM confidence)
- Phase 9 RESEARCH.md — original stack recommendation (Google Maps); superseded by actual execution
- Phase 9 PATTERNS.md — file classification and analog patterns

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json
- Architecture: HIGH — insertion point verified in EstateDashboard.tsx; data path verified through serializer + type
- Data availability: HIGH — lat/lng in serializer + type confirmed; no new backend work needed
- Pitfalls: HIGH — derived from Phase 9 execution decisions + codebase inspection

**Research date:** 2026-05-17
**Valid until:** 2026-08-17 (react-map-gl v8 is stable; mapbox-gl v3 is current major)
