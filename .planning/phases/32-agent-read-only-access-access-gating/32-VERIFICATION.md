---
phase: 32-agent-read-only-access-access-gating
verified: 2026-07-10T12:35:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Sign in as a real `agent` user (Cognito) and directly navigate (URL bar, not nav clicks) to /admin/brokerage, /admin/boards, /admin/users, /admin/users/members/:memberId, /admin/domains, /admin/settings"
    expected: "All six routes render their content with no redirect; /admin/brokerage/add-agent and /admin/users/members/:memberId/edit redirect to /"
    why_human: "Automated tests exercise RequireRole/usePermission against synthetic Redux preloadedState, not the real useRole() resolution path against a live Cognito-authenticated session (subdomain vs main-domain role source, JWT claims, activeBrokerage lookup) — a live browser check confirms the wiring end-to-end."
  - test: "Sign in as a real `agent` user and visually inspect the Users list, a member detail page, the Domains page, and /admin/users' Invitations area"
    expected: "No Edit/Delete icons on user rows, no 'Add Admin to Brokerage' dropdown item, no 'Manage Account' button, no 'Remove from group' action, no Invitations section at all, and no 'Verify now'/'Set as primary'/'Delete'/'Upgrade plan' buttons on any domain card"
    why_human: "Visual/UX confirmation of hidden-vs-rendered state in a live session complements (but is not replaced by) the unit-level getByText/queryByText assertions already passing in the test suite."
---

# Phase 32: Agent Read-Only Access & Access Gating Verification Report

**Phase Goal:** An `agent` has correctly scoped read-only visibility into brokerage-wide admin surfaces, is fully blocked from brokerage-level staff invitations, and never sees a mutation control that would 403.
**Verified:** 2026-07-10T12:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Agent can view Users list and user detail pages but sees no edit/delete controls | ✓ VERIFIED | `UsersListView.tsx` wraps row Edit/Delete buttons and "Add Admin to Brokerage" in `<Can permission="manage_users">` (lines 94-98, 206-228); `MemberAdminBoard.tsx` wraps "Manage Account" in `<Can permission="manage_users">` and passes `onRemoveUserFromGroup={canManageUsers ? actions.handleRemoveUserFromGroup : undefined}` (line 64), which `MemberGroupsList.tsx`'s existing `{onRemoveUserFromGroup && (...)}` guard hides entirely for agent. `ROLE_PERMISSIONS.agent` lacks `manage_users`. 4 tests (UsersListView) + 2 tests (MemberAdminBoard) pass. |
| 2 | Agent can view Brokerage settings (info, branding, board registrations) and Boards/board credentials but sees no create/update/delete controls | ✓ VERIFIED | Not touched by Phase 32 (pre-existing correct gating confirmed by direct read): `BrokerageInformation.tsx`, `BrokerageBranding.tsx`, `BoardRegistrations.tsx` all wrap Edit/Connect/Delete controls in `<Can permission="manage_brokerage_settings">`, which agent lacks. Route access opened via `readTierRoles` in `admin.tsx` (`/admin/brokerage`, `/admin/boards`). |
| 3 | Agent can view Domains and the brokerage Settings page but sees no mutation actions | ✓ VERIFIED | `DomainCard.tsx`'s "Verify now" and "Upgrade plan" gates changed from `access_admin_panel` to `manage_brokerage_settings` (grep: 4/4 gates now `manage_brokerage_settings`, 0 `access_admin_panel`). `DomainCardList.tsx`'s "Add domain" button already gated by `manage_brokerage_settings`. `/admin/settings` (`SettingsAdminBoard.tsx`) is a static placeholder with zero controls — vacuously satisfies "no mutation actions" (pre-existing, not a Phase 32 regression). Route access via `readTierRoles`. |
| 4 | Agent has no way to view or reach the brokerage-level staff/agent invitation flow — no nav entry, no direct route access | ✓ VERIFIED | `UsersAdminBoard.tsx` wraps the entire `<InvitationsView>` element in `<Can permission="manage_users">` — agent gets zero DOM presence of the invitations table (closes the "no view" gap CONTEXT.md under-specified). Route `/admin/brokerage/add-agent` stays on `ownerAdminOnly` (`roles={['owner','admin']}`) in `admin.tsx`, confirmed via grep and file read. |
| 5 | Domain-mutation buttons are gated by `manage_brokerage_settings` only, so agent never sees an action button that would 403 on click | ✓ VERIFIED | `grep -c 'permission="access_admin_panel"' DomainCard.tsx` returns 0; `grep -c 'permission="manage_brokerage_settings"'` returns 4 (Verify now, Set as primary, Delete, Upgrade plan). |

**Score:** 5/5 truths verified

### Plan-Level Must-Haves (from PLAN frontmatter)

| Plan | Must-have | Status | Evidence |
|------|-----------|--------|----------|
| 32-01 | `readTierRoles` opens 6 routes; `ownerAdminOnly` stays on 2 write routes | ✓ VERIFIED | `admin.tsx`: `grep -c "readTierRoles("` = 7 (incl. helper def), `grep -c "ownerAdminOnly("` = 2 (add-agent, edit-member) |
| 32-01 | DomainCard buttons gated by `manage_brokerage_settings` not `access_admin_panel` | ✓ VERIFIED | Confirmed via direct file read and grep, above |
| 32-02 | Agent sees all 6 SideNav/PortalAdminSideNav items | ✓ VERIFIED | `SideNav.tsx` Admin section renders all 6 `NavButton`s unconditionally once `state.canAccessAdmin` is true (no per-item role check); `PortalAdminSideNav.tsx` renders `items.map(...)` directly with no filter |
| 32-02 | `isGroupsOnlyRole`/`isGroupsOnlyAdmin` fully deleted | ✓ VERIFIED | `grep -rn "isGroupsOnlyRole\|isGroupsOnlyAdmin" frontend/src` → no matches |
| 32-03 | UsersListView/InvitationsView/UsersAdminBoard/MemberAdminBoard gated by `manage_users` | ✓ VERIFIED | All four files read directly; `Can permission="manage_users"` present in each at the correct wrap points |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/router/admin/admin.tsx` | Two-tier RequireRole gating | ✓ VERIFIED | `readTierRoles`/`ownerAdminOnly` helpers present, correctly applied per-route |
| `frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx` | Buttons gated by `manage_brokerage_settings` | ✓ VERIFIED | 4/4 gates correct, 0 `access_admin_panel` remaining |
| `frontend/src/components/sidenav/SideNav.tsx` | All 6 Admin items render unconditionally | ✓ VERIFIED | No `isGroupsOnlyAdmin` references; unconditional `NavButton`s |
| `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx` | Full items array, no role filter | ✓ VERIFIED (see WARNING) | `items.map(...)` direct render — but also has **zero** permission/role check of its own (see Anti-Patterns/Warnings) |
| `frontend/src/components/view/admin/usersAdminView/UsersListView.tsx` | Dropdown + row actions gated by `manage_users` | ✓ VERIFIED | 2 `Can permission="manage_users"` gates present, "Add User to Group" stays unwrapped (D-01) |
| `frontend/src/containers/adminBoard/usersAdminBoard/UsersAdminBoard.tsx` | Entire InvitationsView gated by `manage_users` | ✓ VERIFIED | `<Can permission="manage_users"><InvitationsView .../></Can>` |
| `frontend/src/containers/adminBoard/usersAdminBoard/memberAdminBoard/MemberAdminBoard.tsx` | Manage Account gated; remove-from-group withheld | ✓ VERIFIED | `<Can>` wrap + conditional prop confirmed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `admin.tsx` | `RequireRole.tsx` | `roles={['owner','admin','agent']}` on 7 read routes | ✓ WIRED | Confirmed by direct read of both files |
| `DomainCard.tsx` | `Can.tsx` | `permission="manage_brokerage_settings"` | ✓ WIRED | Confirmed |
| `SideNav.tsx` | `useSideNavContext.ts` | `state.canAccessAdmin` gates whole Admin section | ✓ WIRED | `isGroupsOnlyAdmin` fully removed; `canAccessAdmin` unchanged (3 refs) |
| `PortalAdminSideNav.tsx` | `permissions.ts` | `isGroupsOnlyRole` import removed | ✓ WIRED (partial concern) | Import removed as specified, but no `access_admin_panel` gate was added in its place — file plan only required removing the old filter, not adding a new one, so this is plan-compliant but leaves a real-world gap (WR-01) |
| `UsersListView.tsx` | `Can.tsx` | `permission="manage_users"` on dropdown + row actions | ✓ WIRED | Confirmed |
| `UsersAdminBoard.tsx` | `InvitationsView.tsx` | `<Can permission="manage_users">` wraps element | ✓ WIRED | Confirmed |
| `MemberAdminBoard.tsx` | `MemberGroupsList.tsx` | `onRemoveUserFromGroup` conditional prop | ✓ WIRED | Confirmed; child guard reused with zero child-file changes |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All Phase 32 test files pass with real permission logic | `npx vitest run` on 8 touched test files | 8 files, 27 tests, all passed | ✓ PASS |
| No dead-code references remain | `grep -rn "isGroupsOnlyRole\|isGroupsOnlyAdmin" frontend/src` | empty | ✓ PASS |
| DomainCard gates fully migrated | `grep -c 'permission="access_admin_panel"' DomainCard.tsx` | 0 | ✓ PASS |
| All referenced commits exist in frontend sub-repo | `git cat-file -e` on 12 commit hashes from summaries | all 12 present | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ACCESS-02 | 32-01, 32-03 | Agent read-only Users list/detail, no edit/delete | ✓ SATISFIED | UsersListView.tsx, MemberAdminBoard.tsx gates |
| ACCESS-03 | 32-01 | Agent read-only Brokerage settings | ✓ SATISFIED | readTierRoles route + pre-existing manage_brokerage_settings gates |
| ACCESS-04 | 32-01 | Agent read-only Boards/credentials | ✓ SATISFIED | readTierRoles route + pre-existing manage_brokerage_settings gates on BoardRegistrations.tsx |
| ACCESS-05 | 32-01 | Agent read-only Domains, no mutation actions | ✓ SATISFIED | DomainCard.tsx fix (ACCESS-08 overlap) |
| ACCESS-06 | 32-01 | Agent read-only Settings page | ✓ SATISFIED | readTierRoles route; page has no controls |
| ACCESS-07 | 32-03 | Agent fully blocked (no view, no create) from brokerage invitations | ✓ SATISFIED | Entire InvitationsView gated in UsersAdminBoard.tsx |
| ACCESS-08 | 32-01 | Domain-mutation buttons gated by manage_brokerage_settings only | ✓ SATISFIED | DomainCard.tsx 4/4 gates confirmed |

All 7 requirement IDs declared across the three plans (32-01: all 7; 32-02: ACCESS-02 through ACCESS-06; 32-03: ACCESS-02, ACCESS-07) are accounted for in `.planning/REQUIREMENTS.md`, all marked Complete for Phase 32. No orphaned requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `PortalAdminSideNav.tsx` | 14-45 | No `access_admin_panel`/role check gating the nav itself | ⚠️ Warning | Carried forward from code review (WR-01). Does not cause agent to see a mutation control (nav items are links, not mutation buttons), so it does not fail any of the 5 roadmap truths. It does mean any authenticated user with brokerage context — including `staff`/`client`, who hold zero admin permissions — sees the full 6-item admin nav on the main domain before being redirected by `RequireRole` on the `Outlet`. Confirmed independently by reading `PortalAdminShell.tsx` (nav is a sibling of the `RequireRole`-wrapped `Outlet`, not inside it) and `router/main.tsx` (admin route reachable behind only `ProtectedRoute` + `RequireBrokerageContext`, no role gate). Not a regression introduced by this phase's logic changes (D-05/D-06 only removed the old Groups-only filter, they did not add or remove an `access_admin_panel` check — none ever existed here) but is squarely in scope since this file's last remaining role check was removed in this phase (`a5bb329`). |

No blocker-level anti-patterns (TODO/FIXME/stub/placeholder) found in any of the 10 files touched across the three plans.

### Human Verification Required

### 1. Live agent session — direct route access

**Test:** Sign in as a real `agent` user and directly enter each of these URLs: `/admin/brokerage`, `/admin/boards`, `/admin/users`, `/admin/users/members/:memberId`, `/admin/domains`, `/admin/settings`, then `/admin/brokerage/add-agent` and `/admin/users/members/:memberId/edit`.
**Expected:** The first six render their content with no redirect. The last two redirect to `/`.
**Why human:** Automated tests exercise `RequireRole`/`usePermission` against a synthetic Redux `preloadedState`, not the real `useRole()` resolution path against a live Cognito-authenticated session (subdomain-vs-main-domain role source, JWT claims, `activeBrokerage` lookup). A live check confirms the full wiring end-to-end, which unit tests structurally cannot.

### 2. Live agent session — visual mutation-control absence

**Test:** As the same agent session, open the Users list, a member detail page, the Domains page, and `/admin/users`.
**Expected:** No Edit/Delete icons on user rows, no "Add Admin to Brokerage" dropdown item, no "Manage Account" button, no "Remove from group" action, no Invitations section anywhere, and no "Verify now"/"Set as primary"/"Delete"/"Upgrade plan" buttons on any domain card.
**Why human:** Visual/UX confirmation in a live browser session complements the passing unit-level `getByText`/`queryByText` assertions but is not fully substitutable for them given the goal explicitly concerns what a real user *sees*.

### Gaps Summary

No blocking gaps. All 5 roadmap success criteria and all plan-level must-haves are verified directly against the live codebase (not just SUMMARY.md claims): every `<Can>`/`RequireRole` gate described in the three plans was independently located and read in the actual files, all 27 automated tests across the 8 touched test files pass and exercise real `usePermission`/`hasPermission` logic (not mocked), all 12 referenced commits exist in the frontend sub-repo, and dead-code removal (`isGroupsOnlyRole`/`isGroupsOnlyAdmin`) is complete with zero remaining references.

One WARNING carried forward from the code review (WR-01: `PortalAdminSideNav.tsx` has no permission check of its own) is a real, independently-confirmed gap, but it does not cause `agent` to see any mutation control and does not fail any of the phase's 5 success criteria — it is a nav-visibility inconsistency affecting `staff`/`client` roles on the main domain, out of the direct scope of "agent read-only access." Recommend a follow-up fix (mirror `SideNav.tsx`'s `canAccessAdmin` gate) but it should not block phase completion.

Status is `human_needed` rather than `passed` solely because two live-browser checks are recommended to close the loop between synthetic-state unit tests and real Cognito-authenticated sessions — this is standard practice for RBAC UI work, not evidence of an unresolved defect.

---

_Verified: 2026-07-10T12:35:00Z_
_Verifier: Claude (gsd-verifier)_
