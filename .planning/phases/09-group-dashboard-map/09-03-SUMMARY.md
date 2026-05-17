---
phase: 09-group-dashboard-map
plan: "03"
subsystem: ui
tags: [google-maps, react-google-maps, markerclusterer, npm, env]

# Dependency graph
requires:
  - phase: 09-01
    provides: coordinates API endpoint that map markers will consume
provides:
  - "@vis.gl/react-google-maps@1.8.3 installed in production dependencies"
  - "@googlemaps/markerclusterer@2.6.2 installed in production dependencies"
  - "VITE_GOOGLE_MAPS_API_KEY and VITE_GOOGLE_MAPS_MAP_ID documented in .env.example"
affects:
  - 09-04-GroupMapPanel (directly consumes both packages and env vars)

# Tech tracking
tech-stack:
  added:
    - "@vis.gl/react-google-maps@1.8.3 — Google-endorsed React wrapper for Maps JS API; bundles TS types"
    - "@googlemaps/markerclusterer@2.6.2 — official Google marker clustering library; bundles TS types"
  patterns:
    - "Pin exact versions for Google Maps libs (not ^ ranges) to ensure reproducible bundles"

key-files:
  created: []
  modified:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/.env.example

key-decisions:
  - "09-03: Both packages added to production dependencies (not devDependencies) — map renders in production"
  - "09-03: No @types/google.maps install needed — both packages ship bundled TypeScript definitions"
  - "09-03: Pre-existing tsconfig TS6046/TS5070 moduleResolution errors are out-of-scope (pre-existing, not caused by new packages)"

patterns-established:
  - "VITE_GOOGLE_MAPS_API_KEY / VITE_GOOGLE_MAPS_MAP_ID: required env vars for any component using Google Maps"

requirements-completed: [MAP-02]

# Metrics
duration: 4min
completed: 2026-05-17
---

# Phase 9 Plan 03: Google Maps Library Installation Summary

**@vis.gl/react-google-maps@1.8.3 and @googlemaps/markerclusterer@2.6.2 installed as production dependencies; VITE_GOOGLE_MAPS_API_KEY and VITE_GOOGLE_MAPS_MAP_ID documented in .env.example**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-17T09:20:00Z
- **Completed:** 2026-05-17T09:24:32Z
- **Tasks:** 1 completed
- **Files modified:** 3

## Accomplishments

- Installed `@vis.gl/react-google-maps@1.8.3` (Google-endorsed React wrapper, bundles TS types) as a production dependency
- Installed `@googlemaps/markerclusterer@2.6.2` (official Google clustering library, bundles TS types) as a production dependency
- Appended `VITE_GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAPS_MAP_ID` placeholder entries to `.env.example` without disturbing existing entries

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Google Maps libraries and document env vars** - `03ad510` (chore)

## Files Created/Modified

- `frontend/package.json` - Added @vis.gl/react-google-maps@1.8.3 and @googlemaps/markerclusterer@2.6.2 under dependencies
- `frontend/package-lock.json` - Lockfile updated with SHA-512 integrity hashes for 9 new packages
- `frontend/.env.example` - Appended VITE_GOOGLE_MAPS_API_KEY and VITE_GOOGLE_MAPS_MAP_ID placeholder lines

## Decisions Made

- Both packages placed under `dependencies` (not `devDependencies`) — the map panel renders in production
- No separate `@types/google.maps` install required — both packages bundle their own TypeScript definitions
- Pre-existing tsconfig errors (TS6046 moduleResolution, TS5070 resolveJsonModule) are out-of-scope; they predate this plan and are unrelated to the new packages

## npm Warnings During Install

```
npm warn EBADENGINE Unsupported engine { package: '@inquirer/ansi@2.0.5', required: { node: '>=23.5.0 || ^22.13.0 || ^21.7.0 || ^20.12.0' }, current: { node: 'v22.9.0' } }
npm warn EBADENGINE Unsupported engine { package: '@inquirer/confirm@6.0.12', ... }
npm warn EBADENGINE Unsupported engine { package: '@inquirer/core@11.1.9', ... }
npm warn EBADENGINE Unsupported engine { package: '@inquirer/figures@2.0.5', ... }
npm warn EBADENGINE Unsupported engine { package: '@inquirer/type@4.0.5', ... }
```

These are transitive engine warnings from `@inquirer/*` packages (pulled in by npm CLI internals, not by the installed libraries). They do not affect runtime or the browser bundle.

No peer dependency warnings related to `@vis.gl/react-google-maps` or `@googlemaps/markerclusterer`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The plan's sanity-check command (`node -e "console.log(require('@vis.gl/react-google-maps/package.json').version)"`) failed because `@vis.gl/react-google-maps` uses an ESM exports map that does not export the `./package.json` subpath. This is not a bug — the package installed correctly. Version was verified by reading `node_modules/@vis.gl/react-google-maps/package.json` directly via Python JSON parsing. Both packages confirmed at exact pinned versions.

## User Setup Required

**Two manual steps are required before Plan 04 (GroupMapPanel) can render a live map:**

### Step 1: Create a Google Maps API Key
1. Open Google Cloud Console → APIs & Services → Library
2. Enable **Maps JavaScript API**
3. Go to APIs & Services → Credentials → Create Credentials → API key
4. Copy the key and set it in your environment: `VITE_GOOGLE_MAPS_API_KEY=<your-key>`
5. **Security:** Restrict the key to HTTP referrers: `*.realtybase.ca/*` and `localhost:*`
   - Location: APIs & Services → Credentials → `<key>` → Application restrictions → HTTP referrers

### Step 2: Create a Map ID
1. Open Google Cloud Console → Maps Platform → Map Management
2. Click **Create Map ID**
3. Set Type: **JavaScript**, Map type: **Roadmap**
4. Copy the Map ID and set it: `VITE_GOOGLE_MAPS_MAP_ID=<your-map-id>`
5. Map IDs are required by Advanced Markers (the modern marker API used by Plan 04)

### Verification
After setting both env vars, run:
```bash
cd frontend && npm run dev
# Navigate to a group dashboard — the map panel (Plan 04) will render the Google Map
```

## Next Phase Readiness

- Plan 04 (GroupMapPanel component) can now import from `@vis.gl/react-google-maps` and `@googlemaps/markerclusterer` without install errors
- Both env vars documented in `.env.example` — developers know what to configure
- `package-lock.json` records SHA-512 integrity hashes — `npm ci` will verify tarball integrity on CI

---
*Phase: 09-group-dashboard-map*
*Completed: 2026-05-17*
