---
phase: 37-free-tier-gating
plan: 06
subsystem: ui
tags: [react, typescript, tanstack-query, vitest, calendar, plan-tiers]

# Dependency graph
requires:
  - phase: 37-free-tier-gating (Plan 02)
    provides: backend calendar_sync_available boolean exposed on GET /v1/account/calendar/connections
  - phase: 37-free-tier-gating (Plan 04)
    provides: shared FreeTierBanner info-notice component
provides:
  - CalendarContext.state.calendarSyncAvailable threaded from the backend user-scoped boolean
  - CalendarTab banner-vs-grid conditional render (D-08 — tab stays visible for Free users)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "User-scoped, cross-brokerage gating signal consumed directly from a backend response boolean instead of hasPlanCapability(brokerage.plan, ...) — the correct pattern whenever the gated resource is not brokerage-scoped (D-06)"

key-files:
  created:
    - frontend/src/components/view/account/calendar/CalendarTab.test.tsx
  modified:
    - frontend/src/assets/types/calendarConnectionType.ts
    - frontend/src/store/hooks/Account/useFetchCalendarConnections.ts
    - frontend/src/containers/account/CalendarContext.tsx
    - frontend/src/components/view/account/calendar/CalendarTab.tsx

key-decisions:
  - "calendarSyncAvailable defaults to true (fail-open) at the hook layer via `data?.calendarSyncAvailable ?? true` so a load error never falsely hides a paid user's providers — the backend 403 on connect/authorize remains the real gate (per plan's threat register T-37-13, accept disposition)"
  - "Did NOT use hasPlanCapability for this surface — calendar access is user-scoped and cross-brokerage (D-06), so the authoritative signal is the backend boolean, not brokerage.plan"

requirements-completed: [PLAN-07]

# Metrics
duration: 2min
completed: 2026-07-20
---

# Phase 37 Plan 06: Calendar Tab Free-Tier Gating Summary

**Account Calendar tab now reads the backend's user-scoped `calendar_sync_available` boolean and swaps the provider-card grid for a FreeTierBanner when a fully-Free user has no paid membership anywhere, while keeping the tab and its heading/intro text visible in both states.**

## Performance

- **Duration:** ~2 min (coding); full plan including nested worktree setup ~90s of test/build verification
- **Started:** 2026-07-20T21:34:xx-07:00 (frontend sub-repo worktree creation)
- **Completed:** 2026-07-20T21:36:51-07:00
- **Tasks:** 2
- **Files modified:** 5 (4 modified, 1 created)

## Accomplishments
- `FetchCalendarConnectionsResponse` now declares `calendarSyncAvailable?: boolean`, matching the axios interceptor's auto-camelCase of the backend's `calendar_sync_available` field
- `useFetchCalendarConnections` threads the value through with a fail-open `?? true` default
- `CalendarContext` exposes `state.calendarSyncAvailable` and includes it in the `useMemo` dependency array, following the file's existing dep-list discipline
- `CalendarTab` branches on `state.calendarSyncAvailable === false` to render `FreeTierBanner` with the exact UI-SPEC calendar copy in place of the provider-card grid — the "Connected Calendars" heading and intro paragraph are untouched and render in both states (D-08)
- `CalendarTab.tsx` does not import or reference `hasPlanCapability` anywhere (verified via grep)
- New `CalendarTab.test.tsx` mocks `@/containers/account/CalendarContext` (following the established `UsersAdminBoard.test.tsx` mocking pattern) and asserts: banner text present + provider grid absent when `calendarSyncAvailable=false`; provider grid present ("Google Calendar" card text) + banner absent when `calendarSyncAvailable=true`; heading present in both states

## Task Commits

Each task was committed atomically in the `frontend` sub-repo, on branch `worktree-agent-af4277aa93b9ded77-frontend`:

1. **Task 1: Thread calendarSyncAvailable through type + hook + context** - `a591bb1` (feat)
2. **Task 2: CalendarTab banner-vs-grid render (PLAN-07 frontend, D-08)** - `1809941` (feat)

_All commits made directly in the `frontend` sub-repo per CLAUDE.md ("Commit code to them directly")._

## Files Created/Modified
- `frontend/src/assets/types/calendarConnectionType.ts` - added optional `calendarSyncAvailable` field to `FetchCalendarConnectionsResponse`
- `frontend/src/store/hooks/Account/useFetchCalendarConnections.ts` - returns `calendarSyncAvailable` with fail-open `?? true` default
- `frontend/src/containers/account/CalendarContext.tsx` - exposes `state.calendarSyncAvailable`, added to `useMemo` deps
- `frontend/src/components/view/account/calendar/CalendarTab.tsx` - conditional render: `FreeTierBanner` vs. provider grid, based on `state.calendarSyncAvailable`
- `frontend/src/components/view/account/calendar/CalendarTab.test.tsx` - new RTL test file, 2 cases (banner-on-unavailable, grid-on-available), both assert heading visibility

## Decisions Made
- Fail-open default (`true`) at the hook boundary, not the context or component layer — keeps the "unavailable" state derivable from a single explicit `false`, and any transient loading/error state can never spuriously hide a paying user's calendar providers. The backend's 403 on `google/authorize` / `apple/connect` remains the actual security boundary (threat register T-37-12/T-37-13, both already dispositioned in the plan).
- Test mocks the context module entirely (matching the existing `UsersAdminBoard.test.tsx` pattern) rather than mocking the underlying TanStack hook — keeps the test focused on the component's render branching, independent of query/network plumbing already covered elsewhere.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` and `<acceptance_criteria>` blocks precisely.

## Issues Encountered

**Worktree isolation gap for nested sub-repos (infrastructure, not plan-related) — same known pattern as Plans 01-04:** This monorepo tracks `frontend/` and `backend/` as gitlink-style embedded repos (mode `160000`) with no `.gitmodules`, so the outer `git worktree add` for this agent's monorepo worktree left `frontend/` empty. Resolved per the plan's `<known_repo_quirk>` instructions by creating a nested `git worktree add` of the `frontend` sub-repo, branch `worktree-agent-af4277aa93b9ded77-frontend` off `frontend`'s `master`. One adjustment from the literal instruction text: the nested worktree had to be rooted at `.claude/worktrees/agent-af4277aa93b9ded77/frontend` (inside this agent's own monorepo worktree path) rather than nested under the primary `frontend/.claude/worktrees/...` checkout — the sandboxed Edit/Write tool refused writes outside this agent's own worktree boundary, so the nested worktree's physical location had to live inside it. `node_modules` was symlinked from the primary `frontend` checkout (identical `package-lock.json`) to avoid a redundant `npm install`. No monorepo or sub-repo tracked files were affected beyond the plan's intended output.

Flagging for the orchestrator: the `frontend` sub-repo commits (`a591bb1`, `1809941`) live on branch `worktree-agent-af4277aa93b9ded77-frontend` inside the `frontend` sub-repo (nested worktree path: `.claude/worktrees/agent-af4277aa93b9ded77/frontend` within this agent's own monorepo worktree) and need to be merged into `frontend`'s `master` alongside this monorepo worktree's merge.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Calendar tab gating (PLAN-07) is complete and self-contained; no further plans depend on this output per the plan's `affects: []`.
- No blockers.

---
*Phase: 37-free-tier-gating*
*Completed: 2026-07-20*
