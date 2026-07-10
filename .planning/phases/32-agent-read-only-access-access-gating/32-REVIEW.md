---
phase: 32-agent-read-only-access-access-gating
reviewed: 2026-07-10T19:40:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - frontend/src/assets/rbac/permissions.ts
  - frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.test.tsx
  - frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx
  - frontend/src/components/sidenav/SideNav.test.tsx
  - frontend/src/components/sidenav/SideNav.tsx
  - frontend/src/components/sidenav/useSideNavContext.ts
  - frontend/src/components/view/admin/domainsAdminView/DomainCard.test.tsx
  - frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx
  - frontend/src/components/view/admin/usersAdminView/InvitationsView.test.tsx
  - frontend/src/components/view/admin/usersAdminView/InvitationsView.tsx
  - frontend/src/components/view/admin/usersAdminView/UsersListView.test.tsx
  - frontend/src/components/view/admin/usersAdminView/UsersListView.tsx
  - frontend/src/containers/adminBoard/usersAdminBoard/UsersAdminBoard.test.tsx
  - frontend/src/containers/adminBoard/usersAdminBoard/UsersAdminBoard.tsx
  - frontend/src/containers/adminBoard/usersAdminBoard/memberAdminBoard/MemberAdminBoard.test.tsx
  - frontend/src/containers/adminBoard/usersAdminBoard/memberAdminBoard/MemberAdminBoard.tsx
  - frontend/src/router/admin/admin.tsx
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 32: Code Review Report

**Reviewed:** 2026-07-10T19:40:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the frontend RBAC read/write gating changes that give the `agent` role read-only
visibility into Brokerage, Boards, Users, Domains, and Settings while keeping every mutation
control locked to `owner`/`admin`. I traced every `<Can permission="...">` gate in the
component tree against `ROLE_PERMISSIONS` in `permissions.ts`, and cross-checked every
component-level gate against the corresponding `admin.tsx` route-level `RequireRole` gate
(`readTierRoles` vs `ownerAdminOnly`).

**No mutation control leaks to `agent` in the reviewed files.** Every write-capable button
("Add Admin to Brokerage", user row Edit/Delete, invitation Revoke, "Manage Account",
"Remove from group", Domains "Verify now"/"Set as primary"/"Delete"/"Upgrade plan") is
correctly gated behind `manage_users` or `manage_brokerage_settings`, neither of which
`agent` holds, and the two pure-mutation routes (`brokerage/add-agent`,
`users/members/:memberId/edit`) are additionally locked at the route level via
`RequireRole roles={['owner','admin']}`, so a direct URL/bookmark bypass of the hidden UI
still redirects. I ran the full test suite for these files (27 tests, 8 files) and all pass;
the tests genuinely exercise the real `usePermission`/`hasPermission` logic (role is set via
Redux preloaded state, not mocked away), so they're meaningful regression guards, not
tautologies.

I found one inconsistency worth fixing (a nav-visibility gate that exists on the subdomain
side but is entirely absent on the main-domain side) and three lower-severity
gaps — a documented-but-untested capability change, a misleading handler name, and a
known-accepted data-exposure gap that's worth surfacing here for visibility even though it
was already deliberated in planning docs.

## Warnings

### WR-01: PortalAdminSideNav renders the full admin nav with zero permission/role check

**File:** `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx:14-45`
**Issue:** `SideNav.tsx` (subdomain) wraps its entire "Admin" nav section in
`{state.canAccessAdmin && (...)}` (`SideNav.tsx:199`), where `canAccessAdmin` is
`usePermission('access_admin_panel')`. `PortalAdminSideNav.tsx` (main domain) has no
equivalent check at all — it unconditionally renders all 6 admin nav items
(`items.map(...)`) to any component that mounts `PortalAdminShell`. The only gate protecting
`/admin/*` content on the main domain is `RequireRole roles={['owner','admin','agent']}`
wrapped around the `<Outlet/>` in `PortalAdminShell.tsx`, not around `PortalAdminSideNav`
itself:
```tsx
<PortalAdminSideNav />
<main className="flex flex-1 flex-col overflow-hidden">
    <RequireRole roles={['owner', 'admin', 'agent']}>
        <Outlet />
    </RequireRole>
</main>
```
Because `admin.tsx` is reachable from the main domain behind only `ProtectedRoute` +
`RequireBrokerageContext` (see `router/main.tsx:57-63`), any authenticated user with an
active brokerage context — including roles that hold **zero** admin permissions
(`staff`, `client`) — who lands on `/admin/*` on the main domain will see the full
6-item admin navigation (Brokerage, Board Registrations, Users, Groups, Domains, Settings)
even though clicking through redirects them away via `RequireRole` on the `Outlet`. This
doesn't leak any data (the content itself stays protected), but it's an inconsistency
between the two nav implementations reviewed in this same phase, and it advertises the
admin surface/structure to users who have no business seeing it. This file was directly
touched in this phase (`a5bb329` removed the last remaining role check —
`isGroupsOnlyRole` — from this component), so the gap is squarely in scope even though the
underlying "no gate at all" condition predates this phase.
**Fix:** Mirror `SideNav.tsx`'s pattern — gate the nav on `access_admin_panel`:
```tsx
import usePermission from '@/store/hooks/Auth/usePermission'
// ...
const canAccessAdmin = usePermission('access_admin_panel')
const visibleItems = canAccessAdmin ? items : []
```
or hide `PortalAdminSideNav` entirely (return `null`) when `!canAccessAdmin`, consistent
with how `SideNav.tsx` treats its own Admin section.

## Info

### IN-01: DomainCard.test.tsx has no regression test for admin's now-lost Domains mutation access

**File:** `frontend/src/components/view/admin/domainsAdminView/DomainCard.test.tsx`
**Issue:** The ACCESS-08 fix (`6468d47`) changed "Verify now" and "Upgrade plan" from
`permission="access_admin_panel"` to `permission="manage_brokerage_settings"`. Since
`ROLE_PERMISSIONS.admin` does not include `manage_brokerage_settings` (only `owner` does),
this change — correctly, per the planning docs' explicit, deliberated decision — also
silently removes `admin`'s previous ability to trigger domain verification and plan
upgrades, not just `agent`'s. The test file only asserts `agent` (hidden) and `owner`
(shown); there is no assertion proving `admin` is also hidden. Because this is an
intentional-but-consequential permission narrowing for a role (`admin`) that wasn't the
target of this phase's requirement, a regression test is the only thing that would catch
someone accidentally reverting `manage_brokerage_settings` back to a broader permission
(or vice versa, re-widening it) without realizing `admin`'s behavior is affected.
**Fix:** Add a test asserting `admin` does NOT see "Verify now"/"Upgrade plan", explicitly
documenting the intended (already-decided) behavior in the test suite itself:
```tsx
it('does not render "Verify now" for admin on a pending domain (manage_brokerage_settings is owner-only)', () => {
    renderWithProviders(
        <DomainCard domain={pendingDomain} actions={actions} onDelete={vi.fn()} />,
        { preloadedState: stateForRole('admin') }
    )
    expect(screen.queryByText('Verify now')).not.toBeInTheDocument()
})
```

### IN-02: Misleading handler name in UsersListView.tsx row click target

**File:** `frontend/src/components/view/admin/usersAdminView/UsersListView.tsx:56-58, 182`
**Issue:** The entire user row has `onClick={() => handleEditUser(u.id)}` (line 182), and
`handleEditUser` navigates to `/admin/users/members/${userId}` — the **read-only** member
detail route (`MemberAdminBoard`, gated `readTierRoles` and reachable by `agent`), not an
edit route. The actual edit-capable "Manage Account" flow lives at
`/admin/users/members/${memberId}/edit` and is a separate, `manage_users`-gated action
inside `MemberAdminBoard.tsx`. This isn't a permission leak (the target route is correctly
read-only and route-gated), but the name `handleEditUser` is misleading in a file that this
phase specifically hardened for RBAC — a future maintainer skimming for "edit" actions to
gate could reasonably assume this row-click handler needs a `Can` wrapper too, or conversely
assume the visible `Pencil` button (also named/labelled "Edit user", also calling
`handleEditUser`) does something different from the row click when in fact they're
identical.
**Fix:** Rename to something accurate, e.g. `handleViewMember` / `handleRowClick`, to
decouple it from "edit" semantics:
```ts
const handleViewMember = (userId: string) => {
    navigate(`/admin/users/members/${userId}`)
}
```

### IN-03: Brokerage-level invitation data is still fetched for `agent`, only its rendering is suppressed

**File:** `frontend/src/containers/adminBoard/usersAdminBoard/UsersAdminBoard.tsx:33-43`
**Issue:** `UsersAdminBoard.tsx` correctly wraps the entire `<InvitationsView>` render in
`<Can permission="manage_users">`, satisfying ACCESS-07's "no view" requirement in the DOM.
However, the underlying data fetch (`useFetchBrokerageInvitations`, called unconditionally
inside `useBrokerageUsersAdminContext` in the sibling `useUsersAdminContext.tsx`) is not
skipped for `agent` — the network request still fires and the response (invitee emails,
statuses, invite dates) lands in the React Query cache/devtools regardless of role. This
matches a risk already identified and explicitly accepted in this phase's own planning
docs (`32-03-PLAN.md`, risk `T-32-03-01`), so it is not a new or overlooked defect, but it's
worth restating here because it means ACCESS-07 is enforced only at the render layer, not
the fetch layer — a determined agent inspecting network traffic or the React Query devtools
extension can still see the brokerage-level invitations list the requirement says they
should have "no view" of.
**Fix (if/when product wants a true zero-fetch guarantee, not required by this phase's
accepted scope):** Gate the query itself, e.g.
```ts
const canViewInvitations = usePermission('manage_users')
const invitationsQuery = useFetchBrokerageInvitations(
    { status: inviteFilter, pagination: { page: invitationsPage } },
    { enabled: canViewInvitations }
)
```

---

_Reviewed: 2026-07-10T19:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
