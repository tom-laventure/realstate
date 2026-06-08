---
phase: 28-brokerage-selection-page-redesign
plan: 01
subsystem: ui
tags: [react, tailwind, shadcn, redux, brokerage-selection]

# Dependency graph
requires:
  - phase: 27
    provides: AdminBrokerage interface with clientCount, memberCount, owners fields
provides:
  - BrokerageCard.tsx — extracted brokerage card component with name, role badge, stats, owners
  - BrokerageSelection.tsx — full-width page with responsive grid, heading, auto-redirect, loading/empty states
affects: [phase-29-navbar, brokerage-selection-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Extracted card component pattern — BrokerageCard receives AdminBrokerage + onClick, renders as keyboard-focusable button with card styling applied directly
    - Auto-redirect pattern — check adminBrokerages.length === 1 after loading guard, dispatch setActiveBrokerage + navigate with replace:true

key-files:
  created:
    - frontend/src/containers/portal/BrokerageCard.tsx
  modified:
    - frontend/src/containers/portal/BrokerageSelection.tsx

key-decisions:
  - "Button-as-card pattern: apply card classes (rounded-xl border border-border bg-card shadow-sm) directly to <button> element rather than wrapping Card in button (invalid HTML) or button in Card (div > button)"
  - "Auto-redirect check placed after loading guard as synchronous conditional before main render — not a useEffect — consistent with D-10"
  - "Badge variant=secondary per UI-SPEC: muted background reads as informational role label, not action"
  - "Owners row omitted entirely (not rendered) when owners array is empty, per D-05"

patterns-established:
  - "Card-as-button: apply shadcn card visual classes directly to <button> for full-card interactivity"
  - "Conditional owners row: {array.length > 0 && <p>} — clean omission, no placeholder"

requirements-completed: [DASH-03, DASH-04]

# Metrics
duration: 8min
completed: 2026-06-06
---

# Phase 28 Plan 01: Brokerage Selection Page Redesign Summary

**Full-width responsive brokerage selection page with extracted BrokerageCard, per-brokerage stats (clientCount, memberCount, owners), and single-brokerage auto-redirect**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-06T00:00:00Z
- **Completed:** 2026-06-06T00:08:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 rewritten)

## Accomplishments

- Created `BrokerageCard.tsx` as a self-contained keyboard-focusable button card displaying brokerage name, role badge (secondary variant, capitalized), stats line (`clientCount clients · memberCount members`), and conditional owners row
- Rewrote `BrokerageSelection.tsx` from a narrow `max-w-sm` centered panel to a full-width `max-w-7xl` page with a responsive `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` card grid
- Added single-brokerage auto-redirect: when `adminBrokerages.length === 1` after fetch, immediately dispatches `setActiveBrokerage` and navigates with `replace:true` — user never sees the selection screen
- Preserved exact fetch/cancel pattern, loading spinner JSX, and Redux dispatch hooks

## Task Commits

1. **Task 1: Create BrokerageCard component** - `616d32a` (feat)
2. **Task 2: Rewrite BrokerageSelection with full-width layout and auto-redirect** - `1a3d4a0` (feat)

## Files Created/Modified

- `frontend/src/containers/portal/BrokerageCard.tsx` — New extracted card component; renders AdminBrokerage as a button with name+badge row, stats row, conditional owners row
- `frontend/src/containers/portal/BrokerageSelection.tsx` — Rewritten from narrow panel to full-width grid page; imports BrokerageCard; adds auto-redirect; preserves all fetch/Redux/loading logic

## Decisions Made

- **Button-as-card pattern:** Card visual classes applied directly to `<button>` element rather than nesting structures that produce invalid or inaccessible HTML. This is the correct approach for full-card interactivity.
- **Auto-redirect as synchronous conditional:** Placed after the loading guard as a plain `if` check (not a `useEffect`) — fires synchronously during render when loading is complete and exactly one brokerage exists.
- **Badge variant=secondary:** Consistent with UI-SPEC rationale — muted background reads as informational, not actionable.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — TypeScript build passed without errors on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 28 complete. `/dashboard` now shows a full-width brokerage selection grid with rich per-brokerage data.
- Phase 29 (navbar) can add a navbar above this page — Phase 28 intentionally left no navbar per context decision.
- Single-brokerage users are silently redirected to `/dashboard/:id` without ever seeing the selection screen.

---
*Phase: 28-brokerage-selection-page-redesign*
*Completed: 2026-06-06*
