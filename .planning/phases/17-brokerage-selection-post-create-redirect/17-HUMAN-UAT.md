---
status: partial
phase: 17-brokerage-selection-post-create-redirect
source: [17-VERIFICATION.md]
started: 2026-05-25T00:00:00Z
updated: 2026-05-25T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Multi-brokerage card list renders correctly
expected: When a user with 2+ brokerages logs in and arrives at /dashboard, they see a selection card for each brokerage with name and role badge. Clicking a card navigates to /dashboard/:brokerageId.
result: [pending]

### 2. Single-brokerage auto-redirect with no flash (BROK-02)
expected: When a user with exactly 1 brokerage logs in, they are immediately redirected to /dashboard/:brokerageId with no visible "Select a brokerage" UI flash. Browser back button should not return to an empty selection screen.
result: [pending]

### 3. Post-wizard "Go to dashboard" full end-to-end flow (ONB-04)
expected: After completing the create-brokerage wizard, the "Go to dashboard" button in SuccessStep redirects to https://{MAIN_DOMAIN}/dashboard/:brokerageId on the main domain. The button is disabled if no brokerageId is available.
result: [pending]

### 4. Invalid /dashboard/:brokerageId URL triggers D-12 redirect
expected: Entering /dashboard/nonexistent-id directly in the browser causes PortalShell to detect the invalid ID (not in adminBrokerages list) and redirect back to /dashboard (BrokerageSelection).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
