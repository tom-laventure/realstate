---
status: partial
phase: 32-agent-read-only-access-access-gating
source: [32-VERIFICATION.md]
started: 2026-07-10T19:33:29.095Z
updated: 2026-07-10T19:33:29.095Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live agent session — direct route access
expected: Sign in as a real `agent` user and directly enter each of these URLs: `/admin/brokerage`, `/admin/boards`, `/admin/users`, `/admin/users/members/:memberId`, `/admin/domains`, `/admin/settings`, then `/admin/brokerage/add-agent` and `/admin/users/members/:memberId/edit`. The first six should render their content with no redirect. The last two should redirect to `/`.
result: [pending]

### 2. Live agent session — visual mutation-control absence
expected: As the same agent session, open the Users list, a member detail page, the Domains page, and `/admin/users`. No Edit/Delete icons on user rows, no "Add Admin to Brokerage" dropdown item, no "Manage Account" button, no "Remove from group" action, no Invitations section anywhere, and no "Verify now"/"Set as primary"/"Delete"/"Upgrade plan" buttons on any domain card.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
