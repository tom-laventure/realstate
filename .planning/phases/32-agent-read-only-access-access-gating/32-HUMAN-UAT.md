---
status: diagnosed
phase: 32-agent-read-only-access-access-gating
source: [32-VERIFICATION.md]
started: 2026-07-10T19:33:29.095Z
updated: 2026-07-10T19:59:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Live agent session — direct route access
expected: Sign in as a real `agent` user and directly enter each of these URLs: `/admin/brokerage`, `/admin/boards`, `/admin/users`, `/admin/users/members/:memberId`, `/admin/domains`, `/admin/settings`, then `/admin/brokerage/add-agent` and `/admin/users/members/:memberId/edit`. The first six should render their content with no redirect. The last two should redirect to `/`.
result: issue
reported: "accessing admin/users gets this response GET http://127.0.0.1:8080/v1/admin/invitations?status=accepted&page=1 Status 403 Forbidden"
severity: major

### 2. Live agent session — visual mutation-control absence
expected: As the same agent session, open the Users list, a member detail page, the Domains page, and `/admin/users`. No Edit/Delete icons on user rows, no "Add Admin to Brokerage" dropdown item, no "Manage Account" button, no "Remove from group" action, no Invitations section anywhere, and no "Verify now"/"Set as primary"/"Delete"/"Upgrade plan" buttons on any domain card.
result: issue
reported: "same issue with /admin/users page, other pages look good"
severity: major

## Summary

total: 2
passed: 0
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Sign in as a real `agent` user and directly enter `/admin/users`; the page should render its content with no redirect."
  status: failed
  reason: "User reported: accessing admin/users gets this response GET http://127.0.0.1:8080/v1/admin/invitations?status=accepted&page=1 Status 403 Forbidden"
  severity: major
  test: 1
  root_cause: "UsersAdminBoard.tsx calls useBrokerageUsersAdminContext() unconditionally, which calls useFetchBrokerageInvitations() with no permission/role gate. The 32-03 fix wrapped only the rendered <InvitationsView> JSX in <Can permission=\"manage_users\">, which hides the UI but cannot prevent the ancestor's hook (the data fetch) from firing on every render, including for agent-role users. Backend correctly 403s (require_admin! on InvitationsController#index, per ACCESS-07) — the bug is that the frontend still issues the request at all."
  artifacts:
    - path: "frontend/src/containers/adminBoard/usersAdminBoard/UsersAdminBoard.tsx"
      issue: "Can permission=\"manage_users\" gate wraps only the InvitationsView JSX (lines ~33-43), not the useBrokerageUsersAdminContext() call (line 12) whose hook chain performs the fetch"
    - path: "frontend/src/containers/adminBoard/usersAdminBoard/useUsersAdminContext.tsx"
      issue: "useFetchBrokerageInvitations(...) called unconditionally at lines 31-34, no permission check"
    - path: "frontend/src/store/hooks/Admin/Invitations/useFetchBrokerageInvitations.tsx"
      issue: "useQuery has no enabled option as a last line of defense against unauthorized calls"
  missing:
    - "Gate useFetchBrokerageInvitations with enabled: usePermission('manage_users') (or equivalent) so the request never fires for agent-role users"
  debug_session: ".planning/debug/admin-users-invitations-403-for-agent.md"

- truth: "On `/admin/users`, no Invitations section should appear anywhere for an agent user."
  status: failed
  reason: "User reported: same issue with /admin/users page (other pages — Users list, member detail, Domains — look good)"
  severity: major
  test: 2
  root_cause: "Same as Test 1's gap — the Invitations section JSX is correctly hidden via <Can permission=\"manage_users\">, but the ancestor's ungated data fetch (useFetchBrokerageInvitations via useUsersAdminContext) still fires and 403s, visible in devtools even though no UI renders."
  artifacts:
    - path: "frontend/src/containers/adminBoard/usersAdminBoard/UsersAdminBoard.tsx"
      issue: "Can permission=\"manage_users\" gate wraps only the InvitationsView JSX, not the context hook call that triggers the fetch"
    - path: "frontend/src/containers/adminBoard/usersAdminBoard/useUsersAdminContext.tsx"
      issue: "useFetchBrokerageInvitations(...) called unconditionally, no permission check"
  missing:
    - "Same fix as Test 1: gate the fetch itself, not just the rendered section"
  debug_session: ".planning/debug/admin-users-invitations-403-for-agent.md"
