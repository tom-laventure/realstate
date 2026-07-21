---
phase: 37-free-tier-gating
plan: 05
subsystem: ui
tags: [react, typescript, rbac, vitest, plan-tiers, free-tier-gating]

# Dependency graph
requires:
  - phase: 37-free-tier-gating (Plan 04)
    provides: hasPlanCapability(plan, capability) helper + shared FreeTierBanner component
provides:
  - Board Registrations page Free-tier banner (realBoardsAvailable gate)
  - Client-invite form hidden + banner on Free (clientsAvailable gate, D-04)
  - Domains page Free-tier banner (customDomainAvailable gate)
affects: [37-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Container resolves capability boolean via useFetchBrokerage + hasPlanCapability, exposes it in returned state; pure presentational component consumes it as a prop only — no hook calls in src/components/view/**"

key-files:
  created:
    - frontend/src/components/view/admin/brokerageView/BoardRegistrations.test.tsx
    - frontend/src/components/view/admin/listingGroupsAdminView/addUserToGroupView/AddUserToGroupView.test.tsx
    - frontend/src/components/view/admin/domainsAdminView/DomainCardList.test.tsx
  modified:
    - frontend/src/containers/adminBoard/boardsAdminBoard/useBoardsAdminContext.ts
    - frontend/src/containers/adminBoard/boardsAdminBoard/BoardsAdminBoard.tsx
    - frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx
    - frontend/src/containers/adminBoard/listingGroupAdminBoard/listingGroupDetailsAdminBoard/addUserToListingGroupAdminBoard/useAddUsersToGroupContext.tsx
    - frontend/src/containers/adminBoard/listingGroupAdminBoard/listingGroupDetailsAdminBoard/addUserToListingGroupAdminBoard/AddUserToListingGroupAdminBoard.tsx
    - frontend/src/components/view/admin/listingGroupsAdminView/addUserToGroupView/AddUserToGroupView.tsx
    - frontend/src/containers/adminBoard/domainsAdminBoard/useDomainsAdminContext.ts
    - frontend/src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx
    - frontend/src/components/view/admin/domainsAdminView/DomainCardList.tsx

key-decisions:
  - "Domains page banner placed immediately below the 'Manage your brokerage domains.' subtitle and above the status-badge legend/card list, matching UI-SPEC's 'below heading, above the action it explains' placement rule"
  - "Board Registrations banner placed inside CardContent, above the boardCredentials.length === 0 conditional, wrapped in a mb-4 div for spacing consistency with the existing test-board notice pattern"
  - "Domains container's pre-existing stale isPremium (brokerage.plan === 'premium') line left completely untouched per plan instruction — new customDomainAvailable gate is a separate, additive line routed through hasPlanCapability"

patterns-established:
  - "Three-surface container→prop→component wiring for plan-tier gates: useBoardsAdminContext/useAddUsersToGroupContext/useDomainsAdminContext each resolve their own capability boolean and add it to both the returned state object and the useMemo dependency array"

requirements-completed: [PLAN-04, PLAN-05, PLAN-08]

# Metrics
duration: 12min
completed: 2026-07-21
---

# Phase 37 Plan 05: Free-Tier Gated Surfaces (Boards, Client-Invite, Domains) Summary

**Wired `FreeTierBanner` + `hasPlanCapability` (Plan 04's contracts) into three brokerage-scoped admin surfaces — Board Registrations, the client-invite form in AddUserToGroupView (hidden entirely on Free per D-04), and the Domains page — each gated in its container hook and consumed as a prop by the pure presentational component, with a passing RTL test per surface.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-20T21:33:00-07:00
- **Completed:** 2026-07-20T21:45:00-07:00
- **Tasks:** 3
- **Files modified:** 9 modified, 3 new test files (12 total)

## Accomplishments
- `useBoardsAdminContext` resolves `realBoardsAvailable` via `useFetchBrokerage` + `hasPlanCapability(brokerage?.plan, 'realBoards')`; `BoardsAdminBoard` threads it to `BoardRegistrations`, which renders `FreeTierBanner` inside `CardContent` (above the empty-state/table) when the capability is false. `ConnectBoardDialog.tsx` untouched — no client-side board filtering added (D-02).
- `useAddUsersToGroupContext` resolves `clientsAvailable` the same way; `AddUserToGroupView` replaces the entire "Invite New User" `<form>` block with `FreeTierBanner` when `!clientsAvailable` (D-04 — hide entirely, not disabled-and-failing). The sibling "Add Existing User" form and the `h-px w-full bg-border` divider are untouched (D-03) on both tiers.
- `useDomainsAdminContext` (already calling `useFetchBrokerage`) adds `customDomainAvailable` via `hasPlanCapability(brokerage?.plan, 'customDomain')` as a new, separate line — the pre-existing stale `isPremium = brokerage?.plan === 'premium'` line was left completely untouched, not reused or extended. `DomainCardList` renders `FreeTierBanner` below the "Manage your brokerage domains." subtitle and above the status-badge legend/card list when `!customDomainAvailable`. No "Upgrade plan" button or `/admin/plan` link added.
- All three verbatim UI-SPEC copy strings present exactly as specified; no CTA/link in any banner.
- Zero `plan === 'free'` raw comparisons anywhere across all nine touched files; zero `useFetchBrokerage`/`hasPlanCapability` imports in any of the three pure `src/components/view/**` components — capability resolution lives exclusively in the three container hooks.
- `cd frontend && npm run build` succeeds with no new errors/warnings introduced by this plan (pre-existing chunk-size warning only).

## Task Commits

All three tasks committed atomically in the `frontend` sub-repo, on branch `worktree-agent-ab43e3b8a8d2321b7-frontend` (base: `frontend` `master` @ `19266a2`, which already includes Plan 04's `hasPlanCapability`/`FreeTierBanner`):

1. **Task 1: Board Registrations banner (PLAN-04 frontend)**
   - `bd665b9` (feat) — `useBoardsAdminContext.ts` + `BoardsAdminBoard.tsx` + `BoardRegistrations.tsx` + `BoardRegistrations.test.tsx`
2. **Task 2: Hide client-invite form + banner (PLAN-05 frontend, D-04)**
   - `73cccb9` (feat) — `useAddUsersToGroupContext.tsx` + `AddUserToListingGroupAdminBoard.tsx` + `AddUserToGroupView.tsx` + `AddUserToGroupView.test.tsx`
3. **Task 3: Domains page banner (PLAN-08 frontend)**
   - `2a2685b` (feat) — `useDomainsAdminContext.ts` + `DomainsAdminBoard.tsx` + `DomainCardList.tsx` + `DomainCardList.test.tsx`

_All commits made directly in the `frontend` sub-repo per CLAUDE.md ("Commit code to them directly")._

## Files Created/Modified
- `frontend/src/containers/adminBoard/boardsAdminBoard/useBoardsAdminContext.ts` - adds `realBoardsAvailable` to state + memo deps
- `frontend/src/containers/adminBoard/boardsAdminBoard/BoardsAdminBoard.tsx` - threads `realBoardsAvailable` prop
- `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` - renders `FreeTierBanner` gated by prop
- `frontend/src/components/view/admin/brokerageView/BoardRegistrations.test.tsx` - 2 RTL cases (banner present/absent)
- `frontend/src/containers/adminBoard/listingGroupAdminBoard/listingGroupDetailsAdminBoard/addUserToListingGroupAdminBoard/useAddUsersToGroupContext.tsx` - adds `clientsAvailable` to state + memo deps
- `frontend/src/containers/adminBoard/listingGroupAdminBoard/listingGroupDetailsAdminBoard/addUserToListingGroupAdminBoard/AddUserToListingGroupAdminBoard.tsx` - threads `clientsAvailable` prop
- `frontend/src/components/view/admin/listingGroupsAdminView/addUserToGroupView/AddUserToGroupView.tsx` - replaces Invite New User form with `FreeTierBanner` when gated
- `frontend/src/components/view/admin/listingGroupsAdminView/addUserToGroupView/AddUserToGroupView.test.tsx` - 2 RTL cases (banner replaces form / form present, add-existing present in both)
- `frontend/src/containers/adminBoard/domainsAdminBoard/useDomainsAdminContext.ts` - adds `customDomainAvailable` to state + memo deps, alongside untouched stale `isPremium` line
- `frontend/src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx` - threads `customDomainAvailable` prop
- `frontend/src/components/view/admin/domainsAdminView/DomainCardList.tsx` - renders `FreeTierBanner` below subtitle, above card list, when gated
- `frontend/src/components/view/admin/domainsAdminView/DomainCardList.test.tsx` - 2 RTL cases (banner present/absent)

## Decisions Made
- Board Registrations banner wrapped in a plain `mb-4` div (FreeTierBanner has no `className` prop) to match the existing spacing rhythm used by the sibling amber test-board notice in `BoardsAdminBoard.tsx`.
- Domains banner inserted right after the subtitle paragraph and before the status-badge legend, satisfying "below the heading, above the action it explains" without disturbing the legend/card-list structure below it.
- Left the container's stale `isPremium` computation completely alone per the plan's explicit instruction — it feeds nothing gating-relevant on this page and removing it is out of this phase's scope.

## Deviations from Plan

None — plan executed exactly as written. All three tasks matched their `<action>` and `<acceptance_criteria>` blocks precisely.

## Issues Encountered

**Worktree isolation for the nested `frontend` sub-repo (infrastructure, not plan-related, same pattern as Plans 01-04):** This monorepo tracks `frontend/` as a gitlink (mode `160000`) with no `.gitmodules`, so the outer `git worktree add` did not populate `frontend/`'s content into this isolated monorepo worktree. Resolved identically to prior plans: created a nested `git worktree` rooted at `.claude/worktrees/agent-ab43e3b8a8d2321b7/frontend`, branch `worktree-agent-ab43e3b8a8d2321b7-frontend`, off `frontend`'s current `master` (which already includes Plan 04's merged commits, confirmed via `git log`). `node_modules` symlinked from the primary `frontend/` checkout after confirming identical `package-lock.json` (byte-for-byte `diff` match), avoiding a redundant `npm install`.

**Flagging for the orchestrator:** the `frontend` sub-repo commits (`bd665b9`, `73cccb9`, `2a2685b`) live on branch `worktree-agent-ab43e3b8a8d2321b7-frontend` inside the `frontend` sub-repo and need to be merged into `frontend`'s `master` alongside this monorepo worktree's merge — same handling as Plans 01-04's sub-repo branches.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three PLAN-04/PLAN-05/PLAN-08 frontend gated surfaces are now live: Board Registrations, client-invite (hidden on Free per D-04), and Domains.
- `ConnectBoardDialog.tsx` unchanged (verified via `git diff --stat` — zero diff) — backend (Plan 01) remains the sole board-list filter, per D-02/Pitfall 4.
- No blockers. Plan 06 (Account Calendar tab, PLAN-07) can proceed independently — it consumes the backend `calendar_sync_available` boolean per D-06, not `hasPlanCapability(plan, 'calendarSync')`, and does not depend on any of this plan's three surfaces.

---
*Phase: 37-free-tier-gating*
*Completed: 2026-07-21*
