---
phase: 32-agent-read-only-access-access-gating
plan: 03
subsystem: ui
tags: [react, rbac, admin, users, invitations]

# Dependency graph
requires:
  - phase: 32-agent-read-only-access-access-gating
    plan: 01
    provides: readTierRoles route tier opening /admin/users and /admin/users/members/:memberId to agent — these controls would otherwise 403 on click once agent can reach the pages
  - phase: 32-agent-read-only-access-access-gating
    plan: 02
    provides: full 6-item Admin nav visible to agent — Users nav item now reachable, making this plan's gating necessary
provides:
  - "UsersListView.tsx: 'Add Admin to Brokerage' dropdown item and row Edit/Delete buttons gated by manage_users; 'Add User to Group' stays visible per D-01"
  - "InvitationsView.tsx: Revoke invitation button gated by manage_users"
  - "UsersAdminBoard.tsx: entire InvitationsView render gated by manage_users, closing the ACCESS-07 'no view' gap left by gating only the Revoke button"
  - "MemberAdminBoard.tsx: Manage Account button gated by manage_users; onRemoveUserFromGroup withheld from MemberGroupsList when agent lacks manage_users"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prop-level gate (Fix Option A): parent container computes usePermission('manage_users') and passes undefined instead of the real callback, reusing a child component's existing prop-truthiness conditional-render guard with zero changes inside the child"

key-files:
  created:
    - frontend/src/components/view/admin/usersAdminView/UsersListView.test.tsx
    - frontend/src/components/view/admin/usersAdminView/InvitationsView.test.tsx
    - frontend/src/containers/adminBoard/usersAdminBoard/UsersAdminBoard.test.tsx
    - frontend/src/containers/adminBoard/usersAdminBoard/memberAdminBoard/MemberAdminBoard.test.tsx
  modified:
    - frontend/src/components/view/admin/usersAdminView/UsersListView.tsx
    - frontend/src/components/view/admin/usersAdminView/InvitationsView.tsx
    - frontend/src/containers/adminBoard/usersAdminBoard/UsersAdminBoard.tsx
    - frontend/src/containers/adminBoard/usersAdminBoard/memberAdminBoard/MemberAdminBoard.tsx

key-decisions:
  - "Gated the entire <InvitationsView> render (not just its Revoke button) in UsersAdminBoard.tsx — CONTEXT.md's note only named the Revoke button, but ACCESS-07 requires agent have no view of brokerage-level invitations at all; gating only the button would still leak the full pending-invitations table (emails, statuses, dates) once 32-01 opened /admin/users to agent"

patterns-established: []

requirements-completed: [ACCESS-02, ACCESS-07]

# Metrics
duration: 20min
completed: 2026-07-10
---

# Phase 32 Plan 03: Users/Invitations/Member Detail Mutation Gating Summary

**Gated every previously-ungated mutation control on the Users list, brokerage invitations view, and member detail page behind `manage_users`, including a full `<InvitationsView>` render gate that closes an ACCESS-07 "no view" gap the plan's own CONTEXT.md under-specified.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-10 (approx)
- **Completed:** 2026-07-10
- **Tasks:** 3 completed
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments
- `UsersListView.tsx`: "Add Admin to Brokerage" dropdown item and the per-row Edit/Delete icon button group both hidden from agent via `<Can permission="manage_users">`; "Add User to Group" stays visible for agent per D-01 (maps to `manage_groups`, which agent has)
- `InvitationsView.tsx`: "Revoke invitation" button hidden from agent (defense in depth for admin/owner-only mutation)
- `UsersAdminBoard.tsx`: entire `<InvitationsView>` element wrapped in `<Can permission="manage_users">` — agent now sees zero brokerage-level invitation UI (no table, no emails, no statuses, no dates), not just a disabled Revoke button. This closes the actual ACCESS-07 "no view, no create" requirement.
- `MemberAdminBoard.tsx`: "Manage Account" button hidden from agent via `<Can>`; `onRemoveUserFromGroup` prop passed to `MemberGroupsList` conditionally on `usePermission('manage_users')` — reuses `MemberGroupsList`'s existing `{onRemoveUserFromGroup && (...)}` truthiness guard with zero changes inside that file
- 4 new test files (10 tests total) proving agent vs. admin visibility for every gated control; all TDD RED states confirmed against pre-fix code before applying each fix

## Task Commits

Each task was committed atomically (frontend sub-repo), following TDD RED/GREEN:

1. **Task 1: Gate UsersListView.tsx's Add Admin dropdown item and row Edit/Delete buttons** - `ccd1746` (test, RED), `4e62c62` (feat, GREEN)
2. **Task 2: Gate InvitationsView.tsx's Revoke button AND hide entire Invitations view in UsersAdminBoard.tsx** - `d5b9306` (test, RED), `c42b330` (feat, GREEN)
3. **Task 3: Gate MemberAdminBoard.tsx's Manage Account button and withhold Remove-from-group** - `8fae69e` (test, RED), `eb9f890` (feat, GREEN)

**Plan metadata:** committed separately at monorepo root (see final commit below)

## Files Created/Modified
- `frontend/src/components/view/admin/usersAdminView/UsersListView.tsx` - Added `Can` import; wrapped "Add Admin to Brokerage" dropdown item and the row Edit/Delete button group in `<Can permission="manage_users">`
- `frontend/src/components/view/admin/usersAdminView/UsersListView.test.tsx` (new) - 4 tests: agent sees only "Add User to Group" in dropdown and no row Edit/Delete buttons; admin sees both dropdown items and both row buttons
- `frontend/src/components/view/admin/usersAdminView/InvitationsView.tsx` - Added `Can` import; wrapped the Revoke `<Button>` in `<Can permission="manage_users">`
- `frontend/src/components/view/admin/usersAdminView/InvitationsView.test.tsx` (new) - 2 tests: agent sees no Revoke button on a pending invite; admin sees it
- `frontend/src/containers/adminBoard/usersAdminBoard/UsersAdminBoard.tsx` - Added `Can` import; wrapped the entire `<InvitationsView .../>` element in `<Can permission="manage_users">`
- `frontend/src/containers/adminBoard/usersAdminBoard/UsersAdminBoard.test.tsx` (new) - 2 tests (mocking `useBrokerageUsersAdminContext`, `useDeleteBrokerageInvitation`, `useDeleteUserFromBrokerage`): agent sees no "Invitations" heading anywhere on the page even with a pending invite in state; admin sees it
- `frontend/src/containers/adminBoard/usersAdminBoard/memberAdminBoard/MemberAdminBoard.tsx` - Added `Can` and `usePermission` imports; `canManageUsers = usePermission('manage_users')`; wrapped "Manage Account" button in `<Can>`; changed `onRemoveUserFromGroup` prop to `canManageUsers ? actions.handleRemoveUserFromGroup : undefined`
- `frontend/src/containers/adminBoard/usersAdminBoard/memberAdminBoard/MemberAdminBoard.test.tsx` (new) - 2 tests (mocking `./MemberAdminBoardContext`): agent sees no Manage Account button and no Remove from group button; admin sees both

## Decisions Made
- **Full `<InvitationsView>` gate, not just the Revoke button:** CONTEXT.md's note only called out gating the Revoke button "for consistency." During Task 2 analysis (matching the plan's own objective section, which flagged this same gap), gating only the button would still let agent see the complete pending-invitations table — emails, group assignments, sent dates, statuses — once 32-01 opens `/admin/users` to agent's read tier. ACCESS-07 requires "no view, no create," not "no mutate." Wrapped the entire `<InvitationsView>` render in `UsersAdminBoard.tsx` instead, fully closing the gap. This was explicitly directed by the plan text itself (not a deviation) — documented here because it's the single most consequential decision in this plan.

## Deviations from Plan

None - plan executed exactly as written, including the ACCESS-07 gap-closing fix that the plan's own objective/action sections explicitly directed (not an unplanned deviation).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three plans in Phase 32 (32-01 route access, 32-02 nav expansion, 32-03 mutation gating) are complete
- Agent now has correctly-scoped read-only access across Users, Brokerage, Boards, Domains, and Settings, with zero mutation controls visible and zero visibility into brokerage-level invitations
- Admin/owner retain full CRUD on every touched surface — verified unchanged via passing tests
- ACCESS-02 and ACCESS-07 fully satisfied
- Ready for phase-level verification (`/gsd-verify-work`)
- No blockers identified

---
*Phase: 32-agent-read-only-access-access-gating*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: frontend/src/components/view/admin/usersAdminView/UsersListView.tsx
- FOUND: frontend/src/components/view/admin/usersAdminView/UsersListView.test.tsx
- FOUND: frontend/src/components/view/admin/usersAdminView/InvitationsView.tsx
- FOUND: frontend/src/components/view/admin/usersAdminView/InvitationsView.test.tsx
- FOUND: frontend/src/containers/adminBoard/usersAdminBoard/UsersAdminBoard.tsx
- FOUND: frontend/src/containers/adminBoard/usersAdminBoard/UsersAdminBoard.test.tsx
- FOUND: frontend/src/containers/adminBoard/usersAdminBoard/memberAdminBoard/MemberAdminBoard.tsx
- FOUND: frontend/src/containers/adminBoard/usersAdminBoard/memberAdminBoard/MemberAdminBoard.test.tsx
- FOUND: .planning/phases/32-agent-read-only-access-access-gating/32-03-SUMMARY.md
- FOUND commit: ccd1746
- FOUND commit: 4e62c62
- FOUND commit: d5b9306
- FOUND commit: c42b330
- FOUND commit: 8fae69e
- FOUND commit: eb9f890
