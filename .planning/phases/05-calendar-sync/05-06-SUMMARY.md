---
phase: 05-calendar-sync
plan: "06"
subsystem: ui
tags: [react, tanstack-query, shadcn, calendar, tailwind, typescript]

requires:
  - phase: 05-calendar-sync
    plan: "04"
    provides: Calendar API endpoints (connections, authorize, connect-apple, disconnect, resync)
  - phase: 05-calendar-sync
    plan: "05"
    provides: CalendarSyncJob + EstateEventsController fan-out (backend sync complete)

provides:
  - CalendarConnection types (CalendarProvider, CalendarConnectionStatus, CalendarConnection, FetchCalendarConnectionsResponse)
  - calendarConnectionsKeys TanStack query key
  - 4 API modules under assets/api/account/calendar/
  - 6 TanStack hooks under store/hooks/Account/ (fetch, google/microsoft/apple connect, disconnect, resync)
  - CalendarContext (useMemo pattern) co-located in containers/account/
  - ProviderCard component with status badge, last sync, connect/disconnect/resync, Apple credential form, disconnect dialog
  - CalendarTab component with 3-column responsive grid
  - Account.tsx updated with Tabs wrapping Profile and Calendar TabsContent

affects: [05-07]

tech-stack:
  added: []
  patterns:
    - "CalendarContext mirrors AccountContext useMemo pattern — orchestrates 6 hooks, returns state + actions"
    - "ProviderCard renders Apple inline credential form only when status=disconnected && provider=apple; Re-sync only on status=error"
    - "Generic error copy in ProviderCard (T-05-06-03) — raw lastError never displayed to user"
    - "Google/Microsoft connect hooks redirect via window.location.href in onSuccess — no page-render needed"

key-files:
  created:
    - frontend/src/assets/types/calendarConnectionType.ts
    - frontend/src/assets/api/account/calendar/fetchCalendarConnections.ts
    - frontend/src/assets/api/account/calendar/connectAppleCalendar.ts
    - frontend/src/assets/api/account/calendar/disconnectCalendar.ts
    - frontend/src/assets/api/account/calendar/resyncCalendar.ts
    - frontend/src/store/hooks/Account/useFetchCalendarConnections.ts
    - frontend/src/store/hooks/Account/useConnectGoogleCalendar.ts
    - frontend/src/store/hooks/Account/useConnectMicrosoftCalendar.ts
    - frontend/src/store/hooks/Account/useConnectAppleCalendar.ts
    - frontend/src/store/hooks/Account/useDisconnectCalendar.ts
    - frontend/src/store/hooks/Account/useResyncCalendar.ts
    - frontend/src/containers/account/CalendarContext.tsx
    - frontend/src/components/view/account/calendar/CalendarTab.tsx
    - frontend/src/components/view/account/calendar/ProviderCard.tsx
  modified:
    - frontend/src/store/hooks/queryKeys.tsx
    - frontend/src/containers/account/Account.tsx

key-decisions:
  - "Generic error copy in ProviderCard — raw lastError field never rendered (T-05-06-03 mitigation); only boolean check used to show/hide generic message"
  - "Apple password input uses type=password (T-05-06-01 mitigation) — value not stored beyond form session"
  - "CalendarContext co-located in containers/account/ — parallel to AccountContext, not extending it (D-08)"
  - "providerOrder array drives card order: ['google', 'microsoft', 'apple'] — connectionsByProvider lookup handles absent entries gracefully"

requirements-completed: [CAL-02, CAL-07]

duration: 10min
completed: "2026-05-13"
---

# Phase 05 Plan 06: Calendar Settings UI Summary

**Complete frontend calendar settings tab with 3 provider cards (Google/Microsoft/Apple), status badges, OAuth redirect for Google/Microsoft, inline Apple credential form, disconnect dialog, and Re-sync button for error-state cards — all wired to the backend API via CalendarContext + TanStack hooks**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-13T21:10:00Z
- **Completed:** 2026-05-13T21:20:00Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Full type system for calendar connections: `CalendarProvider`, `CalendarConnectionStatus`, `CalendarConnection`, `FetchCalendarConnectionsResponse` exported from `calendarConnectionType.ts`
- 4 API modules covering all backend endpoints: fetch connections, connect Apple (sends `app_specific_password` snake_case), disconnect, resync
- 6 TanStack hooks following established patterns: query (fetch) + mutations (google/microsoft connect with `window.location.href` redirect, apple connect with cache invalidation, disconnect, resync) — all with `retry: false` and toast feedback
- `CalendarContext` following exact `AccountContext` useMemo pattern — orchestrates all 6 hooks into `state` + `actions`
- `ProviderCard` with status badges (emerald/connected, amber/error, outline/disconnected), relative last-sync timestamp, loading states with `Loader2 animate-spin`, `aria-label` + `aria-busy` on all buttons, Apple inline credential form, disconnect confirmation `Dialog`
- `CalendarTab` with 3-column responsive grid (`md:grid-cols-3`) showing all 3 providers
- `Account.tsx` updated to wrap content in `<Tabs defaultValue="profile">` with Profile and Calendar tabs — heading stays above Tabs per UI-SPEC
- `npm run build` exits 0 with no TypeScript errors

## Task Commits

Each task was committed atomically to `frontend/`:

1. **Task 1: Types, query keys, API modules, and TanStack hooks** — `a041e0a` (feat)
2. **Task 2: CalendarContext, ProviderCard, CalendarTab, Account Tabs integration** — `20531e9` (feat)

## Files Created/Modified

- `frontend/src/assets/types/calendarConnectionType.ts` — CalendarProvider, CalendarConnectionStatus, CalendarConnection, FetchCalendarConnectionsResponse
- `frontend/src/store/hooks/queryKeys.tsx` — calendarConnectionsKeys appended
- `frontend/src/assets/api/account/calendar/fetchCalendarConnections.ts` — GET /v1/account/calendar/connections
- `frontend/src/assets/api/account/calendar/connectAppleCalendar.ts` — POST /v1/account/calendar/apple/connect with snake_case body
- `frontend/src/assets/api/account/calendar/disconnectCalendar.ts` — DELETE /v1/account/calendar/:provider
- `frontend/src/assets/api/account/calendar/resyncCalendar.ts` — POST /v1/account/calendar/:provider/resync
- `frontend/src/store/hooks/Account/useFetchCalendarConnections.ts` — query hook
- `frontend/src/store/hooks/Account/useConnectGoogleCalendar.ts` — mutation + window.location.href redirect
- `frontend/src/store/hooks/Account/useConnectMicrosoftCalendar.ts` — mutation + window.location.href redirect
- `frontend/src/store/hooks/Account/useConnectAppleCalendar.ts` — mutation + cache invalidation
- `frontend/src/store/hooks/Account/useDisconnectCalendar.ts` — mutation + cache invalidation
- `frontend/src/store/hooks/Account/useResyncCalendar.ts` — mutation + cache invalidation
- `frontend/src/containers/account/CalendarContext.tsx` — useMemo context hook, exports useCalendarContext default
- `frontend/src/components/view/account/calendar/ProviderCard.tsx` — single provider card with all states
- `frontend/src/components/view/account/calendar/CalendarTab.tsx` — 3-card grid, providerOrder array
- `frontend/src/containers/account/Account.tsx` — Tabs integration with CalendarTab

## Decisions Made

- Generic error copy in ProviderCard renders only when `status === 'error' && lastError` (truthiness check) but shows fixed copy — `lastError` field itself is not interpolated into the DOM (T-05-06-03 mitigation per threat model)
- Apple `type="password"` input used (T-05-06-01) — password never logged or stored beyond form session
- `connectGoogle` and `connectMicrosoft` hooks use `useMutation` (not `useQuery`) because they trigger navigation side effects in `onSuccess`; GET-based OAuth redirect treated as a mutation operation

## Deviations from Plan

None — plan executed exactly as written.

## Security (Threat Model Compliance)

- **T-05-06-01 (Apple password disclosure):** `type="password"` on the password input; value stored only in component local state during form session; never logged
- **T-05-06-02 (OAuth redirect spoofing):** `redirectUrl` comes from authenticated backend endpoint; frontend only redirects to returned URL — no client-side URL construction
- **T-05-06-03 (lastError disclosure):** ProviderCard renders generic copy ("Last sync failed...") not the raw `lastError` string from the API; `lastError` field used only as a boolean presence check
- **T-05-06-04 (provider parameter tampering):** `CalendarProvider` TypeScript union type restricts to `'google' | 'microsoft' | 'apple'`; passed as path segment via typed API modules

## Known Stubs

None — all 3 provider cards render real data from `GET /v1/account/calendar/connections`. The `CalendarTab` handles the case where a provider is not present in the API response by returning `null` for that card.

## Next Phase Readiness

- Wave 4 plan 07 (E2E / verifier) is unblocked: Account page has working Calendar tab
- Backend calendar API (Plans 04-05) is fully wired to the frontend
- All CAL-02 and CAL-07 requirements satisfied

---
*Phase: 05-calendar-sync*
*Completed: 2026-05-13*

## Self-Check: PASSED

Files verified:
- FOUND: frontend/src/assets/types/calendarConnectionType.ts
- FOUND: frontend/src/assets/api/account/calendar/fetchCalendarConnections.ts
- FOUND: frontend/src/assets/api/account/calendar/connectAppleCalendar.ts
- FOUND: frontend/src/assets/api/account/calendar/disconnectCalendar.ts
- FOUND: frontend/src/assets/api/account/calendar/resyncCalendar.ts
- FOUND: frontend/src/store/hooks/Account/useFetchCalendarConnections.ts
- FOUND: frontend/src/store/hooks/Account/useConnectGoogleCalendar.ts
- FOUND: frontend/src/store/hooks/Account/useConnectMicrosoftCalendar.ts
- FOUND: frontend/src/store/hooks/Account/useConnectAppleCalendar.ts
- FOUND: frontend/src/store/hooks/Account/useDisconnectCalendar.ts
- FOUND: frontend/src/store/hooks/Account/useResyncCalendar.ts
- FOUND: frontend/src/containers/account/CalendarContext.tsx
- FOUND: frontend/src/components/view/account/calendar/CalendarTab.tsx
- FOUND: frontend/src/components/view/account/calendar/ProviderCard.tsx
- FOUND: frontend/src/containers/account/Account.tsx (contains Tabs defaultValue="profile")

Commits verified: a041e0a, 20531e9 present in frontend git log
