# Phase 34: Ownership Management UI — Settings Page & Add Owner - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Build out the `/admin/settings` page — currently a bare stub (`SettingsAdminBoard.tsx` renders only the literal word "Settings") — with its first real section: Ownership Management. Owners get a Current Owners list and an Add Owner flow (searchable dropdown of eligible admin/agent members, warning copy, confirm). Admins and agents get read-only visibility (owner list + role descriptions, no action buttons). Clients have no access to this page at all (existing route guard already handles this).

In scope: SET-01 (page shell + Ownership Management as the only functional section, Billing stubbed as an invisible `# TODO` code comment), SET-02 (owner-only actions, admin/agent read-only, client no-access), OWN-01 (Current Owners list), OWN-02–OWN-05 (Add Owner flow end to end).

Out of scope: Remove Owner (two-step demote modal — Phase 35), Billing functionality (stubbed only), audit logging / email notifications on role change (deferred to v2 per REQUIREMENTS.md).

</domain>

<decisions>
## Implementation Decisions

### Current Owners list
- **D-01:** Render as a simple stacked list — plain rows (name + email) divided by subtle borders, not a table and not cards. Matches the list's typical size (1–3 owners) and avoids table-header or card-padding overhead that a richer/larger dataset would justify.
- **D-02:** No self-indicator. All owner rows render identically — do not add a "You" badge or any marker distinguishing the viewing owner's own entry.

### Add Owner warning copy (OWN-04)
- **D-03:** Do NOT reuse `RolePermissions`' generic "owner" description verbatim for this warning. Write expanded, ownership-specific copy instead — this is a deliberately different (longer, more consequence-focused) text block from the reusable role-description card.
- **D-04:** The expanded warning must cover all three of: (1) the promoted user will be able to remove or demote other owners, (2) they gain full access to all brokerage data and settings (not just their current admin/agent scope), and (3) a forward-looking mention that owners will eventually manage billing too, even though that section is stubbed/invisible this milestone. Exact wording is Claude's discretion at implementation time, but all three points must appear.

### Read-only view for admin/agent (SET-02)
- **D-05:** Reuse the existing `RolePermissions` component (`frontend/src/components/view/admin/common/RolePermissions.tsx`) to satisfy the "role descriptions" requirement — do not build a new, ownership-specific description block.
- **D-06:** Pass `roles={['owner', 'admin', 'agent']}` — exclude `client` from the displayed set, since clients never reach this page at all (blocked by the existing route guard before rendering).
- **D-07:** The `RolePermissions` block is shown ONLY to admin/agent viewers (the read-only audience). Owners do NOT see it — they get the full action UI (Add Owner button, etc.) instead, without the redundant description card.

### Settings page shell
- **D-08:** Ownership Management gets its own card/section header on the `/admin/settings` page (e.g., a labeled "Ownership Management" section), consistent with how Brokerage/Boards/Domains admin pages present their content in labeled sections. This also gives Billing a natural slot to slide in beside it later without restructuring the page.

### Claude's Discretion
- Exact wording of the expanded Add Owner warning copy (D-04 fixes the three required points, not the phrasing).
- Whether the owner-only gate on Add Owner (OWN-02) is implemented via a new `Permission` value (e.g. `manage_ownership`) added to `frontend/src/assets/rbac/permissions.ts` and gated with the existing `<Can>` component, or via a direct `role === 'owner'` check through `useRole()` — follow whichever pattern the researcher/planner finds most consistent with existing conventions (no owner-only permission currently exists in `ROLE_PERMISSIONS`, so this is a natural, in-scope extension either way).
- Loading/error/empty states for the owners list and eligible-list queries (standard project conventions apply — see CLAUDE.md Frontend Philosophy).
- Exact component/file naming for the new Ownership Management section, following `frontend/src/containers/{domain}/{pageName}/` and `frontend/src/components/view/admin/{domain}/` conventions already established.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — SET-01, SET-02, OWN-01–OWN-05 (full acceptance criteria for this phase; already highly specific — treat as close to locked)
- `.planning/ROADMAP.md` — Phase 34 entry, Success Criteria

### Backend API this phase consumes (shipped in Phase 33 — do not re-implement)
- `.planning/phases/33-backend-owner-api-endpoint-lockdown/33-CONTEXT.md` — D-04 (promote is instant, no Invitation record), D-05 (server re-validates target's current role), D-06 (owners/eligible lists are unpaginated), D-07 (searchable dropdown = client-side filtering over the full `/eligible` response, NOT a backend `?q=` param)
- `backend/app/controllers/v1/admin/settings/owners_controller.rb` — `index` (GET owners), `eligible` (GET eligible admin/agent members), `create` (POST promote, body shape `{ user: { user_id: <uid> } }`)

### Existing patterns to follow (frontend)
- `frontend/src/containers/adminBoard/settingsAdminBoard/SettingsAdminBoard.tsx` — the stub this phase replaces
- `frontend/src/components/view/admin/listingGroupsAdminView/addUserToGroupView/AddUserToGroupView.tsx` — existing Command/Popover searchable-combobox pattern; direct analog for the Add Owner dropdown (OWN-03)
- `frontend/src/components/view/admin/common/RolePermissions.tsx` — reusable role-description card component (see D-05/D-06/D-07)
- `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx`, `frontend/src/components/view/admin/domainsAdminView/DeleteDomainDialog.tsx` — existing AlertDialog warning-before-confirm patterns, relevant for the Add Owner confirmation flow
- `frontend/src/assets/rbac/permissions.ts`, `frontend/src/components/common/guards/Can.tsx`, `frontend/src/store/hooks/Auth/useRole.ts` — existing permission/role-gating primitives (no owner-only permission currently exists — see Claude's Discretion above)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RolePermissions` component — name/description cards per role, already used on the add-agent page; directly reusable here per D-05
- `AddUserToGroupView`'s Command/Popover combobox — proven searchable-dropdown implementation to mirror for the Add Owner user picker
- `BoardRegistrations.tsx` / `DeleteDomainDialog.tsx` — AlertDialog confirm-with-warning patterns

### Established Patterns
- Data flow: Component → Context (Brain) → TanStack Hook → API module → Axios instance (CLAUDE.md)
- Query keys centralized in `frontend/src/store/hooks/queryKeys.tsx` — new owner-list/eligible-list keys must be added there, not inlined
- Mutations invalidate the relevant query key on success (OWN-05 requires this for the promote mutation)

### Integration Points
- `frontend/src/router/admin/admin.tsx` line ~104 already wires `path: 'settings'` → `readTierRoles(<SettingsAdminBoard />)` — no new route needed, only the component's contents change
- New TanStack hooks belong under `frontend/src/store/hooks/Admin/Settings/` (or similar), following the existing `Admin/` domain grouping

</code_context>

<specifics>
## Specific Ideas

- Add Owner warning copy must explicitly mention: (1) ability to remove/demote other owners, (2) full brokerage-wide data/settings access, (3) future billing access (forward-looking, even though Billing itself isn't live) — see D-04.
- Current Owners list stays visually minimal — no avatars, no timestamps, no self-indicator badge — just name + email per row.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)
- `arch-brokerage-listing-access.md` ("Rethink listing access model — BrokerageEstate vs board credential JOIN") — matched by keyword overlap ("access", "brokerage") during todo cross-reference, but it concerns listing/board access architecture, unrelated to ownership management UI. Not folded into this phase's scope.

</deferred>

---

*Phase: 34-ownership-management-ui-settings-page-add-owner*
*Context gathered: 2026-07-13*
