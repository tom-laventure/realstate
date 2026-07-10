# Phase 32: Agent Read-Only Access & Access Gating - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Give `agent` correctly-scoped **read-only** visibility into Users, Brokerage, Boards, Domains, and brokerage Settings — without exposing any control that would 403 on click. Fully block agent from the brokerage-level staff/agent invitation flow (no view, no create). Fix a pre-existing gating bug on Domains where two buttons check the too-broad `access_admin_panel` instead of `manage_brokerage_settings`.

Backend already grants `agent` 2xx on all the relevant read endpoints (`users#index/show`, `brokerages#show`, `domains#index/verify`, `boards#index`, `board_credentials#index`, `activity#stats/index` — confirmed in Phase 30 CONTEXT.md). This phase is entirely frontend: route access, component-level mutation gating, and nav exposure.

In scope:
- Route access: open Brokerage, Boards, Users, Users/members/:id (detail view), Domains, Settings, Users/add-to-group to `agent` (read tier)
- Component-level mutation gating for controls that currently have **zero** permission gating (only route-locked): Users list ("Add Admin to Brokerage" dropdown item, per-row Edit/Delete icons), user detail page ("Manage Account" button, "Remove from group" action)
- ACCESS-08 fix: `DomainCard.tsx` "Verify now" and "Upgrade plan" buttons move from `access_admin_panel` to `manage_brokerage_settings`
- Nav expansion: `SideNav.tsx` and `PortalAdminSideNav.tsx` show the full 6-section Admin nav for agent (remove the Groups-only restriction added in Phase 31 D-03)
- Keep `/admin/brokerage/add-agent` and `/admin/users/members/:memberId/edit` fully owner/admin-only (route-level block, not just hidden controls)

Out of scope (locked by REQUIREMENTS.md):
- `staff` role, new granular `Permission` values
- A dedicated read-only view for brokerage-level pending invitations — invitations stay fully blocked, not partially visible

</domain>

<decisions>
## Implementation Decisions

### Users page mutation gating
- **D-01:** The "Add User" dropdown on the Users list keeps its "Add User to Group" item visible for agent — it maps to `manage_groups`, which agent already has from Phase 31, just reached via a different entry point (group-picker) than the group-scoped flow. Only "Add Admin to Brokerage" is hidden for agent.
- **D-02:** Since "Add User to Group" stays visible for agent, `/admin/users/add-to-group` (`AddUserToGroupSelectAdminBoard`) must move to the read/agent route tier too — otherwise the visible dropdown item would 403/redirect on click.
- **D-03:** Gate "Add Admin to Brokerage" (dropdown item), the per-row Edit/Delete icon buttons in `UsersListView.tsx`, the "Manage Account" button in `MemberAdminBoard.tsx`, and the "Remove from group" action in `MemberGroupsList.tsx` (when rendered from the detail view, not the edit view) all on `manage_users` — the same permission that already distinguishes `admin` from `agent` in `ROLE_PERMISSIONS`. Use the `<Can permission="manage_users">` hide-entirely pattern (matches the dominant pattern used in Boards/Brokerage/Domains — not the disabled-button pattern used in `EditMemberView.tsx`), since ACCESS-02 says agent "sees no edit or delete controls," implying invisible, not disabled.
- Note: `InvitationsView.tsx`'s "Revoke invitation" button has the same zero-gating issue — gate it the same way (`manage_users`) for consistency, even though not explicitly named in the discussion.

### ACCESS-08 fix scope
- **D-04:** Both `DomainCard.tsx` buttons currently gated by `access_admin_panel` — "Verify now" and "Upgrade plan" — move to `manage_brokerage_settings`. Even though the backend already permits agent to call `domains#verify` (Phase 30 RBAC-02), ACCESS-05 says agent gets "no mutation actions" on Domains at all; showing a button that re-triggers DNS verification reads as a mutation control regardless of backend permissiveness.

### Nav exposure
- **D-05:** `SideNav.tsx` (subdomain) and `PortalAdminSideNav.tsx` (main-domain) expand to show all 6 Admin sections (Brokerage, Boards, Users, Groups, Domains, Settings) for agent — removes the Groups-only restriction from Phase 31 D-03, which explicitly deferred this expansion to Phase 32.
- **D-06:** `isGroupsOnlyRole` (in `permissions.ts`) and `isGroupsOnlyAdmin` (in `useSideNavContext.ts`) become dead code once D-05 lands — grep confirms they're used in exactly these 4 files (`permissions.ts`, `useSideNavContext.ts`, `SideNav.tsx`, `PortalAdminSideNav.tsx`), all tied to the restriction being removed. Delete them rather than leaving unused exports, per CLAUDE.md's no-dead-code guidance.

### Route restructuring (Claude's discretion, mechanically derived from requirements)
- Read tier (`['owner', 'admin', 'agent']`): `/admin/brokerage`, `/admin/boards`, `/admin/users`, `/admin/users/members/:memberId` (detail view only), `/admin/users/add-to-group` (per D-02), `/admin/domains`, `/admin/settings`
- Write-only tier (`['owner', 'admin']`, unchanged): `/admin/brokerage/add-agent`, `/admin/users/members/:memberId/edit`
- Exact mechanism (e.g. two role-list constants replacing the single `ownerAdminOnly` helper in `admin.tsx`, or a second `readTierRoles` wrapper) — implementation detail.

### Claude's Discretion
- Whether to keep `ownerAdminOnly` as a named helper for the write-only tier or rename it now that it's no longer "all non-Groups routes."
- Exact prop/component wiring for how `MemberAdminBoard.tsx` passes (or withholds) `onRemoveUserFromGroup` to `MemberGroupsList` based on `manage_users` — could gate at the callback level or wrap the rendered button, either matches existing patterns.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Role & access-control reference
- `.planning/ROLES.md` — role definitions, current enforcement state, known gaps

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — ACCESS-02 through ACCESS-08 (this phase's requirements); Out of Scope table (no new `Permission` values, `staff` role, agent visibility into brokerage-level invitations)
- `.planning/ROADMAP.md` — Phase 32 goal and success criteria; dependency on Phase 30 (backend) and Phase 31 (dashboard/nav access)

### Prior phase context
- `.planning/phases/30-backend-rbac-enforcement/30-CONTEXT.md` — confirms backend already grants `agent` 2xx on `users#index/show`, `brokerages#show`, `domains#index/verify`, `boards#index`, `board_credentials#index`, `activity#stats/index` — no backend work needed this phase
- `.planning/phases/31-agent-dashboard-access-group-management/31-CONTEXT.md` — D-03 explicitly deferred nav expansion to this phase; establishes `ROLE_PERMISSIONS.agent = ['access_admin_panel', 'manage_groups']` and the `isGroupsOnlyRole` mechanism this phase removes

No other external specs/ADRs — requirements fully captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/components/common/guards/Can.tsx` + `frontend/src/assets/rbac/permissions.ts` — the established hide-entirely gating pattern (`<Can permission="...">`). Already used correctly in `BoardRegistrations.tsx` ("Connect Board" button + row-actions dropdown, both gated `manage_brokerage_settings`) and `BrokerageInformation.tsx`/`BrokerageBranding.tsx` (save controls, `manage_brokerage_settings`) — these pages need **no changes**, they already do the right thing.
- `frontend/src/router/admin/admin.tsx` — the `ownerAdminOnly` helper (`<RequireRole roles={['owner', 'admin']}>`) currently wraps every non-Groups route uniformly; this phase splits it into two tiers.
- `frontend/src/components/view/admin/usersAdminView/memberAdminView/EditMemberView.tsx` — already has a `canManageUsers = usePermission('manage_users')` pattern (disabled-button style) for the role-select and delete-member controls on the **edit** page. That page stays owner/admin-only (route-blocked), so it needs no changes — but confirms `manage_users` is the correct permission name to reuse for D-03/D-04's new gates.

### Established Patterns
- Frontend guards are UX-only; backend 403 is the real security boundary (reaffirmed in Phase 30/31 CONTEXT.md). All backend endpoints referenced here already enforce the correct boundary — this phase is purely about not showing agent controls that would fail.
- `admin.tsx` route-level `RequireRole` gating (added in the Phase 31 code-review-fix) is the pattern for blocking entire pages; `<Can permission="...">` is the pattern for blocking individual controls within an otherwise-accessible page. This phase uses both: route-level for `/admin/brokerage/add-agent` and `/admin/users/members/:memberId/edit` (agent should never reach these at all, consistent with ACCESS-07's "no view, no create"), component-level `Can` for everything else.

### Integration Points
- `frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx` (lines ~148, ~189) — the two `access_admin_panel`-gated buttons for D-04.
- `frontend/src/components/view/admin/usersAdminView/UsersListView.tsx` — Add User dropdown (lines ~84-100), per-row Edit/Delete buttons (lines ~204-222) — currently zero gating.
- `frontend/src/components/view/admin/usersAdminView/InvitationsView.tsx` — Revoke button (line ~136) — currently zero gating.
- `frontend/src/containers/adminBoard/usersAdminBoard/memberAdminBoard/MemberAdminBoard.tsx` — "Manage Account" button (line ~38).
- `frontend/src/components/view/admin/usersAdminView/memberAdminView/MemberGroupsList.tsx` — "Remove from group" button, conditionally rendered based on whether `onRemoveUserFromGroup` prop is passed by the parent.
- `frontend/src/components/sidenav/SideNav.tsx` (lines ~216-262, `state.isGroupsOnlyAdmin` checks) and `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx` (`isGroupsOnlyRole(role)` filter) — both need their Groups-only restriction removed per D-05/D-06.
- `frontend/src/components/sidenav/useSideNavContext.ts` — exposes `isGroupsOnlyAdmin`, becomes dead code per D-06.
- `frontend/src/assets/rbac/permissions.ts` — `isGroupsOnlyRole` export, becomes dead code per D-06.

</code_context>

<specifics>
## Specific Ideas

No UI mockups or visual references provided. All decisions were resolved through direct codebase scouting (which controls are already correctly gated vs. which have zero gating) plus three targeted questions on ambiguous product judgment calls (Add-to-Group visibility, ACCESS-08 exact scope, nav expansion).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. `staff` role and new `Permission` values remain Out of Scope per REQUIREMENTS.md, not raised as new ideas here.

</deferred>

---

*Phase: 32-Agent Read-Only Access & Access Gating*
*Context gathered: 2026-07-10*
