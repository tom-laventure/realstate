---
status: partial
phase: 33-backend-owner-api-endpoint-lockdown
source: [33-01-SUMMARY.md, 33-02-SUMMARY.md, 33-03-SUMMARY.md]
started: 2026-07-13T00:33:09Z
updated: 2026-07-13T01:00:31Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 6
name: Promote an eligible member to Owner
expected: |
  As an owner, `POST /v1/admin/settings/owners` with `{ "user": { "user_id": "<uid of an admin or agent>" } }` returns 200/201, and that user now appears in the owners list from test 5. A non-owner (admin) attempting the same call gets 403. Attempting to promote a `client` (not admin/agent) gets 422.
awaiting: user response

## Tests

### 1. Add Agent form — Owner option removed
expected: Sign in as any admin or owner and open `/admin/brokerage/add-agent`. The role dropdown offers only "Agent" and "Admin" — there is no "Owner" option anywhere in the list.
result: pass

### 2. Non-owner cannot invite someone as Owner
expected: As a non-owner admin, `POST /v1/admin/invitations` with `{ "invitation": { "email": "...", "role": "owner" } }` returns HTTP 403. The same admin inviting with `role: "agent"` or `role: "admin"` still succeeds (201).
result: pass

### 3. Non-owner cannot change an existing user's role to or from Owner
expected: `PATCH /v1/admin/users/:id` with `{ "user": { "role": "owner" } }` returns 403 for any caller (admin or owner). Also, an owner attempting to demote another owner via this same endpoint (e.g. `role: "admin"`) also returns 403 — that path is blocked for everyone; only the dedicated owners endpoint (test 6/7) can change ownership.
result: pass

### 4. Non-owner cannot destroy an Owner; last owner can't be destroyed at all
expected: `DELETE /v1/admin/users/:id` targeting a user whose role is `owner`, called by a non-owner (admin), returns 403. Called by an owner against the brokerage's last remaining owner, it returns 422 ("Cannot remove the brokerage's last owner"). Destroying a non-owner user works as before.
result: pass

### 5. Owners list and eligible-for-promotion list
expected: `GET /v1/admin/settings/owners` (as owner or admin) returns the brokerage's current owners with name + email. `GET /v1/admin/settings/owners/eligible` returns brokerage members whose role is `admin` or `agent` (owners and clients excluded), each with name/email/role.
result: pass

### 6. Promote an eligible member to Owner
expected: |
  As an owner, `POST /v1/admin/settings/owners` with `{ "user": { "user_id": "<uid of an admin or agent>" } }` returns 200/201, and that user now appears in the owners list from test 5. A non-owner (admin) attempting the same call gets 403. Attempting to promote a `client` (not admin/agent) gets 422.
result: [pending]

### 7. Demote an Owner, with last-owner protection and self-demotion
expected: |
  As an owner (with at least one other owner remaining), `PATCH /v1/admin/settings/owners/:id` with `{ "user": { "role": "admin" } }` targeting another owner succeeds (200) and that user drops off the owners list. The same caller can also demote themselves if another owner still remains. If only one owner remains, demoting that sole owner (self or otherwise) returns 422 ("Cannot remove the brokerage's last owner"). A non-owner caller gets 403 on any demote attempt.
result: [pending]

## Summary

total: 7
passed: 5
issues: 1
pending: 2
skipped: 0

## Gaps

- truth: "Non-owner cannot invite someone as Owner"
  status: failed
  reason: >-
    User reported: /admin/users/members/ad47a73b-c452-412b-80aa-ef683f4a67e4/edit
    shows "Owner" as a selectable role, but returns 403 when attempted to update.
    Root cause (not yet diagnosed in depth): EditMemberView.tsx (frontend/src/components/view/admin/usersAdminView/memberAdminView/EditMemberView.tsx)
    defines ALL_ROLE_OPTIONS including {value:'owner', label:'Owner'} and shows it
    whenever the viewing caller's own role is owner (line 44: `currentUserRole === 'owner' ? ALL_ROLE_OPTIONS : ADMIN_ROLE_OPTIONS`).
    Phase 33 Plan 01 locked down PATCH /v1/admin/users/:id to reject role:"owner"
    universally (D-02), for ANY caller including owners — but Plan 03 (LOCK-02)
    only removed the owner option from AddAgentView.tsx (the invite/add-agent form),
    not this separate Edit Member form. The two pages share the "assign a role to
    a user" concern but were not both updated.
  severity: major
  test: 2
  artifacts: []
  missing: []
