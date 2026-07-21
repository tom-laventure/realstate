---
phase: 37-free-tier-gating
plan: 04
subsystem: ui
tags: [react, typescript, rbac, vitest, lucide-react, plan-tiers]

# Dependency graph
requires:
  - phase: 37-free-tier-gating (Plan 02)
    provides: backend calendar_sync_available boolean and PLAN_TIERS capability flags (AppConstants::PlanTier)
provides:
  - hasPlanCapability(plan, capability) frontend helper mirroring backend AppConstants::PLAN_TIERS
  - Shared FreeTierBanner info-notice component per UI-SPEC contract
affects: [37-05, 37-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plan-capability check: hasPlanCapability(plan, capability) — pure lookup mirroring permissions.ts's hasPermission, no inline plan === 'free' comparisons"
    - "Shared info-notice banner (FreeTierBanner) reused across all Free-tier gated surfaces instead of four bespoke banners"

key-files:
  created:
    - frontend/src/assets/rbac/planPermissions.ts
    - frontend/src/assets/rbac/planPermissions.test.ts
    - frontend/src/components/common/FreeTierBanner.tsx
    - frontend/src/components/common/FreeTierBanner.test.tsx
  modified: []

key-decisions:
  - "Single lightweight hasPlanCapability helper (no hook/<Can> wrapper) — proportionate for four call sites per RESEARCH Open Q1 resolution"
  - "calendarSync stays in PLAN_CAPABILITIES map for structural fidelity to backend PLAN_TIERS, but is flagged via inline comments as never-use-for-gating: calendar access is user-scoped/cross-brokerage, must use backend calendar_sync_available instead (D-06)"
  - "FreeTierBanner uses gap-2 (8px, 4px-grid conformant), not the pre-existing gap-1.5 (6px) found in ConnectBoardDialog.tsx, per UI-SPEC explicit instruction not to propagate that inconsistency"

patterns-established:
  - "hasPlanCapability(plan, capability): boolean — the single auditable entry point for all plan-tier capability checks, analogous to hasPermission(role, permission)"
  - "FreeTierBanner({ message, heading = 'Free plan' }) — reusable informational banner, no CTA, for all Free-tier restriction surfaces"

requirements-completed: [PLAN-04, PLAN-05, PLAN-07, PLAN-08]

# Metrics
duration: 3min
completed: 2026-07-20
---

# Phase 37 Plan 04: Plan-Capability Helper & Shared Free-Tier Banner Summary

**Frontend `hasPlanCapability` RBAC-style helper mirroring backend `PLAN_TIERS`, plus a reusable `FreeTierBanner` info-notice component matching the UI-SPEC visual contract — both fully unit tested, no consumers wired yet.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-07-20T20:20:36-07:00
- **Completed:** 2026-07-20T20:21:37-07:00
- **Tasks:** 2
- **Files modified:** 4 (all new)

## Accomplishments
- `hasPlanCapability(plan, capability)` — pure lookup helper mirroring `permissions.ts`'s `hasPermission`, backed by a `PLAN_CAPABILITIES` map that mirrors backend `AppConstants::PLAN_TIERS` (free: all-false; independent/growth: all-true)
- Safe-false behavior confirmed for `undefined` and unrecognized plan strings
- `calendarSync` explicitly flagged inline (type + map) as never-gate-via-brokerage-plan — the correct signal is the backend `calendar_sync_available` boolean consumed in Plan 06 (user-scoped, cross-brokerage, per D-06/RESEARCH Pitfall 1)
- `FreeTierBanner` shared component built per UI-SPEC: `border-blue-200 bg-blue-50 text-blue-800` container, `gap-2` icon+heading row, `Info` icon (`h-4 w-4 shrink-0`, `aria-hidden`), `text-base font-semibold` heading (defaults to "Free plan"), `text-sm font-normal` body — no CTA/button/link
- Both files verified self-contained (no imports from unwritten Plan 05/06 files)

## Task Commits

Each task was committed atomically (TDD: test → feat) in the `frontend` sub-repo, on branch `worktree-agent-aa6f7d205b6500569-frontend`:

1. **Task 1: planPermissions.ts capability helper**
   - `dc6b794` (test) — failing test for `hasPlanCapability`
   - `1da8c3e` (feat) — `hasPlanCapability` implementation
2. **Task 2: FreeTierBanner shared component**
   - `95de151` (test) — failing test for `FreeTierBanner`
   - `babcdf9` (feat) — `FreeTierBanner` implementation

_All commits made directly in the `frontend` sub-repo per CLAUDE.md ("Commit code to them directly")._

## Files Created/Modified
- `frontend/src/assets/rbac/planPermissions.ts` - `hasPlanCapability` helper + `PlanCapability` type + `PLAN_CAPABILITIES` map
- `frontend/src/assets/rbac/planPermissions.test.ts` - 5 vitest cases (free/independent/growth/undefined/bogus)
- `frontend/src/components/common/FreeTierBanner.tsx` - shared info-notice banner component
- `frontend/src/components/common/FreeTierBanner.test.tsx` - 5 vitest cases (message, default heading, custom heading, single aria-hidden Info icon, no CTA element)

## Decisions Made
- Kept the helper as a single function (no `<Can>`-style JSX wrapper) since only four call sites exist across Plans 05/06 — matches RESEARCH's Open Q1 resolution and avoids over-engineering for the current call-site count.
- Preserved `calendarSync` in the capability map (rather than omitting it) to keep the frontend mirror structurally identical to the backend `PLAN_TIERS` struct, but added inline warnings at both the type-union entry and every tier's map entry so future consumers don't misuse it for gating.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` and `<acceptance_criteria>` blocks precisely; TDD RED confirmed via unresolved-import failures before each GREEN implementation, and both test files pass 5/5 cases with the combined suite (10/10) green.

## Issues Encountered

**Worktree isolation gap for nested sub-repos (infrastructure, not plan-related):** This monorepo tracks `frontend/` and `backend/` as git submodule-style gitlinks (mode `160000`) but has no `.gitmodules` file registering them, so `git worktree add` for the monorepo did not populate `frontend/`'s content into this isolated worktree (it does for formally-registered submodules, but these aren't). Resolved by creating a proper git worktree of the `frontend` sub-repo itself, rooted at `frontend/` inside this monorepo worktree, on branch `worktree-agent-aa6f7d205b6500569-frontend` off `frontend`'s `master` — mirroring the pattern already visible from a prior parallel-execution agent's now-pruned `worktree-agent-a16f79a73648690f3-frontend` branch. `node_modules` was symlinked from the primary `frontend` checkout (identical `package-lock.json`) to avoid a redundant `npm install`. This is purely a local execution-environment workaround; no monorepo or sub-repo tracked files were affected beyond the plan's intended output. Flagging for the orchestrator: the `frontend` sub-repo commits (`dc6b794`, `1da8c3e`, `95de151`, `babcdf9`) live on that per-agent branch inside the `frontend` sub-repo and will need to be merged into `frontend`'s `master` alongside this monorepo worktree's merge.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `hasPlanCapability` and `FreeTierBanner` are ready contracts for Plans 05 (Board Registrations, Group detail client-invite, Domains page) and 06 (Account Calendar tab) to consume.
- Plan 06 must use the backend `calendar_sync_available` boolean (not `hasPlanCapability(plan, 'calendarSync')`) per the inline warning left in `planPermissions.ts`.
- No blockers. The `frontend` sub-repo worktree/branch created for this execution needs orchestrator-level merge handling (see Issues Encountered) since `sub_repos` was reported as `[]` by `init.execute-phase` despite the actual gitlink structure requiring sub-repo-aware merge.

---
*Phase: 37-free-tier-gating*
*Completed: 2026-07-20*
