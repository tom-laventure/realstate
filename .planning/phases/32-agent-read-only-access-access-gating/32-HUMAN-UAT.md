---
status: complete
phase: 32-agent-read-only-access-access-gating
source: [32-VERIFICATION.md]
started: 2026-07-10T19:33:29.095Z
updated: 2026-07-10T19:44:00.000Z
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
  artifacts: []
  missing: []

- truth: "On `/admin/users`, no Invitations section should appear anywhere for an agent user."
  status: failed
  reason: "User reported: same issue with /admin/users page (other pages — Users list, member detail, Domains — look good)"
  severity: major
  test: 2
  artifacts: []
  missing: []
