---
status: partial
phase: 32-agent-read-only-access-access-gating
source: [32-VERIFICATION.md]
started: 2026-07-10T19:33:29.095Z
updated: 2026-07-10T20:30:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live agent session — /admin/users no longer fetches or shows invitations
expected: Sign in as a real `agent` user, open devtools Network tab, navigate to `/admin/users`. Confirm NO `GET /v1/admin/invitations` request is issued and NO 403 appears. Confirm no Invitations section renders (unchanged from 32-03).
result: [pending]

### 2. Live admin/owner session — /admin/users unaffected
expected: Sign in as admin or owner, open `/admin/users`. Confirm `GET /v1/admin/invitations` fires with 200 and the Invitations section renders and functions exactly as before.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

- truth: "Sign in as a real `agent` user and directly enter `/admin/users`; the page should render its content with no redirect, and no invitations request should fire."
  status: resolved
  reason: "Root cause (useFetchBrokerageInvitations fetched unconditionally regardless of the <Can> JSX gate) fixed in plan 32-04: usePermission('manage_users') now gates the fetch itself via enabled:false for agent role. Verified at code level (32-VERIFICATION.md re-run: 6/6 must-haves) and via new hook test (useUsersAdminContext.test.tsx). Awaiting final live-browser confirmation via Test 1 above before fully closing."
  severity: major
  test: 1
  root_cause: "UsersAdminBoard.tsx calls useBrokerageUsersAdminContext() unconditionally, which calls useFetchBrokerageInvitations() with no permission/role gate. The 32-03 fix wrapped only the rendered <InvitationsView> JSX in <Can permission=\"manage_users\">, which hides the UI but cannot prevent the ancestor's hook (the data fetch) from firing on every render, including for agent-role users. Backend correctly 403s (require_admin! on InvitationsController#index, per ACCESS-07) — the bug was that the frontend still issued the request at all."
  artifacts:
    - path: "frontend/src/store/hooks/Admin/Invitations/useFetchBrokerageInvitations.tsx"
      issue: "RESOLVED — now accepts options?: { enabled?: boolean }, wired as enabled: options?.enabled ?? true"
    - path: "frontend/src/containers/adminBoard/usersAdminBoard/useUsersAdminContext.tsx"
      issue: "RESOLVED — canManageUsers = usePermission('manage_users') now passed as { enabled: canManageUsers }"
  missing: []
  debug_session: ".planning/debug/admin-users-invitations-403-for-agent.md"

- truth: "On `/admin/users`, no Invitations section should appear anywhere for an agent user."
  status: resolved
  reason: "Same fix as gap 1 (plan 32-04). Code-level verification passed; awaiting final live-browser confirmation via Test 1 above."
  severity: major
  test: 2
  root_cause: "Same as gap 1 — the Invitations section JSX was correctly hidden via <Can permission=\"manage_users\">, but the ancestor's ungated data fetch still fired and 403'd, visible in devtools even though no UI rendered."
  artifacts:
    - path: "frontend/src/containers/adminBoard/usersAdminBoard/useUsersAdminContext.tsx"
      issue: "RESOLVED — fetch now gated by the same usePermission('manage_users') check"
  missing: []
  debug_session: ".planning/debug/admin-users-invitations-403-for-agent.md"
