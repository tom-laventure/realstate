# Phase 31: Agent Dashboard Access & Group Management - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Open the admin dashboard to the `agent` role and give agents full CRUD on Groups — the primary workspace agents need day to day. Backend already accepts `agent` on all group-scoped endpoints and read-only admin endpoints (Phase 30 / RBAC-01, RBAC-02); this phase is primarily about unlocking frontend gates, plus one backend gap discovered during scouting (main-domain portal access, see D-01).

In scope:
- Subdomain admin shell access (`AppShellAdmin.tsx` role gate)
- Main-domain portal access (`/dashboard` via `AdminBrokeragesController`)
- Admin nav visibility for agents (subdomain `SideNav.tsx` + main-domain `PortalAdminSideNav.tsx`)
- Full group CRUD UI: create/edit/delete groups, add existing users, invite new clients, manage filter sets, manage listings within a group (GROUP-01–05)

Out of scope (belongs to Phase 32 or later):
- Read-only access to Users, Brokerage, Boards, Domains, Settings (ACCESS-02–06)
- Blocking brokerage-level staff invitations (ACCESS-07)
- Domain-mutation button gating fix (ACCESS-08)
- `staff` role, new granular `Permission` values — out of scope for v1.10 (see REQUIREMENTS.md)

</domain>

<decisions>
## Implementation Decisions

### Main-domain portal access
- **D-01:** Agents get main-domain portal access (`/dashboard`) in this phase, not just subdomain access. `V1::Account::AdminBrokeragesController#index` currently filters `role: %w[admin owner]` — this must be extended to include `agent`. This endpoint is in a different namespace (`V1::Account`, not `V1::Admin`) and was **not** touched by Phase 30's RBAC work, so it's a net-new backend change for this phase, not a frontend-only fix. Without this change, an agent signing in on the main domain hits `/no-access` via `LoginSuccessful.tsx`/`Login.tsx`'s `data.adminBrokerages.length > 0` check, regardless of any subdomain-side gate changes.
- **D-02:** The subdomain gate fix is the one-line `RequireRole roles={['owner', 'admin']}` in `AppShellAdmin.tsx` — add `'agent'`.

### Admin nav exposure sequencing
- **D-03:** Agents see a **Groups-only** Admin nav section in this phase, not the full admin nav. This applies to both:
  - Subdomain `SideNav.tsx` — the `canAccessAdmin`-gated Admin section currently lists Brokerage/Boards/Users/Groups/Domains/Settings unconditionally once `access_admin_panel` is true; agent's view must be narrowed to Groups only.
  - Main-domain `PortalAdminSideNav.tsx` — currently has **zero** permission gating at all (renders Brokerage/Board Registrations/Users/Groups/Domains/Settings unconditionally for whoever reaches it). This phase must add agent-aware filtering here too, scoped to Groups only for agent.
  - Rationale: Phase 32 (not yet built) adds read-only gating to Users/Brokerage/Boards/Domains/Settings. Showing agents those links now would expose full create/edit/delete UI that 403s on submit — an unfinished-looking state. Phase 32 will expand the nav to include those sections once read-only views exist.

### First-time agent experience
- **D-04:** The group management experience (list, empty state, "Create Group" CTA, copy) is **identical** for agents and admin/owner — no agent-specific branching, no tailored empty-state copy or onboarding nudge. Reuse `ListingGroupAdminBoard` and the existing `Can permission="manage_groups"` CTA on `GeneralDashboard.tsx` as-is.

### Group management scope
- **D-05:** Agents see the same **brokerage-wide** group list as admin/owner — all groups in the brokerage, not filtered to groups the agent is a member of. `GroupQuery` is already brokerage-scoped with no membership filter; no new filtering logic needed. Confirmed via `backend/app/queries/group_query.rb` and `V1::Admin::GroupsController#index`.

### Permission model (locked by REQUIREMENTS.md, not re-litigated)
- Reuse the existing 4-permission model (`access_admin_panel`, `manage_brokerage_settings`, `manage_users`, `manage_groups`). Add `agent: ['access_admin_panel', 'manage_groups']` to `ROLE_PERMISSIONS` in `frontend/src/assets/rbac/permissions.ts` — no new `Permission` values (explicitly out of scope per REQUIREMENTS.md).

### Claude's Discretion
- Exact mechanism for scoping `PortalAdminSideNav.tsx` to Groups-only for agent (e.g., filtering the `items` array by role/permission inline, or introducing a small per-item permission map) — implementation detail.
- Exact mechanism for narrowing the subdomain `SideNav.tsx` Admin section to Groups-only for agent (e.g., a second permission check per nav item, or a role-based item list) — implementation detail, follow whatever keeps `canAccessAdmin` reusable for the Phase 32 expansion.
- Whether `V1::Account::AdminBrokeragesController`'s `member_roles`/response naming needs any adjustment now that `agent` is included in `admin_brokerages` — cosmetic naming detail, not a user decision.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Role & access-control reference
- `.planning/ROLES.md` — role definitions, current enforcement state, known gaps. Confirms `agent`/`staff` map to `[]` in `ROLE_PERMISSIONS` today — "not a design decision, just nothing built yet."

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — ACCESS-01, GROUP-01–05 (this phase's requirements); Out of Scope table (no new `Permission` values, `staff` role, agent visibility into brokerage-level invitations)
- `.planning/ROADMAP.md` — Phase 31 goal, success criteria, dependency on Phase 30; Phase 32 scope (what's deliberately deferred)
- `.planning/PROJECT.md` — Key Decisions table, Constraints section (soft deletes, serializer N+1, testing conventions)

### Prior phase context
- `.planning/phases/30-backend-rbac-enforcement/30-CONTEXT.md` — confirms backend already grants `agent` full CRUD on all group-scoped endpoints and read-only access on `users#index/show`, `brokerages#show`, `domains#index/verify`, `boards#index`, `board_credentials#index`, `activity#stats/index`. Also confirms `V1::Admin::EstatesController#search/cities` (top-level, distinct from `group/estates`) already grants agent read access (D-01 in that context file).

No other external specs/ADRs — requirements fully captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/components/common/guards/RequireRole.tsx` — subdomain shell gate; `roles={['owner', 'admin']}` in `AppShellAdmin.tsx` is the single point to extend with `'agent'`. Note: `RequireRole` bypasses entirely (`return children`) when `isMainDomain()` — it has no effect on the main-domain path.
- `frontend/src/components/common/guards/Can.tsx` + `frontend/src/assets/rbac/permissions.ts` — permission-based gating (`usePermission`/`hasPermission`). `Can permission="manage_groups"` already gates the "Create Group" CTA on `GeneralDashboard.tsx` (line 64) — will work for agent automatically once `ROLE_PERMISSIONS.agent` includes `manage_groups`.
- `frontend/src/components/sidenav/useSideNavContext.ts` — exposes `canAccessAdmin` (from `usePermission('access_admin_panel')`) to `SideNav.tsx`, which conditionally renders the entire Admin section.
- `backend/app/queries/group_query.rb`, `backend/app/controllers/v1/admin/groups_controller.rb` — already brokerage-scoped, no per-role filtering needed for agent's group list.

### Established Patterns
- Component → Context → TanStack hook → API module → Axios instance (per CLAUDE.md). Any new gating logic in `PortalAdminSideNav.tsx` should follow existing patterns (e.g. `usePermission` like `useSideNavContext.ts` does), not a new one-off role string comparison.
- Frontend guards are UX-only; backend 403 is the real security boundary (established in Phase 7, reaffirmed in Phase 30 CONTEXT.md). Even if agent briefly sees a nav link that shouldn't be there, the backend already enforces the real boundary.

### Integration Points
- `frontend/src/router/admin/AdminDomainShell.tsx` — delegates to `PortalAdminShell` (main domain) or `AppShellAdmin` (subdomain) based on `isMainDomain()`. Both paths need agent-aware changes: `AppShellAdmin`'s `RequireRole`, `PortalAdminShell`'s child `PortalAdminSideNav` (currently ungated).
- `backend/app/controllers/v1/account/admin_brokerages_controller.rb` — `role: %w[admin owner]` filter (line ~19) is the D-01 change point. Also feeds `member_count`/`owners` computation — verify agents don't unexpectedly appear in `owners` (they won't; that's filtered to `role == "owner"` separately).
- `frontend/src/containers/auth/LoginSuccessful.tsx` (line 48) and `frontend/src/containers/auth/Login.tsx` (line 24) — both branch on `data.adminBrokerages.length > 0`; no code change needed here, they'll pick up agent automatically once D-01 lands on the backend.

</code_context>

<specifics>
## Specific Ideas

No UI mockups or visual references provided — reuse existing admin/owner group management UI verbatim (per D-04). The main finding this phase surfaced (D-01: main-domain portal gap) was a code-discovery, not a user-provided reference.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Read-only access, staff role, and new Permission values are already recorded as Out of Scope / Phase 32 in REQUIREMENTS.md and ROADMAP.md, not raised as new ideas here.)

</deferred>

---

*Phase: 31-Agent Dashboard Access & Group Management*
*Context gathered: 2026-07-09*
