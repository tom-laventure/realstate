---
issue_id: admin-users-invitations-403-for-agent
phase: 32-agent-read-only-access-access-gating
status: root_cause_found
---

## Symptoms

expected: Agent-role user loads `/admin/users` and either never requests the invitations endpoint at all (agents shouldn't see that section), or the endpoint is scoped appropriately — no console/network error, no Invitations UI shown.
actual: Frontend issues `GET /v1/admin/invitations?status=accepted&page=1` and backend returns `403 Forbidden` while an agent is on `/admin/users`.
errors: "GET http://127.0.0.1:8080/v1/admin/invitations?status=accepted&page=1 — Status 403 Forbidden" (browser devtools Network tab)
reproduction: Sign in as a real agent-role user, navigate directly to `/admin/users`, open devtools Network tab, observe the invitations request 403ing.
timeline: Discovered during human UAT of Phase 32, 2026-07-10.

## Root Cause

`UsersAdminBoard.tsx` calls `useBrokerageUsersAdminContext()` unconditionally at the top of the component. That context hook in turn calls `useFetchBrokerageInvitations(...)` with no `enabled`/role gate at all. Phase 32-03's fix wrapped only the *rendered* `<InvitationsView>` JSX in `<Can permission="manage_users">` — this correctly hides the UI section but cannot stop the ancestor's hooks from firing, since `<Can>` is a child element in the render tree, evaluated *after* `UsersAdminBoard`'s own hooks (including the invitations fetch) have already executed for that render.

As a result, an agent-role user visiting `/admin/users` always triggers `GET /v1/admin/invitations?status=accepted&page=1`. Backend correctly denies it — `V1::Admin::InvitationsController#index` is guarded by `before_action :require_admin!` — per ACCESS-07 ("agent fully blocked, no view"). The backend 403 is intentional and correct; the bug is entirely that the frontend still issues the request in the first place.

## Evidence

- `frontend/src/containers/adminBoard/usersAdminBoard/UsersAdminBoard.tsx:12` — `useBrokerageUsersAdminContext()` called unconditionally; `:33-43` — `<Can permission="manage_users">` only wraps the `<InvitationsView>` JSX, not the context-hook call above it.
- `frontend/src/containers/adminBoard/usersAdminBoard/useUsersAdminContext.tsx:31-34` — `useFetchBrokerageInvitations({...})` called unconditionally, no permission/role check anywhere in the hook.
- `frontend/src/store/hooks/Admin/Invitations/useFetchBrokerageInvitations.tsx:8-20` — the underlying `useQuery` has no `enabled` option; nothing suppresses it based on role.
- `frontend/src/components/common/guards/Can.tsx` — confirmed to be a simple hide-entirely component (`allowed ? children : fallback`); structurally cannot prevent a parent's hook calls.
- `backend/app/controllers/v1/admin/invitations_controller.rb:6` — `before_action :require_admin!, only: [:index, ...]` — confirms the backend 403 for agent is intentional (ACCESS-07), not a backend bug.

## Files Involved

- `frontend/src/containers/adminBoard/usersAdminBoard/UsersAdminBoard.tsx` — the `<Can>` gate is placed around the wrong thing (JSX only, not the data-fetch trigger).
- `frontend/src/containers/adminBoard/usersAdminBoard/useUsersAdminContext.tsx` — where the ungated `useFetchBrokerageInvitations` call actually lives.
- `frontend/src/store/hooks/Admin/Invitations/useFetchBrokerageInvitations.tsx` — no `enabled` guard as a last line of defense.

## Suggested Fix Direction

Gate the invitations fetch itself (e.g., pass an `enabled: usePermission('manage_users')` condition into `useFetchBrokerageInvitations`, or skip calling it/short-circuit inside `useUsersAdminContext` when the user lacks `manage_users`), not just the rendered `<InvitationsView>` JSX. This is a pattern-level gap in Phase 32-03 — the `<Can>` component is correct for hiding controls that have no independent side effects, but any control/section whose *parent* performs a network fetch needs the fetch itself gated too.

**Specialist Hint:** react
